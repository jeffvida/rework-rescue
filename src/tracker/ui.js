// Live example on the homepage (#samples), 11 Nov 2026 (final brief): Capture → Move → See with Northstar Services.
//   Opening (about 4 s, once, when on screen): this week's scattered information (tracker, request form, email update,
//   follow-up note) with the three real problems (R-111, R-112, R-104), then the three stages and the weekly report.
//   Skip, Pause and Replay. Reduced motion: the finished view, no animation; the "explore next" cue is static.
//   Stages: Capture, Move, See, selectable in any order. A gentle pulse suggests the next unexplored one ("1 of 3 explored").
//   Each stage shows the real records involved and the checks for that stage; the weekly report is always on screen
//   (beside the stages on desktop, with a jump link on phones).
// Read-only by design: the sample is fixed (12 / 7 / 5 / 3). Nothing here edits records. The full 12-job tracker is
// shown read-only; the downloadable workbook is the hands-on version.
// Every status, figure and action item comes from the records through src/tracker/engine.js and the hero's
// dataChecks()/actionItems() (src/demo/hero.js), so the hero, this example, the tracker and the workbook agree.
// appHtml() is pure (no DOM): tools/render_tracker_static.mjs writes the non-interactive output into index.html as the
// no-JavaScript version (all three stages shown one after another). CSP: no inline style attributes.

import { RECORDS, PERIOD_LABEL, BUSINESS, FLAG } from './data.js';
import { summarise, findings, shortDate, day, isCompleted, inReport, isEmptyRow } from './engine.js';
import { dataChecks, heroFigures, STATE } from '../demo/hero.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const refs = (t) => esc(t).replace(/R-\d+/g, (r) => `<span class="lx-ref">${r}</span>`);
const byRef = (rec, ref) => rec.find((r) => r.ref === ref);
const ICON = { pass: '&#10003;', flag: '!', action: '&#9679;' };
const pill = (state, text = STATE[state]) => `<span class="lx-pill is-${state}"><span aria-hidden="true">${ICON[state] || ''}</span> ${esc(text)}</span>`;

export const STAGES = Object.freeze([
  { id: 'capture', n: '01', name: 'Capture', short: 'Get the information right',
    h: 'First, let’s get the information right.',
    benefit: 'Missing information and duplicate records are identified before they create problems further down the process.' },
  { id: 'move', n: '02', name: 'Move', short: 'Make sure work moves forward',
    h: 'Next, let’s make sure the work doesn’t get forgotten.',
    benefit: 'Clear responsibilities and visible follow-ups help prevent work from slipping through the cracks.' },
  { id: 'see', n: '03', name: 'See', short: 'Understand where the business stands',
    h: 'Finally, know where your business stands.',
    benefit: 'Reliable information makes it easier to see what has been completed, what remains outstanding and what needs attention.' },
]);

// Plain-language names for the checks shown in this example (the hero keeps its shorter labels).
const LABEL = {};
const DETAIL = {};

/** What needs attention: one line per flagged record, in the report's order (from the hero's actionItems). */
export function attentionItems(rec = RECORDS, { all = false, period } = {}) {
  const f = heroFigures(rec, period);
  const text = { overdue: ['Follow up on overdue work', 'Overdue'], unassigned: ['Assign an owner', 'No owner'], duplicate: ['Check the possible duplicate', 'Possible duplicate'] };
  const items = f.followUps.map((u, i) => {
    const key = ['overdue', 'unassigned', 'missing', 'duplicate'].find((k) => u.keys.includes(k));
    const [what, tag] = key === 'missing'
      ? (u.labels.includes(FLAG.missingCustomer) ? ['Complete the missing customer information', 'Missing customer'] : ['Complete the missing information', 'Missing information'])
      : text[key];
    const high = u.keys.includes('overdue') || u.keys.includes('unassigned');
    return { ref: u.ref, what, tag, state: high ? 'action' : 'flag', owner: u.owner, due: u.due, order: (high ? 0 : 1) * 1e5 + i };
  }).sort((a, b) => a.order - b.order);
  return all ? items : items.slice(0, 3);
}

/** The report's three plain-language checks, from the hero's See checks. */
export function reportChecks(rec = RECORDS) {
  const [kpi, recon, exc] = dataChecks(rec).see;
  return [recon, kpi, exc];   // Every job counted · Totals add up · Problems shown, not hidden
}

