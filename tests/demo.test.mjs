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

test('hero copy (mockup v3; AI and automation wording 11 Nov late): eyebrow, headline with accent, supporting copy, two CTAs, chips, credibility', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf('<figure'));
  // Jeff, 11 Nov 23:46: target is small to medium businesses; headline "Less manual work."; automation and AI named in the subhead.
  assert.match(hero, /<p class="eyebrow hero-pill">For small and medium-sized service businesses\.<\/p>/);
  assert.match(hero, /Less manual work\. <span class="h1-accent">More time running the business\./);
  assert.match(hero, /<p class="hero-sub">Chasing job updates\? Re-typing the same details\? Rebuilding reports every week\? I set up automation and AI that take the repeat work off your team, with checks so you can trust what comes out\.<\/p>/);
  assert.match(hero, /<span class="cred-role">8\+ years in data operations: checking, reporting and automating\.<\/span>/);
  // 12 Nov seven-section page: the second button goes to How I can help.
  assert.ok(hero.indexOf('Book a free review') < hero.indexOf('See how I can help'));
  assert.match(hero, /href="contact\/#contact-form-area">[\s\S]*?Book a free review<\/a>/);
  assert.match(hero, /<a class="btn btn-large hv-explore" href="#services">See how I can help <span aria-hidden="true">&darr;<\/span><\/a>/);
  for (const t of ['30 minutes', 'Free', 'No obligation']) assert.match(hero, new RegExp(`</svg>${t}</li>`), t);
  assert.match(hero, /class="cred-strip hv-cred"/);
  assert.doesNotMatch(html, /data-demo-check|live example/i, 'the live example is off the page (12 Nov)');
});

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

test('services (10 Nov; heading and card order 11 Nov PM): Capture -> Move -> See, checks across all three, no choosing', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="services"'), html.indexOf('id="how"'));
  assert.match(sec, /<h2 id="services-h">I fix the tools, the steps and the numbers\.<\/h2>/);
  assert.doesNotMatch(html, /One connected solution/);
  assert.match(sec, /You don&rsquo;t need to choose a service\. I&rsquo;ll start with the part that&rsquo;s costing your business the most time and build from there\./);
  // Order: Capture, Move, See. The cards lead with the plain line; the three service names stay under it (11 Nov PM review).
  assert.deepEqual([...sec.matchAll(/<span class="svc-layer-n">(\d\d)<\/span> (\w+)<\/p>\s*<h3>([^<]+)<\/h3>/g)].map((m) => [m[1], m[2], m[3]]), [
    ['01', 'Capture', 'Fix the tools.'], ['02', 'Move', 'Fix the steps.'], ['03', 'See', 'Fix the numbers.']]);
  assert.deepEqual([...sec.matchAll(/<p class="svc-short">([^<]+)<\/p>/g)].map((m) => m[1]), ['Business Tools &amp; Systems', 'Workflows &amp; Processes', 'Data &amp; Reporting']);
  // Data & Reporting keeps the most visual weight.
  assert.match(sec, /class="svc-layer svc-data svc-layer-core" id="svc-data"/);
  assert.match(sec, /A good place to start/);
  assert.doesNotMatch(html, /Most projects start|Most first projects|Where most projects start|first project usually/, 'no implied track record');
  // 12 Nov UX review: How I can help ends on the proof strip and one button; the approach card moved to How it works.
  assert.doesNotMatch(sec, /svc-how|svc-foot|lx-impl-h/);
  assert.ok(sec.indexOf('class="svc-layers"') < sec.indexOf('class="svc-get"') && sec.indexOf('class="svc-get"') < sec.indexOf('id="built"') && sec.indexOf('id="built"') < sec.indexOf('class="demo-after'));
  assert.equal((sec.match(/<details class="fold svc-ex"><summary>4 examples<\/summary>/g) || []).length, 3, 'examples in closed rows, none deleted');
  assert.match(sec, /<h3>What you get<\/h3>/);
  // The repeated checks band and the second weekly-report story stay removed (11 Nov review).
  assert.doesNotMatch(sec, /svc-checks|example-project/);
  assert.doesNotMatch(html, /checks its own data|every workflow I build/i);
  // Nothing that asks the visitor to pick a service; no per-service mini-demos.
  assert.doesNotMatch(html, /on its own or combined|Not sure where your problem fits|data-mini=|svc-try|data-svc-go/);
  const home = await src('home.js'); assert.doesNotMatch(home, /mountServices|mountSamples/);
  // Plain tools line in the How it works card; the one technical tools list lives in About (12 Nov).
  assert.match(html.slice(html.indexOf('id="how"'), html.indexOf('id="about"')), /<div class="how-approach">[\s\S]*?<strong>Works with what you already use:<\/strong>/);
  assert.doesNotMatch(sec, /Automated with:/);
  const about = html.slice(html.indexOf('id="about"'), html.indexOf('id="faq"'));
  assert.match(about, /Google Apps Script[\s\S]*?picked to fit what you already have\./);
  assert.doesNotMatch(html.slice(html.indexOf('id="faq"')), /I build with n8n/);
  assert.doesNotMatch(html, /KPI &amp; Operations Reporting|Reporting &amp; Data Automation|Workflow Improvements/);
});

