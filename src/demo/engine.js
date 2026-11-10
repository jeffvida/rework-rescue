// Connected workspace engine (master brief, 10 Nov 2026): pure functions over ./data.js plus the visitor's actions.
//   Data       load three sources → standardise dates and references → consolidate → run the configured checks.
//   Reports    every figure is calculated from the consolidated records (with optional channel/status filters).
//   Actions    items to check and follow up: source reference, suggested next step, suggested responsibility, status.
//   Workflows  request received → reviewed → assigned → in progress → completed; sample requests; simulated reminders.
// Rules: the source rows are frozen and never edited; every change the visitor makes is stored separately, logged,
// and applied on top. Checks only report what the configured rules find in these records; they don't claim to find
// every problem. The AI-drafted text is simulated, built only from calculated figures, and says when something is
// unknown. Nothing is ever sent anywhere.

import { REQUESTS, TASKS, TRANSACTIONS, SOURCES, STAFF, RULES, PERIOD, REPORT_DATE, WEEK, TASK_FOR, REQUEST_TYPES, CHANNELS } from './data.js';

export { STAFF, PERIOD, WEEK, REQUEST_TYPES, CHANNELS, SOURCES };
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const AI_LABEL = 'AI-drafted · simulated in this demo';
export const STAGES = ['Request received', 'Reviewed', 'Assigned', 'In progress', 'Completed'];
export const ACTION_STATUSES = ['Needs checking', 'Waiting for follow-up', 'Assigned', 'In progress', 'Completed'];
export const n = (x) => x.toLocaleString('en-US');
const MAX_NEW = 5;

// ---- Standardising: each source keeps its own date and reference format.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const valid = (y, mo, d) => { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : ''; };
export const dayOf = (iso) => DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export function toIso(v) {
  if (!v) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) return valid(+m[3], +m[2], +m[1]);
  m = /^(\w{3}) (\d{1,2}) (\w{3})$/.exec(v);
  if (m) { const iso = valid(Number(REPORT_DATE.slice(0, 4)), MON.indexOf(m[3]) + 1, +m[2]); return iso && dayOf(iso) === m[1] ? iso : ''; }
  return '';
}
export const toRef = (v) => { const m = /^R-?(\d+)$/i.exec(String(v).trim()); return m ? `R-${m[1]}` : ''; };
export const fmtDate = (iso) => (iso ? `${dayOf(iso)} ${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}` : '');
const addWorkingDays = (iso, k) => { const d = new Date(`${iso}T00:00:00Z`); while (k > 0) { d.setUTCDate(d.getUTCDate() + 1); if (![0, 6].includes(d.getUTCDay())) k--; } return d.toISOString().slice(0, 10); };

// ---- State: everything the visitor does, kept apart from the source records.
export function initialState() {
  return Object.freeze({
    decisions: Object.freeze({ duplicate: null, missing: null, unmatched: null }),
    tasks: Object.freeze({}),       // T-xxx → { owner?, status?, completed?, reviewed? }
    added: Object.freeze([]),       // sample requests: { request, task }
    reminders: Object.freeze([]),   // { task, owner, seq }
    log: Object.freeze([]),
    seq: 0,
  });
}
const append = (s, e) => { const x = Object.freeze({ seq: s.seq + 1, ...e }); return { log: Object.freeze([...s.log, x]), seq: x.seq }; };

// ---- Sources as they stand (originals + sample requests the visitor added)
export const allRequests = (s) => [...REQUESTS, ...s.added.map((a) => a.request)];
export const allTasks = (s) => [...TASKS, ...s.added.map((a) => a.task)];
export const sourceCounts = (s = initialState()) => ({ requests: allRequests(s).length, tasks: allTasks(s).length, transactions: TRANSACTIONS.length, total: allRequests(s).length + allTasks(s).length + TRANSACTIONS.length, sources: SOURCES.length });

