// Live example tests (automated weekly report with human review, 10 Nov 2026).
// Every figure the hero card, the live example and the Data & Reporting output sample show comes from
// src/demo/engine.js working on src/demo/data.js. These tests pin the dataset and history, the four findings and their
// rules, every review path (correct, confirm legitimate, leave unresolved), the recheck, the release rules, the AI
// findings, and that the page's static HTML shows the engine's numbers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as DATA from '../src/demo/data.js';
import { SALES, PAYMENTS, REQUESTS, SOURCES, HISTORY, RULES, ISSUES, EVIDENCE } from '../src/demo/data.js';
import * as ENGINE from '../src/demo/engine.js';
import {
  initialState, sourceCounts, runChecks, findings, decide, review, status, report, outputs, signOff, release, canSignOff, canRelease,
  releaseBlockers, canDecide, statusOf, basisOf, autoChecks, workingSales, countedSales, currentRequests,
  aiFindings, heroCard, heroSummary, daily, historyAverage, weekRange, workingDaysOpen, ISSUE_IDS, STATUS_LABELS, AI_LABEL,
} from '../src/demo/engine.js';
const { publish } = ENGINE;

const page = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const sum = (rows) => rows.reduce((t, r) => t + (r.amount ?? 0), 0);
const with_ = (...steps) => steps.reduce((s, [i, c, d]) => (c === null || c === undefined ? s : decide(s, i, c, d)), initialState());
// The full review: exclude S-1051, 380 from the order email, verify Tuesday, R-205 assigned (or handled with a note), signed off, released.
const released = (assign = { owner: 'Ben' }, note) => release(signOff(with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['pattern', 'verifyRecalc'],
  note ? ['followUp', 'handled', { note }] : ['followUp', 'assign', assign])));

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
  for (const dup of [null, 'exclude', 'separate', 'notSure']) for (const mis of [null, 'confirmFromOrder', 'cantConfirm']) {
    const flagged = daily(with_(['duplicate', dup], ['missing', mis])).filter((d) => d.flagged).map((d) => d.day);
    assert.deepEqual(flagged, dup === 'exclude' ? [] : ['Tue'], `${dup}/${mis}`);
  }
  assert.equal(daily(with_(['duplicate', 'exclude'])).find((d) => d.day === 'Tue').total, 1595);
  assert.equal(daily(with_(['missing', 'confirmFromOrder'])).find((d) => d.day === 'Wed').total, 740);
});

// ---- The checks and findings

test('first run: exactly four findings, one per check type, each from its stated rule', () => {
  assert.deepEqual(runChecks(), { duplicates: [['S-1043', 'S-1051']], missing: ['S-1047'], pattern: ['Tue'], followUp: ['R-205'] });
  const fs = findings();
  assert.deepEqual(fs.map((f) => f.issue), ISSUE_IDS);
  assert.deepEqual(fs.map((f) => f.kind), ['Duplicate check', 'Missing information · cross-source', 'Historical pattern', 'Business rule']);
  const r = REQUESTS.find((x) => x.id === 'R-205');
  assert.deepEqual([r.owner, r.next, workingDaysOpen(r)], ['', '', 4]);
});

test('every finding has a source reference, location, explanation, potential impact, AI possible cause and investigation steps', () => {
  for (const f of findings()) {
    for (const k of ['title', 'source', 'location', 'rule', 'why', 'impact', 'ai', 'check']) assert.ok(String(f[k] ?? '').length >= 8, `${f.issue} ${k}`);
    assert.ok(Array.isArray(f.steps) && f.steps.length >= 2, `${f.issue} steps`);
    assert.match(f.ai, /^Possible cause:/, `${f.issue} AI is worded as a possible cause`);
    assert.match(f.ai, /\b(may|could)\b/, `${f.issue} AI hedges`);
  }
  assert.deepEqual(findings().map((f) => f.records.evidence?.map((e) => e.id) ?? []), [['E-101', 'E-102'], ['E-103'], [], ['E-104']]);
});

test('findings are worded as things to investigate, not confirmed errors; the 40% rule is called a demonstration setting', () => {
  const text = findings().map((f) => `${f.title} ${f.why} ${f.rule} ${f.ai} ${f.impact}`).join(' ');
  assert.match(findings()[2].rule, /40%.*demonstration rule: the threshold is set for each business/i);
  assert.match(findings()[2].why, /isn’t necessarily wrong/);
  assert.match(findings()[1].why, /a payment doesn’t say what the sale was for/);
  assert.doesNotMatch(text, /confirmed duplicate|is an error|is wrong\b|definitely|the cause is/i);
  assert.match(ISSUES.duplicate.title, /^Potential duplicate$/);
});

