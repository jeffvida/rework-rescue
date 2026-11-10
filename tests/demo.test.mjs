// Management reporting demo tests (spec 10 Nov 2026). Every figure the hero, Findings, Sources, the Management Summary,
// the published report, the action register and the Data & Reporting output sample show comes from
// src/demo/engine.js working on src/demo/data.js. Numbered comments map to the spec's acceptance list (14.1–14.20).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as DATA from '../src/demo/data.js';
import { WORK, INVOICES, REQUESTS, SOURCES, ISSUES, STAFF } from '../src/demo/data.js';
import {
  initialState, sourceCounts, runChecks, qualityChecks, totalsChecks, metrics, findings, decide, canDecide, statusOf, basisOf,
  blockers, disclosures, readiness, publish, status, summary, actionRegister, heroCard, published, workingWork, attentionCount,
  toIso, dayOf, ISSUE_IDS, STATUS_LABELS, CLOSED, AI_LABEL,
} from '../src/demo/engine.js';

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = () => readFile(new URL('../assets/styles.css', import.meta.url), 'utf8');
const with_ = (...steps) => steps.reduce((s, [i, c, d]) => (c === null || c === undefined ? s : decide(s, i, c, d)), initialState());
// One full review: duplicate excluded, invoicing outstanding, overdue confirmed, W-1056 assigned to Ana.
const reviewed = () => with_(['duplicate', 'exclude'], ['invoice', 'outstanding'], ['overdue', 'confirm'], ['owner', 'assign', { owner: 'Ana', next: 'Call the customer' }]);
const st = (s) => Object.fromEntries(ISSUE_IDS.map((i) => [i, statusOf(s, i)]));

// ---- Dataset (14.3, 14.4, 14.5)

test('three sources: Work Register 18, Invoice Tracker 7, Customer Requests 10; unique references; frozen', () => {
  assert.deepEqual(sourceCounts(), { work: 18, invoices: 7, requests: 10, total: 35, sources: 3 });
  assert.deepEqual(SOURCES.map((x) => x.name), ['Work Register', 'Invoice Tracker', 'Customer Requests']);
  const ids = [...WORK, ...INVOICES, ...REQUESTS].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const a of [WORK, INVOICES, REQUESTS]) { assert.ok(Object.isFrozen(a) && a.every(Object.isFrozen)); }
  assert.throws(() => { WORK[0].status = 'Open'; });
});

test('14.3–14.5: 18 records, 7 recorded completed and 11 open; completions Mon 1, Tue 2, Wed 1, Thu 2, Fri 1 = 7', () => {
  const m = metrics();
  assert.deepEqual([m.sourceRecords, m.recordedCompleted, m.recordedOpen], [18, 7, 11]);
  assert.deepEqual(m.daily.map((d) => [d.day, d.completed]), [['Mon', 1], ['Tue', 2], ['Wed', 1], ['Thu', 2], ['Fri', 1]]);
  assert.equal(m.dailyTotal, 7);
  // calculated from the records themselves
  assert.equal(WORK.filter((w) => w.status === 'Completed').length, 7);
  for (const d of m.daily) assert.equal(WORK.filter((w) => w.completed && dayOf(w.completed) === d.day).length, d.completed, d.day);
  assert.equal(m.unique, null, 'unique work items are not claimed before the duplicate is reviewed');
  assert.equal(m.completionRate, null);
});

test('each source keeps its own date format; consolidation standardises them without changing the originals', () => {
  assert.equal(toIso('2026-11-03'), '2026-11-03'); assert.equal(toIso('03/11/2026'), '2026-11-03'); assert.equal(toIso('Tue 3 Nov'), '2026-11-03');
  assert.equal(toIso('31/02/2026'), ''); assert.equal(toIso('Wed 3 Nov'), '', 'wrong weekday is invalid');
  assert.ok(INVOICES.every((i) => /^\d{2}\/\d{2}\/\d{4}$/.test(i.date)));
  assert.ok(REQUESTS.every((r) => /^\w{3} \d{1,2} Nov$/.test(r.received)));
});

// ---- Detection (14.6–14.9) and data quality

