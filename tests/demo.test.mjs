// Tests for the connected-workspace demo, the hero illustration and the three service samples (master brief,
// 10 Nov 2026). Every figure the hero, Data, Reports, Actions, Workflows and the workspace overview show comes from
// src/demo/engine.js working on src/demo/data.js; the service samples run on their own small datasets in src/samples.js.
// Numbered comments refer to the brief's acceptance criteria (18.1–18.31).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as DATA from '../src/demo/data.js';
import { REQUESTS, TASKS, TRANSACTIONS, SOURCES, STAFF } from '../src/demo/data.js';
import {
  initialState, sourceCounts, runChecks, checkList, consolidated, actions, openActions, decide, assign, setStatus, review, remind,
  submitRequest, stageOf, board, metrics, summary, overview, taskFor, toIso, toRef, dayOf, STAGES, ACTION_STATUSES, AI_LABEL,
} from '../src/demo/engine.js';
import { refreshReport, REPORT_FILES, flow, FLOW_STEPS, CUSTOMERS, toolsOverview } from '../src/samples.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = () => readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
const src = (f) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
const sample = (s) => submitRequest(s, { customer: 'Oakline Studio', type: 'Quote request', channel: 'Email' });

// ---- One shared dataset (18.11, 18.12)

test('three industry-neutral sources: Requests Register 12, Work Tracker 12, Records & Transactions 9; frozen originals', () => {
  assert.deepEqual(sourceCounts(), { requests: 12, tasks: 12, transactions: 9, total: 33, sources: 3 });
  assert.deepEqual(SOURCES.map((x) => x.name), ['Requests Register', 'Work Tracker', 'Records & Transactions']);
  for (const a of [REQUESTS, TASKS, TRANSACTIONS]) assert.ok(Object.isFrozen(a) && a.every(Object.isFrozen));
  assert.throws(() => { TASKS[0].owner = 'X'; });
  const text = JSON.stringify(DATA);
  assert.doesNotMatch(text, /\b(we|our|us)\b/i);
  assert.doesNotMatch(text, /sales|repair|technician|plumb|solar|meter|utility|facilit|maintenance|jobs?\b/i, 'no single industry');
  assert.doesNotMatch(text, /[$₱€£]/);
});

test('standardising: three date formats and two reference formats line up; originals untouched', () => {
  assert.equal(toIso('03/11/2026'), '2026-11-03'); assert.equal(toIso('2026-11-03'), '2026-11-03'); assert.equal(toIso('Tue 3 Nov'), '2026-11-03');
  assert.equal(toIso('Wed 3 Nov'), ''); assert.equal(toRef('R101'), 'R-101'); assert.equal(toRef('R-101'), 'R-101');
  assert.ok(TRANSACTIONS.every((t) => /^R\d+$/.test(t.request)), 'records keep their own reference format');
});

test('18.14 checks report only what the configured rules find in these records', () => {
  assert.deepEqual(runChecks(), { duplicates: [['R-104', 'R-109']], missing: ['R-111'], unmatched: ['TX-309'], badDates: [] });
  assert.deepEqual(checkList().map((c) => [c.label, c.ok]), [
    ['Loaded 12 requests, 12 tasks and 9 records from 3 sources', true],
    ['Dates standardised from 3 different formats', true],
    ['References matched: 8 of 9 records linked to a request', false],
    ['Required fields: 1 request with a blank customer', false],
    ['Possible duplicates: 1 pair to check', false],
  ]);
});

test('combined records: one row per request with its task and linked records; unknown values stay unknown', () => {
  const rows = consolidated();
  assert.equal(rows.length, 12);
  const r111 = rows.find((r) => r.ref === 'R-111');
  assert.deepEqual([r111.customer, r111.customerNote, r111.records], ['', 'unknown: needs confirming', ['TX-307']]);
  assert.deepEqual(rows.find((r) => r.ref === 'R-102').records, ['TX-302', 'TX-303']);
  assert.ok(!rows.some((r) => r.records.includes('TX-309')), 'the unmatched record is not attached to anything');
  for (const r of rows) assert.equal(r.task, TASKS.find((t) => t.request === r.ref).id);
});

// ---- Reports (18.13)