// ---- Original records and evidence

test('source records are frozen and identical after every decision path, sign-off and release', () => {
  const snap = JSON.stringify([SALES, PAYMENTS, REQUESTS, HISTORY, EVIDENCE]);
  for (const arr of [SALES, PAYMENTS, REQUESTS, EVIDENCE]) { assert.ok(Object.isFrozen(arr)); assert.ok(arr.every(Object.isFrozen)); }
  assert.ok(Object.isFrozen(HISTORY.days.Tue));
  assert.throws(() => { 'use strict'; SALES[6].amount = 999; });
  assert.throws(() => { SALES.push({}); });
  released(); with_(['duplicate', 'separate'], ['missing', 'cantConfirm']);
  assert.equal(JSON.stringify([SALES, PAYMENTS, REQUESTS, HISTORY, EVIDENCE]), snap);
});

test('a payment is never treated as a sale: S-1047 takes 380 from the order email E-103, entered by the reviewer', () => {
  assert.deepEqual(ISSUES.missing.choices.map((c) => c[0]), ['confirmFromOrder', 'cantConfirm']);
  const s = with_(['missing', 'confirmFromOrder']);
  const row = workingSales(s).find((x) => x.id === 'S-1047');
  assert.deepEqual([row.amount, row.original, row.correction], [380, null, { from: null, to: 380, evidence: 'E-103', by: 'reviewer' }]);
  assert.equal(EVIDENCE.find((e) => e.id === 'E-103').amount, 380);
  assert.equal(report(s).salesTotal, 4690);
  assert.equal(report(s).paymentsTotal, 2980, 'the payment stays a payment');
  for (const st of [initialState(), s, released()]) {
    const ids = countedSales(st).map((x) => x.id);
    assert.ok(ids.every((id) => id.startsWith('S-')), 'only sales are counted as sales');
    assert.equal(report(st).paymentsTotal, 2980);
  }
  const no = with_(['missing', 'cantConfirm']);
  assert.deepEqual([report(no).salesTotal, statusOf(no, 'missing'), report(no).unknown], [4310, 'unresolved', [{ id: 'S-1047', customer: 'Summit Supplies', received: 380 }]]);
});

test('a suspected duplicate is never removed automatically: only the reviewer excludes S-1051, and the row is kept', () => {
  assert.equal(countedSales(initialState()).length, 12);
  assert.equal(report(initialState()).salesTotal, 4310);
  const s = with_(['duplicate', 'exclude']);
  assert.deepEqual(workingSales(s).filter((x) => x.excluded).map((x) => x.id), ['S-1051']);
  assert.equal(workingSales(s).length, 12, 'the excluded row is kept, marked');
  assert.deepEqual([report(s).salesTotal, report(s).salesCount], [3450, 11]);
});

// ---- Tuesday: dependency and human verification

test('Tuesday is locked until the duplicate is decided (Not sure yet does not count)', () => {
  for (const pre of [null, 'notSure']) {
    const s = with_(['duplicate', pre]);
    assert.equal(canDecide(s, 'pattern', 'genuine').ok, false);
    assert.match(canDecide(s, 'pattern', 'investigate').reason, /Decide the potential duplicate first/);
    assert.equal(decide(s, 'pattern', 'genuine'), s, 'refused: same state back');
    assert.equal(findings(s)[2].locked, true);
  }
  assert.equal(findings(with_(['duplicate', 'separate']))[2].locked, false);
});

test('excluding S-1051 clears Tuesday by recalculation, but it awaits the reviewer’s verification before it counts', () => {
  const s = with_(['duplicate', 'exclude']);
  const f = findings(s)[2];
  assert.deepEqual([f.status, f.statusLabel, f.accepted], ['recalculated', 'Cleared by recalculation — awaiting reviewer verification', false]);
  assert.match(f.consequence, /Tuesday is 1,595 \(\+3% against the average\), inside the range\. Check the recalculated figures and confirm them\./);
  assert.deepEqual(f.choices.map((c) => c.value), ['verifyRecalc', 'investigate'], 'no "genuine" once it is back in range');
  assert.equal(canDecide(s, 'pattern', 'genuine').ok, false);
  const almost = with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['followUp', 'assign', { owner: 'Ben' }]);
  assert.deepEqual([review(almost).left, canSignOff(almost), status(almost)], [1, false, 'Under review'], 'recalculated alone does not validate');
  const v = decide(almost, 'pattern', 'verifyRecalc');
  assert.deepEqual([statusOf(v, 'pattern'), review(v).left, canSignOff(v), status(v)], ['resolved', 0, true, 'Ready for sign-off']);
  assert.match(findings(v)[2].consequence, /Recalculated figures checked and confirmed: Tuesday 1,595 \(\+3%\)/);
});

