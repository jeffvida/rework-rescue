// Hero (10–11 Nov 2026): one connected transformation, Capture -> Move -> See, with a small data-check layer.
// It tells one short story from the sample week of the Weekly Work & Follow-up Tracker (src/tracker/), the homepage's
// live example: request R-110 (Brightline Studio, "Prepare weekly update") is captured, assigned to Sam, followed up
// and completed; the dashboard updates; then R-112 arrives with no owner and the data check flags it. The dashboard
// ends on exactly the tracker's figures (heroFigures), counting up from the week before those two requests.
// The HTML is the finished picture (no JavaScript, reduced motion, paused). The story loops (~13 s) only while the hero
// is on screen and the tab is visible; a Pause button stops it on the finished picture (WCAG 2.2.2). If the visitor
// edits the tracker, the loop stops and the hero shows the live figures. CSP: CSSOM setProperty only.

import { getRecords, subscribe } from '../tracker/store.js';
import { summarise, receivedByDay } from '../tracker/engine.js';
import { RECORDS, PERIOD_LABEL } from '../tracker/data.js';

/** The hero's final figures, all derived from the tracker records (also used by the tests). */
export function heroFigures(rec = RECORDS) {
  const s = summarise(rec);
  return { total: s.total, completed: s.completed, outstanding: s.outstanding, attention: s.attention, period: PERIOD_LABEL,
    followUps: s.followUps.map((x) => ({ ref: x.ref, keys: x.keys })) };
}

// Short labels for the See panel's attention list (the tracker shows the full wording).
export const SHORT = { overdue: 'Overdue', missing: 'Missing details', missingCustomer: 'Missing details', unassigned: 'No owner', duplicate: 'Check duplicate' };

// The record rows shown under Capture, newest first (three at a time).
const ROW = {
  'R-112': '<li class="is-flag"><b>R-112</b><span>Northfield Services</span><em>Check</em></li>',
  'R-110': '<li><b>R-110</b><span>Brightline Studio</span><em class="is-open">Open</em></li>',
  'R-110done': '<li><b>R-110</b><span>Brightline Studio</span><em>&#10003;</em></li>',
  'R-109': '<li><b>R-109</b><span>Harbor Works</span><em>&#10003;</em></li>',
  'R-108': '<li><b>R-108</b><span>Cedar &amp; Co.</span><em class="is-open">Open</em></li>',
};

/**
 * The story as states, each a delta from the finished picture (f = heroFigures of the sample).
 * fill: form fields shown; saved: "Added to records"; rows: Capture list; job: Move card shown; done: steps ticked;
 * flag: data-check flag shown; pulse: figures that just changed. Times are ms from the start of the loop.
 */
