// Tests for the main example, the Weekly Work & Follow-up Tracker (implementation brief, 10 Nov 2026 evening):
// the shared sample, the business rules, the follow-up list and summary, the page copy and the workbook download.
// The workbook's own formulas are checked against this engine by tools/check_tracker_xlsx.py (needs LibreOffice).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as DATA from '../src/tracker/data.js';
import { RECORDS, PERIOD, OWNERS, STATUSES } from '../src/tracker/data.js';
import {
  summarise, findings, flagText, isOverdue, isUnassigned, missingFields, duplicatesOf, inPeriod, setOwner, setStatus, setCustomer, addRecord, summaryText,
} from '../src/tracker/engine.js';
import { appHtml, progress, changes } from '../src/tracker/ui.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const section = async () => { const h = await page(); return h.slice(h.indexOf('id="samples"'), h.indexOf('id="experience"')); };
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
    ['Check service notes', 'Missing customer / area · R-111', 'Add the missing customer or area details.'],
    ['Confirm outstanding item', 'No owner assigned · R-112', 'Choose someone to take responsibility.'],
  ]);
  assert.equal(s.text, '12 records were received during the reporting period. 7 are marked as completed, while 5 remain outstanding. 3 records need attention.');
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
  let rec = setStatus(RECORDS, 'R-104', 'Completed');
  let s = summarise(rec);
  assert.deepEqual(figures(s), [12, 8, 4, 0, 1, 1, 2]);
  assert.ok(!s.followUps.some((f) => f.ref === 'R-104'));
  assert.equal(s.text, '12 records were received during the reporting period. 8 are marked as completed, while 4 remain outstanding. 2 records need attention.');
  rec = setOwner(rec, 'R-112', 'Sam');
  s = summarise(rec);
  assert.deepEqual([s.unassigned, s.attention], [0, 1]);
  rec = setCustomer(rec, 'R-111', 'Harbor Works');
  s = summarise(rec);
  assert.deepEqual([s.missing, s.attention, s.followUps.length], [0, 0, 0]);
  assert.equal(s.text, '12 records were received during the reporting period. 8 are marked as completed, while 4 remain outstanding. No records need attention.');
  assert.equal(RECORDS[3].status, 'Waiting', 'the sample itself is untouched');
});

test('possible duplicates: same date, customer and request, ignoring case and outer spaces; flagged, never removed', () => {
  const rec = addRecord(RECORDS, { ref: 'R-113', received: '2026-11-02', task: '  send UPDATED quotation ', customer: 'northfield services', owner: 'Sam', due: '2026-11-09', status: 'Not Started' });
  assert.deepEqual(duplicatesOf(rec[12], rec), ['R-101']);
  assert.deepEqual(duplicatesOf(rec[0], rec), ['R-113']);
  const s = summarise(rec);
  assert.equal(s.total, 13, 'both records are still counted');
  assert.equal(s.attention, 5);
  const f = s.followUps.find((x) => x.ref === 'R-113');
  assert.deepEqual(f.labels, ['Possible duplicate — review']);
  assert.match(f.note, /Matches R-101 on date, customer and request\./);
  assert.deepEqual(duplicatesOf(RECORDS[0], addRecord(RECORDS, { ...RECORDS[0], ref: 'R-114', received: '2026-11-03' })), [], 'a different date is not a duplicate');
});

test('a record with several issues shows every reason but counts once', () => {
  const rec = setCustomer(setStatus(RECORDS, 'R-112', 'Waiting'), 'R-112', '');
  const late = rec.map((r) => (r.ref === 'R-112' ? { ...r, due: '2026-11-05' } : r));
  const s = summarise(late);
  assert.equal(flagText(late[11], late), 'Overdue · Missing customer / area · No owner assigned');
  assert.deepEqual([s.overdue, s.missing, s.unassigned, s.attention], [2, 2, 1, 3]);
  const f = s.followUps.find((x) => x.ref === 'R-112');
  assert.equal(f.note, 'Due 5 November and still waiting. Add the missing customer or area details. Choose someone to take responsibility.');
});