test('two separate orders: Tuesday stays flagged and needs genuine or investigate; verifyRecalc is refused', () => {
  const s = with_(['duplicate', 'separate']);
  assert.equal(statusOf(s, 'pattern'), 'open');
  assert.equal(canDecide(s, 'pattern', 'verifyRecalc').ok, false);
  assert.equal(statusOf(decide(s, 'pattern', 'genuine'), 'pattern'), 'legitimate');
  assert.equal(statusOf(decide(s, 'pattern', 'investigate'), 'pattern'), 'unresolved');
});

// ---- Fingerprints and invalidation

test('changing the duplicate after Tuesday was verified invalidates Tuesday ("Needs another look") and logs why', () => {
  const v = with_(['duplicate', 'exclude'], ['pattern', 'verifyRecalc']);
  assert.equal(statusOf(v, 'pattern'), 'resolved');
  const ch = decide(v, 'duplicate', 'separate');
  assert.deepEqual([statusOf(ch, 'pattern'), findings(ch)[2].statusLabel], ['stale', 'Needs another look']);
  assert.equal(daily(ch).find((d) => d.day === 'Tue').total, 2455);
  const last = ch.log.at(-1);
  assert.deepEqual([last.type, last.issue], ['reopened', 'pattern']);
  assert.match(last.reason, /figures it was based on changed/);
  // Switching back does not quietly re-validate it: it stays invalid until the reviewer decides again.
  const back = decide(ch, 'duplicate', 'exclude');
  assert.equal(statusOf(back, 'pattern'), 'stale');
  assert.equal(statusOf(decide(back, 'pattern', 'verifyRecalc'), 'pattern'), 'resolved');
});

test('a genuine-Tuesday decision is invalidated when the duplicate later changes to exclude', () => {
  const g = with_(['duplicate', 'separate'], ['pattern', 'genuine']);
  assert.equal(statusOf(g, 'pattern'), 'legitimate');
  assert.equal(statusOf(decide(g, 'duplicate', 'exclude'), 'pattern'), 'stale');
  assert.equal(statusOf(decide(g, 'duplicate', 'notSure'), 'pattern'), 'legitimate', 'notSure leaves the Tuesday rows unchanged');
});

test('every decision records its basis; the basis matches the data it was made on', () => {
  const s = with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['pattern', 'verifyRecalc'], ['followUp', 'handled', { note: 'Ana emailed the quote on Tue' }]);
  for (const i of ISSUE_IDS) { assert.ok(s.decisions[i].basis.length > 10, i); assert.equal(s.decisions[i].basis, basisOf(s, i), i); }
  assert.notEqual(basisOf(with_(['duplicate', 'exclude']), 'pattern'), basisOf(initialState(), 'pattern'));
});

// ---- Reviewer decisions with evidence

test('R-205: the reviewer chooses the owner; "already handled" needs a note; "leave for now" blocks release', () => {
  assert.equal(canDecide(initialState(), 'followUp', 'assign').ok, false);
  assert.equal(canDecide(initialState(), 'followUp', 'assign', { owner: 'Zed' }).ok, false);
  assert.equal(canDecide(initialState(), 'followUp', 'handled', { note: '   ' }).ok, false);
  const a = with_(['followUp', 'assign', { owner: 'Ana' }]);
  assert.deepEqual(currentRequests(a).find((r) => r.id === 'R-205'), { ...REQUESTS[4], owner: 'Ana', next: 'Send the quote' });
  const h = with_(['followUp', 'handled', { note: 'Ben phoned them Tue' }]);
  assert.deepEqual([h.decisions.followUp.note, report(h).openRequests], ['Ben phoned them Tue', 2]);
  assert.equal(statusOf(with_(['followUp', 'leave']), 'followUp'), 'unresolved');
  assert.deepEqual(outputs(released({ owner: 'Ana' })).task, { id: 'R-205', owner: 'Ana', text: 'Send the quote to Northside Partners' });
  assert.equal(outputs(released(null, 'Ben phoned them Tue')).task, null);
});

