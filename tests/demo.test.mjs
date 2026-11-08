// Live demo tests (three-source sample, Nov 2026).
// Every number the demo and the hero card show comes from src/demo/engine.js working on src/demo/data.js.
// These tests pin the source counts, the three planted issues, every decision and combination, reversibility and reset.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as DATA from '../src/demo/data.js';
import { TRACKER, COMPLETION, FINANCE, SOURCES, TEAM, PENDING_REASONS, ISSUES, CONSEQUENCE, PREVENTION } from '../src/demo/data.js';
import {
  initialState, sourceCounts, runChecks, findings, check, decide, clearDecision, allDecided, finalize, reopen, status,
  report, heroSummary,
} from '../src/demo/engine.js';

const nums = (r) => [r.openWork, r.completed, r.notInvoiced, r.noOwner, r.itemsToReview];

// ---- The sample data itself

test('source counts: tracker 18, completion log 7, finance register 5, 30 records from 3 sources', () => {
  assert.deepEqual(sourceCounts(), { tracker: 18, completion: 7, finance: 5, total: 30, sources: 3 });
  assert.deepEqual(SOURCES.map((s) => s.name), ['Operations Tracker', 'Completion Log', 'Finance Register']);
});

test('the three sources are consistent with each other', () => {
  const ids = TRACKER.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'Work IDs are unique in the tracker');
  const complete = TRACKER.filter((r) => r.status === 'Complete').map((r) => r.id);
  assert.deepEqual(COMPLETION.map((c) => c.id), complete, 'one completion row per completed item, and only those');
  for (const f of FINANCE) {
    const c = COMPLETION.find((x) => x.id === f.id);
    assert.ok(c && c.billable, `${f.id}: every invoice belongs to completed, billable work`);
    assert.ok(f.amount > 0);
  }
  assert.equal(new Set(FINANCE.map((f) => f.invoice)).size, FINANCE.length, 'invoice references are unique');
  for (const r of TRACKER) assert.ok(['Not started', 'In progress', 'Complete'].includes(r.status), r.id);
});

test('the checks find exactly the three planted issues', () => {
  const c = runChecks();
  assert.deepEqual(c.duplicates, [['W-311', 'W-316']]);
  assert.deepEqual(c.missingFinance, ['W-307']);
  assert.deepEqual(c.noOwner, ['W-314']);
  const f = findings(check(initialState()));
  assert.deepEqual(f.map((x) => [x.issue, x.ids]), [['duplicate', ['W-311', 'W-316']], ['finance', ['W-307']], ['owner', ['W-314']]]);
});

test('internal work missing from finance (W-304) is recognised and NOT flagged', () => {
  const c = runChecks();
  const w304 = c.finance.find((f) => f.id === 'W-304');
  assert.equal(w304.result, 'notBillable');
  assert.ok(!c.missingFinance.includes('W-304'));
  assert.ok(!FINANCE.some((f) => f.id === 'W-304'), 'it really has no finance entry');
  // Every other completed item is matched.
  assert.deepEqual(c.finance.filter((f) => f.result === 'matched').map((f) => f.id), ['W-301', 'W-302', 'W-303', 'W-305', 'W-306']);
});

test('each finding carries the records needed to show it side by side', () => {
  const [dup, fin, own] = findings(check(initialState()));
  assert.deepEqual(dup.records.tracker.map((r) => r.work), ['Website content update', 'Website content update']);
  assert.equal(dup.records.tracker[0].due, dup.records.tracker[1].due);
  assert.equal(fin.records.completion[0].result, 'Delivered to customer');
  assert.deepEqual(fin.records.finance, []);
  assert.equal(own.records.tracker[0].owner, '');
  for (const f of [dup, fin, own]) assert.ok(f.title && f.explain && f.why && f.choices.length === 2, f.issue);
});

test('nothing is revealed before the visitor runs the check', () => {
  const s = initialState();
  assert.deepEqual(findings(s), []);
  assert.equal(report(s).itemsToReview, 0);
  assert.equal(decide(s, 'duplicate', 'merge'), s, 'no decisions before the check');
});

// ---- Reports and the hero

test('the hand-built report: 11 open, 7 completed, 0 not invoiced, owners not checked', () => {
  const r = report(initialState());
  assert.deepEqual(nums(r), [11, 7, 0, null, 0]);
  assert.equal(r.status, 'Built by hand');
});

