// Live example tests (sales / payments / requests sample, 10 Nov 2026 redesign).
// Every number the hero card, the three-tab example and the Data & Reporting preview show comes from
// src/demo/engine.js working on src/demo/data.js. These tests pin the dataset, the three findings and their rules,
// every decision and combination, reset, and that the page shows the engine's numbers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as DATA from '../src/demo/data.js';
import { SALES, PAYMENTS, REQUESTS, SOURCES, ISSUES, CONSEQUENCE } from '../src/demo/data.js';
import {
  initialState, sourceCounts, runChecks, findings, decide, allDecided, status, report, stillOwed, confirmedTotal,
  heroSummary, aiSummary, weekRange, workingDaysOpen, ISSUE_IDS,
} from '../src/demo/engine.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const sum = (rows) => rows.reduce((t, r) => t + (r.amount ?? 0), 0);
const all = (duplicate, missing, followUp) => ({ decisions: { duplicate, missing, followUp } });

// ---- The dataset

test('sources: sales log 12, payments 9, requests 6 → 27 records from 3 sources', () => {
  assert.deepEqual(sourceCounts(), { sales: 12, payments: 9, requests: 6, total: 27, sources: 3 });
  assert.deepEqual(SOURCES.map((s) => s.id), ['sales', 'payments', 'requests']);
});

test('the dataset reconciles: 4,310 recorded, 2,980 paid, 3 closed and 3 open requests', () => {
  assert.equal(sum(SALES), 4310, 'sales total as recorded (one amount blank)');
  assert.equal(SALES.filter((s) => s.amount !== null).length, 11);
  assert.equal(sum(PAYMENTS), 2980);
  assert.equal(REQUESTS.filter((r) => r.status === 'Closed').length, 3);
  assert.equal(REQUESTS.filter((r) => r.status === 'Open').length, 3);
  assert.equal(new Set([...SALES, ...PAYMENTS, ...REQUESTS].map((r) => r.id)).size, 27, 'every reference is unique');
});

test('every payment points at a real sale, for the same customer, and matches its amount unless the amount is blank', () => {
  for (const p of PAYMENTS) {
    const s = SALES.find((x) => x.id === p.sale);
    assert.ok(s, `${p.id} pays a sale that exists`);
    assert.equal(p.customer, s.customer, p.id);
    if (s.amount !== null) assert.equal(p.amount, s.amount, p.id);
  }
  assert.equal(PAYMENTS.filter((p) => p.sale === 'S-1043').length, 1, 'only one payment for the duplicated sale');
  assert.equal(PAYMENTS.filter((p) => p.sale === 'S-1051').length, 0);
});

test('the checks find exactly the three planted issues, each by its stated rule', () => {
  assert.deepEqual(runChecks(), { duplicates: [['S-1043', 'S-1051']], missing: ['S-1047'], followUp: ['R-205'] });
  const [a, b] = ['S-1043', 'S-1051'].map((id) => SALES.find((s) => s.id === id));
  assert.deepEqual([a.customer, a.date, a.amount], [b.customer, b.date, b.amount], 'same customer, date and amount');
  assert.notEqual(a.from, b.from, 'entered from different places');
  const r = REQUESTS.find((x) => x.id === 'R-205');
  assert.deepEqual([r.status, r.owner, r.next, workingDaysOpen(r)], ['Open', '', '', 4]);
  for (const x of REQUESTS.filter((q) => q.status === 'Open' && q.id !== 'R-205')) assert.ok(x.next && x.owner, `${x.id} has an owner and next action`);
});

test('unpaid sales within the week (S-1049, S-1052) are not flagged', () => {
  const flagged = Object.values(runChecks()).flat(2);
  for (const id of ['S-1049', 'S-1052']) assert.ok(!flagged.includes(id), id);
});

