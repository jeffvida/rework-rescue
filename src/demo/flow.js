// Hero flow (15 Nov 2026): one fictional email, from inbox to an approved tracker record, in five steps.
//   1 Email arrives · 2 AI reads it · 3 Tracker updated · 4 Check catches a problem · 5 A person approves.
// The HTML is the finished picture (every step shown, the record approved), so without JavaScript, with reduced
// motion, or before the hero is on screen, visitors see the end result. With motion allowed, the steps play once
// (about 8 seconds) the first time the hero is on screen, on phones too, and the animation stops on the final frame.
// A "Skip" button shows while it plays and "Replay" afterwards (WCAG 2.2.2). CSP: classes only, no inline styles.

export const STEP_MS = 1300;     // gap between steps
export const APPROVE_MS = 1500;  // pause on step 5 before the approval lands
export const STEPS = 5;

export function mountFlow(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof IntersectionObserver !== 'function') return;
  const steps = [...fig.querySelectorAll('.rf-step')];
  const btn = fig.querySelector('.rf-replay');
  let timers = [];
  let playing = false;

  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const show = (n) => steps.forEach((s, i) => { s.classList.toggle('is-on', i < n); s.classList.toggle('is-now', i === n - 1); });

  function finish() {
    clear();
    playing = false;
    fig.classList.remove('rf-run', 'is-approved');
    steps.forEach((s) => s.classList.remove('is-on', 'is-now'));
    if (btn) { btn.hidden = false; btn.textContent = 'Replay'; }
  }

  function play() {
    clear();
    playing = true;
    fig.classList.add('rf-run');
    fig.classList.remove('is-approved');
    show(0);
    if (btn) { btn.hidden = false; btn.textContent = 'Skip'; }
    for (let n = 1; n <= STEPS; n += 1) timers.push(setTimeout(() => show(n), 250 + (n - 1) * STEP_MS));
    const approveAt = 250 + (STEPS - 1) * STEP_MS + APPROVE_MS;
    timers.push(setTimeout(() => fig.classList.add('is-approved'), approveAt));
    timers.push(setTimeout(finish, approveAt + 900));
  }

  btn?.addEventListener('click', () => (playing ? finish() : play()));

  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (started || !entries.some((e) => e.isIntersecting)) return;
    started = true;
    io.disconnect();
    play();
  }, { threshold: 0.4 });
  io.observe(fig);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) finish(); });
}
