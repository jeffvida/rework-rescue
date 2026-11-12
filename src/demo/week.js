// Hero panel (12 Nov 2026, option 1 "The messy week, sorted"): three everyday messes, each one fixed.
// - A scripted sample replay. Runs entirely in the page: no AI or n8n call. The caption says it is a sample.
// - The served HTML is the finished frame (each mess crossed out, its fix shown), so the meaning is complete without
//   JavaScript, with reduced motion and on phones. With motion allowed it plays once when it comes into view:
//   the three messes show for about 2 seconds, then the fixes land one by one.
// - Fixed layout: the fixes keep their space while hidden, so the page never jumps.
// - No inline styles (CSP): everything is done with classes.

export const MESS_MS = 2000; // how long the mess shows before the first fix
export const FIX_MS = 900; // between fixes

export function mountWeek(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...fig.querySelectorAll('.mw-item')];
  const btn = fig.querySelector('.mw-replay');
  if (!items.length || reduce) return;
  let timers = [];
  function play() {
    timers.forEach(clearTimeout); timers = [];
    fig.classList.add('mw-anim');
    items.forEach((it) => it.classList.remove('is-fixed'));
    items.forEach((it, i) => timers.push(setTimeout(() => it.classList.add('is-fixed'), MESS_MS + i * FIX_MS)));
  }
  if (btn) { btn.hidden = false; btn.addEventListener('click', play); }
  if (typeof IntersectionObserver !== 'function') return;
  // Plays once, the first time at least half of it is on screen; after that it rests on the finished frame.
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); play(); }
  }, { threshold: 0.5 });
  io.observe(fig);
}
