// Live example tests (automated weekly report with human review, 10 Nov 2026).
// Every figure the hero card, the live example and the Data & Reporting output sample show comes from
// src/demo/engine.js working on src/demo/data.js. These tests pin the dataset and history, the four findings and their
// rules, every review path (correct, confirm legitimate, leave unresolved), the recheck, the release rules, the AI
// findings, and that the page's static HTML shows the engine's numbers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as DATA from '../src/demo/data.js';
import { SALES, PAYMENTS, REQUESTS, SOURCES, HISTORY, RULES, ISSUES } from '../src/demo/data.js';
import {
  initialState, sourceCounts, runChecks, findings, decide, setRelease, canApproveFinal, review, status, report, outputs,
  aiFindings, heroLine, heroSummary, daily, historyAverage, weekRange, workingDaysOpen, ISSUE_IDS,
} from '../src/demo/engine.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const sum = (rows) => rows.reduce((t, r) => t + (r.amount ?? 0), 0);
const with_ = (...pairs) => pairs.reduce((s, [i, c]) => decide(s, i, c), initialState());
const statuses = (s) => Object.fromEntries(findings(s).map((f) => [f.issue, f.status]));

// ---- The dataset and the history

test('sources: sales log 12, payments 9, requests 6 → 27 records from 3 sources, plus 4 weeks of history', () => {
  assert.deepEqual(sourceCounts(), { sales: 12, payments: 9, requests: 6, total: 27, sources: 3, historyWeeks: 4 });
  assert.deepEqual(SOURCES.map((s) => s.id), ['sales', 'payments', 'requests']);
});

test('the dataset reconciles: 4,310 recorded, 2,980 paid, 3 closed and 3 open requests, unique references', () => {
  assert.equal(sum(SALES), 4310);
  assert.equal(SALES.filter((s) => s.amount === null).length, 1);
  assert.equal(sum(PAYMENTS), 2980);
  assert.deepEqual([REQUESTS.filter((r) => r.status === 'Closed').length, REQUESTS.filter((r) => r.status === 'Open').length], [3, 3]);
  assert.equal(new Set([...SALES, ...PAYMENTS, ...REQUESTS].map((r) => r.id)).size, 27);
});

test('payments point at real sales for the same customer and match their amount unless the amount is blank', () => {
  for (const p of PAYMENTS) {
    const s = SALES.find((x) => x.id === p.sale);
    assert.ok(s, p.id); assert.equal(p.customer, s.customer, p.id);
    if (s.amount !== null) assert.equal(p.amount, s.amount, p.id);
  }
  assert.equal(PAYMENTS.filter((p) => p.sale === 'S-1051').length, 0);
});

test('history: 4 weeks × Mon–Fri as approved; averages 620 / 1,550 / 560 / 640 / 380; the rule is a configurable 40%', () => {
  assert.deepEqual(HISTORY.days, { Mon: [640, 590, 610, 640], Tue: [1520, 1610, 1480, 1590], Wed: [540, 600, 520, 580], Thu: [660, 610, 650, 640], Fri: [360, 410, 350, 400] });
  assert.deepEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(historyAverage), [620, 1550, 560, 640, 380]);
  assert.equal(RULES.patternThreshold, 0.4);
});

test('this week by day: only Tuesday is outside ±40% (2,455, +58%); no other day is flagged on any decision path', () => {
  assert.deepEqual(daily(initialState()).map((d) => [d.day, d.total, Math.round(d.change * 100), d.flagged]),
    [['Mon', 570, -8, false], ['Tue', 2455, 58, true], ['Wed', 360, -36, false], ['Thu', 595, -7, false], ['Fri', 330, -13, false]]);
  for (const dup of [null, 'remove', 'keep']) for (const mis of [null, 'fullAmount', 'partial', 'unconfirmed']) {
    const flagged = daily(with_(['duplicate', dup], ['missing', mis])).filter((d) => d.flagged).map((d) => d.day);
    assert.deepEqual(flagged, dup === 'remove' ? [] : ['Tue'], `${dup}/${mis}`);
  }
  assert.equal(daily(with_(['duplicate', 'remove'])).find((d) => d.day === 'Tue').total, 1595);
});

// ---- The checks and findings