test('18.11 How it works (12 Nov): the reassurance line, the steps and the handover terms stay', async () => {
  const html = await page();
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /<h2 id="how-h">You keep the tools you know\. I improve the process around them\.<\/h2>/);
  assert.match(how, /I email you the scope, price and timeline, so you can share it with whoever signs off\./);
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

test('problem cards: three, in the customer’s words, each pointing to its layer of the one solution (plain "See how I fix this" link, 11 Nov panel)', async () => {
  const html = await page();
  const fit = html.slice(html.indexOf('id="fit"'), html.indexOf('id="services"'));
  const cards = [...fit.matchAll(/<a href="#(svc-\w+)"><strong>([^<]+)<\/strong>[\s\S]*?<em>([^<]+)</g)].map((m) => [m[1], m[2], m[3].trim()]);
  assert.deepEqual(cards, [
    ['svc-systems', '&ldquo;Everything is scattered.&rdquo;', 'See how I fix this'],
    ['svc-workflow', '&ldquo;I&rsquo;m always chasing updates.&rdquo;', 'See how I fix this'],
    ['svc-data', '&ldquo;I&rsquo;m always rebuilding reports.&rdquo;', 'See how I fix this'],
  ]);
  assert.match(fit, /<p class="pain-cost">A job with no owner turns into a customer complaint\./, 'what doing nothing costs, worded as everyday examples, not results');
  assert.doesNotMatch(fit.slice(fit.indexOf('pain-cost')), /\d+\s?(%|hours|per cent)/, 'no invented numbers');
  assert.match(fit, /Most weeks it&rsquo;s all three at once\. <a href="#services">That&rsquo;s why I fix them together<\/a>\./);
  assert.match(fit, /<p class="fit-who">For service businesses whose week runs on spreadsheets, forms and an inbox\.<\/p>/);
});


test('page order (12 Nov eight-section page): hero, problems, how I can help (with proof), previous experience, how it works, about, FAQ, book', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const order = ['id="fit"', 'id="services"', 'id="built"', 'id="experience"', 'id="how"', 'id="about"', 'id="faq"', 'id="start"'].map((x) => html.indexOf(x));
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal((html.match(/<section /g) || []).length, 8, 'eight sections');
  assert.match(html, /<div class="built-strip" id="built"[^>]*><span class="anchor" id="samples"><\/span>/, 'old #samples links (booking emails) land on the proof strip');
  const exp = html.slice(order[3], order[4]);
  assert.match(exp, /<p class="eyebrow">Previous professional experience<\/p>/);
  assert.match(exp, /<h2 id="experience-h">Operational problems I&rsquo;ve helped solve<\/h2>/);
  assert.match(exp, /not Rework Rescue client projects/);
  assert.equal((exp.match(/<article class="exp-case/g) || []).length, 2, 'two compact case studies');
  const c1 = exp.slice(0, exp.indexOf('aria-labelledby="exp2-h"'));
  assert.match(c1, /<p class="exp-cat">Operational controls &amp; automation<\/p>/);
  assert.match(c1, /<div class="fpanel fpanel-before">[\s\S]*<div class="fpanel fpanel-after">/, 'Before comes first, then After');
  for (const t of ['Invoice issued', 'Stakeholders&rsquo; quarterly check', 'Issue identified', 'Correction delayed or potentially missed', 'Readings received', 'Automated validation', 'Exceptions flagged', 'Human review', 'Invoice process', 'Scheduled validation runs on the 16th of the reporting month and the 1st of the following month, ahead of the 10th invoicing cycle.', 'Meter issues were often discovered during quarterly checks, after invoices had already been issued.']) assert.ok(c1.includes(t), t);
  assert.equal((c1.match(/<ol class="fp-steps">/g) || []).length, 2);
  assert.doesNotMatch(c1, /1st and 16th|16th and 1st/, 'schedule: 16th of the reporting month, 1st of the following month');
  assert.match(c1, /<summary><span class="fold-lab"><span class="fold-title">Technical details<\/span> <span class="fold-sub">Implementation and detection checks<\/span><\/span><\/summary>/);
  assert.doesNotMatch(c1, /<details[^>]*\bopen\b/, 'technical details closed by default');
  assert.match(c1, /<th scope="col">Meter ID<\/th><th scope="col">Issue detected<\/th>/);
  assert.doesNotMatch(c1, /Power Automate|Cleared for invoicing|cleared for invoic|automatically (fix|correct|approve)/i, 'meter case: Python and Power BI only; no auto-fix or clearing claims');
  const c2 = exp.slice(exp.indexOf('aria-labelledby="exp2-h"'));
  assert.match(c2, /<div class="fpanel fpanel-before">[\s\S]*<div class="fpanel fpanel-after">/, 'reporting case uses the same Before/After system');
  for (const t of ['Extract data', 'Copy into the report', 'Validate data', 'Write notes', 'Daily data extraction', 'Automated checks', 'Investigation', 'Ready-to-use report', 'Sample report output', 'Preparing the Monday report for the 10 largest sites took 2&ndash;3 hours']) assert.ok(c2.includes(t), t);
  assert.match(c2, /<span class="fold-title">Technical details<\/span> <span class="fold-sub">Implementation and automated checks<\/span>/);
  for (const t of ['Site A', 'Site B', 'Site D']) assert.ok(c2.includes(`<td>${t}</td>`), t);
  assert.doesNotMatch(c2, /Site C|Site E|\d%/, 'only the original synthetic rows, no invented percentages');
  assert.equal((exp.match(/<details/g) || []).length, 2, 'two technical accordions');
  assert.doesNotMatch(exp, /<details[^>]*\bopen\b/, 'accordions closed by default');
  assert.equal((exp.match(/Illustrative example &middot; Synthetic data/g) || []).length, 2, 'both small samples labelled synthetic');
  assert.equal((exp.match(/<figure class="exp-sample">/g) || []).length, 2);
  assert.equal((exp.match(/<span>Move<\/span><span>See<\/span>/g) || []).length, 2, 'Move and See tags');
  assert.doesNotMatch(exp, /dash-kpis|bars-|Power BI dashboard preview|Severity/i, 'no dashboard centrepiece, KPI cards, chart or severity column');
  assert.doesNotMatch(exp, /exception handling|corrected automatically|auto-?correct/i, 'the tool flagged exceptions; it did not handle or correct them');
  assert.match(exp, /power was 0/, 'frozen-meter rule keeps the power condition');
  assert.doesNotMatch(exp, /\sstyle=|<script|<button|<input|<a /, 'static: no inline styles (CSP), no controls or links');
  assert.doesNotMatch(exp, /\d\s?%|saved|savings|per cent/i, 'no invented savings or percentages');
  assert.doesNotMatch(exp, /solar|irradiance|inverter|utility|TotalEnergies|SunPower|Eutility/i, 'generic wording, no employer or industry names');
  const about = html.slice(order[5], order[6]);
  for (const t of ['Before Rework Rescue', 'Utility billing checks.', 'Operational reporting.', 'Solar and energy analysis.', 'not Rework Rescue client projects']) assert.ok(about.includes(t), t);
  assert.match(about, /href="#experience">Operational problems I&rsquo;ve helped solve<\/a>/, 'About points to the experience section');
  assert.doesNotMatch(about, /Automated daily reporting\.|Automated data checks\./, 'overlap with the experience cards removed from About');
  assert.match(about, /<details class="fold about-more"><summary>Before Rework Rescue<\/summary>/);
  assert.match(html, /Based in the Philippines\. Calls fit your working day in the US, the UK, Europe or Australia/);
  const nav = [...html.slice(0, html.indexOf('<main')).matchAll(/<li><a href="#(\w+)">([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(nav, ['services:How I can help', 'how:How it works', 'about:About', 'faq:FAQ'], 'nav follows the page');
  for (const f of ['../contact/index.html', '../privacy/index.html', '../404.html']) {
    const h = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(h, /Live example/, f); assert.match(h, /#how">How it works</, f);
  }
  const start = html.slice(order[7]);
  assert.doesNotMatch(start.slice(0, start.indexOf('</section>')), /Prefer to write first\?|cta-person/, 'contact details in the footer; no name card (12 Nov)');
});

test('page: no prices, testimonials or client results; service names kept; services kept short', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const visible = html.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '');
  assert.doesNotMatch(visible, /[$₱€£]\s?\d|\bPHP\s?\d|\bUSD\b|per hour|\/hr\b|testimonial|what (my )?clients say/i);
  for (const n of ['Data &amp; Reporting', 'Workflows &amp; Processes', 'Business Tools &amp; Systems']) assert.ok(html.includes(`<p class="svc-short">${n}</p>`), n);
  // Services stay short: the problem line per service, no separate symptom lists.
  assert.doesNotMatch(html, /svc-familiar|Does this sound familiar\?/);
  // Middle option (9 Nov): CRM, websites and booking pages stay, framed as support for records and reporting.
  assert.match(html, /Customer lists and records/); // "CRM" -> "customer list" (11 Nov PM review)
  assert.match(html, /Forms, booking and request pages/);
  assert.match(html, /Trackers and job lists/);
  // Four examples per part: the three from the 11 Nov review plus one AI or automation item each (11 Nov late, AI and automation round).
  assert.equal((html.slice(html.indexOf('id="services"'), html.indexOf('id="how"')).match(/<ul class="svc-have">/g) || []).length, 3);
  for (const ul of html.match(/<ul class="svc-have">[\s\S]*?<\/ul>/g)) assert.equal((ul.match(/<li>/g) || []).length, 4);
  for (const t of ['Emails and documents read by AI', 'Updates between your tools', 'Replies and summaries drafted by AI', 'A written summary of the week']) assert.ok(html.includes(`<li><strong>${t}</strong>`), t);
  assert.doesNotMatch(html, /Better data\. Simpler workflows\./);
  assert.match(html, /I don&#39;t automate important decisions about people\./);
  assert.match(html, /30 days of fixes for anything that doesn&rsquo;t work as agreed\./);
});

test('booking (12 Nov): How I can help ends with one button; the closing section has the written review and the data line', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('id="services"'), html.indexOf('id="how"'));
  const after = sec.slice(sec.indexOf('class="demo-after'));
  assert.ok(sec.indexOf('class="demo-after') > sec.indexOf('id="built"'), 'at the end of the section, after the proof strip');
  assert.equal((html.match(/30 minutes &middot; No obligation &middot; Clear next steps/g) || []).length, 0, 'one button note everywhere (UX review)');
  assert.match(after, /30 minutes &middot; Free &middot; No obligation/);
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how.slice(how.indexOf('class="how-need"')), /class="fold how-30"[\s\S]*?href="contact\/#contact-form-area">Book a free review</, 'How it works ends with a button (UX review)');
  assert.match(after, /href="contact\/#contact-form-area">Book a free review</);
  assert.doesNotMatch(after, /Rework Rescue helps|Your business may be different/);
  const start = html.slice(html.indexOf('id="start"'));
  assert.match(start, /<p class="book-sub">It can be a report, a tracker, an inbox or a follow-up list\.<\/p>/);
  assert.match(start, /<p class="book-sign">&mdash; Jeff<\/p>/);
  assert.match(start, /<div class="book-written" id="written-review">[\s\S]*?Prefer writing\?[\s\S]*?within 1 working day: where it breaks and what I&rsquo;d fix first\. It&rsquo;s free, and there&rsquo;s no obligation to book a call afterwards\.[\s\S]*?<a class="btn btn-secondary" href="mailto:[^"]+subject=Written%20report%20review">Get a free written review<\/a>\s*<details class="fold fold-dark"><summary>No report to send\?<\/summary><p>Send a screenshot of your tracker or the task \(names hidden\)[\s\S]*?what I&rsquo;d leave alone\.<\/p><\/details>/);
  assert.match(start, /<ul class="cta-facts"><li>Work directly with me<\/li><li>Written scope and price before any work<\/li><li>You own what I build<\/li><\/ul>/, 'chips not repeated from the hero (UX review)');
  assert.ok(start.indexOf('class="book-data"') < start.indexOf('id="book-inline"') && start.indexOf('class="book-data"') > 0, 'data line beside the calendar');
  assert.match(start, /For the call, you don&rsquo;t need files or logins\. Please leave out anything confidential\./);
  assert.doesNotMatch(html, /small (service )?businesses/i, 'no "small businesses" on the page');
  assert.match(html, /<h2 id="cta-h">Bring me the task your team repeats every week\.<\/h2>/);
  assert.match(html, /<h2 id="fit-h">Good teams shouldn&rsquo;t have to fight their spreadsheets\.<\/h2>/);
  assert.doesNotMatch(html, /\bwe&rsquo;ll\b|\bWe&rsquo;ll\b/, 'first person singular');
});

test('How it works: four steps; step 4 lists what you receive; the 30-day terms in a closed row (12 Nov)', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const how = html.slice(html.indexOf('id="how"'), html.indexOf('id="about"'));
  assert.match(how, /You&rsquo;ll know the scope and price in writing before any work starts\./);
  assert.equal((how.match(/<li><h3>/g) || []).length, 4, 'four steps');
  for (const t of ['The finished work, set up in your own accounts, and you own it.', 'A handover call and a short run guide, so everyday use doesn&rsquo;t depend on me.', '30 days of fixes for anything that doesn&rsquo;t work as agreed.', 'Optional ongoing support after that.', "They don&#39;t cover new features, scope changes or changes to third-party services."]) assert.ok(how.includes(t), t);
  assert.match(how, /<details class="fold how-30"><summary>What the 30 days cover<\/summary>/);
  assert.match(how, /I plan a first project to take 2&ndash;3 weeks/);
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


test('11 Nov PM round: new FAQs, written review without a call, scope you can share, AI data line', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const faq = html.slice(html.indexOf('id="faq"'), html.indexOf('id="start"'));
  // 12 Nov: eight questions; the process answers moved to How it works, the written review to the closing section.
  assert.deepEqual([...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]), ['What can you automate?', 'How much does it cost, and is there a written agreement?', 'Can you work with confidential or sensitive information?', 'Will this replace anyone on my team?', 'What if you&#39;re unavailable?', 'How do you handle access to our systems?', 'You&#39;re in the Philippines. How does working remotely work?', 'Do you work with larger teams?', 'Can you build a website, booking system or CRM?']);
  assert.match(faq, /payment arrangements and any subscriptions you&#39;d need\. Work only begins once you&#39;ve agreed to it in writing/);
  assert.match(faq, /I&#39;m happy to sign an NDA and a data processing agreement before handling any personal data\./);
  assert.match(faq, /Client project data is never put into free AI tools or tools that train on your data\./);
  assert.doesNotMatch(faq, /reply within|within \d+ hours/i, 'no reply-time promise (Jeff, 11 Nov)');
  for (const f of ['../index.html', '../contact/index.html']) {
    const h = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.match(h, /one-page written review within 1 working day/, f);
    assert.match(h, /share (it )?with whoever signs off/, f);
  }
  assert.doesNotMatch(html, /Northfield|Brightline Studio|Send updated quotation|Review supplier quote/, 'field-work sample jobs');
  assert.doesNotMatch(html.slice(html.indexOf('id="fit"'), html.indexOf('id="how"')), /\bCRM\b/, '"customer list", not CRM (the FAQ keeps the word for people who search for it)');
  // ChatGPT review follow-ups (11 Nov 21:02): ownership near the final button; carry-over rule visible on the report.
  assert.match(html, /<li>You own what I build<\/li>/);
  assert.match(html, /A handover call and a short run guide, so everyday use doesn&rsquo;t depend on me\./);
  assert.equal((html.match(/run guide/g) || []).length, 3, 'run guide: What you get, How it works step 4, FAQ (unavailable)');
  assert.doesNotMatch(html, /<p[^>]*>[^<]*<p[\s>]/, 'no unclosed paragraph before another paragraph');
  const priv = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  assert.match(priv, /Client project data is never put into free AI tools/);
  for (const f of ['../tools/build_n8n_assistant.mjs', '../tools/build_tracker_xlsx.py', '../n8n/rework-assistant.json']) {
    assert.doesNotMatch(await readFile(new URL(f, import.meta.url), 'utf8'), /book a free rework review/i, f);
  }
});

test('AI and automation round (11 Nov late): automation and AI visible, data background as the reason, own builds shown, honest limits', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  // Button: "Book a free review" on every page and in every message the visitor gets.
  for (const f of ['../index.html', '../contact/index.html', '../privacy/index.html', '../404.html', '../assessment/index.html', '../brand/index.html', '../src/booking/popup.js', '../src/booking/check.js', '../src/assistant/rules.js', '../n8n/rework-assistant.json', '../tools/build_tracker_xlsx.py']) {
    const t = await readFile(new URL(f, import.meta.url), 'utf8');
    // Tags are stripped first, so a label split across spans (the phone booking bar) is caught too.
    assert.doesNotMatch(t.replace(/Written(%20| )report(%20| )review/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '), /(report|rework) review/i, f);
  }
  assert.match(html, /<title>Rework Rescue \| Automation and AI for service businesses<\/title>/);
  // Services: the "how" line; automation tools named in small print only.
  const svc = html.slice(html.indexOf('id="services"'), html.indexOf('id="built"'));
  assert.match(svc, /<p class="svc-intro-how">Automation and AI do the repeat work\. Checks catch the mistakes\. People make the decisions\.<\/p>/);
  assert.doesNotMatch(svc.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/g).join(' '), /n8n|Power Automate|Python|Gemini/, 'no tool names in headings');
  // "See it working on this page": two of Jeff's own builds, a strip inside How I can help (12 Nov; tracker card removed).
  assert.ok(html.indexOf('id="services"') < html.indexOf('id="built"') && html.indexOf('id="built"') < html.indexOf('id="how"'));
  const built = html.slice(html.indexOf('id="built"'), html.indexOf('id="how"'));
  assert.equal((built.match(/<li class="built-card">/g) || []).length, 2);
  for (const t of ['The booking calendar', 'The chat assistant']) assert.ok(built.includes(`<h3>${t}</h3>`), t);
  assert.doesNotMatch(built, /The job tracker and weekly report/);
  assert.equal((built.match(/<details class="fold built-more"><summary>See the 4 steps<\/summary>\s*<ol class="built-steps">/g) || []).length, 2);
  assert.equal((built.match(/<p class="built-safe">/g) || []).length, 2);
  assert.match(built, /I built these for my own site\. They aren&rsquo;t client projects\./);
  assert.match(built, /href="contact\/#contact-form-area">Try it: pick a time/);
  assert.match(built, /<p class="built-try" data-assistant-only hidden><a href="#built" data-assistant-open>/, 'the assistant link only shows when the assistant is on');
  assert.doesNotMatch(built, /\sstyle="/);
  // The claims on the cards match what the workflows do.
  const nodes = (f) => readFile(new URL(f, import.meta.url), 'utf8').then((t) => JSON.parse(t).nodes.map((n) => n.name));
  const booking = await nodes('../n8n/rework-review-booking.json');
  for (const n of ['Google: busy times', 'Google: is it still free?', 'Google: create event + invite', 'Log to Google Sheet', 'Still on? (1 day)', 'Email: 1-day reminder', 'Still on? (1 hour)', 'Email: 1-hour reminder']) assert.ok(booking.includes(n), n);
  const assistant = await nodes('../n8n/rework-assistant.json');
  for (const n of ['Check request', 'Gemini: reply', 'Check reply', 'Log to Google Sheet']) assert.ok(assistant.includes(n), n);
  // About: data analyst first, automation builds from previous roles, current training, tools in small print.
  const about = html.slice(html.indexOf('id="about"'), html.indexOf('id="faq"'));
  assert.match(about, /<p class="about-lead">I&rsquo;m a data analyst who builds automation and AI workflows for service businesses\.<\/p>/);
  assert.match(about, /<p class="about-title">Data analyst building AI and automation workflows<\/p>/);
  for (const t of ['Utility billing checks.', 'Operational reporting.', 'Solar and energy analysis.']) assert.ok(about.includes(`<strong>${t}</strong>`), t);
  assert.match(about, /These are from my previous roles, not Rework Rescue client projects\./);
  assert.match(about, /I build AI and automation workflows with n8n, and I keep training as the tools change\./);
  assert.match(about, /<p class="about-tools"><strong>Tools I work with:<\/strong>/);
  // FAQ: "What can you automate?" sits near the top and keeps the limits.
  const faq = html.slice(html.indexOf('id="faq"'), html.indexOf('id="start"'));
  const qs = [...faq.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  assert.equal(qs.indexOf('What can you automate?'), 0);
  assert.ok(!qs.includes('Do you use AI or automation?'));
  assert.match(faq, /A person reviews anything that matters before it&#39;s sent or changed\.[\s\S]*?Not every problem needs AI\./);
  // Guards: the 8+ years are in data; no agency talk; only tools Jeff has confirmed.
  const visible = html.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, '');
  assert.doesNotMatch(visible, /years (of experience )?in AI|AI (automation )?agency|AI expert/i);
  assert.doesNotMatch(visible, /Zapier|GoHighLevel|\bGHL\b|Make\.com/, 'only tools Jeff has confirmed');
  const rules = await readFile(new URL('../src/assistant/rules.js', import.meta.url), 'utf8');
  assert.match(rules, /The 8\+ years are in data and reporting, not in AI\./);
});
