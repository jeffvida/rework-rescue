// Live example on the homepage (#samples), 11 Nov 2026: "fix the week, get the report".
// Capture is done (12 jobs in one list). My checks found three problems; the visitor clears them with one tap each
// and the Northstar Services weekly report next to them updates as they go:
//   R-112  no owner          → pick Ana, Mark or Sam              (engine: setOwner)
//   R-111  blank customer    → pick one of the existing customers (engine: setCustomer)
//   R-104  overdue payment   → not a data error: it stays on the report as the first action (nothing in the data changes)
// Every figure, action item, "fixed during checks" line and summary bullet is worked out from the records as they are
// now (src/tracker/engine.js, and the hero's actionItems/summaryBullets so the two reports read the same). The full
// 12-row tracker is still there, behind "See all 12 jobs", and is editable too.
// appHtml() is pure (no DOM): tools/render_tracker_static.mjs writes its non-interactive output into index.html as the
// no-JavaScript version (cards say what a person would do; no buttons). CSP: no inline style attributes.

import { RECORDS, OWNERS, STATUSES, PERIOD_LABEL, BUSINESS } from './data.js';
import { summarise, findings, shortDate, isCompleted, isUnassigned, missingFields, isOverdue, setOwner, setCustomer } from './engine.js';
import { actionItems, summaryBullets } from '../demo/hero.js';
import * as store from './store.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const refs = (t) => esc(t).replace(/R-\d+/g, (r) => `<span class="lx-ref">${r}</span>`);
const byRef = (rec, ref) => rec.find((r) => r.ref === ref);
// Records whose Customer / Area is blank in the sample get a field to fill it in (in the full tracker).
const FILLABLE = new Set(RECORDS.filter((r) => !String(r.customer).trim()).map((r) => r.ref));
const CUSTOMERS = ['Harbor Works', 'Cedar & Co.', 'Lakeside Trading'];

/** The three problems my checks found in the sample, in the order a visitor fixes them. */
export const CASES = Object.freeze([
  { ref: 'R-112', kind: 'unassigned', badge: 'Action required', tone: 'action',
    problem: 'Nobody owns this job, so nobody will do it.', ask: 'Who should take it?', options: OWNERS.filter((o) => o !== 'Unassigned'),
    still: 'A person assigns an owner (Ana, Mark or Sam).',
    isOpen: (r) => isUnassigned(r), done: (r) => `${r.owner} owns it now.` },
  { ref: 'R-111', kind: 'missing', badge: 'Flagged', tone: 'flag',
    problem: 'The customer is blank, so this job can’t be reported against anyone.', ask: 'Which customer is it for?', options: CUSTOMERS,
    still: 'A person adds the customer from the job notes.',
    isOpen: (r) => missingFields(r).length > 0, done: (r) => `Customer added: ${r.customer}.` },
  { ref: 'R-104', kind: 'overdue', badge: 'Real exception', tone: 'action',
    problem: 'Due 4 Nov and still waiting on payment. The data is right: this needs chasing.', ask: '', options: ['Keep it at the top of the report'],
    still: 'Nothing to fix in the data: it goes to the top of the report.',
    isOpen: (r) => isOverdue(r), done: (r) => (isOverdue(r) ? `At the top of the report for ${r.owner} to chase.` : 'No longer overdue.') },
]);

/** Which of the three are cleared. R-104 counts as handled once it's on the report (kept) or no longer overdue. */
export function progress(records, kept = false) {
  const st = CASES.map((c) => {
    const r = byRef(records, c.ref);
    const open = c.kind === 'overdue' ? c.isOpen(r) && !kept : c.isOpen(r);
    return { ...c, r, open };
  });
  return { cases: st, cleared: st.filter((c) => !c.open).length, total: st.length };
}

/** What changed compared with the sample as delivered (owners, customers, statuses), for "Fixed during checks". */
export function changes(records) {
  const out = [];
  for (const r of records) {
    const o = byRef(RECORDS, r.ref); if (!o) continue;
    if (o.owner !== r.owner) out.push(`${r.ref}: owner set to ${r.owner}`);
    if (o.customer !== r.customer && String(r.customer).trim()) out.push(`${r.ref}: customer set to ${String(r.customer).trim()}`);
    if (o.status !== r.status) out.push(`${r.ref}: status changed to ${r.status}`);
  }
  return out;
}

function kpisHtml(s) {
  const k = (key, n, label, cls, sub = '') => `<li class="lx-kpi ${cls}" data-kpi="${key}"><strong>${n}</strong><span>${label}${sub}</span></li>`;
  return k('total', s.total, 'Jobs this week', 'is-all') + k('completed', s.completed, 'Completed', 'is-done')
    + k('outstanding', s.outstanding, 'Still outstanding', 'is-open')
    + k('attention', s.attention, 'Need attention', s.attention ? 'is-att' : 'is-clear', s.outstanding ? ` <small>of the ${s.outstanding}</small>` : '');
}

