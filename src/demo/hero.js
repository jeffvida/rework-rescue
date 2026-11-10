// Hero (10 Nov 2026, late): one connected solution, Capture -> Move -> See, with data checks across all three stages.
// It is an overview, not a second demo: every figure comes from the Weekly Work & Follow-up Tracker (src/tracker/),
// the homepage's live example, and follows the same state, so edits made in the tracker show here too.
// Motion: one short entrance (~3.6 s, CSS, .cmv-play) when the hero is first on screen, and slow particles along the
// connections (.cmv-flow) only while the hero is visible. Reduced motion and no JavaScript show the finished picture
// with no movement. CSP: no inline style attributes (CSSOM setProperty only).

import { getRecords, subscribe } from '../tracker/store.js';
import { summarise, receivedByDay, byStatus } from '../tracker/engine.js';
import { PERIOD_LABEL } from '../tracker/data.js';

/** The hero's figures, all derived from the tracker records (also used by the tests). */
export function heroFigures(rec) {
  const s = summarise(rec);
  const st = Object.fromEntries(byStatus(rec).map((x) => [x.status, x.count]));
  return {
    total: s.total, completed: s.completed, outstanding: s.outstanding, overdue: s.overdue, attention: s.attention,
    active: (st['In Progress'] || 0) + (st.Waiting || 0), period: PERIOD_LABEL,
  };
}

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint() {
    const rec = getRecords();
    const f = heroFigures(rec);
    for (const [k, v] of Object.entries(f)) fig.querySelectorAll(`[data-cmv="${k}"]`).forEach((el) => { el.textContent = String(v); });
    const days = receivedByDay(rec); const max = Math.max(2, ...days.map((d) => d.received));
    for (const d of days) {
      const el = fig.querySelector(`[data-cmv-day="${d.day}"] i`);
      if (el) el.style.setProperty('height', `${Math.max(8, Math.round((d.received / max) * 100))}%`);
    }
  }
  subscribe(() => paint());
  paint();

  if (reduce || typeof IntersectionObserver !== 'function') return;
  fig.classList.add('cmv-wait');
  let played = false;
  const io = new IntersectionObserver((entries) => {
    const on = entries.some((x) => x.isIntersecting);
    // Particles only move while the hero is on screen.
    fig.classList.toggle('cmv-flow', on);
    if (on && !played) { played = true; fig.classList.remove('cmv-wait'); fig.classList.add('cmv-play'); }
  }, { threshold: 0.2 });
  io.observe(fig);
}
