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

test('hero: one workspace, Today / With Rework Rescue toggle; Today shows the data issues of each stage and on each source file', async () => {
  const html = await page();
  const a = html.indexOf('<figure class="hero-preview hx'); const fig = html.slice(a, html.indexOf('</figure>', a));
  assert.match(fig, /<button type="button" class="hx-tg" data-ws-mode="today" aria-pressed="false">Today<\/button>/);
  assert.match(fig, /<button type="button" class="hx-tg" data-ws-mode="after" aria-pressed="true">With Rework Rescue<\/button>/);
  assert.match(fig, /What goes wrong today/);
  assert.match(fig, /Checked at every step/);
  for (const t of ['Job_Tracker_v3.xlsx', '3 versions', 'Re: Re: Job update?', 'Service request (form)', 'Completion records.pdf', 'Who&rsquo;s doing the Ridgeway job?', 'Weekly_Report_FINAL(2).xlsx', 'The result']) assert.ok(fig.includes(t), t);
  assert.deepEqual([...fig.matchAll(/<em class="hx-tag is-(red|amber)">([^<]+)<\/em>/g)].map((m) => [m[2], m[1]]), [
    ['Duplicates', 'red'], ['Not in the tracker', 'amber'], ['Missing record', 'red'], ['Manual check', 'amber'], ['No owner', 'red'], ['Manual rebuild', 'amber']]);
  assert.match(fig, /<div class="hx-today" aria-hidden="true">/, 'hidden state hidden from screen readers by default');
  assert.match(fig, /AI-assisted summary <small>Sample draft<\/small>/);
  assert.match(fig, /Reviewed by a person before sharing/);
  assert.match(fig, /In a project, an AI tool drafts the summary and a person checks it; here it&rsquo;s a sample written by simple rules\./);
  assert.doesNotMatch(fig, /\b42\b/, 'no figures from the reference images');
});

test('hero checks: every Today issue has a matching check in the same stage; states come from the records; exceptions stay visible', async () => {
  const html = await page();
  const a = html.indexOf('<figure class="hero-preview hx'); const fig = html.slice(a, html.indexOf('</figure>', a));
  const c = dataChecks(RECORDS);
  const steps = fig.split('<li class="hx-step ').slice(1);
  const names = { capture: 'svc-systems', move: 'svc-workflow', see: 'svc-data' };
  for (const [k, cls] of Object.entries(names)) {
    const step = steps.find((x) => x.startsWith(cls));
    const issues = [...step.matchAll(/<li class="is-(?:red|amber)">([^<]+)<\/li>/g)].map((m) => m[1].replace('&rsquo;', "'"));
    assert.ok(issues.length >= 3, `${k} shows its issues`);
    for (const i of issues) assert.ok(c[k].some((x) => x.answers.includes(i)), `${k}: "${i}" has a matching check`);
    assert.ok(step.includes(`data-ws-checks="${k}">${checksHtml(c[k])}</ul>`), `${k}: the page shows the computed checks`);
  }
  const all = Object.values(c).flat();
  const st = Object.fromEntries(all.map((x) => [x.label, [x.state, x.detail]]));
  assert.deepEqual(st['No duplicate jobs'], ['pass', 'None found']);
  assert.deepEqual(st['Job details complete'], ['flag', '11 of 12 complete · R-111']);
  assert.deepEqual(st['Every open job has an owner'], ['action', 'No owner · R-112']);
  assert.deepEqual(st['Follow-ups on time'], ['action', 'Overdue · R-104']);
  assert.ok(!('Completed, not invoiced' in st), 'invoice check removed (no invoice data in the sample)');
  assert.deepEqual(st['Totals add up'], ['pass', '7 done + 5 open = 12']);
  assert.deepEqual(st['Problems shown, not hidden'], ['flag', '3 on the report']);
  for (const s of ['pass', 'flag', 'action']) assert.ok(all.some((x) => x.state === s), `uses the ${s} state`);
  // Records that need attention are a subset of the open ones (not an extra category).
  const f = heroFigures(RECORDS);
  assert.ok(f.followUps.every((x) => RECORDS.find((r) => r.ref === x.ref).status !== 'Completed'));
  // Fix the records and the checks pass.
  const fixed = RECORDS.map((r) => ({ ...r, owner: r.ref === 'R-112' ? 'Ana' : r.owner, status: r.ref === 'R-104' ? 'Completed' : r.status, completed: r.ref === 'R-104' ? '2026-11-06' : r.completed, customer: r.ref === 'R-111' ? 'Harbor Works' : r.customer }));
  assert.ok(Object.values(dataChecks(fixed)).flat().every((x) => x.state === 'pass' || x.state === 'none'));
});

