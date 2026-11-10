// Sample engine: collect → consolidate → validate → detect patterns → findings → human review → sign-off → release.
// Pure functions, no page code, so tests/demo.test.mjs can check every number the hero card, the example and the
// Data & Reporting sample show.
//
// Rules this file enforces (approved spec, 10 Nov 2026):
//   - The source rows (./data.js) are frozen and never edited. A reviewer's correction or exclusion is stored as a
//     decision, and every figure is worked out again from the rows plus the decisions (the recalculation).
//   - Automation flags. AI text only explains, from computed figures. Only the reviewer decides, signs off and releases.
//   - A payment is never treated as a sale: S-1047's amount comes from the order email (E-103), entered by the reviewer.
//   - A suspected duplicate is never removed automatically.
//   - Each decision records its basis: a fingerprint of the exact values it was made on. If those values change, the
//     decision is invalidated ("Needs another look") and stays invalid until the reviewer decides again.
//   - Tuesday stays locked until the duplicate is decided. If excluding S-1051 brings Tuesday back into range, the
//     finding is "Cleared by recalculation — awaiting reviewer verification" and only counts once the reviewer has
//     confirmed the recalculated figures.
//   - Sign-off needs every finding accepted (resolved or confirmed legitimate) and both automatic checks passing.
//     Release needs a current sign-off. There is no "publish anyway". Any decision change clears sign-off and release.
//   - Every decision, change, invalidation, sign-off and release is appended to a log that is never edited.

import { SALES, PAYMENTS, REQUESTS, SOURCES, HISTORY, RULES, ISSUES, WEEK, EVIDENCE, STAFF } from './data.js';

