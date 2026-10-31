// Run with: node --test tests/demo.test.mjs
// Every number the live demo shows comes from src/demo/engine.js working on src/demo/data.js. These tests pin the
// story in the spec (Rework Rescue live demo spec): 11/3/0 by hand, 11/4/1 checked, then 10, 0, 11/3, 12.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RECORDS } from '../src/demo/data.js';
import { initialState, report, check, confirmMerge, raiseInvoice, askAddress, receiveReply, fixForm, sendTest, allSorted, runCheck, CHECKS } from '../src/demo/engine.js';

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
  assert.deepEqual(nums(r), [11, 4, 1]);
  assert.equal(r.likelyDuplicates, 1);
  assert.equal(r.tag, 'Checked');
});

test('each action moves the report exactly as the spec says', () => {
  let s = check(initialState()).state;
  s = confirmMerge(s); assert.deepEqual(nums(report(s)), [10, 4, 1]); assert.equal(report(s).likelyDuplicates, 0); assert.equal(report(s).tag, 'Updated');
  s = raiseInvoice(s); assert.deepEqual(nums(report(s)), [10, 4, 0]);
  s = askAddress(s); assert.deepEqual(nums(report(s)), [10, 4, 0], 'asking alone books nothing');
  s = receiveReply(s); assert.deepEqual(nums(report(s)), [11, 3, 0]);
  assert.ok(allSorted(s));
  s = fixForm(s); assert.ok(s.formFixed);
  const { state, passed } = sendTest(s);
  assert.ok(passed, 'the test request passes all four checks');
  assert.deepEqual(nums(report(state)), [12, 3, 0]);
});

test('actions in any order land on the same report; the form waits until all three are sorted', () => {
  let s = check(initialState()).state;
  assert.equal(fixForm(s).formFixed, false);
  s = receiveReply(askAddress(s)); s = raiseInvoice(s);
  assert.equal(fixForm(s).formFixed, false);
  s = confirmMerge(s);
  assert.deepEqual(nums(report(s)), [11, 3, 0]);
  assert.equal(fixForm(s).formFixed, true);
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
  for (const [label, n] of [['Booked', r.booked], ['Waiting on someone', r.waiting], ['Done, not invoiced', r.notInvoiced]]) {
    assert.match(teaser, new RegExp(`${label}[^<]*</span><b>${n}</b>`), label);
  }
  assert.equal(CHECKS.length, 4);
});
