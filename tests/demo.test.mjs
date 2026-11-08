// Live demo tests (three-source sample, Nov 2026).
// Every number the demo and the hero card show comes from src/demo/engine.js working on src/demo/data.js.
// These tests pin the source counts, the three planted issues, every decision and combination, reversibility and reset.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as DATA from '../src/demo/data.js';
import { TRACKER, COMPLETION, FINANCE, SOURCES, TEAM, PENDING_REASONS, ISSUES, CONSEQUENCE, PREVENTION } from '../src/demo/data.js';
import {
  initialState, sourceCounts, runChecks, findings, check, decide, clearDecision, allDecided, finalize, reopen, status, outstanding,
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
    const open = combo[1] === 'followUp' || combo[2] === 'pending';
    const want = open ? 'Follow-up pending' : 'Review complete';
    let s = apply(check(initialState()), combo, i);
    assert.equal(status(s), want, combo.join('|'));
    s = finalize(s);
    const r = report(s);
    assert.deepEqual(nums(r), EXPECTED[combo.join('|')], combo.join('|'));
    assert.equal(r.status, want, `${combo.join('|')}: finishing never changes the status`);
    assert.equal(r.outstanding, (combo[1] === 'followUp') + (combo[2] === 'pending'));
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
  assert.ok(s.finalized);
  assert.equal(status(s), 'Follow-up pending', 'the invoice follow-up is still open');
  assert.equal(decide(s, 'duplicate', 'separate'), s, 'locked once finished');
  s = reopen(s);
  assert.ok(!s.finalized);
  s = finalize(decide(decide(s, 'duplicate', 'separate'), 'finance', 'noInvoiceDue'));
  assert.equal(status(s), 'Review complete');
  assert.deepEqual(nums(report(s)), [11, 7, 0, 0, 0]);
  s = finalize(decide(reopen(s), 'finance', 'followUp'));
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

test('status: Built by hand → Review required → Review complete, or Follow-up pending while an action is open', () => {
  let s = initialState(); assert.equal(status(s), 'Built by hand');
  s = check(s); assert.equal(status(s), 'Review required');
  s = decide(decide(s, 'duplicate', 'merge'), 'finance', 'noInvoiceDue'); assert.equal(status(s), 'Review required');
  s = decide(s, 'owner', 'pending', 'Work is on hold'); assert.ok(allDecided(s));
  assert.equal(status(s), 'Follow-up pending');
  assert.deepEqual(outstanding(s), [{ issue: 'owner', id: 'W-314', action: 'No owner yet', reason: 'Work is on hold' }]);
  assert.equal(report(s).itemsToReview, 0, '0 to review, but the open action stays visible');
  s = decide(s, 'owner', 'assign', 'Sam'); assert.equal(status(s), 'Review complete'); assert.deepEqual(outstanding(s), []);
  s = decide(s, 'finance', 'followUp');
  assert.equal(status(s), 'Follow-up pending');
  assert.deepEqual(outstanding(s).map((o) => o.action), ['Invoice follow-up']);
  const all = decide(s, 'owner', 'pending', 'Needs further review');
  assert.equal(outstanding(all).length, 2);
  assert.equal(status(finalize(all)), 'Follow-up pending');
});

// ---- Wording rules for everything the demo will show

test('demo wording: first person only (no "we"), no repair business, a consequence for every choice', () => {
  const text = JSON.stringify(DATA, (k, v) => (typeof v === 'function' ? v('X') : v));
  assert.doesNotMatch(text, /\b(we|we're|we've|we'll|our|us)\b/i);
  assert.doesNotMatch(text, /quillfern|repair|technician/i);
  for (const issue of Object.values(ISSUES)) for (const [c] of issue.choices) assert.ok(CONSEQUENCE[c], c);
  assert.deepEqual(PREVENTION.map((p) => p.issue), ['duplicate', 'finance', 'owner']);
});

// ---- The page (Stage 3)

import { readFile } from 'node:fs/promises';

test('the hero snapshot shows the engine’s figures and none of the findings', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const card = html.slice(html.indexOf('class="tz-card ops-card"'), html.indexOf('</figure>'));
  const h = heroSummary();
  for (const [k, v] of Object.entries(h)) {
    const found = [...card.matchAll(new RegExp(`data-hero="${k}">([^<]*)<`, 'g'))].map((m) => m[1]);
    assert.ok(found.length, `${k} is on the card`);
    for (const f of found) assert.equal(f, String(v), k);
  }
  assert.match(card, /Weekly operations snapshot/i);
  assert.match(card, /Start the live example/);
  assert.match(card, /Fictional sample &middot; No real business data/);
  assert.doesNotMatch(card, /W-3\d\d|duplicate|finance match|No one assigned|Quillfern/i, 'no findings in the hero');
});

test('the hero keeps the booking CTA first, then the live example', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<figure'));
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\.<\/span>/);
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('Explore the live example'));
  assert.doesNotMatch(hero, /Find Your Rework|assessment/i);
});

