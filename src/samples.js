// NOT LOADED since 10 Nov 2026: the three "Try it" mini-demos were removed from the services section.
// The Weekly Work & Follow-up Tracker (src/tracker/) is the one integrated demo. Kept in the repo for now.
// The three service samples (master brief, 10 Nov 2026). Each is small, focused and different, and each works on
// its own small sample dataset, so it can be understood without the main live example:
//   report    Data & Reporting:          three spreadsheets with different columns → refresh → one checked report.
//   workflow  Workflows & Processes:     submit a request → assign → in progress → completed, with a reminder.
//   tools     Business Tools & Systems:  search a customer → their requests, records and tasks → update a task.
// Everything runs in the browser on sample data. Nothing is sent, saved or changed anywhere.

import { esc } from './forms.js';

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAFF = ['Ana', 'Ben', 'Carla'];

export function mountSamples() {
  document.querySelectorAll('[data-mini]').forEach((fig) => {
    const app = fig.querySelector('[data-mini-app]'); if (!app) return;
    ({ report: mountReport, workflow: mountWorkflow, tools: mountTools })[fig.dataset.mini]?.(app);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Data & Reporting: a refreshable reporting workbook.
// Three files, three layouts. The refresh standardises dates and statuses, combines the rows, runs two checks
// (required date, possible duplicate across files) and recalculates the report. Flagged rows are kept, not removed.
export const REPORT_FILES = [
  { name: 'Branch A.xlsx', cols: ['Date', 'Customer', 'Status'], rows: [['02/11/2026', 'Bayview Co.', 'Done'], ['03/11/2026', 'Greenfield Ltd', 'Open'], ['04/11/2026', 'Riverside Group', 'Done'], ['05/11/2026', 'Oakline Studio', 'Open']] },
  { name: 'branch-b-export.csv', cols: ['created_on', 'client', 'state'], rows: [['2026-11-02', 'Summit Supplies', 'closed'], ['2026-11-03', 'Westgate Clinic', 'open'], ['2026-11-05', 'Lakeside Cafe', 'closed'], ['', 'Pinecrest Offices', 'open']] },
  { name: 'Web form responses', cols: ['Submitted', 'Name', 'Stage'], rows: [['Tue 3 Nov', 'Greenfield Ltd', 'New'], ['Thu 5 Nov', 'Northside Partners', 'Complete'], ['Fri 6 Nov', 'Harbour & Co.', 'New']] },
];
const LAST_WEEK = { rows: 9, completed: 6, open: 3, flagged: 0, refreshed: 'Fri 30 Oct' };
const STATUS_MAP = { done: 'Completed', closed: 'Completed', complete: 'Completed', open: 'Open', new: 'Open' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function stdDate(v) {
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (m) return v;
  m = /^\w{3} (\d{1,2}) (\w{3})$/.exec(v); if (m) return `2026-${String(MON.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
const show = (iso) => (iso ? `${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}` : '');

/** The refresh, as a pure function: combined rows, the checks, and the report figures. */
export function refreshReport(files = REPORT_FILES) {
  const rows = files.flatMap((f) => f.rows.map(([d, c, st]) => ({ source: f.name, date: stdDate(d), raw: d, customer: c, status: STATUS_MAP[String(st).toLowerCase()] || 'Unknown' })));
  const seen = new Map();
  rows.forEach((r, i) => {
    r.flags = [];
    if (!r.date) r.flags.push('Missing date');
    const key = `${r.customer.toLowerCase()}|${r.date}`;
    if (r.date && seen.has(key) && rows[seen.get(key)].source !== r.source) { r.flags.push('Possible duplicate'); rows[seen.get(key)].flags.push('Possible duplicate'); } else seen.set(key, i);
  });
  return {
    rows,
    report: {
      rows: rows.length,
      completed: rows.filter((r) => r.status === 'Completed').length,
      open: rows.filter((r) => r.status === 'Open').length,
      flagged: rows.filter((r) => r.flags.length).length,
      missingDate: rows.filter((r) => r.flags.includes('Missing date')).length,
      duplicates: rows.filter((r) => r.flags.includes('Possible duplicate')).length / 2,
      bySource: files.map((f) => ({ source: f.name, rows: f.rows.length })),
      refreshed: 'Fri 6 Nov',
    },
  };
}

function mountReport(app) {
  const STEPS = ['Load the three files', 'Combine the rows', 'Standardise dates and statuses', 'Run the checks', 'Update the report'];
  let state = 'old'; let step = 0; let sheet = 'Report'; let timer = null;
  const out = refreshReport();
  const tabs = ['Files', 'Combined', 'Checks', 'Report'];
  function sheetHtml() {
    const r = state === 'done' ? out.report : null;
    if (sheet === 'Files') return REPORT_FILES.map((f) => `<div class="mini-file"><p class="mini-file-h">${esc(f.name)}</p><table class="mini-table"><thead><tr>${f.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${f.rows.map((row) => `<tr>${row.map((v) => `<td>${v ? esc(v) : '<em class="dt-blank">blank</em>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
    if (sheet === 'Combined') return state !== 'done' ? '<p class="mini-muted">Refresh to combine the files.</p>' : `<table class="mini-table"><thead><tr><th scope="col">Date</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">From</th></tr></thead><tbody>${out.rows.map((x) => `<tr${x.flags.length ? ' class="is-flag"' : ''}><td>${x.date ? esc(show(x.date)) : '<em class="dt-blank">missing</em>'}</td><td>${esc(x.customer)}</td><td>${esc(x.status)}</td><td>${esc(x.source)}</td></tr>`).join('')}</tbody></table>`;
    if (sheet === 'Checks') return state !== 'done' ? '<p class="mini-muted">Refresh to run the checks.</p>' : `<ul class="mini-checks"><li class="ok">Dates from 3 formats standardised</li><li class="ok">Statuses lined up (Done, closed, Complete → Completed; Open, open, New → Open)</li><li>${out.report.missingDate} row with a missing date: kept and flagged</li><li>${out.report.duplicates} possible duplicate across two files: kept and flagged for you to check</li></ul><p class="mini-muted">These are the checks set up for these files. They won’t catch everything.</p>`;
    const k = r || LAST_WEEK;
    return `<dl class="mini-kpis"><div><dt>Requests</dt><dd>${k.rows}</dd></div><div><dt>Completed</dt><dd>${k.completed}</dd></div><div><dt>Open</dt><dd>${k.open}</dd></div><div class="${k.flagged ? 'is-warn' : ''}"><dt>To check</dt><dd>${k.flagged}</dd></div></dl>
      ${r ? `<p class="mini-by">${r.bySource.map((b) => `${esc(b.source)}: ${b.rows}`).join(' · ')}</p>` : ''}
      <p class="mini-muted">${r ? `Refreshed ${esc(r.refreshed)} from this week’s files.` : `Last refreshed ${esc(LAST_WEEK.refreshed)}: these are last week’s figures.`}</p>`;
  }
  function paint() {
    app.innerHTML = `<div class="mini-wb">
      <div class="mini-wb-bar"><span>Weekly report.xlsx</span><button type="button" class="btn btn-primary btn-small" data-r="refresh"${state === 'running' ? ' disabled' : ''}>${state === 'done' ? 'Refresh again' : 'Refresh report'}</button></div>
      ${state === 'running' ? `<ol class="mini-steps">${STEPS.map((x, i) => `<li class="${i < step ? 'is-done' : i === step ? 'is-now' : ''}">${esc(x)}</li>`).join('')}</ol>` : ''}
      <div class="mini-sheet" role="tabpanel" aria-label="${esc(sheet)} sheet">${sheetHtml()}</div>
      <div class="mini-tabs" role="group" aria-label="Sheets">${tabs.map((t) => `<button type="button" class="mini-tab" data-sheet="${t}" aria-pressed="${t === sheet}">${t}</button>`).join('')}</div>
    </div><p class="mini-live" aria-live="polite">${state === 'done' ? `Report refreshed: ${out.report.rows} requests, ${out.report.completed} completed, ${out.report.open} open, ${out.report.flagged} rows to check.` : ''}</p>`;
  }
  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sheet]'); if (t) { sheet = t.dataset.sheet; paint(); app.querySelector(`[data-sheet="${sheet}"]`)?.focus(); return; }
    if (!e.target.closest('[data-r="refresh"]')) return;
    clearInterval(timer); state = 'running'; step = 0; sheet = 'Report'; paint();
    const tick = () => { step += 1; if (step >= STEPS.length) { clearInterval(timer); state = 'done'; } paint(); if (state === 'done') app.querySelector('[data-r="refresh"]')?.focus(); };
    if (reduceMotion()) { step = STEPS.length - 1; tick(); } else timer = setInterval(tick, 420);
  });
  paint();
}

// ---------------------------------------------------------------------------------------------------------------
// Workflows & Processes: one request from received to completed.
export const FLOW_STEPS = ['Received', 'Assigned', 'In progress', 'Completed'];
/** The request workflow as a pure state machine. Returns the same state if the move isn't allowed. */
export function flow(s, act, arg) {
  const log = (text) => [...s.log, text];
  switch (act) {
    case 'submit': return s.step === null && arg?.type && arg?.from ? { ...s, step: 0, req: { id: 'R-501', ...arg, due: 'Tue 10 Nov' }, log: log(`R-501 received from ${arg.from}: ${arg.type.toLowerCase()}`) } : s;
    case 'assign': return s.step === 0 && STAFF.includes(arg) ? { ...s, step: 1, owner: arg, log: log(`Assigned to ${arg}, due Tue 10 Nov`) } : s;
    case 'start': return s.step === 1 ? { ...s, step: 2, log: log(`${s.owner} started work`) } : s;
    case 'remind': return [1, 2].includes(s.step) && !s.reminded ? { ...s, reminded: true, log: log(`Reminder prepared for ${s.owner}: “R-501 is due Tue 10 Nov” (simulated, nothing sent)`) } : s;
    case 'done': return s.step === 2 ? { ...s, step: 3, log: log(`${s.owner} marked it completed`) } : s;
    default: return s;
  }
}
const FLOW0 = { step: null, req: null, owner: '', reminded: false, log: [] };

function mountWorkflow(app) {
  let s = FLOW0;
  function paint() {
    const st = s.step;
    let ctl = '';
    if (st === null) ctl = `<form class="mini-form" data-w="form"><label>Request <select name="type"><option>Quote request</option><option>Order change</option><option>Document request</option></select></label><label>From <select name="from"><option>Bayview Co.</option><option>Oakline Studio</option><option>Riverside Group</option></select></label><button type="submit" class="btn btn-primary btn-small">Submit request</button></form>`;
    else if (st === 0) ctl = `<div class="mini-ctl"><label>Assign to <select data-w="owner"><option value="">Choose…</option>${STAFF.map((p) => `<option>${p}</option>`).join('')}</select></label></div>`;
    else if (st === 1) ctl = `<div class="mini-ctl"><button type="button" class="btn btn-primary btn-small" data-w="start">Start work</button><button type="button" class="btn btn-secondary btn-small" data-w="remind"${s.reminded ? ' disabled' : ''}>${s.reminded ? 'Reminder prepared' : 'Send a reminder'}</button></div>`;
    else if (st === 2) ctl = `<div class="mini-ctl"><button type="button" class="btn btn-primary btn-small" data-w="done">Mark complete</button><button type="button" class="btn btn-secondary btn-small" data-w="remind"${s.reminded ? ' disabled' : ''}>${s.reminded ? 'Reminder prepared' : 'Send a reminder'}</button></div>`;
    else ctl = `<p class="mini-done">Done: one owner, clear progress, and nothing slipped. <button type="button" class="dt-link" data-w="again">Start over</button></p>`;
    app.innerHTML = `
      <ol class="mini-flow" aria-label="Request progress">${FLOW_STEPS.map((x, i) => `<li class="${st !== null && i < st ? 'is-done' : st === i ? 'is-now' : ''}"${st === i ? ' aria-current="step"' : ''}>${x}</li>`).join('')}</ol>
      ${s.req ? `<div class="mini-req"><p><strong>${esc(s.req.id)}</strong> ${esc(s.req.type)} from ${esc(s.req.from)}</p><p class="mini-muted">${s.owner ? `Owner: ${esc(s.owner)} · ` : 'No owner yet · '}due ${esc(s.req.due)}</p></div>` : '<p class="mini-muted">No request yet. Submit one to start.</p>'}
      ${ctl}
      ${s.log.length ? `<ol class="mini-log" aria-label="Activity">${s.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
      <p class="mini-live" aria-live="polite">${s.log.length ? esc(s.log[s.log.length - 1]) : ''}</p>`;
  }
  const go = (act, arg) => { const next = flow(s, act, arg); if (next === s) return; s = next; paint(); app.querySelector('select, .btn-primary, [data-w="again"]')?.focus(); };
  app.addEventListener('submit', (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); go('submit', { type: d.type, from: d.from }); });
  app.addEventListener('change', (e) => { if (e.target.matches('[data-w="owner"]') && e.target.value) go('assign', e.target.value); });
  app.addEventListener('click', (e) => { const b = e.target.closest('[data-w]'); if (!b || b.tagName === 'FORM' || b.tagName === 'SELECT') return; if (b.dataset.w === 'again') { s = FLOW0; paint(); app.querySelector('select')?.focus(); return; } go(b.dataset.w); });
  paint();
}

// ---------------------------------------------------------------------------------------------------------------
// Business Tools & Systems: one place to look up a customer.
export const CUSTOMERS = [
  { name: 'Bayview Co.', requests: ['Quote for new site (R-601)'], records: ['Quote sent, Mon 2 Nov', 'Invoice issued, Thu 5 Nov'], tasks: [{ id: 'K-1', task: 'Follow up on the quote', owner: 'Ana', status: 'Open' }] },
  { name: 'Greenfield Ltd', requests: ['Account question (R-602)', 'Document request (R-607)'], records: ['Account note, Tue 3 Nov'], tasks: [{ id: 'K-2', task: 'Answer account question', owner: 'Carla', status: 'Done' }, { id: 'K-3', task: 'Send the documents', owner: 'Carla', status: 'Waiting on customer' }] },
  { name: 'Lakeside Cafe', requests: ['Order change (R-603)'], records: ['Order updated, Wed 4 Nov', 'Payment received, Fri 6 Nov'], tasks: [{ id: 'K-4', task: 'Confirm the changed order', owner: 'Ben', status: 'Open' }] },
  { name: 'Oakline Studio', requests: ['Service request (R-604)'], records: [], tasks: [{ id: 'K-5', task: 'Arrange the visit', owner: 'Ben', status: 'Open' }] },
  { name: 'Summit Supplies', requests: ['Quote request (R-605)'], records: ['Quote sent, Thu 5 Nov'], tasks: [{ id: 'K-6', task: 'Follow up on the quote', owner: 'Ana', status: 'Done' }] },
];
export const TASK_STATUSES = ['Open', 'Waiting on customer', 'Done'];
/** Overview counts for the customer workspace, from the tasks as they stand. */
export function toolsOverview(statuses) {
  const all = CUSTOMERS.flatMap((c) => c.tasks.map((t) => statuses[t.id] || t.status));
  return { customers: CUSTOMERS.length, open: all.filter((x) => x === 'Open').length, waiting: all.filter((x) => x === 'Waiting on customer').length, done: all.filter((x) => x === 'Done').length };
}

function mountTools(app) {
  let q = ''; let sel = CUSTOMERS[0].name; const statuses = {}; let msg = '';
  const st = (t) => statuses[t.id] || t.status;
  function paint() {
    const o = toolsOverview(statuses);
    const list = CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    const c = CUSTOMERS.find((x) => x.name === sel);
    app.innerHTML = `
      <dl class="mini-kpis mini-kpis-sm"><div><dt>Customers</dt><dd>${o.customers}</dd></div><div><dt>Open tasks</dt><dd>${o.open}</dd></div><div><dt>Waiting on customer</dt><dd>${o.waiting}</dd></div><div><dt>Done</dt><dd>${o.done}</dd></div></dl>
      <div class="mini-ws">
        <div class="mini-ws-l"><label class="mini-search">Search customers <input type="search" data-t="q" value="${esc(q)}" placeholder="Type a name" autocomplete="off"></label>
          <ul class="mini-cust">${list.map((x) => { const open = x.tasks.filter((t) => st(t) !== 'Done').length; return `<li><button type="button" data-t="pick" data-name="${esc(x.name)}" aria-pressed="${x.name === sel}"><span>${esc(x.name)}</span><small>${open ? `${open} open` : 'all done'}</small></button></li>`; }).join('') || '<li class="mini-muted">No match</li>'}</ul></div>
        <div class="mini-ws-r">${c ? `<p class="mini-ws-h">${esc(c.name)}</p>
          <p class="mini-k">Requests</p><ul class="mini-rel">${c.requests.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
          <p class="mini-k">Related records</p><ul class="mini-rel">${c.records.map((r) => `<li>${esc(r)}</li>`).join('') || '<li class="mini-muted">None yet</li>'}</ul>
          <p class="mini-k">Tasks</p><ul class="mini-tasks">${c.tasks.map((t) => `<li><span>${esc(t.task)}<small>Owner: ${esc(t.owner)}</small></span><label class="sr-only" for="ts-${t.id}">Status of ${esc(t.task)}</label><select id="ts-${t.id}" data-t="status" data-id="${t.id}">${TASK_STATUSES.map((x) => `<option${x === st(t) ? ' selected' : ''}>${x}</option>`).join('')}</select></li>`).join('')}</ul>` : ''}</div>
      </div>
      <p class="mini-live" aria-live="polite">${esc(msg)}</p>`;
  }
  app.addEventListener('input', (e) => { if (e.target.matches('[data-t="q"]')) { q = e.target.value; const pos = e.target.selectionStart; paint(); const i = app.querySelector('[data-t="q"]'); i.focus(); i.setSelectionRange(pos, pos); } });
  app.addEventListener('click', (e) => { const b = e.target.closest('[data-t="pick"]'); if (b) { sel = b.dataset.name; msg = `Showing ${sel}.`; paint(); app.querySelector(`[data-name="${CSS.escape(sel)}"]`)?.focus(); } });
  app.addEventListener('change', (e) => { if (e.target.matches('[data-t="status"]')) { const id = e.target.dataset.id; statuses[id] = e.target.value; msg = `Task updated to “${e.target.value}”. Sample only: nothing else was changed.`; paint(); app.querySelector(`#ts-${id}`)?.focus(); } });
  paint();
}