export const ISSUE_IDS = ['duplicate', 'missing', 'pattern', 'followUp'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const AI_LABEL = 'AI-drafted · simulated in this demo';
export const STATUS_LABELS = {
  open: 'Open',
  resolved: 'Resolved',
  legitimate: 'Confirmed legitimate',
  unresolved: 'Unresolved',
  recalculated: 'Cleared by recalculation — awaiting reviewer verification',
  stale: 'Needs another look',
};
/** Outcomes that count as human-validated for sign-off. Everything else blocks it. */
export const ACCEPTED = ['resolved', 'legitimate'];
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
export const n = (x) => x.toLocaleString('en-US');
const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`;
const signed = (x) => `${x >= 0 ? '+' : '−'}${pct(x)}`;
const DUP = ['S-1043', 'S-1051']; const MISSING = 'S-1047'; const REQ = 'R-205';
const ORDER = 'E-103';

export function initialState() {
  return Object.freeze({
    decisions: Object.freeze({ duplicate: null, missing: null, pattern: null, followUp: null }),
    log: Object.freeze([]),
    seq: 0,
    signOff: null,
    released: null,
    changedSinceRelease: false,
  });
}

/** Rows per source, and the history used for the pattern check. */
export function sourceCounts() {
  const c = { sales: SALES.length, payments: PAYMENTS.length, requests: REQUESTS.length };
  return { ...c, total: c.sales + c.payments + c.requests, sources: SOURCES.length, historyWeeks: HISTORY.weeks.length };
}

const paymentsFor = (id) => PAYMENTS.filter((p) => p.sale === id);
const paidFor = (id) => paymentsFor(id).reduce((t, p) => t + p.amount, 0);
const dayOf = (label) => label.split(' ')[0];
export const evidenceFor = (ref) => EVIDENCE.filter((e) => e.ref === ref);
const choiceOf = (s, issue) => s.decisions[issue]?.choice ?? null;

// ---- The data as it stands after review (the original rows are never changed)

/** Every sale, with the reviewer's exclusion or correction alongside the original value. */
export function workingSales(s) {
  const dup = choiceOf(s, 'duplicate'); const mis = choiceOf(s, 'missing');
  const order = EVIDENCE.find((e) => e.id === ORDER);
  return SALES.map((x) => {
    const row = { ...x, original: x.amount, excluded: false, correction: null };
    if (x.id === DUP[1] && dup === 'exclude') row.excluded = true;
    if (x.id === MISSING && mis === 'confirmFromOrder') {
      // Taken from the order email, never from payment P-307.
      row.amount = order.amount;
      row.correction = { from: x.amount, to: order.amount, evidence: order.id, by: 'reviewer' };
    }
    return row;
  });
}

/** The sales that count in the report (exclusions left out, corrections applied). */
export const countedSales = (s) => workingSales(s).filter((x) => !x.excluded);

/** The requests as they stand after the review decisions. */
export function currentRequests(s) {
  const d = s.decisions.followUp;
  return REQUESTS.map((r) => {
    if (r.id !== REQ || !d) return r;
    if (d.choice === 'assign') return { ...r, owner: d.owner, next: 'Send the quote' };
    if (d.choice === 'handled') return { ...r, status: 'Closed', next: 'Handled' };
    return r;
  });
}

export const historyAverage = (day) => HISTORY.days[day].reduce((t, x) => t + x, 0) / HISTORY.days[day].length;

/** Daily sales this week against the 4-week average for the same weekday. */
export function daily(s) {
  const sales = countedSales(s);
  return DAYS.map((day) => {
    const total = sales.filter((x) => dayOf(x.date) === day && x.amount !== null).reduce((t, x) => t + x.amount, 0);
    const avg = historyAverage(day);
    const change = (total - avg) / avg;
    return { day, total, avg, change, flagged: Math.abs(change) > RULES.patternThreshold };
  });
}

const weekEnd = () => Number(/(\d{1,2}) \w{3} \d{4}$/.exec(WEEK)[1]);
export const workingDaysOpen = (r) => weekEnd() - Number(r.received.split(' ')[1]);

/** The checks, run on the data as it stands now. Running them again after a decision is the recalculation. */
export function runChecks(s = initialState()) {
  const sales = countedSales(s);
  const seen = new Map(); const duplicates = [];
  for (const x of sales) {
    if (x.amount === null) continue;
    const key = `${x.customer.toLowerCase()}|${x.date}|${x.amount}`;
    if (seen.has(key)) duplicates.push([seen.get(key), x.id]); else seen.set(key, x.id);
  }
  // Two sales the reviewer confirmed as separate orders are not flagged again.
  const dup = choiceOf(s, 'duplicate') === 'separate' ? [] : duplicates;
  const missing = sales.filter((x) => x.amount === null).map((x) => x.id);
  const pattern = daily(s).filter((x) => x.flagged).map((x) => x.day);
  const followUp = currentRequests(s).filter((r) => r.status === 'Open' && !r.next.trim() && workingDaysOpen(r) > RULES.followUpDays).map((r) => r.id);
  return { duplicates: dup, missing, pattern, followUp };
}

/** The two automatic checks that must pass before sign-off. */
export function autoChecks() {
  const c = sourceCounts(); const loaded = SALES.length + PAYMENTS.length + REQUESTS.length;
  const unmatched = PAYMENTS.filter((p) => !SALES.some((x) => x.id === p.sale && x.customer === p.customer));
  return [
    { id: 'loaded', label: `${loaded} of ${c.total} records loaded from ${c.sources} sources`, pass: loaded === c.total },
    { id: 'payments', label: unmatched.length ? `${unmatched.length} payments not matched to a sale` : 'Every payment matched to a sale', pass: unmatched.length === 0 },
  ];
}

// ---- Decision basis (fingerprints)

/** The exact values a decision on this finding depends on, as a string. A change to any of them invalidates it. */
export function basisOf(s, issue) {
  const pick = (ids) => SALES.filter((x) => ids.includes(x.id)).map((x) => [x.id, x.date, x.customer, x.amount]);
  const pays = (ids) => PAYMENTS.filter((p) => ids.includes(p.sale)).map((p) => [p.id, p.sale, p.amount]);
  const ev = (ref) => evidenceFor(ref).map((e) => [e.id, e.amount, e.text]);
  switch (issue) {
    case 'duplicate': return JSON.stringify({ sales: pick(DUP), payments: pays(DUP), evidence: DUP.flatMap(ev) });
    case 'missing': return JSON.stringify({ sales: pick([MISSING]), payments: pays([MISSING]), evidence: ev(MISSING) });
    case 'pattern': {
      const tue = countedSales(s).filter((x) => dayOf(x.date) === 'Tue').map((x) => [x.id, x.amount]);
      return JSON.stringify({ tuesday: tue, history: HISTORY.days.Tue, threshold: RULES.patternThreshold });
    }
    case 'followUp': return JSON.stringify({ request: REQUESTS.find((r) => r.id === REQ), evidence: ev(REQ) });
    default: return '';
  }
}

// ---- Review status

const choiceOutcome = (issue, choice) => ISSUES[issue].choices.find(([v]) => v === choice)?.[2];
const tuesdayFlagged = (s) => runChecks(s).pattern.includes('Tue');
const duplicateDecided = (s) => { const d = s.decisions.duplicate; return !!d && ['exclude', 'separate'].includes(d.choice) && statusOf(s, 'duplicate') !== 'stale'; };

/** A finding's review status: open, resolved, legitimate, unresolved, recalculated or stale. */
export function statusOf(s, issue) {
  const d = s.decisions[issue];
  if (d && (d.invalidated || d.basis !== basisOf(s, issue))) return 'stale';
  if (d) return choiceOutcome(issue, d.choice);
  if (issue === 'pattern' && !tuesdayFlagged(s)) return 'recalculated';
  return 'open';
}

/** The choices open to the reviewer now, each with whether it can be used and why not. */
export function choicesFor(s, issue) {
  return ISSUES[issue].choices.map(([value, label, outcome]) => {
    const check = canDecide(s, issue, value, issue === 'followUp' && value === 'assign' ? { owner: STAFF[0] } : issue === 'followUp' && value === 'handled' ? { note: 'x' } : {});
    return { value, label, outcome, enabled: check.ok, reason: check.ok ? '' : check.reason };
  }).filter((c) => !(issue === 'pattern' && c.value === 'verifyRecalc' && tuesdayFlagged(s)) && !(issue === 'pattern' && c.value === 'genuine' && !tuesdayFlagged(s)));
}

/** Whether a decision is allowed, and the reason if not. `details`: { owner } for assign, { note } for handled. */
export function canDecide(s, issue, choice, details = {}) {
  if (!ISSUE_IDS.includes(issue)) return { ok: false, reason: 'Unknown finding.' };
  if (choice === null) return s.decisions[issue] ? { ok: true } : { ok: false, reason: 'Nothing to clear.' };
  if (!ISSUES[issue].choices.some(([c]) => c === choice)) return { ok: false, reason: 'Unknown choice.' };
  if (issue === 'pattern') {
    if (!duplicateDecided(s)) return { ok: false, reason: 'Decide the potential duplicate first: it may explain Tuesday.' };
    if (choice === 'verifyRecalc' && tuesdayFlagged(s)) return { ok: false, reason: 'Tuesday is still outside the range, so there is no recalculated figure to confirm.' };
    if (choice === 'genuine' && !tuesdayFlagged(s)) return { ok: false, reason: 'Tuesday is back in range after the recalculation: confirm the recalculated figures instead.' };
  }
  if (issue === 'followUp' && choice === 'assign' && !STAFF.includes(details.owner)) return { ok: false, reason: `Choose an owner: ${STAFF.join(' or ')}.` };
  if (issue === 'followUp' && choice === 'handled' && !String(details.note ?? '').trim()) return { ok: false, reason: 'Add a short note: who handled it, and how.' };
  return { ok: true };
}

// ---- Log, sign-off and release

const entry = (s, e) => Object.freeze({ seq: s.seq + 1, ...e });
const append = (s, e) => { const x = entry(s, e); return { log: Object.freeze([...s.log, x]), seq: x.seq }; };

/** After a change, mark any decision whose basis no longer matches as invalidated, and log why. */
function invalidate(s, cause) {
  let out = s;
  for (const issue of ISSUE_IDS) {
    const d = out.decisions[issue];
    if (!d || d.invalidated || d.basis === basisOf(out, issue)) continue;
    const decisions = Object.freeze({ ...out.decisions, [issue]: Object.freeze({ ...d, invalidated: true }) });
    out = { ...out, decisions, ...append(out, { type: 'reopened', issue, reason: `${ISSUES[issue].title}: the figures it was based on changed (${cause}).` }) };
  }
  return out;
}

/** Make, change or clear (null) a review decision. Refused (same state returned) unless canDecide allows it. */
export function decide(s, issue, choice, details = {}) {
  if (!canDecide(s, issue, choice, details).ok) return s;
  const prev = s.decisions[issue];
  const owner = issue === 'followUp' && choice === 'assign' ? details.owner : undefined;
  const note = issue === 'followUp' && choice === 'handled' ? String(details.note).trim().slice(0, 200) : undefined;
  if (prev && !prev.invalidated && prev.choice === choice && prev.owner === owner && prev.note === note) return s;
  let out = { ...s };
  const next = choice === null ? null : Object.freeze({ choice, ...(owner ? { owner } : {}), ...(note ? { note } : {}), basis: basisOf(s, issue), seq: s.seq + 1 });
  out.decisions = Object.freeze({ ...s.decisions, [issue]: next });
  out = { ...out, ...append(out, { type: choice === null ? 'cleared' : prev ? 'changed' : 'decision', issue, from: prev?.choice ?? null, to: choice, ...(owner ? { owner } : {}), ...(note ? { note } : {}) }) };
  // Re-fingerprint the decision made just now against the data it changes (its own basis is taken before the change).
  if (next) out.decisions = Object.freeze({ ...out.decisions, [issue]: Object.freeze({ ...next, basis: basisOf(out, issue) }) });
  out = invalidate(out, `${ISSUES[issue].title.toLowerCase()} ${choice === null ? 'cleared' : 'decided'}`);
  if (out.signOff) out = { ...out, signOff: null, ...append(out, { type: 'signoff-cleared', reason: 'A decision changed after sign-off.' }) };
  if (out.released) out = { ...out, released: null, changedSinceRelease: true, ...append(out, { type: 'release-revoked', reason: 'A decision changed after release.' }) };
  return Object.freeze(out);
}

/** Count of findings by review status; `left` = how many still block sign-off. */
export function review(s) {
  const st = ISSUE_IDS.map((i) => statusOf(s, i));
  const count = (k) => st.filter((x) => x === k).length;
  const out = { total: st.length };
  for (const k of Object.keys(STATUS_LABELS)) out[k] = count(k);
  out.accepted = st.filter((x) => ACCEPTED.includes(x)).length;
  out.left = out.total - out.accepted;
  return out;
}

/** Every finding accepted by the reviewer. */
export const allValidated = (s) => review(s).left === 0;

/** The values a sign-off covers: the decisions and the report totals. */
export function signOffBasis(s) {
  const r = figures(s);
  return JSON.stringify({ d: ISSUE_IDS.map((i) => [i, s.decisions[i]?.choice ?? null, s.decisions[i]?.basis ?? null]), t: [r.salesTotal, r.salesCount, r.paymentsTotal, r.owed, r.openRequests] });
}
const signedOff = (s) => !!s.signOff && s.signOff.basis === signOffBasis(s);

/** What still stands between the report and release, in words. Empty when it can be released. */
export function releaseBlockers(s) {
  const v = review(s); const out = [];
  if (v.left) out.push(`${v.left} of ${v.total} findings still ${v.left === 1 ? 'needs' : 'need'} a reviewer decision.`);
  for (const c of autoChecks()) if (!c.pass) out.push(c.label);
  if (!out.length && !signedOff(s)) out.push('Sign-off needed: confirm you have checked the findings and figures.');
  return out;
}

export const canSignOff = (s) => allValidated(s) && autoChecks().every((c) => c.pass) && !signedOff(s);
export const canRelease = (s) => signedOff(s) && !s.released;

/** The reviewer signs off the report and the AI-drafted summary. Refused unless every finding is accepted. */
export function signOff(s) {
  if (!canSignOff(s)) return s;
  const basis = signOffBasis(s);
  return Object.freeze({ ...s, signOff: Object.freeze({ seq: s.seq + 1, basis }), ...append(s, { type: 'signoff', reason: 'Findings and figures checked; report and summary approved.' }) });
}

/** Release the report. Refused without a current sign-off: there is no way to release unvalidated findings. */
export function release(s) {
  if (!canRelease(s)) return s;
  return Object.freeze({ ...s, released: Object.freeze({ seq: s.seq + 1, basis: s.signOff.basis }), changedSinceRelease: false, ...append(s, { type: 'released', reason: 'Released by the reviewer. Simulated: nothing was sent.' }) });
}

/** The report status shown on the hero card and the example. */
export function status(s) {
  if (s.released) return 'Released by you';
  if (s.changedSinceRelease) return 'Changed since release';
  if (signedOff(s)) return 'Signed off';
  const v = review(s);
  if (v.left === 0) return 'Ready for sign-off';
  if (v.open === v.total) return 'Awaiting review';
  return 'Under review';
}

/** The weekly report: every figure from the rows plus the decisions, and the report status. */
export const report = (s = initialState()) => ({ ...figures(s), status: status(s) });

/** The report's figures (no status: the sign-off fingerprint is taken from these). */
function figures(s) {
  const sales = countedSales(s); const withAmount = sales.filter((x) => x.amount !== null);
  const owedRows = withAmount.map((x) => ({ id: x.id, customer: x.customer, owed: x.amount - paidFor(x.id) })).filter((x) => x.owed > 0);
  const unknown = sales.filter((x) => x.amount === null).map((x) => ({ id: x.id, customer: x.customer, received: paidFor(x.id) }));
  const reqs = currentRequests(s); const v = review(s);
  return {
    recordedTotal: SALES.reduce((t, x) => t + (x.amount ?? 0), 0),
    salesCount: sales.length,
    salesTotal: withAmount.reduce((t, x) => t + x.amount, 0),
    missingAmounts: unknown.length,
    paymentsCount: PAYMENTS.length,
    paymentsTotal: PAYMENTS.reduce((t, p) => t + p.amount, 0),
    owed: owedRows.reduce((t, x) => t + x.owed, 0), owedRows, unknown,
    openRequests: reqs.filter((q) => q.status === 'Open').length,
    noNextAction: runChecks(s).followUp.length,
    flagged: v.total, review: v,
    final: v.left === 0,
  };
}

// ---- Findings

/** The four findings from the first run, each with its source, location, explanation, impact, AI note, steps and status. */
export function findings(s = initialState()) {
  const tue0 = daily(initialState()).find((x) => x.day === 'Tue');
  const tue = daily(s).find((x) => x.day === 'Tue');
  const sale = (id) => SALES.find((x) => x.id === id);
  const req = REQUESTS.find((r) => r.id === REQ);
  const list = [
    {
      issue: 'duplicate', ids: DUP,
      source: 'Sales log', location: 'S-1043 (email) and S-1051 (phone), Tue 3 Nov; payment P-303',
      records: { sales: DUP.map(sale), payments: DUP.flatMap(paymentsFor), evidence: DUP.flatMap(evidenceFor) },
      rule: 'Same customer, same date, same amount, different reference.',
      why: `One entry came in by email and one by phone, and there’s only one payment (${paymentsFor(DUP[0])[0].id}).`,
      impact: `If they’re the same order, sales are ${n(sale(DUP[1]).amount)} too high and Tuesday is inflated.`,
      ai: 'Possible cause: the phone call may have been about the emailed order, which could mean S-1051 repeats S-1043. This needs checking against the original records.',
      steps: ['Open the order email (E-101) and the phone note (E-102).', 'Check whether a second payment exists for S-1051.'],
      check: 'Check the original email and phone order from Greenfield Ltd on Tue 3 Nov.',
    },
    {
      issue: 'missing', ids: [MISSING],
      source: 'Sales log and Payments received', location: 'S-1047, Wed 4 Nov; payment P-307',
      records: { sales: [sale(MISSING)], payments: paymentsFor(MISSING), evidence: evidenceFor(MISSING) },
      rule: 'Every sale needs an amount. Payments are compared with the sales they belong to.',
      why: `The total leaves this sale out. Payment ${paymentsFor(MISSING)[0].id} shows ${n(paidFor(MISSING))} received, but a payment doesn’t say what the sale was for.`,
      impact: 'Sales are understated, and it isn’t known whether anything is still owed.',
      ai: `Possible cause: the amount may have been left blank at entry. ${paymentsFor(MISSING)[0].id} could be the full amount or a part payment; the order is the record to check.`,
      steps: ['Open the order email (E-103) for the agreed amount.', `Compare it with payment ${paymentsFor(MISSING)[0].id}.`],
      check: 'Check the order or invoice from Summit Supplies for the agreed amount.',
    },
    {
      issue: 'pattern', ids: ['Tue 3 Nov'],
      source: 'Daily sales totals', location: `Tue 3 Nov: ${n(tue0.total)} against a 4-week average of ${n(tue0.avg)}`,
      records: { sales: countedSales(s).filter((x) => dayOf(x.date) === 'Tue'), daily: daily(s) },
      rule: `A day more than ${pct(RULES.patternThreshold)} above or below its average for the same weekday over the previous ${HISTORY.weeks.length} weeks. A demonstration rule: the threshold is set for each business.`,
      why: `Tuesday’s sales are ${n(tue0.total)}, about ${pct(tue0.change)} above the 4-week Tuesday average of ${n(tue0.avg)}. That isn’t necessarily wrong.`,
      impact: 'The report would show a spike that may not be real.',
      ai: `Possible cause: the potential duplicate (S-1051, ${n(sale(DUP[1]).amount)}) could explain most of the difference, or a genuinely large order could.`,
      steps: ['Decide the potential duplicate first.', 'Then review Tuesday’s orders against the source records.'],
      check: 'Check Tuesday’s orders against the source records, starting with S-1051.',
      tue,
    },
    {
      issue: 'followUp', ids: [REQ],
      source: 'Customer requests', location: `R-205, ${req.customer}, received ${req.received}`,
      records: { requests: [req], evidence: evidenceFor(REQ) },
      rule: `An open request older than ${RULES.followUpDays} working days with no next action recorded. A demonstration rule.`,
      why: `${req.customer} asked for a quote on ${DAY_NAMES[dayOf(req.received)]}. ${workingDaysOpen(req)} working days later there’s no owner and no next step.`,
      impact: 'A quote request may go unanswered.',
      ai: 'Possible cause: the request may have arrived without an owner being set. It may also have been answered outside the log.',
      steps: ['Open the inbox message (E-104).', 'Decide who owns it, or record how it was already handled.'],
      check: 'Check the inbox for the quote request and decide who should own it.',
    },
  ];
  return list.map((f) => {
    const i = ISSUES[f.issue]; const st = statusOf(s, f.issue); const d = s.decisions[f.issue];
    return {
      ...f, title: i.title, kind: i.kind, hero: i.hero, prevent: i.prevent,
      choices: choicesFor(s, f.issue),
      decision: d?.choice ?? null, owner: d?.owner ?? null, note: d?.note ?? null,
      status: st, statusLabel: STATUS_LABELS[st], accepted: ACCEPTED.includes(st),
      locked: f.issue === 'pattern' && !duplicateDecided(s),
      consequence: consequence(s, f.issue, st),
    };
  });
}

function consequence(s, issue, st) {
  const tue = daily(s).find((x) => x.day === 'Tue');
  const r = report(s);
  if (st === 'stale') return 'The figures this decision was based on have changed. Please look at it again.';
  if (issue === 'pattern' && st === 'recalculated') return `Recalculated after S-1051 was excluded: Tuesday is ${n(tue.total)} (${signed(tue.change)} against the average), inside the range. Check the recalculated figures and confirm them.`;
  const d = s.decisions[issue];
  if (!d) return '';
  return {
    exclude: `S-1051 excluded (the original row is kept). Recalculated: sales ${n(r.salesTotal)}, Tuesday ${n(tue.total)}.`,
    separate: 'Kept as two separate orders. S-1051 now shows as waiting for payment.',
    notSure: 'Left open for checking. Tuesday stays locked until this is decided.',
    confirmFromOrder: 'Amount 380 entered from the order email (E-103). The original blank is kept, and the payment is still recorded separately.',
    cantConfirm: 'Left for the team to confirm. It stays out of the total and is listed as unresolved.',
    genuine: 'Confirmed as a genuine variation. No figures were changed.',
    verifyRecalc: `Recalculated figures checked and confirmed: Tuesday ${n(tue.total)} (${signed(tue.change)}).`,
    investigate: 'Kept open for further investigation. It will be listed as unresolved.',
    assign: `Assigned to ${d.owner}, with the next action “Send the quote”. A follow-up task is created when the report is released.`,
    handled: `Marked as already handled: “${d.note}”. No follow-up task is created.`,
    leave: 'Left for now. It is listed as unresolved, so the report can’t be released yet.',
  }[d.choice];
}

/** What release unlocks: the report, the dashboard and any follow-up task the reviewer authorised. */
export function outputs(s) {
  if (!s.released) return null;
  const r = report(s); const d = s.decisions.followUp;
  return {
    report: { label: 'Released report', salesTotal: r.salesTotal, recordedTotal: r.recordedTotal, salesCount: r.salesCount, paymentsTotal: r.paymentsTotal, owed: r.owed, records: sourceCounts().total },
    dashboard: { daily: daily(s), openRequests: r.openRequests, review: r.review },
    summary: aiFindings(s),
    task: d?.choice === 'assign' ? { id: REQ, owner: d.owner, text: 'Send the quote to Northside Partners' } : null,
  };
}

/** AI findings (simulated): plain-language lines built only from the engine's figures and the review status.
 *  They explain and suggest what to check; they never confirm a cause or a correction on their own. */
export function aiFindings(s = initialState()) {
  const r = report(s); const st = Object.fromEntries(ISSUE_IDS.map((i) => [i, statusOf(s, i)]));
  const tue0 = daily(initialState()).find((x) => x.day === 'Tue'); const tue = daily(s).find((x) => x.day === 'Tue');
  const dec = (i) => s.decisions[i];
  const lines = [];
  lines.push(r.final
    ? `Sales total after your review: ${n(r.salesTotal)} across ${r.salesCount} sales (recorded: ${n(r.recordedTotal)}).`
    : `Sales recorded: ${n(r.salesTotal)} across ${r.salesCount} sales. Provisional until the findings are reviewed.`);
  lines.push({
    open: 'Potential duplicate: S-1051 matches S-1043 (Greenfield Ltd, Tue 3 Nov, 860), with one payment. If it’s the same order, the total would be 860 lower.',
    resolved: 'You excluded S-1051 as a duplicate of S-1043.',
    legitimate: 'You confirmed S-1043 and S-1051 as two separate orders. S-1051 is waiting for payment.',
    unresolved: 'S-1043 and S-1051 are still being checked.',
    stale: 'The duplicate decision needs another look.',
  }[st.duplicate]);
  lines.push({
    open: 'S-1047 (Summit Supplies) has no amount. Payment P-307 shows 380 received; the order would show whether that’s the full amount.',
    resolved: 'You entered S-1047’s amount as 380 from the order email.',
    unresolved: 'S-1047: amount still to be confirmed.',
    stale: 'The S-1047 decision needs another look.',
  }[st.missing]);
  lines.push({
    open: `Potential anomaly: Tuesday’s sales (${n(tue0.total)}) are ${pct(tue0.change)} above the 4-week Tuesday average (${n(tue0.avg)}). The potential duplicate may explain part of it.`,
    recalculated: `Tuesday recalculated to ${n(tue.total)} after S-1051 was excluded. Awaiting your verification of the recalculated figures.`,
    resolved: `You checked and confirmed Tuesday’s recalculated figure: ${n(tue.total)}.`,
    legitimate: 'You confirmed Tuesday’s higher sales as genuine.',
    unresolved: 'Tuesday’s sales are kept for further investigation.',
    stale: 'The Tuesday decision needs another look: its figures changed.',
  }[st.pattern]);
  lines.push({
    open: 'Business rule: quote request R-205 (Northside Partners) has been open 4 working days with no next action.',
    resolved: dec('followUp')?.choice === 'assign' ? `You assigned R-205 to ${dec('followUp').owner} with the next action “Send the quote”.` : 'You recorded R-205 as already handled.',
    unresolved: 'R-205 is still waiting for an owner.',
    stale: 'The R-205 decision needs another look.',
  }[st.followUp]);
  return lines;
}

/** The hero card: three figures, the daily chart and the number of items to review, for any state. */
export function heroCard(s = initialState()) {
  const r = report(s); const d = daily(s); const tue = d.find((x) => x.day === 'Tue');
  return {
    status: status(s), weekRange: weekRange(WEEK),
    toReview: r.review.left,
    salesTotal: n(r.salesTotal), salesNote: r.final ? 'checked' : 'provisional',
    paymentsTotal: n(r.paymentsTotal), openRequests: r.openRequests,
    daily: d.map((x) => ({ day: x.day, total: x.total, avg: x.avg, change: x.change, flagged: x.flagged })),
    tuesday: { total: n(tue.total), change: signed(tue.change), flagged: tue.flagged },
  };
}

/** The hero card's figures before any review (the static HTML holds the same values). */
export function heroSummary() {
  const c = sourceCounts(); const h = heroCard();
  return {
    sourceRecords: c.total, sources: c.sources, historyWeeks: c.historyWeeks,
    status: h.status, weekRange: h.weekRange, toReview: h.toReview, salesTotal: h.salesTotal, salesNote: h.salesNote,
    paymentsTotal: h.paymentsTotal, openRequests: h.openRequests, tuesday: h.tuesday.total, tuesdayChange: h.tuesday.change,
  };
}

/** 'Week ending Fri 6 Nov 2026' → '2–6 November 2026'. */
export function weekRange(label) {
  const m = /(\d{1,2}) (\w{3}) (\d{4})$/.exec(label);
  if (!m) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const end = new Date(Date.UTC(Number(m[3]), months.findIndex((x) => x.startsWith(m[2])), Number(m[1])));
  const mon = new Date(end); mon.setUTCDate(end.getUTCDate() - 4);
  const name = (d) => months[d.getUTCMonth()];
  return mon.getUTCMonth() === end.getUTCMonth()
    ? `${mon.getUTCDate()}–${end.getUTCDate()} ${name(end)} ${end.getUTCFullYear()}`
    : `${mon.getUTCDate()} ${name(mon)} – ${end.getUTCDate()} ${name(end)} ${end.getUTCFullYear()}`;
}
