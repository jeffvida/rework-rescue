// The live example: where the reviewer investigates. One fictional week in three tabs.
//   Overview: the report as it stands, the AI findings (simulated) and, once released from the hero card, the
//     report and dashboard showing the effect of the review decisions.
//   Exceptions: the four findings. Each shows the original records, the rule or comparison that flagged it, what to
//     check, and the reviewer's options: correct an actual error, confirm a legitimate variation, or leave it unresolved.
//     Every decision reruns the checks and recalculates the figures (see ./engine.js).
//   Source records: all rows, plus the 4-week sales history, with flagged rows highlighted.
// It shares one state with the hero card (./store.js). Nothing leaves the page.

import { esc } from '../forms.js';
import { SALES, PAYMENTS, REQUESTS, SOURCES, HISTORY, RULES } from './data.js';
import { findings, report, outputs, aiFindings, review, sourceCounts, daily, ISSUE_IDS, n } from './engine.js';
import { getState, subscribe, setDecision, reset } from './store.js';

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
const STATUS = { open: 'Open', resolved: 'Resolved', legitimate: 'Confirmed legitimate', unresolved: 'Unresolved' };
const OUTCOME = { resolved: 'Corrects an error', legitimate: 'Confirms it’s genuine', unresolved: 'Leaves it unresolved' };
const sourceName = (id) => SOURCES.find((x) => x.id === id).name;
const blank = '<em class="dt-blank">blank</em>';
const cell = (k, v) => (v === null || v === '' ? blank : NUMERIC.has(k) ? n(v) : esc(v));
const sign = (x) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;

