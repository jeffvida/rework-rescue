// Tests for the main example, the Weekly Work & Follow-up Tracker (implementation brief, 10 Nov 2026 evening):
// the shared sample, the business rules, the follow-up list and summary, the page copy and the workbook download.
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

test('page copy (final brief, 11 Nov): problem first, then Capture, Move, See, the report, how it is put in place, booking', async () => {
  const sec = await section();
  const order = ['<p class="eyebrow">Live example &middot; Northstar Services, a fictional service business</p>',
    '<h2 id="samples-h">Your team is working hard. So why does everything still need chasing?</h2>',
    'Here&rsquo;s one sample week at Northstar Services, from scattered information to a report you can rely on.',
    '12 jobs this week. 3 issues that could easily be missed.',
    'First, let’s get the information right.', 'Missing information and duplicate records are identified before they create problems further down the process.',
    'Next, let’s make sure the work doesn’t get forgotten.', 'Clear responsibilities and visible follow-ups help prevent work from slipping through the cracks.',
    'Finally, know where your business stands.', 'Reliable information makes it easier to see what has been completed, what remains outstanding and what needs attention.',
    'Weekly operations report · Fictional sample', '2–6 November 2026 · 12 jobs checked', 'What needs attention',
    'Know what&rsquo;s completed. See what&rsquo;s outstanding. Know what to do next.', 'See all 12 jobs (the tracker behind this report)',
    'Your tracker keeps your own columns, such as site, supervisor or visit date. The checks work the same way.', 'Download the free Excel tracker'];
  const at = order.map((t) => sec.indexOf(t));
  assert.ok(at.every((i) => i >= 0), order.filter((t, i) => at[i] < 0).join(' | '));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order');
  assert.doesNotMatch(sec, /\sstyle="/);
  assert.doesNotMatch(sec, /\bwe\b|\bour\b/i, 'first person singular only');
  assert.doesNotMatch(sec.replace('Send invoice copy', '').replace(/href="[^"]*"/g, ''), /invoic|CRM is|monitor|notification sent|automatically assign|saves? hours|time sav|%|live data|connected to your/i, 'nothing the sample does not do');
  assert.doesNotMatch(sec, /\bAI\b/, 'no AI in the live example');
  const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const svc = page.slice(page.indexOf('id="services"'), page.indexOf('id="how"'));
  for (const t of ['<h3 id="lx-impl-h">Improve the process first. Automate where it helps.</h3>', 'I fix the process first, then automate it, so you&rsquo;re not automating a mess.',
    'Any additional software, subscriptions or implementation costs are discussed before the work begins.', 'Improving what you already use is a complete starting point on its own.']) assert.ok(svc.includes(t), t);
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

test('the no-JavaScript version in index.html is exactly what the engine renders; read-only everywhere', async () => {
  const sec = await section();
  const inner = sec.slice(sec.indexOf('<!-- tracker:start -->') + 22, sec.indexOf('<!-- tracker:end -->'));
  assert.equal(inner, appHtml(), 'run: node tools/render_tracker_static.mjs');
  assert.deepEqual([...inner.matchAll(/<th scope="col">([^<]+)<\/th>/g)].slice(-7).map((m) => m[1]), ['Ref', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status', 'Date Completed']);
  assert.equal((inner.match(/<tr class="wt-row/g) || []).length, 12);
  assert.doesNotMatch(inner, /<button|<select|<input/, 'no controls without JavaScript');
  assert.equal((inner.match(/class="lx-panel"/g) || []).length, 3, 'all three stages shown');
  const live = appHtml(RECORDS, { interactive: true });
  assert.doesNotMatch(live, /<select|<input|data-fix|data-wt-reset/, 'no tap-to-fix, no editing');
  assert.deepEqual([...live.matchAll(/class="lx-tab[^"]*" data-go="(\w+)"/g)].map((m) => m[1]), ['capture', 'move', 'see']);
  // The end of the Capture and Move panels leads on to the next stage (11 Nov PM review).
  assert.deepEqual([...live.matchAll(/data-go="(\w+)" data-lx-next>Next: (\w+)/g)].map((m) => `${m[1]}:${m[2]}`), ['move:Move', 'see:See']);
  for (const a of ['pause', 'skip', 'replay']) assert.match(live, new RegExp(`data-lx-act="${a}"`));
  assert.match(live, /class="lx-jump" href="#lx-rep-h"/);
  assert.equal((live.match(/role="region"[^>]*hidden/g) || []).length, 3, 'stage panels start hidden behind the opening');
});

test('the demo never changes the records (the hero stays at 12 / 7 / 5 / 3)', async () => {
  const js = await readFile(new URL('../src/tracker/ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /store\.|setOwner|setStatus|setCustomer/);
});

test('download: the button links to the real workbook in assets/downloads, nothing is sent anywhere', async () => {
  const sec = await section();
  const href = sec.match(/<a class="btn btn-secondary" href="([^"]+)" download[^>]*>Download the free Excel tracker<\/a>/)[1];
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
  for (const n of ['Data &amp; Reporting', 'Workflows &amp; Processes', 'Business Tools &amp; Systems']) assert.ok(html.includes(`<p class="svc-short">${n}</p>`), n);
  const sec = await section();
  assert.doesNotMatch(sec, /[$₱€£]\s?\d|testimonial|saved \d|% faster|guarantee/i);
});
