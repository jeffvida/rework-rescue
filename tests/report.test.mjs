// Self-checking weekly report demo (build #2, 21 Nov 2026): a replay of the real n8n run on fictional data.
// The numbers must match the workflow's answer key for 16–22 Nov 2026, and the page must never call n8n.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RP_FIGURES, RP_ITEMS, RP_MARKED, rpStatuses, rpOwnerCounts, rpEmailHtml } from '../src/report-demo.js';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');

test('figures match the workflow answer key', () => {
  const f = RP_FIGURES;
  assert.deepEqual([f.enquiries, f.jobsDone, f.jobsValue, f.invoiced, f.collected, f.notInvoiced, f.overdue, f.held], [12, 5, 2390, 1790, 1600, 640, 420, 2]);
  assert.equal(f.toFollowUp, f.notInvoiced + f.overdue);
  assert.equal(RP_ITEMS.length, 12);
  assert.deepEqual(RP_ITEMS.slice(0, 3).map((i) => i.ref), ['E-1039', 'J-504', 'INV-2200'], 'urgent customer, then money');
  assert.deepEqual(rpOwnerCounts(), { Manager: 7, Scheduling: 4, Sales: 1 });
  assert.equal(new Set(RP_ITEMS.map((i) => i.ref)).size, 12, 'no duplicate items');
});

test('the next check confirms real fixes and catches items marked done too early', () => {
  const before = rpStatuses(false), after = rpStatuses(true);
  const st = (a, r) => a.find((x) => x.ref === r);
  assert.equal(st(before, 'J-504').status, 'Done');
  assert.equal(st(before, 'INV-2200').status, 'Done');
  assert.ok(st(after, 'J-504').confirmed);
  assert.equal(st(after, 'INV-2200').status, 'Still found');
  assert.equal(after.filter((x) => x.status === 'Open').length, 10, 'the rest stay open');
  assert.deepEqual(Object.keys(RP_MARKED).sort(), ['INV-2200', 'J-504']);
});

test('the email shows the money first and says the AI text is checked', () => {
  const h = rpEmailHtml();
  assert.match(h, /weekly: \$1,060 to follow up, 12 to action/);
  assert.match(h, /AI-written, numbers checked/);
  assert.match(h, /1\. Call today<\/b>: Dan Wu/);
  assert.match(h, /Also needs action \(9\)/);
});

test('page: fourth card opens a dialog that opens on the result, with two tabs and no calls to n8n', async () => {
  const h = await read('../index.html');
  const sec = h.slice(h.indexOf('id="built"'), h.indexOf('id="how"'));
  assert.match(sec, /<h3 class="built-group-h" id="site-h">More I&rsquo;ve built<\/h3>\s*<ul class="built-cards built-cards-3">\s*<li class="built-card built-card-ai built-card-mini" id="demo-report">/, '24 Nov: a supporting example after Carla\'s story');
  assert.match(sec, /<h4>The self-checking weekly report<\/h4>/);
  assert.match(sec, /<p class="built-try" data-rp-only hidden><a href="#report-demo" data-rp-open aria-haspopup="dialog">Try it: see what it found/);
  const d = sec.slice(sec.indexOf('<dialog class="cs eq-dlg rp-dlg" id="report-demo"'), sec.indexOf('</dialog>', sec.indexOf('id="report-demo"')));
  assert.ok(d.length > 100);
  assert.ok(d.indexOf('rp-found') < d.indexOf('role="tablist"'), 'money found comes before anything else');
  assert.equal((d.match(/role="tab"/g) || []).length, 2);
  assert.ok(d.indexOf('rp-auto') < d.indexOf('role="tablist"'), 'what runs by itself is shown before the tabs');
  assert.match(d, /Runs by itself\. Nobody presses a button\./);
  assert.match(sec, /<p class="built-k">AI \+ automation<\/p><p class="built-status">Demo &middot; fictional business<\/p><\/div>\s*<h4>The self-checking weekly report/);
  assert.match(d, /id="rp-t1" aria-controls="rp-p1" aria-selected="true">Monday report/);
  assert.match(d, /<summary>How it checks<\/summary>/);
  assert.match(d, /Works with Google Sheets, Excel, or exports from your job and accounting apps\./);
  assert.match(d, /Replayed from a real test run with fictional data\. Nothing is sent\./);
  const js = await read('../src/report-demo.js');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|SITE\./, 'replay only: never calls the workflow');
});