// Which rows and cells the first run flagged, so the tables can highlight them.
const MARK_ROWS = new Set(['S-1043', 'S-1051', 'S-1047', 'P-307', 'R-205']);
const MARK_CELLS = new Set(['S-1047|amount', 'R-205|owner', 'R-205|next']);

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  function table(source, rows, caption = sourceName(source), skip = []) {
    const f = FIELDS[source].filter(([k]) => !skip.includes(k));
    return `<div class="dt-table-wrap"><table class="dt-table"><caption>${esc(caption)}</caption>
      <thead><tr>${f.map(([k, l]) => `<th scope="col"${NUMERIC.has(k) ? ' class="dt-num"' : ''}>${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr${MARK_ROWS.has(r.id) ? ' class="is-flag"' : ''}>${f.map(([k, l]) => {
        const cls = [NUMERIC.has(k) ? 'dt-num' : '', MARK_CELLS.has(`${r.id}|${k}`) ? 'is-gap' : ''].filter(Boolean).join(' ');
        return `<td data-label="${esc(l)}"${cls ? ` class="${cls}"` : ''}>${cell(k, r[k])}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // This week's daily sales against the 4-week average for the same weekday (the pattern comparison).
  function dailyTable(rows, caption) {
    return `<div class="dt-table-wrap"><table class="dt-table dt-daily"><caption>${esc(caption)}</caption>
      <thead><tr><th scope="col">Day</th><th scope="col" class="dt-num">This week</th><th scope="col" class="dt-num">4-week average</th><th scope="col" class="dt-num">Change</th></tr></thead>
      <tbody>${rows.map((d) => `<tr${d.flagged ? ' class="is-flag"' : ''}><td data-label="Day">${esc(d.day)}</td><td data-label="This week" class="dt-num">${n(d.total)}</td><td data-label="4-week average" class="dt-num">${n(d.avg)}</td><td data-label="Change" class="dt-num">${sign(d.change)}${d.flagged ? ' <span class="dt-flagmark">outside ±' + Math.round(RULES.patternThreshold * 100) + '%</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // A small bar chart for the released dashboard: this week against the 4-week average, per day.
  function dailyBars(rows) {
    const max = Math.max(...rows.map((d) => Math.max(d.total, d.avg)));
    const w = (x) => `${Math.round((x / max) * 100)}`;
    return `<ul class="dt-bars" aria-label="Daily sales this week against the 4-week average">${rows.map((d) => `
      <li${d.flagged ? ' class="is-flag"' : ''}><span class="dt-bar-day">${esc(d.day)}</span>
        <span class="dt-bar-track"><span class="dt-bar" data-w="${w(d.total)}"></span><span class="dt-bar-avg" data-w="${w(d.avg)}"></span></span>
        <span class="dt-bar-n">${n(d.total)} <small>${sign(d.change)}</small></span></li>`).join('')}</ul>
      <p class="dt-bar-key"><span class="dt-key-this"></span> This week <span class="dt-key-avg"></span> 4-week average · Flag rule: ±${Math.round(RULES.patternThreshold * 100)}% (a demonstration setting)</p>`;
  }
  // CSP blocks inline style attributes, so bar widths are set through the CSSOM after painting.
  const sizeBars = (el) => el.querySelectorAll('[data-w]').forEach((b) => {
    if (b.classList.contains('dt-bar-avg')) b.style.setProperty('left', `${b.dataset.w}%`); else b.style.setProperty('width', `${b.dataset.w}%`);
  });

  // ---- Overview
  function paintOverview() {
    const s = getState(); const r = report(s); const out = outputs(s); const fs = findings(s);
    const v = r.review;
    let banner = '';
    if (out) {
      banner = `<div class="dt-released is-${out.kind}"><p><strong>${out.kind === 'final' ? 'Final report released' : 'Provisional report released'}</strong> · simulated, nothing was sent</p>
        ${out.unresolved.length ? `<p>Still open or unresolved, and marked as such in this report: ${out.unresolved.map((u) => `${esc(u.title)} (${esc(u.ids.join(', '))})`).join('; ')}.</p>` : ''}</div>`;
    } else if (s.release === 'hold') {
      banner = '<div class="dt-released is-hold"><p><strong>On hold.</strong> Nothing has been shared.</p></div>';
    }
    const unknown = r.unknown.length ? ` · ${r.unknown.map((x) => `${esc(x.id)} amount unknown`).join(', ')}` : '';
    panel('overview').innerHTML = `${banner}
      <dl class="dt-tiles">
        <div class="dt-tile"><dt>${r.final ? 'Sales after review' : 'Sales recorded'}</dt><dd>${n(r.salesTotal)}</dd><p>${r.salesCount} sales${r.salesTotal !== r.recordedTotal ? ` · recorded ${n(r.recordedTotal)}` : ''}</p><p class="dt-could">${r.final ? 'Checked' : 'Provisional'}${unknown}</p></div>
        <div class="dt-tile"><dt>Payments received</dt><dd>${n(r.paymentsTotal)}</dd><p>${r.paymentsCount} payments</p></div>
        <div class="dt-tile"><dt>Open requests</dt><dd>${r.openRequests}</dd><p>${r.noNextAction ? `${r.noNextAction} with no next action` : 'Each has a next action'}</p></div>
        <div class="dt-tile${v.open + v.unresolved ? ' is-check' : ''}"><dt>Findings</dt><dd>${v.total}</dd><p>${[['open', 'open'], ['resolved', 'resolved'], ['legitimate', 'legitimate'], ['unresolved', 'unresolved']].filter(([k]) => v[k]).map(([k, l]) => `${v[k]} ${l}`).join(' · ')}</p></div>
      </dl>
      ${out ? `<h3 class="dt-h">Dashboard</h3>${dailyBars(out.dashboard.daily)}
        <p class="dt-owed">Still to be paid: <strong>${n(r.owed)}</strong> (${r.owedRows.map((x) => esc(x.id)).join(', ')})${r.unknown.length ? `, plus ${r.unknown.map((x) => `${esc(x.id)} (amount unknown, ${n(x.received)} received)`).join(', ')}` : ''}.</p>
        ${out.task ? `<p class="dt-task"><strong>Follow-up task created:</strong> ${esc(out.task.id)}: ${esc(out.task.text)}. Owner: ${esc(out.task.owner)}. <span>(simulated)</span></p>` : ''}` : ''}
      <h3 class="dt-h">AI findings <span class="rl-ai">AI · simulated</span></h3>
      <ul class="dt-ai">${aiFindings(s).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <h3 class="dt-h">Findings</h3>
      <ul class="dt-todo">${fs.map((f) => `<li><button type="button" class="dt-todo-b is-${f.status}" data-open="${f.issue}">
        <span class="dt-todo-t">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' and '))}</span></span>
        <span class="dt-todo-s">${STATUS[f.status]} <span aria-hidden="true">&rarr;</span></span></button></li>`).join('')}</ul>
      ${!out ? '<p class="dt-intro">The report and dashboard unlock when it&rsquo;s released from the approval step on the card at the top of the page.</p>' : ''}
      <p class="dt-reset-p"><button type="button" class="dt-link" data-act="approval">Go to the approval step &uarr;</button>${Object.values(s.decisions).some(Boolean) || s.release ? ' &middot; <button type="button" class="dt-link" data-act="reset">Run it again</button>' : ''}</p>`;
    sizeBars(panel('overview'));
  }

  // ---- Exceptions (the investigation)
  function recordsFor(f) {
    if (f.issue === 'pattern') return `${dailyTable(daily(getState()), 'Daily sales against the 4-week average')}${table('sales', f.records.sales, 'Tuesday’s sales')}`;
    let h = '';
    if (f.records.sales) h += table('sales', f.records.sales);
    if (f.records.payments?.length) h += table('payments', f.records.payments, sourceName('payments'), ['customer', 'method']);
    if (f.records.requests) h += table('requests', f.records.requests);
    return h;
  }
  function paintExceptions() {
    const s = getState(); const fs = findings(s); const f = fs.find((x) => x.issue === sel) || fs[0];
    const v = review(s);
    const next = fs.find((x) => x.status === 'open' && x.issue !== f.issue);
    const choices = f.byRecheck
      ? `<p class="dt-sorted">${esc(f.consequence)}</p><p class="dt-intro">Nothing to decide: the recheck cleared it.</p>`
      : `<div class="dt-choices">${f.choices.map(([val, label, outcome]) => `<button type="button" class="btn ${f.decision === val ? 'btn-primary' : 'btn-secondary'} dt-choice" data-choice="${val}" aria-pressed="${f.decision === val}"><span>${esc(label)}</span><small>${OUTCOME[outcome]}</small></button>`).join('')}</div>
        ${f.decision ? `<p class="dt-sorted">${esc(f.consequence)}</p>${f.status === 'resolved' ? `<p class="dt-prevent"><strong>To stop it happening again:</strong> ${esc(f.prevent)}</p>` : ''}` : ''}`;
    panel('exceptions').innerHTML = `
      <ul class="dt-reg" aria-label="Findings">
        <li class="dt-reg-head" aria-hidden="true"><span>Ref</span><span>Finding</span><span>Check</span><span>Status</span></li>
        ${fs.map((x) => `<li><button type="button" class="dt-reg-row${x.issue === f.issue ? ' is-on' : ''}" data-sel="${x.issue}" aria-pressed="${x.issue === f.issue}">
          <span class="dt-reg-ref">${esc(x.ids.join(' / '))}</span><span class="dt-reg-issue">${esc(x.title)}</span>
          <span class="dt-reg-act">${esc(x.kind)}</span><span class="dt-reg-st is-${x.status}">${STATUS[x.status]}</span></button></li>`).join('')}
      </ul>
      <div class="dt-detail" tabindex="-1">
        <h3 class="dt-h">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' and '))}</span> <span class="dt-reg-st is-${f.status}">${STATUS[f.status]}</span></h3>
        <p class="dt-k">The original records</p>
        <div class="dt-recs">${recordsFor(f)}</div>
        <dl class="dt-facts">
          <div><dt>What was detected</dt><dd>${esc(f.why)}</dd></div>
          <div><dt>Rule or comparison</dt><dd>${esc(f.rule)}</dd></div>
          <div><dt>What to check</dt><dd>${esc(f.check)}</dd></div>
        </dl>
        <div class="dt-decide" role="group" aria-labelledby="dt-decide-k">
          <p class="dt-k" id="dt-decide-k">Your decision <span>A flag isn&rsquo;t an error until you say so.</span></p>
          ${choices}
        </div>
        <p class="dt-next">${next
          ? `<button type="button" class="dt-link" data-sel="${next.issue}">Next: ${esc(next.title.toLowerCase())} &rarr;</button>`
          : `<button type="button" class="dt-link" data-act="approval">${v.unresolved ? 'Review done, with items unresolved.' : 'All findings reviewed.'} Back to approval &uarr;</button>`}</p>
      </div>`;
  }

  // ---- Source records
  function paintSources() {
    panel('sources').innerHTML = `
      <p class="dt-intro">${counts.total} records from ${counts.sources} sources, plus ${counts.historyWeeks} weeks of daily sales history for the pattern check. Highlighted rows were flagged on the first run; outlined cells are blanks.</p>
      ${SOURCES.map((src) => table(src.id, ROWS[src.id], `${src.name} (${ROWS[src.id].length} records)`)).join('')}
      <div class="dt-table-wrap"><table class="dt-table"><caption>Sales history: daily totals, previous 4 weeks (demonstration data)</caption>
        <thead><tr><th scope="col">Day</th>${HISTORY.weeks.map((w) => `<th scope="col" class="dt-num">${esc(w)}</th>`).join('')}</tr></thead>
        <tbody>${Object.entries(HISTORY.days).map(([d, v]) => `<tr><td data-label="Day">${esc(d)}</td>${v.map((x, i) => `<td data-label="${esc(HISTORY.weeks[i])}" class="dt-num">${n(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="dt-intro">S-1049 and S-1052 aren&rsquo;t paid yet. That&rsquo;s normal within the week, so they aren&rsquo;t flagged.</p>`;
  }

  function paintHead() {
    const s = getState(); const r = report(s);
    const tag = root.querySelector('[data-status]');
    tag.textContent = r.status; tag.dataset.tag = r.status;
    const c = root.querySelector('[data-count]');
    c.textContent = r.review.open ? `${r.review.open} open` : 'reviewed';
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
  const toApproval = () => {
    const card = document.getElementById('hero-run');
    if (!card) return;
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => card.querySelector('.rl-approve button')?.focus({ preventScroll: true }), reduce ? 0 : 450);
  };

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { show(t.dataset.tab); return; }
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
      const was = getState().decisions[sel];
      setDecision(sel, was === choice.dataset.choice ? null : choice.dataset.choice); // clicking the chosen one again clears it
      const f = findings(getState()).find((x) => x.issue === sel); const r = report(getState());
      say(`${f.decision ? f.consequence : 'Decision cleared.'} Checks rerun. Sales ${n(r.salesTotal)}. ${r.review.open} open, ${r.review.unresolved} unresolved.`);
      panel('exceptions').querySelector(`[data-choice="${choice.dataset.choice}"]`)?.focus();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'approval') { toApproval(); return; }
    if (act?.dataset.act === 'reset') { reset(); sel = ISSUE_IDS[0]; panel('overview').focus(); say('Example reset. Awaiting review. 4 findings open.'); }
  });
  root.querySelector('.dt-tabs').addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const i = TABS.findIndex(([id]) => id === tab);
    if (e.key in keys) { e.preventDefault(); show(TABS[(i + keys[e.key] + TABS.length) % TABS.length][0], null, 'tab'); }
    else if (e.key === 'Home') { e.preventDefault(); show(TABS[0][0], null, 'tab'); }
    else if (e.key === 'End') { e.preventDefault(); show(TABS[TABS.length - 1][0], null, 'tab'); }
  });

  subscribe(() => paint());
  paint();
  return { show: (to, issue) => show(to, issue), get tab() { return tab; } };
}
