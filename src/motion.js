// Homepage motion (8 Nov motion pass): smooth, responsive and purposeful.
// - Content fades up the first time it scrolls into view; related items (list rows, steps, cards) follow
//   one another in a short stagger. Nothing replays when the visitor scrolls back.
// - Experience: the "8+" counts up once. About: the photo is revealed, then the text follows.
// - The nav link for the section on screen is underlined.
// CSS only hides content once this script has added the "motion" class, so without JavaScript,
// or with reduced motion turned on, everything simply shows.

// Single elements that fade up on their own.
const REVEAL = [
  '.hero-copy > *',
  '#fit .fit-eyebrow', '#fit h2', '.pain-bridge',
  '#samples h2', '#samples .lede', '#samples .disclosure',
  '#services h2', '#services .svc-position', '#services .lede', '#services .svc-areas', '.svc-tabs', '.svc-foot', '.svc-choose',
  '.exp-head', '.exp-note',
  '#how h2', '.steps-h', '.steps-row', '.handover-h', '.handover-list', '.handover-note',
  '.about-section .photo-card', '.about-copy',
  '#faq h2',
  '.book-main', '.cta-contact',
];
// Groups whose children come in one after another.
const STAGGER = [
  ['.pain-tiles', 70],
  ['.exp-list', 70],
  ['.about-copy', 35],
  ['.faq-wrap', 30, '.faq-item'],
  ['.book-main', 50],
];

export function mountMotion() {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  mountActiveNav();
  if (reduce || typeof IntersectionObserver !== 'function') return;

  const els = [];
  const add = (el, delay = 0) => {
    if (els.includes(el)) return;
    el.classList.add('rv');
    if (delay) el.style.setProperty('--rv-delay', `${delay}ms`);
    els.push(el);
  };
  REVEAL.forEach((sel) => document.querySelectorAll(sel).forEach((el) => add(el)));
  STAGGER.forEach(([sel, step, childSel]) => document.querySelectorAll(sel).forEach((parent) => {
    const kids = childSel ? [...parent.querySelectorAll(childSel)] : [...parent.children];
    // A staggered group is revealed by its children, not as a block.
    if (els.includes(parent)) parent.classList.add('rv-group');
    kids.forEach((k, i) => add(k, Math.min(i, 7) * step));
  }));
  if (!els.length) return;
  document.documentElement.classList.add('motion');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
      if (e.target.classList.contains('exp-head')) countTo(e.target.querySelector('[data-count-to]'));
    });
  }, { rootMargin: '0px 0px -4% 0px' });
  els.forEach((el) => io.observe(el));

  // When printing, show everything that hasn't been scrolled to yet.
  window.addEventListener('beforeprint', () => els.forEach((el) => el.classList.add('is-in')));
}

/** Counts a number up from 0 once (the HTML already holds the final value). */
function countTo(el) {
  if (!el || typeof requestAnimationFrame !== 'function') return;
  const to = Number(el.dataset.countTo) || 0;
  const dur = 700;
  let t0 = null;
  el.textContent = '0';
  const tick = (t) => {
    if (t0 === null) t0 = t;
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = String(Math.round(to * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(tick);
    else el.closest('.exp-stat')?.classList.add('is-counted');
  };
  requestAnimationFrame(tick);
}

function mountActiveNav() {
  const header = document.querySelector('.site-header');
  if (!header || typeof IntersectionObserver !== 'function') return;
  const links = new Map([...header.querySelectorAll('.nav-list a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]));
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id); });
    const current = [...links.keys()].find((id) => visible.has(id));
    links.forEach((a, id) => a.classList.toggle('is-active', id === current));
  }, { rootMargin: '-40% 0px -55% 0px' });
  links.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}
