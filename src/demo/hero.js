// Hero (11 Nov 2026): one workspace, two states. "Today" shows a typical week run from scattered spreadsheets, emails,
// forms, PDFs and notes; "With Rework Rescue" shows the same week as checked records, clear owners and a weekly report
// with KPIs, action items and a summary draft. Visitors switch with the toggle (real buttons, aria-pressed).
// All figures come from the Weekly Work & Follow-up Tracker (src/tracker/), the homepage's live example, for the
// fictional business Northstar Services; they follow the tracker's state, so edits made there show here too.
// The HTML is the "With Rework Rescue" state (no JavaScript). With motion allowed, the hero alternates Today (~4 s) and
// With Rework Rescue (~9 s) while it is on screen and the tab is visible; a Pause button stops it (WCAG 2.2.2), and
// choosing a state with the toggle stops it too. Reduced motion: no autoplay, no movement; the toggle still works.
// CSP: no inline style attributes (CSSOM setProperty only).

import { getRecords, subscribe } from '../tracker/store.js';
import { summarise } from '../tracker/engine.js';
import { RECORDS, PERIOD_LABEL, BUSINESS } from '../tracker/data.js';

/** The report's figures, all derived from the tracker records (also used by the tests). */
export function heroFigures(rec = RECORDS) {
  const s = summarise(rec);
  return { total: s.total, completed: s.completed, outstanding: s.outstanding, attention: s.attention, overdue: s.overdue,
    unassigned: s.unassigned, missing: s.missing, duplicates: s.duplicates, period: PERIOD_LABEL, business: BUSINESS };
}

/** Action items, most urgent first, from the tracker's own checks (label, count, priority). */
export function actionItems(f) {
  const items = [
    ['Assign owners', f.unassigned, 'High'],
    ['Follow up overdue work', f.overdue, 'High'],
    ['Complete missing details', f.missing, 'Medium'],
    ['Check possible duplicates', f.duplicates, 'Medium'],
  ].filter(([, n]) => n > 0).map(([label, n, priority]) => ({ label: `${label} (${n})`, priority }));
  return items.length ? items.slice(0, 3) : [{ label: 'Nothing needs attention this week', priority: '' }];
}

/** The summary draft's bullets (written by simple rules on this page; the caption says so). */
export function summaryBullets(f, items = actionItems(f)) {
  const job = (n) => `${n} job${n === 1 ? '' : 's'}`;
  return [
    `${job(f.completed)} completed this week.`,
    `${f.outstanding} still outstanding.`,
    f.attention ? `${f.attention} need${f.attention === 1 ? 's' : ''} attention before the weekly update.` : 'Nothing needs attention before the weekly update.',
    items[0].priority ? `Next step: ${items[0].label.replace(/ \(\d+\)$/, '').replace(/^./, (c) => c.toLowerCase())}.` : 'Next step: share the report.',
  ];
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => fig.querySelector(s);
  const btns = [...fig.querySelectorAll('[data-ws-mode]')];
  const pauseBtn = q('.hx-pause');
  let mode = 'after';

  const set = (k, v) => fig.querySelectorAll(`[data-ws="${k}"]`).forEach((el) => { el.textContent = String(v); });
  let counters = [];
  function countUp(k, v) {
    fig.querySelectorAll(`[data-ws="${k}"]`).forEach((el) => {
      const t0 = performance.now(); const dur = 700; const delay = 450;
      const step = (now) => {
        const p = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
        el.textContent = String(Math.round(v * (1 - (1 - p) ** 3)));
        if (p < 1) counters.push(requestAnimationFrame(step));
      };
      el.textContent = '0'; counters.push(requestAnimationFrame(step));
    });
  }
  function paint(animate = false) {
    const rec = getRecords(); const f = heroFigures(rec);
    for (const k of ['business', 'period', 'total']) set(k, f[k]);
    for (const k of ['completed', 'outstanding', 'attention']) (animate ? countUp : set)(k, f[k]);
    const items = actionItems(f);
    const a = q('[data-ws-actions]');
    if (a) a.innerHTML = items.map((x) => `<li><span class="hx-box" aria-hidden="true"></span><span>${esc(x.label)}</span>${x.priority ? `<em${x.priority === 'High' ? ' class="is-high"' : ''}>${x.priority}</em>` : ''}</li>`).join('');
    const sm = q('[data-ws-summary]');
    if (sm) sm.innerHTML = summaryBullets(f, items).map((t) => `<li>${esc(t)}</li>`).join('');
  }

  // The toggle's sliding highlight follows the pressed button (measured, so it fits either label).
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

  function setMode(m, animate = !reduce) {
    mode = m;
    counters.forEach(cancelAnimationFrame); counters = [];
    fig.classList.toggle('hx-is-today', m === 'today');
    fig.classList.toggle('hx-is-after', m === 'after');
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wsMode === m)));
    placePill();
    // Only the visible state is exposed to screen readers.
    fig.querySelectorAll('.hx-today, .hx-only-today').forEach((el) => el.setAttribute('aria-hidden', String(m !== 'today')));
    fig.querySelectorAll('.hx-after, .hx-only-after').forEach((el) => el.setAttribute('aria-hidden', String(m !== 'after')));
    paint(m === 'after' && animate);
  }
  setMode('after', false);
  subscribe(() => paint(false));

  let manual = false; let paused = false; let onScreen = false; let timer = 0;
  const canPlay = () => !reduce && !manual && !paused && onScreen && !document.hidden;
  function loop() {
    clearTimeout(timer);
    if (!canPlay()) return;
    timer = setTimeout(() => { setMode(mode === 'today' ? 'after' : 'today'); loop(); }, mode === 'today' ? 4000 : 9000);
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
    if (onScreen && !started && canPlay()) { started = true; setMode('today', false); }
    if (onScreen) loop(); else clearTimeout(timer);
  }, { threshold: 0.3 }).observe(fig);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else loop(); });
}
