// Homepage: the tracker example, the phone-only booking bar, the booking pop-up and the calendar at the bottom.

import { mountBooking } from './booking/popup.js';
import { mountTracker } from './tracker/ui.js';
import { mountHero } from './demo/hero.js';
import { mountAssistant } from './assistant/widget.js';
import { mountMotion } from './motion.js';
import { mountServices } from './services.js';
import { mountSamples } from './samples.js';

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
// The main example: the Weekly Work & Follow-up Tracker (src/tracker/), with its downloadable workbook.
mountTracker(document.getElementById('tracker-app'));
mountMobileCta();
mountSamples();
mountServices();
mountMotion();
mountBooking();
// The chat assistant (src/assistant/widget.js). Shows only when site-config.js has assistantUrl, or with ?assistant=preview.
mountAssistant();

// "See how it works" in the hero: scroll to the example.
document.querySelectorAll('[data-demo-check]').forEach((link) => link.addEventListener('click', (e) => {
  e.preventDefault();
  const target = document.getElementById('samples');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#samples');
}));

// Hero: the connected workspace illustration, following the same state as the tracker (src/demo/hero.js).
mountHero(document.getElementById('hero-visual'));

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