test('detection finds exactly the four demonstration findings and nothing else', () => {
  assert.deepEqual(runChecks(), { duplicates: [['W-1043', 'W-1051']], unmatched: ['W-1047'], overdue: ['W-1055'], unowned: ['W-1056'] });
  assert.deepEqual(findings().map((f) => [f.issue, f.ids.join('/')]), [['duplicate', 'W-1043/W-1051'], ['invoice', 'W-1047'], ['overdue', 'W-1055'], ['owner', 'W-1056']]);
});

test('duplicate detection matches on customer, address, job type and scheduled date even though references differ', () => {
  const [a, b] = ['W-1043', 'W-1051'].map((id) => WORK.find((w) => w.id === id));
  for (const k of ['customer', 'address', 'jobType', 'scheduled']) assert.equal(a[k], b[k], k);
  assert.notEqual(a.id, b.id); assert.equal(a.request, b.request);
});

test('E. data quality: seven checks run on the original sources and all pass; none changes a value', () => {
  const snap = JSON.stringify([WORK, INVOICES, REQUESTS]);
  const q = qualityChecks();
  assert.deepEqual(q.map((c) => c.id), ['required', 'dates', 'ids', 'status', 'customers', 'formats', 'links']);
  assert.ok(q.every((c) => c.pass));
  assert.equal(JSON.stringify([WORK, INVOICES, REQUESTS]), snap);
});

// ---- Classification and statuses (8)

test('every finding has a classification, a gate type, a suggested team and starts as "Needs investigation"', () => {
  assert.deepEqual(findings().map((f) => [f.categoryLabel, f.blocking, f.team, f.statusLabel]), [
    ['Data integrity issue', true, 'Data/Admin', 'Needs investigation'],
    ['Reconciliation issue', false, 'Finance', 'Needs investigation'],
    ['Operational exception', false, 'Operations', 'Needs investigation'],
    ['Operational exception', false, 'Operations', 'Needs investigation'],
  ]);
  assert.deepEqual(Object.values(STATUS_LABELS).slice(0, 5), ['Needs investigation', 'Resolved', 'Confirmed legitimate', 'Action required', 'Accepted with disclosure']);
});

test('each finding shows what, why, source reference, supporting data, AI possible explanation and investigation steps', () => {
  for (const f of findings()) {
    for (const k of ['detected', 'matters', 'source', 'ai']) assert.ok(f[k]?.length > 10, `${f.issue} ${k}`);
    assert.ok(f.supporting.length >= 2 && f.investigate.length >= 2, f.issue);
    for (const ref of Object.values(f.refs).flat()) assert.ok([...WORK, ...INVOICES, ...REQUESTS].some((r) => r.id === ref), `${f.issue} ref ${ref} exists`);
    assert.match(f.ai, /^Possible explanation:/); assert.match(f.ai, /\b(may|likely but not confirmed)\b/);
  }
});

test('opening or viewing a finding never changes its status; only a decision does', () => {
  const s = initialState(); findings(s); workingWork(s); readiness(s);
  assert.deepEqual(Object.values(st(s)), ['investigate', 'investigate', 'investigate', 'investigate']);
});

// ---- Reviewer decisions (14.6–14.9, 14.11)

test('14.6: confirming the duplicate excludes W-1051 from unique counts, keeps the record and recalculates', () => {
  const s = with_(['duplicate', 'exclude']);
  const m = metrics(s);
  assert.deepEqual([m.sourceRecords, m.unique, m.completed, m.open, m.completionRate], [18, 17, 7, 10, '41%']);
  assert.equal(workingWork(s).length, 18, 'the record is kept');
  assert.deepEqual(workingWork(s).filter((w) => w.excluded).map((w) => w.id), ['W-1051']);
  assert.equal(statusOf(s, 'duplicate'), 'resolved');
  const sep = metrics(with_(['duplicate', 'separate']));
  assert.deepEqual([sep.unique, sep.open, sep.completionRate, statusOf(with_(['duplicate', 'separate']), 'duplicate')], [18, 11, '39%', 'legitimate']);
  const dis = with_(['duplicate', 'disclose', { note: 'Possible duplicate still being checked' }]);
  assert.deepEqual([metrics(dis).unique, metrics(dis).completionRate, statusOf(dis, 'duplicate')], [18, null, 'disclosed']);
  assert.equal(canDecide(initialState(), 'duplicate', 'disclose', { note: ' ' }).ok, false, 'a disclosure needs its wording');
});