test('report figures are calculated from the combined records', () => {
  const m = metrics();
  assert.deepEqual([m.requests, m.duplicatePending, m.openRequests, m.completed, m.outstanding, m.overdue, m.unassigned, m.onTime, m.attention], [12, true, 6, 6, 6, 1, 1, 100, 5]);
  assert.deepEqual(m.byDay.map((d) => d.completed), [1, 2, 1, 1, 1]);
  assert.equal(m.completed, TASKS.filter((t) => t.status === 'Completed').length);
  for (const d of m.byDay) assert.equal(TASKS.filter((t) => t.completed && dayOf(t.completed) === d.day).length, d.completed, d.day);
  const phone = metrics(initialState(), { channel: 'Phone' });
  assert.equal(phone.requests, REQUESTS.filter((r) => r.channel === 'Phone').length);
  assert.equal(metrics().byChannel.reduce((t, c) => t + c.count, 0), 12);
});

// ---- Actions and decisions (18.13, 18.16)

test('actions: five items, each with source, suggested next step, suggested responsibility and a practical status', () => {
  const a = actions();
  assert.deepEqual(a.map((x) => [x.id, x.title, x.status]), [
    ['duplicate', 'Possible duplicate request', 'Needs checking'], ['missing', 'Request with no customer', 'Needs checking'],
    ['unmatched', 'Record with no matching request', 'Needs checking'], ['T-206', 'Overdue task', 'In progress'], ['T-210', 'Task with no owner', 'Needs checking'],
  ]);
  for (const x of a) { assert.ok(x.next && x.team && x.source && x.refs.length, x.id); assert.ok(ACTION_STATUSES.includes(x.status)); }
  const ids = new Set([...REQUESTS, ...TASKS, ...TRANSACTIONS].map((r) => r.id));
  for (const ref of a.flatMap((x) => x.refs)) assert.ok(ids.has(ref), ref);
});

test('decisions change the shared figures: duplicate counted once, customer filled from its record, record linked', () => {
  const s = decide(initialState(), 'duplicate', 'same');
  assert.deepEqual([metrics(s).requests, metrics(s).duplicatePending, consolidated(s).length], [11, false, 12]);
  assert.ok(consolidated(s).find((r) => r.ref === 'R-109').excluded);
  assert.ok(!board(s).flatMap((c) => c.items).some((r) => r.ref === 'R-109'));
  assert.equal(metrics(decide(initialState(), 'duplicate', 'separate')).requests, 12);
  const f = decide(initialState(), 'missing', 'fill');
  assert.deepEqual([consolidated(f).find((r) => r.ref === 'R-111').customer, REQUESTS.find((r) => r.id === 'R-111').customer], ['Harbour & Co.', '']);
  assert.equal(actions(decide(initialState(), 'missing', 'unknown')).find((x) => x.id === 'missing').status, 'Waiting for follow-up');
  const l = decide(initialState(), 'unmatched', 'link');
  assert.deepEqual(consolidated(l).find((r) => r.ref === 'R-107').records, ['TX-306', 'TX-308', 'TX-309']);
  assert.equal(TRANSACTIONS.find((t) => t.id === 'TX-309').request, 'R115', 'the original record is unchanged');
});

test('task actions: an owner first; status changes update every view; reminders are simulated and logged', () => {
  const s0 = initialState();
  assert.equal(setStatus(s0, 'T-210', 'In progress'), s0, 'nobody owns it yet');
  assert.equal(assign(s0, 'T-210', 'Zed'), s0);
  const a = assign(s0, 'T-210', 'Ana');
  assert.deepEqual([taskFor(a, 'R-110').owner, actions(a).find((x) => x.id === 'T-210').status, metrics(a).unassigned], ['Ana', 'Assigned', 0]);
  const done = setStatus(setStatus(a, 'T-210', 'In progress'), 'T-210', 'Completed');
  const m = metrics(done);
  assert.deepEqual([m.completed, m.openRequests, m.byDay.at(-1).completed, actions(done).find((x) => x.id === 'T-210').status], [7, 5, 2, 'Completed']);
  assert.equal(TASKS.find((t) => t.id === 'T-210').status, 'Not started');
  const r = remind(s0, 'T-206');
  assert.equal(actions(r).find((x) => x.id === 'T-206').status, 'Waiting for follow-up');
  assert.match(r.log.at(-1).text, /Reminder prepared for Ben about T-206 \(simulated: nothing was sent\)/);
  assert.equal(remind(r, 'T-206'), r, 'one reminder');
  assert.equal(remind(s0, 'T-210'), s0, 'no reminder without an owner');
});

