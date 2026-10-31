// Live demo engine: the four checks, the visitor's actions and the weekly report. Pure functions, no page code,
// so tests/demo.test.mjs can check every number the page shows. Actions return a new state; nothing is mutated.

import { RECORDS, NEW_INVOICE, R118_REPLY, TEST_REQUEST } from './data.js';

export const CHECKS = [
  { id: 'combine', label: 'Bringing website, phone and email requests into one list' },
  { id: 'duplicates', label: 'Looking for the same visit booked twice' },
  { id: 'invoices', label: 'Matching done jobs to invoices' },
  { id: 'bookable', label: 'Checking every request can be booked' },
];

export function initialState() {
  return { records: RECORDS.map((r) => ({ ...r })), checked: false, problems: [], formFixed: false, testSent: false };
}

const active = (s) => s.records.filter((r) => !r.merged);

/** The three numbers the owner wants, as the report shows them. */
export function report(s) {
  const recs = s.checked ? active(s) : s.records.filter((r) => r.inList);
  const booked = recs.filter((r) => r.status === 'booked').length;
  const waiting = recs.filter((r) => r.status === 'waiting' || r.status === 'request' || r.status === 'asked').length;
  const notInvoiced = recs.filter((r) => r.status === 'done' && (s.checked ? !r.invoice : !r.markedInvoiced)).length;
  const dup = s.problems.find((p) => p.id === 'duplicate' && !p.done);
  return { booked, waiting, notInvoiced, likelyDuplicates: dup ? 1 : 0, tag: !s.checked ? 'Built by hand' : (s.problems.some((p) => p.done) || s.formFixed ? 'Updated' : 'Checked') };
}

/** Runs one check on the current records. Returns the records it flags (refs). */
export function runCheck(s, id) {
  const recs = active(s);
  if (id === 'combine') return recs.filter((r) => !r.inList).map((r) => r.ref);
  if (id === 'duplicates') {
    const seen = new Map(); const out = [];
    for (const r of recs.filter((x) => x.status === 'booked')) {
      const key = `${r.customer}|${r.address}|${r.when}`;
      if (seen.has(key)) out.push(seen.get(key), r.ref); else seen.set(key, r.ref);
    }
    return out;
  }
  if (id === 'invoices') return recs.filter((r) => r.status === 'done' && !r.invoice).map((r) => r.ref);
  if (id === 'bookable') return recs.filter((r) => (r.status === 'request' || r.status === 'booked') && (!r.address || !r.job)).map((r) => r.ref);
  return [];
}

/** All four checks, turned into the three problems the visitor sorts out. */
export function check(s) {
  const found = Object.fromEntries(CHECKS.map((c) => [c.id, runCheck(s, c.id)]));
  const problems = [];
  if (found.duplicates.length) problems.push({ id: 'duplicate', refs: found.duplicates, done: false });
  for (const ref of found.invoices) problems.push({ id: 'invoice', refs: [ref], done: false });
  const notBookable = new Set([...found.combine, ...found.bookable]);
  for (const ref of notBookable) problems.push({ id: 'address', refs: [ref], done: false });
  const flagged = new Set(problems.flatMap((p) => p.refs));
  return { state: { ...s, checked: true, problems }, found, checkedCount: s.records.length, flaggedCount: flagged.size };
}

const done = (s, id) => ({ ...s, problems: s.problems.map((p) => (p.id === id ? { ...p, done: true } : p)) });
const setRecord = (s, ref, patch) => ({ ...s, records: s.records.map((r) => (r.ref === ref ? { ...r, ...patch } : r)) });

/** Confirm merge: the later website booking is folded into the phone booking; one visit stays. */
export function confirmMerge(s) {
  const p = s.problems.find((x) => x.id === 'duplicate');
  if (!p || p.done) return s;
  return done(setRecord(s, p.refs.at(-1), { merged: true }), 'duplicate');
}

export function raiseInvoice(s) {
  const p = s.problems.find((x) => x.id === 'invoice');
  if (!p || p.done) return s;
  return done(setRecord(s, p.refs.at(0), { invoice: NEW_INVOICE }), 'invoice');
}

/** Ask for the address: the (simulated) email goes out and the request waits on the customer. */
export function askAddress(s) {
  const p = s.problems.find((x) => x.id === 'address');
  if (!p || p.done) return s;
  return setRecord(s, p.refs.at(0), { status: 'asked' });
}

/** The (simulated) reply arrives: the request gets its address and is booked as a job. */
export function receiveReply(s) {
  const p = s.problems.find((x) => x.id === 'address');
  if (!p || p.done) return s;
  const s2 = setRecord(s, p.refs.at(0), { status: 'booked', address: R118_REPLY.address, when: R118_REPLY.when, jobRef: R118_REPLY.ref, inList: true });
  return done(s2, 'address');
}

export const allSorted = (s) => s.checked && s.problems.every((p) => p.done);

export function fixForm(s) { return allSorted(s) ? { ...s, formFixed: true } : s; }

/** The visitor's test request through the fixed form. Returns the state and whether it passed every check. */
export function sendTest(s) {
  if (!s.formFixed || s.testSent) return { state: s, passed: false };
  const rec = { ref: TEST_REQUEST.ref, source: TEST_REQUEST.source, customer: TEST_REQUEST.customer, job: TEST_REQUEST.job, address: TEST_REQUEST.address, status: 'booked', when: TEST_REQUEST.when, inList: true };
  const next = { ...s, testSent: true, records: [...s.records, rec] };
  const passed = CHECKS.every((c) => !runCheck(next, c.id).includes(rec.ref));
  return { state: next, passed };
}