test('no Quillfern left on the homepage or in the demo code', async () => {
  for (const f of ['../index.html', '../src/demo/ui.js', '../src/demo/data.js', '../src/demo/engine.js', '../src/home.js']) {
    assert.doesNotMatch(await readFile(new URL(f, import.meta.url), 'utf8'), /quillfern/i, f);
  }
});

test('the privacy notice describes the new simulation, with no Quillfern or test booking form', async () => {
  const html = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('<h2>The examples on the homepage</h2>'), html.indexOf('<h2>When you contact me</h2>'));
  assert.doesNotMatch(html, /quillfern|test booking form/i);
  assert.match(sec, /fictional/);
  assert.match(sec, /not connected to any accounting, finance, work-tracking or other business system/);
  assert.match(sec, /not in cookies, local storage or session storage/);
  assert.match(html, /<h2>When you contact me<\/h2>[\s\S]*Booking a review/, 'booking disclosures still there');
});

// ---- The sample week (completed week ending Fri 6 Nov 2026)

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const asDate = (label) => { // 'Fri 6 Nov' → Date (2026), checking the weekday matches the date
  const [dow, d, mon] = label.split(' ');
  assert.equal(mon, 'Nov', label);
  const dt = new Date(Date.UTC(2026, 10, Number(d)));
  assert.equal(DAYS[dt.getUTCDay()], dow, `${label} is a ${DAYS[dt.getUTCDay()]}`);
  return dt;
};

test('the sample week is a completed week ending Fri 6 Nov 2026, and every date fits it', () => {
  assert.equal(DATA.WEEK, 'Week ending Fri 6 Nov 2026');
  const end = asDate(DATA.WEEK.replace('Week ending ', '').replace(' 2026', ''));
  const start = new Date(end); start.setUTCDate(end.getUTCDate() - 4); // Monday
  for (const r of COMPLETION) {
    const d = asDate(r.completed);
    assert.ok(d >= start && d <= end, `${r.id} was completed during the sample week`);
  }
  for (const r of TRACKER) {
    const d = asDate(r.due);
    if (r.status === 'Complete') assert.ok(d >= start && d <= end, `${r.id} was due during the sample week`);
    else assert.ok(d >= start, `${r.id} is open work due this week or later`);
  }
  // Only the week label lives in the code: no other week constants.
  assert.deepEqual(Object.keys(DATA).filter((k) => /week|date/i.test(k)), ['WEEK']);
});

test('the demo window shows the same week as the data', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const m = html.match(/<span class="dw-status" data-week>([^<]*)</);
  assert.ok(m, 'the demo title bar has the week');
  assert.equal(m[1], DATA.WEEK);
  assert.doesNotMatch(html, /13 Nov/);
});

test('the end of the demo describes proposed improvements, not finished ones', async () => {
  const ui = await readFile(new URL('../src/demo/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /These improvements could mean less repeated checking, fewer missed tasks and fewer manual corrections\./);
  assert.match(ui, /Checked, decisions made, and improvements identified\./);
  assert.match(ui, /a clearer way for the tracker, completion log and finance register to work together\./);
  assert.match(ui, /What could improve\?/);
  assert.doesNotMatch(ui, /improved at the source|work as one|These changes mean|What improved\?/);
});