test('each finding carries the rows behind it, its rule, why it matters, a suggested action and two choices', () => {
  const fs = findings();
  assert.deepEqual(fs.map((f) => f.issue), ISSUE_IDS);
  const [dup, mis, fol] = fs;
  assert.deepEqual(dup.records.sales.map((r) => r.id), ['S-1043', 'S-1051']);
  assert.deepEqual(dup.records.payments.map((p) => p.id), ['P-303']);
  assert.deepEqual([mis.payment.id, mis.payment.amount], ['P-307', 380]);
  assert.equal(fol.record.customer, 'Northside Partners');
  for (const f of fs) {
    for (const k of ['rule', 'why', 'action', 'prevent', 'title']) assert.ok(f[k], `${f.issue} ${k}`);
    assert.equal(f.choices.length, 2);
  }
  assert.match(dup.why, /860 too high/);
  assert.match(mis.why, /P-307 shows 380/);
  assert.match(fol.why, /Monday\. 4 working days later/);
  assert.deepEqual(fs.map((f) => f.prevent), [
    'Check for an existing sale before adding a new one.',
    'Make the amount a required field.',
    'Require an owner and a next action when a request is logged.',
  ]);
});

test('the duplicate is described as potential, never confirmed', () => {
  const text = JSON.stringify(DATA, (k, v) => (typeof v === 'function' ? v({ ids: ['A', 'B'], amount: 1, payment: { id: 'P', amount: 1 }, record: { customer: 'C' }, days: 1, receivedDay: 'Monday' }) : v));
  assert.match(ISSUES.duplicate.title, /^Potential duplicate$/);
  assert.doesNotMatch(text, /confirmed duplicate|is a duplicate|Duplicate found/i);
});

// ---- The report and the decisions

test('before any decision: 4,310 from 12 sales (1 with no amount), 2,980 paid, 3 open requests, 3 to check', () => {
  const r = report(initialState());
  assert.deepEqual(r, { salesCount: 12, salesTotal: 4310, missingAmounts: 1, paymentsCount: 9, paymentsTotal: 2980, openRequests: 3, noNextAction: 1, toCheck: 3, owed: 1710, status: 'Review required' });
});

test('confirming both sales checks: 4,310 − 860 + 380 = 3,830, and 3,830 − 2,980 = 850 still owed (S-1049 + S-1052)', () => {
  assert.equal(confirmedTotal(), 3830);
  const s = all('remove', 'usePayment', 'assign');
  const r = report(s);
  assert.equal(r.salesTotal, 3830);
  assert.equal(r.salesTotal - r.paymentsTotal, 850);
  assert.deepEqual(stillOwed(s), { rows: [{ id: 'S-1049', customer: 'Riverside Group', owed: 520 }, { id: 'S-1052', customer: 'Harper & Co.', owed: 330 }], total: 850 });
  assert.equal(r.status, 'Ready to share');
});

test('all eight decision combinations give the expected report', () => {
  const cases = [
    ['remove', 'usePayment', 'assign', 3830, 11, 0, 3, 850, 'Ready to share'],
    ['remove', 'usePayment', 'handled', 3830, 11, 0, 2, 850, 'Ready to share'],
    ['remove', 'checkFirst', 'assign', 3450, 11, 1, 3, 850, 'Follow-up pending'],
    ['remove', 'checkFirst', 'handled', 3450, 11, 1, 2, 850, 'Follow-up pending'],
    ['keep', 'usePayment', 'assign', 4690, 12, 0, 3, 1710, 'Ready to share'],
    ['keep', 'usePayment', 'handled', 4690, 12, 0, 2, 1710, 'Ready to share'],
    ['keep', 'checkFirst', 'assign', 4310, 12, 1, 3, 1710, 'Follow-up pending'],
    ['keep', 'checkFirst', 'handled', 4310, 12, 1, 2, 1710, 'Follow-up pending'],
  ];
  for (const [d, m, f, total, count, missing, open, owed, st] of cases) {
    const r = report(all(d, m, f));
    assert.deepEqual([r.salesTotal, r.salesCount, r.missingAmounts, r.openRequests, r.noNextAction, r.toCheck, r.owed, r.status], [total, count, missing, open, 0, 0, owed, st], `${d}/${m}/${f}`);
  }
});

