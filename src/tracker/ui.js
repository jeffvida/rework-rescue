// Weekly Work & Follow-up Tracker on the homepage (#samples): weekly overview → work tracker → needs attention →
// weekly summary. Everything shown is worked out by src/tracker/engine.js from the records as they are now, so no
// finding or figure can go stale. The visitor changes Assigned To and Status (and can fill in R-111's blank
// Customer / Area, the one blank field in the sample); Reset sample restores src/tracker/data.js.
// appHtml() is pure (no DOM): tools/render_tracker_static.mjs writes its non-interactive output into index.html as
// the no-JavaScript version, and the tests check the two agree. CSP: no inline style attributes.

import { RECORDS, OWNERS, STATUSES, PERIOD_LABEL, AS_AT_LABEL, FLAG_SEP } from './data.js';
import { summarise, findings, shortDate, isCompleted } from './engine.js';
import * as store from './store.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Records whose Customer / Area is blank in the sample get a field to fill it in.
const FILLABLE = new Set(RECORDS.filter((r) => !String(r.customer).trim()).map((r) => r.ref));

export function figuresHtml(s) {
  const fig = (k, n, label, warn) => `<li class="wt-fig${warn && n ? ' is-warn' : ''}" data-fig="${k}"><strong>${n}</strong><span>${label}</span></li>`;
  return fig('total', s.total, 'Records received') + fig('completed', s.completed, 'Completed')
    + fig('outstanding', s.outstanding, 'Still outstanding') + fig('attention', s.attention, 'Need attention', true);
}

export function followUpsHtml(s) {
  if (!s.followUps.length) return '<li class="wt-fu wt-fu-none">Nothing needs attention right now.</li>';
  return s.followUps.map((f) => `<li class="wt-fu" data-fu="${esc(f.ref)}"><p class="wt-fu-t">${esc(f.title || 'Request with no description')}</p>`
    + `<p class="wt-fu-m">${f.labels.map((l) => `<span class="wt-chip">${esc(l)}</span>`).join(`<span class="wt-sep" aria-hidden="true">${FLAG_SEP.trim()}</span>`)}`
    + `<span class="wt-sep" aria-hidden="true">${FLAG_SEP.trim()}</span><span class="wt-fu-ref">${esc(f.ref)}</span></p>`
    + `<p class="wt-fu-n">${esc(f.note)}</p></li>`).join('');
}

const options = (list, value) => list.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('');

export function rowHtml(r, all, interactive) {
  const keys = new Set(findings(r, all).map((f) => f.key));
  const cls = ['wt-row', isCompleted(r) && 'is-done', keys.size && 'is-flag'].filter(Boolean).join(' ');
  const cust = interactive && FILLABLE.has(r.ref)
    ? `<input class="wt-in${keys.has('missing') ? ' is-missing' : ''}" type="text" value="${esc(r.customer)}" placeholder="Add customer / area" maxlength="40" autocomplete="off" aria-label="Customer / Area for ${esc(r.ref)}" data-customer="${esc(r.ref)}">`
    : r.customer ? esc(r.customer) : '<span class="wt-blank">Blank</span>';
  const own = interactive
    ? `<select class="wt-sel${keys.has('unassigned') ? ' is-missing' : ''}" aria-label="Assigned To for ${esc(r.ref)}" data-owner="${esc(r.ref)}">${options(OWNERS, r.owner)}</select>`
    : esc(r.owner);
  const st = interactive
    ? `<select class="wt-sel" aria-label="Status for ${esc(r.ref)}" data-status="${esc(r.ref)}">${options(STATUSES, r.status)}</select>`
    : esc(r.status);
  return `<tr class="${cls}" data-ref="${esc(r.ref)}"><td class="wt-ref">${esc(r.ref)}</td><td class="wt-task">${esc(r.task)}</td>`
    + `<td class="wt-cust">${cust}</td><td class="wt-own">${own}</td>`
    + `<td class="wt-due"><span>${esc(shortDate(r.due))}</span>${keys.has('overdue') ? ' <em class="wt-tag">Overdue</em>' : ''}</td>`
    + `<td class="wt-st">${st}</td></tr>`;
}

