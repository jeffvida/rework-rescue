// Work sample 2, "From a pile of monthly bills to a payment run you can trust".
// Same four stages as sample 1. Every figure is calculated by engine.js from the fictional data in data.js.
// All element ids use the "b-" prefix so this sample can share a page with sample 1.

import * as DATA from './data.js';
import { runBills, CHECKS, parseMoney } from './engine.js';
import { parseDate, money } from '../sample/engine.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FILE_LABEL = { contracts: 'Contract list', bills: 'Bills' };
const STAGES = [
  { id: 'files', n: 1, label: 'Source files' },
  { id: 'checks', n: 2, label: 'Checks' },
  { id: 'review', n: 3, label: 'Exceptions' },
  { id: 'report', n: 4, label: 'Payment summary' },
];

function previewTable(cols, rows, mark) {
  const cell = (row, c, i) => {
    const m = mark(row, c.key, i);
    const v = row[c.key];
    const body = v === '' || v === null ? '<span class="ws-blank" aria-label="blank"></span>' : `<span class="ws-cell">${esc(v)}</span>`;
    const sr = m ? `<span class="ws-mark-sr sr-only"> (${m === 'flag' ? 'flagged for review' : 'tidied automatically'})</span>` : '';
    return `<td${m ? ` data-mark="${m}"` : ''}${c.phone === false ? ' class="ph-hide"' : ''}>${body}${sr}</td>`;
  };
  return `<div class="ws-scroll" tabindex="0" role="region" aria-label="Preview rows (scrolls sideways)"><table class="ws-raw">
    <thead><tr>${cols.map((c) => `<th scope="col"${c.phone === false ? ' class="ph-hide"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr>${cols.map((c) => cell(r, c, i)).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function filesPanel(r) {
  const C = DATA.CONTRACTS; const B = DATA.BILLS; const H = DATA.HISTORY;
  const contract = (site, cat) => C.find((c) => c.site === site && c.category === cat);
  const contractRows = [contract('S03', 'Waste'), contract('S04', 'Internet'), contract('S07', 'Electricity'), contract('S09', 'Electricity'), contract('S11', 'Internet')];
  const flaggedInvoices = new Map(r.exceptions.filter((e) => e.file === 'bills').map((e) => [e.record, e.issue]));
  const dup = B.filter((b) => b.invoice === 'MP-88214');
  const others = B.filter((b) => flaggedInvoices.has(b.invoice) && b.invoice !== 'MP-88214');
  const tidyRow = B.find((b) => /^USD/.test(b.amount) && !flaggedInvoices.has(b.invoice));
  const billRows = [...dup, ...others, tidyRow].filter(Boolean);
  const s07 = contract('S07', 'Electricity').account;
  const histRows = H.filter((h) => h.account === s07);
  const missing = new Set(r.exceptions.filter((e) => e.check === 'complete').map((e) => e.record));

  const markContract = (row, key) => (key === 'account' && missing.has(`${row.site} ${row.category}`) ? 'flag' : '');
  const markBill = (row, key, i) => {
    const issue = flaggedInvoices.get(row.invoice);
    if (row.invoice === 'MP-88214') return i === 1 && key === 'invoice' ? 'flag' : '';
    if (issue === 'No contract' && key === 'account') return 'flag';
    if (issue === 'Site closed' && key === 'site_on_bill') return 'flag';
    if (issue === 'Price above contract' && key === 'amount') return 'flag';
    if (issue === 'Estimated reading' && key === 'read') return 'flag';
    if (issue === 'Usage spike' && key === 'usage') return 'flag';
    if (key === 'amount' && parseMoney(row.amount)?.converted) return 'tidy';
    if (key === 'issued' && parseDate(row.issued)?.converted) return 'tidy';
    if (key === 'supplier' && row.supplier === row.supplier.toUpperCase()) return 'tidy';
    return '';
  };
  const contractView = contractRows.map((c) => ({ ...c, price: c.price === '' ? 'usage' : c.price.toFixed(2) }));
  const card = (f, cols, rows, mark, full) => `
    <article class="ws-file${full ? ' ws-file-wide' : ''}">
      <header><p class="ws-file-name">${esc(f.file)}</p><p class="ws-file-meta">${esc(f.label)} · <strong>${f.rows}</strong> rows</p></header>
      ${previewTable(cols, rows, mark)}
      <p class="ws-file-more">Showing ${rows.length} of ${f.rows} rows</p>
    </article>`;
  return `
    <p class="ws-intro">A business with 12 sites gets about 50 bills a month: electricity, water, internet, waste collection and rent. Each month someone checks them by hand before the payment run. Here are the files as they arrive.</p>
    <div class="ws-files" id="b-files">
      ${card(r.files[1], [{ key: 'invoice', label: 'Invoice' }, { key: 'supplier', label: 'Supplier', phone: false }, { key: 'account', label: 'Account' }, { key: 'site_on_bill', label: 'Site', phone: false }, { key: 'issued', label: 'Issued', phone: false }, { key: 'usage', label: 'Usage', phone: false }, { key: 'read', label: 'Read', phone: false }, { key: 'amount', label: 'Amount' }], billRows, markBill, true)}
      ${card(r.files[0], [{ key: 'site', label: 'Site' }, { key: 'category', label: 'Type' }, { key: 'account', label: 'Account' }, { key: 'price', label: 'Price', phone: false }, { key: 'status', label: 'Status' }], contractView, markContract)}
      ${card(r.files[2], [{ key: 'account', label: 'Account' }, { key: 'month', label: 'Month' }, { key: 'usage', label: 'Usage' }, { key: 'unit', label: 'Unit', phone: false }], histRows, () => '')}
    </div>
    <p class="ws-legend" id="b-legend" hidden><span class="ws-key ws-key-flag" aria-hidden="true"></span>Flagged for a person to review <span class="ws-key ws-key-tidy" aria-hidden="true"></span>Tidied automatically in the working copy</p>
    <div class="ws-next">
      <p id="b-files-prompt"><strong>${r.report.received} bills</strong> against ${r.report.expected} active contracts. Can you spot the problems?</p>
      <div class="ws-actions">
        <button type="button" class="btn btn-secondary" data-reveal aria-pressed="false">Show the problems</button>
        <button type="button" class="btn btn-primary" data-run>Run the checks</button>
      </div>
    </div>`;
}

const RUN_STEPS = ['Load contracts, bills and history', 'Tidy formats in a working copy', 'Match every bill to a contract', 'Compare prices and usage', 'List the exceptions'];

function checksPanel(r) {
  const p = r.report;
  return `
    <ol class="ws-run" aria-label="Processing steps">${RUN_STEPS.map((s, i) => `<li data-step="${i}"><span class="ws-tick" aria-hidden="true"></span>${esc(s)}</li>`).join('')}</ol>
    <div class="ws-results">
      <div class="ws-scroll"><table class="sample-table ws-checks">
        <caption class="sr-only">Check results</caption>
        <thead><tr><th scope="col">Check</th><th scope="col">What it looks for</th><th scope="col" class="num">Flagged</th></tr></thead>
        <tbody>${r.checks.map((c) => `<tr><th scope="row">${esc(c.label)}</th><td>${esc(c.rule)}</td><td class="num">${c.flagged}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">To review</th><td class="num">${r.totals.review}</td></tr></tfoot>
      </table></div>
      <p class="ws-recon"><strong>${p.expected} bills expected · ${p.matched} received · ${p.missing} missing.</strong> ${p.received} bills in the file: ${p.passedBills} passed, ${p.heldBills} to review.</p>
      <p class="ws-tidy">Tidied automatically in a working copy, and not counted as problems: ${r.tidy.dates} dates written day-first, ${r.tidy.amounts} amounts written with "USD" or thousands separators and ${r.tidy.suppliers} supplier names in capitals. The original files are not changed. <button type="button" class="link-button" data-go="files">See them highlighted in the files</button></p>
      <div class="ws-next"><p>${r.totals.review} items need a person to decide what happens.</p><button type="button" class="btn btn-primary" data-go="review">Review the ${r.totals.review} exceptions</button></div>
    </div>`;
}

function reviewPanel(r) {
  const rule = Object.fromEntries(CHECKS.map((c) => [c.id, c]));
  const groups = CHECKS.map((c) => ({ c, items: r.exceptions.filter((e) => e.check === c.id) })).filter((g) => g.items.length);
  return `
    <div class="ws-review-head">
      <p class="ws-motto">The system flags. A person decides.</p>
      <div class="ws-progress"><p id="b-count" aria-live="polite">0 of ${r.totals.review} decided</p><div class="ws-bar" aria-hidden="true"><span id="b-bar-fill"></span></div></div>
    </div>
    <p class="ws-intro">Open an item to see why it was flagged, then choose what happens to it.</p>
    ${groups.map((g) => `
      <section class="ws-group" aria-labelledby="b-g-${g.c.id}">
        <h5 id="b-g-${g.c.id}">${esc(g.c.label)} <span class="ws-group-n">${g.items.length}</span></h5>
        <ul class="ws-xlist">${g.items.map((e) => `
          <li class="ws-x" data-x="${e.id}">
            <details>
              <summary><span class="ws-rec">${esc(e.record)}</span><span class="ws-issue">${esc(e.issue)}</span><span class="ws-src">${esc(e.siteLabel)}${e.at ? ` · ${esc(e.at)}` : ''}</span><span class="ws-decided" id="b-dec-${e.id}"></span></summary>
              <dl class="ws-why">
                <div><dt>Why it was flagged</dt><dd>${esc(e.why)}</dd></div>
                <div><dt>Rule</dt><dd>${esc(rule[e.check].rule)}</dd></div>
                <div><dt>Suggested action</dt><dd>${esc(e.action)}</dd></div>
                <div><dt>Row</dt><dd class="ws-row">${esc(FILE_LABEL[e.file])} · ${esc(e.detail)}</dd></div>
              </dl>
              <fieldset class="ws-choice">
                <legend>Your decision for ${esc(e.record)}</legend>
                ${e.options.map((o, k) => `<label><input type="radio" name="b-d-${e.id}" id="b-d-${e.id}-${k}" value="${esc(o)}" data-decide="${e.id}"><span>${esc(o)}</span></label>`).join('')}
              </fieldset>
            </details>
          </li>`).join('')}
        </ul>
      </section>`).join('')}
    <p class="ws-note">Nothing is paid, disputed or changed automatically. A person decides each item. Decisions are for this preview only and aren't saved.</p>
    <div class="ws-next"><p>The summary already separates bills that are ready from bills on hold.</p><button type="button" class="btn btn-primary" data-go="report">See the payment summary</button></div>`;
}

function reportPanel(r) {
  const p = r.report;
  const tile = (n, label, note, warn) => `<li class="kpi${warn ? ' kpi-warn' : ''}"><span class="kpi-n">${n}</span><span class="kpi-l">${esc(label)}</span>${note ? `<span class="kpi-d">${esc(note)}</span>` : ''}</li>`;
  return `
    <article class="ws-report" aria-labelledby="b-report-title">
      <header class="ws-report-head">
        <div><h4 id="b-report-title">Monthly bills check: ${esc(p.monthLabel)}</h4><p class="snap-meta">${p.openSites} open sites · ${p.expected} active contracts · fictional amounts</p></div>
        <p class="ws-status" id="b-status">Awaiting decisions</p>
      </header>
      <p class="ws-headline">${esc(p.summary)}</p>
      <section aria-labelledby="b-pay"><h5 id="b-pay">Payment run</h5>
        <ul class="kpis ws-kpis ws-kpis-3">
          ${tile(money(p.approve), 'Ready to approve', `${p.passedBills} bills that passed every check`)}
          ${tile(money(p.onHold), 'On hold', `${p.heldBills} bills · ${money(p.notOwed)} may not be owed`, true)}
          ${tile(`${p.matched} of ${p.expected}`, 'Expected bills received', `${p.missing} missing`, true)}
        </ul>
      </section>
      <section aria-labelledby="b-cat"><h5 id="b-cat">By bill type</h5>
        <div class="ws-scroll"><table class="sample-table ws-cats">
          <caption class="sr-only">Bills by type</caption>
          <thead><tr><th scope="col">Type</th><th scope="col" class="num">Bills received</th><th scope="col" class="num">Expected</th><th scope="col" class="num">Amount</th><th scope="col" class="num">To review</th></tr></thead>
          <tbody>${p.categories.map((c) => `<tr><th scope="row">${esc(c.category)}</th><td class="num">${c.bills}</td><td class="num">${c.expected}</td><td class="num">${money(c.amount)}</td><td class="num">${c.flagged || '<span class="muted">0</span>'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><th scope="row">Total</th><td class="num">${p.received}</td><td class="num">${p.expected}</td><td class="num">${money(p.total)}</td><td class="num">${p.heldBills}</td></tr></tfoot>
        </table></div>
        ${(() => { const el = p.categories.find((c) => c.category === 'Electricity'); return el.bills > el.expected ? `<p class="ws-tidy ws-table-note">Electricity shows ${el.bills} bills against ${el.expected} contracts: the duplicate and the closed-site bill are counted, and both are on hold.</p>` : ''; })()}
      </section>
      <section aria-labelledby="b-follow"><h5 id="b-follow">First follow-ups</h5>
        <ol class="priorities">${p.followUps.map((f) => `<li><strong>${esc(f.action)}</strong>${f.refs.length ? `<span class="refs">${esc(f.refs.join(', '))}</span>` : ''}<span class="why">${esc(f.why)}</span></li>`).join('')}</ol>
      </section>
      <p class="ws-checkline">Checks: ${r.totals.rows} rows · ${r.totals.passed} passed · <span id="b-checkline-n">0 of ${r.totals.review}</span> exceptions decided. Suggestions only: nothing has been paid, disputed or changed.</p>
    </article>`;
}

export function mountBillsSample(root) {
  const r = runBills(DATA);
  const decisions = new Map();
  let ran = false;

  root.innerHTML = `
    <div class="ws">
      <div class="ws-tabs" role="tablist" aria-label="Workflow stages">
        ${STAGES.map((s, i) => `<button type="button" role="tab" id="b-tab-${s.id}" aria-controls="b-panel-${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
          <span class="ws-n" aria-hidden="true">${s.n}</span><span class="ws-tab-text"><span class="ws-tab-label">${esc(s.label)}</span><span class="ws-tab-meta" id="b-meta-${s.id}"></span></span></button>`).join('')}
      </div>
      <section class="ws-panel" role="tabpanel" id="b-panel-files" aria-labelledby="b-tab-files">${filesPanel(r)}</section>
      <section class="ws-panel" role="tabpanel" id="b-panel-checks" aria-labelledby="b-tab-checks" hidden>${checksPanel(r)}</section>
      <section class="ws-panel" role="tabpanel" id="b-panel-review" aria-labelledby="b-tab-review" hidden>${reviewPanel(r)}</section>
      <section class="ws-panel" role="tabpanel" id="b-panel-report" aria-labelledby="b-tab-report" hidden>${reportPanel(r)}</section>
      <p class="sr-only" role="status" aria-live="polite" id="b-live"></p>
    </div>`;

  const q = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const meta = { files: `${r.totals.rows} rows`, checks: `${CHECKS.length} checks`, review: `${r.totals.review} to decide`, report: 'Awaiting decisions' };
  Object.entries(meta).forEach(([k, v]) => { q(`#b-meta-${k}`).textContent = v; });

  function setRevealed(on) {
    q('#b-files').classList.toggle('is-revealed', on);
    q('#b-legend').hidden = !on;
    const btn = q('[data-reveal]');
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Hide the highlights' : 'Show the problems';
    q('#b-files-prompt').innerHTML = on
      ? `<strong>${r.totals.review} items flagged</strong>, including ${r.report.missing} bills that never arrived. These rows show the rest.`
      : `<strong>${r.report.received} bills</strong> against ${r.report.expected} active contracts. Can you spot the problems?`;
  }
  const stageId = (t) => t.id.replace('b-tab-', '');
  function show(id, { focus = false } = {}) {
    tabs.forEach((t) => {
      const on = stageId(t) === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      q(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    if (id === 'checks' && !ran) finishRun();
    if (focus) q(`#b-tab-${id}`).focus();
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
      q('#b-live').textContent = `Checks finished: ${r.totals.review} items to review.`;
    }, steps.length * 520 + 100);
  }
  function updateDecisions() {
    const n = decisions.size; const all = r.totals.review;
    q('#b-count').textContent = `${n} of ${all} decided`;
    q('#b-bar-fill').style.width = `${(n / all) * 100}%`;
    q('#b-checkline-n').textContent = `${n} of ${all}`;
    const status = n === all ? 'Ready for approval' : 'Awaiting decisions';
    q('#b-status').textContent = status;
    q('#b-status').classList.toggle('is-ready', n === all);
    q('#b-meta-report').textContent = status;
    q('#b-meta-review').textContent = n ? `${n} of ${all} decided` : `${all} to decide`;
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) { show(stageId(tab)); return; }
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
    q(`#b-dec-${id}`).textContent = radio.value;
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
    show(stageId(tabs[j]), { focus: true });
  });
  return { result: r };
}