test('14.7: reconciliation — link INV-2107 (resolved), invoicing outstanding (action required) or leave unresolved', () => {
  const link = with_(['invoice', 'link']);
  assert.deepEqual([statusOf(link, 'invoice'), runChecks(link).unmatched, metrics(link).awaitingInvoice], ['resolved', [], 0]);
  assert.equal(INVOICES.find((i) => i.id === 'INV-2107').work, '', 'the invoice record itself is not edited');
  assert.equal(statusOf(with_(['invoice', 'outstanding']), 'invoice'), 'action');
  assert.equal(statusOf(with_(['invoice', 'leave']), 'invoice'), 'investigate');
});

test('14.8: overdue — confirm (action required), correct the due date from R-308 (resolved, original kept), or assign a follow-up', () => {
  assert.equal(statusOf(with_(['overdue', 'confirm']), 'overdue'), 'action');
  const fix = with_(['overdue', 'correctDate']);
  const w = workingWork(fix).find((x) => x.id === 'W-1055');
  assert.deepEqual([w.due, w.changes[0].from, w.changes[0].evidence, statusOf(fix, 'overdue'), runChecks(fix).overdue], ['2026-11-13', '2026-11-04', 'R-308', 'resolved', []]);
  assert.equal(WORK.find((x) => x.id === 'W-1055').due, '2026-11-04');
  assert.equal(canDecide(initialState(), 'overdue', 'assign', {}).ok, false);
  const a = with_(['overdue', 'assign', { owner: 'Carla' }]);
  assert.deepEqual([statusOf(a, 'overdue'), runChecks(a).overdue], ['action', ['W-1055']], 'a follow-up does not make it on time');
});

test('14.9: ownership — assign needs a person and next action; handled needs an explanation; leave = action required', () => {
  assert.equal(canDecide(initialState(), 'owner', 'assign', { owner: 'Ana' }).ok, false);
  assert.equal(canDecide(initialState(), 'owner', 'assign', { owner: 'Zed', next: 'x' }).ok, false);
  assert.equal(canDecide(initialState(), 'owner', 'handled', { note: '' }).ok, false);
  const a = with_(['owner', 'assign', { owner: 'Ana', next: 'Call the customer' }]);
  assert.deepEqual([statusOf(a, 'owner'), runChecks(a).unowned], ['resolved', []]);
  const h = with_(['owner', 'handled', { note: 'Ben called them Thu' }]);
  assert.deepEqual([statusOf(h, 'owner'), runChecks(h).unowned], ['resolved', []]);
  assert.equal(statusOf(with_(['owner', 'leave']), 'owner'), 'action');
  assert.deepEqual(STAFF, ['Ana', 'Ben', 'Carla']);
});

// ---- Publication gate (14.15–14.18)

test('14.15: the unresolved duplicate blocks publication; publish() is refused and the reason is explained', () => {
  const s0 = initialState();
  assert.equal(status(s0), 'Review required');
  assert.equal(publish(s0), s0);
  assert.equal(blockers(s0).length, 1);
  assert.match(blockers(s0)[0].text, /Potential duplicate work order \(W-1043 \/ W-1051\): affects the unique work-item count/);
  // operational decisions alone never unblock it
  const ops = with_(['invoice', 'link'], ['overdue', 'correctDate'], ['owner', 'assign', { owner: 'Ben', next: 'Call' }]);
  assert.equal(readiness(ops).ready, false);
  assert.equal(published(publish(ops)), null);
});

test('14.16: operational exceptions do not block; they are disclosed in the published report', () => {
  const s = with_(['duplicate', 'exclude']);
  assert.equal(status(s), 'Ready for approval');
  assert.deepEqual(disclosures(s).map((d) => [d.issue, d.label]), [['invoice', 'Needs investigation'], ['overdue', 'Needs investigation'], ['owner', 'Needs investigation']]);
  const p = publish(s);
  assert.equal(status(p), 'Published');
  assert.deepEqual(published(p).disclosures.map((d) => d.issue), ['invoice', 'overdue', 'owner']);
  assert.match(p.log.at(-1).reason, /with 3 disclosed items/);
  const dis = publish(with_(['duplicate', 'disclose', { note: 'Possible duplicate still being checked' }]));
  assert.equal(status(dis), 'Published', 'a blocking issue may be accepted with an explicit disclosure');
  assert.equal(published(dis).disclosures[0].note, 'Possible duplicate still being checked');
});