const checksHtml = (list) => `<ul class="lx-checks">${list.map((c) => `<li><span class="lx-chk-l">${esc(LABEL[c.label] || c.label)}</span><span class="lx-chk-d">${refs(DETAIL[c.detail] || c.detail)}</span>${pill(c.state)}</li>`).join('')}</ul>`;

// --- Opening: this week's scattered information --------------------------------------------------------------------
function openingHtml(rec) {
  const s = summarise(rec);
  const r104 = byRef(rec, 'R-104'); const r111 = byRef(rec, 'R-111'); const r112 = byRef(rec, 'R-112');
  const card = (cls, kind, title, body, tag, tone) => `<li class="lx-art ${cls}"><p class="lx-art-k">${kind}</p><p class="lx-art-t">${title}</p><p class="lx-art-b">${body}</p><p class="lx-tag is-${tone}">${tag}</p></li>`;
  const sentence = (t) => t.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return '<div class="lx-open" data-lx="open">'
    + `<p class="lx-open-h">${s.total} jobs this week. ${s.attention} issues that could easily be missed.</p>`
    + '<ul class="lx-arts">'
    + card('lx-a1', 'Job tracker', `${s.total} jobs this week`, `<span class="lx-ref">${r112.ref}</span> ${esc(r112.task)} · owner: ${esc(r112.owner.toLowerCase())}`, `<span class="lx-ref">${r112.ref}</span> · No owner`, 'action')
    + card('lx-a2', 'Service request form', `<span class="lx-ref">${r111.ref}</span> ${esc(r111.task)}`, `Received ${esc(shortDate(r111.received))} · customer left blank`, `<span class="lx-ref">${r111.ref}</span> · Missing customer`, 'flag')
    + card('lx-a3', 'Email update', `Re: ${esc(sentence(r104.task))}`, `${esc(r104.customer)} · due ${esc(shortDate(r104.due))} · still ${esc(r104.status.toLowerCase())}`, `<span class="lx-ref">${r104.ref}</span> · Overdue`, 'action')
    + card('lx-a4', 'Follow-up note', 'Monday: rebuild the weekly report', 'Pulled together by hand from the tracker, forms and emails', 'Built by hand every week', 'neutral')
    + '</ul></div>';
}

// --- Stage panels ---------------------------------------------------------------------------------------------------
function captureHtml(rec, checks) {
  const r = byRef(rec, 'R-111');
  const keys = new Set(findings(r, rec).map((f) => f.key));
  const field = (k, v, miss) => `<div class="lx-f${miss ? ' is-miss' : ''}"><dt>${k}</dt><dd>${miss ? '<span class="lx-blank">Missing</span>' : v}</dd></div>`;
  return '<div class="lx-pair">'
    + '<figure class="lx-form"><figcaption>Service request form <span>Sample</span></figcaption><dl>'
    + field('Reference', `<span class="lx-ref">${r.ref}</span>`) + field('Received', esc(shortDate(r.received)))
    + field('Request', esc(r.task)) + field('Customer', '', keys.has('missing')) + '</dl></figure>'
    + '<p class="lx-arrow" aria-hidden="true">&rarr;</p>'
    + '<figure class="lx-rec"><figcaption>Job record, with checks applied</figcaption>'
    + `<p class="lx-rec-row"><span class="lx-ref">${r.ref}</span> <b>${esc(r.task)}</b></p>`
    + `<p class="lx-rec-meta">Received ${esc(shortDate(r.received))} · ${esc(r.owner)} · ${esc(r.status)}</p>`
    + `<p class="lx-rec-cust">Customer: ${keys.has('missing') ? '<span class="lx-blank">Missing</span>' : esc(r.customer)}</p>`
    + `<p class="lx-rec-flag">${pill('flag')} <span>Customer details need completing. The missing information is flagged for follow-up and shown in the weekly report.</span></p></figure>`
    + '</div>' + checksHtml(checks);
}