test('statuses for every path, and sign-off is possible only when all four are resolved or confirmed legitimate', () => {
  let paths = 0;
  for (const dup of ['exclude', 'separate', 'notSure']) for (const mis of ['confirmFromOrder', 'cantConfirm']) for (const pat of ['genuine', 'verifyRecalc', 'investigate', null]) for (const fu of ['assign', 'handled', 'leave']) {
    const s = with_(['duplicate', dup], ['missing', mis], ['pattern', pat], ['followUp', fu, { owner: 'Ben', note: 'Done by phone' }]);
    const v = review(s); paths++;
    assert.equal(v.total, 4);
    assert.equal(Object.keys(STATUS_LABELS).reduce((t, k) => t + v[k], 0), 4);
    const ok = ISSUE_IDS.every((i) => ['resolved', 'legitimate'].includes(statusOf(s, i)));
    assert.equal(canSignOff(s), ok, `${dup}/${mis}/${pat}/${fu}`);
    if (dup === 'notSure' || mis === 'cantConfirm' || fu === 'leave' || pat === 'investigate' || pat === null) assert.equal(ok, false);
  }
  assert.equal(paths, 72);
});

// ---- Sign-off and release (the publication gate)

test('release gate: refused without sign-off; sign-off refused while anything is open, unresolved, recalculated or stale', () => {
  const s0 = initialState();
  assert.equal(release(s0), s0); assert.equal(signOff(s0), s0);
  assert.equal(outputs(s0), null);
  assert.deepEqual(releaseBlockers(s0), ['4 of 4 findings still need a reviewer decision.']);
  const blocked = [
    with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['followUp', 'assign', { owner: 'Ben' }]), // Tuesday recalculated, not verified
    with_(['duplicate', 'separate'], ['missing', 'cantConfirm'], ['pattern', 'genuine'], ['followUp', 'assign', { owner: 'Ben' }]),
    with_(['duplicate', 'separate'], ['missing', 'confirmFromOrder'], ['pattern', 'investigate'], ['followUp', 'assign', { owner: 'Ben' }]),
    with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['pattern', 'verifyRecalc'], ['followUp', 'leave']),
    decide(with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['pattern', 'verifyRecalc'], ['followUp', 'assign', { owner: 'Ben' }]), 'duplicate', 'separate'), // stale
  ];
  for (const b of blocked) {
    assert.equal(canSignOff(b), false); assert.equal(signOff(b), b, 'sign-off refused');
    assert.equal(release(b), b, 'release refused'); assert.equal(outputs(release(b)), null);
    assert.match(releaseBlockers(b)[0], /findings? still needs? a reviewer decision/);
  }
  const ready = with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['pattern', 'verifyRecalc'], ['followUp', 'assign', { owner: 'Ben' }]);
  assert.deepEqual([status(ready), canSignOff(ready), canRelease(ready), releaseBlockers(ready)], ['Ready for sign-off', true, false, ['Sign-off needed: confirm you have checked the findings and figures.']]);
  assert.equal(release(ready), ready, 'still refused before sign-off');
  const so = signOff(ready);
  assert.deepEqual([status(so), canRelease(so), releaseBlockers(so)], ['Signed off', true, []]);
  const rel = release(so);
  assert.deepEqual([status(rel), outputs(rel).report.label, outputs(rel).report.salesTotal], ['Released by you', 'Released report', 3830]);
  assert.equal(release(rel), rel, 'releasing twice changes nothing');
  assert.equal(typeof publish, 'undefined', 'no publish-anyway route exists');
});

