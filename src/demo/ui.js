// The live demo (spec 10 Nov 2026, "management reporting"): one fictional week in three tabs.
//   Findings            the four findings: what was detected, why it matters, source reference, supporting data,
//                       possible explanation (AI-drafted, simulated), suggested investigation, reviewer decision, status.
//   Sources             the original Work Register, Invoice Tracker and Customer Requests. "View source" opens this tab
//                       with the record highlighted and the reason it was flagged. Viewing never changes a record.
//   Management Summary  executive summary, performance overview, key findings by classification, business
//                       implications, AI-assisted recommendations, the departmental action register, the checks, the
//                       decision log and the publication-readiness check with approval.
// It shares one state with the hero (./store.js). Nothing leaves the page.

import { esc } from '../forms.js';
import { WORK, INVOICES, REQUESTS, SOURCES, STAFF, ISSUES, CATEGORIES } from './data.js';
import {
  findings, metrics, summary, actionRegister, readiness, status, workingWork, qualityChecks, totalsChecks,
  ISSUE_IDS, STATUS_LABELS, CLOSED, AI_LABEL, PERIOD,
} from './engine.js';
import { getState, subscribe, setDecision, publish, reset } from './store.js';

const TABS = [
  ['findings', 'Findings', 'What needs attention?'],
  ['sources', 'Sources', 'Where did it come from?'],
  ['summary', 'Management Summary', 'What does the report say?'],
];
const COLS = {
  work: [['id', 'Ref'], ['request', 'Request'], ['customer', 'Customer'], ['address', 'Service address'], ['jobType', 'Job type'], ['scheduled', 'Scheduled'], ['due', 'Due'], ['status', 'Status'], ['completed', 'Completed'], ['owner', 'Owner'], ['next', 'Next action']],
  invoices: [['id', 'Invoice'], ['date', 'Date'], ['customer', 'Customer'], ['work', 'Work ref'], ['request', 'Request ref'], ['status', 'Status']],
  requests: [['id', 'Ref'], ['received', 'Received'], ['customer', 'Customer'], ['request', 'Request'], ['channel', 'Channel'], ['work', 'Work ref']],
};
const ROWS = { work: WORK, invoices: INVOICES, requests: REQUESTS };
const SRC_OF = (ref) => (ref.startsWith('W-') ? 'work' : ref.startsWith('INV-') ? 'invoices' : 'requests');
const blank = '<em class="dt-blank">blank</em>';
const STATUS_CLASS = { investigate: 'open', stale: 'open', action: 'unresolved', resolved: 'resolved', legitimate: 'resolved', disclosed: 'disclosed' };
const NEEDS_LABEL = { owner: 'Person', next: 'Next action', note: 'Note' };