test('after the check: 11 open (1 possible duplicate), 7 completed, 1 not invoiced, 1 with no owner, 3 to review', () => {
  const r = report(check(initialState()));
  assert.deepEqual(nums(r), [11, 7, 1, 1, 3]);
  assert.equal(r.possibleDuplicates, 1);
  assert.equal(r.status, 'Review required');
});

test('hero summary comes from the engine: 30 records, 3 sources, 3 to review, review required, no findings', () => {
  const h = heroSummary();
  assert.deepEqual(h, { sourceRecords: 30, sourcesChecked: 3, itemsToReview: 3, status: 'Review required' });
  assert.equal(h.itemsToReview, findings(check(initialState())).length);
  assert.ok(!JSON.stringify(h).includes('W-'), 'the hero never carries the detailed findings');
});

// ---- Decisions

test('each choice moves the report as described', () => {
  const s = check(initialState());
  assert.deepEqual(nums(report(decide(s, 'duplicate', 'merge'))), [10, 7, 1, 1, 2]);
  assert.deepEqual(nums(report(decide(s, 'duplicate', 'separate'))), [11, 7, 1, 1, 2]);
  const fu = report(decide(s, 'finance', 'followUp'));
  assert.deepEqual(nums(fu), [11, 7, 1, 1, 2]); assert.equal(fu.followUps, 1);
  assert.deepEqual(nums(report(decide(s, 'finance', 'noInvoiceDue'))), [11, 7, 0, 1, 2]);
  assert.deepEqual(nums(report(decide(s, 'owner', 'assign', 'Priya'))), [11, 7, 1, 0, 2]);
  const p = report(decide(s, 'owner', 'pending', 'Work is on hold'));
  assert.deepEqual(nums(p), [11, 7, 1, 1, 2]); assert.equal(p.pendingWithReason, 1);
});

test('assigning needs a team member and pending needs a preset reason; nothing else is accepted', () => {
  const s = check(initialState());
  assert.equal(decide(s, 'owner', 'assign'), s);
  assert.equal(decide(s, 'owner', 'assign', 'Someone new'), s);
  assert.equal(decide(s, 'owner', 'pending', 'my own words'), s);
  assert.equal(decide(s, 'duplicate', 'delete'), s);
  assert.equal(decide(s, 'nonsense', 'merge'), s);
  for (const m of TEAM) assert.equal(decide(s, 'owner', 'assign', m).decisions.owner.member, m);
  for (const r of PENDING_REASONS) assert.equal(decide(s, 'owner', 'pending', r).decisions.owner.reason, r);
  assert.deepEqual(PENDING_REASONS, ['Waiting for information', 'Work is on hold', 'Owner not yet confirmed', 'Needs further review']);
});

// All 8 combinations (owner detail varies too, to show it doesn't change the numbers).
const COMBOS = [];
for (const dup of ['merge', 'separate']) for (const fin of ['followUp', 'noInvoiceDue']) for (const own of ['assign', 'pending']) COMBOS.push([dup, fin, own]);
const EXPECTED = {
  'merge|followUp|assign': [10, 7, 1, 0, 0], 'merge|followUp|pending': [10, 7, 1, 1, 0],
  'merge|noInvoiceDue|assign': [10, 7, 0, 0, 0], 'merge|noInvoiceDue|pending': [10, 7, 0, 1, 0],
  'separate|followUp|assign': [11, 7, 1, 0, 0], 'separate|followUp|pending': [11, 7, 1, 1, 0],
  'separate|noInvoiceDue|assign': [11, 7, 0, 0, 0], 'separate|noInvoiceDue|pending': [11, 7, 0, 1, 0],
};
const apply = (s, [dup, fin, own], i = 0) => decide(decide(decide(s, 'duplicate', dup), 'finance', fin), 'owner', own, own === 'assign' ? TEAM[i % 4] : PENDING_REASONS[i % 4]);

test('all eight decision combinations give the expected final report', () => {
  assert.equal(COMBOS.length, 8);
  COMBOS.forEach((combo, i) => {
    let s = apply(check(initialState()), combo, i);
    assert.equal(status(s), 'Decisions made', combo.join('|'));
    s = finalize(s);
    const r = report(s);
    assert.deepEqual(nums(r), EXPECTED[combo.join('|')], combo.join('|'));
    assert.equal(r.status, 'Up to date');
    assert.equal(r.possibleDuplicates, 0);
    assert.equal(r.followUps, combo[1] === 'followUp' ? 1 : 0);
    assert.equal(r.pendingWithReason, combo[2] === 'pending' ? 1 : 0);
  });
});

