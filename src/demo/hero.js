// Hero (11 Nov 2026): one workspace, two states, switched with a toggle.
//   Today: a typical week run from scattered spreadsheets, emails, forms, PDFs and notes, with the data problems each one
//   causes marked in red (problem) or amber (warning), grouped under Capture, Move and See.
//   With Rework Rescue: the same week as checked records. Each of Capture, Move and See shows its own built-in checks with
//   one of three states: Passed, Flagged (an exception was found) or Action required (a person must resolve it). Then the
//   Northstar Services weekly report: KPIs, action items and a summary draft.
// Every check state, figure, action item and summary line is computed from the Weekly Work & Follow-up Tracker records
// (src/tracker/), the homepage's live example, and follows the tracker's state. Nothing is shown as passed unless the
// sample data passes the rule.
// The HTML is the "With Rework Rescue" state (no JavaScript). With motion allowed, the hero alternates Today (~5 s) and
// With Rework Rescue (~10 s) while on screen and the tab is visible; Pause stops it (WCAG 2.2.2) and so does the toggle.
// Reduced motion: no autoplay, instant switch; the toggle still works. CSP: CSSOM setProperty only.

import { getRecords, subscribe } from '../tracker/store.js';
import { summarise, missingFields, isEmptyRow, inPeriod, byStatus } from '../tracker/engine.js';
import { RECORDS, PERIOD_LABEL, BUSINESS, STATUSES, OWNERS } from '../tracker/data.js';

/** The report's figures, all derived from the tracker records. */
export function heroFigures(rec = RECORDS) {
  const s = summarise(rec);
  return { total: s.total, completed: s.completed, outstanding: s.outstanding, attention: s.attention, overdue: s.overdue,
    unassigned: s.unassigned, missing: s.missing, duplicates: s.duplicates, period: PERIOD_LABEL, business: BUSINESS, followUps: s.followUps };
}

const refsOf = (f, key) => f.followUps.filter((x) => x.keys.includes(key)).map((x) => x.ref);
const refText = (refs) => (refs.length <= 2 ? refs.join(', ') : `${refs.length} records`);
const isoOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').trim()) || String(v ?? '').trim() === '';

/**
 * Built-in checks per stage, from the records. state: 'pass' | 'flag' | 'action' | 'none' (no data to check).
 * Each check lists the Today issues it answers (answers), so the two states line up (a test checks every Today issue).
 */
export function dataChecks(rec = RECORDS) {
  const f = heroFigures(rec);
  const rows = rec.filter((r) => inPeriod(r) && !isEmptyRow(r));
  const complete = rows.filter((r) => !missingFields(r).length).length;
  const formatsOk = rows.filter((r) => isoOk(r.received) && isoOk(r.due) && STATUSES.includes(String(r.status).trim())).length;
  const statusOk = rows.filter((r) => STATUSES.includes(String(r.status).trim())).length;
  const ownersOk = rows.filter((r) => OWNERS.includes(String(r.owner).trim()) || String(r.owner).trim() === '').length;
  const counted = byStatus(rec).reduce((n, x) => n + x.count, 0);
  const missRefs = refsOf(f, 'missing'); const ownRefs = refsOf(f, 'unassigned'); const lateRefs = refsOf(f, 'overdue');
  return {
    capture: [
      { label: 'Duplicate job references', state: f.duplicates ? 'flag' : 'pass', detail: f.duplicates ? `${f.duplicates} found` : 'None found', answers: ['Duplicate job references', 'Multiple spreadsheet versions'] },
      { label: 'Required fields', state: missRefs.length ? 'flag' : 'pass', detail: missRefs.length ? `${complete} of ${f.total} complete · ${refText(missRefs)}` : `${f.total} of ${f.total} complete`, answers: ['Missing service requests'] },
      { label: 'Consistent formats', state: formatsOk === rows.length ? 'pass' : 'flag', detail: `${formatsOk} of ${rows.length}`, answers: ['Inconsistent information'] },
    ],
    move: [
      { label: 'Assigned owners', state: ownRefs.length ? 'action' : 'pass', detail: ownRefs.length ? `No owner · ${refText(ownRefs)}` : 'All open jobs', answers: ['Jobs without owners'] },
      { label: 'Valid job statuses', state: statusOk === rows.length && ownersOk === rows.length ? 'pass' : 'flag', detail: `${statusOk} of ${rows.length}`, answers: ['Inconsistent statuses', 'Email updates not in records'] },
      { label: 'Overdue follow-ups', state: lateRefs.length ? 'action' : 'pass', detail: lateRefs.length ? `Overdue · ${refText(lateRefs)}` : 'None overdue', answers: ['Overdue follow-ups'] },
    ],
    see: [
      { label: 'KPI calculation', state: f.completed + f.outstanding === f.total ? 'pass' : 'flag', detail: `${f.completed} + ${f.outstanding} = ${f.total}`, answers: ['Manual KPI compilation', 'Rebuilt every week'] },
      { label: 'Record reconciliation', state: counted === f.total ? 'pass' : 'flag', detail: `${counted} of ${f.total} counted`, answers: ["Report figures don't match"] },
      { label: 'Exceptions in the report', state: f.attention ? 'flag' : 'pass', detail: f.attention ? `${f.attention} shown, not hidden` : 'None this week', answers: [] },
    ],
  };
}

export const STATE = { pass: 'Passed', flag: 'Flagged', action: 'Action required', none: 'No data' };
const NEXT = { unassigned: ['Assign an owner to', '', 'High'], overdue: ['Follow up', ' (overdue)', 'High'], missing: ['Complete customer details for', '', 'Medium'], duplicate: ['Check the possible duplicate', '', 'Medium'] };