test('any decision change after sign-off clears it; after release it withdraws the release ("Changed since release")', () => {
  const so = signOff(with_(['duplicate', 'exclude'], ['missing', 'confirmFromOrder'], ['pattern', 'verifyRecalc'], ['followUp', 'assign', { owner: 'Ben' }]));
  const c1 = decide(so, 'followUp', 'assign', { owner: 'Ana' });
  assert.deepEqual([c1.signOff, status(c1), c1.log.at(-1).type], [null, 'Ready for sign-off', 'signoff-cleared']);
  const rel = released();
  const c2 = decide(rel, 'followUp', 'assign', { owner: 'Ana' });
  assert.deepEqual([c2.released, c2.signOff, status(c2), outputs(c2)], [null, null, 'Changed since release', null]);
  assert.deepEqual(c2.log.slice(-2).map((e) => e.type), ['signoff-cleared', 'release-revoked']);
  assert.equal(status(signOff(c2)), 'Changed since release', 'stays flagged until released again');
  assert.equal(status(release(signOff(c2))), 'Released by you');
  const c3 = decide(rel, 'duplicate', 'separate');
  assert.deepEqual([status(c3), statusOf(c3, 'pattern'), canSignOff(c3)], ['Changed since release', 'stale', false]);
});

// ---- Decision log

test('the decision log is append-only: each step keeps every earlier entry unchanged, frozen, in order', () => {
  const steps = [];
  let s = initialState(); steps.push(s);
  const go = (fn) => { s = fn(s); steps.push(s); };
  go((x) => decide(x, 'duplicate', 'exclude'));
  go((x) => decide(x, 'missing', 'confirmFromOrder'));
  go((x) => decide(x, 'pattern', 'verifyRecalc'));
  go((x) => decide(x, 'followUp', 'assign', { owner: 'Ben' }));
  go(signOff); go(release);
  go((x) => decide(x, 'duplicate', 'separate'));
  go((x) => decide(x, 'pattern', 'genuine'));
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1].log; const b = steps[i].log;
    assert.ok(b.length > a.length, `step ${i} adds to the log`);
    a.forEach((e, k) => assert.equal(b[k], e, `step ${i} keeps entry ${k}`));
    assert.ok(Object.isFrozen(b) && b.every(Object.isFrozen));
  }
  assert.deepEqual(s.log.map((e) => e.type), ['decision', 'decision', 'decision', 'decision', 'signoff', 'released', 'changed', 'reopened', 'signoff-cleared', 'release-revoked', 'changed']);
  assert.deepEqual(s.log.map((e) => e.seq), s.log.map((_, i) => i + 1));
  assert.deepEqual([s.log[6].from, s.log[6].to], ['exclude', 'separate']);
  assert.throws(() => { s.log.push({}); });
  assert.throws(() => { 'use strict'; s.log[0].to = 'x'; });
});

test('refused actions add nothing to the log', () => {
  const s = initialState();
  for (const t of [decide(s, 'pattern', 'genuine'), decide(s, 'followUp', 'assign'), decide(s, 'missing', 'nope'), signOff(s), release(s), decide(s, 'duplicate', null)]) assert.equal(t, s);
  assert.equal(s.log.length, 0);
});

// ---- Figures

test('figures for the main paths: 3,830 final; 4,690 with two separate orders; still owed reconciles sale by sale', () => {
  const a = report(released());
  assert.deepEqual([a.salesTotal, a.salesCount, a.owed, a.owedRows.map((x) => x.id), a.final], [3830, 11, 850, ['S-1049', 'S-1052'], true]);
  assert.equal(a.salesTotal - a.paymentsTotal, a.owed);
  const b = report(with_(['duplicate', 'separate'], ['missing', 'confirmFromOrder'], ['pattern', 'genuine'], ['followUp', 'handled', { note: 'Quoted by phone' }]));
  assert.deepEqual([b.salesTotal, b.salesCount, b.owed, b.final], [4690, 12, 1710, true]);
  const c = report(with_(['duplicate', 'separate'], ['missing', 'cantConfirm'], ['pattern', 'investigate'], ['followUp', 'assign', { owner: 'Ben' }]));
  assert.deepEqual([c.salesTotal, c.owed, c.final], [4310, 1710, false]);
  const d = report(with_(['duplicate', 'exclude']));
  assert.deepEqual([d.salesTotal, d.salesCount, d.owed], [3450, 11, 850]);
});

test('automatic checks: 27 of 27 records from 3 sources; every payment matched to a sale', () => {
  assert.deepEqual(autoChecks().map((c) => [c.label, c.pass]), [['27 of 27 records loaded from 3 sources', true], ['Every payment matched to a sale', true]]);
});