test('decisions are independent: the order they are made in does not matter', () => {
  for (const combo of COMBOS) {
    const [dup, fin, own] = combo; const det = own === 'assign' ? 'Sam' : 'Needs further review';
    const a = decide(decide(decide(check(initialState()), 'duplicate', dup), 'finance', fin), 'owner', own, det);
    const b = decide(decide(decide(check(initialState()), 'owner', own, det), 'finance', fin), 'duplicate', dup);
    assert.deepEqual(report(a), report(b), combo.join('|'));
  }
});

test('changing a decision recalculates from the source, with nothing left over from the old choice', () => {
  const s0 = check(initialState());
  let s = decide(s0, 'duplicate', 'merge');
  s = decide(s, 'duplicate', 'separate');
  assert.deepEqual(report(s), report(decide(s0, 'duplicate', 'separate')));
  s = decide(decide(s, 'finance', 'noInvoiceDue'), 'finance', 'followUp');
  s = decide(decide(s, 'owner', 'assign', 'Alex'), 'owner', 'pending', 'Waiting for information');
  assert.deepEqual(nums(report(s)), [11, 7, 1, 1, 0]);
  s = decide(s, 'owner', 'assign', 'Jordan');
  assert.equal(s.decisions.owner.member, 'Jordan'); assert.equal(s.decisions.owner.reason, undefined);
  // Clearing a decision puts the item back on the review list.
  const cleared = clearDecision(s, 'finance');
  assert.equal(report(cleared).itemsToReview, 1);
  assert.equal(status(cleared), 'Review required');
});

test('finishing needs all three decisions; decisions lock until reopened, then can change again', () => {
  let s = decide(decide(check(initialState()), 'duplicate', 'merge'), 'finance', 'followUp');
  assert.equal(finalize(s), s, 'cannot finish with one left');
  s = finalize(decide(s, 'owner', 'assign', 'Priya'));
  assert.equal(status(s), 'Up to date');
  assert.equal(decide(s, 'duplicate', 'separate'), s, 'locked once finished');
  s = reopen(s);
  assert.equal(status(s), 'Decisions made');
  s = finalize(decide(s, 'duplicate', 'separate'));
  assert.deepEqual(nums(report(s)), [11, 7, 1, 0, 0]);
});

test('reset restores the original sample, and the source rows are never changed', () => {
  const before = JSON.stringify([TRACKER, COMPLETION, FINANCE]);
  for (const [i, combo] of COMBOS.entries()) finalize(apply(check(initialState()), combo, i));
  assert.equal(JSON.stringify([TRACKER, COMPLETION, FINANCE]), before);
  assert.deepEqual(initialState(), { checked: false, decisions: { duplicate: null, finance: null, owner: null }, finalized: false });
  assert.deepEqual(report(initialState()), report(initialState()));
  assert.deepEqual(nums(report(initialState())), [11, 7, 0, null, 0]);
});

test('status: Built by hand → Review required → Decisions made → Up to date', () => {
  let s = initialState(); assert.equal(status(s), 'Built by hand');
  s = check(s); assert.equal(status(s), 'Review required');
  s = decide(decide(s, 'duplicate', 'merge'), 'finance', 'noInvoiceDue'); assert.equal(status(s), 'Review required');
  s = decide(s, 'owner', 'pending', 'Work is on hold'); assert.ok(allDecided(s)); assert.equal(status(s), 'Decisions made');
  assert.equal(status(finalize(s)), 'Up to date');
});

// ---- Wording rules for everything the demo will show

test('demo wording: first person only (no "we"), no repair business, a consequence for every choice', () => {
  const text = JSON.stringify(DATA, (k, v) => (typeof v === 'function' ? v('X') : v));
  assert.doesNotMatch(text, /\b(we|we're|we've|we'll|our|us)\b/i);
  assert.doesNotMatch(text, /quillfern|repair|technician/i);
  for (const issue of Object.values(ISSUES)) for (const [c] of issue.choices) assert.ok(CONSEQUENCE[c], c);
  assert.deepEqual(PREVENTION.map((p) => p.issue), ['duplicate', 'finance', 'owner']);
});
