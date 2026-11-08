// Live demo engine: the checks across the three sources, the visitor's decisions and the weekly report.
// Pure functions, no page code, so tests/demo.test.mjs can check every number the page (and the hero card) shows.
// The source rows never change. A decision is stored as data and the report is worked out again from the rows plus
// the decisions, so any decision can be changed or cleared without undoing anything. Reset = initialState().

import { TRACKER, COMPLETION, FINANCE, SOURCES, TEAM, PENDING_REASONS, ISSUES } from './data.js';

const ISSUE_IDS = ['duplicate', 'finance', 'owner'];

export function initialState() {
  return { checked: false, decisions: { duplicate: null, finance: null, owner: null }, finalized: false };
}

const isOpen = (r) => r.status !== 'Complete';
const byId = (rows) => new Map(rows.map((r) => [r.id, r]));

/** Rows per source, and the total the hero shows as "source records". */
export function sourceCounts() {
  const counts = { tracker: TRACKER.length, completion: COMPLETION.length, finance: FINANCE.length };
  return { ...counts, total: counts.tracker + counts.completion + counts.finance, sources: SOURCES.length };
}

/** The three checks on the source rows. They read the data only, so they always find the same things. */
export function runChecks() {
  // 1. Possible duplicates: open items with the same work description and due date.
  const seen = new Map(); const duplicates = [];
  for (const r of TRACKER.filter(isOpen)) {
    const key = `${r.work.toLowerCase()}|${r.due}`;
    if (seen.has(key)) duplicates.push([seen.get(key), r.id]); else seen.set(key, r.id);
  }
  // 2. Completed work against finance: matched, expected without an invoice (internal), or missing.
  const log = byId(COMPLETION); const fin = byId(FINANCE);
  const finance = TRACKER.filter((r) => r.status === 'Complete').map((r) => {
    const done = log.get(r.id);
    const result = fin.has(r.id) ? 'matched' : done && !done.billable ? 'notBillable' : 'missing';
    return { id: r.id, result };
  });
  // 3. Open items with nobody responsible.
  const noOwner = TRACKER.filter((r) => isOpen(r) && !r.owner.trim()).map((r) => r.id);
  return { duplicates, finance, missingFinance: finance.filter((f) => f.result === 'missing').map((f) => f.id), noOwner };
}

/** The issues the visitor sorts out: one per finding, each with the records involved. Empty until checked. */
export function findings(s) {
  if (!s.checked) return [];
  const c = runChecks(); const t = byId(TRACKER); const log = byId(COMPLETION);
  const out = [];
  for (const pair of c.duplicates) out.push({ issue: 'duplicate', ids: pair, records: { tracker: pair.map((id) => t.get(id)) } });
  for (const id of c.missingFinance) out.push({ issue: 'finance', ids: [id], records: { tracker: [t.get(id)], completion: [log.get(id)], finance: [] } });
  for (const id of c.noOwner) out.push({ issue: 'owner', ids: [id], records: { tracker: [t.get(id)] } });
  return out.map((f) => ({ ...f, ...ISSUES[f.issue], decision: s.decisions[f.issue] }));
}

/** Run the checks (Stage 1 → 2). Decisions start empty. */
export function check(s) {
  return s.checked ? s : { ...s, checked: true };
}

/** Make or change a decision. Returns the state unchanged for anything invalid, or once decisions are finished.
 *  owner: 'assign' needs a TEAM member as detail; 'pending' needs one of PENDING_REASONS. */
export function decide(s, issue, choice, detail) {
  if (!s.checked || s.finalized || !ISSUE_IDS.includes(issue)) return s;
  if (!ISSUES[issue].choices.some(([c]) => c === choice)) return s;
  let d = { choice };
  if (issue === 'owner') {
    if (choice === 'assign' && !TEAM.includes(detail)) return s;
    if (choice === 'pending' && !PENDING_REASONS.includes(detail)) return s;
    d = choice === 'assign' ? { choice, member: detail } : { choice, reason: detail };
  }
  return { ...s, decisions: { ...s.decisions, [issue]: d } };
}

/** Clear one decision (back to undecided). */
export function clearDecision(s, issue) {
  if (s.finalized || !ISSUE_IDS.includes(issue)) return s;
  return { ...s, decisions: { ...s.decisions, [issue]: null } };
}

export const allDecided = (s) => s.checked && ISSUE_IDS.every((i) => s.decisions[i]);

/** "Finish decisions": only once all three are decided; locks them (status unchanged). reopen() unlocks. */
export function finalize(s) { return allDecided(s) ? { ...s, finalized: true } : s; }
export function reopen(s) { return { ...s, finalized: false }; }

/** Business actions still open after the review: an invoice follow-up, or an item left pending without an owner.
 *  Deciding is not doing, so these stay visible until the real work happens (outside the demo). */
export function outstanding(s) {
  if (!s.checked) return [];
  const c = runChecks(); const d = s.decisions; const out = [];
  if (d.finance?.choice === 'followUp') for (const id of c.missingFinance) out.push({ issue: 'finance', id, action: 'Invoice follow-up' });
  if (d.owner?.choice === 'pending') for (const id of c.noOwner) out.push({ issue: 'owner', id, action: 'No owner yet', reason: d.owner.reason });
  return out;
}

/** Report status: Built by hand → Review required → Review complete, or Follow-up pending when a decision left a
 *  business action open. Finishing (finalize) only locks the decisions; it never makes pending work look done. */
export function status(s) {
  if (!s.checked) return 'Built by hand';
  if (!allDecided(s)) return 'Review required';
  return outstanding(s).length ? 'Follow-up pending' : 'Review complete';
}

/** The weekly report, as the page shows it.
 *  Before the check it is the hand-built report: every tracker row counted, every completed item assumed invoiced,
 *  owners not checked (noOwner = null). After the check every figure comes from the three sources plus decisions. */
export function report(s) {
  const c = runChecks();
  const completed = TRACKER.filter((r) => r.status === 'Complete').length;
  if (!s.checked) {
    return { openWork: TRACKER.filter(isOpen).length, completed, notInvoiced: 0, noOwner: null, itemsToReview: 0,
      possibleDuplicates: 0, followUps: 0, pendingWithReason: 0, outstanding: 0, status: status(s) };
  }
  const d = s.decisions;
  const merged = d.duplicate?.choice === 'merge' ? new Set(c.duplicates.map((p) => p[1])) : new Set();
  const openWork = TRACKER.filter((r) => isOpen(r) && !merged.has(r.id)).length;
  const notInvoiced = d.finance?.choice === 'noInvoiceDue' ? 0 : c.missingFinance.length;
  const noOwner = d.owner?.choice === 'assign' ? 0 : c.noOwner.length;
  const itemsToReview = findings(s).filter((f) => !f.decision).length;
  return {
    openWork, completed, notInvoiced, noOwner, itemsToReview,
    possibleDuplicates: d.duplicate ? 0 : c.duplicates.length,
    followUps: d.finance?.choice === 'followUp' ? c.missingFinance.length : 0,
    pendingWithReason: d.owner?.choice === 'pending' ? c.noOwner.length : 0,
    outstanding: outstanding(s).length,
    status: status(s),
  };
}

/** The hero card: a pre-calculated preview of the sample report after the checks, before any decision.
 *  Summary figures only; the findings themselves are never part of it. */
export function heroSummary() {
  const counts = sourceCounts();
  const r = report(check(initialState()));
  return { sourceRecords: counts.total, sourcesChecked: counts.sources, itemsToReview: r.itemsToReview, status: r.status };
}
