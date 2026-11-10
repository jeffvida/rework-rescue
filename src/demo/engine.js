// Sample engine: collect → consolidate → validate → detect patterns → findings → human review → release.
// Pure functions, no page code, so tests/demo.test.mjs can check every number the hero card, the example and the
// Data & Reporting sample show. The source rows never change: a review decision is stored as data, and every figure,
// check, finding and summary line is worked out again from the rows plus the decisions (the "recheck").

import { SALES, PAYMENTS, REQUESTS, SOURCES, HISTORY, RULES, ISSUES, WEEK } from './data.js';

export const ISSUE_IDS = ['duplicate', 'missing', 'pattern', 'followUp'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
export const n = (x) => x.toLocaleString('en-US');
const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`;
const DUP = ['S-1043', 'S-1051']; const MISSING = 'S-1047'; const REQ = 'R-205';

export function initialState() {
  return { decisions: { duplicate: null, missing: null, pattern: null, followUp: null }, release: null };
}

/** Rows per source, and the history used for the pattern check. */
export function sourceCounts() {
  const c = { sales: SALES.length, payments: PAYMENTS.length, requests: REQUESTS.length };
  return { ...c, total: c.sales + c.payments + c.requests, sources: SOURCES.length, historyWeeks: HISTORY.weeks.length };
}

const paymentsFor = (id) => PAYMENTS.filter((p) => p.sale === id);
const paidFor = (id) => paymentsFor(id).reduce((t, p) => t + p.amount, 0);
const dayOf = (label) => label.split(' ')[0];

/** The sales as they stand after the review decisions (S-1051 removed; S-1047's amount only if confirmed in full). */
export function countedSales(s) {
  const d = s.decisions;
  return SALES.filter((x) => !(d.duplicate === 'remove' && x.id === DUP[1]))
    .map((x) => (x.id === MISSING && d.missing === 'fullAmount' ? { ...x, amount: paidFor(MISSING) } : x));
}

/** The requests as they stand after the review decisions. */
export function currentRequests(s) {
  const d = s.decisions.followUp;
  return REQUESTS.map((r) => {
    if (r.id !== REQ || !d) return r;
    return d === 'assign' ? { ...r, owner: 'Ben', next: 'Send the quote' } : { ...r, status: 'Closed', next: 'Handled' };
  });
}

export const historyAverage = (day) => HISTORY.days[day].reduce((t, x) => t + x, 0) / HISTORY.days[day].length;

/** Daily sales this week against the 4-week average for the same weekday. */
export function daily(s) {
  const sales = countedSales(s);
  return DAYS.map((day) => {
    const total = sales.filter((x) => dayOf(x.date) === day && x.amount !== null).reduce((t, x) => t + x.amount, 0);
    const avg = historyAverage(day);
    const change = (total - avg) / avg;
    return { day, total, avg, change, flagged: Math.abs(change) > RULES.patternThreshold };
  });
}

const weekEnd = () => Number(/(\d{1,2}) \w{3} \d{4}$/.exec(WEEK)[1]);
export const workingDaysOpen = (r) => weekEnd() - Number(r.received.split(' ')[1]);

/** The checks, run on the data as it stands now. Running them again after a decision is the recheck. */
export function runChecks(s = initialState()) {
  const sales = countedSales(s);
  const seen = new Map(); const duplicates = [];
  for (const x of sales) {
    if (x.amount === null) continue;
    const key = `${x.customer.toLowerCase()}|${x.date}|${x.amount}`;
    if (seen.has(key)) duplicates.push([seen.get(key), x.id]); else seen.set(key, x.id);
  }
  // Two sales confirmed as separate are not flagged again.
  const dup = s.decisions.duplicate === 'keep' ? [] : duplicates;
  const missing = sales.filter((x) => x.amount === null).map((x) => x.id);
  const pattern = daily(s).filter((x) => x.flagged).map((x) => x.day);
  const followUp = currentRequests(s).filter((r) => r.status === 'Open' && !r.next.trim() && workingDaysOpen(r) > RULES.followUpDays).map((r) => r.id);
  return { duplicates: dup, missing, pattern, followUp };
}

const choiceOutcome = (issue, choice) => ISSUES[issue].choices.find(([v]) => v === choice)?.[2];

/** Each finding's review status: open, resolved, legitimate or unresolved (with a note when the recheck cleared it). */
function statusOf(s, issue) {
  const d = s.decisions[issue];
  if (issue === 'pattern' && !runChecks(s).pattern.includes('Tue')) {
    return { status: 'resolved', byRecheck: true };
  }
  return { status: d ? choiceOutcome(issue, d) : 'open', byRecheck: false };
}

/** The four findings from the first run, each with its records, rule, explanation and current review status. */
export function findings(s = initialState()) {
  const d = s.decisions;
  const tue = daily(s).find((x) => x.day === 'Tue');
  const tue0 = daily(initialState()).find((x) => x.day === 'Tue');
  const sale = (id) => SALES.find((x) => x.id === id);
  const req = REQUESTS.find((r) => r.id === REQ);
  const list = [
    {
      issue: 'duplicate', ids: DUP,
      records: { sales: DUP.map(sale), payments: DUP.flatMap(paymentsFor) },
      rule: 'Same customer, same date, same amount, different reference.',
      why: `One entry came in by email and one by phone, and there’s only one payment (${paymentsFor(DUP[0])[0].id}). If they’re the same sale, the total is ${n(sale(DUP[1]).amount)} too high.`,
      check: 'Check the original email and phone order from Greenfield Ltd on Tue 3 Nov.',
    },
    {
      issue: 'missing', ids: [MISSING],
      records: { sales: [sale(MISSING)], payments: paymentsFor(MISSING) },
      rule: 'Every sale needs an amount. Payments are compared with the sales they belong to.',
      why: `The total leaves this sale out. Payment ${paymentsFor(MISSING)[0].id} shows ${n(paidFor(MISSING))} received, but it doesn’t say whether that’s the full amount or a part payment.`,
      check: 'Check the order or invoice from Summit Supplies for the agreed amount.',
    },
    {
      issue: 'pattern', ids: ['Tue 3 Nov'],
      records: { sales: SALES.filter((x) => dayOf(x.date) === 'Tue'), daily: daily(s) },
      rule: `A day more than ${pct(RULES.patternThreshold)} above or below its average for the same weekday over the previous ${HISTORY.weeks.length} weeks. A demonstration rule: the threshold is set for each business.`,
      why: `Tuesday’s sales are ${n(tue0.total)}, about ${pct(tue0.change)} above the 4-week Tuesday average of ${n(tue0.avg)}. That isn’t necessarily wrong: a large order or the potential duplicate (S-1051, ${n(sale(DUP[1]).amount)}) could explain it.`,
      check: 'Check Tuesday’s orders against the source records, starting with S-1051.',
      tue,
    },
    {
      issue: 'followUp', ids: [REQ],
      records: { requests: [req] },
      rule: `An open request older than ${RULES.followUpDays} working days with no next action recorded. A demonstration rule.`,
      why: `${req.customer} asked for a quote on ${DAY_NAMES[dayOf(req.received)]}. ${workingDaysOpen(req)} working days later there’s no owner and no next step.`,
      check: 'Check the inbox for the quote request and decide who should own it.',
    },
  ];
  return list.map((f) => {
    const i = ISSUES[f.issue]; const st = statusOf(s, f.issue);
    return {
      ...f, title: i.title, kind: i.kind, hero: i.hero, prevent: i.prevent,
      choices: i.choices.map(([v, label, outcome]) => [v, label, outcome]),
      decision: d[f.issue], ...st,
      consequence: consequence(s, f.issue, st),
    };
  });
}

function consequence(s, issue, st) {
  const d = s.decisions[issue];
  const tue = daily(s).find((x) => x.day === 'Tue');
  if (issue === 'pattern' && st.byRecheck) return `Resolved by the recheck: without S-1051, Tuesday is ${n(tue.total)} (${tue.change >= 0 ? '+' : '−'}${pct(tue.change)} against the average), inside the normal range.`;
  if (!d) return '';
  return {
    remove: `S-1051 removed. The checks ran again: the sales total drops by ${n(SALES.find((x) => x.id === DUP[1]).amount)}, and Tuesday is now ${n(tue.total)}.`,
    keep: 'Kept as two separate sales. S-1051 now shows as waiting for payment.',
    fullAmount: `Amount confirmed as ${n(paidFor(MISSING))} and added to the total.`,
    partial: `${n(paidFor(MISSING))} recorded as a part payment. The sale amount is still needed, so it stays out of the total.`,
    unconfirmed: 'Left for the team to confirm. It stays out of the total and is listed as unresolved.',
    legit: 'Confirmed as a legitimate variation. No figures were changed.',
    investigate: 'Kept open for further investigation. It will be listed as unresolved.',
    assign: 'Assigned to Ben, with the next action “Send the quote”. A follow-up task will be prepared when the report is released.',
    handled: 'Marked as already handled. No follow-up task is created.',
  }[d];
}

/** Count of findings by review status. */
export function review(s) {
  const fs = findings(s);
  const count = (k) => fs.filter((f) => f.status === k).length;
  return { open: count('open'), resolved: count('resolved'), legitimate: count('legitimate'), unresolved: count('unresolved'), total: fs.length };
}
export const canApproveFinal = (s) => { const r = review(s); return r.open === 0 && r.unresolved === 0; };

/** Make, change or clear (null) a review decision. Any change locks the outputs again (release cleared). */
export function decide(s, issue, choice) {
  if (!ISSUE_IDS.includes(issue)) return s;
  if (choice !== null && !ISSUES[issue].choices.some(([c]) => c === choice)) return s;
  if (issue === 'pattern' && choice !== null && statusOf(s, 'pattern').byRecheck) return s; // nothing left to decide
  return { ...s, decisions: { ...s.decisions, [issue]: choice }, release: null };
}

/** Release decision. 'final' only when every finding is resolved or confirmed legitimate; 'provisional' and 'hold'
 *  only while something is still open or unresolved. null reopens the review. */
export function setRelease(s, kind) {
  if (kind === null) return { ...s, release: null };
  if (kind === 'final' && !canApproveFinal(s)) return s;
  if ((kind === 'provisional' || kind === 'hold') && canApproveFinal(s)) return s;
  if (!['final', 'provisional', 'hold'].includes(kind)) return s;
  return { ...s, release: kind };
}

/** The report status shown on the hero card and the example. */
export function status(s) {
  if (s.release === 'final') return 'Final report released';
  if (s.release === 'provisional') return 'Provisional report released';
  if (s.release === 'hold') return 'On hold';
  const r = review(s);
  if (canApproveFinal(s)) return 'Ready for approval';
  if (r.open === r.total) return 'Awaiting review';
  return r.open ? 'Under review' : 'Reviewed · items unresolved';
}

/** The weekly report: every figure from the rows plus the decisions. */
export function report(s = initialState()) {
  const sales = countedSales(s); const withAmount = sales.filter((x) => x.amount !== null);
  const owedRows = withAmount.map((x) => ({ id: x.id, customer: x.customer, owed: x.amount - paidFor(x.id) })).filter((x) => x.owed > 0);
  const unknown = sales.filter((x) => x.amount === null).map((x) => ({ id: x.id, customer: x.customer, received: paidFor(x.id) }));
  const reqs = currentRequests(s); const r = review(s);
  return {
    recordedTotal: SALES.reduce((t, x) => t + (x.amount ?? 0), 0),
    salesCount: sales.length,
    salesTotal: withAmount.reduce((t, x) => t + x.amount, 0),
    missingAmounts: unknown.length,
    paymentsCount: PAYMENTS.length,
    paymentsTotal: PAYMENTS.reduce((t, p) => t + p.amount, 0),
    owed: owedRows.reduce((t, x) => t + x.owed, 0), owedRows, unknown,
    openRequests: reqs.filter((q) => q.status === 'Open').length,
    noNextAction: runChecks(s).followUp.length,
    flagged: r.total, review: r,
    final: canApproveFinal(s),
    status: status(s),
  };
}

/** What a release unlocks: the report, the dashboard and any follow-up task the reviewer authorised. */
export function outputs(s) {
  if (s.release !== 'final' && s.release !== 'provisional') return null;
  const r = report(s); const fs = findings(s);
  return {
    kind: s.release,
    report: { label: s.release === 'final' ? 'Final report' : 'Provisional report', salesTotal: r.salesTotal, recordedTotal: r.recordedTotal, salesCount: r.salesCount, paymentsTotal: r.paymentsTotal, owed: r.owed, records: sourceCounts().total },
    dashboard: { daily: daily(s), openRequests: r.openRequests, review: r.review },
    unresolved: fs.filter((f) => f.status === 'unresolved' || f.status === 'open').map((f) => ({ issue: f.issue, title: f.title, ids: f.ids })),
    task: s.decisions.followUp === 'assign' ? { id: REQ, owner: 'Ben', text: 'Send the quote to Northside Partners' } : null,
  };
}

/** AI findings (simulated): plain-language lines built only from the engine's figures and the review status. */
export function aiFindings(s = initialState()) {
  const r = report(s); const fs = Object.fromEntries(findings(s).map((f) => [f.issue, f]));
  const tue0 = daily(initialState()).find((x) => x.day === 'Tue');
  const lines = [];
  lines.push(r.final
    ? `Sales total after review: ${n(r.salesTotal)} across ${r.salesCount} sales (recorded: ${n(r.recordedTotal)}).`
    : `Sales recorded: ${n(r.salesTotal)} across ${r.salesCount} sales. Provisional until the findings are reviewed.`);
  const dup = fs.duplicate;
  lines.push({
    open: 'Potential duplicate: S-1051 matches S-1043 (Greenfield Ltd, Tue 3 Nov, 860), with one payment. If it’s the same sale, the total is 860 lower.',
    resolved: 'S-1051 removed as a duplicate of S-1043.',
    legitimate: 'S-1043 and S-1051 confirmed as two separate sales. S-1051 is waiting for payment.',
  }[dup.status]);
  const mis = fs.missing;
  lines.push({
    open: 'S-1047 (Summit Supplies) has no amount. Payment P-307 shows 380 received; it’s not yet known whether that’s the full amount.',
    resolved: 'S-1047 amount confirmed as 380.',
    unresolved: s.decisions.missing === 'partial' ? 'S-1047: 380 received as a part payment. The sale amount is still needed.' : 'S-1047: amount still to be confirmed by the team.',
  }[mis.status]);
  const pat = fs.pattern;
  lines.push(pat.byRecheck
    ? `Tuesday recalculated to ${n(pat.tue.total)}, within the normal range after the duplicate was removed.`
    : {
      open: `Potential anomaly: Tuesday’s sales (${n(tue0.total)}) are ${pct(tue0.change)} above the 4-week Tuesday average (${n(tue0.avg)}). Needs investigation; the potential duplicate may explain part of it.`,
      legitimate: 'Tuesday’s higher sales confirmed as a legitimate variation.',
      unresolved: 'Tuesday’s sales kept for further investigation.',
    }[pat.status]);
  lines.push({
    open: 'Business rule: quote request R-205 (Northside Partners) has been open 4 working days with no next action.',
    resolved: s.decisions.followUp === 'assign' ? 'R-205 assigned to Ben with the next action “Send the quote”.' : 'R-205 marked as already handled.',
  }[fs.followUp.status]);
  return lines;
}

/** The hero card's figures before any review (the static HTML holds the same values). */
export function heroSummary() {
  const c = sourceCounts(); const r = report(); const tue = daily(initialState()).find((x) => x.day === 'Tue');
  return {
    sourceRecords: c.total, sources: c.sources, historyWeeks: c.historyWeeks,
    flagged: r.flagged, salesTotal: n(r.salesTotal), status: status(initialState()), weekRange: weekRange(WEEK),
    tuesday: n(tue.total), tuesdayAvg: n(tue.avg), tuesdayChange: pct(tue.change),
    issues: findings().map((f) => ({ issue: f.issue, title: f.hero })),
  };
}

/** 'Week ending Fri 6 Nov 2026' → '2–6 November 2026'. */
export function weekRange(label) {
  const m = /(\d{1,2}) (\w{3}) (\d{4})$/.exec(label);
  if (!m) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const end = new Date(Date.UTC(Number(m[3]), months.findIndex((x) => x.startsWith(m[2])), Number(m[1])));
  const mon = new Date(end); mon.setUTCDate(end.getUTCDate() - 4);
  const name = (d) => months[d.getUTCMonth()];
  return mon.getUTCMonth() === end.getUTCMonth()
    ? `${mon.getUTCDate()}–${end.getUTCDate()} ${name(end)} ${end.getUTCFullYear()}`
    : `${mon.getUTCDate()} ${name(mon)} – ${end.getUTCDate()} ${name(end)} ${end.getUTCFullYear()}`;
}

/** The one- or two-sentence AI line on the hero card (the full findings are in the example's Overview). */
export function heroLine(s = initialState()) {
  const r = report(s); const v = r.review; const tue0 = daily(initialState()).find((x) => x.day === 'Tue');
  if (v.open === v.total) return `Sales recorded: ${n(r.salesTotal)}, provisional. ${v.total} items need investigation, including Tuesday sales ${pct(tue0.change)} above their 4-week average.`;
  if (r.final) return `Sales total after review: ${n(r.salesTotal)} (recorded ${n(r.recordedTotal)}). Every finding is resolved or confirmed legitimate.`;
  const parts = [['open', 'to review'], ['resolved', 'resolved'], ['legitimate', 'confirmed legitimate'], ['unresolved', 'unresolved']]
    .filter(([k]) => v[k]).map(([k, l]) => `${v[k]} ${l}`);
  return `Sales now ${n(r.salesTotal)}, provisional. ${parts.join(' · ')}.`;
}
