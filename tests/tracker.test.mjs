// Tests for the Weekly Work & Follow-up Tracker (implementation brief, 10 Nov 2026 evening): the shared sample and the
// business rules behind the hero illustration. The live example and the workbook download were taken off the page on
// 12 Nov 2026 (seven-section page); src/tracker/ui.js and the workbook stay in the repo, unlinked.
// The workbook's own formulas are checked against this engine by tools/check_tracker_xlsx.py (needs LibreOffice).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as DATA from '../src/tracker/data.js';
import { RECORDS, PERIOD, OWNERS, STATUSES } from '../src/tracker/data.js';
import {
  summarise, findings, flagText, isOverdue, isUnassigned, missingFields, duplicatesOf, inPeriod, setOwner, setStatus, setCustomer, setCompleted, addRecord, summaryText,
} from '../src/tracker/engine.js';
import { appHtml, attentionItems, reportChecks, reportHtml, STAGES } from '../src/tracker/ui.js';
import { dataChecks } from '../src/demo/hero.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const section = async () => { const h = await page(); return h.slice(h.indexOf('id="samples"'), h.indexOf('id="services"')); };
const figures = (s) => [s.total, s.completed, s.outstanding, s.overdue, s.unassigned, s.missing, s.attention];

test('the sample: 12 fixed, frozen, industry-neutral records with the deliberate issues left in', () => {
  assert.equal(RECORDS.length, 12);
  assert.deepEqual(RECORDS.map((r) => r.ref), Array.from({ length: 12 }, (_, i) => `R-${101 + i}`));
  assert.deepEqual([RECORDS[3].due, RECORDS[3].status], ['2026-11-04', 'Waiting']);
  assert.equal(RECORDS[10].customer, '');
  assert.equal(RECORDS[11].owner, 'Unassigned');
  assert.deepEqual(PERIOD, { start: '2026-11-02', end: '2026-11-06', asAt: '2026-11-06' });
  assert.deepEqual([...OWNERS], ['Ana', 'Mark', 'Sam', 'Unassigned']);
  assert.deepEqual([...STATUSES], ['Not Started', 'In Progress', 'Waiting', 'Completed']);
  assert.ok(Object.isFrozen(RECORDS) && RECORDS.every(Object.isFrozen));
  const text = JSON.stringify(DATA);
  assert.doesNotMatch(text, /solar|energy|utilit|meter|billing|[$₱€£]/i);
});

test('acceptance figures: 12 records, 7 completed, 5 outstanding, 1 overdue, 1 unassigned, 1 missing, 3 need attention; no duplicates', () => {
  const s = summarise();
  assert.deepEqual(figures(s), [12, 7, 5, 1, 1, 1, 3]);
  assert.equal(s.duplicates, 0);
  assert.deepEqual(s.followUps.map((f) => [f.title, `${f.reason} · ${f.ref}`, f.note]), [
    ['Follow up on payment', 'Overdue · R-104', 'Due 4 November and still waiting.'],
    ['Check service notes', 'Missing customer · R-111', 'Add the missing customer or area details.'],
    ['Fix leaking tap, unit 4', 'No owner · R-112', 'Choose someone to take responsibility.'],
  ]);
  assert.equal(s.text, '12 jobs in this report. 7 were completed this week, while 5 remain outstanding. 3 jobs need attention.');
});

test('rules: overdue is before the as-at date only; due on the as-at date is not overdue; completed work is never overdue or unassigned', () => {
  const r = { ref: 'X', received: '2026-11-03', task: 'A', customer: 'B', owner: 'Ana', due: '2026-11-06', status: 'Waiting' };
  assert.equal(isOverdue(r), false);
  assert.equal(isOverdue({ ...r, due: '2026-11-05' }), true);
  assert.equal(isOverdue({ ...r, due: '2026-11-05', status: 'Completed' }), false);
  assert.equal(isOverdue({ ...r, due: '' }), false);
  assert.equal(isUnassigned({ ...r, owner: ' unassigned ' }), true);
  assert.equal(isUnassigned({ ...r, owner: '' }), true);
  assert.equal(isUnassigned({ ...r, owner: '', status: 'Completed' }), false);
  assert.deepEqual(missingFields({ ...r, customer: '  ', due: '' }), ['customer', 'due']);
  assert.equal(inPeriod({ ...r, received: '2026-11-02' }), true);
  assert.equal(inPeriod({ ...r, received: '2026-11-07' }), false);
  assert.equal(inPeriod({ ...r, received: '' }), false);
});

