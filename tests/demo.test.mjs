// Tests for the hero illustration, the page around the main example and the three service samples (master brief,
// 10 Nov 2026). The main example itself, the Weekly Work & Follow-up Tracker, is tested in tests/tracker.test.mjs;
// the hero's figures now come from that tracker (src/tracker/engine.js). The service samples run on their own small
// datasets in src/samples.js. Numbered comments refer to the brief's acceptance criteria (18.1–18.31).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarise, byStatus, receivedByDay, heroInsight } from '../src/tracker/engine.js';
import { SHORT } from '../src/demo/hero.js';
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

test('hero on tablets and phones: the reassurance line stays right after the supporting text', async () => {
  const c = await css();
  assert.match(c, /\.hero-copy > \.hero-sub, \.hero-copy > \.hero-assure \{ order: 4; \}/);
});

test('18.8–18.9 hero visual: three sources into one workspace with data, report, workflow, actions and insight, from the engine', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('<figure class="hero-preview hw'), html.indexOf('</figure>', html.indexOf('<figure class="hero-preview hw')));
  assert.deepEqual([...fig.matchAll(/<li class="hw-src">.*?<strong>([^<]+)<\/strong>/g)].map((m) => m[1]), ['Spreadsheet files', 'Business records', 'Requests &amp; tasks']);
  assert.deepEqual([...fig.matchAll(/<section class="hw-panel hw-(\w+)">/g)].map((m) => m[1]), ['data', 'report', 'flow', 'actions', 'ai']);
  const o = summarise(); const val = (k) => Number(fig.match(new RegExp(`data-hw="${k}">(\\d+)<`))[1]);
  assert.deepEqual(['records', 'requests', 'openRequests', 'completed', 'attention'].map(val), [o.total, o.total, o.outstanding, o.completed, o.attention]);
  for (const c of byStatus()) assert.equal(Number(fig.match(new RegExp(`data-hw-stage="${c.status}">(\\d+)<`))[1]), c.count, c.status);
  assert.deepEqual([...fig.matchAll(/data-hw-day="(\w+)" data-v="(\d)"/g)].map((m) => [m[1], Number(m[2])]), receivedByDay().map((d) => [d.day, d.received]));
  assert.deepEqual([...fig.matchAll(/<li>([^<]+) <em>([^<]+)<\/em><\/li>/g)].map((m) => [m[1], m[2]]), o.followUps.map((f) => [f.title, SHORT[f.keys[0]]]));
  assert.match(fig, new RegExp(`data-hw-insight>${heroInsight().replace(/[.]/g, '\\.')}<`));
  assert.deepEqual([...fig.matchAll(/data-hw-row="(R-\d+)"><span>R-\d+<\/span><span>([^<]+)<\/span><span class="(hw-ok|hw-flag)">/g)].map((m) => [m[1], m[2], m[3]]),
    [['R-101', 'Northfield Services', 'hw-ok'], ['R-104', 'Harbor Works', 'hw-flag'], ['R-111', 'No customer', 'hw-flag']]);
  assert.match(fig, /Illustration/); assert.match(fig, /An illustration of what I could build around your tools\. Fictional data\./);
  assert.doesNotMatch(fig, /\sstyle="/); assert.doesNotMatch(fig, /sales|jobs?\b|invoice tracker/i);
});