export function storyStates(f) {
  return [
    { at: 0, fill: 0, saved: false, rows: ['R-109', 'R-108'], job: false, done: 0, flag: false, without: ['R-110', 'R-112'], n: { total: f.total - 2, completed: f.completed - 1, outstanding: f.outstanding - 1, attention: f.attention - 1 } },
    { at: 700, fill: 1 }, { at: 1100, fill: 2 }, { at: 1500, fill: 3 },
    { at: 2300, saved: true, rows: ['R-110', 'R-109', 'R-108'], link: 1, without: ['R-112'], n: { total: f.total - 1, outstanding: f.outstanding }, pulse: ['total', 'outstanding'] },
    { at: 3300, job: true, done: 1 }, { at: 4200, done: 2 }, { at: 5100, done: 3 },
    { at: 6000, done: 4, rows: ['R-110done', 'R-109', 'R-108'], link: 2 },
    { at: 6900, n: { completed: f.completed, outstanding: f.outstanding - 1 }, pulse: ['completed', 'outstanding'] },
    { at: 8300, rows: ['R-112', 'R-110done', 'R-109'], without: [], n: { total: f.total, outstanding: f.outstanding }, pulse: ['total', 'outstanding'] },
    { at: 9200, flag: true, n: { attention: f.attention }, pulse: ['attention'] },
    { at: 12800, end: true },
  ];
}

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => fig.querySelector(s);
  const set = (k, v) => fig.querySelectorAll(`[data-tf="${k}"]`).forEach((el) => { el.textContent = String(v); });
  const isSample = () => JSON.stringify(getRecords()) === JSON.stringify(RECORDS);

  // Finished picture with the current tracker figures.
  function paintFinal() {
    const rec = getRecords(); const f = heroFigures(rec);
    for (const k of ['total', 'completed', 'outstanding', 'attention', 'period']) set(k, f[k]);
    paintBars(rec);
    const att = q('[data-tf-att]');
    if (att) att.innerHTML = f.followUps.slice(0, 3).map((x) => `<li${x.ref === 'R-112' ? ' class="tf-att-new"' : ''}><b>${x.ref}</b> ${SHORT[x.keys[0]]}</li>`).join('') || '<li>Nothing waiting</li>';
  }
  // Bars: requests received per day; the story leaves out the requests it has not captured yet.
  function paintBars(rec) {
    const days = receivedByDay(rec); const max = Math.max(3, ...receivedByDay(RECORDS).map((d) => d.received));
    for (const d of days) q(`[data-tf-day="${d.day}"] i`)?.style.setProperty('height', `${Math.max(8, Math.round((d.received / max) * 100))}%`);
  }
  paintFinal();

  if (reduce || typeof IntersectionObserver !== 'function') { subscribe(() => paintFinal()); return; }

  const pauseBtn = q('.tf-pause');
  const rows = q('[data-tf-rows]'); const steps = [...fig.querySelectorAll('[data-tf-steps] li')];
  const finalRows = rows.innerHTML;
  let timers = []; let onScreen = false; let paused = false; let stopped = false; let running = false;

  const clear = () => { timers.forEach(clearTimeout); timers = []; running = false; };
  const showFinal = () => {
    clear();
    fig.classList.remove('tf-run', 'tf-fade', 'tf-l1', 'tf-l2');
    fig.querySelectorAll('.is-pulse, .is-new').forEach((el) => el.classList.remove('is-pulse', 'is-new'));
    rows.innerHTML = finalRows; delete fig.dataset.done; delete fig.dataset.fill; paintFinal();
  };
  const apply = (st) => {
    if (st.end) { fig.classList.add('tf-fade'); timers.push(setTimeout(() => { fig.classList.remove('tf-fade'); start(); }, 450)); return; }
    if ('fill' in st) fig.dataset.fill = String(st.fill);
    if ('saved' in st) fig.classList.toggle('tf-saved-on', st.saved);
    if ('job' in st) fig.classList.toggle('tf-job-on', st.job);
    if ('flag' in st) fig.classList.toggle('tf-flag-on', st.flag);
    if ('done' in st) { fig.dataset.done = String(st.done); steps.forEach((li, i) => li.classList.toggle('is-done', i < st.done)); }
    if (st.without) paintBars(RECORDS.filter((r) => !st.without.includes(r.ref)));
    if (st.rows) {
      const first = rows.firstElementChild?.querySelector('b')?.textContent;
      rows.innerHTML = st.rows.map((r) => ROW[r]).join('');
      const top = rows.firstElementChild; if (top && top.querySelector('b').textContent !== first) top.classList.add('is-new');
    }
    if (st.n) for (const [k, v] of Object.entries(st.n)) set(k, v);
    for (const k of st.pulse || []) fig.querySelectorAll(`[data-tf="${k}"]`).forEach((el) => { el.classList.remove('is-pulse'); void el.offsetWidth; el.classList.add('is-pulse'); });
    if (st.link) { const c = `tf-l${st.link}`; fig.classList.remove(c); void fig.offsetWidth; fig.classList.add(c); }
  };
  function start() {
    clear();
    if (paused || stopped || !onScreen || document.hidden) { showFinal(); return; }
    running = true; fig.classList.add('tf-run');
    const f = heroFigures(RECORDS);
    for (const st of storyStates(f)) timers.push(setTimeout(() => apply(st), st.at));
  }
  const sync = () => { if (onScreen && !paused && !stopped && !document.hidden) { if (!running) start(); } else showFinal(); };

  new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); sync(); }, { threshold: 0.25 }).observe(fig);
  document.addEventListener('visibilitychange', sync);
  subscribe(() => { if (!isSample()) { stopped = true; if (pauseBtn) pauseBtn.hidden = true; } else stopped = false; showFinal(); sync(); });
  if (pauseBtn) {
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.textContent = paused ? 'Play animation' : 'Pause animation';
      sync();
    });
  }
}
