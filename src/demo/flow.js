// Hero workspace (17 Nov 2026 visual round, "Clear Workbench"; labels from ChatGPT, 15 Nov): one fictional request,
// from inbox to a reviewed reply, in five steps shown as five panels in one window.
//   1 Request arrives · 2 AI extracts the details · 3 Record updated · 4 Missing information flagged (the phone number)
//   · 5 A person reviews and approves (the reply asking for it). Panels not reached yet stay dimmed, so the whole
//   story can be read at a glance.
// The HTML is the finished picture (every panel shown, the reply approved), so without JavaScript, with reduced
// motion, or before the hero is on screen, visitors see the end result. With motion allowed, the steps play once
// (about 6 seconds) when a fifth of the window is on screen, and the animation stops on the final frame.
// Tap or click the window to move one step on (no hover needed); after the end, a tap plays it again.
// A "Skip" button shows while it plays and "Replay" afterwards (WCAG 2.2.2), so keyboard users have the same
// control. CSP: classes only, no inline styles.

export const STEP_MS = 1000;     // gap between steps
export const APPROVE_MS = 1100;  // pause on step 5 before the approval lands
export const STEPS = 5;

export function mountFlow(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof IntersectionObserver !== 'function') return;
  const steps = [...fig.querySelectorAll('.rf-step')];
  const btn = fig.querySelector('.rf-replay');
  const stage = fig.querySelector('.rf-steps');
  let timers = [];
  let playing = false;
  let at = 0; // steps shown so far

  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const show = (n) => {
    at = n;
    steps.forEach((s, i) => { s.classList.toggle('is-on', i < n); s.classList.toggle('is-now', i === n - 1); });
  };

  function finish() {
    clear();
    playing = false;
    fig.classList.remove('rf-run', 'is-approved');
    steps.forEach((s) => s.classList.remove('is-on', 'is-now'));
    at = STEPS;
    if (btn) { btn.hidden = false; btn.textContent = 'Replay'; }
  }

  // Land the approval, hold the final frame briefly, then settle into the static finished picture.
  function approve() {
    fig.classList.add('is-approved');
    timers.push(setTimeout(finish, 900));
  }

  function play() {
    clear();
    playing = true;
    fig.classList.add('rf-run');
    fig.classList.remove('is-approved');
    show(0);
    if (btn) { btn.hidden = false; btn.textContent = 'Skip'; }
    for (let n = 1; n <= STEPS; n += 1) timers.push(setTimeout(() => show(n), 250 + (n - 1) * STEP_MS));
    timers.push(setTimeout(approve, 250 + (STEPS - 1) * STEP_MS + APPROVE_MS));
  }

  // Tap / click on the window: one step on while playing; play again once finished.
  function advance() {
    if (!playing) { play(); return; }
    clear();
    if (at < STEPS) {
      show(at + 1);
      if (at === STEPS) timers.push(setTimeout(approve, APPROVE_MS));
    } else if (!fig.classList.contains('is-approved')) {
      approve();
    } else {
      finish();
    }
  }

  btn?.addEventListener('click', (e) => { e.stopPropagation(); if (playing) finish(); else play(); });
  stage?.addEventListener('click', advance);
  stage?.classList.add('rw-tap');

  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (started || !entries.some((e) => e.isIntersecting)) return;
    started = true;
    io.disconnect();
    play();
  }, { threshold: 0.2 });
  io.observe(fig);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) finish(); });
}