test('18.10 hero motion: ordered ~4.5 s timeline, played once, reduced motion shows the finished picture', async () => {
  const c = await css(); const block = c.slice(c.indexOf('/* ---- Hero: connected workspace illustration'), c.indexOf('/* ---- Services: how they connect'));
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

test('services (10 Nov): one connected solution, Capture -> Move -> See, checks across all three, no choosing', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="services"'), html.indexOf('id="how"'));
  assert.match(sec, /<h2 id="services-h">One connected solution\. Three parts that work together\.<\/h2>/);
  assert.match(sec, /You don&rsquo;t need to choose a service\. We&rsquo;ll start with the part that&rsquo;s costing your business the most time and build from there\./);
  // Order: Capture, Move, See, with the three service names kept.
  assert.deepEqual([...sec.matchAll(/<span class="svc-layer-n">(\d\d)<\/span> (\w+)<\/p>\s*<h3>([^<]+)<\/h3>/g)].map((m) => [m[1], m[2], m[3]]), [
    ['01', 'Capture', 'Business Tools &amp; Systems'], ['02', 'Move', 'Workflows &amp; Processes'], ['03', 'See', 'Data &amp; Reporting']]);
  assert.deepEqual([...sec.matchAll(/<p class="svc-short">([^<]+)<\/p>/g)].map((m) => m[1]), ['Fix the tools.', 'Fix the steps.', 'Fix the numbers.']);
  // Data & Reporting keeps the most visual weight.
  assert.match(sec, /class="svc-layer svc-data svc-layer-core" id="svc-data"/);
  assert.match(sec, /Most projects start here/);
  // Checks band across all three, in the softer wording (no promise that everything checks itself).
  assert.match(sec, /Automation is only useful when the information behind it can be trusted\./);
  assert.match(sec, /Built with data checks and clear exceptions, so problems are easier to catch before they affect your reports and workflows\./);
  assert.doesNotMatch(html, /checks its own data|every workflow I build/i);
  // Nothing that asks the visitor to pick a service; no per-service mini-demos.
  assert.doesNotMatch(html, /on its own or combined|Not sure where your problem fits|data-mini=|svc-try|data-svc-go/);
  const home = await src('home.js'); assert.doesNotMatch(home, /mountServices|mountSamples/);
  assert.match(sec, /Google Apps Script/);
  assert.doesNotMatch(html, /KPI &amp; Operations Reporting|Reporting &amp; Data Automation|Workflow Improvements/);
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
  for (const t of ['A clearer way to manage the work', 'customers, requests, tasks and team names are fictional', 'Reset sample', 'no AI runs on this page', 'Rework-Rescue-Weekly-Work-Tracker.xlsx']) assert.ok(priv.includes(t), t);
});

test('problem cards: three, in the customer’s words, each pointing to its layer of the one solution', async () => {
  const html = await page();
  const fit = html.slice(html.indexOf('id="fit"'), html.indexOf('id="samples"'));
  const cards = [...fit.matchAll(/<a href="#(svc-\w+)"><strong>([^<]+)<\/strong>[\s\S]*?<em>([^<]+)</g)].map((m) => [m[1], m[2], m[3].trim()]);
  assert.deepEqual(cards, [
    ['svc-data', '&ldquo;I&rsquo;m always rebuilding reports.&rdquo;', 'See &middot; Data &amp; Reporting'],
    ['svc-workflow', '&ldquo;I&rsquo;m always chasing updates.&rdquo;', 'Move &middot; Workflows &amp; Processes'],
    ['svc-systems', '&ldquo;Everything is scattered.&rdquo;', 'Capture &middot; Business Tools &amp; Systems'],
  ]);
  assert.match(fit, /Most weeks it&rsquo;s all three at once, <a href="#services">and that&rsquo;s how I fix them<\/a>\./);
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
  assert.match(html, /Simple CRM and customer records/);
  assert.match(html, /Forms, booking and request pages/);
  assert.match(html, /Trackers, job registers and operational workbooks/);
  assert.match(html, /Simple pages connected to your records/);
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

test('the example first project sits right after the services diagram, labelled as an illustration, growth optional', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('id="services"'), html.indexOf('id="how"'));
  const ex = sec.slice(sec.indexOf('class="example-project"'), sec.indexOf('class="svc-foot"'));
  assert.ok(sec.indexOf('class="svc-checks"') < sec.indexOf('class="example-project"'), 'after the diagram and checks');
  assert.match(ex, /Where most projects start &middot; illustration/);
  assert.match(ex, /not a client result/);
  assert.match(ex, /each step is scoped and agreed separately, and stopping at the report is fine\./);
  for (const t of ['Ownership of the delivered work', '30 days of fixes for issues where the solution does not work as agreed.', "They don&#39;t cover new features, scope changes or changes to third-party services."]) assert.ok(ex.includes(t), t);
  assert.doesNotMatch(ex, /\d+\s?(hours|%|weeks|days to)/i, 'no invented results or timelines');
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.doesNotMatch(how, /example-project/);
  assert.equal((how.match(/<li><h3>/g) || []).length, 4, 'How I work keeps its four steps');
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

