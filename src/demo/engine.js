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
const visitKey = (r) => `${r.customer}|${r.address}|${r.when}`;

/** The three numbers the owner wants, as the report shows them. */
export function report(s) {
  const recs = s.checked ? active(s) : s.records.filter((r) => r.inList);
  // Booked = unique confirmed visits. By hand, every booking entry was counted; once checked, two entries for the
  // same customer, address and time count as one visit unless the owner confirmed they are separate visits.
  const bookedRecs = recs.filter((r) => r.status === 'booked');
  const booked = s.checked
    ? new Set(bookedRecs.map((r) => (r.confirmedSeparate ? r.ref : visitKey(r)))).size
    : bookedRecs.length;
  const waiting = recs.filter((r) => r.status === 'waiting' || r.status === 'request' || r.status === 'asked').length;
  const notInvoiced = recs.filter((r) => r.status === 'done' && (s.checked ? !r.invoice && !r.notBillable : !r.markedInvoiced)).length;
  const dup = s.problems.find((p) => p.id === 'duplicate' && !p.done);
  return { booked, waiting, notInvoiced, likelyDuplicates: dup ? 1 : 0, tag: !s.checked ? 'Built by hand' : (s.problems.some((p) => p.done) || s.formFixed ? 'Updated' : 'Checked') };
}

/** Runs one check on the current records. Returns the records it flags (refs). */
export function runCheck(s, id) {
  const recs = active(s);
  if (id === 'combine') return recs.filter((r) => !r.inList).map((r) => r.ref);
  if (id === 'duplicates') {
    const seen = new Map(); const out = [];
    for (const r of recs.filter((x) => x.status === 'booked' && !x.confirmedSeparate)) {
      const key = visitKey(r);
      if (seen.has(key)) out.push(seen.get(key), r.ref); else seen.set(key, r.ref);
    }
    return out;
  }
  if (id === 'invoices') return recs.filter((r) => r.status === 'done' && !r.invoice && !r.notBillable).map((r) => r.ref);
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

/** Keep both: the owner says they really are two visits. Both stay booked and won't be flagged again. */
export function keepBoth(s) {
  const p = s.problems.find((x) => x.id === 'duplicate');
  if (!p || p.done) return s;
  let next = s;
  for (const ref of p.refs) next = setRecord(next, ref, { confirmedSeparate: true });
  return done(next, 'duplicate');
}

/** Not billable (warranty work): the job stops counting as "done, not invoiced" without an invoice. */
export function markNotBillable(s) {
  const p = s.problems.find((x) => x.id === 'invoice');
  if (!p || p.done) return s;
  return done(setRecord(s, p.refs.at(0), { notBillable: true }), 'invoice');
}

/** Send the drafted invoice. */
export function raiseInvoice(s) {
  const p = s.problems.find((x) => x.id === 'invoice');
  if (!p || p.done) return s;
  return done(setRecord(s, p.refs.at(0), { invoice: NEW_INVOICE }), 'invoice');
}

/** Ask for the address, by the drafted email or by a call from the office (Dana). Both are simulated. */
export function askAddress(s, via = 'email') {
  const p = s.problems.find((x) => x.id === 'address');
  if (!p || p.done) return s;
  return setRecord(s, p.refs.at(0), { status: 'asked', askedVia: via });
}

/** The customer confirms (simulated, by its own button): the request gets its address and becomes a booked job. */
export function receiveReply(s) {
  const p = s.problems.find((x) => x.id === 'address');
  if (!p || p.done) return s;
  const r = s.records.find((x) => x.ref === p.refs.at(0));
  if (!r || r.status !== 'asked') return s; // nobody asked yet, so nobody can confirm
  const s2 = setRecord(s, r.ref, { status: 'booked', address: R118_REPLY.address, when: R118_REPLY.when, jobRef: R118_REPLY.ref, inList: true });
  return done(s2, 'address');
}

/** The owner's decisions on the review sheet are carried out; the customer still has to confirm. */
export const decided = (s) => s.checked && s.problems.every((p) => p.done || s.records.find((r) => r.ref === p.refs.at(0))?.status === 'asked');
export const allSorted = (s) => s.checked && s.problems.every((p) => p.done);

export function fixForm(s) { return allSorted(s) ? { ...s, formFixed: true } : s; }

// The fixed form's preferred-time list: slots on the test day, minus anything already booked.
export const SLOT_TIMES = ['09:00', '11:00', '13:00', '15:00'];
export function freeSlots(s, day = TEST_REQUEST.when.slice(0, -6)) {
  const taken = new Set(active(s).filter((r) => r.status === 'booked' && (r.when || '').startsWith(day)).map((r) => r.when.slice(-5)));
  return SLOT_TIMES.filter((t) => !taken.has(t)).map((t) => `${day} ${t}`);
}

/** The visitor's test request through the fixed form. Every field is required and the time must be free.
 *  Returns the state, whether it passed every check, and the problems found (empty when it passed). */
export function sendTest(s, input = {}) {
  if (!s.formFixed || s.testSent) return { state: s, passed: false, errors: ['not-ready'] };
  const req = { name: 'Test request', job: TEST_REQUEST.job, address: TEST_REQUEST.address, when: TEST_REQUEST.when, ...input };
  const errors = [];
  if (!String(req.name || '').trim()) errors.push('name');
  if (!String(req.address || '').trim()) errors.push('address');
  if (!String(req.job || '').trim()) errors.push('job');
  if (!freeSlots(s).includes(req.when)) errors.push('when');
  if (errors.length) return { state: s, passed: false, errors };
  const rec = { ref: TEST_REQUEST.ref, source: TEST_REQUEST.source, customer: req.name.trim(), job: req.job.trim(), address: req.address.trim(), status: 'booked', when: req.when, inList: true };
  const next = { ...s, testSent: true, records: [...s.records, rec] };
  const passed = CHECKS.every((c) => !runCheck(next, c.id).includes(rec.ref));
  return { state: passed ? next : s, passed, errors: passed ? [] : ['check'] };
}