export function appHtml(records = RECORDS, { interactive = false } = {}) {
  const s = summarise(records);
  return `<div class="wt-block wt-over"><div class="wt-head"><p class="wt-label">Weekly overview</p>`
    + `<p class="wt-period"><span>${PERIOD_LABEL} &middot; Sample reporting period</span> <span>As at ${AS_AT_LABEL}</span></p></div>`
    + `<ul class="wt-figs" data-wt="figures">${figuresHtml(s)}</ul></div>`
    + `<div class="wt-block wt-track"><div class="wt-head"><div><p class="wt-label">Work tracker</p>`
    + `<p class="wt-hint">${interactive ? 'Try it: change an owner or status to see the overview update.' : 'The interactive version needs JavaScript.'}</p></div>`
    + (interactive ? '<button type="button" class="btn btn-quiet btn-small wt-reset" data-wt-reset>Reset sample</button>' : '') + '</div>'
    + `<div class="wt-scroll"><table class="wt-table"><caption class="sr-only">Sample work tracker: ${records.length} records</caption>`
    + '<thead><tr><th scope="col">Ref</th><th scope="col">Request / Task</th><th scope="col">Customer / Area</th><th scope="col">Assigned To</th><th scope="col">Due Date</th><th scope="col">Status</th></tr></thead>'
    + `<tbody data-wt="rows">${records.map((r) => rowHtml(r, records, interactive)).join('')}</tbody></table></div>`
    + (interactive ? '<p class="wt-temp">Changes in this preview are temporary and are not saved.</p>' : '') + '</div>'
    + '<div class="wt-split"><div class="wt-block wt-att"><p class="wt-label" id="wt-att-h">Needs attention</p>'
    + `<ul class="wt-fus" aria-labelledby="wt-att-h" data-wt="followups">${followUpsHtml(s)}</ul></div>`
    + `<div class="wt-block wt-sum"><p class="wt-label">Weekly summary</p><p class="wt-sum-t" data-wt="summary"${interactive ? ' aria-live="polite"' : ''}>${esc(s.text)}</p></div></div>`;
}

export function mountTracker(host) {
  if (!host) return null;
  let refs = '';
  const paint = (records) => {
    const s = summarise(records);
    const nowRefs = records.map((r) => r.ref).join();
    if (nowRefs !== refs) {   // first paint, or records added: build everything
      host.innerHTML = appHtml(records, { interactive: true });
      refs = nowRefs;
      return;
    }
    host.querySelector('[data-wt="figures"]').innerHTML = figuresHtml(s);
    host.querySelector('[data-wt="followups"]').innerHTML = followUpsHtml(s);
    const sum = host.querySelector('[data-wt="summary"]');
    if (sum.textContent !== s.text) sum.textContent = s.text;
    // Rows are updated in place so a field being typed in keeps its focus.
    for (const r of records) {
      const tr = host.querySelector(`tr[data-ref="${r.ref}"]`);
      const keys = new Set(findings(r, records).map((f) => f.key));
      tr.classList.toggle('is-done', isCompleted(r));
      tr.classList.toggle('is-flag', keys.size > 0);
      const own = tr.querySelector('[data-owner]'); if (own.value !== r.owner) own.value = r.owner;
      own.classList.toggle('is-missing', keys.has('unassigned'));
      const st = tr.querySelector('[data-status]'); if (st.value !== r.status) st.value = r.status;
      const inp = tr.querySelector('[data-customer]');
      if (inp) { if (inp.value !== r.customer) inp.value = r.customer; inp.classList.toggle('is-missing', keys.has('missing')); }
      const due = tr.querySelector('.wt-due');
      const tag = due.querySelector('.wt-tag');
      if (keys.has('overdue') && !tag) due.insertAdjacentHTML('beforeend', ' <em class="wt-tag">Overdue</em>');
      if (!keys.has('overdue') && tag) { tag.previousSibling?.nodeType === 3 && tag.previousSibling.remove(); tag.remove(); }
    }
  };
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.owner) store.setOwner(t.dataset.owner, t.value);
    else if (t.dataset.status) store.setStatus(t.dataset.status, t.value);
  });
  host.addEventListener('input', (e) => { if (e.target.dataset.customer) store.setCustomer(e.target.dataset.customer, e.target.value); });
  host.addEventListener('click', (e) => {
    if (!e.target.closest('[data-wt-reset]')) return;
    store.reset();
    host.querySelector('[data-wt-reset]')?.focus();
  });
  host.classList.add('is-live');
  store.subscribe(paint);
  paint(store.getRecords());
  return store;
}
