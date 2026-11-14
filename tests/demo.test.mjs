// Tests for the hero illustration, the page around the main example and the three service samples (master brief,
// 10 Nov 2026). The main example itself, the Weekly Work & Follow-up Tracker, is tested in tests/tracker.test.mjs;
// the hero's figures now come from that tracker (src/tracker/engine.js). The service samples run on their own small
// datasets in src/samples.js. Numbered comments refer to the brief's acceptance criteria (18.1–18.31).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise, byStatus, receivedByDay } from '../src/tracker/engine.js';
import { RECORDS, PERIOD_LABEL, BUSINESS } from '../src/tracker/data.js';
import { heroFigures, actionItems, summaryBullets, dataChecks, checksHtml, actionsHtml, summaryHtml } from '../src/demo/hero.js';
import { refreshReport, REPORT_FILES, flow, FLOW_STEPS, CUSTOMERS, toolsOverview } from '../src/samples.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = () => readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
const src = (f) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');

// ---- Service samples (18.18–18.22)

test('18.18 Data & Reporting sample: three files, three layouts → one refreshed, checked report (flags kept, not removed)', () => {
  assert.deepEqual(REPORT_FILES.map((f) => f.cols.join('|')), ['Date|Customer|Status', 'created_on|client|state', 'Submitted|Name|Stage']);
  const r = refreshReport();
  assert.deepEqual([r.report.rows, r.report.completed, r.report.open, r.report.flagged, r.report.missingDate, r.report.duplicates], [11, 5, 6, 3, 1, 1]);
  assert.ok(r.rows.every((x) => ['Completed', 'Open'].includes(x.status)), 'statuses standardised');
  assert.ok(r.rows.filter((x) => x.date).every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date)), 'dates standardised');
  assert.equal(r.rows.length, 11, 'flagged rows are kept');
});

test('18.19 Workflows sample: received → assigned → in progress → completed, a simulated reminder, no skipping', () => {
  let s = { step: null, req: null, owner: '', reminded: false, log: [] };
  assert.equal(flow(s, 'start'), s);
  s = flow(s, 'submit', { type: 'Quote request', from: 'Bayview Co.' }); assert.equal(FLOW_STEPS[s.step], 'Received');
  assert.equal(flow(s, 'done'), s, 'can’t complete before it’s assigned and started');
  s = flow(s, 'assign', 'Ana'); assert.equal(FLOW_STEPS[s.step], 'Assigned');
  s = flow(s, 'remind'); assert.match(s.log.at(-1), /Reminder prepared for Ana: “R-501 is due Tue 10 Nov” \(simulated, nothing sent\)/);
  s = flow(flow(s, 'start'), 'done'); assert.equal(FLOW_STEPS[s.step], 'Completed');
  assert.equal(s.log.length, 5);
});

test('18.20 Business Tools sample: customers with related requests, records and tasks; a status update changes the overview', () => {
  assert.equal(CUSTOMERS.length, 5);
  for (const c of CUSTOMERS) assert.ok(c.requests.length && c.tasks.length, c.name);
  assert.deepEqual(toolsOverview({}), { customers: 5, open: 3, waiting: 1, done: 2 });
  assert.deepEqual(toolsOverview({ 'K-4': 'Done' }), { customers: 5, open: 2, waiting: 1, done: 3 });
});

// ---- The page

test('18.11 How it works (12 Nov): the reassurance line, the steps and the handover terms stay', async () => {
  const html = await page();
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /<h2 id="how-h">You keep the tools you know\. I improve the process around them\.<\/h2>/);
  assert.match(how, /<strong>What I need from you:<\/strong>[\s\S]*?No system logins to get started\./);
});

test('18.23–18.28 content audit: no old sales or jobs demo, no overclaiming, no platform pitch, privacy matches', async () => {
  const html = await page();
  const main = html.slice(html.indexOf('<main'), html.indexOf('id="services"'));
  assert.doesNotMatch(main, /W-10\d\d|INV-21|double entry|Weekly Management Report|weekly sales|S-10\d\d/i);
  assert.doesNotMatch(html, /100% accurate|detect(s)? every|all errors detected|fully automate everything|finds every problem/i);
  // The only mentions of subscriptions are the cost-transparency lines.
  assert.doesNotMatch(html.replace('Any additional software, subscriptions or implementation costs are discussed before the work begins.', '').replace('payment arrangements and any subscriptions you&#39;d need', '').replace('You create the accounts and handle any paid subscriptions.', ''), /subscription|sign up for (the|our) platform/i);
  const priv = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  for (const t of ['The animated workflow at the top of the homepage is a fictional illustration', 'Dana Cruz, the repair request, address and record number are made up.', 'It does not call an AI service, update a real tracker, send a message or connect to any business system.']) assert.ok(priv.includes(t), t);
  assert.doesNotMatch(priv, /workspace illustration|fixed rules from the sample/, 'privacy matches the 15 Nov hero');
  assert.doesNotMatch(priv, /live example|Weekly-Work-Tracker\.xlsx|Reset sample|change an owner or a status/, 'privacy page matches the page (12 Nov)');
});

test('How it works: four steps (ChatGPT, 15 Nov); the 30-day terms in a closed row; no invented results', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.equal((how.match(/<li><h3>/g) || []).length, 4, 'four steps');
  for (const t of ['30 days of post-handover fixes for issues within the agreed scope.', "They don&#39;t cover new features, scope changes or changes to third-party services."]) assert.ok(how.includes(t), t);
  assert.match(how, /<details class="fold how-30"><summary>What the 30 days cover<\/summary>/);
  assert.doesNotMatch(how, /usually takes|\d+\s?(hours|%|days to)/i, 'no invented results or implied track record');
});
test('availability on the page matches the booking calendar rules', async () => {
  const { RULES } = await import('../src/booking/slots.js');
  assert.deepEqual([RULES.days, RULES.start, RULES.end, RULES.hostOffsetHours], [[1, 2, 3, 4, 5], '08:00', '02:00', 8], 'if the booking hours change, update the availability lines');
  for (const f of ['../index.html', '../contact/index.html']) {
    const html = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.match(html, /Monday to Friday, 8&nbsp;am to 2&nbsp;am Philippine time \(UTC\+8\)/, f);
    assert.doesNotMatch(html, /teams worldwide|across time zones/, f);
  }
});