test('every automatic totals check passes on every decision path', () => {
  for (const dup of ['exclude', 'separate', 'disclose']) for (const inv of ['link', 'outstanding', 'leave']) for (const od of ['confirm', 'correctDate']) {
    const s = with_(['duplicate', dup, { note: 'n' }], ['invoice', inv], ['overdue', od]);
    assert.ok(totalsChecks(s).every((c) => c.pass), `${dup}/${inv}/${od}`);
    assert.equal(readiness(s).ready, true);
  }
});

test('14.17: the published output equals the approved report: figures, summary and register', () => {
  const p = publish(reviewed());
  const out = published(p);
  assert.deepEqual(out.metrics, metrics(p));
  assert.deepEqual(out.register, actionRegister(p));
  assert.deepEqual([out.metrics.unique, out.metrics.completed, out.metrics.open, out.metrics.completionRate], [17, 7, 10, '41%']);
  assert.equal(published(reviewed()), null, 'nothing is unlocked before publication');
});

test('14.18: a decision change after publishing withdraws it, recalculates, and needs a new approval', () => {
  const p = publish(reviewed());
  const c = decide(p, 'duplicate', 'separate');
  assert.deepEqual([c.published, status(c), published(c)], [null, 'Changed since publishing', null]);
  assert.equal(metrics(c).unique, 18);
  assert.equal(c.log.at(-1).type, 'publish-withdrawn');
  const again = publish(c);
  assert.equal(status(again), 'Published');
  assert.equal(published(again).metrics.unique, 18);
});

// ---- Audit trail and invalidation

test('the decision log is append-only and frozen; refused actions add nothing', () => {
  let s = initialState(); const steps = [s];
  for (const f of [(x) => decide(x, 'duplicate', 'exclude'), (x) => decide(x, 'invoice', 'outstanding'), publish, (x) => decide(x, 'invoice', 'link'), publish]) { s = f(s); steps.push(s); }
  for (let i = 1; i < steps.length; i++) { steps[i - 1].log.forEach((e, k) => assert.equal(steps[i].log[k], e)); assert.ok(steps[i].log.length > steps[i - 1].log.length); }
  assert.deepEqual(s.log.map((e) => e.type), ['decision', 'decision', 'published', 'changed', 'publish-withdrawn', 'published']);
  assert.ok(Object.isFrozen(s.log) && s.log.every(Object.isFrozen));
  const s0 = initialState();
  for (const t of [publish(s0), decide(s0, 'owner', 'assign', {}), decide(s0, 'invoice', 'nope'), decide(s0, 'duplicate', null)]) assert.equal(t, s0);
});

test('every decision records the basis it was made on; a stale basis reopens the finding and blocks if material', () => {
  const s = reviewed();
  for (const i of ISSUE_IDS) assert.equal(s.decisions[i].basis, basisOf(i));
  const tampered = { ...s, decisions: { ...s.decisions, duplicate: { ...s.decisions.duplicate, basis: 'old' } } };
  assert.equal(statusOf(tampered, 'duplicate'), 'stale');
  assert.equal(readiness(tampered).ready, false);
});

// ---- Summary, AI and register (14.12–14.14)

