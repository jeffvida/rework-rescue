// Hero (17 Nov 2026, round 12): the round-8 scene; the slider sits under the illustration, the logo's centre tracks progress: one business operation, before and after; the Rework Rescue logo is the control. One value, --p on the hero (0 = scattered work, 1 = better
// operations), drives everything in CSS: the Bot's position, the mark unfolding into the Bot (--m), its stride
// (sin of --p, so it runs at exactly the speed it moves, in either direction), and every object in the scene.
// Autoplay and dragging write the same value; nothing else animates the scene.
//   Autoplay: once per page load, when the scene is on screen, after ~0.8 s: the mark unfolds (0.7 s), then the Bot
//             runs across (~3.9 s) and stops at the far right. Any pointer or key input stops it at once and hands
//             control to the visitor. Never loops. "Replay" plays it again.
//   Pointer: drag the Bot in the scene or the logo knob on the bar (mouse, pen, touch). The Bot has touch-action: none so dragging it never scrolls the page;
//            the rest of the line keeps vertical scrolling (pan-y). Tap or click the line to glide there.
//   Keyboard: ← → (5%), PageUp/PageDown (20%), Home/End. role="slider" with aria-valuenow / aria-valuetext.
//   Reduced motion: no autoplay; the page opens on the organised end state and the slider works by hand.
// Without JavaScript the slider stays hidden and the organised state shows. CSP: CSSOM setProperty and classes.

const STAGES = [
  [0.15, 'Scattered work: emails, forms, copied spreadsheets and notes handled by hand'],
  [0.4, 'Understanding the work: AI reads and extracts the information'],
  [0.6, 'Improving the process: automation moves the work and schedules follow-ups'],
  [0.9, 'Checks and control: records checked, one exception sent to a person'],
  [1.01, 'Better operations: connected, checked, with one item for a person to review'],
];
export const describe = (p) => STAGES.find(([max]) => p < max)[1];
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
// round 13: autoplay pacing. The run dwells ~0.3 s over each station (where its glow peaks), so first-time
// visitors read the three beats — understand, improve, check. Same RUN_MS; only the curve changes. Dragging,
// tapping and the keyboard stay direct; clicks on the track keep the plain ease.
const WAY = [[0, 0], [0.2, 0.326], [0.28, 0.326], [0.46, 0.543], [0.54, 0.543], [0.72, 0.761], [0.8, 0.761], [1, 1]];
const smooth = (k) => k * k * (3 - 2 * k);
export const storyEase = (k) => {
  for (let i = 1; i < WAY.length; i++) {
    const [t1, s1] = WAY[i - 1], [t2, s2] = WAY[i];
    if (k <= t2) return s1 + (s2 - s1) * smooth((k - t1) / (t2 - t1));
  }
  return 1;
};
export const MORPH_MS = 1000;
export const RUN_MS = 3800;
export const START_DELAY_MS = 800;

export function mountSlider(hero) {
  if (!hero) return;
  const track = hero.querySelector('.rx-track');
  const knob = hero.querySelector('.rx-runner');
  const replay = hero.querySelector('.rx-reset');
  const stage = hero.querySelector('.rx-stage');
  if (!track || !knob) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let p = 0;
  let frame = 0;
  let anim = 0;
  let timer = 0;
  const paint = () => {
    frame = 0;
    hero.style.setProperty('--p', p.toFixed(4));
    hero.classList.toggle('rx-done', p > 0.97); // the arrival: the end state settles once (CSS plays it one time)
    knob.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    knob.setAttribute('aria-valuetext', describe(p));
  };
  const set = (v) => { p = clamp01(v); if (!frame) frame = requestAnimationFrame(paint); };
  const ready = () => { hero.classList.add('rx-ready'); if (replay) replay.hidden = false; };
  const stop = () => { cancelAnimationFrame(anim); clearTimeout(timer); hero.classList.remove('rx-autoplay'); };
  const takeOver = () => { stop(); hero.classList.add('rx-touched'); ready(); };

  // the Bot travels a fixed share of the stage (CSS: 19.5% on desktop, 66% on phones); one stride per ~45 px of it
  const bot = hero.querySelector('.bot-wrap');
  const travel = () => (stage ? stage.offsetWidth * (matchMedia('(max-width: 40rem)').matches ? 0.66 : 0.195) : 300);
  const cycles = () => hero.style.setProperty('--cyc', String(Math.max(3, Math.round(travel() / 45))));
  cycles();
  addEventListener('resize', cycles, { passive: true });

  hero.classList.add('rx-js');

  const tween = (from, to, ms, done, curve = ease) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      set(from + (to - from) * curve(k));
      if (k < 1) anim = requestAnimationFrame(step); else done?.();
    };
    anim = requestAnimationFrame(step);
  };
  const autoplay = () => {
    stop();
    hero.classList.add('rx-autoplay');
    set(0);
    timer = setTimeout(() => tween(0, 0.08, MORPH_MS, () => tween(0.08, 1, RUN_MS, () => { hero.classList.remove('rx-autoplay'); ready(); }, storyEase)), START_DELAY_MS);
  };

  if (reduce) { p = 1; paint(); ready(); }
  else {
    p = 0; paint();
    if (stage && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); if (!hero.classList.contains('rx-touched')) autoplay(); }
      }, { threshold: 0.35 });
      io.observe(stage);
    } else autoplay();
  }

  const fromX = (x) => {
    // the slider is exactly as wide as the illustration: the logo's centre tracks progress across it
    const r = track.getBoundingClientRect();
    return clamp01((x - r.left) / Math.max(1, r.width));
  };

  let grab = null; // keeps the Bot from jumping under the finger
  knob.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    takeOver();
    const r = knob.getBoundingClientRect();
    grab = e.clientX - (r.left + r.width / 2);
    knob.setPointerCapture?.(e.pointerId);
    hero.classList.add('rx-dragging');
  });
  knob.addEventListener('pointermove', (e) => { if (grab !== null) set(fromX(e.clientX - grab)); });
  const end = () => { grab = null; hero.classList.remove('rx-dragging'); };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  knob.addEventListener('lostpointercapture', end);

  // the Bot itself can be dragged too: horizontal movement maps onto its own path through the scene
  let botGrab = null;
  bot?.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    takeOver();
    botGrab = { x: e.clientX, p };
    bot.setPointerCapture?.(e.pointerId);
    hero.classList.add('rx-dragging');
  });
  bot?.addEventListener('pointermove', (e) => { if (botGrab) set(botGrab.p + (e.clientX - botGrab.x) / Math.max(1, travel())); });
  const botEnd = () => { botGrab = null; hero.classList.remove('rx-dragging'); };
  bot?.addEventListener('pointerup', botEnd);
  bot?.addEventListener('pointercancel', botEnd);
  bot?.addEventListener('lostpointercapture', botEnd);

  track.addEventListener('click', (e) => {
    if (knob.contains(e.target)) return;
    takeOver();
    const to = fromX(e.clientX);
    if (reduce) set(to); else tween(p, to, 420);
  });

  knob.addEventListener('keydown', (e) => {
    const steps = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 };
    let to = null;
    if (e.key in steps) to = p + steps[e.key];
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = 1;
    if (to === null) return;
    e.preventDefault();
    takeOver();
    set(to);
  });

  replay?.addEventListener('click', () => {
    if (reduce) { set(0); return; }
    hero.classList.remove('rx-touched');
    autoplay();
  });
}