test('released outputs reflect the decisions: totals, dashboard days, summary and task differ by path', () => {
  const f = outputs(released());
  assert.deepEqual([f.report.salesTotal, f.dashboard.daily.find((d) => d.day === 'Tue').total, f.dashboard.daily.some((d) => d.flagged)], [3830, 1595, false]);
  assert.match(f.summary[3], /You checked and confirmed Tuesday’s recalculated figure: 1,595/);
  const g = outputs(release(signOff(with_(['duplicate', 'separate'], ['missing', 'confirmFromOrder'], ['pattern', 'genuine'], ['followUp', 'handled', { note: 'Quoted by phone' }]))));
  assert.deepEqual([g.report.salesTotal, g.dashboard.daily.find((d) => d.day === 'Tue').flagged, g.task], [4690, true, null]);
});

test('AI text: labelled "AI-drafted · simulated in this demo", agrees with the figures, credits decisions to the reviewer', () => {
  assert.equal(AI_LABEL, 'AI-drafted · simulated in this demo');
  const a0 = aiFindings();
  assert.equal(a0.length, 5);
  assert.match(a0[0], /Sales recorded: 4,310 across 12 sales\. Provisional/);
  assert.match(a0[1], /Potential duplicate: S-1051 .*860 lower/);
  assert.match(a0[2], /S-1047 .*380 received; the order would show whether that’s the full amount/);
  assert.match(a0[3], /Potential anomaly: Tuesday’s sales \(2,455\) are 58% above the 4-week Tuesday average \(1,550\)/);
  assert.match(a0[4], /R-205 .*no next action/);
  const rec = aiFindings(with_(['duplicate', 'exclude']));
  assert.match(rec[3], /Tuesday recalculated to 1,595 after S-1051 was excluded\. Awaiting your verification/);
  assert.match(rec[0], /Provisional/);
  const fin = aiFindings(released());
  assert.match(fin[0], /Sales total after your review: 3,830 across 11 sales \(recorded: 4,310\)/);
  for (const l of fin.slice(1)) assert.match(l, /^You /, 'decisions are credited to the reviewer');
  const all = [a0, rec, fin, aiFindings(with_(['duplicate', 'separate'], ['missing', 'cantConfirm']))].flat().join(' ');
  assert.doesNotMatch(all, /\b(AI|I) (confirmed|approved|removed|excluded|corrected)\b/);
});

