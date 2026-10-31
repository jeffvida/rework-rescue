// Homepage: the two interactive examples, the phone-only booking bar and the booking pop-up.

import { mountBillsSample } from './bills/ui.js';
import { mountBooking } from './booking/popup.js';
import { mountWorkSample } from './sample/ui.js';

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
const a = document.getElementById('work-sample');
const b = document.getElementById('bills-sample');
if (a) mountWorkSample(a);
if (b) mountBillsSample(b);
mountMobileCta();
mountBooking();

// Two examples, one switch. Each keeps its own progress while hidden.
// Links to #example-1 or #example-2 (hero card, assessment results) open that example directly.
const picks = [...document.querySelectorAll('[data-sample-pick]')];
const blocks = { a: document.getElementById('example-1'), b: document.getElementById('example-2') };

function choose(key) {
  if (!blocks[key]) return;
  picks.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.samplePick === key)));
  Object.entries(blocks).forEach(([k, el]) => { if (el) el.hidden = k !== key; });
}

picks.forEach((btn) => btn.addEventListener('click', () => choose(btn.dataset.samplePick)));

function fromHash() {
  const key = { '#example-1': 'a', '#example-2': 'b' }[location.hash];
  if (!key) return;
  choose(key);
  const target = document.getElementById('samples');
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
window.addEventListener('hashchange', fromHash);
fromHash();