function moveHtml(rec, checks) {
  const open = rec.filter((r) => inReport(r) && !isEmptyRow(r) && !isCompleted(r));
  const row = (r) => {
    const keys = new Set(findings(r, rec).map((f) => f.key));
    const tags = [keys.has('unassigned') && pill('action', 'No owner'), keys.has('overdue') && pill('action', 'Overdue')].filter(Boolean).join(' ');
    return `<tr class="${tags ? 'is-flag' : ''}"><th scope="row"><span class="lx-ref">${r.ref}</span></th><td>${esc(r.task)}${tags ? `<span class="lx-row-tags">${tags}</span>` : ''}</td>`
      + `<td data-l="Owner">${keys.has('unassigned') ? '<span class="lx-blank">Unassigned</span>' : esc(r.owner)}</td><td data-l="Due">${esc(day(r.due))}</td><td data-l="Status">${esc(r.status)}</td></tr>`;
  };
  return `<figure class="lx-list"><figcaption>Work still outstanding <span>${open.length} jobs</span></figcaption><div class="lx-scroll">`
    + `<table><caption class="sr-only">The ${open.length} outstanding jobs with owner, due date and status</caption><thead><tr><th scope="col">Ref</th><th scope="col">Job</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Status</th></tr></thead>`
    + `<tbody>${open.map(row).join('')}</tbody></table></div></figure>`
    + checksHtml(checks)
    + '<p class="lx-note">The checks show what needs attention. A person decides who takes the job and chases the follow-up.</p>';
}

function seeHtml(rec, interactive) {
  const list = reportChecks(rec);
  const s = summarise(rec);
  return `<ul class="lx-checks">${list.map((c) => `<li><span class="lx-chk-l">${esc(c.label)}</span><span class="lx-chk-d">${refs(c.detail)}</span>${pill(c.state)}</li>`).join('')}</ul>`
    + '<details class="lx-how"><summary>How the totals are checked</summary><ul>'
    + `<li>Every job in the report is counted once: ${s.total} of ${s.total}. That includes jobs still open from earlier weeks.</li>`
    + `<li>Completed plus still outstanding must equal the total: ${s.completed} + ${s.outstanding} = ${s.total}.</li>`
    + `<li>The ${s.attention} needing attention are part of the ${s.outstanding} still outstanding, not extra jobs.</li></ul></details>`
    + (interactive ? '<p class="lx-jump-see"><a href="#lx-rep-h">See the weekly report <span aria-hidden="true">&darr;</span></a></p>' : '');
}

function stageHtml(st, rec, interactive) {
  const c = dataChecks(rec);
  const body = st.id === 'capture' ? captureHtml(rec, c.capture) : st.id === 'move' ? moveHtml(rec, c.move) : seeHtml(rec, interactive);
  return `<div class="lx-panel" id="lx-p-${st.id}" data-stage="${st.id}"${interactive ? ` role="region" aria-labelledby="lx-ph-${st.id}" hidden` : ''}>`
    + `<p class="lx-panel-k">${st.n} ${st.name} · ${esc(st.short)}</p><h3 id="lx-ph-${st.id}">${esc(st.h)}</h3>${body}`
    + `<p class="lx-benefit">${esc(st.benefit)}</p></div>`;
}

// --- The weekly report ----------------------------------------------------------------------------------------------
export function reportHtml(rec = RECORDS) {
  const s = summarise(rec);
  const items = attentionItems(rec);
  const kpi = (key, n, label, cls, sub = '') => `<li class="lx-kpi ${cls}" data-kpi="${key}"><strong>${n}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</li>`;
  return '<section class="lx-report" aria-labelledby="lx-rep-h">'
    + `<p class="lx-rep-k">Weekly operations report · Fictional sample</p><h3 id="lx-rep-h" tabindex="-1">${esc(BUSINESS)}</h3>`
    + `<p class="lx-rep-sub">${PERIOD_LABEL} · ${s.total} jobs checked</p>`
    + `<ul class="lx-kpis">${kpi('completed', s.completed, 'Completed this week', 'is-done')}${kpi('outstanding', s.outstanding, 'Still outstanding', 'is-open')}`
    + `${kpi('attention', s.attention, 'Need attention', s.attention ? 'is-att' : 'is-clear', s.outstanding ? `Of the ${s.outstanding} still outstanding` : '')}</ul>`
    + '<p class="lx-sub">What needs attention</p>'
    + `<ol class="lx-actions">${items.length ? items.map((x) => `<li><span><span class="lx-ref">${x.ref}</span> ${esc(x.what)}</span>${pill(x.state, x.tag)}</li>`).join('') : '<li><span>Nothing needs attention this week</span></li>'}</ol>`
    + `<ul class="lx-rchecks">${reportChecks(rec).map((c) => `<li class="is-${c.state}"><span aria-hidden="true">${ICON[c.state]}</span> ${esc(c.label)}<span class="sr-only"> (${STATE[c.state]})</span></li>`).join('')}</ul>`
    + '<p class="lx-close">Know what&rsquo;s completed. See what&rsquo;s outstanding. Know what to do next.</p>'
    + '</section>';
}

