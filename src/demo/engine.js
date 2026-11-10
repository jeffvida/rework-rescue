// Management reporting engine (spec 10 Nov 2026): collect → consolidate → validate → analyse → human review →
// approval and publication. Pure functions over ./data.js, so tests/demo.test.mjs can check every figure the hero,
// the demo, the management summary, the published report and the action register show.
//
// Rules enforced here:
//   - Source rows are frozen and never edited. Exclusions, links and corrections are reviewer decisions, stored with
//     the evidence they rest on, and every figure is recalculated from the rows plus the decisions.
//   - Data accuracy problems are kept apart from operational exceptions. A blocking finding (one that affects reported
//     figures) must be resolved, confirmed or formally accepted with a disclosure before publication. Operational
//     exceptions (overdue work, missing ownership, work awaiting invoicing) never block: they are disclosed.
//   - Publication also needs every automatic check to pass (record counts, totals, data quality).
//   - Publishing is a human approval. Any decision change afterwards withdraws it ("Changed since publishing") and
//     needs a new approval.
//   - AI-drafted text (simulated) is built only from calculated figures and reviewer decisions. It separates
//     confirmed facts, potential discrepancies, operational exceptions, unverified points and recommendations.
//   - Every decision, change, invalidation and publication is appended to a frozen log.

import { WORK, INVOICES, REQUESTS, SOURCES, RULES, ISSUES, CATEGORIES, STAFF, PERIOD, REPORT_DATE, WEEK } from './data.js';

export const ISSUE_IDS = ['duplicate', 'invoice', 'overdue', 'owner'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const AI_LABEL = 'AI-drafted · simulated in this demo';
export const STATUS_LABELS = {
  investigate: 'Needs investigation',
  resolved: 'Resolved',
  legitimate: 'Confirmed legitimate',
  action: 'Action required',
  disclosed: 'Accepted with disclosure',
  stale: 'Needs investigation (data changed)',
};
/** Statuses with nothing left for anyone to do. */
export const CLOSED = ['resolved', 'legitimate', 'disclosed'];
export { CATEGORIES, STAFF, PERIOD, WEEK };
export const n = (x) => x.toLocaleString('en-US');
const pct = (a, b) => `${Math.round((a / b) * 100)}%`;
const DUP = ['W-1043', 'W-1051']; const NOINV = 'W-1047'; const CANDIDATE = 'INV-2107'; const LATE = 'W-1055'; const UNOWNED = 'W-1056';
const MOVE_REQUEST = 'R-308'; const NEW_DUE = '2026-11-13';

// ---- Dates: each source keeps its own format; consolidation standardises them to ISO.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function toIso(v) {
  if (!v) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) return valid(+m[3], +m[2], +m[1]);
  m = /^(\w{3}) (\d{1,2}) (\w{3})$/.exec(v);
  if (m) { const iso = valid(Number(REPORT_DATE.slice(0, 4)), MON.indexOf(m[3]) + 1, +m[2]); return iso && dayOf(iso) === m[1] ? iso : ''; }
  return '';
}
function valid(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : '';
}
export const dayOf = (iso) => DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const fmtDate = (iso) => (iso ? `${dayOf(iso)} ${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}` : '');

export function initialState() {
  return Object.freeze({
    decisions: Object.freeze({ duplicate: null, invoice: null, overdue: null, owner: null }),
    log: Object.freeze([]),
    seq: 0,
    published: null,
    changedSincePublish: false,
  });
}

/** Records per source. */
export function sourceCounts() {
  const c = { work: WORK.length, invoices: INVOICES.length, requests: REQUESTS.length };
  return { ...c, total: c.work + c.invoices + c.requests, sources: SOURCES.length };
}

const choiceOf = (s, issue) => s.decisions[issue]?.choice ?? null;

// ---- Consolidated, standardised working data (the originals are kept alongside every change)

