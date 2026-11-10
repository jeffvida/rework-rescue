// The live example (10 Nov redesign): one fictional week in three tabs.
//   Overview: what's happening? The weekly report, worked out from the records and the visitor's decisions.
//   Exceptions: what needs attention? The three findings. Selecting one shows the source rows behind it, the rule
//     that flagged it, why it matters, a suggested next action and the visitor's decision. The report flags it; the
//     visitor decides. After a decision: what changed, and how to stop it happening again.
//   Source records: where did the information come from? All 27 rows, with the flagged ones highlighted.
// Every number comes from ./engine.js. Nothing leaves the page: no real records, emails, payments or bookings.
// The section's static HTML (index.html) is what visitors see without JavaScript; this replaces it.

import { esc } from '../forms.js';
import { SALES, PAYMENTS, REQUESTS, SOURCES } from './data.js';
import { initialState, findings, decide, allDecided, report, stillOwed, sourceCounts, ISSUE_IDS } from './engine.js';

const TABS = [
  ['overview', 'Overview', 'What’s happening?'],
  ['exceptions', 'Exceptions', 'What needs attention?'],
  ['sources', 'Source records', 'Where did the information come from?'],
];
const FIELDS = {
  sales: [['id', 'Ref'], ['date', 'Date'], ['customer', 'Customer'], ['amount', 'Amount'], ['from', 'Entered from']],
  payments: [['id', 'Ref'], ['date', 'Date'], ['sale', 'Sale ref'], ['customer', 'Customer'], ['amount', 'Amount'], ['method', 'Method']],
  requests: [['id', 'Ref'], ['received', 'Received'], ['customer', 'Customer'], ['request', 'Request'], ['status', 'Status'], ['owner', 'Owner'], ['next', 'Next action']],
};
const ROWS = { sales: SALES, payments: PAYMENTS, requests: REQUESTS };
const NUMERIC = new Set(['amount']);
const n = (x) => x.toLocaleString('en-US');
const sourceName = (id) => SOURCES.find((x) => x.id === id).name;
const blank = '<em class="dt-blank">blank</em>';
const cell = (k, v) => (v === null || v === '' ? blank : NUMERIC.has(k) ? n(v) : esc(v));