test('decisions: only the offered choices count; null clears; order does not matter; source rows never change', () => {
  const before = JSON.stringify([SALES, PAYMENTS, REQUESTS]);
  let s = initialState();
  assert.equal(decide(s, 'duplicate', 'merge'), s, 'not an offered choice');
  assert.equal(decide(s, 'nope', 'remove'), s);
  s = decide(s, 'duplicate', 'remove');
  assert.equal(report(s).toCheck, 2);
  assert.equal(allDecided(s), false);
  s = decide(s, 'duplicate', null);
  assert.deepEqual(s, initialState());
  const a = decide(decide(decide(initialState(), 'duplicate', 'keep'), 'missing', 'usePayment'), 'followUp', 'handled');
  const b = decide(decide(decide(initialState(), 'followUp', 'handled'), 'missing', 'usePayment'), 'duplicate', 'keep');
  assert.deepEqual(report(a), report(b));
  assert.equal(JSON.stringify([SALES, PAYMENTS, REQUESTS]), before);
});

test('every choice has a consequence line, and choosing shows it on the finding', () => {
  for (const issue of Object.values(ISSUES)) for (const [c] of issue.choices) assert.equal(typeof CONSEQUENCE[c], 'function', c);
  const f = findings(all('remove', null, null))[0];
  assert.equal(f.consequence, 'Removed S-1051. The sales total drops by 860.');
  assert.equal(status(all('remove', 'usePayment', null)), 'Review required');
});

test('wording: first person only (no "we"), no trades or job-business words, no currency symbols', () => {
  const text = JSON.stringify(DATA, (k, v) => (typeof v === 'function' ? v({ ids: ['A', 'B'], amount: 1, payment: { id: 'P', amount: 1 }, record: { customer: 'C' }, days: 1, receivedDay: 'Monday' }) : v));
  assert.doesNotMatch(text, /\b(we|we're|we've|we'll|our|us)\b/i);
  assert.doesNotMatch(text, /quillfern|repair|technician|leak|gutter|tap\b|job/i);
  assert.doesNotMatch(text, /[$₱€£]/);
});

// ---- The sample week

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const asDate = (label) => {
  const [dow, d, mon] = label.split(' ');
  assert.equal(mon, 'Nov', label);
  const dt = new Date(Date.UTC(2026, 10, Number(d)));
  assert.equal(DAYS[dt.getUTCDay()], dow, `${label} is a ${DAYS[dt.getUTCDay()]}`);
  return dt;
};

test('the sample week ends Fri 6 Nov 2026, and every date is a real weekday inside it', () => {
  assert.equal(DATA.WEEK, 'Week ending Fri 6 Nov 2026');
  assert.equal(weekRange(DATA.WEEK), '2–6 November 2026');
  const start = asDate('Mon 2 Nov'); const end = asDate('Fri 6 Nov');
  for (const d of [...SALES.map((x) => x.date), ...PAYMENTS.map((x) => x.date), ...REQUESTS.map((x) => x.received)]) {
    const dt = asDate(d); assert.ok(dt >= start && dt <= end, d);
  }
  for (const p of PAYMENTS) assert.ok(asDate(p.date) >= asDate(SALES.find((s) => s.id === p.sale).date), `${p.id} is paid on or after its sale`);
});

test('the demo window shows the same week as the data', async () => {
  const html = await page();
  const m = html.match(/<span class="dw-status" data-week>([^<]*)</);
  assert.ok(m); assert.equal(m[1], DATA.WEEK);
});

// ---- The page

test('hero: headline kept, the new supporting copy, booking first, no service chips', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<figure'));
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\.<\/span>/);
  assert.ok(hero.includes('Rebuilding the same report every Monday? Chasing updates because nobody knows who&rsquo;s responsible for the next step? I help small businesses fix the reports, spreadsheets and routine tasks their teams keep redoing by hand, so you can trust the numbers and see what needs attention.'));
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('Explore the live example'));
  assert.match(hero, /A 30-minute call about one report or process<span class="cta-micro-sep"> &middot; <\/span><span class="cta-micro-2">Free &middot; No obligation<\/span>/);
  assert.doesNotMatch(hero, /small service businesses|hero-chips|Clearer reports/);
});