// --- Full tracker (read-only) ---------------------------------------------------------------------------------------
export function rowHtml(r, all) {
  const keys = new Set(findings(r, all).map((f) => f.key));
  const cls = ['wt-row', isCompleted(r) && 'is-done', keys.size && 'is-flag'].filter(Boolean).join(' ');
  return `<tr class="${cls}" data-ref="${esc(r.ref)}"><td class="wt-ref">${esc(r.ref)}</td><td class="wt-task">${esc(r.task)}</td>`
    + `<td class="wt-cust">${r.customer ? esc(r.customer) : '<span class="wt-blank">Missing</span>'}</td>`
    + `<td class="wt-own">${keys.has('unassigned') ? '<span class="wt-blank">Unassigned</span>' : esc(r.owner)}</td>`
    + `<td class="wt-due"><span>${esc(shortDate(r.due))}</span>${keys.has('overdue') ? ' <em class="wt-tag">Overdue</em>' : ''}</td><td class="wt-st">${esc(r.status)}</td>`
    + `<td class="wt-done">${esc(shortDate(r.completed))}</td></tr>`;
}

const allHtml = (rec) => `<details class="lx-all"><summary>See all ${rec.length} jobs (the tracker behind this report)</summary>`
  + '<p class="lx-all-n">Read-only sample. Download the workbook below to try the tracker yourself.</p>'
  + `<div class="wt-scroll"><table class="wt-table"><caption class="sr-only">Sample work tracker: ${rec.length} jobs</caption>`
  + '<thead><tr><th scope="col">Ref</th><th scope="col">Request / Task</th><th scope="col">Customer / Area</th><th scope="col">Assigned To</th><th scope="col">Due Date</th><th scope="col">Status</th><th scope="col">Date Completed</th></tr></thead>'
  + `<tbody>${rec.map((r) => rowHtml(r, rec)).join('')}</tbody></table></div></details>`;

const tabsHtml = (explored = new Set(), current = '', hint = '') => STAGES.map((st) => `<button type="button" class="lx-tab${current === st.id ? ' is-on' : ''}${explored.has(st.id) ? ' is-seen' : ''}${hint === st.id ? ' is-hint' : ''}" data-go="${st.id}" aria-controls="lx-p-${st.id}" aria-pressed="${current === st.id}">`
  + `<span class="lx-tab-n">${st.n}</span><span class="lx-tab-t"><b>${st.name}</b><span>${esc(st.short)}</span></span>${explored.has(st.id) ? '<span class="lx-tab-ok" aria-hidden="true">&#10003;</span>' : hint === st.id ? `<span class="lx-tab-next">${explored.size ? 'Next' : 'Start here'}</span>` : ''}</button>`).join('');

/** The whole example. interactive=false is the no-JavaScript version (everything visible, no controls). */
export function appHtml(rec = RECORDS, { interactive = false } = {}) {
  const stages = STAGES.map((st) => stageHtml(st, rec, interactive)).join('');
  if (!interactive) {
    return '<div class="lx-grid is-static"><div class="lx-main">' + openingHtml(rec)
      + `<ol class="lx-stagelist">${STAGES.map((st) => `<li><span class="lx-tab-n">${st.n}</span> <b>${st.name}</b> · ${esc(st.short)}</li>`).join('')}</ol>`
      + stages + `</div>${reportHtml(rec)}</div>` + allHtml(rec);
  }
  return '<div class="lx-bar"><p class="lx-progress" data-lx="progress" aria-live="polite">Pick a stage to explore</p><div class="lx-ctrl">'
    + '<button type="button" class="lx-btn" data-lx-act="pause" aria-pressed="false" hidden>Pause</button>'
    + '<button type="button" class="lx-btn" data-lx-act="skip" hidden>Skip intro</button>'
    + '<button type="button" class="lx-btn" data-lx-act="replay" hidden>Replay intro</button></div></div>'
    + '<div class="lx-grid"><div class="lx-main">'
    + `<div class="lx-tabs" role="group" aria-label="Explore the three stages" data-lx="tabs">${tabsHtml()}</div>`
    + '<a class="lx-jump" href="#lx-rep-h">Jump to the weekly report <span aria-hidden="true">&darr;</span></a>'
    + `<div class="lx-stage" data-lx="stage">${openingHtml(rec)}${stages}</div>`
    + `</div>${reportHtml(rec)}</div>` + allHtml(rec);
}

