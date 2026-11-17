// Hero slider (17 Nov 2026, round 4): the Rework Rescue logo is the handle. Its position sets one value, --p, on
// the hero (0 = the mess, 1 = organised); everything in the scene is a CSS function of --p (assets/styles.css,
// "drag the logo"). The visitor stays in control: nothing moves on its own except a small one-off nudge of the
// handle as a hint.
//   Pointer: drag the logo (mouse, pen, touch). The handle has touch-action: none so dragging it never scrolls the
//            page; the rest of the line keeps vertical scrolling (pan-y). Tap or click the line to glide there.
//   Keyboard: ← → (5%), PageUp/PageDown (20%), Home/End. role="slider" with aria-valuenow / aria-valuetext.
//   Reduced motion: no nudge; a tap on the line jumps instead of gliding.
// Without JavaScript the slider stays hidden and the organised state shows. CSP: CSSOM setProperty and classes.

const STAGES = [
  [0.15, 'Scattered work: emails, spreadsheets and forms everywhere'],
  [0.4, 'Information coming together'],
  [0.6, 'Duplicate found and missing phone number flagged'],
  [0.9, 'Owners and next steps assigned'],
  [1.01, 'Organised, with one item for a person to review'],
];
export const describe = (p) => STAGES.find(([max]) => p < max)[1];
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function mountSlider(hero) {
  if (!hero) return;
  const track = hero.querySelector('.rx-track');
  const knob = hero.querySelector('.rx-runner');
  const reset = hero.querySelector('.rx-reset');
  if (!track || !knob) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let p = 0;
  let frame = 0;
  let glide = 0;
  const paint = () => {
    frame = 0;
    hero.style.setProperty('--p', p.toFixed(4));
    knob.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    knob.setAttribute('aria-valuetext', describe(p));
    if (reset) reset.hidden = p < 0.98;
  };
  const set = (v) => { p = clamp01(v); if (!frame) frame = requestAnimationFrame(paint); };
  const touched = () => hero.classList.add('rx-touched');

  hero.classList.add('rx-js');
  p = 0; paint();

  const fromX = (x) => {
    const r = track.getBoundingClientRect();
    const k = knob.offsetWidth;
    return clamp01((x - r.left - k / 2) / Math.max(1, r.width - k));
  };
  const glideTo = (to) => {
    cancelAnimationFrame(glide);
    if (reduce) { set(to); return; }
    const from = p; const t0 = performance.now(); const ms = 380;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      set(from + (to - from) * e);
      if (k < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };

  let grab = null; // offset between the pointer and the handle centre, so the logo doesn't jump under the finger
  knob.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    cancelAnimationFrame(glide);
    touched();
    const r = knob.getBoundingClientRect();
    grab = e.clientX - (r.left + r.width / 2);
    knob.setPointerCapture?.(e.pointerId);
    hero.classList.add('rx-dragging');
  });
  knob.addEventListener('pointermove', (e) => { if (grab !== null) set(fromX(e.clientX - grab)); });
  const end = () => { grab = null; hero.classList.remove('rx-dragging'); };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  knob.addEventListener('lostpointercapture', end);

  track.addEventListener('click', (e) => {
    if (knob.contains(e.target)) return;
    touched();
    glideTo(fromX(e.clientX));
  });

  knob.addEventListener('keydown', (e) => {
    const steps = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 };
    let to = null;
    if (e.key in steps) to = p + steps[e.key];
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = 1;
    if (to === null) return;
    e.preventDefault();
    touched();
    cancelAnimationFrame(glide);
    set(to);
  });

  reset?.addEventListener('click', () => { touched(); glideTo(0); knob.focus({ preventScroll: true }); });
}