// ---- Checks (configured rules only)
const DUP = ['R-104', 'R-109']; const MISSING = 'R-111'; const MISSING_TX = 'TX-307'; const UNMATCHED = 'TX-309'; const LINK_TO = 'R-107';

/** Data checks on the source records. They report what the configured rules find; they don't change anything. */
export function runChecks(s = initialState()) {
  const reqs = allRequests(s).map((r) => ({ ...r, receivedIso: toIso(r.received) }));
  const seen = new Map(); const duplicates = [];
  for (const r of reqs) {
    if (!r.customer) continue;
    const key = RULES.duplicateKeys.map((k) => String(k === 'received' ? r.receivedIso : r[k]).toLowerCase()).join('|');
    if (seen.has(key)) duplicates.push([seen.get(key), r.id]); else seen.set(key, r.id);
  }
  const missing = reqs.filter((r) => RULES.required.requests.some((k) => !String(r[k] ?? '').trim())).map((r) => r.id);
  const ids = new Set(reqs.map((r) => r.id));
  const unmatched = TRANSACTIONS.filter((t) => !ids.has(toRef(t.request))).map((t) => t.id);
  const badDates = [...reqs.filter((r) => !r.receivedIso).map((r) => r.id), ...TRANSACTIONS.filter((t) => !toIso(t.date)).map((t) => t.id)];
  return { duplicates, missing, unmatched, badDates };
}

/** The check list shown in Data: what was loaded, standardised and found. */
export function checkList(s = initialState()) {
  const c = runChecks(s); const k = sourceCounts(s);
  const linked = TRANSACTIONS.length - c.unmatched.length;
  return [
    { id: 'loaded', label: `Loaded ${k.requests} requests, ${k.tasks} tasks and ${k.transactions} records from ${k.sources} sources`, ok: true },
    { id: 'dates', label: `Dates standardised from ${SOURCES.length} different formats`, ok: !c.badDates.length },
    { id: 'refs', label: `References matched: ${linked} of ${TRANSACTIONS.length} records linked to a request`, ok: !c.unmatched.length },
    { id: 'required', label: c.missing.length ? `Required fields: ${c.missing.length} request with a blank customer` : 'Required fields: all filled in', ok: !c.missing.length },
    { id: 'dupes', label: c.duplicates.length ? `Possible duplicates: ${c.duplicates.length} pair to check` : 'Possible duplicates: none found', ok: !c.duplicates.length },
  ];
}

// ---- Consolidated dataset: one row per request, with its task and linked records, standardised.
export function consolidated(s = initialState()) {
  const dup = s.decisions.duplicate?.choice; const mis = s.decisions.missing?.choice; const um = s.decisions.unmatched?.choice;
  return allRequests(s).map((r) => {
    const t = taskFor(s, r.id);
    let customer = r.customer; let customerNote = '';
    if (r.id === MISSING && !customer) { customer = mis === 'fill' ? 'Harbour & Co.' : ''; customerNote = mis === 'fill' ? `from ${MISSING_TX}, filled in by you` : 'unknown: needs confirming'; }
    const records = TRANSACTIONS.filter((x) => toRef(x.request) === r.id || (um === 'link' && x.id === UNMATCHED && r.id === LINK_TO)).map((x) => x.id);
    return {
      ref: r.id, received: toIso(r.received), customer, customerNote, type: r.type, channel: r.channel,
      task: t?.id ?? '', owner: t?.owner ?? '', due: t?.due ?? '', status: t?.status ?? '', completed: t?.completed ?? '',
      records, excluded: r.id === DUP[1] && dup === 'same', added: !REQUESTS.some((x) => x.id === r.id),
    };
  });
}
/** A task as it stands now: the original row with the visitor's changes on top. */
export function taskFor(s, requestId) {
  const base = allTasks(s).find((t) => t.request === requestId); if (!base) return null;
  return { ...base, ...(s.tasks[base.id] || {}) };
}
const currentTasks = (s) => allTasks(s).map((t) => ({ ...t, ...(s.tasks[t.id] || {}) }));