test('first run: exactly four findings, one per check type, each from its stated rule', () => {
  assert.deepEqual(runChecks(), { duplicates: [['S-1043', 'S-1051']], missing: ['S-1047'], pattern: ['Tue'], followUp: ['R-205'] });
  const fs = findings();
  assert.deepEqual(fs.map((f) => f.issue), ISSUE_IDS);
  assert.deepEqual(fs.map((f) => f.kind), ['Duplicate check', 'Missing information · cross-source', 'Historical pattern', 'Business rule']);
  for (const f of fs) for (const k of ['rule', 'why', 'check', 'title']) assert.ok(f[k], `${f.issue} ${k}`);
  const r = REQUESTS.find((x) => x.id === 'R-205');
  assert.deepEqual([r.owner, r.next, workingDaysOpen(r)], ['', '', 4]);
});

test('findings are worded as things to investigate, not confirmed errors; the 40% rule is called a demonstration setting', () => {
  const text = findings().map((f) => `${f.title} ${f.why} ${f.rule}`).join(' ');
  assert.match(findings()[2].rule, /40%.*demonstration rule: the threshold is set for each business/i);
  assert.match(findings()[2].why, /isn’t necessarily wrong/);
  assert.match(findings()[1].why, /doesn’t say whether that’s the full amount or a part payment/);
  assert.doesNotMatch(text, /confirmed duplicate|is an error|is wrong\b/i);
  assert.match(ISSUES.duplicate.title, /^Potential duplicate$/);
});

test('missing amount: 380 is only used when confirmed as the full amount; part payment and unconfirmed stay unresolved', () => {
  assert.deepEqual(ISSUES.missing.choices.map((c) => c[0]), ['fullAmount', 'partial', 'unconfirmed']);
  assert.equal(report(with_(['missing', 'fullAmount'])).salesTotal, 4690);
  for (const c of ['partial', 'unconfirmed']) {
    const s = with_(['missing', c]);
    assert.equal(report(s).salesTotal, 4310, c);
    assert.equal(statuses(s).missing, 'unresolved', c);
    assert.deepEqual(report(s).unknown, [{ id: 'S-1047', customer: 'Summit Supplies', received: 380 }], c);
  }
});

test('Tuesday: legitimate variation changes no figure; removing S-1051 clears it by recheck; it can stay unresolved', () => {
  const legit = with_(['duplicate', 'keep'], ['pattern', 'legit']);
  assert.equal(statuses(legit).pattern, 'legitimate');
  assert.equal(report(legit).salesTotal, report(with_(['duplicate', 'keep'])).salesTotal);
  const cleared = with_(['duplicate', 'remove']);
  const f = findings(cleared).find((x) => x.issue === 'pattern');
  assert.deepEqual([f.status, f.byRecheck], ['resolved', true]);
  assert.match(f.consequence, /Tuesday is 1,595 \(\+3% against the average\)/);
  assert.equal(decide(cleared, 'pattern', 'legit'), cleared, 'nothing left to decide once cleared');
  assert.equal(statuses(with_(['pattern', 'investigate'])).pattern, 'unresolved');
});

test('R-205: a follow-up task only when a next action is assigned, never when marked as handled', () => {
  const base = [['duplicate', 'remove'], ['missing', 'fullAmount']];
  const assigned = setRelease(with_(...base, ['followUp', 'assign']), 'final');
  assert.deepEqual(outputs(assigned).task, { id: 'R-205', owner: 'Ben', text: 'Send the quote to Northside Partners' });
  const handled = setRelease(with_(...base, ['followUp', 'handled']), 'final');
  assert.equal(outputs(handled).task, null);
  assert.equal(report(handled).openRequests, 2);
  assert.equal(report(assigned).openRequests, 3);
  assert.equal(report(assigned).noNextAction, 0);
});

// ---- Review, recheck and release

test('statuses for every path: resolved, confirmed legitimate or unresolved, and the counts add up', () => {
  for (const dup of ['remove', 'keep']) for (const mis of ['fullAmount', 'partial', 'unconfirmed']) for (const pat of ['legit', 'investigate']) for (const fu of ['assign', 'handled']) {
    const s = with_(['duplicate', dup], ['missing', mis], ['pattern', pat], ['followUp', fu]);
    const st = statuses(s); const v = review(s);
    assert.equal(st.duplicate, dup === 'remove' ? 'resolved' : 'legitimate');
    assert.equal(st.missing, mis === 'fullAmount' ? 'resolved' : 'unresolved');
    assert.equal(st.pattern, dup === 'remove' ? 'resolved' : pat === 'legit' ? 'legitimate' : 'unresolved');
    assert.equal(st.followUp, 'resolved');
    assert.equal(v.open + v.resolved + v.legitimate + v.unresolved, 4);
    assert.equal(canApproveFinal(s), v.unresolved === 0 && v.open === 0);
  }
});

