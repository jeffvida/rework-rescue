// Weekly Work & Follow-up Tracker: the business rules (implementation brief, section 5). Pure functions, no DOM.
// The workbook's formulas (tools/build_tracker_xlsx.py) implement these same rules; tools/check_tracker_xlsx.py
// recalculates the workbook and compares it with this file on the sample and on edited copies, so the two can't drift.
//
//   Total        records whose Date Received falls in the reporting period (start and end included)
//   Completed    Status = Completed                     Outstanding  any other status
//   Overdue      not Completed and Due Date earlier than the as-at date (due on the as-at date is not overdue yet)
//   Unassigned   not Completed and Assigned To blank or "Unassigned"
//   Missing      Date Received, Request / Task, Customer / Area or Due Date blank
//   Duplicate    same Date Received, Customer / Area and Request / Task (case and outer spaces ignored); flagged only
//   Attention    unique records with at least one of the four findings; each record counts once
// Every figure counts records in the reporting period. Text is compared trimmed and case-insensitive, like Excel's "=".

import { RECORDS, PERIOD, COMPLETED, UNASSIGNED, FLAG, FLAG_SEP, STATUSES } from './data.js';

const t = (v) => String(v ?? '').trim();
const low = (v) => t(v).toLowerCase();
const blank = (v) => t(v) === '';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const isCompleted = (r) => low(r.status) === COMPLETED.toLowerCase();
export const isEmptyRow = (r) => ['received', 'task', 'customer', 'owner', 'due', 'status'].every((k) => blank(r[k]));
export const inPeriod = (r, p = PERIOD) => !blank(r.received) && r.received >= p.start && r.received <= p.end;
export const isOverdue = (r, p = PERIOD) => !isEmptyRow(r) && !isCompleted(r) && !blank(r.due) && r.due < p.asAt;
export const isUnassigned = (r) => !isEmptyRow(r) && !isCompleted(r) && (blank(r.owner) || low(r.owner) === UNASSIGNED.toLowerCase());
export const missingFields = (r) => (isEmptyRow(r) ? [] : ['received', 'task', 'customer', 'due'].filter((k) => blank(r[k])));
const dupKey = (r) => (blank(r.received) || blank(r.task) || blank(r.customer) ? '' : `${t(r.received)}|${low(r.task)}|${low(r.customer)}`);
export function duplicatesOf(r, all) {
  const k = dupKey(r);
  return k ? all.filter((o) => o !== r && dupKey(o) === k).map((o) => o.ref) : [];
}

// The findings for one record, in display order, each with its label and a short next step.
export function findings(r, all, p = PERIOD) {
  const out = [];
  if (isOverdue(r, p)) out.push({ key: 'overdue', label: FLAG.overdue, note: `Due ${day(r.due)} and still ${phrase(r.status)}.` });
  const miss = missingFields(r);
  if (miss.length) {
    const onlyCustomer = miss.length === 1 && miss[0] === 'customer';
    out.push({ key: 'missing', label: onlyCustomer ? FLAG.missingCustomer : FLAG.missing,
      note: onlyCustomer ? 'Add the missing customer or area details.' : `Add the missing ${list(miss.map((k) => FIELD_WORDS[k]))}.` });
  }
  if (isUnassigned(r)) out.push({ key: 'unassigned', label: FLAG.unassigned, note: 'Choose someone to take responsibility.' });
  const dups = duplicatesOf(r, all);
  if (dups.length) out.push({ key: 'duplicate', label: FLAG.duplicate, note: `Matches ${list(dups)} on date, customer and request. Check before counting both.` });
  return out;
}
export const flagText = (r, all, p = PERIOD) => findings(r, all, p).map((f) => f.label).join(FLAG_SEP);

const FIELD_WORDS = { received: 'date received', task: 'request / task', customer: 'customer or area', due: 'due date' };
function phrase(status) {
  const s = low(status);
  if (s === 'waiting') return 'waiting';
  if (s === 'in progress') return 'in progress';
  if (s === 'not started') return 'not started';
  return 'open';
}
export function day(iso) { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; }
export function shortDate(iso) { if (blank(iso)) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`; }
function list(xs) { return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`; }