test('the 30-minute claim matches the booking setup', async () => {
  const { RULES } = await import('../src/booking/slots.js');
  assert.equal(RULES.slotMinutes, 30);
});

test('hero card: the engine’s figures, the sheet rows match the data, three issues with their sources', async () => {
  const html = await page();
  const card = html.slice(html.indexOf('id="hero-sheet"'), html.indexOf('</figure>'));
  const h = heroSummary();
  for (const [k, v] of Object.entries(h)) {
    if (typeof v === 'object') continue;
    for (const m of card.matchAll(new RegExp(`data-hero="${k}">([^<]*)<`, 'g'))) assert.equal(m[1], String(v), k);
  }
  for (const k of ['status', 'weekRange', 'sales', 'salesTotal', 'confirmedTotal', 'toCheck']) assert.match(card, new RegExp(`data-hero="${k}"`), k);
  assert.deepEqual([h.salesTotal, h.confirmedTotal, h.toCheck], ['4,310', '3,830', 3]);
  assert.match(card, /Can you trust this week&rsquo;s numbers\?/);
  // every row on the sheet is a real sales row
  const rows = [...card.matchAll(/<tr class="hs-row[^"]*"[^>]*><td>(S-\d+)<\/td><td>(\w+ \d+)<\/td><td>([^<]+)<\/td><td class="hs-num[^"]*">([^<]*)<\/td>/g)];
  assert.equal(rows.length, 5);
  for (const [, id, date, customer, amount] of rows) {
    const s = SALES.find((x) => x.id === id);
    assert.ok(s.date.startsWith(date), id); assert.equal(customer, s.customer, id);
    assert.equal(amount, s.amount === null ? '' : String(s.amount), id);
  }
  assert.match(card, /\+ 7 more rows/); assert.equal(rows.length + 7, SALES.length);
  const lines = [...card.matchAll(/data-hero-issue="(\w+)"><strong>([^<]*)<\/strong> <span>([^<]*)<\/span>/g)].map((m) => ({ issue: m[1], title: m[2], source: m[3] }));
  assert.deepEqual(lines, h.issues);
  assert.match(card, /<p class="tz-date">Fictional sample data &middot; <span data-hero="weekRange">/);
  assert.match(card, /data-demo-tab="exceptions">See how these were found/);
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
  for (const id of ['svc-data', 'svc-workflow', 'svc-systems']) assert.match(html, new RegExp(`<li class="svc-step ${id}" id="${id}">`));
  assert.match(fit, /Good people shouldn&rsquo;t have to fight their own processes\./);
});

test('live example: renamed heading, three tabs, decisions with "you decide", prevention lines, no five stages', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="samples"'), html.indexOf('id="experience"'));
  assert.match(sec, /<h2 id="samples-h">See how the checks work<\/h2>/);
  assert.ok(sec.includes('This is a fictional example using made-up data.'));
  assert.match(sec, /27 records across a sales log, payments received and customer requests/);
  assert.doesNotMatch(sec, /Investigate the report|Your role|demo-role/);
  const ui = await readFile(new URL('../src/demo/ui.js', import.meta.url), 'utf8');
  for (const t of ['What’s happening?', 'What needs attention?', 'Where did the information come from?', 'The report flags it. You decide.', 'To stop it happening again:', 'Why it was flagged', 'Suggested next action']) assert.ok(ui.includes(t), t);
  assert.doesNotMatch(ui, /Book a free rework review/, 'booking stays in the strip after the demo');
});