// Which rows and cells each finding points at, so the tables can highlight them.
function marks(fs) {
  const rows = new Set(); const cells = new Set();
  for (const f of fs) {
    if (f.issue === 'duplicate') f.ids.forEach((id) => rows.add(id));
    if (f.issue === 'missing') { rows.add(f.ids[0]); cells.add(`${f.ids[0]}|amount`); if (f.payment) rows.add(f.payment.id); }
    if (f.issue === 'followUp') { rows.add(f.ids[0]); cells.add(`${f.ids[0]}|owner`); cells.add(`${f.ids[0]}|next`); }
  }
  return { rows, cells };
}

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let s = initialState();
  let tab = 'overview';
  let sel = ISSUE_IDS[0];
  const counts = sourceCounts();

  root.innerHTML = `
    <div class="dt">
      <div class="dt-head">
        <div class="dt-tabs" role="tablist" aria-label="Weekly business report">${TABS.map(([id, name, q]) => `
          <button type="button" role="tab" class="dt-tab" id="dt-tab-${id}" aria-controls="dt-p-${id}" data-tab="${id}">
            <span class="dt-tab-name">${esc(name)}${id === 'exceptions' ? ' <span class="dt-count" data-count></span>' : ''}</span>
            <span class="dt-tab-q">${esc(q)}</span></button>`).join('')}
        </div>
        <p class="dt-status"><span class="dt-tag" data-status></span></p>
      </div>
      ${TABS.map(([id]) => `<div class="dt-panel" role="tabpanel" id="dt-p-${id}" aria-labelledby="dt-tab-${id}" tabindex="0" hidden></div>`).join('')}
      <p class="sr-only" aria-live="polite"></p>
    </div>`;
  const live = root.querySelector('.dt > [aria-live]');
  const say = (m) => { live.textContent = ''; setTimeout(() => { live.textContent = m; }, 30); };
  const panel = (id) => root.querySelector(`#dt-p-${id}`);

  function table(source, rows, m, caption = sourceName(source), skip = []) {
    const f = FIELDS[source].filter(([k]) => !skip.includes(k));
    return `<div class="dt-table-wrap"><table class="dt-table"><caption>${esc(caption)}</caption>
      <thead><tr>${f.map(([k, l]) => `<th scope="col"${NUMERIC.has(k) ? ' class="dt-num"' : ''}>${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr${m.rows.has(r.id) ? ' class="is-flag"' : ''}>${f.map(([k, l]) => {
        const cls = [NUMERIC.has(k) ? 'dt-num' : '', m.cells.has(`${r.id}|${k}`) ? 'is-gap' : ''].filter(Boolean).join(' ');
        return `<td data-label="${esc(l)}"${cls ? ` class="${cls}"` : ''}>${cell(k, r[k])}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // ---- Overview
  function paintOverview() {
    const r = report(s); const fs = findings(s); const d = s.decisions;
    // What the sales total would be if the checks still open were confirmed.
    const potential = report({ decisions: { ...d, duplicate: d.duplicate || 'remove', missing: d.missing || 'usePayment' } }).salesTotal;
    let salesNote = `${r.salesCount} sales`;
    if (potential !== r.salesTotal && (!d.duplicate || !d.missing)) salesNote += ` · could be <strong>${n(potential)}</strong> once checked`;
    if (r.missingAmounts) salesNote += ` · ${r.missingAmounts} with no amount`;
    const owed = stillOwed(s);
    panel('overview').innerHTML = `
      <dl class="dt-tiles">
        <div class="dt-tile"><dt>Sales recorded</dt><dd>${n(r.salesTotal)}</dd><p>${salesNote}</p></div>
        <div class="dt-tile"><dt>Payments received</dt><dd>${n(r.paymentsTotal)}</dd><p>${r.paymentsCount} payments</p></div>
        <div class="dt-tile"><dt>Open requests</dt><dd>${r.openRequests}</dd><p>${r.noNextAction ? `${r.noNextAction} with no next action` : 'Each has a next action'}</p></div>
        <div class="dt-tile${r.toCheck ? ' is-check' : ''}"><dt>To check</dt><dd>${r.toCheck}</dd><p>${r.toCheck ? 'before you share it' : 'All decided'}</p></div>
      </dl>
      <h3 class="dt-h">Things to check</h3>
      <ul class="dt-todo">${fs.map((f) => `<li><button type="button" class="dt-todo-b${f.decision ? ' is-done' : ''}" data-open="${f.issue}">
        <span class="dt-todo-t">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' and '))}</span></span>
        <span class="dt-todo-s">${f.decision ? `Decided: ${esc(f.choices.find(([v]) => v === f.decision)[1])}` : 'Needs your decision'} <span aria-hidden="true">&rarr;</span></span></button></li>`).join('')}</ul>
      ${allDecided(s) ? `<p class="dt-owed">Still to be paid after your decisions: <strong>${n(owed.total)}</strong> (${owed.rows.map((x) => esc(x.id)).join(', ')}). Sales recorded minus payments received, sale by sale.</p>` : ''}
      ${Object.values(d).some(Boolean) ? '<p class="dt-reset-p"><button type="button" class="dt-link" data-act="reset">Run it again</button></p>' : ''}`;
  }

  // ---- Exceptions
  function paintExceptions() {
    const fs = findings(s); const f = fs.find((x) => x.issue === sel) || fs[0];
    const m = marks([f]);
    let recs = '';
    if (f.records.sales) recs += table('sales', f.records.sales, m);
    if (f.records.payments) recs += table('payments', f.records.payments, m, sourceName('payments'), ['customer', 'method']);
    if (f.records.requests) recs += table('requests', f.records.requests, m);
    const next = fs.find((x) => !x.decision && x.issue !== f.issue);
    panel('exceptions').innerHTML = `
      <ul class="dt-reg" aria-label="Exception register">
        <li class="dt-reg-head" aria-hidden="true"><span>Ref</span><span>Issue</span><span>Suggested next action</span><span>Status</span></li>
        ${fs.map((x) => `<li><button type="button" class="dt-reg-row${x.issue === f.issue ? ' is-on' : ''}" data-sel="${x.issue}" aria-pressed="${x.issue === f.issue}">
          <span class="dt-reg-ref">${esc(x.ids.join(' / '))}</span><span class="dt-reg-issue">${esc(x.title)}</span>
          <span class="dt-reg-act">${esc(x.action)}</span><span class="dt-reg-st${x.decision ? ' is-done' : ''}">${x.decision ? 'Decided' : 'Open'}</span></button></li>`).join('')}
      </ul>
      <div class="dt-detail" tabindex="-1">
        <h3 class="dt-h">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' and '))}</span></h3>
        <p class="dt-k">What was found</p>
        <div class="dt-recs">${recs}</div>
        <dl class="dt-facts">
          <div><dt>Why it was flagged</dt><dd>${esc(f.rule)}</dd></div>
          <div><dt>Why it matters</dt><dd>${esc(f.why)}</dd></div>
          <div><dt>Suggested next action</dt><dd>${esc(f.action)}</dd></div>
        </dl>
        <div class="dt-decide" role="group" aria-labelledby="dt-decide-k">
          <p class="dt-k" id="dt-decide-k">Your decision <span>The report flags it. You decide.</span></p>
          <div class="dt-choices">${f.choices.map(([v, l]) => `<button type="button" class="btn ${f.decision === v ? 'btn-primary' : 'btn-secondary'} dt-choice" data-choice="${v}" aria-pressed="${f.decision === v}">${esc(l)}</button>`).join('')}</div>
          ${f.decision ? `<p class="dt-sorted">${esc(f.consequence)}</p>
            <p class="dt-prevent"><strong>To stop it happening again:</strong> ${esc(f.prevent)}</p>` : ''}
        </div>
        ${f.decision ? `<p class="dt-next">${next
          ? `<button type="button" class="dt-link" data-sel="${next.issue}">Next: ${esc(next.title.toLowerCase())} &rarr;</button>`
          : '<button type="button" class="dt-link" data-tab-go="overview">All three decided. See the updated report &rarr;</button>'}</p>` : ''}
      </div>`;
  }

  // ---- Source records
  function paintSources() {
    const m = marks(findings(s));
    panel('sources').innerHTML = `
      <p class="dt-intro">${counts.total} records from ${counts.sources} sources. The highlighted rows are the ones the checks flagged; the outlined cells are the blanks.</p>
      ${SOURCES.map((src) => table(src.id, ROWS[src.id], m, `${src.name} (${ROWS[src.id].length} records)`)).join('')}
      <p class="dt-intro">S-1049 and S-1052 aren&rsquo;t paid yet. That&rsquo;s normal within the week, so they aren&rsquo;t flagged.</p>`;
  }

  function paintHead() {
    const r = report(s);
    const tag = root.querySelector('[data-status]');
    tag.textContent = r.status; tag.dataset.tag = r.status;
    const c = root.querySelector('[data-count]');
    c.textContent = r.toCheck ? `${r.toCheck} open` : 'done';
    root.querySelectorAll('.dt-tab').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    TABS.forEach(([id]) => { panel(id).hidden = id !== tab; });
  }

  function paint() {
    paintHead();
    if (tab === 'overview') paintOverview();
    if (tab === 'exceptions') paintExceptions();
    if (tab === 'sources') paintSources();
  }

  function show(to, issue, focus = false) {
    if (!TABS.some(([id]) => id === to)) return;
    tab = to;
    if (issue && ISSUE_IDS.includes(issue)) sel = issue;
    paint();
    if (focus === 'tab') root.querySelector(`#dt-tab-${to}`)?.focus();
    else if (focus) (panel(to).querySelector('.dt-detail') || panel(to)).focus({ preventScroll: true });
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { show(t.dataset.tab); return; }
    const go = e.target.closest('[data-tab-go]');
    if (go) { show(go.dataset.tabGo, null, 'tab'); return; }
    const open = e.target.closest('[data-open]');
    if (open) { show('exceptions', open.dataset.open, true); return; }
    const pick = e.target.closest('[data-sel]');
    if (pick) {
      sel = pick.dataset.sel; paint();
      const detail = panel('exceptions').querySelector('.dt-detail');
      detail?.focus({ preventScroll: true });
      if (detail && detail.getBoundingClientRect().top < 0) detail.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    const choice = e.target.closest('[data-choice]');
    if (choice) {
      const was = s.decisions[sel];
      s = decide(s, sel, was === choice.dataset.choice ? null : choice.dataset.choice); // clicking the chosen one again clears it
      paint();
      const f = findings(s).find((x) => x.issue === sel);
      const r = report(s);
      say(`${f.decision ? f.consequence : 'Decision cleared.'} Report status: ${r.status}. ${r.toCheck} to check.`);
      panel('exceptions').querySelector(`[data-choice="${choice.dataset.choice}"]`)?.focus();
      return;
    }
    if (e.target.closest('[data-act="reset"]')) {
      s = initialState(); sel = ISSUE_IDS[0]; paint();
      panel('overview').focus();
      say('Example reset. Report status: Review required. 3 to check.');
    }
  });
  root.querySelector('.dt-tabs').addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const i = TABS.findIndex(([id]) => id === tab);
    if (e.key in keys) { e.preventDefault(); show(TABS[(i + keys[e.key] + TABS.length) % TABS.length][0], null, 'tab'); }
    else if (e.key === 'Home') { e.preventDefault(); show(TABS[0][0], null, 'tab'); }
    else if (e.key === 'End') { e.preventDefault(); show(TABS[TABS.length - 1][0], null, 'tab'); }
  });

  paint();
  return { show: (to, issue) => show(to, issue), get tab() { return tab; } };
}