// The weekly figures, the follow-up list and the summary sentence, all from the records as they are now.
export function summarise(records = RECORDS, p = PERIOD) {
  const rows = records.filter((r) => inPeriod(r, p));
  const followUps = rows.map((r) => ({ r, f: findings(r, records, p) })).filter((x) => x.f.length).map(({ r, f }) => ({
    ref: r.ref, title: t(r.task), owner: t(r.owner), due: r.due,
    labels: f.map((x) => x.label), keys: f.map((x) => x.key), note: f.map((x) => x.note).join(' '), reason: f.map((x) => x.label).join(FLAG_SEP),
  }));
  const m = {
    total: rows.length,
    completed: rows.filter(isCompleted).length,
    outstanding: rows.filter((r) => !isCompleted(r)).length,
    overdue: rows.filter((r) => isOverdue(r, p)).length,
    unassigned: rows.filter(isUnassigned).length,
    missing: rows.filter((r) => missingFields(r).length).length,
    duplicates: rows.filter((r) => duplicatesOf(r, records).length).length,
    attention: followUps.length,
    followUps,
  };
  return Object.freeze({ ...m, text: summaryText(m) });
}

export function summaryText({ total, completed, outstanding, attention }) {
  const rec = (n) => `${n} record${n === 1 ? '' : 's'}`;
  const a = `${rec(total)} ${total === 1 ? 'was' : 'were'} received during the reporting period.`;
  const b = outstanding === 0 ? `All ${completed} are marked as completed.`
    : completed === 0 ? `None are marked as completed yet, and ${outstanding} ${outstanding === 1 ? 'remains' : 'remain'} outstanding.`
      : `${completed} ${completed === 1 ? 'is' : 'are'} marked as completed, while ${outstanding} ${outstanding === 1 ? 'remains' : 'remain'} outstanding.`;
  const c = attention === 0 ? 'No records need attention.' : `${rec(attention)} ${attention === 1 ? 'needs' : 'need'} attention.`;
  return total === 0 ? 'No records were received during the reporting period.' : `${a} ${b} ${c}`;
}

// ---- Editing (each returns new frozen records; the originals in data.js are never changed)
const edit = (records, ref, patch) => Object.freeze(records.map((r) => (r.ref === ref ? Object.freeze({ ...r, ...patch }) : r)));
export const setOwner = (records, ref, owner) => edit(records, ref, { owner });
export const setStatus = (records, ref, status) => edit(records, ref, { status });
export const setCustomer = (records, ref, customer) => edit(records, ref, { customer });
export const addRecord = (records, rec) => Object.freeze([...records, Object.freeze({ ...rec })]);

// One line for the hero illustration's "Insights" panel, from the same figures (simulated; no AI runs on the page).
export function heroInsight(s = summarise()) {
  const parts = [];
  if (s.overdue) parts.push(`${s.overdue} ${s.overdue === 1 ? 'item is' : 'items are'} overdue`);
  if (s.unassigned) parts.push(`${s.unassigned} ${s.unassigned === 1 ? 'has' : 'have'} no owner`);
  if (s.missing) parts.push(`${s.missing} ${s.missing === 1 ? 'is' : 'are'} missing details`);
  if (s.duplicates) parts.push(`${s.duplicates} may be ${s.duplicates === 1 ? 'a duplicate' : 'duplicates'}`);
  if (!parts.length) return 'Nothing needs attention this week.';
  return `${list(parts).replace(/^./, (c) => c.toUpperCase())}. Follow these up before the weekly update.`;
}

// Records received per weekday in the reporting period (Mon–Fri), for the hero's small chart.
export function receivedByDay(records = RECORDS, p = PERIOD) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const counts = days.map(() => 0);
  for (const r of records.filter((x) => inPeriod(x, p))) {
    const wd = new Date(`${r.received}T00:00:00Z`).getUTCDay();
    if (wd >= 1 && wd <= 5) counts[wd - 1] += 1;
  }
  return days.map((day, i) => ({ day, received: counts[i] }));
}

// Work by status, for the hero's workflow strip.
export function byStatus(records = RECORDS, p = PERIOD) {
  const rows = records.filter((x) => inPeriod(x, p));
  return STATUSES.map((st) => ({ status: st, count: rows.filter((r) => low(r.status) === st.toLowerCase()).length }));
}