test('summary wording follows the figures and never claims more than the tracker shows', () => {
  assert.equal(summaryText({ total: 1, completed: 0, outstanding: 1, attention: 1 }), '1 record was received during the reporting period. None are marked as completed yet, and 1 remains outstanding. 1 record needs attention.');
  assert.equal(summaryText({ total: 12, completed: 12, outstanding: 0, attention: 0 }), '12 records were received during the reporting period. All 12 are marked as completed. No records need attention.');
  assert.equal(summaryText({ total: 0, completed: 0, outstanding: 0, attention: 0 }), 'No records were received during the reporting period.');
  for (const owner of OWNERS) for (const status of STATUSES) assert.doesNotMatch(summarise(setStatus(setOwner(RECORDS, 'R-104', owner), 'R-104', status)).text, /this week|during the week|completed (this|during)/i);
});

test('every follow-up and figure comes from the current records (no fixed text left behind)', () => {
  for (const status of STATUSES) for (const owner of OWNERS) {
    const rec = setOwner(setStatus(RECORDS, 'R-112', status), 'R-112', owner);
    const s = summarise(rec);
    const want = rec.filter((r) => findings(r, rec).length).map((r) => r.ref);
    assert.deepEqual(s.followUps.map((f) => f.ref), want, `${status} / ${owner}`);
    assert.equal(s.attention, want.length);
    const html = appHtml(rec);
    assert.ok(html.includes(`<li class="lx-kpi ${s.attention ? 'is-att' : 'is-clear'}" data-kpi="attention"><strong>${s.attention}</strong>`), `${status} / ${owner}: attention tile`);
  }
});