// ---- Workflows (18.15)

test('a sample request enters the register, creates a task, and appears in Data, Reports, Actions and Workflows', () => {
  const s = sample(initialState());
  assert.deepEqual(s.added.map((a) => [a.request.id, a.task.id, a.task.due, a.task.owner]), [['R-113', 'T-213', '2026-11-10', '']]);
  assert.ok(consolidated(s).some((r) => r.ref === 'R-113' && r.added));
  assert.deepEqual([metrics(s).requests, metrics(s).openRequests, sourceCounts(s).total], [13, 7, 35]);
  assert.deepEqual(actions(s).find((x) => x.id === 'T-213').title, 'New request to review');
  assert.ok(board(s).find((c) => c.stage === 'Request received').items.some((r) => r.ref === 'R-113'));
  assert.equal(REQUESTS.length, 12, 'the original register is untouched');
  assert.equal(submitRequest(initialState(), { customer: '', type: 'Quote request', channel: 'Email' }).added.length, 0);
  assert.equal(submitRequest(initialState(), { customer: 'X', type: 'Nonsense', channel: 'Email' }).added.length, 0);
  let many = initialState(); for (let i = 0; i < 7; i++) many = sample(many);
  assert.equal(many.added.length, 5, 'limited to five sample requests');
});

test('request to completion: received → reviewed → assigned → in progress → completed', () => {
  let s = sample(initialState()); const t = () => taskFor(s, 'R-113');
  const seen = [stageOf(t())];
  s = review(s, 'T-213'); seen.push(stageOf(t()));
  s = assign(s, 'T-213', 'Carla'); seen.push(stageOf(t()));
  s = setStatus(s, 'T-213', 'In progress'); seen.push(stageOf(t()));
  s = setStatus(s, 'T-213', 'Completed'); seen.push(stageOf(t()));
  assert.deepEqual(seen, STAGES);
  assert.deepEqual([metrics(s).requests, metrics(s).completed, metrics(s).openRequests], [13, 7, 6]);
});

test('18.12 the same records across views: Data, Reports, Workflows and the overview agree on every path', () => {
  const paths = [initialState(), decide(initialState(), 'duplicate', 'same'), sample(decide(initialState(), 'duplicate', 'same')), setStatus(assign(initialState(), 'T-210', 'Ben'), 'T-210', 'In progress')];
  for (const s of paths) {
    const rows = consolidated(s).filter((r) => !r.excluded);
    const onBoard = board(s).flatMap((c) => c.items.map((r) => r.ref)).sort();
    assert.deepEqual(onBoard, rows.map((r) => r.ref).sort());
    const m = metrics(s); const o = overview(s);
    assert.deepEqual([o.requests, o.openRequests, o.attention], [m.requests, m.openRequests, openActions(s).length]);
    assert.equal(board(s).find((c) => c.stage === 'Completed').items.length, rows.filter((r) => r.status === 'Completed').length);
  }
});

test('the log only grows and is frozen; refused actions add nothing; reset is the original state', () => {
  let s = initialState(); const steps = [s];
  for (const f of [(x) => decide(x, 'duplicate', 'same'), (x) => assign(x, 'T-210', 'Ana'), (x) => remind(x, 'T-206'), sample]) { s = f(s); steps.push(s); }
  for (let i = 1; i < steps.length; i++) { steps[i - 1].log.forEach((e, k) => assert.equal(steps[i].log[k], e)); assert.equal(steps[i].log.length, steps[i - 1].log.length + 1); }
  assert.ok(Object.isFrozen(s.log) && s.log.every(Object.isFrozen));
  const s0 = initialState();
  for (const x of [decide(s0, 'duplicate', 'nope'), assign(s0, 'T-999', 'Ana'), setStatus(s0, 'T-201', 'Completed'), review(s0, 'T-201')]) assert.equal(x, s0);
  assert.deepEqual(initialState(), s0);
});

