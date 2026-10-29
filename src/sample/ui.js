// "From three messy exports to a reliable weekly report": the interactive work sample.
// Four stages as tabs. Every figure is calculated by engine.js from the fictional data in data.js.
// Nothing is uploaded, sent or stored; decisions live only in this page.

import * as DATA from './data.js';
import { runSample, CHECKS, shortDate, money, parseDate, parseAmount } from './engine.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FILE_LABEL = { tracker: 'Job tracker', invoices: 'Invoices', customers: 'Customers' };
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAGES = [
  { id: 'files', n: 1, label: 'Source files' },
  { id: 'checks', n: 2, label: 'Checks' },
  { id: 'review', n: 3, label: 'Exceptions' },
  { id: 'report', n: 4, label: 'Weekly report' },
];

// ---------------------------------------------------------------- stage 1: the three files, as exported
// mark(row, key, i) returns 'flag' (sent for review), 'tidy' (tidied automatically) or ''.
function previewTable(cols, rows, mark) {
  const cell = (row, c, i) => {
    const m = mark(row, c.key, i);
    const v = row[c.key];
    const body = v === '' ? '<span class="ws-blank" aria-label="blank"></span>' : `<span class="ws-cell">${esc(v)}</span>`;
    const sr = m ? `<span class="ws-mark-sr sr-only"> (${m === 'flag' ? 'flagged for review' : 'tidied automatically'})</span>` : '';
    return `<td${m ? ` data-mark="${m}"` : ''}${c.phone === false ? ' class="ph-hide"' : ''}>${body}${sr}</td>`;
  };
  return `<div class="ws-scroll" tabindex="0" role="region" aria-label="Preview rows (scrolls sideways)"><table class="ws-raw">
    <thead><tr>${cols.map((c) => `<th scope="col"${c.phone === false ? ' class="ph-hide"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr>${cols.map((c) => cell(r, c, i)).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function filesPanel(r) {
  const T = DATA.TRACKER;
  const dmy = T.find((x) => /\//.test(x.due) && x.ref !== 'J-5553' && x.status !== 'Completed');
  const trackerRows = [T.find((x) => x.ref === 'J-5547'), ...T.filter((x) => x.ref === 'J-5548'), T.find((x) => x.ref === 'J-5553'), T.find((x) => x.ref === 'J-5560'), dmy].filter(Boolean);
  const I = DATA.INVOICES;
  const thousands = I.find((x) => /,/.test(x.amount) && x.ref > 'INV-3395');
  const invRows = [I.find((x) => x.ref === 'INV-3401'), I.find((x) => x.ref === 'INV-3402'), thousands, I.find((x) => x.ref === 'INV-3418'), I.find((x) => x.ref === 'INV-3419')].filter(Boolean);
  const C = DATA.CUSTOMERS;
  const spaced = C.find((x) => x.name !== x.name.trim());
  const custRows = [C.find((x) => x.id === 'C-1076'), C.find((x) => x.id === 'C-1077'), spaced, C.find((x) => x.id === 'C-1099'), C.find((x) => x.id === 'C-1103')].filter(Boolean);

  const firstEmail = new Map();
  C.forEach((c) => { if (c.email && !firstEmail.has(c.email)) firstEmail.set(c.email, c.id); });

  const markTracker = (row, key, i) => {
    if (row.ref === 'J-5548' && trackerRows.findIndex((x) => x.ref === 'J-5548') !== i) return key === 'ref' ? 'flag' : '';
    if (key === 'owner' && row.status !== 'Completed' && !row.owner.trim()) return 'flag';
    if (key === 'due') { const d = parseDate(row.due); if (!d) return 'flag'; if (d.converted) return 'tidy'; }
    return '';
  };
  const markInvoice = (row, key) => {
    if (key === 'job' && !row.job) return 'flag';
    if (key === 'amount') { const a = parseAmount(row.amount); if (!a) return 'flag'; if (a.converted) return 'tidy'; }
    return '';
  };
  const markCustomer = (row, key) => {
    if (key === 'email' && (!row.email || firstEmail.get(row.email) !== row.id)) return 'flag';
    if (key === 'name' && row.name !== row.name.trim()) return 'tidy';
    return '';
  };

  const card = (f, cols, rows, mark) => `
    <article class="ws-file">
      <header><p class="ws-file-name">${esc(f.file)}</p><p class="ws-file-meta">${esc(f.label)} · <strong>${f.rows}</strong> rows</p></header>
      ${previewTable(cols, rows, mark)}
      <p class="ws-file-more">Showing ${rows.length} of ${f.rows} rows</p>
    </article>`;
  return `
    <p class="ws-intro">Every Friday, three exports land in a shared folder. Someone combines them into the weekly report by hand. Here are the files as they arrive.</p>
    <div class="ws-files" id="ws-files">
      ${card(r.files[0], [{ key: 'ref', label: 'Job' }, { key: 'status', label: 'Status', phone: false }, { key: 'owner', label: 'Owner' }, { key: 'due', label: 'Due' }, { key: 'customer', label: 'Customer', phone: false }], trackerRows, markTracker)}
      ${card(r.files[1], [{ key: 'ref', label: 'Invoice' }, { key: 'job', label: 'Job' }, { key: 'date', label: 'Date', phone: false }, { key: 'amount', label: 'Amount' }], invRows, markInvoice)}
      ${card(r.files[2], [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email', phone: false }], custRows, markCustomer)}
    </div>
    <p class="ws-legend" id="ws-legend" hidden><span class="ws-key ws-key-flag" aria-hidden="true"></span>Flagged for a person to review <span class="ws-key ws-key-tidy" aria-hidden="true"></span>Tidied automatically in the working copy</p>
    <div class="ws-next">
      <p id="ws-files-prompt"><strong>${r.totals.rows} rows</strong> across three files. Can you spot the problems?</p>
      <div class="ws-actions">
        <button type="button" class="btn btn-secondary" data-reveal aria-pressed="false">Show the problems</button>
        <button type="button" class="btn btn-primary" data-run>Run the checks</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- stage 2: checks
const RUN_STEPS = ['Load the three files', 'Tidy formats in a working copy', 'Check every row against the rules', 'Match jobs, invoices and customers', 'List the exceptions'];

function checksPanel(r) {
  return `
    <ol class="ws-run" aria-label="Processing steps">${RUN_STEPS.map((s, i) => `<li data-step="${i}"><span class="ws-tick" aria-hidden="true"></span>${esc(s)}</li>`).join('')}</ol>
    <div class="ws-results">
      <div class="ws-scroll"><table class="sample-table ws-checks">
        <caption class="sr-only">Check results</caption>
        <thead><tr><th scope="col">Check</th><th scope="col">What it looks for</th><th scope="col" class="num">Flagged</th></tr></thead>
        <tbody>${r.checks.map((c) => `<tr><th scope="row">${esc(c.label)}</th><td>${esc(c.rule)}</td><td class="num">${c.flagged}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">To review</th><td class="num">${r.totals.review}</td></tr></tfoot>
      </table></div>
      <p class="ws-recon"><strong>${r.totals.rows} rows in · ${r.totals.passed} passed · ${r.totals.review} to review.</strong> Every row is accounted for.</p>
      <p class="ws-tidy">Tidied automatically in a working copy, and not counted as problems: ${r.tidy.dates} dates written day-first, ${r.tidy.amounts} amounts with thousands separators and ${r.tidy.names} customer names with stray spaces. The original files are not changed. <button type="button" class="link-button" data-go="files">See them highlighted in the files</button></p>
      <div class="ws-next"><p>${r.totals.review} rows need a person to decide what happens.</p><button type="button" class="btn btn-primary" data-go="review">Review the ${r.totals.review} exceptions</button></div>
    </div>`;
}

// ---------------------------------------------------------------- stage 3: exceptions, each with a decision
function reviewPanel(r) {
  const rule = Object.fromEntries(CHECKS.map((c) => [c.id, c]));
  const groups = CHECKS.map((c) => ({ c, items: r.exceptions.filter((e) => e.check === c.id) })).filter((g) => g.items.length);
  return `
    <div class="ws-review-head">
      <p class="ws-motto">The system flags. A person decides.</p>
      <div class="ws-progress"><p id="ws-count" aria-live="polite">0 of ${r.totals.review} decided</p><div class="ws-bar" aria-hidden="true"><span id="ws-bar-fill"></span></div></div>
    </div>
    <p class="ws-intro">Open an item to see why it was flagged, then choose what happens to it.</p>
    ${groups.map((g) => `
      <section class="ws-group" aria-labelledby="g-${g.c.id}">
        <h5 id="g-${g.c.id}">${esc(g.c.label)} <span class="ws-group-n">${g.items.length}</span></h5>
        <ul class="ws-xlist">${g.items.map((e) => `
          <li class="ws-x" data-x="${e.id}">
            <details>
              <summary><span class="ws-rec">${esc(e.record)}</span><span class="ws-issue">${esc(e.issue)}</span><span class="ws-src">${esc(FILE_LABEL[e.file])}</span><span class="ws-decided" id="dec-${e.id}"></span></summary>
              <dl class="ws-why">
                <div><dt>Why it was flagged</dt><dd>${esc(e.why)}</dd></div>
                <div><dt>Rule</dt><dd>${esc(rule[e.check].rule)}</dd></div>
                <div><dt>Suggested action</dt><dd>${esc(e.action)}</dd></div>
                <div><dt>Row</dt><dd class="ws-row">${esc(e.detail)}</dd></div>
              </dl>
              <fieldset class="ws-choice">
                <legend>Your decision for ${esc(e.record)}</legend>
                ${e.options.map((o, k) => `<label><input type="radio" name="d-${e.id}" id="d-${e.id}-${k}" value="${esc(o)}" data-decide="${e.id}"><span>${esc(o)}</span></label>`).join('')}
              </fieldset>
            </details>
          </li>`).join('')}
        </ul>
      </section>`).join('')}
    <p class="ws-note">Nothing here is changed automatically. A person decides each item, and corrections are made in the original systems. Decisions are for this preview only and aren't saved.</p>
    <div class="ws-next"><p>Decided or not, the report already knows which rows are on hold.</p><button type="button" class="btn btn-primary" data-go="report">See the weekly report</button></div>`;
}

// ---------------------------------------------------------------- stage 4: weekly report, headline first
function reportPanel(r) {
  const p = r.report;
  const tile = (n, label, note, warn) => `<li class="kpi${warn ? ' kpi-warn' : ''}"><span class="kpi-n">${n}</span><span class="kpi-l">${esc(label)}</span>${note ? `<span class="kpi-d">${esc(note)}</span>` : ''}</li>`;
  return `
    <article class="ws-report" aria-labelledby="ws-report-title">
      <header class="ws-report-head">
        <div><h4 id="ws-report-title">Weekly operations and billing report</h4><p class="snap-meta">Week ending ${esc(shortDate(DATA.REPORT_DATE))} 2026 · built from 3 exports · fictional amounts</p></div>
        <p class="ws-status" id="ws-status">Awaiting decisions</p>
      </header>
      <p class="ws-headline">${esc(p.summary)}</p>
      <section aria-labelledby="ws-bill"><h5 id="ws-bill">Billing</h5>
        <ul class="kpis ws-kpis ws-kpis-2">
          ${tile(money(p.atRisk), 'Not yet billed', `${p.notInvoiced.length} completed jobs not fully invoiced`, true)}
          ${tile(money(p.invoicedThisWeek), 'Invoiced this week', `${p.invoicesThisWeek} invoices · ${p.heldAmounts.join(', ')} held until its amount is fixed`)}
        </ul>
      </section>
      <section aria-labelledby="ws-work"><h5 id="ws-work">Work</h5>
        <ul class="kpis ws-kpis">
          ${tile(p.overdue, 'Overdue', `Plus ${p.dueToConfirm.length} due date to confirm`, true)}
          ${tile(p.noOwner, 'No owner', 'Open and unassigned', true)}
          ${tile(p.open, 'Open', '')}
          ${tile(p.completedThisWeek, 'Completed this week', '')}
          ${tile(p.jobs, 'Jobs in the tracker', 'Duplicate row not counted')}
        </ul>
      </section>
      ${openJobsSection(p.openJobs)}
      <section aria-labelledby="ws-follow"><h5 id="ws-follow">First follow-ups</h5>
        <ol class="priorities">${p.followUps.map((f) => `<li><strong>${esc(f.action)}</strong>${f.refs.every((ref) => f.action.includes(ref)) ? '' : `<span class="refs">${esc(f.refs.join(', '))}</span>`}<span class="why">${esc(f.why)}</span></li>`).join('')}</ol>
      </section>
      <p class="ws-checkline">Checks: ${r.totals.rows} rows · ${r.totals.passed} passed · <span id="ws-checkline-n">0 of ${r.totals.review}</span> exceptions decided. Suggestions only: nothing has been sent, assigned or changed.</p>
    </article>`;
}

// ---------------------------------------------------------------- report: open jobs
function openJobsSection(o) {
  const down = o.startOfWeek - o.now;
  const trend = down > 0 ? `Open jobs went down from ${o.startOfWeek} to ${o.now}.` : down < 0 ? `Open jobs went up from ${o.startOfWeek} to ${o.now}.` : `Open jobs stayed at ${o.now}.`;
  const row = (r, flag) => `<tr><th scope="row">${esc(r.ref)}</th><td class="oj-what">${esc(r.type)}<span class="ws-sub-cell">${esc(r.customer)}</span></td><td data-label="Owner">${r.owner ? esc(r.owner) : '<strong>Nobody</strong>'}</td><td class="num" data-label="Open for">${r.age} days</td><td class="nw" data-label="Due">${esc(r.due)}</td><td class="oj-why">${flag ? r.reasons.map((x) => `<span class="tag tag-warn">${esc(x)}</span>`).join(' ') : esc(r.status)}</td></tr>`;
  const head = (last) => `<thead><tr><th scope="col">Job</th><th scope="col">Type and customer</th><th scope="col">Owner</th><th scope="col" class="num">Open for</th><th scope="col">Due</th><th scope="col">${last}</th></tr></thead>`;
  return `
      <section aria-labelledby="ws-open"><h5 id="ws-open">Open jobs</h5>
        <p class="ws-flow ws-flow-total">${o.inTracker} jobs in the tracker: ${o.completedAll} completed, <strong>${o.now} still open</strong>.</p>
        <p class="ws-flow">This week: <strong>${o.opened} new jobs, ${o.completed} completed.</strong> ${trend}</p>
        <div class="ws-open-grid">
          <div>
            <p class="ws-mini-h">Age of the ${o.now} open jobs</p>
            <div class="ws-age-bar" aria-hidden="true">${o.ageing.map((b, i) => `<span class="ws-age-seg ws-age-${i}" data-grow="${b.count}"></span>`).join('')}</div>
            <ul class="ws-age-legend">${o.ageing.map((b, i) => `<li><span class="ws-age-key ws-age-${i}" aria-hidden="true"></span>${esc(b.label)}: <strong>${b.count}</strong></li>`).join('')}</ul>
          </div>
          <div>
            <p class="ws-mini-h">Where the ${o.now} open jobs are</p>
            <ul class="ws-status-list">${o.byStatus.map((x) => `<li><strong>${x.count}</strong> ${esc(x.status)}</li>`).join('')}</ul>
          </div>
        </div>
        <p class="ws-mini-h">Need attention (${o.attention.length} of ${o.now})</p>
        <div class="ws-scroll"><table class="sample-table ws-openjobs">
          <caption class="sr-only">Open jobs that need attention</caption>
          ${head('Why')}
          <tbody>${o.attention.map((r) => row(r, true)).join('')}</tbody>
        </table></div>
        <details class="ws-all-open">
          <summary>Show all ${o.now} open jobs</summary>
          <div class="ws-scroll"><table class="sample-table ws-openjobs">
            <caption class="sr-only">All open jobs, oldest first</caption>
            ${head('Status')}
            <tbody>${o.all.map((r) => row(r, false)).join('')}</tbody>
          </table></div>
        </details>
      </section>`;
}

// ---------------------------------------------------------------- mount
export function mountWorkSample(root) {
  const r = runSample(DATA);
  const decisions = new Map();
  let ran = false;

  root.innerHTML = `
    <div class="ws">
      <div class="ws-tabs" role="tablist" aria-label="Workflow stages">
        ${STAGES.map((s, i) => `<button type="button" role="tab" id="tab-${s.id}" aria-controls="panel-${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
          <span class="ws-n" aria-hidden="true">${s.n}</span><span class="ws-tab-text"><span class="ws-tab-label">${esc(s.label)}</span><span class="ws-tab-meta" id="meta-${s.id}"></span></span></button>`).join('')}
      </div>
      <section class="ws-panel" role="tabpanel" id="panel-files" aria-labelledby="tab-files">${filesPanel(r)}</section>
      <section class="ws-panel" role="tabpanel" id="panel-checks" aria-labelledby="tab-checks" hidden>${checksPanel(r)}</section>
      <section class="ws-panel" role="tabpanel" id="panel-review" aria-labelledby="tab-review" hidden>${reviewPanel(r)}</section>
      <section class="ws-panel" role="tabpanel" id="panel-report" aria-labelledby="tab-report" hidden>${reportPanel(r)}</section>
      <p class="sr-only" role="status" aria-live="polite" id="ws-live"></p>
    </div>`;

  const q = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  root.querySelectorAll('.ws-age-seg').forEach((seg) => { seg.style.flexGrow = seg.dataset.grow; if (seg.dataset.grow === '0') seg.hidden = true; });
  const meta = { files: `${r.totals.rows} rows`, checks: `${CHECKS.length} checks`, review: `${r.totals.review} to decide`, report: 'Awaiting decisions' };
  Object.entries(meta).forEach(([k, v]) => { q(`#meta-${k}`).textContent = v; });

  function setRevealed(on) {
    q('#ws-files').classList.toggle('is-revealed', on);
    q('#ws-legend').hidden = !on;
    const btn = q('[data-reveal]');
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Hide the highlights' : 'Show the problems';
    q('#ws-files-prompt').innerHTML = on
      ? `<strong>${r.totals.review} rows flagged</strong> across ${r.totals.rows}. These are some of them.`
      : `<strong>${r.totals.rows} rows</strong> across three files. Can you spot the problems?`;
  }

  function show(id, { focus = false } = {}) {
    tabs.forEach((t) => {
      const on = t.id === `tab-${id}`;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      q(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (id === 'checks' && !ran) finishRun();
    if (focus) q(`#tab-${id}`).focus();
    if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function finishRun() {
    ran = true;
    q('[data-run]').textContent = 'See the check results';
    root.querySelectorAll('.ws-run li').forEach((li) => li.classList.add('done'));
    q('.ws-results').classList.remove('is-waiting');
    setRevealed(true);
  }

  function playRun() {
    ran = true;
    q('[data-run]').textContent = 'See the check results';
    show('checks');
    if (reduceMotion()) { finishRun(); return; }
    const steps = [...root.querySelectorAll('.ws-run li')];
    steps.forEach((li) => li.classList.remove('done', 'active'));
    q('.ws-results').classList.add('is-waiting');
    steps.forEach((li, i) => {
      setTimeout(() => { li.classList.add('active'); }, i * 520);
      setTimeout(() => { li.classList.remove('active'); li.classList.add('done'); }, i * 520 + 440);
    });
    setTimeout(() => {
      q('.ws-results').classList.remove('is-waiting');
      setRevealed(true);
      q('#ws-live').textContent = `Checks finished: ${r.totals.passed} rows passed, ${r.totals.review} to review.`;
    }, steps.length * 520 + 100);
  }

  function updateDecisions() {
    const n = decisions.size;
    const all = r.totals.review;
    q('#ws-count').textContent = `${n} of ${all} decided`;
    q('#ws-bar-fill').style.width = `${(n / all) * 100}%`;
    q('#ws-checkline-n').textContent = `${n} of ${all}`;
    const status = n === all ? 'Ready for approval' : 'Awaiting decisions';
    q('#ws-status').textContent = status;
    q('#ws-status').classList.toggle('is-ready', n === all);
    q('#meta-report').textContent = status;
    q('#meta-review').textContent = n ? `${n} of ${all} decided` : `${all} to decide`;
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) { show(tab.id.replace('tab-', '')); return; }
    if (e.target.closest('[data-run]')) { if (ran) show('checks', { focus: true }); else playRun(); return; }
    const rev = e.target.closest('[data-reveal]');
    if (rev) { setRevealed(rev.getAttribute('aria-pressed') !== 'true'); return; }
    const go = e.target.closest('[data-go]');
    if (go) show(go.dataset.go, { focus: true });
  });
  root.addEventListener('change', (e) => {
    const radio = e.target.closest('[data-decide]');
    if (!radio) return;
    const id = radio.dataset.decide;
    decisions.set(id, radio.value);
    q(`[data-x="${id}"]`).classList.add('is-done');
    q(`#dec-${id}`).textContent = radio.value;
    updateDecisions();
  });
  q('.ws-tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = tabs.length - 1;
    if (j === null) return;
    e.preventDefault();
    show(tabs[j].id.replace('tab-', ''), { focus: true });
  });
  return { result: r };
}
