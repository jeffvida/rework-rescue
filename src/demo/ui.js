// The live example: where the reviewer investigates. One fictional week in three tabs.
//   Findings: the four findings. Each shows the original records, the rule or comparison that flagged it, what to
//     check, and the reviewer's options: correct an actual error, confirm a legitimate variation, or leave it unresolved.
//     Every decision reruns the checks and recalculates the figures (see ./engine.js).
//   Sources: all rows, plus the 4-week sales history. The rows behind the selected finding are highlighted.
//   Summary: the report as it stands, the review checklist, the AI-drafted summary, the decision log, and the
//     reviewer's sign-off and release. Release stays locked until every finding is validated and signed off.
// It shares one state with the hero card (./store.js). Nothing leaves the page.

import { esc } from '../forms.js';
import { PAYMENTS, REQUESTS, SOURCES, HISTORY, RULES, STAFF, ISSUES } from './data.js';
import {
  findings, report, outputs, aiFindings, sourceCounts, daily, workingSales, autoChecks, releaseBlockers, canSignOff, canRelease,
  ISSUE_IDS, STATUS_LABELS, ACCEPTED, AI_LABEL, n,
} from './engine.js';
import { getState, subscribe, setDecision, signOff, release, reset } from './store.js';

const TABS = [
  ['findings', 'Findings', 'What needs attention?'],
  ['sources', 'Sources', 'Where did it come from?'],
  ['summary', 'Summary', 'What does the report say?'],
];
const FIELDS = {
  sales: [['id', 'Ref'], ['date', 'Date'], ['customer', 'Customer'], ['amount', 'Amount'], ['from', 'Entered from']],
  payments: [['id', 'Ref'], ['date', 'Date'], ['sale', 'Sale ref'], ['customer', 'Customer'], ['amount', 'Amount'], ['method', 'Method']],
  requests: [['id', 'Ref'], ['received', 'Received'], ['customer', 'Customer'], ['request', 'Request'], ['status', 'Status'], ['owner', 'Owner'], ['next', 'Next action']],
};
const ROWS = { payments: PAYMENTS, requests: REQUESTS };
const NUMERIC = new Set(['amount']);
const STATUS = STATUS_LABELS;
const OUTCOME = { resolved: 'Corrects an error', legitimate: 'Confirms it’s genuine', unresolved: 'Leaves it unresolved' };
const sourceName = (id) => SOURCES.find((x) => x.id === id).name;
const blank = '<em class="dt-blank">blank</em>';
const cell = (k, v) => (v === null || v === '' ? blank : NUMERIC.has(k) ? n(v) : esc(v));
// A sale as the reviewer left it: the original value is always shown next to a correction or an exclusion.
const saleCell = (r, k) => {
  if (k === 'amount' && r.correction) return `<s>${r.correction.from === null ? 'blank' : n(r.correction.from)}</s> ${n(r.amount)} <small>from ${esc(r.correction.evidence)}</small>`;
  if (k === 'id' && r.excluded) return `${esc(r.id)} <small>excluded by you</small>`;
  return cell(k, r[k]);
};
const sign = (x) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;