test('hero report: Northstar Services, 7 / 5 / 3, action items named by record, summary from the same figures', async () => {
  const html = await page();
  const a = html.indexOf('<figure class="hero-preview hx'); const fig = html.slice(a, html.indexOf('</figure>', a));
  const f = heroFigures(RECORDS);
  assert.equal(BUSINESS, 'Northstar Services');
  assert.deepEqual([f.total, f.completed, f.outstanding, f.attention], [12, 7, 5, 3]);
  for (const k of ['business', 'period', 'total', 'completed', 'outstanding', 'attention']) assert.match(fig, new RegExp(`data-ws="${k}">${f[k]}<`), k);
  const items = actionItems(f);
  assert.deepEqual(items.map((x) => [x.label, x.priority]), [['Follow up R-104 (overdue)', 'High'], ['Assign an owner to R-112', 'High'], ['Complete customer details for R-111', 'Medium']]);
  assert.ok(fig.includes(`<ul data-ws-actions>${actionsHtml(items)}</ul>`));
  assert.deepEqual(summaryBullets(f, items), ['7 of 12 jobs completed this week.', '5 still outstanding; 3 of these need attention.', 'Next: follow up R-104 and assign an owner to R-112.']);
  // KPI wording, and the 3 shown as part of the 5.
  assert.match(fig, /<strong data-ws="completed">7<\/strong>Completed this week<\/p>/);
  assert.match(fig, /<strong data-ws="outstanding">5<\/strong>Still outstanding<\/p>/);
  assert.match(fig, /<strong data-ws="attention">3<\/strong>Need attention <small>of the <span data-ws="outstanding">5<\/span> still outstanding<\/small>/);
  assert.ok(f.attention <= f.outstanding);
  assert.doesNotMatch(fig, /class="hx-head"/, 'no state label inside the panel; the toggle shows it');
  assert.ok(fig.includes(`<ul data-ws-summary>${summaryHtml(summaryBullets(f, items))}</ul>`));
  assert.match(fig, /Fictional sample data for Northstar Services \(2–6 November 2026\)\. Check results are worked out from that data\./);
});

test('hero motion: autoplay only on screen, Pause button, toggle stops it, reduced motion switches instantly', async () => {
  const c = await css();
  const block = c.slice(c.indexOf('/* ---- Hero workspace (11 Nov 2026, data checks)'));
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{ \.hx, \.hx \* \{ animation: none !important; transition: none !important; \} \}/);
  assert.doesNotMatch(block, /infinite/, 'no CSS loops');
  const js = await src('demo/hero.js');
  assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /document\.hidden/); assert.match(js, /IntersectionObserver/);
  assert.match(js, /Pause animation/); assert.match(js, /aria-pressed/); assert.match(js, /aria-hidden/);
  assert.doesNotMatch(js, /\.style\.[a-z]+\s*=/, 'CSP: CSSOM setProperty only');
});

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
  for (const t of ['Northstar Services, a fictional service business', 'customers, jobs and team names are fictional', 'no AI runs in it']) assert.ok(priv.includes(t), t);
  assert.doesNotMatch(priv, /live example|Weekly-Work-Tracker\.xlsx|Reset sample|change an owner or a status/, 'privacy page matches the page (12 Nov)');
});

test('How it works: four steps (ChatGPT, 15 Nov); the 30-day terms in a closed row; no invented results', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.equal((how.match(/<li><h3>/g) || []).length, 4, 'four steps');
  for (const t of ['30 days of fixes for anything that doesn&rsquo;t work as agreed.', "They don&#39;t cover new features, scope changes or changes to third-party services."]) assert.ok(how.includes(t), t);
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