/** Every work record with ISO dates and the reviewer's exclusion, correction, link or assignment beside the original. */
export function workingWork(s = initialState()) {
  const dup = choiceOf(s, 'duplicate'); const inv = choiceOf(s, 'invoice'); const late = s.decisions.overdue; const own = s.decisions.owner;
  return WORK.map((w) => {
    const row = { ...w, scheduled: toIso(w.scheduled), due: toIso(w.due), completed: toIso(w.completed), excluded: false, changes: [] };
    if (w.id === DUP[1] && dup === 'exclude') { row.excluded = true; row.changes.push({ field: 'excluded', from: 'counted', to: 'excluded as a duplicate of W-1043', evidence: 'R-303' }); }
    if (w.id === NOINV && inv === 'link') { row.invoice = CANDIDATE; row.changes.push({ field: 'invoice', from: '', to: CANDIDATE, evidence: 'R-307' }); }
    if (w.id === LATE && late?.choice === 'correctDate') { row.due = NEW_DUE; row.changes.push({ field: 'due', from: w.due, to: NEW_DUE, evidence: MOVE_REQUEST }); }
    if (w.id === LATE && late?.choice === 'assign') row.followUp = late.owner;
    if (w.id === UNOWNED && own?.choice === 'assign') { row.owner = own.owner; row.next = own.next; row.changes.push({ field: 'owner', from: '', to: `${own.owner} · ${own.next}`, evidence: 'reviewer' }); }
    if (w.id === UNOWNED && own?.choice === 'handled') { row.handledNote = own.note; }
    return row;
  });
}
const counted = (s) => workingWork(s).filter((w) => !w.excluded);
const invoiceFor = (w) => INVOICES.find((i) => i.work === w.id) || (w.invoice ? INVOICES.find((i) => i.id === w.invoice) : null);

// ---- Detection (runs on the data as it stands now: running it again after a decision is the recalculation)

export function runChecks(s = initialState()) {
  const rows = counted(s);
  // A. Duplicates: same customer, service address, job type and scheduled date, different reference.
  const seen = new Map(); const duplicates = [];
  for (const w of rows) {
    const key = RULES.duplicateKeys.map((k) => String(w[k]).toLowerCase()).join('|');
    if (seen.has(key)) duplicates.push([seen.get(key), w.id]); else seen.set(key, w.id);
  }
  const dup = choiceOf(s, 'duplicate') === 'separate' ? duplicates.filter((p) => p.join() !== DUP.join()) : duplicates;
  // B. Cross-source reconciliation: completed work needs an invoice that references it (or a reviewer-confirmed link).
  const unmatched = rows.filter((w) => w.status === 'Completed' && !invoiceFor(w)).map((w) => w.id);
  // C. Overdue: open work past its due date at the report date.
  const overdue = rows.filter((w) => w.status === 'Open' && w.due < REPORT_DATE).map((w) => w.id);
  // D. Ownership: open work needs an owner and a next action.
  const unowned = rows.filter((w) => w.status === 'Open' && (!w.owner || !w.next) && !w.handledNote).map((w) => w.id);
  return { duplicates: dup, unmatched, overdue, unowned };
}

