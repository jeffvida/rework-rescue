// Homepage: the live demo, the phone-only booking bar, the booking pop-up and the calendar at the bottom.

import { mountBooking } from './booking/popup.js';
import { mountDemo } from './demo/ui.js';

// ---- Phone booking bar
// Phone-only "Book a free rework review" bar (CSS shows it on narrow screens only).
// It appears once the hero has scrolled out of view and hides again while the closing
// call-to-action section, the footer or any other booking button on the page is on screen,
// so it never doubles up with them.
// Without JavaScript or IntersectionObserver the bar simply stays hidden.

export function mountMobileCta() {
  const bar = document.getElementById('mobile-cta');
  const hero = document.querySelector('.hero');
  const end = [document.getElementById('start'), document.querySelector('.site-footer'),
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
    bar.querySelector('a').tabIndex = show ? 0 : -1;
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
mountBooking();

// "Check it" in the hero: go to the demo and run the checks there.
document.querySelectorAll('[data-demo-check]').forEach((link) => link.addEventListener('click', (e) => {
  if (!demo) return;
  e.preventDefault();
  const target = document.getElementById('samples');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (demo.phase === 'ready') setTimeout(() => demo.check(), reduce ? 0 : 750);
}));

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
