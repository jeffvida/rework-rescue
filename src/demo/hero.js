// Hero (11 Nov 2026, mockup v3): Capture -> Move -> See tiles joined by a glowing route, a tilted "Weekly operations"
// view and a built-in data checks badge. Everything comes from the sample week of the Weekly Work & Follow-up Tracker
// (src/tracker/), the homepage's live example: the rows are real tracker records and the "This week" figures end on
// the tracker's own numbers (heroFigures).
// Story (~11 s loop): the tiles light up in turn; R-110 (Brightline Studio, Sam) goes from In progress to Completed;
// the figures update; R-112 (Northfield Services) arrives with no owner and the data checks flag it.
// The HTML is the finished picture (no JavaScript, reduced motion, paused). The story and the dots on the route run only
// while the hero is on screen and the tab is visible; a Pause button stops both (WCAG 2.2.2). Editing the tracker stops
// the story and shows the live figures. CSP: no inline style attributes (CSSOM setProperty only).

import { getRecords, subscribe } from '../tracker/store.js';
import { summarise, receivedByDay } from '../tracker/engine.js';
import { RECORDS, PERIOD_LABEL } from '../tracker/data.js';

/** The hero's final figures, all derived from the tracker records (also used by the tests). */
export function heroFigures(rec = RECORDS) {
  const s = summarise(rec);
  return { total: s.total, completed: s.completed, outstanding: s.outstanding, attention: s.attention, period: PERIOD_LABEL };
}

// Today vs With Rework Rescue: the hero opens on the "Today" scene (scattered spreadsheet, emails and notes; each tile
// shows the problem it replaces), then switches to the organised view. Visitors can switch themselves with the toggle.
const STATUS = { done: ['is-done', 'Completed'], prog: ['is-prog', 'In progress'], un: ['is-un', 'Unassigned'] };
const ROWS = {
  'R-112': ['R-112', 'Northfield Services', '&mdash;', 'un', true],
  'R-110': ['R-110', 'Brightline Studio', 'Sam', 'prog'],
  'R-110done': ['R-110', 'Brightline Studio', 'Sam', 'done'],
  'R-106': ['R-106', 'Northfield Services', 'Ana', 'prog'],
  'R-109': ['R-109', 'Harbor Works', 'Ana', 'done'],
};
const rowHtml = (k) => {
  const [ref, cust, own, st, flag] = ROWS[k]; const [cls, label] = STATUS[st];
  return `<tr${flag ? ' class="is-flag"' : ''}><td>${ref}</td><td>${cust}</td><td class="hv-own">${own}</td><td><span class="hv-st ${cls}">${label}</span></td></tr>`;
};

/**
 * The story as states. n: figures shown; tile: tile lit (1 Capture, 2 Move, 3 See); rows: table rows (top first);
 * without: records not yet received (left out of the chart); flag: data checks badge flags R-112.
 */