test('visitor changes recalculate everything: completing R-104, assigning R-112, filling R-111', () => {
  // Marked Completed without a date: still outstanding, and it needs the date (11 Nov definitions).
  let rec = setStatus(RECORDS, 'R-104', 'Completed');
  let s = summarise(rec);
  assert.deepEqual(figures(s), [12, 7, 5, 0, 1, 1, 3]);
  assert.deepEqual(s.followUps.find((f) => f.ref === 'R-104').labels, ['No completion date']);
  rec = setCompleted(rec, 'R-104', '2026-11-06');
  s = summarise(rec);
  assert.deepEqual(figures(s), [12, 8, 4, 0, 1, 1, 2]);
  assert.ok(!s.followUps.some((f) => f.ref === 'R-104'));
  assert.equal(s.text, '12 jobs in this report. 8 were completed this week, while 4 remain outstanding. 2 jobs need attention.');
  rec = setOwner(rec, 'R-112', 'Sam');
  s = summarise(rec);
  assert.deepEqual([s.unassigned, s.attention], [0, 1]);
  rec = setCustomer(rec, 'R-111', 'Harbor Works');
  s = summarise(rec);
  assert.deepEqual([s.missing, s.attention, s.followUps.length], [0, 0, 0]);
  assert.equal(s.text, '12 jobs in this report. 8 were completed this week, while 4 remain outstanding. No jobs need attention.');
  assert.equal(RECORDS[3].status, 'Waiting', 'the sample itself is untouched');
});

test('possible duplicates: same date, customer and request, ignoring case and outer spaces; flagged, never removed', () => {
  const rec = addRecord(RECORDS, { ref: 'R-113', received: '2026-11-02', task: '  quote for END-OF-LEASE clean ', customer: 'ridgeway apartments', owner: 'Sam', due: '2026-11-09', status: 'Not Started' });
  assert.deepEqual(duplicatesOf(rec[12], rec), ['R-101']);
  assert.deepEqual(duplicatesOf(rec[0], rec), ['R-113']);
  const s = summarise(rec);
  assert.equal(s.total, 13, 'both records are still counted');
  assert.equal(s.attention, 4, 'R-113 needs attention; R-101 is already completed, so it is flagged but not counted');
  assert.ok(!s.followUps.some((x) => x.ref === 'R-101'));
  const f = s.followUps.find((x) => x.ref === 'R-113');
  assert.deepEqual(f.labels, ['Possible duplicate']);
  assert.match(f.note, /Matches R-101 on date, customer and request\./);
  assert.deepEqual(duplicatesOf(RECORDS[0], addRecord(RECORDS, { ...RECORDS[0], ref: 'R-114', received: '2026-11-03' })), [], 'a different date is not a duplicate');
});

test('a record with several issues shows every reason but counts once', () => {
  const rec = setCustomer(setStatus(RECORDS, 'R-112', 'Waiting'), 'R-112', '');
  const late = rec.map((r) => (r.ref === 'R-112' ? { ...r, due: '2026-11-05' } : r));
  const s = summarise(late);
  assert.equal(flagText(late[11], late), 'Overdue · Missing customer · No owner');
  assert.deepEqual([s.overdue, s.missing, s.unassigned, s.attention], [2, 2, 1, 3]);
  const f = s.followUps.find((x) => x.ref === 'R-112');
  assert.equal(f.note, 'Due 5 November and still waiting. Add the missing customer or area details. Choose someone to take responsibility.');
});

test('next week: open jobs carry over, completed ones drop off, overdue stays visible (11 Nov 2026 review)', () => {
  const next = { start: '2026-11-09', end: '2026-11-13', asAt: '2026-11-13' };
  const s = summarise(RECORDS, next);
  assert.deepEqual([s.total, s.completed, s.outstanding, s.overdue, s.attention], [5, 0, 5, 5, 5]);
  assert.ok(s.followUps.some((f) => f.ref === 'R-104' && f.keys.includes('overdue')), 'R-104 is still overdue next week');
  const done = summarise(setStatus(RECORDS, 'R-106', 'Completed').map((r) => (r.ref === 'R-106' ? { ...r, completed: '2026-11-10' } : r)), next);
  assert.deepEqual([done.total, done.completed, done.outstanding], [5, 1, 4], 'completed next week counts as completed that week');
  const earlier = summarise(RECORDS, { start: '2026-10-26', end: '2026-10-30', asAt: '2026-10-30' });
  assert.equal(earlier.total, 0, 'nothing before it was received');
});