/** E. Data quality checks on the original sources. None of them changes a value; each reports what it found. */
export function qualityChecks() {
  const out = [];
  const missing = [];
  for (const [src, rows] of [['work', WORK], ['invoices', INVOICES], ['requests', REQUESTS]]) for (const r of rows) for (const k of RULES.required[src]) if (!String(r[k] ?? '').trim()) missing.push(`${r.id}.${k}`);
  out.push({ id: 'required', label: 'Required values present', pass: !missing.length, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All required fields filled in all 3 sources' });
  const badDates = [...WORK.flatMap((w) => [['scheduled', w.scheduled], ['due', w.due], ['completed', w.completed]].filter(([, v]) => v && !toIso(v)).map(([k]) => `${w.id}.${k}`)), ...INVOICES.filter((i) => !toIso(i.date)).map((i) => i.id), ...REQUESTS.filter((r) => !toIso(r.received)).map((r) => r.id)];
  out.push({ id: 'dates', label: 'Valid dates', pass: !badDates.length, detail: badDates.length ? `Invalid: ${badDates.join(', ')}` : 'Every date is a real calendar date' });
  const ids = [...WORK, ...INVOICES, ...REQUESTS].map((r) => r.id); const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
  out.push({ id: 'ids', label: 'Unique identifiers', pass: !dupIds.length, detail: dupIds.length ? `Repeated: ${dupIds.join(', ')}` : `${ids.length} references, none repeated` });
  const conflict = WORK.filter((w) => (w.status === 'Completed') !== Boolean(w.completed) || !['Completed', 'Open'].includes(w.status)).map((w) => w.id);
  out.push({ id: 'status', label: 'Consistent statuses', pass: !conflict.length, detail: conflict.length ? `Conflicting: ${conflict.join(', ')}` : 'Completed records have a completion date; open records do not' });
  const badCust = [
    ...WORK.filter((w) => w.request && REQUESTS.find((r) => r.id === w.request)?.customer !== w.customer).map((w) => w.id),
    ...INVOICES.filter((i) => { const ref = i.work ? WORK.find((w) => w.id === i.work) : REQUESTS.find((r) => r.id === i.request); return !ref || ref.customer !== i.customer; }).map((i) => i.id),
  ];
  out.push({ id: 'customers', label: 'Customer references agree', pass: !badCust.length, detail: badCust.length ? `Mismatch: ${badCust.join(', ')}` : 'Linked records name the same customer' });
  const formats = SOURCES.map((x) => x.format);
  out.push({ id: 'formats', label: 'Source formats standardised', pass: true, detail: `${formats.length} date formats standardised (${formats.map((f) => f.replace('Dates as ', '')).join(' · ')}); originals kept` });
  const orphan = [
    ...WORK.filter((w) => w.request && !REQUESTS.some((r) => r.id === w.request)).map((w) => w.id),
    ...REQUESTS.filter((r) => r.work && !WORK.some((w) => w.id === r.work)).map((r) => r.id),
    ...INVOICES.filter((i) => !(i.work && WORK.some((w) => w.id === i.work)) && !(i.request && REQUESTS.some((r) => r.id === i.request))).map((i) => i.id),
  ];
  out.push({ id: 'links', label: 'Relationships between sources', pass: !orphan.length, detail: orphan.length ? `Broken links: ${orphan.join(', ')}` : 'Every link points at an existing record' });
  return out;
}

// ---- Metrics, all calculated from the records

/** The report's figures. Unique counts only once the duplicate is decided; completion rate only when validated. */
export function metrics(s = initialState()) {
  const all = workingWork(s); const rows = counted(s);
  const dupStatus = statusOf(s, 'duplicate');
  const validated = ['resolved', 'legitimate'].includes(dupStatus);
  const disclosed = dupStatus === 'disclosed';
  const completed = rows.filter((w) => w.status === 'Completed');
  const open = rows.filter((w) => w.status === 'Open');
  const daily = DAYS.map((day) => ({ day, completed: completed.filter((w) => dayOf(w.completed) === day && w.completed >= PERIOD.start && w.completed <= PERIOD.end).length }));
  return {
    sourceRecords: all.length,
    recordedCompleted: WORK.filter((w) => w.status === 'Completed').length,
    recordedOpen: WORK.filter((w) => w.status === 'Open').length,
    validated, disclosed,
    unique: validated || disclosed ? rows.length : null,
    completed: completed.length,
    open: validated || disclosed ? open.length : null,
    completionRate: validated ? pct(completed.length, rows.length) : null,
    daily,
    dailyTotal: daily.reduce((t, d) => t + d.completed, 0),
    overdue: runChecks(s).overdue.length,
    awaitingInvoice: runChecks(s).unmatched.length,
  };
}

/** Totals checks: every figure must agree with the records before publication. */
export function totalsChecks(s = initialState()) {
  const m = metrics(s);
  return [
    { id: 'received', label: `${m.sourceRecords} of ${WORK.length} work records received and counted`, pass: m.sourceRecords === WORK.length },
    { id: 'split', label: 'Recorded completed + open = records received', pass: m.recordedCompleted + m.recordedOpen === m.sourceRecords },
    { id: 'daily', label: 'Daily completions add up to the completed total', pass: m.dailyTotal === m.completed },
    { id: 'unique', label: 'Unique completed + open = unique work items', pass: m.unique === null || m.completed + m.open === m.unique },
  ];
}

// ---- Decision basis, status and choices

/** The exact original values a decision depends on. If they change, the decision is invalidated. */
export function basisOf(issue) {
  const w = (ids) => WORK.filter((x) => ids.includes(x.id));
  switch (issue) {
    case 'duplicate': return JSON.stringify({ w: w(DUP), r: REQUESTS.filter((r) => r.id === 'R-303'), i: INVOICES.filter((i) => DUP.includes(i.work)) });
    case 'invoice': return JSON.stringify({ w: w([NOINV]), i: INVOICES.filter((i) => i.work === NOINV || i.id === CANDIDATE), r: REQUESTS.filter((r) => r.id === 'R-307') });
    case 'overdue': return JSON.stringify({ w: w([LATE]), r: REQUESTS.filter((r) => r.id === MOVE_REQUEST), d: REPORT_DATE });
    case 'owner': return JSON.stringify({ w: w([UNOWNED]), r: REQUESTS.filter((r) => r.id === 'R-309') });
    default: return '';
  }
}

const outcome = (issue, choice) => ISSUES[issue].choices.find(([v]) => v === choice)?.[2];

/** A finding's status. Opening or viewing a finding never changes it: only a reviewer decision does. */
export function statusOf(s, issue) {
  const d = s.decisions[issue];
  if (!d) return 'investigate';
  if (d.invalidated || d.basis !== basisOf(issue)) return 'stale';
  return outcome(issue, d.choice);
}

/** Whether a decision is allowed, and why not. details: { owner, next } for assignments, { note } for handled/disclose. */
export function canDecide(s, issue, choice, details = {}) {
  if (!ISSUE_IDS.includes(issue)) return { ok: false, reason: 'Unknown finding.' };
  if (choice === null) return s.decisions[issue] ? { ok: true } : { ok: false, reason: 'Nothing to clear.' };
  if (!ISSUES[issue].choices.some(([c]) => c === choice)) return { ok: false, reason: 'Unknown choice.' };
  const needOwner = (issue === 'owner' && choice === 'assign') || (issue === 'overdue' && choice === 'assign');
  if (needOwner && !STAFF.includes(details.owner)) return { ok: false, reason: `Choose a person: ${STAFF.join(', ')}.` };
  if (issue === 'owner' && choice === 'assign' && !String(details.next ?? '').trim()) return { ok: false, reason: 'Add the next action.' };
  if ((issue === 'owner' && choice === 'handled') || (issue === 'duplicate' && choice === 'disclose')) {
    if (!String(details.note ?? '').trim()) return { ok: false, reason: choice === 'disclose' ? 'Add the disclosure note that will appear in the report.' : 'Add a short explanation: who handled it, and how.' };
  }
  return { ok: true };
}

/** The choices open now, with whether each can be used and why not (details are entered alongside). */
export function choicesFor(s, issue) {
  return ISSUES[issue].choices.map(([value, label, st]) => ({ value, label, status: st, needs: needsFor(issue, value) }));
}
function needsFor(issue, value) {
  if (issue === 'owner' && value === 'assign') return ['owner', 'next'];
  if (issue === 'overdue' && value === 'assign') return ['owner'];
  if ((issue === 'owner' && value === 'handled') || (issue === 'duplicate' && value === 'disclose')) return ['note'];
  return [];
}

// ---- Decisions, log and publication

const append = (s, e) => { const x = Object.freeze({ seq: s.seq + 1, ...e }); return { log: Object.freeze([...s.log, x]), seq: x.seq }; };

/** Make, change or clear (null) a decision. Refused (same state back) unless canDecide allows it. */
export function decide(s, issue, choice, details = {}) {
  if (!canDecide(s, issue, choice, details).ok) return s;
  const prev = s.decisions[issue];
  const need = choice ? needsFor(issue, choice) : [];
  const extra = Object.fromEntries(need.map((k) => [k, String(details[k]).trim().slice(0, 160)]));
  if (prev && !prev.invalidated && prev.choice === choice && need.every((k) => prev[k] === extra[k])) return s;
  const next = choice === null ? null : Object.freeze({ choice, ...extra, basis: basisOf(issue), seq: s.seq + 1 });
  let out = { ...s, decisions: Object.freeze({ ...s.decisions, [issue]: next }) };
  out = { ...out, ...append(out, { type: choice === null ? 'cleared' : prev ? 'changed' : 'decision', issue, from: prev?.choice ?? null, to: choice, ...extra }) };
  if (out.published) out = { ...out, published: null, changedSincePublish: true, ...append(out, { type: 'publish-withdrawn', reason: 'A review decision changed after publishing. The report was recalculated and needs approval again.' }) };
  return Object.freeze(out);
}

/** Blocking issues: publication is not permitted while any remain. */
export function blockers(s = initialState()) {
  const out = [];
  for (const issue of ISSUE_IDS) {
    const st = statusOf(s, issue);
    if (ISSUES[issue].blocking && ['investigate', 'stale'].includes(st)) out.push({ issue, text: `${ISSUES[issue].title} (${findingIds(issue).join(' / ')}): affects the unique work-item count. Resolve it, confirm it, or accept it with a disclosure.` });
    if (st === 'stale' && !ISSUES[issue].blocking) out.push({ issue, text: `${ISSUES[issue].title}: the records it was based on changed. Review it again.` });
  }
  for (const c of [...totalsChecks(s), ...qualityChecks()]) if (!c.pass) out.push({ issue: null, text: `${c.label}: failed.${c.detail ? ` ${c.detail}` : ''}` });
  return out;
}

/** What the published report will disclose: every finding not closed, plus anything accepted with a disclosure. */
export function disclosures(s = initialState()) {
  return ISSUE_IDS.map((issue) => ({ issue, status: statusOf(s, issue) }))
    .filter((x) => x.status !== 'resolved' && x.status !== 'legitimate')
    .map((x) => ({ ...x, title: ISSUES[x.issue].title, label: STATUS_LABELS[x.status], note: s.decisions[x.issue]?.note ?? '' }));
}

/** The publication-readiness check run by both Publish buttons. */
export function readiness(s = initialState()) {
  const b = blockers(s);
  return { ready: !b.length && !s.published, blockers: b, disclosures: disclosures(s), published: !!s.published };
}

/** The reviewer approves and publishes. Refused while any blocking check remains. */
export function publish(s) {
  if (!readiness(s).ready) return s;
  const basis = JSON.stringify({ d: ISSUE_IDS.map((i) => [i, s.decisions[i]?.choice ?? null]), m: metrics(s) });
  const disc = disclosures(s).map((d) => d.title);
  return Object.freeze({ ...s, published: Object.freeze({ seq: s.seq + 1, basis }), changedSincePublish: false, ...append(s, { type: 'published', reason: disc.length ? `Approved and published with ${disc.length} disclosed ${disc.length === 1 ? 'item' : 'items'}: ${disc.join('; ')}.` : 'Approved and published. Nothing left to disclose.' }) });
}

/** Publication state: Review required → Ready for approval → Published (or Changed since publishing). */
export function status(s = initialState()) {
  if (s.published) return 'Published';
  if (s.changedSincePublish) return 'Changed since publishing';
  return blockers(s).length ? 'Review required' : 'Ready for approval';
}

// ---- Findings

const findingIds = (issue) => ({ duplicate: DUP, invoice: [NOINV], overdue: [LATE], owner: [UNOWNED] }[issue]);
const W = (id) => WORK.find((w) => w.id === id);
const R = (id) => REQUESTS.find((r) => r.id === id);
const I = (id) => INVOICES.find((i) => i.id === id);

/** The four findings: what was detected, why it matters, source reference, supporting data, investigation, status. */
export function findings(s = initialState()) {
  const late = W(LATE); const un = W(UNOWNED); const a = W(DUP[0]); const b = W(DUP[1]); const ni = W(NOINV);
  const list = [
    {
      issue: 'duplicate', ids: DUP,
      detected: `${a.id} and ${b.id} have the same customer (${a.customer}), service address (${a.address}), job type (${a.jobType}) and scheduled date (${fmtDate(a.scheduled)}), with different references.`,
      matters: `If they describe the same work, the report counts it twice: 18 records would overstate unique work by one, and ${b.id} would show as open work that may already be done.`,
      source: 'Work Register', refs: { work: DUP, requests: ['R-303'], invoices: ['INV-2103'] },
      supporting: [`Both records point at request R-303 (“${R('R-303').request}”).`, `${a.id} is completed and invoiced (INV-2103). ${b.id} is still open (“${b.next}”, ${b.owner}).`],
      investigate: ['Open request R-303 and both work records.', `Check whether ${b.id} was raised separately by the customer or entered twice.`],
      ai: `Possible explanation: ${b.id} may have been entered again from the same request. This has not been verified.`,
    },
    {
      issue: 'invoice', ids: [NOINV],
      detected: `${ni.id} (${ni.customer}) is recorded as completed on ${fmtDate(ni.completed)}, but no invoice in the Invoice Tracker references it.`,
      matters: 'Completed work without a matching invoice may delay billing. It may also already be invoiced under a different reference.',
      source: 'Work Register × Invoice Tracker', refs: { work: [NOINV], invoices: [CANDIDATE], requests: ['R-307'] },
      supporting: [`Possible match: ${CANDIDATE} (${I(CANDIDATE).customer}, ${I(CANDIDATE).date}) references request R-307, the request behind ${ni.id}, but no work reference.`, 'All other completed work has an invoice that references it.'],
      investigate: [`Check whether ${CANDIDATE} covers ${ni.id}.`, 'If it does not, confirm with Finance whether invoicing is outstanding.'],
      ai: `Possible explanation: ${CANDIDATE} may have been raised against the request rather than the work record. A match is likely but not confirmed.`,
    },
    {
      issue: 'overdue', ids: [LATE],
      detected: `${late.id} (${late.customer}, ${late.jobType}) is open and was due on ${fmtDate(toIso(late.due))}, before the report date (${fmtDate(REPORT_DATE)}).`,
      matters: 'Overdue work may affect a service commitment to the customer. This is an operational exception, not necessarily a data error.',
      source: 'Work Register', refs: { work: [LATE], requests: [MOVE_REQUEST] },
      supporting: [`Request ${MOVE_REQUEST} (${R(MOVE_REQUEST).received}): “${R(MOVE_REQUEST).request}”.`, `Current owner: ${late.owner}. Next action: “${late.next}”.`],
      investigate: [`Read request ${MOVE_REQUEST} and check whether the due date should have changed.`, 'If it is genuinely late, agree the next step with Operations.'],
      ai: `Possible explanation: the customer’s request to move the date (${MOVE_REQUEST}) may not have been reflected in the Work Register.`,
    },
    {
      issue: 'owner', ids: [UNOWNED],
      detected: `${un.id} (${un.customer}, ${un.jobType}, due ${fmtDate(toIso(un.due))}) is open with no owner and no next action.`,
      matters: 'Work without an owner may not be picked up, which can delay the response to the customer.',
      source: 'Work Register', refs: { work: [UNOWNED], requests: ['R-309'] },
      supporting: [`Raised from request R-309 (${R('R-309').channel}, ${R('R-309').received}): “${R('R-309').request}”.`, 'Every other open work record has an owner and a next action.'],
      investigate: ['Check whether anyone has already contacted the customer.', 'Decide who should own it and what happens next.'],
      ai: 'Possible explanation: requests taken by phone may be logged without an owner. This has not been verified.',
    },
  ];
  return list.map((f) => {
    const i = ISSUES[f.issue]; const st = statusOf(s, f.issue); const d = s.decisions[f.issue];
    return {
      ...f, title: i.title, category: i.category, categoryLabel: CATEGORIES[i.category], blocking: i.blocking, team: i.team, action: i.action,
      choices: choicesFor(s, f.issue),
      decision: d?.choice ?? null, owner: d?.owner ?? null, next: d?.next ?? null, note: d?.note ?? null,
      status: st, statusLabel: STATUS_LABELS[st], closed: CLOSED.includes(st),
      consequence: consequence(s, f.issue),
    };
  });
}

function consequence(s, issue) {
  const d = s.decisions[issue]; if (!d) return '';
  if (statusOf(s, issue) === 'stale') return 'The records this decision was based on changed. Please review it again.';
  const m = metrics(s);
  return {
    exclude: `W-1051 excluded from unique work items (its record is kept). Recalculated: ${m.unique} unique work items, ${m.completed} completed, ${m.open} open (${m.completionRate} completion).`,
    separate: `Both kept as separate work. Recalculated: ${m.unique} unique work items, ${m.completed} completed, ${m.open} open (${m.completionRate} completion).`,
    disclose: `Accepted with disclosure: “${d.note}”. The report will show 18 records with the unique count marked unverified.`,
    link: 'INV-2107 linked to W-1047 by the reviewer. The invoice record itself is unchanged.',
    outstanding: 'Recorded as awaiting invoicing. A Finance follow-up will appear in the action register.',
    leave: issue === 'owner' ? 'Left open. It will be disclosed in the report as action required.' : 'Left unresolved. It will be disclosed in the report as needing investigation.',
    confirm: 'Confirmed as still overdue. It will be disclosed in the report with an Operations follow-up.',
    correctDate: 'Due date recorded as Fri 13 Nov from request R-308 (original Wed 4 Nov kept). W-1055 is no longer overdue.',
    assign: issue === 'owner' ? `Assigned to ${d.owner}: “${d.next}”.` : `Follow-up assigned to ${d.owner}. Still overdue, so it stays in the report as action required.`,
    handled: `Marked as handled: “${d.note}”.`,
  }[d.choice];
}

/** Items still requiring attention: anything not resolved, confirmed or formally accepted. */
export const attentionCount = (s = initialState()) => ISSUE_IDS.filter((i) => !CLOSED.includes(statusOf(s, i))).length;

// ---- Management summary (AI-drafted, simulated: built only from the figures and decisions above)

export function summary(s = initialState()) {
  const m = metrics(s); const fs = findings(s); const by = Object.fromEntries(fs.map((f) => [f.issue, f]));
  const st = (i) => by[i].status; const d = (i) => s.decisions[i];
  const facts = [
    `${m.sourceRecords} work records were received for ${PERIOD.label}: ${m.recordedCompleted} recorded as completed and ${m.recordedOpen} as open.`,
    `Completions per day: ${m.daily.map((x) => `${x.day} ${x.completed}`).join(', ')} (${m.dailyTotal} in total).`,
  ];
  if (m.validated) facts.push(`After review: ${m.unique} unique work items, ${m.completed} completed and ${m.open} open (${m.completionRate} completion rate).`);
  if (st('invoice') === 'resolved') facts.push('W-1047 is invoiced: the reviewer linked INV-2107.');
  if (st('overdue') === 'resolved') facts.push('W-1055 is not overdue: its due date was corrected to Fri 13 Nov from request R-308.');
  if (st('owner') === 'resolved') facts.push(d('owner').choice === 'assign' ? `W-1056 is assigned to ${d('owner').owner}: “${d('owner').next}”.` : `W-1056 was marked as handled: “${d('owner').note}”.`);
  const potential = [];
  if (['investigate', 'stale'].includes(st('duplicate'))) potential.push('W-1043 and W-1051 may be the same work. Unique work volume is not confirmed until this is reviewed.');
  if (['investigate', 'stale'].includes(st('invoice'))) potential.push('W-1047 has no matching invoice. INV-2107 may cover it; this is not confirmed.');
  const exceptions = [];
  if (st('invoice') === 'action') exceptions.push('W-1047 is completed and awaiting invoicing.');
  if (st('overdue') !== 'resolved') exceptions.push(`W-1055 is open and past its due date${d('overdue')?.choice === 'assign' ? ` (follow-up: ${d('overdue').owner})` : ''}.`);
  if (st('owner') !== 'resolved') exceptions.push('W-1056 is open without an owner or next action.');
  const unverified = [];
  if (st('duplicate') === 'disclosed') unverified.push(`Unique work volume is unverified: W-1043 and W-1051 may be the same work. Reviewer’s disclosure: “${d('duplicate').note}”.`);
  if (st('overdue') !== 'resolved') unverified.push('Whether W-1055 has affected the customer has not been checked.');
  const recommendations = [];
  if (['investigate', 'stale'].includes(st('duplicate'))) recommendations.push({ team: 'Data/Admin', text: 'Reconcile W-1043 and W-1051 against request R-303 before confirming unique work volume.' });
  if (st('duplicate') === 'disclosed') recommendations.push({ team: 'Data/Admin', text: 'Confirm whether W-1051 duplicates W-1043 before the next report.' });
  if (st('duplicate') === 'resolved') recommendations.push({ team: 'Data/Admin', text: 'Close W-1051 in the Work Register and check for an existing record before raising new work from a request.' });
  if (['investigate', 'stale'].includes(st('invoice'))) recommendations.push({ team: 'Finance', text: 'Check whether INV-2107 covers W-1047; if not, raise the invoice.' });
  if (st('invoice') === 'action') recommendations.push({ team: 'Finance', text: 'Raise the invoice for W-1047 (Lakeside Cafe).' });
  if (st('invoice') === 'resolved') recommendations.push({ team: 'Finance', text: 'Add the work reference to INV-2107 so it matches automatically next time.' });
  if (st('overdue') === 'resolved') recommendations.push({ team: 'Operations', text: 'Update W-1055’s due date to Fri 13 Nov in the Work Register.' });
  else recommendations.push({ team: 'Operations', text: `Review the delay on W-1055 and agree the next step with Westgate Clinic${d('overdue')?.choice === 'assign' ? ` (follow-up: ${d('overdue').owner})` : ''}.` });
  if (st('owner') !== 'resolved') recommendations.push({ team: 'Operations', text: 'Assign a responsible person and next action to W-1056.' });
  const implications = fs.map((f) => ({ issue: f.issue, text: implication(f) })).filter((x) => x.text);
  const good = [
    `Completions were spread across the week (${Math.min(...m.daily.map((x) => x.completed))}–${Math.max(...m.daily.map((x) => x.completed))} a day).`,
    `${m.completed - m.awaitingInvoice} of ${m.completed} completed items have a matching invoice.`,
    `${qualityChecks().filter((c) => c.pass).length} of ${qualityChecks().length} data quality checks passed.`,
  ];
  const attention = fs.filter((f) => !f.closed).map((f) => `${f.title.toLowerCase()} (${f.ids.join(' / ')})`);
  const executive = [
    `What happened: ${facts[0]}${m.validated ? ` After review there are ${m.unique} unique work items and ${m.completed} were completed (${m.completionRate}).` : ''}`,
    `Performing well: ${good.join(' ')}`,
    attention.length ? `Needs management attention: ${attention.join('; ')}.` : 'Needs management attention: nothing open after review.',
  ];
  return { executive, facts, potential, exceptions, unverified, recommendations, implications, insights: insights(m) };
}

function implication(f) {
  if (f.status === 'resolved' || f.status === 'legitimate') return '';
  return {
    duplicate: f.status === 'disclosed' ? 'The unique work count may be overstated by one item; the published report says so.' : 'Duplicate records can overstate workload and open work until they are reconciled.',
    invoice: f.status === 'action' ? 'Billing for W-1047 is delayed until it is invoiced.' : 'If W-1047 has not been invoiced, billing may be delayed.',
    overdue: 'Overdue work may affect a service commitment to Westgate Clinic.',
    owner: 'Unassigned work may delay the response to Summit Supplies.',
  }[f.issue];
}

/** Performance insights: only when a pattern is supported by the data. This week there is none to flag. */
function insights(m) {
  const vals = m.daily.map((d) => d.completed);
  return [`No performance insight flagged: completions were steady at ${Math.min(...vals)}–${Math.max(...vals)} a day, and one week is not enough history to call a trend.`];
}

/** Departmental action register: suggested teams are recommendations, not confirmed ownership. Nothing is sent. */
export function actionRegister(s = initialState()) {
  return findings(s).map((f) => {
    const d = s.decisions[f.issue];
    const regStatus = {
      investigate: f.blocking ? 'Needs review' : 'Action required',
      stale: 'Needs review',
      resolved: 'Done',
      legitimate: 'No action needed',
      action: 'Action required',
      disclosed: 'Disclosed in report',
    }[f.status];
    const assigned = d?.owner ? ` (assigned to ${d.owner})` : '';
    return { issue: f.issue, finding: `${f.title} · ${f.ids.join(' / ')}`, team: f.team, action: `${f.action}${assigned}`, status: regStatus };
  });
}

/** The hero card: initial source counts, the daily chart, the attention count and the publication state. */
export function heroCard(s = initialState()) {
  const m = metrics(s);
  return {
    status: status(s), period: PERIOD.label,
    sourceRecords: m.sourceRecords, recordedCompleted: m.recordedCompleted, recordedOpen: m.recordedOpen,
    daily: m.daily, attention: attentionCount(s),
    byCategory: [['duplicate', 'Duplicate'], ['invoice', 'Missing invoice'], ['overdue', 'Overdue'], ['owner', 'Unassigned']].map(([i, label]) => ({ issue: i, label, open: !CLOSED.includes(statusOf(s, i)) })),
  };
}

/** What publication unlocks: the final report, its summary and the action register as approved. */
export function published(s) {
  if (!s.published) return null;
  return { metrics: metrics(s), summary: summary(s), register: actionRegister(s), disclosures: disclosures(s) };
}