// ---- Items to check and follow up (the Actions view)

/** Every item that needs attention, with its source, suggested next step, suggested responsibility and status. */
export function actions(s = initialState()) {
  const d = s.decisions; const out = [];
  out.push({
    id: 'duplicate', kind: 'data', title: 'Possible duplicate request', refs: DUP, source: 'Requests Register',
    detail: 'R-104 and R-109: same customer (Summit Supplies), same request type and same day, different references.',
    next: 'Check both requests and count it once if it’s the same request.', team: 'Admin',
    choices: [['same', 'Same request: count it once'], ['separate', 'Two separate requests: keep both']],
    decision: d.duplicate?.choice ?? null, status: d.duplicate ? 'Completed' : 'Needs checking',
  });
  out.push({
    id: 'missing', kind: 'data', title: 'Request with no customer', refs: [MISSING, MISSING_TX], source: 'Requests Register',
    detail: `R-111 has a blank customer. Record ${MISSING_TX}, filed against the same request, names Harbour & Co.`,
    next: 'Confirm the customer and fill it in.', team: 'Admin',
    choices: [['fill', `Use Harbour & Co. from ${MISSING_TX}`], ['unknown', 'Leave as unknown for now']],
    decision: d.missing?.choice ?? null, status: d.missing?.choice === 'fill' ? 'Completed' : d.missing ? 'Waiting for follow-up' : 'Needs checking',
  });
  out.push({
    id: 'unmatched', kind: 'data', title: 'Record with no matching request', refs: [UNMATCHED], source: 'Records & Transactions',
    detail: 'TX-309 (payment received, Lakeside Cafe) refers to request R115, which isn’t in the Requests Register. Lakeside Cafe’s only request this week is R-107.',
    next: 'Find the right request and link the record.', team: 'Accounts',
    choices: [['link', `Link it to ${LINK_TO} (Lakeside Cafe)`], ['leave', 'Leave unmatched for now']],
    decision: d.unmatched?.choice ?? null, status: d.unmatched?.choice === 'link' ? 'Completed' : d.unmatched ? 'Waiting for follow-up' : 'Needs checking',
  });
  const tasks = currentTasks(s); const excluded = new Set(consolidated(s).filter((r) => r.excluded).map((r) => r.ref));
  const late = TASKS.filter((t) => t.status !== 'Completed' && t.due < REPORT_DATE).map((t) => t.id);
  const unowned = TASKS.filter((t) => t.status !== 'Completed' && !t.owner).map((t) => t.id);
  for (const id of [...late, ...unowned, ...s.added.map((a) => a.task.id)]) {
    const t = tasks.find((x) => x.id === id); if (excluded.has(t.request)) continue;
    const isNew = s.added.some((a) => a.task.id === id);
    const req = allRequests(s).find((r) => r.id === t.request);
    out.push({
      id, kind: 'task', task: t, refs: [t.request, t.id], source: 'Work Tracker',
      title: isNew ? 'New request to review' : late.includes(id) ? 'Overdue task' : 'Task with no owner',
      detail: isNew ? `${t.request} from ${req.customer}: ${req.type.toLowerCase()}, received by ${req.channel.toLowerCase()}.` : late.includes(id) ? `${t.id} (${t.task.toLowerCase()} for ${req.customer}) was due ${fmtDate(t.due)} and is still ${t.status.toLowerCase()}.` : `${t.id} (${t.task.toLowerCase()} for ${req.customer}) has nobody assigned.`,
      next: isNew ? 'Review it and assign an owner.' : late.includes(id) ? 'Check what’s holding it up and agree a new date.' : 'Assign someone and set the next step.', team: 'Team lead',
      status: taskActionStatus(s, t),
    });
  }
  return out;
}
function taskActionStatus(s, t) {
  if (t.status === 'Completed') return 'Completed';
  if (!t.owner) return 'Needs checking';
  if (s.reminders.some((r) => r.task === t.id)) return 'Waiting for follow-up';
  return t.status === 'In progress' ? 'In progress' : 'Assigned';
}
export const openActions = (s = initialState()) => actions(s).filter((a) => a.status !== 'Completed');