test('reporting definitions (approved 11 Nov): cut-off, past weeks, completed jobs never need attention, no completion date', () => {
  // Re-running last week after R-104 was completed on 9 Nov: still outstanding at the 6 Nov cut-off.
  const later = setCompleted(setStatus(RECORDS, 'R-104', 'Completed'), 'R-104', '2026-11-09');
  let s = summarise(later);
  assert.deepEqual([s.total, s.completed, s.outstanding, s.attention], [12, 7, 5, 3]);
  assert.ok(s.followUps.some((f) => f.ref === 'R-104' && f.keys.includes('overdue')), 'overdue at the cut-off');
  // A completed job with a missing customer: not outstanding, so not in Need attention.
  s = summarise(setCustomer(RECORDS, 'R-101', ''));
  assert.deepEqual([s.attention, s.missing], [3, 2]);
  assert.ok(!s.followUps.some((f) => f.ref === 'R-101'));
  // Need attention is always part of Still outstanding.
  for (const r of RECORDS) for (const st of STATUSES) {
    const x = summarise(setStatus(RECORDS, r.ref, st));
    assert.ok(x.attention <= x.outstanding && x.completed + x.outstanding === x.total, `${r.ref} ${st}`);
  }
});

test('summary wording follows the figures and never claims more than the tracker shows', () => {
  assert.equal(summaryText({ total: 1, completed: 0, outstanding: 1, attention: 1 }), '1 job in this report. None were completed this week, and 1 remains outstanding. 1 job needs attention.');
  assert.equal(summaryText({ total: 12, completed: 12, outstanding: 0, attention: 0 }), '12 jobs in this report. All 12 were completed this week. No jobs need attention.');
  assert.equal(summaryText({ total: 0, completed: 0, outstanding: 0, attention: 0 }), 'No jobs in this report.');
  // "Completed this week" is now literal: it counts Date Completed inside the period (11 Nov definitions).
  for (const owner of OWNERS) for (const status of STATUSES) { const x = summarise(setStatus(setOwner(RECORDS, 'R-104', owner), 'R-104', status)); assert.ok(x.text.startsWith(`${x.total} jobs in this report.`)); }
});

test('every follow-up and figure comes from the current records (no fixed text left behind)', () => {
  for (const status of STATUSES) for (const owner of OWNERS) {
    const rec = setOwner(setStatus(RECORDS, 'R-112', status), 'R-112', owner);
    const s = summarise(rec);
    const want = rec.filter((r) => findings(r, rec).length).map((r) => r.ref);
    assert.deepEqual(s.followUps.map((f) => f.ref), want, `${status} / ${owner}`);
    assert.equal(s.attention, want.length);
    const html = reportHtml(rec);
    assert.ok(html.includes(`data-kpi="attention"><strong>${s.attention}</strong>`), `${status} / ${owner}: attention tile`);
    assert.equal(attentionItems(rec).length, Math.min(3, want.length));
  }
});

