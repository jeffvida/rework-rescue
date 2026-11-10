// The main live demonstration: one connected business workspace (master brief, 10 Nov 2026).
// A workspace overview stays on top; four views share one dataset and one state (./store.js):
//   Data       the three source files and the combined records, the checks that ran, and the source behind each item.
//   Reports    figures calculated from the combined records, filters, a chart, items needing attention, a summary.
//   Actions    items to check and follow up: source, suggested next step, suggested responsibility, status, decisions.
//   Workflows  request received → reviewed → assigned → in progress → completed, a sample-request form, reminders.
// Everything is simulated in the browser: nothing is sent, created or changed anywhere else. Reset starts again.

import { esc } from '../forms.js';
import { REQUESTS, TASKS, TRANSACTIONS } from './data.js';
import {
  consolidated, checkList, actions, openActions, metrics, summary, overview, board, stageOf, taskFor, fmtDate,
  SOURCES, STAFF, REQUEST_TYPES, CHANNELS, STAGES, AI_LABEL,
} from './engine.js';
import { getState, subscribe, decide, assign, setStatus, review, remind, submitRequest, reset } from './store.js';

const VIEWS = [
  ['data', 'Data', 'Combine and check'],
  ['reports', 'Reports', 'See the numbers'],
  ['actions', 'Actions', 'Follow up'],
  ['workflows', 'Workflows', 'Keep work moving'],
];
const ROWS = { requests: REQUESTS, tasks: TASKS, transactions: TRANSACTIONS };
const STATUS_CLASS = { 'Needs checking': 'open', 'Waiting for follow-up': 'unresolved', Assigned: 'disclosed', 'In progress': 'disclosed', Completed: 'resolved' };
const blank = '<em class="dt-blank">blank</em>';
const CUSTOMERS = [...new Set(REQUESTS.map((r) => r.customer).filter(Boolean))].sort();

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view = 'data';
  let src = 'combined';          // which table Data shows
  let focus = null;              // { refs, why } when Data was opened from an item
  let channel = 'All'; let listStatus = 'All';
  let note = '';                 // last result message in Workflows

  root.innerHTML = `
    <div class="dt cw">
      <div class="cw-over" aria-label="Connected workspace overview"></div>
      <div class="dt-head">
        <div class="dt-tabs" role="tablist" aria-label="Workspace views">${VIEWS.map(([id, name, q]) => `
          <button type="button" role="tab" class="dt-tab" id="dt-tab-${id}" aria-controls="dt-p-${id}" data-tab="${id}">
            <span class="dt-tab-name">${esc(name)}${id === 'actions' ? ' <span class="dt-count" data-count></span>' : ''}</span>
            <span class="dt-tab-q">${esc(q)}</span></button>`).join('')}
        </div>
        <p class="dt-status"><button type="button" class="dt-link" data-act="reset">Reset the demo</button></p>
      </div>
      ${VIEWS.map(([id]) => `<div class="dt-panel" role="tabpanel" id="dt-p-${id}" aria-labelledby="dt-tab-${id}" tabindex="0" hidden></div>`).join('')}
      <p class="sr-only" aria-live="polite"></p>
    </div>`;
  const live = root.querySelector('.dt > [aria-live]');
  const say = (m) => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };
  const panel = (id) => root.querySelector(`#dt-p-${id}`);

  // ---- Overview: the connected workspace, always visible
  function paintOverview() {
    const o = overview(getState()); const first = summary(getState())[0];
    root.querySelector('.cw-over').innerHTML = `
      <button type="button" class="cw-tile" data-tab="data"><span class="cw-k">Records</span><strong>${o.records}</strong><span>from ${o.sources} sources</span></button>
      <button type="button" class="cw-tile" data-tab="reports"><span class="cw-k">Requests</span><strong>${o.requests}</strong><span>${o.openRequests} open</span></button>
      <button type="button" class="cw-tile${o.attention ? ' is-warn' : ''}" data-tab="actions"><span class="cw-k">To check</span><strong>${o.attention}</strong><span>${o.attention === 1 ? 'item' : 'items'}</span></button>
      <button type="button" class="cw-tile" data-tab="workflows"><span class="cw-k">In progress</span><strong>${o.inProgress}</strong><span>${o.completed} done this week</span></button>
      <button type="button" class="cw-tile cw-sum" data-tab="reports"><span class="cw-k">Summary <span class="rl-ai">AI-drafted</span></span><span class="cw-sum-t">${esc(first)}</span></button>`;
  }

  // ---- Tables
  const cell = (v) => (v === '' || v === null || v === undefined ? blank : esc(v));
  function sourceTable(id, marks = []) {
    const meta = SOURCES.find((x) => x.id === id); const rows = id === 'requests' ? [...ROWS.requests, ...getState().added.map((a) => a.request)] : id === 'tasks' ? [...ROWS.tasks, ...getState().added.map((a) => a.task)] : ROWS[id];
    return `<div class="dt-table-wrap"><table class="dt-table"><caption>${esc(meta.name)}: ${rows.length} rows, as received (${esc(meta.format)})</caption>
      <thead><tr>${meta.fields.map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr id="src-${esc(r.id)}"${marks.includes(r.id) ? ' class="is-focus"' : ''}>${meta.fields.map(([k, l]) => `<td data-label="${esc(l)}">${cell(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function combinedTable(marks = []) {
    const rows = consolidated(getState()); const flagged = new Set(openActions(getState()).flatMap((a) => a.refs));
    return `<div class="dt-table-wrap"><table class="dt-table"><caption>Combined records: one row per request, dates and references standardised</caption>
      <thead><tr><th scope="col">Request</th><th scope="col">Received</th><th scope="col">Customer</th><th scope="col">Request type</th><th scope="col">Channel</th><th scope="col">Task</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Linked records</th></tr></thead>
      <tbody>${rows.map((r) => `<tr id="cmb-${esc(r.ref)}" class="${[marks.includes(r.ref) ? 'is-focus' : '', flagged.has(r.ref) || flagged.has(r.task) ? 'is-flag' : '', r.excluded ? 'is-excluded' : ''].filter(Boolean).join(' ')}">
        <td data-label="Request">${esc(r.ref)}${r.excluded ? ' <small class="dt-change">counted once (your decision)</small>' : ''}${r.added ? ' <small class="dt-change">sample request</small>' : ''}</td>
        <td data-label="Received">${esc(fmtDate(r.received))}</td>
        <td data-label="Customer">${r.customer ? esc(r.customer) : blank}${r.customerNote ? ` <small class="dt-change">${esc(r.customerNote)}</small>` : ''}</td>
        <td data-label="Request type">${esc(r.type)}</td><td data-label="Channel">${esc(r.channel)}</td>
        <td data-label="Task">${cell(r.task)}</td><td data-label="Owner">${cell(r.owner)}</td><td data-label="Status">${cell(r.status)}</td>
        <td data-label="Linked records">${r.records.length ? esc(r.records.join(', ')) : '<span class="dt-muted">none</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // ---- Data
  function paintData() {
    const s = getState(); const checks = checkList(s);
    const marks = focus?.refs ?? [];
    const tabs = [['combined', 'Combined records'], ...SOURCES.map((x) => [x.id, x.name])];
    panel('data').innerHTML = `
      ${focus ? `<div class="dt-why" role="note" tabindex="-1"><p><strong>${esc(focus.title)}</strong> · ${esc(focus.why)}</p><p><button type="button" class="dt-link" data-tab="actions">&larr; Back to Actions</button></p></div>` : ''}
      <p class="dt-intro">Three files come in as they are. They're combined into one list, dates and references are lined up, and the checks set up for this business run. <strong>Checks found items that may need attention.</strong> They only cover the rules that were set up, so they won't catch everything.</p>
      <ul class="dt-todo cw-checks">${checks.map((c) => `<li><span class="dt-todo-b is-${c.ok ? 'resolved' : 'open'}"><span class="dt-todo-t">${esc(c.label)}</span><span class="dt-todo-s">${c.ok ? 'OK' : 'To check'}</span></span></li>`).join('')}</ul>
      <div class="cw-seg" role="group" aria-label="Show">${tabs.map(([id, l]) => `<button type="button" class="cw-seg-b" data-src="${id}" aria-pressed="${src === id}">${esc(l)}</button>`).join('')}</div>
      ${src === 'combined' ? combinedTable(marks) : sourceTable(src, marks)}`;
    const row = panel('data').querySelector('tr.is-focus');
    if (row) setTimeout(() => row.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }), 30);
  }

  // ---- Reports
  function paintReports() {
    const s = getState(); const m = metrics(s, { channel }); const all = metrics(s); const sm = summary(s); const open = openActions(s);
    const max = Math.max(1, ...m.byDay.map((d) => d.completed));
    const list = consolidated(s).filter((r) => !r.excluded && (channel === 'All' || r.channel === channel) && (listStatus === 'All' || (listStatus === 'Open' ? r.status !== 'Completed' : r.status === 'Completed')));
    panel('reports').innerHTML = `
      <div class="cw-filters">
        <label>Channel <select data-filter="channel">${['All', ...CHANNELS].map((c) => `<option${c === channel ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label>Requests shown <select data-filter="status">${['All', 'Open', 'Completed'].map((c) => `<option${c === listStatus ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <span class="dt-muted">Week of ${esc(fmtDate('2026-11-02'))} – ${esc(fmtDate('2026-11-06'))}</span>
      </div>
      <dl class="dt-tiles dt-tiles-5">
        <div class="dt-tile"><dt>Total requests</dt><dd>${m.requests}</dd><p>${m.duplicatePending ? 'One may be a duplicate' : channel === 'All' ? 'Duplicates checked' : esc(channel)}</p></div>
        <div class="dt-tile"><dt>Open requests</dt><dd>${m.openRequests}</dd><p>${m.unassigned} with no owner</p></div>
        <div class="dt-tile"><dt>Completed tasks</dt><dd>${m.completed}</dd><p>this week</p></div>
        <div class="dt-tile${m.overdue ? ' is-check' : ''}"><dt>Outstanding tasks</dt><dd>${m.outstanding}</dd><p>${m.overdue} overdue</p></div>
        <div class="dt-tile"><dt>Completed on time</dt><dd>${m.onTime === null ? '—' : `${m.onTime}%`}</dd><p>of completed tasks</p></div>
      </dl>
      <div class="cw-two">
        <div><h3 class="dt-h">Tasks completed by day</h3>
          <ul class="dt-bars" aria-label="Tasks completed by day">${m.byDay.map((d) => `<li><span class="dt-bar-day">${esc(d.day)}</span><span class="dt-bar-track"><span class="dt-bar" data-w="${Math.round((d.completed / max) * 100)}"></span></span><span class="dt-bar-n">${d.completed}</span></li>`).join('')}</ul></div>
        <div><h3 class="dt-h">Needs attention <span class="dt-muted">(${all.attention})</span></h3>
          ${open.length ? `<ul class="cw-att">${open.map((a) => `<li><button type="button" class="dt-link" data-go-action="${esc(a.id)}">${esc(a.title)} · ${esc(a.refs[0])}</button> <span class="dt-reg-st is-${STATUS_CLASS[a.status]}">${esc(a.status)}</span></li>`).join('')}</ul>` : '<p class="dt-intro">Nothing waiting right now.</p>'}</div>
      </div>
      <h3 class="dt-h">Management summary <span class="rl-ai">${esc(AI_LABEL)}</span></h3>
      <div class="dt-exec">${sm.map((x) => `<p>${esc(x)}</p>`).join('')}</div>
      <h3 class="dt-h">Requests (${list.length})</h3>
      <div class="dt-table-wrap"><table class="dt-table"><caption>Requests${channel !== 'All' ? ` by ${esc(channel.toLowerCase())}` : ''}${listStatus !== 'All' ? `, ${esc(listStatus.toLowerCase())}` : ''}</caption>
        <thead><tr><th scope="col">Request</th><th scope="col">Customer</th><th scope="col">Request type</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Status</th></tr></thead>
        <tbody>${list.map((r) => `<tr><td data-label="Request">${esc(r.ref)}</td><td data-label="Customer">${r.customer ? esc(r.customer) : '<em class="dt-blank">unknown</em>'}</td><td data-label="Request type">${esc(r.type)}</td><td data-label="Owner">${cell(r.owner)}</td><td data-label="Due">${esc(fmtDate(r.due))}</td><td data-label="Status">${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>`;
    panel('reports').querySelectorAll('.dt-bar[data-w]').forEach((b) => b.style.setProperty('width', `${b.dataset.w}%`));
  }

  // ---- Actions
  function taskControls(a) {
    const t = a.task; const done = t.status === 'Completed';
    if (done) return '<p class="dt-sorted">Completed.</p>';
    const reminded = getState().reminders.some((r) => r.task === t.id);
    return `<div class="cw-ctl">
      <label>Owner <select data-owner="${esc(t.id)}"><option value="">Nobody yet</option>${STAFF.map((p) => `<option${t.owner === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      <label>Status <select data-status="${esc(t.id)}"${t.owner ? '' : ' disabled'}>${['Not started', 'In progress', 'Completed'].map((x) => `<option${t.status === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <button type="button" class="btn btn-secondary btn-small" data-remind="${esc(t.id)}"${!t.owner || reminded ? ' disabled' : ''}>${reminded ? 'Reminder prepared' : 'Send a reminder'}</button>
      ${t.owner ? '' : '<span class="dt-muted">Assign someone first.</span>'}
    </div>`;
  }
  function paintActions() {
    const s = getState(); const list = actions(s);
    panel('actions').innerHTML = `
      <p class="dt-intro">Items the checks and the work tracker flagged. Each shows where it came from, a suggested next step and who could handle it. Who handles it is a suggestion, not a confirmed assignment. Reminders are simulated: nothing is sent.</p>
      <ul class="cw-actions">${list.map((a) => `<li class="cw-act" id="act-${esc(a.id)}">
        <div class="cw-act-h"><h3>${esc(a.title)}</h3><span class="dt-reg-st is-${STATUS_CLASS[a.status]}">${esc(a.status)}</span></div>
        <p>${esc(a.detail)}</p>
        <dl class="cw-act-dl"><div><dt>Source</dt><dd>${esc(a.source)} · ${a.refs.map((r) => `<button type="button" class="dt-link" data-see="${esc(a.id)}" data-ref="${esc(r)}">${esc(r)}</button>`).join(' ')}</dd></div>
          <div><dt>Suggested next step</dt><dd>${esc(a.next)}</dd></div><div><dt>Could be handled by</dt><dd>${esc(a.team)}</dd></div></dl>
        ${a.kind === 'data' ? `<div class="cw-ctl">${a.choices.map(([v, l]) => `<button type="button" class="btn ${a.decision === v ? 'btn-primary' : 'btn-secondary'} btn-small" data-decide="${esc(a.id)}" data-choice="${esc(v)}" aria-pressed="${a.decision === v}">${esc(l)}</button>`).join('')}</div>` : taskControls(a)}
      </li>`).join('')}</ul>
      <details class="dt-evidence-box"><summary>What happened (${s.log.length})</summary>
        ${s.log.length ? `<ol class="dt-log" reversed>${[...s.log].reverse().map((e) => `<li>${esc(e.text)}</li>`).join('')}</ol>` : '<p class="dt-intro">Nothing yet.</p>'}</details>`;
  }

  // ---- Workflows
  function cardHtml(r) {
    const t = r.t; const stage = stageOf(t); const reminded = getState().reminders.some((x) => x.task === t.id);
    let ctl = '';
    if (stage === 'Request received') ctl = `<button type="button" class="btn btn-secondary btn-small" data-wf="review" data-task="${esc(t.id)}">Mark reviewed</button>`;
    else if (stage === 'Reviewed') ctl = `<label class="cw-mini">Assign <select data-owner="${esc(t.id)}"><option value="">Choose…</option>${STAFF.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>`;
    else if (stage === 'Assigned') ctl = `<button type="button" class="btn btn-secondary btn-small" data-wf="start" data-task="${esc(t.id)}">Start</button>`;
    else if (stage === 'In progress') ctl = `<button type="button" class="btn btn-secondary btn-small" data-wf="done" data-task="${esc(t.id)}">Complete</button>`;
    const remindBtn = ['Assigned', 'In progress'].includes(stage) ? `<button type="button" class="dt-link cw-remind" data-remind="${esc(t.id)}"${reminded ? ' disabled' : ''}>${reminded ? 'Reminder prepared' : 'Remind'}</button>` : '';
    const late = t.status !== 'Completed' && t.due < '2026-11-06';
    return `<li class="cw-card${r.added ? ' is-new' : ''}${late ? ' is-late' : ''}"><p class="cw-card-h"><strong>${esc(r.ref)}</strong> ${r.customer ? esc(r.customer) : '<em class="dt-blank">customer unknown</em>'}</p>
      <p class="cw-card-m">${esc(r.type)}${t.owner ? ` · ${esc(t.owner)}` : ''}${late ? ' · <span class="cw-late">overdue</span>' : ''}</p>${ctl || remindBtn ? `<div class="cw-card-c">${ctl}${remindBtn}</div>` : ''}</li>`;
  }
  function paintWorkflows() {
    const s = getState(); const cols = board(s); const full = s.added.length >= 5;
    panel('workflows').innerHTML = `
      <form class="cw-form" data-form novalidate>
        <p class="dt-k">Submit a sample request <span>It goes into the Requests Register, creates a task, and shows up in Data, Reports and Actions.</span></p>
        <div class="cw-form-f">
          <label>Customer <select name="customer">${CUSTOMERS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label>Request <select name="type">${REQUEST_TYPES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
          <label>Channel <select name="channel">${CHANNELS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
          <button type="submit" class="btn btn-primary btn-small"${full ? ' disabled' : ''}>Submit request</button>
        </div>
        ${note ? `<p class="dt-sorted" role="status">${note}</p>` : ''}
      </form>
      <ol class="cw-board">${cols.map((c) => `<li class="cw-col${c.stage === 'Completed' ? ' cw-col-done' : ''}"><h3>${esc(c.stage)} <span class="dt-count">${c.items.length}</span></h3>
        <ul>${c.items.map(cardHtml).join('') || '<li class="cw-empty">Nothing here</li>'}</ul></li>`).join('')}</ol>
      <p class="dt-intro">Reminders are simulated: they're logged here, and nothing is sent.</p>`;
  }

  // ---- Shell
  function paintHead() {
    const n = openActions(getState()).length;
    root.querySelector('[data-count]').textContent = n ? `${n}` : '0';
    root.querySelectorAll('.dt-tab').forEach((b) => { const on = b.dataset.tab === view; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    VIEWS.forEach(([id]) => { panel(id).hidden = id !== view; });
  }
  function paint() {
    paintOverview(); paintHead();
    ({ data: paintData, reports: paintReports, actions: paintActions, workflows: paintWorkflows })[view]();
  }
  function show(to, opts = {}) {
    if (!VIEWS.some(([id]) => id === to)) return;
    if (to !== view && to !== 'data') focus = null;
    view = to; paint();
    if (opts.focusTab) root.querySelector(`#dt-tab-${to}`)?.focus();
  }

  root.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const before = getState().added.length;
    submitRequest(d);
    const a = getState().added[before];
    note = a ? `${esc(a.request.id)} added to the Requests Register and task ${esc(a.task.id)} created. It's now in <button type="button" class="dt-link" data-tab="data">Data</button>, <button type="button" class="dt-link" data-tab="reports">Reports</button> and <button type="button" class="dt-link" data-tab="actions">Actions</button>.` : 'The sample is limited to five new requests. Reset the demo to start again.';
    paintWorkflows(); say(note.replace(/<[^>]+>/g, ''));
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-filter="channel"]')) { channel = t.value; paintReports(); return; }
    if (t.matches('[data-filter="status"]')) { listStatus = t.value; paintReports(); return; }
    if (t.matches('[data-owner]') && t.value) { const id = t.dataset.owner; const who = t.value; if (view === 'workflows') note = esc(`${id} assigned to ${who}.`); assign(id, who); say(`${id} assigned to ${who}.`); root.querySelector(`[data-owner="${id}"]`)?.focus(); return; }
    if (t.matches('[data-status]')) { const id = t.dataset.status; setStatus(id, t.value); say(`${id} marked ${t.value.toLowerCase()}.`); root.querySelector(`[data-status="${id}"]`)?.focus(); }
  });
  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { show(tab.dataset.tab, { focusTab: tab.classList.contains('dt-tab') }); if (!tab.classList.contains('dt-tab')) panel(tab.dataset.tab).focus({ preventScroll: false }); return; }
    const sg = e.target.closest('[data-src]');
    if (sg) { src = sg.dataset.src; focus = null; paintData(); return; }
    const see = e.target.closest('[data-see]');
    if (see) {
      const a = actions(getState()).find((x) => x.id === see.dataset.see); const ref = see.dataset.ref;
      src = ref.startsWith('TX-') ? 'transactions' : ref.startsWith('T-') ? 'tasks' : (a.kind === 'data' ? 'requests' : 'combined');
      focus = { refs: a.refs.concat(ref), title: `${a.title}: ${ref}`, why: a.detail };
      view = 'data'; paint(); panel('data').querySelector('.dt-why')?.focus({ preventScroll: true });
      say(`Data: ${ref} highlighted in the ${src === 'combined' ? 'combined records' : SOURCES.find((x) => x.id === src).name}.`); return;
    }
    const ga = e.target.closest('[data-go-action]');
    if (ga) { show('actions'); const el = panel('actions').querySelector(`#act-${CSS.escape(ga.dataset.goAction)}`); el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); el?.querySelector('button, select')?.focus({ preventScroll: true }); return; }
    const dc = e.target.closest('[data-decide]');
    if (dc) { const id = dc.dataset.decide; decide(id, dc.dataset.choice); const a = actions(getState()).find((x) => x.id === id); say(`${a.title}: ${a.status}. Figures updated.`); panel('actions').querySelector(`[data-decide="${id}"][data-choice="${dc.dataset.choice}"]`)?.focus(); return; }
    const rm = e.target.closest('[data-remind]');
    if (rm) { const id = rm.dataset.remind; const ok = remind(id); const msg = ok ? `Reminder prepared for ${taskOwner(id)} about ${id}. Simulated: nothing was sent.` : 'No reminder needed.'; if (view === 'workflows') { note = esc(msg); paintWorkflows(); } say(msg); return; }
    const wf = e.target.closest('[data-wf]');
    if (wf) {
      const id = wf.dataset.task; const act = wf.dataset.wf;
      if (act === 'review') review(id); if (act === 'start') setStatus(id, 'In progress'); if (act === 'done') setStatus(id, 'Completed');
      note = esc(`${id}: ${stageOf(currentTask(id))}.`); paintWorkflows(); say(`${id} moved to ${stageOf(currentTask(id)).toLowerCase()}.`); return;
    }
    if (e.target.closest('[data-act="reset"]')) { reset(); view = 'data'; src = 'combined'; focus = null; channel = 'All'; listStatus = 'All'; note = ''; paint(); say('Demo reset to the original records.'); }
  });
  const currentTask = (id) => { const s = getState(); const all = [...TASKS, ...s.added.map((a) => a.task)].find((t) => t.id === id); return taskFor(s, all.request); };
  const taskOwner = (id) => currentTask(id)?.owner ?? '';
  root.querySelector('.dt-tabs').addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const i = VIEWS.findIndex(([id]) => id === view);
    if (e.key in keys) { e.preventDefault(); show(VIEWS[(i + keys[e.key] + VIEWS.length) % VIEWS.length][0], { focusTab: true }); }
    else if (e.key === 'Home') { e.preventDefault(); show(VIEWS[0][0], { focusTab: true }); }
    else if (e.key === 'End') { e.preventDefault(); show(VIEWS[VIEWS.length - 1][0], { focusTab: true }); }
  });

  subscribe(() => paint());
  paint();
  return { show: (to) => show(to), get tab() { return view; } };
}