test('14.12–14.13: the AI-drafted summary follows the decisions and separates facts, potential issues, exceptions and unverified points', () => {
  assert.equal(AI_LABEL, 'AI-drafted · simulated in this demo');
  const s0 = summary();
  assert.match(s0.potential[0], /W-1043 and W-1051 may be the same work/);
  assert.ok(!s0.facts.some((x) => /unique/.test(x)), 'no unique count stated as fact before review');
  assert.match(s0.recommendations[0].text, /Reconcile W-1043 and W-1051/);
  const s1 = summary(reviewed());
  assert.match(s1.facts.join(' '), /17 unique work items, 7 completed and 10 open \(41% completion rate\)/);
  assert.deepEqual(s1.exceptions, ['W-1047 is completed and awaiting invoicing.', 'W-1055 is open and past its due date.']);
  assert.deepEqual(s1.recommendations.map((r) => r.team), ['Data/Admin', 'Finance', 'Operations']);
  assert.match(s1.executive[2], /Needs management attention: completed work without a matching invoice \(W-1047\); overdue open work \(W-1055\)/);
  const all = JSON.stringify([s0, s1, summary(with_(['invoice', 'link'], ['overdue', 'correctDate']))]);
  assert.doesNotMatch(all, /\b(caused by|definitely|approved by management)\b/i);
  // figures in the summary equal the calculated report
  assert.match(s1.executive[0], new RegExp(`${metrics(reviewed()).unique} unique work items`));
});

test('14.14: the action register matches the findings: suggested team, action, status; the spec’s initial statuses', () => {
  assert.deepEqual(actionRegister().map((r) => [r.team, r.action, r.status]), [
    ['Data/Admin', 'Verify original records', 'Needs review'],
    ['Finance', 'Check invoice tracker', 'Action required'],
    ['Operations', 'Review delay and next step', 'Action required'],
    ['Operations', 'Assign responsible person', 'Action required'],
  ]);
  assert.deepEqual(actionRegister(reviewed()).map((r) => r.status), ['Done', 'Action required', 'Action required', 'Done']);
  assert.match(actionRegister(reviewed())[3].action, /assigned to Ana/);
});

test('hero card data: source counts stay as received; attention count and status follow the decisions', () => {
  const c = heroCard();
  assert.deepEqual([c.status, c.sourceRecords, c.recordedCompleted, c.recordedOpen, c.attention], ['Review required', 18, 7, 11, 4]);
  const r = heroCard(reviewed());
  assert.deepEqual([r.status, r.sourceRecords, r.attention, r.byCategory.filter((x) => x.open).map((x) => x.issue)], ['Ready for approval', 18, 2, ['invoice', 'overdue']]);
  assert.equal(attentionCount(publish(reviewed())), 2, 'disclosed exceptions still require attention after publishing');
});

test('wording: first person only, no trade-specific words, no currency symbols or prices in the data', () => {
  const text = JSON.stringify(DATA);
  assert.doesNotMatch(text, /\b(we|we're|we've|we'll|our|us)\b/i);
  assert.doesNotMatch(text, /quillfern|repair|technician|leak|gutter|plumb/i);
  assert.doesNotMatch(text, /[$₱€£]|\bprice\b|amount/i);
});

// ---- The page

test('hero copy: eyebrow, headline, new supporting line, two website actions, personal introduction, booking info', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<figure'));
  assert.match(hero, /<p class="eyebrow hero-pill">Less rework\. More real work\.<\/p>/);
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\.<\/span>/);
  assert.match(hero, /<p class="hero-sub">I turn scattered business data and repetitive tasks into reliable reports and smoother workflows\.<\/p>/);
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('See how it works'));
  assert.match(hero, /href="#samples" data-demo-check>See how it works/);
  assert.match(hero, /A 30-minute call about one report or process/); assert.match(hero, /Free &middot; No obligation/);
  assert.match(html, /Jeff Herson Vida<\/a><span class="cred-role">8\+ years in data operations, reporting and process improvement\.<\/span><span class="cred-role">Work directly with me, from understanding the problem to building the solution\.<\/span>/);
});