/** Interactive version: opening animation, stage selection with a guided cue. Read-only: no record changes. */
export function mountTracker(host) {
  if (!host) return null;
  host.innerHTML = appHtml(RECORDS, { interactive: true });
  host.classList.add('is-live');
  host.closest('section')?.classList.add('lx-on');
  const q = (s) => host.querySelector(s);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const explored = new Set(); let current = '';
  const order = STAGES.map((s) => s.id);
  const report = q('.lx-report');
  const ctrl = (act) => q(`[data-lx-act="${act}"]`);

  const paintTabs = () => {
    const hint = host.classList.contains('lx-intro') ? '' : order.find((id) => !explored.has(id)) || '';
    q('[data-lx="tabs"]').innerHTML = tabsHtml(explored, current, hint);
    q('[data-lx="progress"]').textContent = explored.size ? `${explored.size} of 3 explored` : 'Pick a stage to explore';
  };
  const show = (id) => {
    current = id; explored.add(id);
    q('[data-lx="open"]').hidden = true;
    for (const p of host.querySelectorAll('.lx-panel')) p.hidden = p.dataset.stage !== id;
    report.classList.toggle('is-focus', id === 'see');
    paintTabs();
    q(`[data-go="${id}"]`)?.focus();
  };

  // Opening: CSS keyframes under .lx-intro. It ends when the report's rise finishes (so Pause also pauses the end).
  const finish = () => {
    host.classList.remove('lx-intro', 'lx-paused', 'lx-wait');
    ctrl('pause').hidden = true; ctrl('skip').hidden = true; ctrl('replay').hidden = reduce;
    ctrl('pause').textContent = 'Pause'; ctrl('pause').setAttribute('aria-pressed', 'false');
    paintTabs();
  };
  const play = () => {
    if (reduce) { finish(); return; }
    current = ''; for (const p of host.querySelectorAll('.lx-panel')) p.hidden = true;
    q('[data-lx="open"]').hidden = false; report.classList.remove('is-focus');
    host.classList.remove('lx-intro', 'lx-paused', 'lx-wait'); void host.offsetWidth; host.classList.add('lx-intro');
    ctrl('pause').hidden = false; ctrl('skip').hidden = false; ctrl('replay').hidden = true;
    paintTabs();
  };
  report.addEventListener('animationend', (e) => { if (e.animationName === 'lx-rise' && host.classList.contains('lx-intro')) finish(); });

  host.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { if (host.classList.contains('lx-intro')) finish(); show(go.dataset.go); return; }
    const act = e.target.closest('[data-lx-act]')?.dataset.lxAct;
    if (act === 'skip') { finish(); q('[data-go="capture"]').focus(); }
    if (act === 'replay') { play(); ctrl('skip').focus(); }
    if (act === 'pause') {
      const paused = host.classList.toggle('lx-paused');
      ctrl('pause').textContent = paused ? 'Play' : 'Pause'; ctrl('pause').setAttribute('aria-pressed', String(paused));
    }
  });

  if (reduce || typeof IntersectionObserver !== 'function') { finish(); return null; }
  host.classList.add('lx-wait');
  let safety = 0;
  const start = () => { io.disconnect(); clearTimeout(safety); if (host.classList.contains('lx-wait')) play(); };
  const io = new IntersectionObserver((ents) => {
    if (ents.some((x) => x.isIntersecting)) { start(); return; }
  }, { threshold: 0 });
  io.observe(q('[data-lx="tabs"]'));
  // Safety net: once any part of the example is on screen, it never stays hidden for more than 1.5 s.
  const near = new IntersectionObserver((ents) => {
    if (ents.some((x) => x.isIntersecting)) { near.disconnect(); safety = setTimeout(() => { if (host.classList.contains('lx-wait')) { io.disconnect(); finish(); } }, 1500); }
  }, { threshold: 0 });
  near.observe(host);
  return null;
}