/** Action items: one per flagged record (most urgent first), named by its reference. */
export function actionItems(f) {
  const order = { High: 0, Medium: 1 };
  const items = f.followUps.map((x) => {
    const key = ['unassigned', 'overdue', 'missing', 'duplicate'].find((k) => x.keys.includes(k));
    const [verb, tail, priority] = NEXT[key];
    return { label: `${verb} ${x.ref}${tail}`, short: `${verb} ${x.ref}`, priority, ref: x.ref };
  }).sort((a, b) => order[a.priority] - order[b.priority]);
  return items.length ? items.slice(0, 3) : [{ label: 'Nothing needs attention this week', priority: '' }];
}

/** The summary draft's bullets (written by simple rules on this page; the caption says so). */
export function summaryBullets(f, items = actionItems(f)) {
  const att = f.followUps.length;
  const high = items.filter((x) => x.priority === 'High').map((x) => x.short.replace(/^./, (c) => c.toLowerCase()));
  return [
    `${f.completed} of ${f.total} jobs completed this week.`,
    f.outstanding ? `${f.outstanding} still outstanding${att ? `; ${att} of these need${att === 1 ? 's' : ''} attention` : ''}.` : 'Nothing is still outstanding.',
    high.length ? `Next: ${high.join(' and ')}.` : 'Next: share the report.',
  ];
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** HTML for one stage's checks (also used to write the no-JavaScript version and by the tests). */
export const checksHtml = (list) => list.map((c) => `<li class="hx-chk is-${c.state}"><span class="hx-dot" aria-hidden="true"></span><span class="hx-chk-l">${esc(c.label)}</span><span class="hx-chk-d">${esc(c.detail)}</span><span class="sr-only"> ${STATE[c.state]}</span></li>`).join('');
const refs = (t) => esc(t).replace(/R-\d+/g, (r) => `<span class="hx-ref">${r}</span>`);
export const actionsHtml = (items) => items.map((x) => `<li><span class="hx-box" aria-hidden="true"></span><span>${refs(x.label)}</span>${x.priority ? `<em${x.priority === 'High' ? ' class="is-high"' : ''}>${x.priority}</em>` : ''}</li>`).join('');
export const summaryHtml = (bullets) => bullets.map((t) => `<li>${refs(t)}</li>`).join('');

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => fig.querySelector(s);
  const btns = [...fig.querySelectorAll('[data-ws-mode]')];
  const pauseBtn = q('.hx-pause');
  let mode = 'after';

  const set = (k, v) => fig.querySelectorAll(`[data-ws="${k}"]`).forEach((el) => { el.textContent = String(v); });
  // Figures are always shown final (no count-up), so the tiles never show numbers that don't add up.
  function paint() {
    const rec = getRecords(); const f = heroFigures(rec);
    for (const k of ['business', 'period', 'total', 'completed', 'outstanding', 'attention']) set(k, f[k]);
    const checks = dataChecks(rec);
    for (const k of ['capture', 'move', 'see']) { const el = q(`[data-ws-checks="${k}"]`); if (el) el.innerHTML = checksHtml(checks[k]); }
    const items = actionItems(f);
    const a = q('[data-ws-actions]'); if (a) a.innerHTML = actionsHtml(items);
    const sm = q('[data-ws-summary]'); if (sm) sm.innerHTML = summaryHtml(summaryBullets(f, items));
  }

  const toggle = q('.hx-toggle');
  function placePill() {
    const on = btns.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!toggle || !on) return;
    toggle.classList.add('is-js');
    toggle.style.setProperty('--tg-x', `${on.offsetLeft}px`);
    toggle.style.setProperty('--tg-w', `${on.offsetWidth}px`);
  }
  addEventListener('resize', placePill);
  document.fonts?.ready?.then(placePill);

  function setMode(m) {
    mode = m;
    fig.classList.toggle('hx-is-today', m === 'today');
    fig.classList.toggle('hx-is-after', m === 'after');
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wsMode === m)));
    placePill();
    // Only the visible state is exposed to screen readers.
    fig.querySelectorAll('.hx-today, .hx-only-today').forEach((el) => el.setAttribute('aria-hidden', String(m !== 'today')));
    fig.querySelectorAll('.hx-after, .hx-only-after').forEach((el) => el.setAttribute('aria-hidden', String(m !== 'after')));
    paint();
  }
  setMode('after');
  subscribe(() => paint());

  let manual = false; let paused = false; let onScreen = false; let timer = 0;
  const canPlay = () => !reduce && !manual && !paused && onScreen && !document.hidden;
  function loop() {
    clearTimeout(timer);
    if (!canPlay()) return;
    timer = setTimeout(() => { setMode(mode === 'today' ? 'after' : 'today'); loop(); }, mode === 'today' ? 5000 : 10000);
  }
  btns.forEach((b) => b.addEventListener('click', () => {
    manual = true; clearTimeout(timer);
    if (pauseBtn && !pauseBtn.hidden) pauseBtn.textContent = 'Play animation';
    if (b.dataset.wsMode !== mode) setMode(b.dataset.wsMode);
  }));
  if (reduce || typeof IntersectionObserver !== 'function') return;

  if (pauseBtn) {
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', () => {
      const play = manual || paused;
      manual = false; paused = !play;
      pauseBtn.textContent = paused ? 'Play animation' : 'Pause animation';
      if (play) { setMode('today'); loop(); } else clearTimeout(timer);
    });
  }
  let started = false;
  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    if (onScreen && !started && canPlay()) { started = true; setMode('today'); }
    if (onScreen) loop(); else clearTimeout(timer);
  }, { threshold: 0.3 }).observe(fig);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else loop(); });
}