test('figures for the main paths: 3,830 final; 4,690 with two genuine sales; still owed reconciles sale by sale', () => {
  const a = report(with_(['duplicate', 'remove'], ['missing', 'fullAmount'], ['followUp', 'assign']));
  assert.deepEqual([a.salesTotal, a.salesCount, a.owed, a.owedRows.map((x) => x.id), a.final], [3830, 11, 850, ['S-1049', 'S-1052'], true]);
  assert.equal(a.salesTotal - a.paymentsTotal, a.owed);
  const b = report(with_(['duplicate', 'keep'], ['missing', 'fullAmount'], ['pattern', 'legit'], ['followUp', 'handled']));
  assert.deepEqual([b.salesTotal, b.owed, b.final], [4690, 1710, true]);
  const c = report(with_(['duplicate', 'keep'], ['missing', 'partial'], ['pattern', 'investigate'], ['followUp', 'assign']));
  assert.deepEqual([c.salesTotal, c.owed, c.final], [4310, 1710, false]);
});

test('release rules: final only when nothing is open or unresolved; provisional and hold only before that; any decision re-locks', () => {
  const s0 = initialState();
  assert.equal(setRelease(s0, 'final'), s0);
  const prov = setRelease(s0, 'provisional');
  assert.equal(prov.release, 'provisional');
  assert.equal(outputs(prov).report.label, 'Provisional report');
  assert.equal(outputs(prov).unresolved.length, 4, 'open items are listed in a provisional report');
  assert.equal(outputs(setRelease(s0, 'hold')), null, 'hold unlocks nothing');
  assert.equal(outputs(s0), null, 'nothing unlocked before a release');
  const ready = with_(['duplicate', 'remove'], ['missing', 'fullAmount'], ['followUp', 'handled']);
  assert.equal(status(ready), 'Ready for approval');
  assert.equal(setRelease(ready, 'provisional'), ready);
  const fin = setRelease(ready, 'final');
  assert.deepEqual([status(fin), outputs(fin).report.label, outputs(fin).unresolved.length], ['Final report released', 'Final report', 0]);
  assert.equal(decide(fin, 'followUp', 'assign').release, null, 'changing a decision locks the outputs again');
});

test('released outputs reflect the decisions: totals, dashboard days and unresolved items differ by path', () => {
  const p = outputs(setRelease(with_(['duplicate', 'keep'], ['missing', 'partial']), 'provisional'));
  assert.deepEqual([p.report.salesTotal, p.unresolved.map((u) => u.issue)], [4310, ['missing', 'pattern', 'followUp']]);
  assert.equal(p.dashboard.daily.find((d) => d.day === 'Tue').flagged, true);
  const f = outputs(setRelease(with_(['duplicate', 'remove'], ['missing', 'fullAmount'], ['followUp', 'assign']), 'final'));
  assert.deepEqual([f.report.salesTotal, f.dashboard.daily.find((d) => d.day === 'Tue').total, f.dashboard.daily.some((d) => d.flagged)], [3830, 1595, false]);
});

test('AI findings agree with the figures, keep the duplicate and the missing amount separate, and never call a provisional total final', () => {
  const a0 = aiFindings();
  assert.equal(a0.length, 5);
  assert.match(a0[0], /Sales recorded: 4,310 across 12 sales\. Provisional/);
  assert.match(a0[1], /Potential duplicate: S-1051 .*860 lower/);
  assert.match(a0[2], /S-1047 .*380 received; it’s not yet known whether that’s the full amount/);
  assert.match(a0[3], /Potential anomaly: Tuesday’s sales \(2,455\) are 58% above the 4-week Tuesday average \(1,550\)/);
  assert.match(a0[4], /R-205 .*no next action/);
  const fin = aiFindings(with_(['duplicate', 'remove'], ['missing', 'fullAmount'], ['followUp', 'assign']));
  assert.match(fin[0], /Sales total after review: 3,830 across 11 sales \(recorded: 4,310\)/);
  assert.match(fin[3], /Tuesday recalculated to 1,595/);
  const part = aiFindings(with_(['missing', 'partial']));
  assert.match(part[0], /Provisional/); assert.match(part[2], /part payment/);
  assert.doesNotMatch(aiFindings(with_(['duplicate', 'keep'], ['missing', 'unconfirmed'])).join(' '), /after review/);
});