test('hero visual: four stages, the report card with the spec’s exact values, two actions, and no detailed findings', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('<figure class="hero-preview hm'), html.indexOf('</figure>', html.indexOf('<figure class="hero-preview hm')));
  assert.deepEqual([...fig.matchAll(/<li class="hm-stage" data-stage="\d"><span class="hm-stage-ic">.*?<\/span><strong>(\w+)<\/strong>/g)].map((m) => m[1]), ['Collect', 'Consolidate', 'Validate', 'Analyse']);
  assert.match(fig, /<p class="hm-title">Weekly Management Report<\/p>/);
  assert.match(fig, /Reporting period: <span data-hero="period">2–6 November 2026<\/span> &middot; Fictional sample data/);
  assert.match(fig, /<p class="hm-status" data-hr="status" data-state="review">Awaiting review<\/p>/);
  const c = heroCard();
  const kpi = [...fig.matchAll(/<dt>([^<]+)<\/dt><dd data-hr="(\w+)">(\d+)<\/dd>/g)].map((m) => [m[1], m[2], Number(m[3])]);
  assert.deepEqual(kpi, [['Source records received', 'sourceRecords', c.sourceRecords], ['Recorded as completed', 'recordedCompleted', c.recordedCompleted], ['Recorded as open', 'recordedOpen', c.recordedOpen]]);
  assert.match(fig, /<p class="hm-chart-t">Work completed by day<\/p>/);
  const bars = [...fig.matchAll(/data-day="(\w+)"><rect class="hm-bar" x="[\d.]+" y="([\d.]+)" width="34" height="([\d.]+)"/g)].map((m) => [m[1], Number(m[3]) / 36]);
  assert.deepEqual(bars, c.daily.map((d) => [d.day, d.completed]));
  assert.doesNotMatch(fig, /is-flag|anomal|average/i, 'the chart is a performance overview, not an anomaly claim');
  assert.match(fig, /<strong data-hr="attention">4<\/strong> <span data-hr="attentionLabel">items requiring attention<\/span>/);
  assert.doesNotMatch(fig, /W-10\d\d|INV-|R-30/, 'no detailed findings in the hero');
  assert.match(fig, /data-hr="review"><svg[^>]*>.*?<\/svg>Review flagged items<\/a>/);
  assert.match(fig, /data-hr="publish" hidden><svg[^>]*>.*?<\/svg>Publish report<\/button>/);
  assert.equal((fig.match(/class="btn /g) || []).length, 2, 'no additional primary hero buttons');
  assert.match(fig, /Simulated in your browser\. Nothing is sent or changed\./);
  assert.doesNotMatch(fig, /\sstyle="/, 'CSP: no inline style attributes');
  for (const k of ['hm-flow', 'hm-drop']) assert.match(fig, new RegExp(`class="${k}" aria-hidden="true"`));
});

test('14.1, 14.2, 14.20: one ordered timeline of about 4–5 s; report after the workflow; reduced motion shows the final frame', async () => {
  const block = (await css()).slice((await css()).indexOf('/* ---- Hero: workflow + Weekly Management Report'));
  const start = (sel) => { const m = block.match(new RegExp(`\\.hm-play ${sel.replace(/[.[\]"=]/g, '\\$&')} \\{ animation[^;]*? ([\\d.]+)s both`)); return m ? Number(m[1]) : (sel === '.hm-stage' ? 0 : NaN); };
  const delay = (sel) => Number(block.match(new RegExp(`\\.hm-play ${sel.replace(/[.[\]"=]/g, '\\$&')} \\{ animation-delay: ([\\d.]+)s`))[1]);
  const order = [0, delay('.hm-stage[data-stage="2"]'), delay('.hm-stage[data-stage="3"]'), delay('.hm-stage[data-stage="4"]'), start('.hm-drop span'), start('.hm-card'), start('.hm-bar'), start('.hm-attn')];
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `stages → drop → card → bars → findings: ${order}`);
  let end = 0;
  for (const m of block.matchAll(/\.hm-play [^{]*\{[^}]*animation(?:-delay)?:([^;}]+)/g)) for (const part of m[1].split(',')) { const t = [...part.matchAll(/([\d.]+)s/g)].map((x) => Number(x[1])); if (t.length) end = Math.max(end, t.reduce((x, y) => x + y, 0)); }
  assert.ok(end >= 4 && end <= 5.2, `timeline ends at ${end}s`);
  assert.doesNotMatch(block, /infinite/);
  const rm = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)')).split('\n')[0];
  assert.ok(rm.includes('animation: none !important') && rm.includes('.hm-wait .hm-card') && rm.includes('opacity: 1'));
  const js = await readFile(new URL('../src/demo/hero.js', import.meta.url), 'utf8');
  assert.match(js, /prefers-reduced-motion: reduce/); assert.match(js, /io\.disconnect\(\)/);
  assert.doesNotMatch(js, /\.style\.|setAttribute\('style'/);
});

test('hero script: Review opens Findings; Publish runs the readiness check and needs approval; shared state', async () => {
  const js = await readFile(new URL('../src/demo/hero.js', import.meta.url), 'utf8');
  assert.match(js, /goTo\('findings'/); assert.match(js, /readiness\(s\)/); assert.match(js, /Not ready to publish\./); assert.match(js, /Approve and publish/);
  assert.match(js, /from '\.\/store\.js'/);
  const ui = await readFile(new URL('../src/demo/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /\['findings', 'Findings'[\s\S]*\['sources', 'Sources'[\s\S]*\['summary', 'Management Summary'/);
  for (const t of ['What was detected', 'Why it matters', 'Original source', 'Supporting data', 'Possible explanation', 'Suggested investigation', 'Reviewer decision', 'View source', 'Back to the finding', 'A. Executive summary', 'B. Performance overview', 'C. Key findings', 'D. Business implications', 'E. Recommendations', 'F. Departmental action register', 'Decision log', 'Approve and publish']) assert.ok(ui.includes(t), t);
  assert.doesNotMatch(ui, /Book a free rework review/);
});

test('demo intro and no-JavaScript fallback describe the same four findings and figures', async () => {
  const html = await page();
  const sec = html.slice(html.indexOf('id="samples"'), html.indexOf('id="experience"'));
  assert.match(sec, /<p class="demo-tagline">Automation handles the repetitive work\. Validation checks the numbers\. AI helps explain what needs attention\. You stay in control\.<\/p>/);
  assert.match(sec, /Work Register \(18\), an Invoice Tracker \(7\) and Customer Requests \(10\)/);
  const st0 = sec.slice(sec.indexOf('class="demo-static"'));
  for (const t of ['W-1043 / W-1051', 'W-1047', 'INV-2107', 'W-1055', 'R-308', 'W-1056', 'Source records received: 18', '7 recorded as completed and 11 as open', 'Mon 1, Tue 2, Wed 1, Thu 2, Fri 1', '4 items require attention']) assert.ok(st0.includes(t), t);
});

test('the sample week ends Fri 6 Nov 2026 and the demo window shows it; all work dates are real dates', async () => {
  assert.equal(DATA.WEEK, 'Week ending Fri 6 Nov 2026');
  const m = (await page()).match(/<span class="dw-status" data-week>([^<]*)</);
  assert.equal(m[1], DATA.WEEK);
  for (const w of WORK) for (const k of ['scheduled', 'due', 'completed']) if (w[k]) assert.ok(toIso(w[k]), `${w.id}.${k}`);
  for (const w of WORK.filter((x) => x.completed)) assert.ok(w.completed >= '2026-11-02' && w.completed <= '2026-11-06', w.id);
});

test('Data & Reporting output sample: the engine’s published report after one review path', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('data-pv-figure="output"'), html.indexOf('</figure>', html.indexOf('data-pv-figure="output"')));
  const p = publish(reviewed()); const m = published(p).metrics;
  const val = (k) => fig.match(new RegExp(`data-po="${k}">([^<]*)<`))[1];
  assert.deepEqual([val('sourceRecords'), val('unique'), val('completed'), val('open'), val('completionRate'), val('overdue')].map(String), [m.sourceRecords, m.unique, m.completed, m.open, m.completionRate, m.overdue].map(String));
  for (const r of published(p).register) assert.match(fig, new RegExp(`data-po-reg="${r.issue}"><strong>${r.team}:</strong> ${r.action.replace(/[()]/g, '\\$&')} &middot; ${r.status}<`), r.issue);
});

test('privacy notice: fictional work records, invoices and requests; publishing simulated; nothing stored or sent', async () => {
  const html = await readFile(new URL('../privacy/index.html', import.meta.url), 'utf8');
  const sec = html.slice(html.indexOf('<h2>The examples on the homepage</h2>'), html.indexOf('<h2>When you contact me</h2>'));
  for (const t of ['work records, invoices, requests, addresses and staff names are fictional', 'Publishing a report or building the action register there is simulated', 'not in cookies, local storage or session storage', 'no AI runs on this page']) assert.ok(sec.includes(t), t);
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

