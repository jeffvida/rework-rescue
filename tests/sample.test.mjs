// Reconciliation tests for the work sample. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as DATA from '../src/sample/data.js';
import { runSample, parseDate, parseAmount } from '../src/sample/engine.js';

const r = runSample(DATA);

test('file row counts', () => {
  assert.deepEqual(r.files.map((f) => f.rows), [140, 118, 96]);
  assert.equal(r.totals.rows, 354);
});

test('every row is accounted for exactly once', () => {
  assert.equal(r.totals.passed + r.totals.review, r.totals.rows);
  assert.equal(r.totals.review, 12);
  assert.equal(r.totals.passed, 342);
  assert.equal(r.checks.reduce((n, c) => n + c.flagged, 0), r.exceptions.length);
});

test('exactly the planted exceptions, under the planned checks', () => {
  const got = Object.fromEntries(r.checks.map((c) => [c.id, r.exceptions.filter((e) => e.check === c.id).map((e) => e.record).sort()]));
  assert.deepEqual(got, {
    required: ['C-1077', 'J-5560', 'J-5571'],
    duplicates: ['C-1103', 'J-5548'],
    formats: ['INV-3419', 'J-5553'],
    crossfile: ['INV-3402', 'J-5544'],
    billing: ['J-5527', 'J-5531', 'J-5536'],
  });
});

test('report figures', () => {
  const p = r.report;
  assert.equal(p.jobs, 139);
  assert.equal(p.open, 19);
  assert.equal(p.overdue, 5);
  assert.equal(p.noOwner, 2);
  assert.deepEqual(p.dueToConfirm, ['J-5553']);
  assert.deepEqual(p.notInvoiced.sort(), ['J-5527', 'J-5531', 'J-5536']);
  assert.equal(Math.round(p.atRisk), 1640 + 1980 + 760);
  assert.deepEqual(p.heldAmounts, ['INV-3419']);
  assert.ok(p.followUps[0].action.includes('J-5527'));
});

test('the unmatched invoice points at the right job', () => {
  const x = r.exceptions.find((e) => e.record === 'INV-3402');
  assert.match(x.action, /J-5540/);
});

test('parsers', () => {
  assert.equal(parseDate('31/09/2026'), null);
  assert.deepEqual(parseDate('12/10/2026'), { iso: '2026-10-12', converted: true });
  assert.equal(parseAmount('1.250,00'), null);
  assert.deepEqual(parseAmount('1,640.00'), { value: 1640, converted: true });
});

test('tidied automatically, not flagged', () => {
  assert.deepEqual(r.tidy, { dates: 37, names: 9, amounts: 14 });
});

test('every exception offers a decision', () => {
  for (const e of r.exceptions) assert.equal(e.options.length, 2, e.record);
  assert.deepEqual(r.exceptions.find((e) => e.record === 'INV-3402').options, ['Link to J-5540', 'Investigate first']);
});

test('report summary sentence', () => {
  assert.equal(r.report.summary, 'This week: $4,380 not yet billed across 3 jobs, 5 jobs overdue and 2 with no owner. 12 data issues were flagged for review.');
});

test('hero card figures match the engine', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const card = html.slice(html.indexOf('class="hp-card"'), html.indexOf('</figure>'));
  const j = r.exceptions.find((e) => e.record === 'J-5527');
  for (const s of [`<b>${r.totals.review}</b>`, `<b>${r.report.overdue}</b>`, `<b>${r.report.noOwner}</b>`, '<b>$4,380</b>', '$1,640', '$2,310', ...r.report.notInvoiced]) assert.ok(card.includes(s), s);
  assert.ok(j.detail.includes('Kestrel Hardware') && card.includes('Kestrel Hardware'));
});

test('open jobs reconcile', () => {
  const o = r.report.openJobs;
  assert.equal(o.now, r.report.open);
  assert.equal(o.completedAll + o.now, o.inTracker);
  assert.equal(o.inTracker, r.report.jobs);
  assert.deepEqual([o.inTracker, o.completedAll], [139, 120]);
  assert.equal(o.startOfWeek + o.opened - o.completed, o.now);
  // start of week counted directly: received before the week and not completed before it
  const seen = new Set();
  const jobs = DATA.TRACKER.filter((j) => (seen.has(j.ref) ? false : seen.add(j.ref)));
  const direct = jobs.filter((j) => j.received < DATA.WEEK.start && (!j.completed || j.completed >= DATA.WEEK.start)).length;
  assert.equal(o.startOfWeek, direct);
  assert.deepEqual([o.startOfWeek, o.opened, o.completed, o.now], [25, 6, 12, 19]);
  assert.equal(o.ageing.reduce((n, b) => n + b.count, 0), o.now);
  assert.equal(o.byStatus.reduce((n, b) => n + b.count, 0), o.now);
  assert.equal(o.all.length, o.now);
  const attention = o.attention.map((a) => a.ref);
  assert.equal(attention.length, r.report.overdue + r.report.noOwner + r.report.dueToConfirm.length);
  assert.deepEqual(attention.slice(-3), ['J-5560', 'J-5571', 'J-5553']);
});

test('"In short" line matches the engine', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const block = html.slice(html.indexOf('id="example-1"'), html.indexOf('id="example-2"'));
  const line = block.slice(block.indexOf('class="ws-short"'), block.indexOf('</p>', block.indexOf('class="ws-short"')));
  for (const s of [`${r.totals.rows} rows checked`, `${r.totals.review} sent to a person`, '$4,380']) assert.ok(line.includes(s), s);
});