test('hero line: before review, part-way, and when every finding is resolved', () => {
  assert.equal(heroLine(), 'Sales recorded: 4,310, provisional. 4 items need investigation, including Tuesday sales 58% above their 4-week average.');
  assert.equal(heroLine(with_(['duplicate', 'keep'], ['missing', 'partial'])), 'Sales now 4,310, provisional. 2 to review · 1 confirmed legitimate · 1 unresolved.');
  assert.match(heroLine(with_(['duplicate', 'remove'], ['missing', 'fullAmount'], ['followUp', 'assign'])), /^Sales total after review: 3,830 \(recorded 4,310\)/);
});

test('wording: first person only, no trade words, no currency symbols', () => {
  const text = JSON.stringify(DATA);
  assert.doesNotMatch(text, /\b(we|we're|we've|we'll|our|us)\b/i);
  assert.doesNotMatch(text, /quillfern|repair|technician|leak|gutter|tap\b|job/i);
  assert.doesNotMatch(text, /[$₱€£]/);
});

// ---- The sample week

const DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const asDate = (label) => {
  const [dow, d, mon] = label.split(' ');
  assert.equal(mon, 'Nov', label);
  const dt = new Date(Date.UTC(2026, 10, Number(d)));
  assert.equal(DAYN[dt.getUTCDay()], dow, `${label} is a ${DAYN[dt.getUTCDay()]}`);
  return dt;
};

test('the sample week ends Fri 6 Nov 2026, and every date is a real weekday inside it', () => {
  assert.equal(DATA.WEEK, 'Week ending Fri 6 Nov 2026');
  assert.equal(weekRange(DATA.WEEK), '2–6 November 2026');
  const start = asDate('Mon 2 Nov'); const end = asDate('Fri 6 Nov');
  for (const d of [...SALES.map((x) => x.date), ...PAYMENTS.map((x) => x.date), ...REQUESTS.map((x) => x.received)]) {
    const dt = asDate(d); assert.ok(dt >= start && dt <= end, d);
  }
  for (const p of PAYMENTS) assert.ok(asDate(p.date) >= asDate(SALES.find((s) => s.id === p.sale).date), `${p.id} paid on or after its sale`);
});

test('the demo window shows the same week as the data', async () => {
  const m = (await page()).match(/<span class="dw-status" data-week>([^<]*)</);
  assert.ok(m); assert.equal(m[1], DATA.WEEK);
});

// ---- The page

test('hero: headline and approved paragraph kept, booking first, 30-minute claim matches the booking setup', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<figure'));
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\.<\/span>/);
  assert.ok(hero.includes('Rebuilding the same report every Monday? Chasing updates because nobody knows who&rsquo;s responsible for the next step? I help small businesses fix the reports, spreadsheets and routine tasks their teams keep redoing by hand, so you can trust the numbers and see what needs attention.'));
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('Explore the live example'));
  assert.match(hero, /A 30-minute call about one report or process/);
  const { RULES: BOOK } = await import('../src/booking/slots.js');
  assert.equal(BOOK.slotMinutes, 30);
});

test('hero card: the run log with the engine’s figures, four flags, AI line, approval step and locked outputs', async () => {
  const html = await page();
  const card = html.slice(html.indexOf('id="hero-run"'), html.indexOf('</figure>', html.indexOf('id="hero-run"')));
  const h = heroSummary();
  for (const [k, v] of Object.entries(h)) {
    if (typeof v === 'object') continue;
    for (const m of card.matchAll(new RegExp(`data-hero="${k}">([^<]*)<`, 'g'))) assert.equal(m[1], String(v), k);
  }
  assert.match(card, /This week&rsquo;s report, checked and ready for your approval\./);
  assert.match(card, /Weekly report &middot; Every Monday, 7:00&nbsp;AM/);
  for (const t of ['Collect and consolidate', 'Format and standardise', 'Validate and detect patterns', 'AI findings', 'Your review and approval', 'Deliver']) assert.ok(card.includes(t), t);
  assert.deepEqual([...card.matchAll(/<li data-flag="(\w+)">([^<]+)<\/li>/g)].map((m) => ({ issue: m[1], title: m[2] })), h.issues);
  assert.ok(card.includes(`data-rl="summary">${heroLine()}<`), 'static AI line matches the engine');
  assert.match(card, /Nothing is shared or changed until you decide\./);
  assert.match(card, /unlock after release/);
  assert.match(card, /AI &middot; simulated/);
  assert.match(card, /Fictional sample data/);
  assert.match(html, /<figcaption class="rl-tagline">Automation does the repetitive work\. Rules check the data\. AI helps explain what needs attention\. You stay in control\.<\/figcaption>/);
});