test('page copy (11 Nov): eyebrow, heading, lede, steps, report and the download wording, in order', async () => {
  const sec = await section();
  const order = ['<p class="eyebrow">Live example &middot; fictional sample data</p>', '<h2 id="samples-h">Turn a messy week into a report you can send.</h2>',
    'A week at Northstar Services, a fictional service business: 12 jobs in one list, and three problems my checks caught.<span class="lx-js-only"> Fix them and watch the weekly report update.</span>',
    'Capture</b><span>12 jobs in one list', 'Check</b>', 'Report</b>', 'My checks found 3 problems. Here’s what happens to each one.',
    'R-112', 'R-111', 'R-104', 'Northstar Services · Weekly report', '2–6 November 2026 · Fictional sample', 'Action items', 'Summary',
    'The summary is written by simple rules from these records. In a real project, a person checks it before it&rsquo;s sent.',
    'See all 12 jobs (the tracker behind this report)', 'Use the same simple tracker with your own business records. Includes automatic counts and a weekly follow-up summary.',
    'It starts with the sample as delivered (before your fixes). Replace it with your own records.', 'Download the free Excel tracker', 'Sample business data for demonstration purposes.'];
  const at = order.map((t) => sec.indexOf(t));
  assert.ok(at.every((i) => i >= 0), order.filter((t, i) => at[i] < 0).join(' | '));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order');
  assert.doesNotMatch(sec, /\sstyle="/);
  assert.doesNotMatch(sec, /\bwe\b|\bour\b/i, 'first person singular only');
  assert.doesNotMatch(sec, /\bAI\b|saves? hours|100%/, 'no overclaims');
});

test('the no-JavaScript version in index.html is exactly what the engine renders for the sample', async () => {
  const sec = await section();
  const inner = sec.slice(sec.indexOf('<!-- tracker:start -->') + 22, sec.indexOf('<!-- tracker:end -->'));
  assert.equal(inner, appHtml(), 'run: node tools/render_tracker_static.mjs');
  assert.match(inner, /data-kpi="total"><strong>12<\/strong>.*data-kpi="completed"><strong>7<\/strong>.*data-kpi="outstanding"><strong>5<\/strong>.*data-kpi="attention"><strong>3<\/strong>/);
  assert.deepEqual([...inner.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map((m) => m[1]), ['Ref', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status']);
  assert.equal((inner.match(/<tr class="wt-row/g) || []).length, 12);
  assert.doesNotMatch(inner, /<button/, 'no buttons without JavaScript');
  assert.equal((inner.match(/class="lx-still"/g) || []).length, 3, 'each card says what a person does');
});

test('interactive version: one-tap fixes for R-112 and R-111, R-104 kept on the report, full tracker, Start over', () => {
  const html = appHtml(RECORDS, { interactive: true });
  assert.deepEqual([...html.matchAll(/data-fix="R-112" data-val="([^"]+)"/g)].map((m) => m[1]), ['Ana', 'Mark', 'Sam']);
  const cust = [...html.matchAll(/data-fix="R-111" data-val="([^"]+)"/g)].map((m) => m[1].replace('&amp;', '&'));
  assert.deepEqual(cust, ['Harbor Works'], 'one clear answer, from the job notes, an existing customer');
  assert.ok(RECORDS.some((r) => r.customer === 'Harbor Works'));
  assert.match(html, />Add Harbor Works</);
  assert.match(html, /data-fix="R-104" data-val="Keep it at the top of the report"/);
  assert.equal((html.match(/data-owner="/g) || []).length, 12);
  assert.equal((html.match(/data-status="/g) || []).length, 12);
  assert.match(html, /data-wt-reset>Start over</);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Draft · 0 of 3 checks cleared/);
});

test('fixing the three problems: figures, action items and "fixed during checks" follow the records', () => {
  const rec = setCustomer(setOwner(RECORDS, 'R-112', 'Sam'), 'R-111', 'Harbor Works');
  const s = summarise(rec);
  assert.deepEqual([s.total, s.completed, s.outstanding, s.attention], [12, 7, 5, 1]);
  assert.equal(progress(rec).cleared, 2, 'R-104 still overdue until kept on the report');
  assert.equal(progress(rec, true).cleared, 3);
  assert.deepEqual(changes(rec), ['R-111: customer set to Harbor Works', 'R-112: owner set to Sam']);
  const html = appHtml(rec, { interactive: true, kept: true });
  assert.match(html, /Ready to send/);
  assert.match(html, /Follow up <span class="lx-ref">R-104<\/span> \(overdue\)/);
  assert.doesNotMatch(html, /Assign an owner to/);
  assert.match(html, /On the report/);
  assert.match(html, /All 3 handled\. Your report is ready to send\./);
  assert.deepEqual(changes(RECORDS), [], 'nothing marked fixed in the sample as delivered');
  // A new problem made in the full tracker after the three fixes: not ready to send.
  const extra = setOwner(rec, 'R-106', 'Unassigned');
  const p = progress(extra, true);
  assert.deepEqual([p.cleared, p.extra, p.ready], [3, 1, false]);
  const h2 = appHtml(extra, { interactive: true, kept: true });
  assert.doesNotMatch(h2, /Ready to send/);
  assert.match(h2, /Draft · 1 new issue to check/);
  assert.match(h2, /Assign an owner to <span class="lx-ref">R-106<\/span>/);
  // R-104 completed in the tracker: a real exception resolved, not "fixed".
  assert.match(appHtml(setStatus(rec, 'R-104', 'Completed'), { interactive: true }), /lx-badge is-done">Resolved</);
});

test('download: the button links to the real workbook in assets/downloads, nothing is sent anywhere', async () => {
  const sec = await section();
  const href = sec.match(/<a class="btn btn-primary" href="([^"]+)" download[^>]*>Download the free Excel tracker<\/a>/)[1];
  assert.equal(href, 'assets/downloads/Rework-Rescue-Weekly-Work-Tracker.xlsx');
  const st = await stat(new URL(`../${href}`, import.meta.url));
  assert.ok(st.size > 5000 && st.size < 200000, `${st.size} bytes`);
  const head = (await readFile(new URL(`../${href}`, import.meta.url))).subarray(0, 2).toString();
  assert.equal(head, 'PK', 'an .xlsx (zip) file');
  const vi = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  assert.doesNotMatch(vi, /assets/);
  for (const f of ['tracker/ui.js', 'tracker/store.js', 'tracker/engine.js']) {
    const js = await readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/, f);
  }
});

test('services keep their names; no pricing, testimonials or invented results added', async () => {
  const html = await page();
  for (const n of ['Data &amp; Reporting', 'Workflows &amp; Processes', 'Business Tools &amp; Systems']) assert.ok(html.includes(`<h3>${n}</h3>`), n);
  const sec = await section();
  assert.doesNotMatch(sec, /[$₱€£]\s?\d|testimonial|saved \d|% faster|guarantee/i);
});
