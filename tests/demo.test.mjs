// Run with: node --test tests/demo.test.mjs
// Every number the live demo shows comes from src/demo/engine.js working on src/demo/data.js. These tests pin the
// story in the 7 Nov simulation spec: 11/3/0 by hand, 10/4/1 checked (the duplicate counts once), 10/4/0 after the decisions,
// 11/3/0 once the customer confirms, 12/3/0 after the visitor's test booking.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RECORDS, COSTS, CAUSES } from '../src/demo/data.js';
import { initialState, report, status, check, confirmMerge, keepBoth, raiseInvoice, markNotBillable, askAddress, receiveReply, fixForm, sendTest, allSorted, decided, freeSlots, runCheck, CHECKS } from '../src/demo/engine.js';

const nums = (r) => [r.booked, r.waiting, r.notInvoiced];

test('18 records: 17 in the job list, 1 website request in the inbox', () => {
  assert.equal(RECORDS.length, 18);
  assert.equal(RECORDS.filter((r) => r.inList).length, 17);
  assert.deepEqual(RECORDS.filter((r) => !r.inList).map((r) => r.ref), ['R-118']);
});

test('the hand-built report says 11 booked, 3 waiting, 0 not invoiced', () => {
  const r = report(initialState());
  assert.deepEqual(nums(r), [11, 3, 0]);
  assert.equal(r.tag, 'Built by hand');
});

test('the four checks find exactly the three planted problems', () => {
  const s = initialState();
  assert.deepEqual(runCheck(s, 'combine'), ['R-118']);
  assert.deepEqual(runCheck(s, 'duplicates'), ['J-2049', 'J-2051']);
  assert.deepEqual(runCheck(s, 'invoices'), ['J-2041']);
  assert.deepEqual(runCheck(s, 'bookable'), ['R-118']);
  const { state, checkedCount, flaggedCount } = check(s);
  assert.deepEqual(state.problems.map((p) => p.id), ['duplicate', 'invoice', 'address']);
  assert.equal(checkedCount, 18);
  assert.equal(flaggedCount, 4);
  const r = report(state);
  assert.deepEqual(nums(r), [10, 4, 1], 'checked: the visit booked twice counts once');
  assert.equal(r.likelyDuplicates, 1);
  assert.equal(r.tag, 'Checked');
});

test('each action moves the report exactly as the brief says (default choices)', () => {
  let s = check(initialState()).state;
  s = confirmMerge(s); assert.deepEqual(nums(report(s)), [10, 4, 1], 'merging does not reduce Booked a second time'); assert.equal(report(s).likelyDuplicates, 0); assert.equal(report(s).tag, 'Checked', 'one decision carried out is not yet "Actions applied"');
  s = raiseInvoice(s); assert.deepEqual(nums(report(s)), [10, 4, 0]);
  s = askAddress(s); assert.deepEqual(nums(report(s)), [10, 4, 0], 'sending the email books nothing');
  assert.ok(decided(s)); assert.ok(!allSorted(s), 'still waiting on the customer');
  assert.equal(fixForm(s).formFixed, false, 'the form test waits for the confirmation');
  s = receiveReply(s); assert.deepEqual(nums(report(s)), [11, 3, 0], 'customer confirmed');
  assert.equal(receiveReply(s), s, 'confirming twice changes nothing');
  assert.ok(allSorted(s));
  s = fixForm(s); assert.ok(s.formFixed);
  const { state, passed } = sendTest(s, { when: 'Thu 12 Nov 15:00' });
  assert.ok(passed, 'the test request passes all four checks');
  assert.deepEqual(nums(report(state)), [12, 3, 0]);
  assert.equal(sendTest(state).passed, false, 'a second send does nothing');
});

test('a customer cannot confirm before anyone asked', () => {
  const s = check(initialState()).state;
  assert.equal(receiveReply(s), s);
});

