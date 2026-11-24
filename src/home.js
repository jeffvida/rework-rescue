// Homepage: the hero illustration, the phone-only booking bar, the booking pop-up and the calendar at the bottom.

import { mountBooking } from './booking/popup.js';
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

// ---- Hero moving background (24 Nov v12; 13:05 only the dotted wave kept): pause the drifting wave while the hero
// is off screen. Reduced motion is handled in CSS (no drift). Decorative only; without JavaScript it simply runs.
export function mountBackdrop() {
  const hero = document.querySelector('.h5');
  if (!hero || typeof IntersectionObserver !== 'function') return;
  new IntersectionObserver((entries) => { entries.forEach((e) => hero.classList.toggle('h5-off', !e.isIntersecting)); }).observe(hero);
}

mountMobileCta();
mountMotion();
mountBackdrop();
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

// 23 Nov: the Dana Cruz five-step example (src/demo/flow.js) was removed from How I help; it repeated demo ①.
// Hero (24 Nov): the Before → After picture animates once on load in CSS; no script needed.

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

// 21 Nov 2026 (build #1): the enquiry tracker demo in Demos & examples (src/enquiry-demo.js).
import { mountEnquiryDemo } from './enquiry-demo.js';
mountEnquiryDemo(document.getElementById('enquiry-demo'));
// 21 Nov 2026 (build #2): the self-checking weekly report demo, a replay with fictional data (src/report-demo.js).
import { mountReportDemo } from './report-demo.js';
mountReportDemo(document.getElementById('report-demo'));
// 24 Nov 2026 (preview): the CoolFix steps are now static (before / after / what improved, with pictures): no script needed.
// 25 Nov 2026 (preview): sample projects in one sideways row; each opens a pop-up (src/sample-rail.js).
import { mountSampleRail } from './sample-rail.js';
mountSampleRail();
