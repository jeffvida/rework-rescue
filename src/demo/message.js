// Hero demo (12 Nov 2026 expert review): "One message in. One checked job out."
// A scripted sample replay: a customer message, then what AI, a check, a person, an automation and the report do with it.
// - Runs entirely in the page. No AI or n8n call is made here; the caption says so.
// - The served HTML is the finished frame of the first sample, so the meaning is all there without JavaScript,
//   with reduced motion, and on phones. With motion allowed it plays once when it comes into view, then rests.
// - The chips swap the sample message. They are kinds of message any service business gets, not industries.
// - No inline styles (CSP): steps are shown by toggling classes.

export const SAMPLES = [
  { key: 'request', chip: 'New request',
    message: 'The tap in unit 4 is leaking again. Can someone come Friday?',
    ai: 'Reads it: leaking tap, unit 4, Friday',
    check: 'Customer not stated. Not guessed.',
    person: 'Ana confirms the customer',
    automation: 'Job logged, owner set, reminder booked',
    report: 'Counted once in this week’s report' },
  { key: 'change', chip: 'Change of plan',
    message: 'Can we move Thursday’s visit to Friday morning?',
    ai: 'Reads it: move a visit, Thursday to Friday morning',
    check: 'Two visits that Thursday. Not guessed.',
    person: 'Ana picks the right visit',
    automation: 'Schedule updated, team told, reminder moved',
    report: 'Still one job, with the new date' },
  { key: 'payment', chip: 'Payment question',
    message: 'Did you get our payment for last month’s invoice?',
    ai: 'Reads it: payment query, last month’s invoice',
    check: 'Amount paid doesn’t match the invoice. Flagged.',
    person: 'Ana checks before anyone replies',
    automation: 'Reply drafted for Ana to approve',
    report: 'Shown as one open query' },
];
export const STEPS = ['message', 'ai', 'check', 'person', 'automation', 'report'];
export const STEP_MS = 1300; // about 8 seconds for the six steps

export function mountMessageDemo(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = STEPS.map((k) => fig.querySelector(`[data-md="${k}"]`));
  const texts = Object.fromEntries(STEPS.map((k) => [k, fig.querySelector(`[data-md-t="${k}"]`)]));
  const chips = [...fig.querySelectorAll('[data-md-sample]')];
  const btn = fig.querySelector('.md-replay');
  if (parts.some((p) => !p)) return;
  let timer = 0; let at = STEPS.length; let paused = false;

  const label = () => { if (btn) btn.textContent = at >= STEPS.length ? 'Replay' : paused ? 'Play' : 'Pause'; };
  function tick() {
    clearTimeout(timer);
    if (paused || at >= STEPS.length) { label(); return; }
    parts[at].classList.add('is-on'); at += 1; label();
    timer = setTimeout(tick, STEP_MS);
  }
  function play() {
    if (reduce) return;
    clearTimeout(timer);
    fig.classList.add('md-anim');
    parts.forEach((p) => p.classList.remove('is-on'));
    at = 0; paused = false; label();
    timer = setTimeout(tick, 250);
  }
  function show(key) {
    const s = SAMPLES.find((x) => x.key === key) || SAMPLES[0];
    for (const k of STEPS) if (texts[k]) texts[k].textContent = s[k];
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.mdSample === s.key)));
  }
  chips.forEach((c) => c.addEventListener('click', () => { show(c.dataset.mdSample); play(); }));
  if (reduce) return;
  if (btn) {
    btn.hidden = false;
    btn.addEventListener('click', () => {
      if (at >= STEPS.length) { play(); return; }
      paused = !paused; if (paused) { clearTimeout(timer); label(); } else tick();
    });
  }
  if (typeof IntersectionObserver !== 'function') return;
  // Plays once, the first time at least half of it is on screen; after that it rests on the finished frame.
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); play(); }
  }, { threshold: 0.5 });
  io.observe(fig);
}