test('the fixed form needs every field and only offers free times', () => {
  let s = check(initialState()).state;
  s = fixForm(receiveReply(askAddress(raiseInvoice(confirmMerge(s)))));
  assert.deepEqual(freeSlots(s), ['Thu 12 Nov 11:00', 'Thu 12 Nov 15:00'], '9am (Santos) and 1pm (Perez) are taken');
  assert.deepEqual(sendTest(s, { address: ' ' }).errors, ['address']);
  assert.deepEqual(sendTest(s, { job: '' }).errors, ['job']);
  assert.deepEqual(sendTest(s, { email: '' }).errors, ['email'], 'email is required too');
  assert.deepEqual(sendTest(s, { when: 'Thu 12 Nov 09:00' }).errors, ['when'], 'a taken slot is refused');
  assert.equal(sendTest(s, { when: 'Thu 12 Nov 11:00' }).passed, true);
});

test('actions in any order land on the same report', () => {
  let s = check(initialState()).state;
  assert.equal(fixForm(s).formFixed, false);
  s = receiveReply(askAddress(s)); s = raiseInvoice(s);
  assert.equal(fixForm(s).formFixed, false);
  s = confirmMerge(s);
  assert.deepEqual(nums(report(s)), [11, 3, 0]);
  assert.equal(fixForm(s).formFixed, true);
});

test('the other choices: keep both visits, not billable, Dana calls', () => {
  let s = check(initialState()).state;
  s = keepBoth(s);
  assert.deepEqual(nums(report(s)), [11, 4, 1], 'two real visits: Booked goes back to 11');
  assert.equal(report(s).likelyDuplicates, 0);
  assert.deepEqual(runCheck(s, 'duplicates'), [], 'two confirmed visits are not flagged again');
  s = markNotBillable(s);
  assert.deepEqual(nums(report(s)), [11, 4, 0], 'warranty work no longer counts as not invoiced');
  assert.deepEqual(runCheck(s, 'invoices'), []);
  s = askAddress(s, 'call');
  assert.equal(s.records.find((r) => r.ref === 'R-118').askedVia, 'call');
  assert.deepEqual(nums(report(s)), [11, 4, 0], 'the call alone books nothing');
  s = receiveReply(s);
  assert.deepEqual(nums(report(s)), [12, 3, 0]);
  const { state, passed } = sendTest(fixForm(s), { when: 'Thu 12 Nov 15:00' });
  assert.ok(passed);
  assert.deepEqual(nums(report(state)), [13, 3, 0], 'final Booked is 13 when both visits were kept');
});

test('reset restores the original sample data', () => {
  let s = check(initialState()).state;
  s = fixForm(receiveReply(askAddress(raiseInvoice(confirmMerge(s)))));
  sendTest(s);
  const fresh = initialState();
  assert.deepEqual(nums(report(fresh)), [11, 3, 0]);
  assert.equal(fresh.records.length, 18);
  assert.ok(fresh.records.every((r) => !r.merged && !r.confirmedSeparate));
});
test('every problem has a cost and a cause', () => {
  const s = check(initialState()).state;
  for (const p of s.problems) assert.ok(COSTS[p.id], p.id);
  assert.equal(CAUSES.length, s.problems.length);
});

test('the 3 still waiting at the end each have a reason', () => {
  let s = check(initialState()).state;
  s = receiveReply(askAddress(raiseInvoice(confirmMerge(s))));
  const waiting = s.records.filter((r) => r.status === 'waiting');
  assert.equal(waiting.length, 3);
  assert.ok(waiting.every((r) => r.reason));
});

test('the homepage shows the calculated numbers', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const teaser = html.slice(html.indexOf('class="tz-card"'), html.indexOf('</figure>'));
  const r = report(initialState());
  for (const [label, n] of [['Booking entries', r.booked], ['Waiting on someone', r.waiting], ['Done, not invoiced', r.notInvoiced]]) {
    assert.match(teaser, new RegExp(`${label}[^<]*</span><b>${n}</b>`), label);
  }
  assert.equal(CHECKS.length, 4);
});

// ---- Final refinement (7 Nov): status progression, simulated customer reply, every decision combination, privacy notice

const MERGE = { merge: confirmMerge, keep: keepBoth };
const INVOICE = { send: raiseInvoice, nobill: markNotBillable };