test('no-JavaScript fallback lists the same three findings', async () => {
  const html = await page();
  const st = html.slice(html.indexOf('class="demo-static"'), html.indexOf('class="demo-after"'));
  for (const t of ['S-1043 and S-1051', 'S-1047', 'R-205', '4,310', '2,980', '27'.slice(0, 0)]) assert.ok(st.includes(t), t);
});

test('Data & Reporting preview: the automated weekly run, with the AI summary built from the engine and held for approval', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('data-pv-figure="data"'), html.indexOf('</figure>', html.indexOf('data-pv-figure="data"')));
  const r = report(); const c = sourceCounts();
  const val = (k) => fig.match(new RegExp(`data-pva="${k}">([^<]*)<`))[1];
  assert.deepEqual([val('sales'), val('payments'), val('requests')], [String(c.sales), String(c.payments), String(c.requests)]);
  assert.deepEqual([val('salesTotal'), val('paymentsTotal'), val('openRequests')], ['4,310', '2,980', String(r.openRequests)]);
  const summary = [...fig.slice(fig.indexOf('data-pva-summary')).matchAll(/<p>([^<]*)<\/p>/g)].slice(0, 4).map((m) => m[1]);
  assert.deepEqual(summary, aiSummary());
  assert.match(fig, /Sample &middot; AI simulated/);
  assert.match(fig, /Nothing is shared until you do\./);
  assert.match(fig, /data-pv-go>Approve &amp; share</);
  assert.match(fig, /Every payment matched to a sale/);
  assert.ok(PAYMENTS.every((p) => SALES.some((s) => s.id === p.sale)), 'that check is true for the data');
  const pv = await readFile(new URL('../src/previews.js', import.meta.url), 'utf8');
  assert.match(pv, /nothing was shared until you approved it/);
});

test('Workflows preview: the stalled quote request, AI simulated, nothing sent until you approve', async () => {
  const html = await page();
  const wf = html.slice(html.indexOf('<h3>Workflows &amp; Processes</h3>'), html.indexOf('<h3>Business Tools &amp; Systems</h3>'));
  for (const t of ['AI that reads your emails and documents', 'AI summaries and quick answers', 'Automatic reminders, notifications and follow-ups', 'Sample &middot; AI simulated', '>You<', 'Approve the reply', 'Request R-205', 'Northside Partners', 'The quote request that stalled in the example above']) assert.ok(wf.includes(t), t);
  assert.equal((wf.match(/<li><strong>/g) || []).length, 5, 'five items');
  assert.doesNotMatch(wf, /Sarah|Kitchen|Westside|Enquiry 2031/);
  assert.match(html, /A person reviews anything that matters before it&#39;s sent or changed\./);
  const pv = await readFile(new URL('../src/previews.js', import.meta.url), 'utf8');
  assert.match(pv, /nothing was sent until you approved it/);
});

test('Business Tools preview: generic booking, no trade examples', async () => {
  const html = await page();
  const bt = html.slice(html.indexOf('<h3>Business Tools &amp; Systems</h3>'), html.indexOf('class="svc-choose"'));
  assert.match(bt, /Intro call/); assert.match(bt, /Bookings/);
  assert.doesNotMatch(bt, /Leaking tap|Gutter|Job sheet/i);
  assert.doesNotMatch(html, /Leaking tap|Gutter repair|Kitchen tap/i);
});

test('privacy notice describes the new example and the simulated AI steps', async () => {
  const html = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('<h2>The examples on the homepage</h2>'), html.indexOf('<h2>When you contact me</h2>'));
  assert.match(sec, /See how the checks work/);
  assert.match(sec, /customers, sales, payments, requests/);
  assert.match(sec, /not connected to any accounting, finance, work-tracking or other business system/);
  assert.match(sec, /not in cookies, local storage or session storage/);
  assert.match(sec, /The AI steps in the reporting and workflow examples are simulated; no AI runs on this page\./);
  assert.doesNotMatch(sec, /merging two records|better way of working|Weekly operations snapshot/);
  assert.match(html, /<h2>When you contact me<\/h2>[\s\S]*Booking a review/);
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

