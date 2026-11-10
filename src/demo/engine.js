// Sample engine: the three checks across the three sources, the visitor's decisions and the weekly report.
// Pure functions, no page code, so tests/demo.test.mjs can check every number the hero card, the three-tab
// example and the Data & Reporting preview show.
// The source rows never change. A decision is stored as data and the report is worked out again from the rows plus
// the decisions, so any decision can be changed or cleared. Reset = initialState().

import { SALES, PAYMENTS, REQUESTS, SOURCES, ISSUES, CONSEQUENCE, FOLLOW_UP_DAYS, WEEK } from './data.js';

export const ISSUE_IDS = ['duplicate', 'missing', 'followUp'];
const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
const n = (x) => x.toLocaleString('en-US');

export function initialState() {
  return { decisions: { duplicate: null, missing: null, followUp: null } };
}

/** Rows per source, and the totals the hero and the preview show. */
export function sourceCounts() {
  const c = { sales: SALES.length, payments: PAYMENTS.length, requests: REQUESTS.length };
  return { ...c, total: c.sales + c.payments + c.requests, sources: SOURCES.length };
}

// 'Mon 2 Nov' → 2. Every date sits in the one sample week, so day numbers can be compared directly.
const dayOf = (label) => Number(label.split(' ')[1]);
const weekEnd = () => Number(/(\d{1,2}) \w{3} \d{4}$/.exec(WEEK)[1]);
/** Working days a request has been open by the end of the sample week (received Monday → 4 by Friday). */
export const workingDaysOpen = (r) => weekEnd() - dayOf(r.received);

/** The three checks on the source rows. They read the data only, so they always find the same things. */
export function runChecks() {
  // 1. Potential duplicates: same customer, same date, same amount, different reference.
  const seen = new Map(); const duplicates = [];
  for (const s of SALES) {
    if (s.amount === null) continue;
    const key = `${s.customer.toLowerCase()}|${s.date}|${s.amount}`;
    if (seen.has(key)) duplicates.push([seen.get(key), s.id]); else seen.set(key, s.id);
  }
  // 2. Missing information: a sale with no amount.
  const missing = SALES.filter((s) => s.amount === null).map((s) => s.id);
  // 3. Outstanding follow-up: open longer than FOLLOW_UP_DAYS working days with no next action.
  const followUp = REQUESTS.filter((r) => r.status === 'Open' && !r.next.trim() && workingDaysOpen(r) > FOLLOW_UP_DAYS).map((r) => r.id);
  return { duplicates, missing, followUp };
}

const sale = (id) => SALES.find((s) => s.id === id);
const paymentsFor = (id) => PAYMENTS.filter((p) => p.sale === id);

/** One finding per planted issue, with the source rows behind it and the wording for the page. */
export function findings(s = initialState()) {
  const c = runChecks(); const out = [];
  for (const pair of c.duplicates) {
    const rows = pair.map(sale);
    out.push({ issue: 'duplicate', ids: pair, amount: rows[1].amount, records: { sales: rows, payments: pair.flatMap(paymentsFor) } });
  }
  for (const id of c.missing) {
    const pays = paymentsFor(id);
    out.push({ issue: 'missing', ids: [id], payment: pays[0], records: { sales: [sale(id)], payments: pays } });
  }
  for (const id of c.followUp) {
    const r = REQUESTS.find((x) => x.id === id);
    out.push({ issue: 'followUp', ids: [id], record: r, days: workingDaysOpen(r), receivedDay: DAY_NAMES[r.received.split(' ')[0]], records: { requests: [r] } });
  }
  return out.map((f) => {
    const i = ISSUES[f.issue];
    return {
      ...f, title: i.title, hero: i.hero, source: i.source, rule: i.rule, prevent: i.prevent,
      why: i.why(f), action: typeof i.action === 'function' ? i.action(f) : i.action,
      choices: i.choices.map(([v, label]) => [v, label(f)]),
      decision: s.decisions[f.issue],
      consequence: s.decisions[f.issue] ? CONSEQUENCE[s.decisions[f.issue]](f) : '',
    };
  });
}

