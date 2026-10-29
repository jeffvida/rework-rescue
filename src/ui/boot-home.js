import { mountWorkSample } from '../sample/ui.js';
import { mountBillsSample } from '../bills/ui.js';
import { mountMobileCta } from './mobile-cta.js';
import { mountBooking } from './booking.js';

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