// Which rows and cells each finding points at, so the tables can highlight them.
const MARKS = {
  duplicate: { rows: ['S-1043', 'S-1051', 'P-303'], cells: ['S-1043|amount', 'S-1051|amount'] },
  missing: { rows: ['S-1047', 'P-307'], cells: ['S-1047|amount', 'P-307|amount'] },
  pattern: { rows: ['S-1043', 'S-1044', 'S-1045', 'S-1051'], cells: [] },
  followUp: { rows: ['R-205'], cells: ['R-205|owner', 'R-205|next'] },
};
let MARK_ROWS = new Set(); let MARK_CELLS = new Set();
const markFor = (issue) => { const m = MARKS[issue]; MARK_ROWS = new Set(m.rows); MARK_CELLS = new Set(m.cells); };

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tab = 'findings';
  let sel = ISSUE_IDS[0];
  const counts = sourceCounts();

  root.innerHTML = `
    <div class="dt">
      <div class="dt-head">
        <div class="dt-tabs" role="tablist" aria-label="Weekly business report">${TABS.map(([id, name, q]) => `
          <button type="button" role="tab" class="dt-tab" id="dt-tab-${id}" aria-controls="dt-p-${id}" data-tab="${id}">
            <span class="dt-tab-name">${esc(name)}${id === 'findings' ? ' <span class="dt-count" data-count></span>' : ''}</span>
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
        return `<td data-label="${esc(l)}"${cls ? ` class="${cls}"` : ''}>${source === 'sales' && 'original' in r ? saleCell(r, k) : cell(k, r[k])}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // This week's daily sales against the 4-week average for the same weekday (the pattern comparison).
  function dailyTable(rows, caption) {
    return `<div class="dt-table-wrap"><table class="dt-table dt-daily"><caption>${esc(caption)}</caption>
      <thead><tr><th scope="col">Day</th><th scope="col" class="dt-num">This week</th><th scope="col" class="dt-num">4-week average</th><th scope="col" class="dt-num">Change</th></tr></thead>
      <tbody>${rows.map((d) => `<tr${d.flagged ? ' class="is-flag"' : ''}><td data-label="Day">${esc(d.day)}</td><td data-label="This week" class="dt-num">${n(d.total)}</td><td data-label="4-week average" class="dt-num">${n(d.avg)}</td><td data-label="Change" class="dt-num">${sign(d.change)}${d.flagged ? ' <span class="dt-flagmark">outside ±' + Math.round(RULES.patternThreshold * 100) + '%</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }

  // A small bar chart for the published dashboard: this week against the 4-week average, per day.
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

  // ---- Summary: the report, the checklist, the AI-drafted summary, the log, sign-off and release
  const LOG_TEXT = {
    decision: (e) => `${ISSUES[e.issue].title}: ${choiceLabel(e.issue, e.to)}${e.owner ? ` (${e.owner})` : ''}${e.note ? `: “${e.note}”` : ''}`,
    changed: (e) => `${ISSUES[e.issue].title}: changed from “${choiceLabel(e.issue, e.from)}” to “${choiceLabel(e.issue, e.to)}”${e.owner ? ` (${e.owner})` : ''}`,
    cleared: (e) => `${ISSUES[e.issue].title}: decision cleared`,
    reopened: (e) => `Reopened. ${e.reason}`,
    signoff: () => 'Signed off by you.',
    'signoff-cleared': (e) => `Sign-off cleared. ${e.reason}`,
    released: (e) => e.reason,
    'release-revoked': (e) => `Release withdrawn. ${e.reason}`,
  };
  const choiceLabel = (issue, v) => ISSUES[issue].choices.find((c) => c[0] === v)?.[1] ?? '';

  function paintSummary() {
    const s = getState(); const r = report(s); const out = outputs(s); const fs = findings(s);
    const v = r.review; const blockers = releaseBlockers(s);
    let banner = '';
    if (out) banner = '<div class="dt-released"><p><strong>Released by you</strong> · simulated in your browser. Nothing was sent or changed.</p></div>';
    else if (s.changedSinceRelease) banner = '<div class="dt-released is-hold"><p><strong>Changed since release.</strong> A decision changed after the report was released, so it needs signing off and releasing again.</p></div>';
    const unknown = r.unknown.length ? ` · ${r.unknown.map((x) => `${esc(x.id)} amount unknown`).join(', ')}` : '';
    panel('summary').innerHTML = `${banner}
      <dl class="dt-tiles">
        <div class="dt-tile"><dt>${r.final ? 'Sales after review' : 'Sales recorded'}</dt><dd>${n(r.salesTotal)}</dd><p>${r.salesCount} sales${r.salesTotal !== r.recordedTotal ? ` · recorded ${n(r.recordedTotal)}` : ''}</p><p class="dt-could">${out ? 'Released' : r.final ? 'Validated · draft until released' : 'Draft · provisional'}${unknown}</p></div>
        <div class="dt-tile"><dt>Payments received</dt><dd>${n(r.paymentsTotal)}</dd><p>${r.paymentsCount} payments</p></div>
        <div class="dt-tile"><dt>Open requests</dt><dd>${r.openRequests}</dd><p>${r.noNextAction ? `${r.noNextAction} with no next action` : 'Each has a next action'}</p></div>
        <div class="dt-tile${v.left ? ' is-check' : ''}"><dt>Findings</dt><dd>${v.total}</dd><p>${v.accepted} validated${v.left ? ` · ${v.left} to go` : ''}</p></div>
      </dl>
      <h3 class="dt-h">Review checklist</h3>
      <ul class="dt-todo">${fs.map((f) => `<li><button type="button" class="dt-todo-b is-${f.accepted ? 'resolved' : f.status === 'open' ? 'open' : 'unresolved'}" data-open="${f.issue}">
        <span class="dt-todo-t">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' and '))}</span></span>
        <span class="dt-todo-s">${esc(STATUS[f.status])} <span aria-hidden="true">&rarr;</span></span></button></li>`).join('')}
        ${autoChecks().map((c) => `<li><span class="dt-todo-b is-${c.pass ? 'resolved' : 'unresolved'}"><span class="dt-todo-t">${esc(c.label)}</span><span class="dt-todo-s">${c.pass ? 'Automatic check passed' : 'Automatic check failed'}</span></span></li>`).join('')}</ul>
      <h3 class="dt-h">Summary <span class="rl-ai">${esc(AI_LABEL)}</span></h3>
      <ul class="dt-ai">${aiFindings(s).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      ${out ? `<h3 class="dt-h">Dashboard</h3>${dailyBars(out.dashboard.daily)}
        <p class="dt-owed">Still to be paid: <strong>${n(r.owed)}</strong> (${r.owedRows.map((x) => esc(x.id)).join(', ')}).</p>
        ${out.task ? `<p class="dt-task"><strong>Follow-up task created:</strong> ${esc(out.task.id)}: ${esc(out.task.text)}. Owner: ${esc(out.task.owner)}. <span>(simulated)</span></p>` : ''}` : `
      <div class="dt-decide" role="group" aria-labelledby="dt-sign-k">
        <p class="dt-k" id="dt-sign-k">Sign-off and release <span>Only you can release the report.</span></p>
        ${s.signOff ? '<p class="dt-sorted">Signed off by you.</p>' : `<label class="dt-sign"><input type="checkbox" data-act="signoff"${canSignOff(s) ? '' : ' disabled'}> I&rsquo;ve checked the findings and figures, and I approve this report and summary.</label>`}
        <p><button type="button" class="btn btn-primary" data-act="release"${canRelease(s) ? '' : ' disabled'}>Release report</button></p>
        ${blockers.length ? `<p class="dt-intro">${blockers.map(esc).join(' ')}</p>` : ''}
      </div>`}
      <h3 class="dt-h">Decision log</h3>
      ${s.log.length ? `<ol class="dt-log" reversed>${[...s.log].reverse().map((e) => `<li>${esc(LOG_TEXT[e.type](e))}</li>`).join('')}</ol>` : '<p class="dt-intro">No decisions yet.</p>'}
      <p class="dt-reset-p"><button type="button" class="dt-link" data-act="approval">Back to the report &uarr;</button>${s.log.length ? ' &middot; <button type="button" class="dt-link" data-act="reset">Run it again</button>' : ''}</p>`;
    sizeBars(panel('summary'));
  }

  // ---- Findings (the investigation)
  function recordsFor(f) {
    if (f.issue === 'pattern') return `${dailyTable(daily(getState()), 'Daily sales against the 4-week average')}${table('sales', f.records.sales, 'Tuesday’s sales (as counted now)')}`;
    let h = '';
    if (f.records.sales) h += table('sales', f.records.sales);
    if (f.records.payments?.length) h += table('payments', f.records.payments, sourceName('payments'), ['customer', 'method']);
    if (f.records.requests) h += table('requests', f.records.requests);
    return h + evidenceHtml(f.records.evidence);
  }
  const evidenceHtml = (ev = []) => (ev.length ? `<ul class="dt-evidence" aria-label="Original records">${ev.map((e) => `<li><strong>${esc(e.id)} · ${esc(e.type)}</strong> (${esc(e.ref)}, ${esc(e.from)}, ${esc(e.date)}): “${esc(e.text)}”</li>`).join('')}</ul>` : '');

  function choiceButtons(f) {
    if (f.locked) return `<p class="dt-intro">${esc(f.choices[0]?.reason || 'Decide the potential duplicate first.')}</p>`;
    return `<div class="dt-choices">${f.choices.map((c) => {
      const on = f.decision === c.value && f.status !== 'stale';
      const dis = c.enabled ? '' : ' disabled';
      if (f.issue === 'followUp' && c.value === 'assign') {
        return STAFF.map((who) => { const sel = on && f.owner === who; return `<button type="button" class="btn ${sel ? 'btn-primary' : 'btn-secondary'} dt-choice" data-choice="assign" data-owner="${esc(who)}" aria-pressed="${sel}"${dis}><span>Assign to ${esc(who)}</span><small>${OUTCOME[c.outcome]}</small></button>`; }).join('');
      }
      if (f.issue === 'followUp' && c.value === 'handled') {
        return `<span class="dt-handled"><label>Note <input type="text" maxlength="200" data-note value="${esc(on ? f.note : '')}" placeholder="Who handled it, and how"></label>
          <button type="button" class="btn ${on ? 'btn-primary' : 'btn-secondary'} dt-choice" data-choice="handled" aria-pressed="${on}"${dis}><span>${esc(c.label)}</span><small>${OUTCOME[c.outcome]}</small></button></span>`;
      }
      return `<button type="button" class="btn ${on ? 'btn-primary' : 'btn-secondary'} dt-choice" data-choice="${c.value}" aria-pressed="${on}"${dis}><span>${esc(c.label)}</span><small>${OUTCOME[c.outcome]}</small></button>`;
    }).join('')}</div>`;
  }

  function paintFindings() {
    const s = getState(); const fs = findings(s); const f = fs.find((x) => x.issue === sel) || fs[0];
    markFor(f.issue);
    const v = report(s).review;
    const next = fs.find((x) => !x.accepted && x.issue !== f.issue);
    const choices = `${choiceButtons(f)}
        ${f.consequence ? `<p class="dt-sorted">${esc(f.consequence)}</p>` : ''}${f.status === 'resolved' && f.decision !== 'verifyRecalc' ? `<p class="dt-prevent"><strong>To stop it happening again:</strong> ${esc(f.prevent)}</p>` : ''}`;
    panel('findings').innerHTML = `
      <ul class="dt-reg" aria-label="Findings">
        <li class="dt-reg-head" aria-hidden="true"><span>Ref</span><span>Finding</span><span>Check</span><span>Status</span></li>
        ${fs.map((x) => `<li><button type="button" class="dt-reg-row${x.issue === f.issue ? ' is-on' : ''}" data-sel="${x.issue}" aria-pressed="${x.issue === f.issue}">
          <span class="dt-reg-ref">${esc(x.ids.join(' / '))}</span><span class="dt-reg-issue">${esc(x.title)}</span>
          <span class="dt-reg-act">${esc(x.kind)}</span><span class="dt-reg-st is-${x.status}">${STATUS[x.status]}</span></button></li>`).join('')}
      </ul>
      <div class="dt-detail" tabindex="-1">
        <h3 class="dt-h">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' and '))}</span> <span class="dt-reg-st is-${f.status}">${STATUS[f.status]}</span></h3>
        <p class="dt-k">The original records <button type="button" class="dt-link dt-inspect" data-tab-go="sources">View in Sources &rarr;</button></p>
        <div class="dt-recs">${recordsFor(f)}</div>
        <dl class="dt-facts">
          <div><dt>What was detected</dt><dd>${esc(f.why)}</dd></div>
          <div><dt>Rule or comparison</dt><dd>${esc(f.rule)}</dd></div>
          <div><dt>Where</dt><dd>${esc(f.source)} · ${esc(f.location)}</dd></div>
          <div><dt>Potential impact</dt><dd>${esc(f.impact)}</dd></div>
          <div><dt>Possible cause <span class="rl-ai">${esc(AI_LABEL)}</span></dt><dd>${esc(f.ai)}</dd></div>
          <div><dt>What to check</dt><dd>${esc(f.steps.join(' '))}</dd></div>
        </dl>
        <div class="dt-decide" role="group" aria-labelledby="dt-decide-k">
          <p class="dt-k" id="dt-decide-k">Your decision <span>A flag isn&rsquo;t an error until you say so.</span></p>
          ${choices}
        </div>
        <p class="dt-next">${next
          ? `<button type="button" class="dt-link" data-sel="${next.issue}">Next: ${esc(next.title.toLowerCase())} &rarr;</button>`
          : `<button type="button" class="dt-link" data-tab-go="summary">${v.left ? `${v.left} still to validate.` : 'All findings validated.'} Go to sign-off &rarr;</button>`}</p>
      </div>`;
  }

  // ---- Sources
  function paintSources() {
    const f = findings(getState()).find((x) => x.issue === sel); markFor(sel);
    panel('sources').innerHTML = `
      <p class="dt-intro">${counts.total} records from ${counts.sources} sources, plus ${counts.historyWeeks} weeks of daily sales history for the pattern check. Highlighted: the records behind <strong>${esc(f.title.toLowerCase())}</strong> (${esc(f.ids.join(', '))}). <button type="button" class="dt-link" data-tab-go="findings">Back to the finding &rarr;</button></p>
      <div class="dt-pick" role="group" aria-label="Highlight the records for a finding">${findings(getState()).map((x) => `<button type="button" class="dt-pick-b" data-mark="${x.issue}" aria-pressed="${x.issue === sel}">${esc(x.title)}</button>`).join('')}</div>
      ${SOURCES.map((src) => { const rows = src.id === 'sales' ? workingSales(getState()) : ROWS[src.id]; return table(src.id, rows, `${src.name} (${rows.length} records)`); }).join('')}
      <div class="dt-table-wrap${sel === 'pattern' ? ' is-flag-wrap' : ''}"><table class="dt-table"><caption>Sales history: daily totals, previous 4 weeks (fictional demonstration data)</caption>
        <thead><tr><th scope="col">Day</th>${HISTORY.weeks.map((w) => `<th scope="col" class="dt-num">${esc(w)}</th>`).join('')}</tr></thead>
        <tbody>${Object.entries(HISTORY.days).map(([d, v]) => `<tr><td data-label="Day">${esc(d)}</td>${v.map((x, i) => `<td data-label="${esc(HISTORY.weeks[i])}" class="dt-num">${n(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="dt-intro">S-1049 and S-1052 aren&rsquo;t paid yet. That&rsquo;s normal within the week, so they aren&rsquo;t flagged.</p>`;
  }

  function paintHead() {
    const s = getState(); const r = report(s);
    const tag = root.querySelector('[data-status]');
    tag.textContent = r.status; tag.dataset.tag = r.status;
    const c = root.querySelector('[data-count]');
    c.textContent = r.review.left ? `${r.review.left} to validate` : 'validated';
    root.querySelectorAll('.dt-tab').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    TABS.forEach(([id]) => { panel(id).hidden = id !== tab; });
  }

  function paint() {
    paintHead();
    if (tab === 'findings') paintFindings();
    if (tab === 'sources') paintSources();
    if (tab === 'summary') paintSummary();
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
    const card = document.getElementById('hero-report');
    if (!card) return;
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => card.querySelector('.hr-actions button')?.focus({ preventScroll: true }), reduce ? 0 : 450);
  };

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { show(t.dataset.tab); return; }
    const go = e.target.closest('[data-tab-go]');
    if (go) { show(go.dataset.tabGo, null, 'tab'); return; }
    const mark = e.target.closest('[data-mark]');
    if (mark) { sel = mark.dataset.mark; paint(); panel('sources').querySelector(`[data-mark="${sel}"]`)?.focus(); return; }
    const open = e.target.closest('[data-open]');
    if (open) { show('findings', open.dataset.open, true); return; }
    const pick = e.target.closest('[data-sel]');
    if (pick) {
      sel = pick.dataset.sel; paint();
      const detail = panel('findings').querySelector('.dt-detail');
      detail?.focus({ preventScroll: true });
      if (detail && detail.getBoundingClientRect().top < 0) detail.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    const choice = e.target.closest('[data-choice]');
    if (choice) {
      const was = getState().decisions[sel]; const c = choice.dataset.choice;
      const details = { owner: choice.dataset.owner, note: panel('findings').querySelector('[data-note]')?.value };
      const same = was && !was.invalidated && was.choice === c && (c !== 'assign' || was.owner === details.owner) && c !== 'handled';
      const ok = setDecision(sel, same ? null : c, details); // clicking the chosen one again clears it
      const f = findings(getState()).find((x) => x.issue === sel); const r = report(getState());
      if (!ok) { say(f.choices.find((x) => x.value === c)?.reason || 'Add a note first: who handled it, and how.'); return; }
      say(`${f.decision ? f.consequence : 'Decision cleared.'} Figures recalculated. Sales ${n(r.salesTotal)}. ${r.review.left} still to validate.`);
      panel('findings').querySelector(`[data-choice="${c}"]${choice.dataset.owner ? `[data-owner="${choice.dataset.owner}"]` : ''}`)?.focus();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'signoff') { if (act.checked && signOff()) { say('Signed off. You can release the report now.'); panel('summary').querySelector('[data-act="release"]')?.focus(); } else act.checked = false; return; }
    if (act?.dataset.act === 'release') { if (release()) { say('Report released by you. Simulated: nothing was sent.'); panel('summary').focus(); } return; }
    if (act?.dataset.act === 'approval') { toApproval(); return; }
    if (act?.dataset.act === 'reset') { reset(); sel = ISSUE_IDS[0]; panel('summary').focus(); say('Example reset. Awaiting review. 4 findings open.'); }
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
