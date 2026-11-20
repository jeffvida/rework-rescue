// Homepage: the hero illustration, the phone-only booking bar, the booking pop-up and the calendar at the bottom.

import { mountBooking } from './booking/popup.js';
import { mountFlow } from './demo/flow.js';
import { mountZones } from './hero-zones.js';
import { mountAssistant } from './assistant/widget.js';
import { mountMotion } from './motion.js';

// ---- Phone booking bar
// Phone-only bar with "Book a free process review" and, when the assistant is on, "Ask" (CSS shows it on narrow screens only).
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
const booking = mountBooking();
// 20 Nov 2026: the private change/cancel link from the invite and reminders (…/#booking=KEY). The key is taken out
// of the address straight away, so it isn't left in the browser history or shared by accident.
{
  const m = location.hash.match(/^#booking=([A-Za-z0-9]+)$/);
  if (m) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    booking.manage(m[1]);
  }
}
// The chat assistant (src/assistant/widget.js). Shows only when site-config.js has assistantUrl, or with ?assistant=preview.
mountAssistant();

// Hero (15 Nov): the five-step flow (src/demo/flow.js). The earlier Today / With panel was removed (ChatGPT + Jeff, 15 Nov);
// src/demo/hero.js stays for its tested figure helpers.
mountFlow(document.getElementById('hero-flow'));
// Hero (19 Nov): the three-zone scene; light flows along its connections only while it is on screen.
mountZones(document.getElementById('hero-story'));

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

// 17 Nov (Jeff + ChatGPT): the six tiles open into short example workflows, and the safety-net section plays its
// failure drill once when it comes on screen (src/tiles.js, src/demo/drill.js).
import { mountTiles } from './tiles.js';
import { mountDrill } from './demo/drill.js';
mountTiles(document.querySelector('#services .rr-tiles'));
mountDrill(document.getElementById('sn-drill'));

// 20 Nov (Jeff approved option A): previous-role examples open as a slide-in, three-step mini presentation.
import { mountCaseStudies } from './casestudy.js';
mountCaseStudies(document.querySelector('#built .rr-results'));