export function mountDemo(root) {
  if (!root) return null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tab = 'findings';
  let sel = ISSUE_IDS[0];
  let viewing = null; // { ref, issue } when Sources was opened from a finding
  let confirming = false;

  root.innerHTML = `
    <div class="dt">
      <div class="dt-head">
        <div class="dt-tabs" role="tablist" aria-label="Weekly management report">${TABS.map(([id, name, q]) => `
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

  // ---- Tables (original values; reviewer changes shown beside them, never instead of them)
  function cellHtml(src, r, k, work) {
    const v = r[k];
    if (src === 'work' && work) {
      const ch = work.changes.find((c) => c.field === k || (k === 'owner' && c.field === 'owner'));
      if (k === 'id' && work.excluded) return `${esc(v)} <small class="dt-change">excluded by reviewer</small>`;
      if (k === 'due' && ch) return `${esc(v)} <small class="dt-change">reviewer: ${esc(ch.to)} (${esc(ch.evidence)})</small>`;
      if (k === 'owner' && ch) return `${blank} <small class="dt-change">reviewer: ${esc(ch.to)}</small>`;
      if (k === 'id' && work.invoice) return `${esc(v)} <small class="dt-change">linked to ${esc(work.invoice)} by reviewer</small>`;
    }
    return v === '' || v === null || v === undefined ? blank : esc(v);
  }
  function table(src, ids = null, mark = [], caption = null) {
    const rows = ids ? ROWS[src].filter((r) => ids.includes(r.id)) : ROWS[src];
    const ww = Object.fromEntries(workingWork(getState()).map((w) => [w.id, w]));
    const meta = SOURCES.find((x) => x.id === src);
    return `<div class="dt-table-wrap"><table class="dt-table"><caption>${esc(caption || `${meta.name} (${rows.length} records · ${meta.format.toLowerCase()})`)}</caption>
      <thead><tr>${COLS[src].map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr id="src-${esc(r.id)}"${mark.includes(r.id) ? ' class="is-flag"' : ''}>${COLS[src].map(([k, l]) => `<td data-label="${esc(l)}">${cellHtml(src, r, k, ww[r.id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // ---- Findings
  function choiceHtml(f, c) {
    const on = f.decision === c.value && f.status !== 'stale';
    const fields = c.needs.map((k) => {
      const id = `dt-${f.issue}-${c.value}-${k}`;
      const cur = on ? f[k] || '' : '';
      if (k === 'owner') return `<label for="${id}">${NEEDS_LABEL[k]} <select id="${id}" data-field="owner"><option value="">Choose…</option>${STAFF.map((p) => `<option${cur === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select></label>`;
      return `<label for="${id}">${NEEDS_LABEL[k]} <input id="${id}" type="text" maxlength="160" data-field="${k}" value="${esc(cur)}" placeholder="${k === 'note' ? (c.value === 'disclose' ? 'What the report should say' : 'Who handled it, and how') : 'e.g. Call the customer'}"></label>`;
    }).join('');
    return `<div class="dt-opt${on ? ' is-on' : ''}" data-opt="${c.value}">${fields ? `<div class="dt-opt-fields">${fields}</div>` : ''}
      <button type="button" class="btn ${on ? 'btn-primary' : 'btn-secondary'} dt-choice" data-choice="${c.value}" aria-pressed="${on}"><span>${esc(c.label)}</span><small>Status: ${esc(STATUS_LABELS[c.status])}</small></button></div>`;
  }
  function refButtons(f) {
    return Object.entries(f.refs).flatMap(([, ids]) => ids).map((ref) => `<button type="button" class="dt-link dt-src" data-view="${esc(ref)}">View source: ${esc(ref)}</button>`).join(' ');
  }
  function paintFindings() {
    const s = getState(); const fs = findings(s); const f = fs.find((x) => x.issue === sel) || fs[0];
    const next = fs.find((x) => !x.closed && x.issue !== f.issue);
    panel('findings').innerHTML = `
      <ul class="dt-reg" aria-label="Findings">
        <li class="dt-reg-head" aria-hidden="true"><span>Ref</span><span>Finding</span><span>Classification</span><span>Status</span></li>
        ${fs.map((x) => `<li><button type="button" class="dt-reg-row${x.issue === f.issue ? ' is-on' : ''}" data-sel="${x.issue}" aria-pressed="${x.issue === f.issue}">
          <span class="dt-reg-ref">${esc(x.ids.join(' / '))}</span><span class="dt-reg-issue">${esc(x.title)}</span>
          <span class="dt-reg-act">${esc(x.categoryLabel)}</span><span class="dt-reg-st is-${STATUS_CLASS[x.status]}">${esc(x.statusLabel)}</span></button></li>`).join('')}
      </ul>
      <div class="dt-detail" tabindex="-1">
        <h3 class="dt-h">${esc(f.title)} <span class="dt-ids">${esc(f.ids.join(' / '))}</span></h3>
        <p class="dt-meta"><span class="dt-cat is-${f.category}">${esc(f.categoryLabel)}</span> <span class="dt-gate${f.blocking ? ' is-blocking' : ''}">${f.blocking ? 'Blocks publication until reviewed' : 'Reported in the management report · does not block publication'}</span> <span class="dt-reg-st is-${STATUS_CLASS[f.status]}">${esc(f.statusLabel)}</span></p>
        <dl class="dt-facts">
          <div><dt>What was detected</dt><dd>${esc(f.detected)}</dd></div>
          <div><dt>Why it matters</dt><dd>${esc(f.matters)}</dd></div>
          <div><dt>Original source</dt><dd>${esc(f.source)} · ${refButtons(f)}</dd></div>
          <div><dt>Supporting data</dt><dd><ul>${f.supporting.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd></div>
          <div><dt>Possible explanation <span class="rl-ai">${esc(AI_LABEL)}</span></dt><dd>${esc(f.ai.replace(/^Possible explanation: /, ""))}</dd></div>
          <div><dt>Suggested investigation</dt><dd><ol>${f.investigate.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></dd></div>
        </dl>
        <div class="dt-recs">${table('work', f.refs.work, f.ids, 'Work Register: the records behind this finding')}</div>
        <div class="dt-decide" role="group" aria-labelledby="dt-decide-k">
          <p class="dt-k" id="dt-decide-k">Reviewer decision <span>A finding is only resolved by a decision, never by opening it.</span></p>
          <div class="dt-opts">${f.choices.map((c) => choiceHtml(f, c)).join('')}</div>
          ${f.consequence ? `<p class="dt-sorted">${esc(f.consequence)}</p>` : ''}
          <p class="dt-err" data-err hidden></p>
        </div>
        <p class="dt-next">${next
          ? `<button type="button" class="dt-link" data-sel="${next.issue}">Next: ${esc(next.title.toLowerCase())} &rarr;</button>`
          : '<button type="button" class="dt-link" data-tab-go="summary">Go to the Management Summary &rarr;</button>'}</p>
      </div>`;
  }

  // ---- Sources
  function paintSources() {
    const s = getState(); const fs = findings(s);
    const f = viewing ? fs.find((x) => x.issue === viewing.issue) : null;
    const marks = f ? Object.values(f.refs).flat() : [];
    const focusRef = viewing?.ref;
    const why = f ? `<div class="dt-why" role="note"><p><strong>Showing ${esc(focusRef)}</strong> (${esc(SOURCES.find((x) => x.id === SRC_OF(focusRef)).name)}). Flagged for <strong>${esc(f.title.toLowerCase())}</strong>: ${esc(f.detected)}</p>
        <p><button type="button" class="dt-link" data-back>&larr; Back to the finding</button></p></div>` : '';
    const checks = [...totalsChecks(s), ...qualityChecks()];
    panel('sources').innerHTML = `${why}
      <p class="dt-intro">The original records, exactly as received from three sources. Viewing a record never changes it: reviewer decisions are shown beside the original values.</p>
      ${['work', 'invoices', 'requests'].map((src) => table(src, null, marks)).join('')}
      <h3 class="dt-h">Checks run on these records</h3>
      <ul class="dt-todo">${checks.map((c) => `<li><span class="dt-todo-b is-${c.pass ? 'resolved' : 'unresolved'}"><span class="dt-todo-t">${esc(c.label)}${c.detail ? ` <small>${esc(c.detail)}</small>` : ''}</span><span class="dt-todo-s">${c.pass ? 'Passed' : 'Failed'}</span></span></li>`).join('')}</ul>`;
    if (focusRef) {
      const row = panel('sources').querySelector(`#src-${CSS.escape(focusRef)}`);
      row?.classList.add('is-focus');
      setTimeout(() => row?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }), 30);
    }
  }

  // ---- Management Summary
  const LOG = {
    decision: (e) => `${ISSUES[e.issue].title}: ${label(e.issue, e.to)}${extra(e)}`,
    changed: (e) => `${ISSUES[e.issue].title}: changed from “${label(e.issue, e.from)}” to “${label(e.issue, e.to)}”${extra(e)}`,
    cleared: (e) => `${ISSUES[e.issue].title}: decision cleared`,
    published: (e) => e.reason,
    'publish-withdrawn': (e) => `Publication withdrawn. ${e.reason}`,
  };
  const label = (issue, v) => ISSUES[issue].choices.find((c) => c[0] === v)?.[1] ?? '';
  const extra = (e) => [e.owner && ` · ${e.owner}`, e.next && ` · “${e.next}”`, e.note && ` · “${e.note}”`].filter(Boolean).join('');

  function publishBlock(s) {
    const r = readiness(s);
    if (s.published) return `<div class="dt-released"><p><strong>Published by you</strong> · simulated in your browser. Nothing was sent or changed.${r.disclosures.length ? ` Disclosed: ${r.disclosures.map((d) => `${esc(d.title)} (${esc(d.label)})`).join('; ')}.` : ''}</p></div>`;
    const head = s.changedSincePublish ? '<p><strong>Changed since publishing.</strong> A decision changed after the report was published. The figures and summary have been recalculated and need approving again.</p>' : '';
    if (!r.ready) return `<div class="dt-released is-hold">${head}<p><strong>Not ready to publish.</strong></p><ul>${r.blockers.map((b) => `<li>${esc(b.text)}</li>`).join('')}</ul>${r.blockers[0]?.issue ? `<p><button type="button" class="dt-link" data-sel-go="${r.blockers[0].issue}">Go to the finding &rarr;</button></p>` : ''}</div>`;
    if (!confirming) return `<div class="dt-released is-ready">${head}<p><strong>Ready for approval.</strong> No blocking checks remain.${r.disclosures.length ? ` ${r.disclosures.length} ${r.disclosures.length === 1 ? 'item' : 'items'} will be disclosed in the report.` : ''}</p><p><button type="button" class="btn btn-primary" data-act="publish">Publish report</button></p></div>`;
    return `<div class="dt-released is-ready">${head}<p><strong>Approve and publish?</strong> ${r.disclosures.length ? 'The published report will disclose:' : 'Nothing is left to disclose.'}</p>
      ${r.disclosures.length ? `<ul>${r.disclosures.map((d) => `<li>${esc(d.title)}: ${esc(d.label)}${d.note ? ` (“${esc(d.note)}”)` : ''}</li>`).join('')}</ul>` : ''}
      <p><button type="button" class="btn btn-primary" data-act="approve">Approve and publish</button> <button type="button" class="dt-link" data-act="cancel">Cancel</button></p></div>`;
  }

  function paintSummary() {
    const s = getState(); const m = metrics(s); const sm = summary(s); const fs = findings(s); const reg = actionRegister(s);
    const pub = !!s.published;
    const max = Math.max(...m.daily.map((d) => d.completed), 1);
    const groups = ['integrity', 'reconciliation', 'operational'].map((cat) => [cat, fs.filter((f) => f.category === cat)]);
    panel('summary').innerHTML = `
      ${publishBlock(s)}
      <p class="dt-doc-k">${pub ? 'Published management report' : 'Draft management report · for review'} · ${esc(PERIOD.label)} · fictional sample data</p>
      <h3 class="dt-h">A. Executive summary <span class="rl-ai">${esc(AI_LABEL)}</span></h3>
      <div class="dt-exec">${sm.executive.map((x) => `<p>${esc(x)}</p>`).join('')}</div>
      <h3 class="dt-h">B. Performance overview</h3>
      <dl class="dt-tiles dt-tiles-5">
        <div class="dt-tile"><dt>Source records received</dt><dd>${m.sourceRecords}</dd><p>${m.recordedCompleted} recorded completed · ${m.recordedOpen} open</p></div>
        <div class="dt-tile${m.unique === null ? ' is-check' : ''}"><dt>Unique work items</dt><dd>${m.unique === null ? '—' : m.unique}</dd><p>${m.validated ? 'Validated' : m.disclosed ? 'Unverified · disclosed' : 'Pending duplicate review'}</p></div>
        <div class="dt-tile"><dt>Completed work</dt><dd>${m.completed}</dd><p>${m.awaitingInvoice ? `${m.awaitingInvoice} without a matching invoice` : 'All matched to an invoice'}</p></div>
        <div class="dt-tile${m.open === null ? ' is-check' : ''}"><dt>Open work</dt><dd>${m.open === null ? '—' : m.open}</dd><p>${m.overdue ? `${m.overdue} overdue` : 'None overdue'}</p></div>
        <div class="dt-tile${m.completionRate === null ? ' is-check' : ''}"><dt>Completion rate</dt><dd>${m.completionRate ?? '—'}</dd><p>${m.completionRate ? `${m.completed} of ${m.unique} unique items` : 'Shown once unique items are validated'}</p></div>
      </dl>
      <ul class="dt-bars" aria-label="Work completed by day">${m.daily.map((d) => `<li><span class="dt-bar-day">${esc(d.day)}</span><span class="dt-bar-track"><span class="dt-bar" data-w="${Math.round((d.completed / max) * 100)}"></span></span><span class="dt-bar-n">${d.completed}</span></li>`).join('')}</ul>
      <h3 class="dt-h">C. Key findings</h3>
      <div class="dt-groups">${groups.map(([cat, list]) => `<div class="dt-group"><p class="dt-group-h"><span class="dt-cat is-${cat}">${esc(CATEGORIES[cat])}</span></p>${list.length ? `<ul>${list.map((f) => `<li><button type="button" class="dt-link" data-sel-go="${f.issue}">${esc(f.title)} · ${esc(f.ids.join(' / '))}</button> <span class="dt-reg-st is-${STATUS_CLASS[f.status]}">${esc(f.statusLabel)}</span></li>`).join('')}</ul>` : '<p>None.</p>'}</div>`).join('')}
        <div class="dt-group"><p class="dt-group-h"><span class="dt-cat is-insight">${esc(CATEGORIES.insight)}</span></p><p>${esc(sm.insights[0])}</p></div></div>
      <h3 class="dt-h">D. Business implications</h3>
      ${sm.implications.length ? `<ul class="dt-list">${sm.implications.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '<p class="dt-intro">No open implications after review.</p>'}
      <div class="dt-ai-split">
        ${sm.facts.length ? `<div><p class="dt-k">Confirmed facts</p><ul class="dt-list">${sm.facts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${sm.potential.length ? `<div><p class="dt-k">Potential discrepancies</p><ul class="dt-list">${sm.potential.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${sm.exceptions.length ? `<div><p class="dt-k">Operational exceptions</p><ul class="dt-list">${sm.exceptions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${sm.unverified.length ? `<div><p class="dt-k">Not yet verified</p><ul class="dt-list">${sm.unverified.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <h3 class="dt-h">E. Recommendations <span class="rl-ai">${esc(AI_LABEL)}</span></h3>
      <p class="dt-intro">Suggestions for management to decide on, not approved decisions.</p>
      <ul class="dt-list">${sm.recommendations.map((r) => `<li><strong>${esc(r.team)}:</strong> ${esc(r.text)}</li>`).join('')}</ul>
      <h3 class="dt-h">F. Departmental action register</h3>
      ${pub ? `<p class="dt-intro">Suggested teams are recommendations, not confirmed ownership. Nothing has been sent to anyone.</p>
      <div class="dt-table-wrap"><table class="dt-table dt-register"><caption>Departmental action register · published ${esc(PERIOD.label)}</caption>
        <thead><tr><th scope="col">Finding</th><th scope="col">Suggested team</th><th scope="col">Recommended action</th><th scope="col">Status</th></tr></thead>
        <tbody>${reg.map((r) => `<tr><td data-label="Finding">${esc(r.finding)}</td><td data-label="Suggested team">${esc(r.team)}</td><td data-label="Recommended action">${esc(r.action)}</td><td data-label="Status">${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="dt-intro dt-locked">The action register is issued with the published report. Publish the report to unlock it.</p>'}
      <h3 class="dt-h">Decision log</h3>
      ${s.log.length ? `<ol class="dt-log" reversed>${[...s.log].reverse().map((e) => `<li>${esc(LOG[e.type](e))}</li>`).join('')}</ol>` : '<p class="dt-intro">No decisions yet.</p>'}
      <p class="dt-reset-p">${s.log.length ? '<button type="button" class="dt-link" data-act="reset">Run it again</button>' : ''}</p>`;
    panel('summary').querySelectorAll('.dt-bar[data-w]').forEach((b) => b.style.setProperty('width', `${b.dataset.w}%`));
  }

  function paintHead() {
    const s = getState(); const st = status(s);
    const tag = root.querySelector('[data-status]');
    tag.textContent = st; tag.dataset.tag = st;
    const open = findings(s).filter((f) => !CLOSED.includes(f.status)).length;
    root.querySelector('[data-count]').textContent = open ? `${open} open` : 'reviewed';
    root.querySelectorAll('.dt-tab').forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
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
    if (to !== 'sources') viewing = null;
    if (issue && ISSUE_IDS.includes(issue)) sel = issue;
    paint();
    if (focus === 'tab') root.querySelector(`#dt-tab-${to}`)?.focus();
    else if (focus) (panel(to).querySelector('.dt-detail, .dt-why') || panel(to)).focus({ preventScroll: true });
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { show(t.dataset.tab); return; }
    const go = e.target.closest('[data-tab-go]');
    if (go) { show(go.dataset.tabGo, null, 'tab'); return; }
    const view = e.target.closest('[data-view]');
    if (view) { viewing = { ref: view.dataset.view, issue: sel }; tab = 'sources'; paint(); panel('sources').querySelector('.dt-why')?.setAttribute('tabindex', '-1'); panel('sources').querySelector('.dt-why')?.focus({ preventScroll: true }); say(`Sources: ${view.dataset.view} highlighted.`); return; }
    if (e.target.closest('[data-back]')) { const back = viewing?.issue; show('findings', back, true); return; }
    const sg = e.target.closest('[data-sel-go]');
    if (sg) { show('findings', sg.dataset.selGo, true); return; }
    const pick = e.target.closest('[data-sel]');
    if (pick) { sel = pick.dataset.sel; paint(); panel('findings').querySelector('.dt-detail')?.focus({ preventScroll: true }); return; }
    const choice = e.target.closest('[data-choice]');
    if (choice) {
      const opt = choice.closest('[data-opt]'); const c = choice.dataset.choice;
      const details = {}; opt.querySelectorAll('[data-field]').forEach((x) => { details[x.dataset.field] = x.value; });
      const was = getState().decisions[sel];
      const toggle = was && !was.invalidated && was.choice === c && !opt.querySelector('[data-field]');
      const f0 = findings(getState()).find((x) => x.issue === sel);
      const ok = setDecision(sel, toggle ? null : c, details);
      const err = panel('findings').querySelector('[data-err]');
      if (!ok) {
        const need = f0.choices.find((x) => x.value === c)?.needs ?? [];
        const msg = need.includes('owner') && !STAFF.includes(details.owner) ? `Choose a person: ${STAFF.join(', ')}.` : need.includes('next') && !String(details.next ?? '').trim() ? 'Add the next action.' : need.includes('note') ? (c === 'disclose' ? 'Add the disclosure note that will appear in the report.' : 'Add a short explanation: who handled it, and how.') : 'Nothing changed.';
        if (err) { err.hidden = false; err.textContent = msg; }
        say(msg); opt.querySelector('[data-field]')?.focus(); return;
      }
      const f = findings(getState()).find((x) => x.issue === sel); const m = metrics(getState());
      say(`${f.decision ? f.consequence : 'Decision cleared.'} Status: ${f.statusLabel}. Report: ${status(getState())}.${m.unique !== null ? ` ${m.unique} unique work items.` : ''}`);
      panel('findings').querySelector(`[data-choice="${c}"]`)?.focus();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'publish') { confirming = true; paintSummary(); panel('summary').querySelector('[data-act="approve"]')?.focus(); return; }
    if (act?.dataset.act === 'cancel') { confirming = false; paintSummary(); panel('summary').querySelector('[data-act="publish"]')?.focus(); return; }
    if (act?.dataset.act === 'approve') { confirming = false; if (publish()) { say('Report approved and published. Simulated: nothing was sent.'); panel('summary').focus(); } return; }
    if (act?.dataset.act === 'reset') { reset(); sel = ISSUE_IDS[0]; viewing = null; confirming = false; show('findings', sel, true); say('Demo reset. 4 findings need investigation.'); }
  });
  root.querySelector('.dt-tabs').addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const i = TABS.findIndex(([id]) => id === tab);
    if (e.key in keys) { e.preventDefault(); show(TABS[(i + keys[e.key] + TABS.length) % TABS.length][0], null, 'tab'); }
    else if (e.key === 'Home') { e.preventDefault(); show(TABS[0][0], null, 'tab'); }
    else if (e.key === 'End') { e.preventDefault(); show(TABS[TABS.length - 1][0], null, 'tab'); }
  });

  subscribe(() => { confirming = false; paint(); });
  paint();
  return { show: (to, issue) => show(to, issue), get tab() { return tab; } };
}
