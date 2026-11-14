// Homepage: the hero illustration, the phone-only booking bar, the booking pop-up and the calendar at the bottom.

import { mountBooking } from './booking/popup.js';
import { mountFlow } from './demo/flow.js';
import { mountAssistant } from './assistant/widget.js';
import { mountMotion } from './motion.js';

// ---- Phone booking bar
// Phone-only bar with "Book a free review" and, when the assistant is on, "Ask" (CSS shows it on narrow screens only).
// It appears once the hero's own buttons have scrolled out of view (not the whole hero, so phones aren't left
// without a booking button while the hero demo is on screen; 11 Nov panel review) and hides again while the closing
// call-to-action section, the footer or any other booking button on the page is on screen,
// so it never doubles up with them.
// Without JavaScript or IntersectionObserver the bar simply stays hidden.

export function mountMobileCta() {
  const bar = document.getElementById('mobile-cta');
  const hero = document.querySelector('.hero .hv-actions') || document.querySelector('.hero');
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
mountMobileCta();
mountMotion();
mountBooking();
// The chat assistant (src/assistant/widget.js). Shows only when site-config.js has assistantUrl, or with ?assistant=preview.
mountAssistant();

// Hero (15 Nov): the five-step flow (src/demo/flow.js). The earlier Today / With panel was removed (ChatGPT + Jeff, 15 Nov);
// src/demo/hero.js stays for its tested figure helpers.
mountFlow(document.getElementById('hero-flow'));

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

// Old links to the retired examples (#example-1, #example-2) land on the proof strip in How I can help (#samples anchor).
if (location.hash === '#example-1' || location.hash === '#example-2') {
  history.replaceState(null, '', `${location.pathname}${location.search}#samples`);
  requestAnimationFrame(() => document.getElementById('samples')?.scrollIntoView({ block: 'start' }));
}
