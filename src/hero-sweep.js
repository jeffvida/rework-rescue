// Hero transformation (17 Nov 2026). The sweep itself is pure CSS (--p animated on .rx, see styles.css), so it runs
// and ends on the organised state without this file. This file only:
//  1. measures where the Rework Rescue mark is under the illustration's left and right edges (--s0, --s1), so the
//     reveal edge follows the mark exactly at every screen size;
//  2. on phones (illustration below the fold), holds the sweep until the illustration is on screen;
//  3. shows a "Replay the transformation" button once it has played.
// CSP: CSSOM setProperty and classes only.

export function mountSweep(hero) {
  if (!hero) return;
  const stage = hero.querySelector('.rx-stage');
  const track = hero.querySelector('.rx-track');
  const runner = hero.querySelector('.rx-runner');
  const btn = hero.querySelector('.rx-replay');
  if (!stage || !track || !runner) return;

  const measure = () => {
    const t = track.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const r = runner.offsetWidth;
    const span = t.width - r;
    if (span <= 0) return;
    const at = (x) => Math.min(1, Math.max(0, (x - t.left - r / 2) / span));
    let s0 = at(s.left);
    let s1 = at(s.right);
    if (s1 - s0 < 0.2) { s0 = 0.05; s1 = 0.95; }
    hero.style.setProperty('--s0', s0.toFixed(3));
    hero.style.setProperty('--s1', s1.toFixed(3));
  };
  measure();
  addEventListener('resize', measure, { passive: true });

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  if (typeof IntersectionObserver === 'function') {
    const r = stage.getBoundingClientRect();
    if (r.top > innerHeight * 0.75) {
      hero.classList.add('rx-wait');
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { hero.classList.remove('rx-wait'); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(stage);
    }
  }

  hero.addEventListener('animationend', (e) => { if (e.target === hero && btn) btn.hidden = false; });
  btn?.addEventListener('click', () => {
    btn.hidden = true;
    hero.classList.toggle('rx-again'); // switching between two identical keyframe names restarts the sweep
  });
}