/** Make, change or clear (choice null) a decision. Invalid input leaves the state unchanged. */
export function decide(s, issue, choice) {
  if (!ISSUE_IDS.includes(issue)) return s;
  if (choice !== null && !ISSUES[issue].choices.some(([c]) => c === choice)) return s;
  return { ...s, decisions: { ...s.decisions, [issue]: choice } };
}

export const allDecided = (s) => ISSUE_IDS.every((i) => s.decisions[i]);

/** The sales that count towards the total after the decisions, with the amount each one counts at. */
function countedSales(s) {
  const c = runChecks(); const d = s.decisions;
  const removed = d.duplicate === 'remove' ? new Set(c.duplicates.map((p) => p[1])) : new Set();
  return SALES.filter((x) => !removed.has(x.id)).map((x) => {
    if (x.amount !== null) return x;
    const paid = paymentsFor(x.id).reduce((t, p) => t + p.amount, 0);
    return d.missing === 'usePayment' && paid ? { ...x, amount: paid } : x;
  });
}

/** Sales not yet fully paid, after the decisions (only sales with an amount can be owed). */
export function stillOwed(s) {
  const rows = countedSales(s).filter((x) => x.amount !== null)
    .map((x) => ({ id: x.id, customer: x.customer, owed: x.amount - paymentsFor(x.id).reduce((t, p) => t + p.amount, 0) }))
    .filter((x) => x.owed > 0);
  return { rows, total: rows.reduce((t, x) => t + x.owed, 0) };
}

/** Report status: Review required → Ready to share, or Follow-up pending when a check was left for the team. */
export function status(s) {
  if (!allDecided(s)) return 'Review required';
  return s.decisions.missing === 'checkFirst' ? 'Follow-up pending' : 'Ready to share';
}

/** The weekly report, as the Overview tab shows it. */
export function report(s = initialState()) {
  const sales = countedSales(s);
  const withAmount = sales.filter((x) => x.amount !== null);
  const d = s.decisions;
  const openRequests = REQUESTS.filter((r) => r.status === 'Open').length - (d.followUp === 'handled' ? runChecks().followUp.length : 0);
  const noNextAction = d.followUp ? 0 : runChecks().followUp.length;
  return {
    salesCount: sales.length,
    salesTotal: withAmount.reduce((t, x) => t + x.amount, 0),
    missingAmounts: sales.length - withAmount.length,
    paymentsCount: PAYMENTS.length,
    paymentsTotal: PAYMENTS.reduce((t, p) => t + p.amount, 0),
    openRequests,
    noNextAction,
    toCheck: ISSUE_IDS.filter((i) => !d[i]).length,
    owed: stillOwed(s).total,
    status: status(s),
  };
}

/** The sales total if both sales checks are confirmed (duplicate removed, amount filled in from the payment). */
export function confirmedTotal() {
  return report({ decisions: { duplicate: 'remove', missing: 'usePayment', followUp: null } }).salesTotal;
}

/** The hero card: the sheet before the check, the three things found, and what the total could be. */
export function heroSummary() {
  const counts = sourceCounts(); const r = report(); const fs = findings();
  return {
    sourceRecords: counts.total, sources: counts.sources, sales: counts.sales,
    salesTotal: n(r.salesTotal), confirmedTotal: n(confirmedTotal()),
    toCheck: fs.length, status: r.status, weekRange: weekRange(WEEK),
    issues: fs.map((f) => ({ issue: f.issue, title: f.hero, source: f.source })),
  };
}

/** The AI summary the Data & Reporting preview drafts for a person to review. Built only from the engine's numbers. */
export function aiSummary() {
  const r = report(); const fs = findings();
  const dup = fs.find((f) => f.issue === 'duplicate'); const mis = fs.find((f) => f.issue === 'missing'); const fol = fs.find((f) => f.issue === 'followUp');
  return [
    `Sales recorded: ${n(r.salesTotal)} across ${r.salesCount} sales.`,
    `Two items need checking before this total is final: a potential duplicate (${dup.ids[1]}, ${n(dup.amount)}) and a sale with no amount (${mis.ids[0]}; payment shows ${n(mis.payment.amount)}).`,
    `Payments received: ${n(r.paymentsTotal)}.`,
    `One quote request (${fol.record.customer}) has no next action.`,
  ];
}

/** 'Week ending Fri 6 Nov 2026' → '2–6 November 2026' (Monday to Friday; spans months if needed). */
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