function reportInner(records, p) {
  const s = summarise(records);
  const f = { ...s, business: BUSINESS, period: PERIOD_LABEL };
  const items = actionItems(f);
  const fixed = changes(records);
  const ready = p.cleared === p.total;
  return `<p class="lx-status ${ready ? 'is-ready' : 'is-draft'}" data-lx="status">${ready ? 'Ready to send' : `Draft · ${p.cleared} of ${p.total} checks cleared`}</p>`
    + `<ul class="lx-kpis" data-lx="kpis">${kpisHtml(s)}</ul>`
    + '<p class="lx-sub">Action items</p>'
    + `<ul class="lx-actions">${items.map((x) => `<li><span>${refs(x.label)}</span>${x.priority ? `<em class="${x.priority === 'High' ? 'is-high' : ''}">${x.priority}</em>` : ''}</li>`).join('')}</ul>`
    + (fixed.length ? `<p class="lx-sub">Fixed during checks</p><ul class="lx-fixed">${fixed.map((t) => `<li>${refs(t)}</li>`).join('')}</ul>` : '')
    + '<p class="lx-sub">Summary</p>'
    + `<ul class="lx-sum">${summaryBullets(f, items).map((t) => `<li>${refs(t)}</li>`).join('')}</ul>`;
}

function cardHtml(c, interactive, note = '') {
  const head = `<p class="lx-card-h"><span class="lx-badge is-${c.open ? c.tone : 'done'}">${c.open ? c.badge : (c.kind === 'overdue' && isOverdue(c.r) ? 'On the report' : 'Fixed')}</span>`
    + `<span class="lx-ref">${esc(c.ref)}</span> <b>${esc(c.r.task)}</b></p>`;
  if (!c.open) {
    return `<li class="lx-card is-cleared" data-case="${c.ref}">${head}<p class="lx-done" tabindex="-1">${esc(c.done(c.r))}</p>`
      + (note ? `<p class="lx-delta">${esc(note)}</p>` : '') + '</li>';
  }
  const body = interactive
    ? `${c.ask ? `<p class="lx-ask" id="lx-ask-${c.ref}">${esc(c.ask)}</p>` : ''}<div class="lx-opts" role="group" aria-label="${esc(c.ask || `Next step for ${c.ref}`)}">`
      + c.options.map((o) => `<button type="button" class="lx-opt${c.kind === 'overdue' ? ' is-wide' : ''}" data-fix="${c.ref}" data-val="${esc(o)}">${esc(o)}</button>`).join('') + '</div>'
    : `<p class="lx-still">${esc(c.still)}</p>`;
  return `<li class="lx-card is-${c.tone}" data-case="${c.ref}">${head}<p class="lx-prob">${esc(c.problem)}</p>${body}</li>`;
}