test('hero card data: three figures, the daily chart from the dataset, items to review; it follows the decisions', () => {
  const c = heroCard();
  assert.deepEqual([c.status, c.toReview, c.salesTotal, c.salesNote, c.paymentsTotal, c.openRequests], ['Awaiting review', 4, '4,310', 'provisional', '2,980', 3]);
  assert.deepEqual(c.daily.map((d) => [d.day, d.total, d.avg]), [['Mon', 570, 620], ['Tue', 2455, 1550], ['Wed', 360, 560], ['Thu', 595, 640], ['Fri', 330, 380]]);
  assert.deepEqual(c.tuesday, { total: '2,455', change: '+58%', flagged: true });
  for (const d of c.daily) assert.equal(d.total, SALES.filter((x) => x.date.startsWith(d.day) && x.amount !== null).reduce((t, x) => t + x.amount, 0), d.day);
  const rec = heroCard(with_(['duplicate', 'exclude']));
  assert.deepEqual([rec.toReview, rec.status, rec.tuesday], [3, 'Under review', { total: '1,595', change: '+3%', flagged: false }], 'recalculated Tuesday still counts as to review');
  const after = heroCard(released());
  assert.deepEqual([after.toReview, after.salesTotal, after.salesNote, after.status], [0, '3,830', 'checked', 'Released by you']);
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

test('hero: headline kept, the new short line, booking first then "See how it works"; 30 minutes matches booking', async () => {
  const html = await page();
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<figure'));
  assert.match(hero, /Less time fixing the numbers\. <span class="h1-accent">More time running the business\.<\/span>/);
  assert.match(hero, /<p class="hero-sub">I turn scattered data and repetitive tasks into reliable reports and smoother workflows\.<\/p>/);
  assert.ok(hero.indexOf('Book a free rework review') < hero.indexOf('See how it works'));
  assert.match(hero, /A 30-minute call about one report or process/);
  const { RULES: BOOK } = await import('../src/booking/slots.js');
  assert.equal(BOOK.slotMinutes, 30);
});

test('hero card: status, items to review, three figures and the daily chart, all from the engine; no findings list', async () => {
  const html = await page();
  const card = html.slice(html.indexOf('id="hero-report"'), html.indexOf('</figure>', html.indexOf('id="hero-report"')));
  const c = heroCard();
  const val = (k) => card.match(new RegExp(`data-hr="${k}"[^>]*>([^<]*)<`))[1];
  assert.deepEqual([val('status'), val('toReview'), val('salesTotal'), val('salesNote'), val('paymentsTotal'), val('openRequests'), val('tueTotal'), val('tueChange')],
    [c.status, String(c.toReview), c.salesTotal, c.salesNote, c.paymentsTotal, String(c.openRequests), c.tuesday.total, c.tuesday.change]);
  // static bars drawn at the chart's own scale from the same totals
  const svg = card.slice(card.indexOf('<svg'), card.indexOf('</svg>'));
  const [max, base, h] = ['max', 'base', 'h'].map((k) => Number(svg.match(new RegExp(`data-${k}="([\\d.]+)"`))[1]));
  for (const d of c.daily) {
    const m = svg.match(new RegExp(`data-day="${d.day}"><rect class="hr-bar" x="[\\d.]+" y="([\\d.]+)" width="\\d+" height="([\\d.]+)"`));
    assert.ok(m, d.day);
    assert.ok(Math.abs(Number(m[2]) - (d.total / max) * h) < 0.2, `${d.day} bar height`);
    assert.ok(Math.abs(Number(m[1]) - (base - (d.total / max) * h)) < 0.2, `${d.day} bar top`);
  }
  assert.match(svg, /<g class="hr-col is-flag" data-day="Tue">/);
  assert.equal((svg.match(/is-flag/g) || []).length, 1, 'only Tuesday is highlighted');
  assert.doesNotMatch(card, /data-flag=|Potential duplicate|Sale with no amount|Request with no next action|rl-step/, 'no findings list or run log in the hero');
  assert.match(html, /<figcaption class="hr-note">Simulated in your browser\. Nothing is sent or changed\.<\/figcaption>/);
});

test('hero script: one action (Review flagged items), no publishing or release in the hero, shared state', async () => {
  const js = await readFile(new URL('../src/demo/hero.js', import.meta.url), 'utf8');
  assert.match(js, /Review flagged items/);
  assert.doesNotMatch(js, /Publish|publish\(|release\(|signOff\(/, 'the hero cannot publish, sign off or release');
  assert.doesNotMatch(js, /provisional|on hold/i, 'no provisional or hold workflow');
  assert.match(js, /from '\.\/store\.js'/);
  const ui = await readFile(new URL('../src/demo/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /from '\.\/store\.js'/);
  assert.match(ui, /\['findings', 'Findings'[\s\S]*\['sources', 'Sources'[\s\S]*\['summary', 'Summary'/);
  assert.doesNotMatch(ui, /Book a free rework review/, 'booking stays in the strip after the demo');
  for (const t of ['View in Sources', 'What was detected', 'Rule or comparison', 'What to check', 'Potential impact', 'Possible cause', 'To stop it happening again:', 'Back to the report', 'Release report', 'Decision log', 'AI_LABEL']) assert.ok(ui.includes(t), t);
  assert.doesNotMatch(ui, /Publish anyway|publish\(/);
});

test('decision wording follows the spec', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ISSUES).map(([k, v]) => [k, v.choices.map((c) => c[1])])), {
    duplicate: ['Same order: exclude S-1051', 'Two separate orders: keep both', 'Not sure yet'],
    missing: ['Order email confirms 380: enter it', 'Can’t confirm yet'],
    pattern: ['Genuine: keep as is', 'I’ve checked the recalculated figures', 'Investigate further'],
    followUp: ['Assign an owner', 'Already handled (add a note)', 'Leave for now'],
  });
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
  assert.match(sec, /<p class="demo-tagline">Automation does the repetitive work\. Rules check the data\. AI helps explain what needs attention\. You stay in control\.<\/p>/);
  const st = sec.slice(sec.indexOf('class="demo-static"'));
  for (const t of ['S-1043 and S-1051', 'S-1047', 'Unusual Tuesday sales', '2,455', '1,550', '58%', '40%', '1,595', 'R-205', 'demonstration data']) assert.ok(st.includes(t), t);
});

test('Data & Reporting output sample: the engine’s final outputs after a full review, with no trend chart', async () => {
  const html = await page();
  const fig = html.slice(html.indexOf('data-pv-figure="output"'), html.indexOf('</figure>', html.indexOf('data-pv-figure="output"')));
  const s = released();
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

