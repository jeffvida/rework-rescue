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

test('hero copy (mockup v3): eyebrow, headline unchanged with accent, supporting copy, two CTAs, chips, credibility', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<figure'));
  assert.match(hero, /<p class="eyebrow hero-pill">Less rework\. Better reporting\. Smarter workflows\.<\/p>/);
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\./);
  assert.match(hero, /<p class="hero-sub">I connect the tools, workflows and reporting that help your business run more smoothly &mdash; with built-in data checks to keep your information reliable\.<\/p>/);
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('Explore the live example'));
  assert.match(hero, /href="contact\/#contact-form-area">[\s\S]*?Book a free rework review<\/a>/);
  assert.match(hero, /href="#samples" data-demo-check>[\s\S]*?Explore the live example<\/a>/);
  for (const t of ['30 minutes', 'Free', 'No obligation']) assert.match(hero, new RegExp(`</svg>${t}</li>`), t);
  assert.match(hero, /class="cred-strip hv-cred"/);
  assert.equal((html.match(/Northstar Services/g) || []).length >= 2, true, 'the hero and the live example name the same fictional business');
});

test('hero: one workspace, Today / With Rework Rescue toggle; Today shows the data issues of each stage and on each source file', async () => {
  const html = await page();
  const a = html.indexOf('<figure class="hero-preview hx'); const fig = html.slice(a, html.indexOf('</figure>', a));
  assert.match(fig, /<button type="button" class="hx-tg" data-ws-mode="today" aria-pressed="false">Today<\/button>/);
  assert.match(fig, /<button type="button" class="hx-tg" data-ws-mode="after" aria-pressed="true">With Rework Rescue<\/button>/);
  assert.match(fig, /Data issues in today&rsquo;s process/);
  assert.match(fig, /Built-in data checks at every stage/);
  for (const t of ['Job_Tracker_v3.xlsx', '3 versions', 'Re: Re: Job update?', 'Service request (form)', 'Completion records.pdf', 'Who&rsquo;s doing the Northfield job?', 'Weekly_Report_FINAL(2).xlsx', 'The result']) assert.ok(fig.includes(t), t);
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
  assert.deepEqual(st['Duplicate job references'], ['pass', 'None found']);
  assert.deepEqual(st['Required fields'], ['flag', '11 of 12 complete · R-111']);
  assert.deepEqual(st['Assigned owners'], ['action', 'No owner · R-112']);
  assert.deepEqual(st['Overdue follow-ups'], ['action', 'Overdue · R-104']);
  assert.ok(!('Completed, not invoiced' in st), 'invoice check removed (no invoice data in the sample)');
  assert.deepEqual(st['KPI calculation'], ['pass', '7 + 5 = 12']);
  assert.deepEqual(st['Exceptions in the report'], ['flag', '3 shown, not hidden']);
  for (const s of ['pass', 'flag', 'action']) assert.ok(all.some((x) => x.state === s), `uses the ${s} state`);
  // Records that need attention are a subset of the open ones (not an extra category).
  const f = heroFigures(RECORDS);
  assert.ok(f.followUps.every((x) => RECORDS.find((r) => r.ref === x.ref).status !== 'Completed'));
  // Fix the records and the checks pass.
  const fixed = RECORDS.map((r) => ({ ...r, owner: r.ref === 'R-112' ? 'Ana' : r.owner, status: r.ref === 'R-104' ? 'Completed' : r.status, customer: r.ref === 'R-111' ? 'Harbor Works' : r.customer }));
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
  assert.ok(html.includes('Northstar Services, a fictional service business'), 'the live example names the same business');
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
  // The only mention of subscriptions is the cost-transparency line in the live example (final brief, 11 Nov).
  assert.doesNotMatch(html.replace('Any additional software, subscriptions or implementation costs are discussed before the work begins.', ''), /subscription|sign up for (the|our) platform/i);
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
  assert.ok(sec.indexOf('class="demo-after"') > sec.indexOf('<!-- tracker:end -->'), 'after the live example');
  assert.match(after, /<strong>Your business may be different\. The problems are often familiar\.<\/strong> Rework Rescue helps businesses dealing with scattered information, manual processes, unclear follow-ups or reporting that takes too much effort to prepare\. The first step is a conversation about your actual process, not a commitment to buy software or an automation package\./);
  assert.match(after, /30 minutes &middot; No obligation &middot; Practical next steps/);
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

