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
  '#services h2', '.rr-diff h2', '.rr-approach', '.rr-standards', '#built h2', '.built-cards', '.rr-tools', '.rr-results-h',
  '#how h2', '.steps-h', '.how-approach', '.steps-row', '.handover-h', '.handover-list', '.handover-note',
  '.about-section .photo-card', '.about-copy',
  '#faq h2',
  '.book-main',
];
// Groups whose children come in one after another.
const STAGGER = [
  ['.rr-tiles', 70],
  ['.rr-results', 90],
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
    });
  }, { rootMargin: '0px 0px -4% 0px' });
  els.forEach((el) => io.observe(el));

  // When printing, show everything that hasn't been scrolled to yet.
  window.addEventListener('beforeprint', () => els.forEach((el) => el.classList.add('is-in')));

  // 15 Nov visual round: the result numbers (1,000+ / ~10 / 10 / 2-3 hours) count up once when
  // they scroll into view. Text only, no styles; skipped entirely with reduced motion (early
  // return above) or without JavaScript, where the final numbers are already in the HTML.
  const nums = [...document.querySelectorAll('.rr-nums strong')];
  if (nums.length) {
    const nio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        countUp(e.target);
        nio.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    nums.forEach((el) => nio.observe(el));
  }
}

// Count the first number in the element up from 0, keeping any prefix (~), separators (1,000)
// and suffix (+, "-3 hours") exactly as written. The final frame is the original text.
function countUp(el) {
  const text = el.textContent;
  const m = text.match(/^([^0-9]*)([\d,]+)([\s\S]*)$/);
  if (!m) return;
  const target = parseInt(m[2].replace(/,/g, ''), 10);
  if (!Number.isFinite(target) || target <= 0) return;
  const grouped = m[2].includes(',');
  const dur = 800;
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - (1 - p) * (1 - p);
    const n = Math.round(target * eased);
    el.textContent = p < 1 ? m[1] + (grouped ? n.toLocaleString('en-US') : String(n)) + m[3] : text;
    if (p < 1) requestAnimationFrame(tick);
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