// ---- Visitor actions (each returns a new state, or the same state if refused)

export function decide(s, issue, choice) {
  const a = actions(s).find((x) => x.id === issue && x.kind === 'data');
  if (!a || !a.choices.some(([v]) => v === choice) || s.decisions[issue]?.choice === choice) return s;
  const out = { ...s, decisions: Object.freeze({ ...s.decisions, [issue]: Object.freeze({ choice, seq: s.seq + 1 }) }) };
  return Object.freeze({ ...out, ...append(out, { type: 'decision', issue, choice, text: `${a.title}: ${a.choices.find(([v]) => v === choice)[1]}` }) });
}

const editTask = (s, id, patch, text) => {
  const prev = s.tasks[id] || {};
  const out = { ...s, tasks: Object.freeze({ ...s.tasks, [id]: Object.freeze({ ...prev, ...patch }) }) };
  return Object.freeze({ ...out, ...append(out, { type: 'task', task: id, text }) });
};
const findTask = (s, id) => currentTasks(s).find((t) => t.id === id);

/** Assign an owner (from the fictional staff list). */
export function assign(s, id, owner) {
  const t = findTask(s, id); if (!t || !STAFF.includes(owner) || t.owner === owner || t.status === 'Completed') return s;
  return editTask(s, id, { owner, reviewed: true }, `${id} assigned to ${owner}`);
}
/** Move a task along: Not started → In progress → Completed (completed on the report date). */
export function setStatus(s, id, status) {
  const t = findTask(s, id); if (!t || t.status === status || !['Not started', 'In progress', 'Completed'].includes(status)) return s;
  if (status !== 'Not started' && !t.owner) return s; // someone has to own it first
  return editTask(s, id, { status, completed: status === 'Completed' ? REPORT_DATE : '', reviewed: true }, `${id} marked ${status.toLowerCase()}`);
}
/** Mark a new request as reviewed. */
export function review(s, id) {
  const t = findTask(s, id); if (!t || t.reviewed !== false) return s;
  return editTask(s, id, { reviewed: true }, `${t.request} reviewed`);
}
/** A simulated reminder: logged, never sent. */
export function remind(s, id) {
  const t = findTask(s, id); if (!t || !t.owner || t.status === 'Completed' || s.reminders.some((r) => r.task === id)) return s;
  const out = { ...s, reminders: Object.freeze([...s.reminders, Object.freeze({ task: id, owner: t.owner, seq: s.seq + 1 })]) };
  return Object.freeze({ ...out, ...append(out, { type: 'reminder', task: id, text: `Reminder prepared for ${t.owner} about ${id} (simulated: nothing was sent)` }) });
}
/** A sample request from the Workflows form: it enters the Requests Register and creates its task. */
export function submitRequest(s, { customer, type, channel }) {
  if (!customer || !String(customer).trim() || !REQUEST_TYPES.includes(type) || !CHANNELS.includes(channel) || s.added.length >= MAX_NEW) return s;
  const num = 101 + allRequests(s).length; const tnum = 201 + allTasks(s).length;
  const request = Object.freeze({ id: `R-${num}`, received: '06/11/2026', customer: String(customer).trim().slice(0, 40), type, channel });
  const task = Object.freeze({ id: `T-${tnum}`, request: request.id, task: TASK_FOR[type], owner: '', due: addWorkingDays(REPORT_DATE, RULES.dueDays), status: 'Not started', completed: '', reviewed: false });
  const out = { ...s, added: Object.freeze([...s.added, Object.freeze({ request, task })]) };
  return Object.freeze({ ...out, ...append(out, { type: 'request', task: task.id, text: `${request.id} received from ${request.customer} (${type.toLowerCase()}); task ${task.id} created` }) });
}

