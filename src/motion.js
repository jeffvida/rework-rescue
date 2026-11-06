// Homepage motion: content fades up gently the first time it scrolls into view, and the nav link
// for the section on screen is underlined. CSS only hides content once this script has added
// the "motion" class, so without JavaScript, or with reduced motion turned on, everything simply shows.

const REVEAL = [
  '.hero-copy > *',
  '#fit h2', '.pain-tiles > li', '.pain-bridge',
  '#samples h2', '#samples .lede', '#samples .disclosure',
  '#services h2', '#services .lede', '.svc-ui', '.svc-foot',
  '.about-grid > *', '.steps-row', '.handover-h', '.handover-list',
  '#faq h2', '.faq-item',
  '.book-main', '.cta-contact',
];

export function mountMotion() {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  mountActiveNav();
  if (reduce || typeof IntersectionObserver !== 'function') return;

  const els = [];
  REVEAL.forEach((sel) => document.querySelectorAll(sel).forEach((el) => { if (!els.includes(el)) els.push(el); }));
  if (!els.length) return;

  // Items that share a parent come in one after another (at most 5 steps of 70 ms).
  const seen = new Map();
  els.forEach((el) => {
    const n = seen.get(el.parentElement) || 0;
    seen.set(el.parentElement, n + 1);
    el.classList.add('rv');
    el.style.setProperty('--rv-delay', `${Math.min(n, 5) * 70}ms`);
  });
  document.documentElement.classList.add('motion');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));

  // When printing, show everything that hasn't been scrolled to yet.
  window.addEventListener('beforeprint', () => els.forEach((el) => el.classList.add('is-in')));
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
