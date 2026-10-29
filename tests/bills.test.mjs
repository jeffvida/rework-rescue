// Reconciliation tests for work sample 2. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as DATA from '../src/bills/data.js';
import { runBills, parseMoney } from '../src/bills/engine.js';

const r = runBills(DATA);
const near = (a, b) => Math.abs(a - b) < 0.005;

test('file row counts', () => {
  assert.deepEqual(r.files.map((f) => f.rows), [56, 53, 144]);
  assert.equal(r.totals.rows, 253);
});

test('every row is accounted for exactly once', () => {
  assert.equal(r.totals.passed + r.totals.review, r.totals.rows);
  assert.equal(r.totals.review, 8);
  assert.equal(r.checks.reduce((n, c) => n + c.flagged, 0), r.exceptions.length);
});

test('exactly the planted exceptions', () => {
  const got = Object.fromEntries(r.checks.map((c) => [c.id, r.exceptions.filter((e) => e.check === c.id).map((e) => e.issue).sort()]));
  assert.deepEqual(got, {
    complete: ['Bill not received', 'Bill not received'],
    duplicates: ['Duplicate bill'],
    match: ['No contract', 'Site closed'],
    price: ['Price above contract'],
    usage: ['Estimated reading', 'Usage spike'],
  });
  assert.deepEqual(r.exceptions.filter((e) => e.check === 'complete').map((e) => e.record), ['S03 Waste', 'S11 Internet']);
  assert.equal(r.exceptions.find((e) => e.issue === 'Usage spike').site, 'S07');
  assert.equal(r.exceptions.find((e) => e.issue === 'Estimated reading').site, 'S02');
  assert.equal(r.exceptions.find((e) => e.issue === 'Price above contract').site, 'S04');
  assert.equal(r.exceptions.find((e) => e.issue === 'Site closed').site, 'S09');
});

test('expected vs received reconciles', () => {
  const p = r.report;
  assert.equal(p.expected, 52);
  assert.equal(p.matched + p.missing, p.expected);
  assert.equal(p.received, 53);
  assert.equal(p.heldBills + p.passedBills, p.received);
  assert.equal(p.heldBills + p.missing, r.totals.review);
});

test('money reconciles', () => {
  const p = r.report;
  assert.ok(near(p.approve + p.onHold, p.total));
  assert.ok(near(p.categories.reduce((s, c) => s + c.amount, 0), p.total));
  assert.equal(p.categories.reduce((n, c) => n + c.bills, 0), p.received);
  assert.ok(p.summary.startsWith('This month: 53 bills received for 11 open sites.'));
});

test('every exception offers a decision', () => {
  for (const e of r.exceptions) assert.equal(e.options.length, 2, e.issue);
});

test('money parser', () => {
  assert.deepEqual(parseMoney('USD 1,234.50'), { value: 1234.5, converted: true });
  assert.deepEqual(parseMoney('79.00'), { value: 79, converted: false });
});

test('"In short" line matches the engine', async () => {
  const { readFile } = await import('node:fs/promises');
  const { money } = await import('../src/sample/engine.js');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const block = html.slice(html.indexOf('id="example-2"'));
  const line = block.slice(block.indexOf('class="ws-short"'), block.indexOf('</p>', block.indexOf('class="ws-short"')));
  const p = r.report;
  for (const s of [`${p.received} bills checked`, `${r.totals.review} items sent to a person`, money(p.notOwed), `${p.passedBills} bills (${money(p.approve)})`]) assert.ok(line.includes(s), s);
});