test('hero script: real buttons for review, provisional, hold and final approval, sharing the example’s state', async () => {
  const js = await readFile(new URL('../src/demo/hero.js', import.meta.url), 'utf8');
  for (const a of ['review', 'provisional', 'hold', 'final', 'reopen', 'open']) assert.match(js, new RegExp(`data-hero-act="${a}"`), a);
  for (const t of ['Review flagged items', 'Release as provisional', 'Keep on hold', 'Approve final report']) assert.ok(js.includes(t), t);
  assert.match(js, /from '\.\/store\.js'/);
  const ui = await readFile(new URL('../src/demo/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /from '\.\/store\.js'/);
  assert.doesNotMatch(ui, /Book a free rework review/, 'booking stays in the strip after the demo');
  for (const t of ['A flag isn&rsquo;t an error until you say so.', 'What was detected', 'Rule or comparison', 'What to check', 'To stop it happening again:', 'Back to approval']) assert.ok(ui.includes(t), t);
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

test('live example intro and no-JavaScript fallback: four findings, history, the 40% demonstration rule', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="samples"'), html.indexOf('id="experience"'));
  assert.match(sec, /<h2 id="samples-h">See how the checks work<\/h2>/);
  assert.match(sec, /checked against four weeks of sales history/);
  assert.match(sec, /A flag isn&rsquo;t an error until you say so/);
  const st = sec.slice(sec.indexOf('class="demo-static"'));
  for (const t of ['S-1043 and S-1051', 'S-1047', 'Unusual Tuesday sales', '2,455', '1,550', '58%', '40%', '1,595', 'R-205', 'demonstration data']) assert.ok(st.includes(t), t);
});

test('Data & Reporting output sample: the engine’s final outputs after a full review, with no trend chart', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('data-pv-figure="output"'), html.indexOf('</figure>', html.indexOf('data-pv-figure="output"')));
  const s = setRelease(with_(['duplicate', 'remove'], ['missing', 'fullAmount'], ['followUp', 'assign']), 'final');
  const o = outputs(s); const r = report(s);
  const val = (k) => fig.match(new RegExp(`data-po="${k}">([^<]*)<`))[1];
  assert.deepEqual([val('salesTotal'), val('recordedTotal'), val('paymentsTotal'), val('owed'), val('openRequests')],
    [o.report.salesTotal, o.report.recordedTotal, o.report.paymentsTotal, r.owed, r.openRequests].map((x) => x.toLocaleString('en-US')));
  assert.equal(val('review'), `${r.review.resolved} findings resolved`);
  assert.equal(val('task'), `${o.task.id}: ${o.task.text} (${o.task.owner})`);
  for (const d of o.dashboard.daily) assert.match(fig, new RegExp(`data-po-day="${d.day}">${d.total.toLocaleString('en-US')} `), d.day);
  assert.match(html, /<summary>See an example output<\/summary>/);
  assert.doesNotMatch(fig, /trend|data-pv-go/i);
});

test('Workflows preview: the R-205 quote request, AI simulated, nothing sent until you approve', async () => {
  const html = await page();
  const wf = html.slice(html.indexOf('<h3>Workflows &amp; Processes</h3>'), html.indexOf('<h3>Business Tools &amp; Systems</h3>'));
  for (const t of ['AI that reads your emails and documents', 'Sample &middot; AI simulated', '>You<', 'Approve the reply', 'Request R-205', 'Northside Partners']) assert.ok(wf.includes(t), t);
  assert.equal((wf.match(/<li><strong>/g) || []).length, 5);
  assert.doesNotMatch(wf, /Sarah|Kitchen|Westside|Enquiry 2031/);
  const pv = await readFile(new URL('../src/previews.js', import.meta.url), 'utf8');
  assert.match(pv, /nothing was sent until you approved it/);
});

test('Business Tools preview: generic booking, no trade examples', async () => {
  const html = await page();
  const bt = html.slice(html.indexOf('<h3>Business Tools &amp; Systems</h3>'), html.indexOf('class="svc-choose"'));
  assert.match(bt, /Intro call/);
  assert.doesNotMatch(html, /Leaking tap|Gutter repair|Kitchen tap/i);
});

test('privacy notice: fictional data incl. history, simulated release and AI, nothing stored or sent', async () => {
  const html = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('<h2>The examples on the homepage</h2>'), html.indexOf('<h2>When you contact me</h2>'));
  for (const t of ['See how the checks work', 'sales history', 'Releasing a report, refreshing the dashboard or creating a follow-up task there is simulated', 'not in cookies, local storage or session storage', 'not connected to any accounting, finance, work-tracking or other business system', 'no AI runs on this page']) assert.ok(sec.includes(t), t);
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