export function storyStates(f) {
  const T = 3000; // the "Today" scene plays first
  return [
    { at: 0, mode: 'before', tile: 0, rows: ['R-110', 'R-106', 'R-109'], without: ['R-112'], flag: false, n: { completed: f.completed - 1, outstanding: f.outstanding, attention: f.attention - 1 } },
    { at: T, mode: 'after', tile: 1 },
    { at: T + 1600, tile: 2 },
    { at: T + 2600, rows: ['R-110done', 'R-106', 'R-109'], changed: 0 },
    { at: T + 3400, tile: 3, n: { completed: f.completed, outstanding: f.outstanding - 1 }, pulse: ['completed', 'outstanding'] },
    { at: T + 5200, tile: 1, rows: ['R-112', 'R-110done', 'R-106'], without: [], changed: 0, n: { outstanding: f.outstanding }, pulse: ['outstanding'] },
    { at: T + 6400, flag: true, tile: 0, n: { attention: f.attention }, pulse: ['attention'] },
    { at: T + 10500, end: true },
  ];
}

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => fig.querySelector(s);
  const set = (k, v) => fig.querySelectorAll(`[data-hv="${k}"]`).forEach((el) => { el.textContent = String(v); });
  const svg = q('.hv-path');
  const isSample = () => JSON.stringify(getRecords()) === JSON.stringify(RECORDS);

  function paintBars(rec) {
    const days = receivedByDay(rec); const max = Math.max(3, ...receivedByDay(RECORDS).map((d) => d.received));
    for (const d of days) q(`[data-hv-day="${d.day}"] i`)?.style.setProperty('height', `${Math.max(8, Math.round((d.received / max) * 100))}%`);
  }
  function paintFinal() {
    const rec = getRecords(); const f = heroFigures(rec);
    for (const k of ['completed', 'outstanding', 'attention', 'period']) set(k, f[k]);
    paintBars(rec);
  }
  paintFinal();

  const dots = (on) => { try { if (svg && svg.pauseAnimations) { if (on) svg.unpauseAnimations(); else svg.pauseAnimations(); } } catch { /* older browsers */ } };
  if (reduce || typeof IntersectionObserver !== 'function') {
    dots(false); subscribe(() => paintFinal());
    // No story: the toggle simply switches between the two still pictures.
    fig.querySelectorAll('[data-hv-mode]').forEach((b, _, all) => b.addEventListener('click', () => {
      fig.classList.toggle('hv-today', b.dataset.hvMode === 'before');
      all.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    return;
  }

  const rows = q('[data-hv-rows]'); const finalRows = rows.innerHTML;
  const tiles = [...fig.querySelectorAll('[data-hv-tile]')];
  const pauseBtn = q('.hv-pause');
  const modeBtns = [...fig.querySelectorAll('[data-hv-mode]')];
  let manual = null; // 'before' | 'after' when the visitor chose a view
  const setMode = (m) => {
    fig.classList.toggle('hv-today', m === 'before');
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hvMode === m)));
  };
  let timers = []; let onScreen = false; let paused = false; let stopped = false; let running = false;

  const clear = () => { timers.forEach(clearTimeout); timers = []; running = false; };
  const showFinal = () => {
    clear(); dots(false);
    fig.classList.remove('hv-run', 'hv-fade', 'hv-flag-on');
    tiles.forEach((t) => t.classList.remove('is-on'));
    fig.querySelectorAll('.is-pulse').forEach((el) => el.classList.remove('is-pulse'));
    rows.innerHTML = finalRows; paintFinal();
    setMode(manual || 'after');
  };
  const apply = (st) => {
    if (st.end) { fig.classList.add('hv-fade'); timers.push(setTimeout(() => { fig.classList.remove('hv-fade'); start(); }, 450)); return; }
    if (st.mode) setMode(st.mode);
    if ('tile' in st) tiles.forEach((t) => t.classList.toggle('is-on', Number(t.dataset.hvTile) === st.tile));
    if ('flag' in st) fig.classList.toggle('hv-flag-on', st.flag);
    if (st.rows) {
      rows.innerHTML = st.rows.map(rowHtml).join('');
      if ('changed' in st) rows.children[st.changed]?.classList.add('is-new');
    }
    if (st.without) paintBars(RECORDS.filter((r) => !st.without.includes(r.ref)));
    if (st.n) for (const [k, v] of Object.entries(st.n)) set(k, v);
    for (const k of st.pulse || []) fig.querySelectorAll(`[data-hv="${k}"]`).forEach((el) => { el.classList.remove('is-pulse'); void el.offsetWidth; el.classList.add('is-pulse'); });
  };
  function start() {
    clear();
    if (paused || manual || stopped || !onScreen || document.hidden) { showFinal(); return; }
    running = true; dots(true); fig.classList.add('hv-run');
    for (const st of storyStates(heroFigures(RECORDS))) timers.push(setTimeout(() => apply(st), st.at));
  }
  const sync = () => { if (onScreen && !paused && !manual && !stopped && !document.hidden) { if (!running) start(); } else showFinal(); };

  dots(false);
  new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); sync(); }, { threshold: 0.25 }).observe(fig);
  document.addEventListener('visibilitychange', sync);
  subscribe(() => { stopped = !isSample(); if (pauseBtn) pauseBtn.hidden = stopped; showFinal(); sync(); });
  // The toggle stops the story and shows the chosen view; Play resumes the story from the start.
  modeBtns.forEach((b) => b.addEventListener('click', () => {
    manual = b.dataset.hvMode; paused = true;
    if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.textContent = 'Play animation'; }
    sync();
  }));
  if (pauseBtn) {
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', () => {
      paused = !paused; if (!paused) manual = null;
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.textContent = paused ? 'Play animation' : 'Pause animation';
      sync();
    });
  }
}