test('AI-drafted summary: labelled as simulated, built from the figures, says what is unknown, no overclaiming', () => {
  assert.equal(AI_LABEL, 'AI-drafted · simulated in this demo');
  const s0 = summary();
  assert.match(s0[0], /^12 requests \(one may be a duplicate\) came in this week\. 6 tasks were completed, 100% of them on time, and 6 are still open\./);
  assert.ok(s0.some((l) => /who it’s for is unknown until someone confirms it/.test(l)));
  const s1 = summary(decide(decide(decide(initialState(), 'duplicate', 'same'), 'missing', 'fill'), 'unmatched', 'link'));
  assert.ok(!s1.some((l) => /unknown|couldn’t be matched/.test(l)));
  assert.match(s1[0], /^11 requests came in this week/);
  assert.doesNotMatch([...s0, ...s1].join(' '), /every|all errors|100% accurate|guarantee|definitely/i);
});

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

test('18.6–18.7 hero copy: eyebrow, headline, exact supporting text and reassurance, two CTAs, intro, booking info', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<figure'));
  assert.match(hero, /<p class="eyebrow hero-pill">Less rework\. More real work\.<\/p>/);
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\.<\/span>/);
  assert.match(hero, /<p class="hero-sub">I turn scattered business data and repetitive tasks into connected workflows, reliable reports and practical business tools\.<\/p>/);
  assert.match(hero, /<p class="hero-assure">Built around the tools you already use\. Designed around how your business works\.<\/p>/);
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('See how it works'));
  assert.match(hero, /href="#samples" data-demo-check>See how it works/);
  assert.match(hero, /Free &middot; No obligation/);
  assert.match(html, /Jeff Herson Vida<\/a><span class="cred-role">8\+ years in data operations, reporting and process improvement\.<\/span><span class="cred-role">Work directly with me, from understanding the problem to building the solution\.<\/span>/);
});

test('18.8–18.9 hero visual: three sources into one workspace with data, report, workflow, actions and insight, from the engine', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('<figure class="hero-preview hw'), html.indexOf('</figure>', html.indexOf('<figure class="hero-preview hw')));
  assert.deepEqual([...fig.matchAll(/<li class="hw-src">.*?<strong>([^<]+)<\/strong>/g)].map((m) => m[1]), ['Spreadsheet files', 'Business records', 'Requests &amp; tasks']);
  assert.deepEqual([...fig.matchAll(/<section class="hw-panel hw-(\w+)">/g)].map((m) => m[1]), ['data', 'report', 'flow', 'actions', 'ai']);
  const o = overview(); const val = (k) => Number(fig.match(new RegExp(`data-hw="${k}">(\\d+)<`))[1]);
  assert.deepEqual(['records', 'requests', 'openRequests', 'completed', 'attention'].map(val), [o.records, o.requests, o.openRequests, o.completed, o.attention]);
  for (const c of board()) assert.equal(Number(fig.match(new RegExp(`data-hw-stage="${c.stage}">(\\d+)<`))[1]), c.items.length, c.stage);
  assert.deepEqual([...fig.matchAll(/data-hw-day="(\w+)" data-v="(\d)"/g)].map((m) => [m[1], Number(m[2])]), metrics().byDay.map((d) => [d.day, d.completed]));
  assert.match(fig, /Illustration/); assert.match(fig, /An illustration of what I could build around your tools\. Fictional data\./);
  assert.doesNotMatch(fig, /\sstyle="/); assert.doesNotMatch(fig, /sales|jobs?\b|invoice tracker/i);
});

test('18.10 hero motion: ordered ~4.5 s timeline, played once, reduced motion shows the finished picture', async () => {
  const c = await css(); const block = c.slice(c.indexOf('/* ---- Hero: connected workspace illustration'), c.indexOf('/* ---- Main demo: connected workspace'));
  const at = (sel) => { const m = block.match(new RegExp(`\\.hw-play ${sel.replace(/[.]/g, '\\.')}[^{]*\\{ animation(?:-delay: ([\\d.]+)s;|:[^;]* ([\\d.]+)s both;)`)); return Number(m[1] ?? m[2]); };
  const order = [at('.hw-lines'), at('.hw-app'), at('.hw-data'), at('.hw-ok'), at('.hw-report'), at('.hw-flow'), at('.hw-actions'), at('.hw-ai')];
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `sources → lines → workspace → data → checks → report → workflow → actions → insight: ${order}`);
  let end = 0;
  for (const m of block.matchAll(/\.hw-play [^{]*\{[^}]*animation(?:-delay)?:([^;}]+)/g)) for (const part of m[1].split(',')) { const t = [...part.matchAll(/([\d.]+)s/g)].map((x) => Number(x[1])); if (t.length) end = Math.max(end, t.reduce((x, y) => x + y, 0)); }
  assert.ok(end >= 4 && end <= 5, `ends at ${end}s`);
  assert.doesNotMatch(block, /infinite/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{ \.hw-wait \.hw-sources, \.hw-wait \.hw-lines, \.hw-wait \.hw-app \{ opacity: 1; \} \.hw-play, \.hw-play \* \{ animation: none !important; \} \}/);
  const js = await src('demo/hero.js'); assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /io\.disconnect\(\)/);
});

