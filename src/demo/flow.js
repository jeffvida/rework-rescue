// Hero flow, "lit workflow" (17 Nov 2026, Jeff): the live five-step list (labels from ChatGPT, 15 Nov), now driven
// by scrolling. A glowing line carries the request down the steps; each step lights up as the light reaches it, the
// flagged step glows gold, and the approval lands at the end.
//   1 Request arrives · 2 AI extracts the details · 3 Record updated · 4 Missing information flagged (the phone
//   number) · 5 A person reviews and approves (the reply asking for it).
// Desktop (wide and tall enough): the hero holds on screen for a short scroll while the light travels, then the page
// moves on. Phones, or screens too short to hold it: the light follows the visitor's scroll through the flow itself.
// Hover a step to spotlight it; click or tap a step to light the workflow up to it.
// The HTML is the finished picture (every step shown, the reply approved), so without JavaScript or with reduced
// motion, visitors see the end result and nothing is held. The line is an SVG overlay updated through attributes;
// everything else is class changes (CSP: no inline styles).

export const STEPS = 5;
export const ANCHOR = 0.5;             // phones: the light follows the middle of the screen
export const APPROVE_AT = STEPS - 1 + 0.45; // a little past step 5, the approval lands

const SVG = 'http://www.w3.org/2000/svg';

// Desktop hold: scrolled px into the hold → progress (0 … past APPROVE_AT).
export function progressFromHold(scrolled, track) {
  if (track <= 0) return APPROVE_AT;
  const t = Math.min(1, Math.max(0, scrolled / track));
  return t * (APPROVE_AT + 0.15);
}

// Phones: where the screen's anchor point sits between the first and last step dots.
export function progressFromAnchor(anchorY, firstY, lastY) {
  if (lastY <= firstY) return APPROVE_AT;
  const p = ((anchorY - firstY) / (lastY - firstY)) * (STEPS - 1);
  return Math.max(0, p + (anchorY > lastY ? (anchorY - lastY) / 60 : 0));
}

export function mountFlow(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const hero = fig.closest('.hero');
  const list = fig.querySelector('.rf-steps');
  const steps = [...fig.querySelectorAll('.rf-step')];
  const dots = steps.map((s) => s.querySelector('.rf-n'));
  const btn = fig.querySelector('.rf-replay');
  if (!hero || !list || steps.length !== STEPS || dots.some((d) => !d)) return;

  // ---- The light: a track, a lit line and a travelling pulse, drawn through the step dots.
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'rf-beam');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const track = document.createElementNS(SVG, 'line'); track.setAttribute('class', 'rf-beam-track');
  const lit = document.createElementNS(SVG, 'line'); lit.setAttribute('class', 'rf-beam-lit');
  const pulse = document.createElementNS(SVG, 'circle'); pulse.setAttribute('class', 'rf-beam-pulse'); pulse.setAttribute('r', '5');
  svg.append(track, lit, pulse);
  list.prepend(svg);
  fig.classList.add('rf-lit');
  if (btn) btn.hidden = true;

  let ys = []; let len = 0;
  function measure() {
    const box = list.getBoundingClientRect();
    ys = dots.map((d) => { const r = d.getBoundingClientRect(); return r.top + r.height / 2 - box.top; });
    const r0 = dots[0].getBoundingClientRect();
    const x = r0.left + r0.width / 2 - box.left;
    len = ys[STEPS - 1] - ys[0];
    svg.setAttribute('width', String(Math.ceil(box.width)));
    svg.setAttribute('height', String(Math.ceil(box.height)));
    for (const l of [track, lit]) { l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', ys[0]); l.setAttribute('y2', ys[STEPS - 1]); }
    lit.setAttribute('stroke-dasharray', `${len} ${len}`);
    pulse.setAttribute('cx', x);
  }

  // ---- Show progress p (0 = step 1 reached … 4 = step 5 reached; APPROVE_AT = approved).
  let shown = '';
  function render(p) {
    const cap = Math.min(p, STEPS - 1);
    const i = Math.floor(cap);
    const y = ys[i] + (i < STEPS - 1 ? (ys[i + 1] - ys[i]) * (cap - i) : 0);
    lit.setAttribute('stroke-dashoffset', String(len - (y - ys[0])));
    pulse.setAttribute('cy', y);
    const reached = Math.min(STEPS, Math.floor(p + 0.0001) + 1);
    const approved = p >= APPROVE_AT;
    const key = `${reached}${approved}`;
    if (key === shown) return;
    shown = key;
    steps.forEach((s, k) => { s.classList.toggle('is-on', k < reached); s.classList.toggle('is-now', k === reached - 1 && !approved); });
    fig.classList.toggle('is-approved', approved);
  }

  // ---- Desktop hold: the hero stays on screen for a short scroll while the light travels.
  const wide = typeof matchMedia === 'function' ? matchMedia('(min-width: 52.01rem)') : { matches: false };
  const header = document.querySelector('.site-header');
  let holding = false;
  function decideHold() {
    hero.classList.remove('rf-hold');
    const inner = hero.querySelector('.container');
    const room = window.innerHeight - (header ? header.offsetHeight : 0);
    holding = Boolean(wide.matches && inner && inner.offsetHeight + 24 <= room);
    hero.classList.toggle('rf-hold', holding);
  }

  let manual = null; // a clicked step holds until the visitor scrolls on
  let lastY = window.scrollY;
  function update() {
    if (manual !== null) { render(manual); return; }
    let p;
    if (holding) {
      const top = hero.getBoundingClientRect().top + window.scrollY;
      p = progressFromHold(window.scrollY - top, hero.offsetHeight - window.innerHeight);
    } else {
      const box = list.getBoundingClientRect();
      p = progressFromAnchor(window.innerHeight * ANCHOR, box.top + ys[0], box.top + ys[STEPS - 1]);
    }
    render(p);
  }

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  window.addEventListener('scroll', () => {
    if (manual !== null && Math.abs(window.scrollY - lastY) > 40) manual = null;
    if (manual === null) lastY = window.scrollY;
    schedule();
  }, { passive: true });
  const refresh = () => { decideHold(); measure(); shown = ''; schedule(); };
  window.addEventListener('resize', refresh);

  // ---- Hover spotlights a step; click / tap lights the workflow up to it.
  steps.forEach((s, k) => {
    s.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') s.classList.add('is-spot'); });
    s.addEventListener('pointerleave', () => s.classList.remove('is-spot'));
    s.addEventListener('click', () => {
      manual = k === STEPS - 1 ? APPROVE_AT : k;
      lastY = window.scrollY;
      shown = '';
      render(manual);
    });
  });

  fig.classList.add('rf-run');
  decideHold();
  measure();
  update();
  document.fonts?.ready.then(refresh); // fonts can shift the steps once they load
}