export function rowHtml(r, all, interactive) {
  const keys = new Set(findings(r, all).map((f) => f.key));
  const cls = ['wt-row', isCompleted(r) && 'is-done', keys.size && 'is-flag'].filter(Boolean).join(' ');
  const options = (list, value) => list.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('');
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

const workH = (p, interactive) => (!interactive ? 'My checks found 3 problems. Here’s what happens to each one.'
  : p.cleared === p.total ? 'All 3 handled. Your report is ready to send.' : 'My checks found 3 problems. Fix each one with a tap.');

const railHtml = (p) => {
  const ready = p.cleared === p.total;
  return `<li class="is-done"><b><span aria-hidden="true">1</span> Capture</b><span>12 jobs in one list</span></li>`
    + `<li class="${ready ? 'is-done' : 'is-now'}"${ready ? '' : ' aria-current="step"'}><b><span aria-hidden="true">2</span> Check</b><span>${p.cleared} of ${p.total} problems cleared</span></li>`
    + `<li class="${ready ? 'is-done' : ''}"${ready ? ' aria-current="step"' : ''}><b><span aria-hidden="true">3</span> Report</b><span>${ready ? 'Ready to send' : 'Updating as you go'}</span></li>`;
};

export function appHtml(records = RECORDS, { interactive = false, kept = false, notes = {} } = {}) {
  const p = progress(records, kept);
  return `<ol class="lx-rail" data-lx="rail" aria-label="Progress">${railHtml(p)}</ol>`
    + '<div class="lx-grid"><div class="lx-work">'
    + `<p class="lx-work-h" data-lx="workh">${workH(p, interactive)}</p>`
    + `<ul class="lx-cards" data-lx="cards">${p.cases.map((c) => cardHtml(c, interactive, notes[c.ref])).join('')}</ul>`
    + '</div>'
    + '<section class="lx-report" aria-labelledby="lx-rep-h"><div class="lx-rep-head"><div>'
    + `<h3 id="lx-rep-h">${esc(BUSINESS)} · Weekly report</h3><p>${PERIOD_LABEL} · Fictional sample</p></div></div>`
    + `<div data-lx="report">${reportInner(records, p)}</div>`
    + '<p class="lx-cap">The summary is written by simple rules from these records. In a real project, a person checks it before it&rsquo;s sent.</p>'
    + (interactive ? '<p class="sr-only" aria-live="polite" data-lx="live"></p><button type="button" class="btn btn-quiet btn-small lx-reset" data-wt-reset>Start over</button>' : '')
    + '</section></div>'
    + '<details class="lx-all"><summary>See all 12 jobs (the tracker behind this report)</summary>'
    + `<p class="lx-all-n">${interactive ? 'Change any owner or status and the report follows. Changes stay on this page and reset when you refresh.' : 'The interactive version needs JavaScript.'}</p>`
    + `<div class="wt-scroll"><table class="wt-table"><caption class="sr-only">Sample work tracker: ${records.length} jobs</caption>`
    + '<thead><tr><th scope="col">Ref</th><th scope="col">Request / Task</th><th scope="col">Customer / Area</th><th scope="col">Assigned To</th><th scope="col">Due Date</th><th scope="col">Status</th></tr></thead>'
    + `<tbody data-wt="rows">${records.map((r) => rowHtml(r, records, interactive)).join('')}</tbody></table></div></details>`;
}

export function mountTracker(host) {
  if (!host) return null;
  let kept = false; let refs0 = ''; let prevKpi = null; let lastFix = null; const notes = {};
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => host.querySelector(s);

  const paint = (records) => {
    const nowRefs = records.map((r) => r.ref).join();
    if (nowRefs !== refs0) { host.innerHTML = appHtml(records, { interactive: true, kept, notes }); refs0 = nowRefs; prevKpi = summarise(records); return; }
    const p = progress(records, kept);
    const s = summarise(records);
    for (const c of p.cases) if (c.open) delete notes[c.ref];
    q('[data-lx="rail"]').innerHTML = railHtml(p);
    q('[data-lx="workh"]').textContent = workH(p, true);
    q('[data-lx="cards"]').innerHTML = p.cases.map((c) => cardHtml(c, true, notes[c.ref])).join('');
    q('[data-lx="report"]').innerHTML = reportInner(records, p);
    // Mark the figures that moved (a short tint; a static outline under reduced motion).
    for (const k of ['total', 'completed', 'outstanding', 'attention']) {
      if (prevKpi && prevKpi[k] !== s[k]) {
        const el = q(`[data-kpi="${k}"]`); el.classList.add('is-changed');
        if (!reduce) setTimeout(() => el.classList.remove('is-changed'), 1400); else setTimeout(() => el.classList.remove('is-changed'), 2000);
      }
    }
    const live = q('[data-lx="live"]');
    if (live) live.textContent = p.cleared === p.total ? `Report ready to send. ${s.attention} ${s.attention === 1 ? 'job needs' : 'jobs need'} attention.` : `Report updated: ${s.attention} ${s.attention === 1 ? 'job needs' : 'jobs need'} attention. ${p.cleared} of ${p.total} problems cleared.`;
    prevKpi = s;
    // Rows are updated in place so a field being typed in keeps its focus.
    for (const r of records) {
      const tr = q(`tr[data-ref="${r.ref}"]`);
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
    if (lastFix) { q(`[data-case="${lastFix}"] .lx-done`)?.focus({ preventScroll: true }); lastFix = null; }
  };

  host.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fix]');
    if (b) {
      const ref = b.dataset.fix; const v = b.dataset.val;
      const now = store.getRecords();
      const before = summarise(now).attention;
      lastFix = ref;
      if (ref === 'R-104') { kept = true; notes[ref] = `Need attention stays at ${before}: it’s real work, not a data error.`; paint(now); return; }
      const next = ref === 'R-112' ? setOwner(now, ref, v) : setCustomer(now, ref, v);
      notes[ref] = `Need attention: ${before} → ${summarise(next).attention}`;
      if (ref === 'R-112') store.setOwner(ref, v); else store.setCustomer(ref, v);
      return;
    }
    if (e.target.closest('[data-wt-reset]')) {
      kept = false; for (const k of Object.keys(notes)) delete notes[k]; prevKpi = null;
      store.reset();
      q('[data-wt-reset]')?.focus();
    }
  });
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.owner) store.setOwner(t.dataset.owner, t.value);
    else if (t.dataset.status) store.setStatus(t.dataset.status, t.value);
  });
  host.addEventListener('input', (e) => { if (e.target.dataset.customer) store.setCustomer(e.target.dataset.customer, e.target.value); });
  host.classList.add('is-live');
  store.subscribe(paint);
  paint(store.getRecords());
  return store;
}