test('18.4–18.5, 18.11, 18.17 main demo: heading, intro, illustrative label, four connected views, workspace overview, reset', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="samples"'), html.indexOf('id="experience"'));
  assert.match(sec, /<h2 id="samples-h">A more connected way to work\.<\/h2>/);
  assert.match(sec, /See how scattered information can become organised data, useful reports and workflows that keep work moving\./);
  assert.match(sec, /Bring your information together\. Make sense of the numbers\. Keep work moving\./);
  assert.match(sec, /Illustrative demonstration using fictional business data\./);
  assert.match(sec, /around your existing tools, such as Excel, Power Query and simple automations, not a product you&rsquo;d have to buy/);
  const ui = await src('demo/ui.js');
  assert.match(ui, /\['data', 'Data'[\s\S]*\['reports', 'Reports'[\s\S]*\['actions', 'Actions'[\s\S]*\['workflows', 'Workflows'/);
  for (const t of ['cw-over', 'Reset the demo', 'Submit a sample request', 'Checks found items that may need attention.', 'Management summary', 'Send a reminder', 'nothing is sent']) assert.ok(ui.includes(t), t);
  const fb = sec.slice(sec.indexOf('class="demo-static"'));
  for (const t of ['Requests Register (12 requests)', 'Work Tracker (12 tasks)', 'Records &amp; Transactions (9 records)', 'R-104 / R-109', 'R-111', 'TX-309', '12 requests this week, 6 still open', 'T-206', 'T-210']) assert.ok(fb.includes(t), t);
});

test('18.2, 18.21–18.22 services: names kept, the brief’s descriptions, how they connect, three distinct samples', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="services"'), html.indexOf('id="how"'));
  assert.deepEqual([...sec.matchAll(/<h3>([^<]+)<\/h3>\s*<p class="svc-short">/g)].map((m) => m[1]), ['Data &amp; Reporting', 'Workflows &amp; Processes', 'Business Tools &amp; Systems']);
  for (const t of ['Turn scattered spreadsheets and repetitive reporting tasks into organised, reliable reports that are easier to update and maintain.', 'Make everyday work easier to manage by improving handoffs, responsibilities and follow-ups.', 'Bring disconnected information and everyday processes into practical business tools that make work easier to manage.',
    'makes information easier to combine, check, update and report.', 'makes work easier to assign, track and follow up.', 'brings related information and processes together into a usable solution.']) assert.ok(sec.includes(t), t);
  assert.deepEqual([...sec.matchAll(/data-mini="(\w+)">\s*<p class="mini-t">([^<]+)<\/p>/g)].map((m) => [m[1], m[2]]), [
    ['report', 'From scattered files to one reliable report.'], ['workflow', 'From missed requests to clear next steps.'], ['tools', 'From disconnected files to one useful workspace.']]);
  assert.doesNotMatch(html, /KPI &amp; Operations Reporting|Reporting &amp; Data Automation|Workflow Improvements/);
  const js = await src('samples.js'); assert.match(js, /mountReport[\s\S]*mountWorkflow[\s\S]*mountTools/);
});

test('18.11 How I work: the reassurance line, the steps and the handover terms stay', async () => {
  const html = await page();
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /<p class="how-assure">You keep using the tools you already know\. I improve the process around them\.<\/p>/);
  assert.match(how, /written scope, price and estimated timeline before anything starts/);
});

test('18.23–18.28 content audit: no old sales or jobs demo, no overclaiming, no platform pitch, privacy matches', async () => {
  const html = await page();
  const main = html.slice(html.indexOf('<main'), html.indexOf('id="experience"'));
  assert.doesNotMatch(main, /W-10\d\d|INV-21|double entry|Weekly Management Report|weekly sales|S-10\d\d/i);
  assert.doesNotMatch(html, /100% accurate|detect(s)? every|all errors detected|fully automate everything|finds every problem/i);
  assert.doesNotMatch(html, /subscription|sign up for (the|our) platform/i);
  const priv = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  for (const t of ['A more connected way to work', 'requests, tasks, records and staff names are fictional', 'Reset the demo', 'no AI runs on this page']) assert.ok(priv.includes(t), t);
  assert.equal((await page()).match(/<span class="dw-status" data-week>([^<]*)</)[1], DATA.WEEK);
});

test('problem cards: three, in the customer’s words, each opening its service', async () => {
  const html = await page();
  const fit = html.slice(html.indexOf('id="fit"'), html.indexOf('id="samples"'));
  const cards = [...fit.matchAll(/<a href="#(svc-\w+)" data-svc-go="(\d)"><strong>([^<]+)<\/strong>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(cards, [
    ['svc-data', '0', '&ldquo;I&rsquo;m always rebuilding reports.&rdquo;'],
    ['svc-workflow', '1', '&ldquo;I&rsquo;m always chasing updates.&rdquo;'],
    ['svc-systems', '2', '&ldquo;Everything is scattered.&rdquo;'],
  ]);
});


test('page: experience sits right after the live example, marked as previous professional experience', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const order = ['id="samples"', 'id="experience"', 'id="services"', 'id="how"', 'id="about"', 'id="faq"', 'id="start"'].map((x) => html.indexOf(x));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const exp = html.slice(order[1], order[2]);
  for (const t of ['Utility Billing &amp; Data Validation', 'Operational Reporting &amp; Analysis', 'Solar &amp; Energy Performance Analysis', 'Previous professional experience', 'not Rework Rescue client projects']) assert.ok(exp.includes(t), t);
  assert.match(html, /Based in the Philippines\. Available for calls Monday to Friday/);
});

test('page: no prices, testimonials or client results; service names kept; services kept short', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const visible = html.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '');
  assert.doesNotMatch(visible, /[$₱€£]\s?\d|\bPHP\s?\d|\bUSD\b|per hour|\/hr\b|testimonial|what (my )?clients say/i);
  for (const n of ['Data &amp; Reporting', 'Workflows &amp; Processes', 'Business Tools &amp; Systems']) assert.ok(html.includes(`<h3>${n}</h3>`), n);
  // Services stay short: the problem line per service, no separate symptom lists.
  assert.doesNotMatch(html, /svc-familiar|Does this sound familiar\?/);
  // Middle option (9 Nov): CRM, websites and booking pages stay, framed as support for records and reporting.
  assert.match(html, /Customer and enquiry tracking that feeds your reports/);
  assert.match(html, /Simple pages connected to your forms and records/);
  assert.match(html, /Booking and request pages connected to your records/);
  assert.doesNotMatch(html, /Better data\. Simpler workflows\./);
  assert.match(html, /I don&#39;t automate consequential decisions about people\./);
  assert.match(html, /30 days of fixes for issues where the solution does not work as agreed\./);
});

test('booking after the demo: one strip with the first-project line, using the existing pop-up link', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('id="samples"'), html.indexOf('id="experience"'));
  const after = sec.slice(sec.indexOf('class="demo-after"'));
  assert.ok(sec.indexOf('class="demo-after"') > sec.indexOf('class="demo-window"'), 'after the demo window');
  assert.match(after, /Most projects start with one report or recurring process\. Once that&rsquo;s working, we can look at what&rsquo;s next\./);
  assert.match(after, /href="contact\/#contact-form-area">Book a free rework review</);
  assert.doesNotMatch(after, /weeks|days|[$₱]/i, 'no timeframe or price');
});

test('How I work shows an example first project, labelled as an illustration, with the handover terms', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.match(how, /Example first project &middot; illustration/);
  assert.match(how, /not a client result/);
  for (const t of ['Ownership of the delivered work', '30 days of fixes for issues where the solution does not work as agreed.', "They don&#39;t cover new features, scope changes or changes to third-party services."]) assert.ok(how.includes(t), t);
  assert.doesNotMatch(how, /\d+\s?(hours|%|weeks|days to)/i, 'no invented results or timelines');
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