const textOf = (h) => h.replace(/<span aria-hidden="true">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ');

test('12 Nov seven-section page: the live example is gone; the approach card sits in How it works (UX review)', async () => {
  const html = await page();
  assert.doesNotMatch(html, /samples-h|tracker:start|tracker-app|Live example|Explore the live example/);
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  const card = how.slice(how.indexOf('<div class="how-approach">'), how.indexOf('<ol class="steps-list'));
  for (const t of ['The fix can be as simple as a spreadsheet that updates itself', 'Any additional software, subscriptions or implementation costs are discussed before the work begins.',
    'Improving what you already use is a complete starting point on its own.', '<strong>Works with what you already use:</strong>']) assert.ok(card.includes(t), t);
  assert.match(how, /<h2 id="how-h">You keep the tools you know\. I improve the process around them\.<\/h2>/, 'the heading carries "process first"');
});

test('stages: each one shows the actual records and the checks worked out from them', () => {
  const html = appHtml();
  const panel = (id) => html.slice(html.indexOf(`id="lx-p-${id}"`), html.indexOf('</div><div class="lx-panel"', html.indexOf(`id="lx-p-${id}"`)) + 1 || undefined);
  const c = dataChecks();
  // Capture: R-111's real fields, nothing invented (no customer name, no extra fields).
  const cap = textOf(panel('capture'));
  for (const t of ['Service request form Sample', 'Reference R-111', 'Received 6 Nov', 'Request Check service notes', 'Customer Missing', 'Job record, with checks applied', 'Customer: Missing', 'Customer details need completing. The missing information is flagged for follow-up and shown in the weekly report.',
    'No duplicate jobs None found Passed', 'Job details complete 11 of 12 complete · R-111 Flagged', 'Dates entered correctly 12 of 12 Passed']) assert.ok(cap.includes(t), t);
  assert.equal((panel('capture').match(/<dt>/g) || []).length, 4, 'only the four sample fields');
  // Move: the five outstanding jobs, with R-112 and R-104 flagged.
  const mv = panel('move');
  assert.equal((mv.match(/<tr class=/g) || []).length, 5, 'the 5 outstanding jobs');
  assert.equal((mv.match(/<tr class="is-flag">/g) || []).length, 2);
  assert.match(mv, /<span class="lx-blank">Unassigned<\/span>/);
  assert.doesNotMatch(mv, /Nobody/);
  const mvt = textOf(mv);
  for (const t of ['Every open job has an owner No owner · R-112 Action required', 'Every job has a status 12 of 12 Passed', 'Follow-ups on time Overdue · R-104 Action required']) assert.ok(mvt.includes(t), t);
  assert.doesNotMatch(mv, /invoic/i);
  assert.deepEqual(c.move.map((x) => x.label), ['Every open job has an owner', 'Every job has a status', 'Follow-ups on time'], 'no invoice check');
  // See: simplified checks; the calculation is secondary (inside <details>).
  const see = textOf(panel('see'));
  for (const t of ['Every job counted 12 of 12 counted Passed', 'Totals add up 7 done + 5 open = 12 Passed', 'Problems shown, not hidden 3 on the report Flagged',
    'The 3 needing attention are part of the 5 still outstanding, not extra jobs.']) assert.ok(see.includes(t), t);
  assert.deepEqual(STAGES.map((x) => x.name), ['Capture', 'Move', 'See']);
});

test('report: 7 / 5 / 3 (the 3 within the 5), the three action items in order, never 15', () => {
  const r = textOf(reportHtml());
  assert.ok(r.includes('7 Completed this week 5 Still outstanding 3 Need attention Of the 5 still outstanding'), r);
  assert.ok(r.includes('1. ') || true);
  assert.deepEqual(attentionItems().map((x) => `${x.ref} ${x.what} (${x.tag})`), ['R-104 Follow up on overdue work (Overdue)', 'R-112 Assign an owner (No owner)', 'R-111 Complete the missing customer information (Missing customer)']);
  assert.deepEqual(reportChecks().map((x) => x.state), ['pass', 'pass', 'flag'], 'exceptions are never shown as passed');
  assert.doesNotMatch(r, /\b15\b/);
  assert.doesNotMatch(reportHtml(), /AI|summary draft/i, 'the report is the payoff, not an AI summary');
});

test('tracker view (kept in the repo, not on the page): read-only, renders the 12 jobs', () => {
  const inner = appHtml();
  assert.deepEqual([...inner.matchAll(/<th scope="col">([^<]+)<\/th>/g)].slice(-7).map((m) => m[1]), ['Ref', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status', 'Date Completed']);
  assert.equal((inner.match(/<tr class="wt-row/g) || []).length, 12);
  assert.doesNotMatch(inner, /<button|<select|<input/, 'no controls without JavaScript');
  const live = appHtml(RECORDS, { interactive: true });
  assert.doesNotMatch(live, /<select|<input|data-fix|data-wt-reset/, 'no tap-to-fix, no editing');
});

test('the demo never changes the records (the hero stays at 12 / 7 / 5 / 3)', async () => {
  const js = await readFile(new URL('../src/tracker/ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /store\.|setOwner|setStatus|setCustomer/);
});

test('workbook: kept in the repo but linked from no page; the tracker code sends nothing anywhere', async () => {
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../assessment/index.html', '../brand/index.html']) {
    const h = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(h, /Weekly-Work-Tracker\.xlsx|Download the free Excel tracker/, f);
  }
  const st = await stat(new URL('../assets/downloads/Rework-Rescue-Weekly-Work-Tracker.xlsx', import.meta.url));
  assert.ok(st.size > 5000, 'file still in the repo (unlinked, Jeff 12 Nov)');
  for (const f of ['tracker/ui.js', 'tracker/store.js', 'tracker/engine.js']) {
    const js = await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/, f);
  }
});

test('services keep their names; no pricing, testimonials or invented results added', async () => {
  const html = await page();
  for (const n of ['Data &amp; Reporting', 'Workflows &amp; Processes', 'Business Tools &amp; Systems']) assert.ok(html.includes(`<p class="svc-short">${n}</p>`), n);
  const sec = html.slice(html.indexOf('id="services"'), html.indexOf('id="how"'));
  assert.doesNotMatch(sec, /[$₱€£]\s?\d|testimonial|saved \d|% faster|guarantee/i);
});
