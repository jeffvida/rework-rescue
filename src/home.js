// Homepage: the live demo, the phone-only booking bar, the booking pop-up and the calendar at the bottom.

import { mountBooking } from './booking/popup.js';
import { mountDemo } from './demo/ui.js';
import { mountHero } from './demo/hero.js';
import { WEEK } from './demo/data.js';
import { mountAssistant } from './assistant/widget.js';
import { mountMotion } from './motion.js';
import { mountServices } from './services.js';
import { mountPreviews } from './previews.js';

// ---- Phone booking bar
// Phone-only bar with "Book a free rework review" and, when the assistant is on, "Ask" (CSS shows it on narrow screens only).
// It appears once the hero has scrolled out of view and hides again while the closing
// call-to-action section, the footer or any other booking button on the page is on screen,
// so it never doubles up with them.
// Without JavaScript or IntersectionObserver the bar simply stays hidden.

export function mountMobileCta() {
  const bar = document.getElementById('mobile-cta');
  const hero = document.querySelector('.hero');
  // Also hidden while the live example is on screen, so the bar never sits over its buttons.
  const end = [document.getElementById('start'), document.getElementById('samples'), document.querySelector('.site-footer'),
    ...document.querySelectorAll('main .btn[href*="contact-form-area"], main .btn[data-book]')].filter(Boolean);
  if (!bar || !hero || typeof IntersectionObserver !== 'function') return;

  bar.hidden = false;
  let heroVisible = true;
  const endVisible = new Set();
  const update = () => {
    const show = !heroVisible && endVisible.size === 0;
    bar.classList.toggle('is-shown', show);
    // Keep it out of the tab order and away from screen readers while it is off screen.
    bar.setAttribute('aria-hidden', String(!show));
    bar.querySelectorAll('a, button').forEach((c) => { c.tabIndex = show ? 0 : -1; });
  };

  new IntersectionObserver((entries) => {
    entries.forEach((e) => { heroVisible = e.isIntersecting; });
    update();
  }).observe(hero);

  const endObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) endVisible.add(e.target); else endVisible.delete(e.target); });
    update();
  });
  end.forEach((el) => endObserver.observe(el));
  update();
}

// ---- Start the homepage
const demo = mountDemo(document.getElementById('demo-app'));
mountMobileCta();
mountPreviews();
mountServices();
mountMotion();
mountBooking();
// The chat assistant (src/assistant/widget.js). Shows only when site-config.js has assistantUrl, or with ?assistant=preview.
mountAssistant();

// "Explore the live example" in the hero: go to the example (data-demo-tab opens a given tab).
document.querySelectorAll('[data-demo-check]').forEach((link) => link.addEventListener('click', (e) => {
  if (!demo) return;
  e.preventDefault();
  if (link.dataset.demoTab) demo.show(link.dataset.demoTab);
  const target = document.getElementById('samples');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#samples');
}));

// Hero card: the automated weekly report, sharing one review state with the live example (src/demo/hero.js).
mountHero(document.getElementById('hero-run'), demo);

// The sample week shown in the demo window's title bar comes from the demo data (WEEK in ./demo/data.js), like the figures.
document.querySelectorAll('[data-week]').forEach((el) => { el.textContent = WEEK; });

// The calendar at the bottom of the page. Times are only fetched once the visitor gets close to it,
// so a visit that never scrolls that far doesn't ask the booking service for anything.
const inlineHost = document.getElementById('book-inline');
if (inlineHost) {
  const inline = mountBooking({ inline: inlineHost });
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { inline.start(); io.disconnect(); }
    }, { rootMargin: '600px 0px' });
    io.observe(inlineHost);
  } else {
    inline.start();
  }
}

// Old links to the retired examples (#example-1, #example-2) land on the demo.
if (location.hash === '#example-1' || location.hash === '#example-2') {
  history.replaceState(null, '', `${location.pathname}${location.search}#samples`);
  requestAnimationFrame(() => document.getElementById('samples')?.scrollIntoView({ block: 'start' }));
}