/** Runs the whole simulation for one combination of decisions, recording the report and status after each stage. */
function play(dup, inv, via, withForm = true) {
  const steps = [];
  const snap = (label, s) => steps.push({ label, nums: nums(report(s)), tag: report(s).tag });
  let s = initialState(); snap('start', s);
  s = check(s).state; snap('checked', s);
  s = askAddress(INVOICE[inv](MERGE[dup](s)), via); snap('applied', s);
  s = fixForm(receiveReply(s)); snap('confirmed', s);
  if (withForm) { const res = sendTest(s, { when: 'Thu 12 Nov 15:00' }); assert.ok(res.passed); s = res.state; snap('test booking', s); }
  return { s, steps };
}

test('report status: Built by hand → Checked → Actions applied → Updated', () => {
  const { steps } = play('merge', 'send', 'email');
  assert.deepEqual(steps.map((x) => x.tag), ['Built by hand', 'Checked', 'Actions applied', 'Updated', 'Updated']);
  let s = check(initialState()).state;
  s = raiseInvoice(confirmMerge(s));
  assert.equal(status(s), 'Checked', 'two of three decisions carried out: still Checked');
  s = askAddress(s);
  assert.equal(status(s), 'Actions applied', 'all decisions carried out, customer still to reply');
  s = receiveReply(s);
  assert.equal(status(s), 'Updated');
});

test('the simulated customer reply adds the address, books the visit and clears Waiting by one', () => {
  let s = askAddress(raiseInvoice(confirmMerge(check(initialState()).state)), 'call');
  const before = report(s);
  assert.equal(s.records.find((r) => r.ref === 'R-118').status, 'asked', 'stays waiting until the reply');
  s = receiveReply(s);
  const r = s.records.find((x) => x.ref === 'R-118');
  assert.equal(r.address, '45 Pine St');
  assert.equal(r.status, 'booked');
  assert.equal(report(s).booked, before.booked + 1);
  assert.equal(report(s).waiting, before.waiting - 1);
  assert.equal(report(s).notInvoiced, before.notInvoiced);
});

test('all eight decision combinations give the expected report at every stage', () => {
  for (const dup of ['merge', 'keep']) for (const inv of ['send', 'nobill']) for (const via of ['email', 'call']) {
    const { steps } = play(dup, inv, via);
    const k = dup === 'keep' ? 1 : 0;
    assert.deepEqual(steps.map((x) => x.nums), [[11, 3, 0], [10, 4, 1], [10 + k, 4, 0], [11 + k, 3, 0], [12 + k, 3, 0]], `${dup}/${inv}/${via}`);
  }
});

test('both final outcomes, with and without the optional test booking', () => {
  assert.deepEqual(nums(report(play('merge', 'send', 'email').s)), [12, 3, 0]);
  assert.deepEqual(nums(report(play('keep', 'send', 'email').s)), [13, 3, 0]);
  assert.deepEqual(nums(report(play('merge', 'nobill', 'call', false).s)), [11, 3, 0]);
  assert.deepEqual(nums(report(play('keep', 'nobill', 'call', false).s)), [12, 3, 0]);
});

test('reset after a full run starts from the hand-built report again', () => {
  const { s } = play('keep', 'nobill', 'call');
  assert.equal(s.records.length, 19, 'the test booking was added');
  const fresh = initialState();
  assert.deepEqual(nums(report(fresh)), [11, 3, 0]);
  assert.equal(report(fresh).tag, 'Built by hand');
  assert.equal(fresh.records.length, 18);
  assert.ok(fresh.records.every((r) => !r.merged && !r.confirmedSeparate && !r.notBillable && r.status !== 'asked'));
  assert.equal(fresh.formFixed, false);
  assert.equal(fresh.testSent, false);
});

test('the privacy notice describes the current Quillfern simulation', async () => {
  const html = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('The examples on the homepage'), html.indexOf('When you contact me'));
  assert.match(sec, /Quillfern Home Repairs is a fictional business/);
  assert.match(sec, /page&rsquo;s memory only/);
  assert.match(sec, /does not send your entries to my real booking service/);
  assert.match(sec, /does not create real calendar bookings, send real invoices, emails or phone calls/);
  assert.doesNotMatch(html, /Recurring bills across sites|three messy exports/, 'the retired examples are gone');
});