// ---- Workflow board
export function stageOf(t) {
  if (t.status === 'Completed') return 'Completed';
  if (t.status === 'In progress') return 'In progress';
  if (t.reviewed === false) return 'Request received';
  return t.owner ? 'Assigned' : 'Reviewed';
}
export function board(s = initialState()) {
  const rows = consolidated(s).filter((r) => !r.excluded);
  return STAGES.map((stage) => ({ stage, items: rows.map((r) => ({ ...r, t: taskFor(s, r.ref) })).filter((r) => r.t && stageOf(r.t) === stage) }));
}

// ---- Report figures (calculated from the consolidated records)
export function metrics(s = initialState(), { channel = 'All' } = {}) {
  const rows = consolidated(s).filter((r) => !r.excluded && (channel === 'All' || r.channel === channel));
  const done = rows.filter((r) => r.status === 'Completed');
  const doneInPeriod = done.filter((r) => r.completed >= PERIOD.start && r.completed <= PERIOD.end);
  const open = rows.filter((r) => r.status !== 'Completed');
  const dupOpen = !s.decisions.duplicate && channel === 'All';
  return {
    requests: rows.length,
    duplicatePending: dupOpen,
    openRequests: open.length,
    completed: doneInPeriod.length,
    outstanding: open.length,
    overdue: open.filter((r) => r.due && r.due < REPORT_DATE).length,
    unassigned: open.filter((r) => !r.owner).length,
    onTime: done.length ? Math.round((done.filter((r) => r.completed <= r.due).length / done.length) * 100) : null,
    byDay: DAYS.map((day) => ({ day, completed: doneInPeriod.filter((r) => dayOf(r.completed) === day).length })),
    byChannel: CHANNELS.map((c) => ({ channel: c, count: rows.filter((r) => r.channel === c).length })),
    attention: openActions(s).length,
  };
}

/** The management summary (AI-drafted, simulated): only figures the engine calculated; unknowns said plainly. */
export function summary(s = initialState()) {
  const m = metrics(s); const open = openActions(s);
  const lines = [];
  lines.push(`${m.requests} requests ${m.duplicatePending ? '(one may be a duplicate) ' : ''}came in this week. ${m.completed} tasks were completed${m.onTime !== null ? `, ${m.onTime}% of them on time` : ''}, and ${m.outstanding} are still open.`);
  if (m.overdue) lines.push(`${m.overdue} open ${m.overdue === 1 ? 'task is' : 'tasks are'} past the due date.`);
  if (m.unassigned) lines.push(`${m.unassigned} open ${m.unassigned === 1 ? 'task has' : 'tasks have'} nobody assigned.`);
  if (s.decisions.missing?.choice !== 'fill') lines.push('One request has no customer recorded, so who it’s for is unknown until someone confirms it.');
  if (s.decisions.unmatched?.choice !== 'link') lines.push('One payment record couldn’t be matched to a request, so it isn’t counted against any request yet.');
  lines.push(open.length ? `Suggested focus: ${open.slice(0, 3).map((a) => a.next.replace(/\.$/, '').toLowerCase()).join('; ')}.` : 'Nothing is waiting for attention right now.');
  return lines;
}

/** The connected workspace overview (always visible above the four views, and in the hero). */
export function overview(s = initialState()) {
  const m = metrics(s); const k = sourceCounts(s); const b = board(s);
  return {
    records: k.total, sources: k.sources, requests: m.requests, openRequests: m.openRequests, completed: m.completed,
    attention: m.attention, inProgress: b.find((x) => x.stage === 'In progress').items.length, onTime: m.onTime,
  };
}

/** Reset is handled by the store (initialState); kept here for the static-fallback figures. */
export const FIRST = overview();
