// Hero (19 Nov): Scattered work → A better way of working → Organised operations. One still scene; the only motion
// is light flowing along the connections and the AI / automation / human-review stops lighting in turn (CSS).
// This script only says when that may run: while the scene is on screen, never with reduced motion.
// The flow plays a few cycles each time the scene comes into view, then rests. Classes only (CSP-safe).
// Without JavaScript or IntersectionObserver the scene simply stays still.

export const LIVE_CLASS = 'is-live';

export function shouldPlay(onScreen, reduced) {
  return Boolean(onScreen) && !reduced;
}

export function mountZones(el) {
  if (!el || typeof IntersectionObserver !== 'function') return;
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let onScreen = false;
  const update = () => el.classList.toggle(LIVE_CLASS, shouldPlay(onScreen, mq && mq.matches));
  new IntersectionObserver((entries) => {
    entries.forEach((e) => { onScreen = e.isIntersecting; });
    update();
  }, { threshold: 0.2 }).observe(el);
  if (mq && typeof mq.addEventListener === 'function') mq.addEventListener('change', update);
}
