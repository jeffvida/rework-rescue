// Service previews you can try: the routine runs on its own and the visitor makes the one step
// (run the checks, approve the AI-drafted reply, pick a time and book). Without JavaScript the finished
// picture shows and the controls stay hidden.

const RESULT = {
  data: () => 'Sample check complete: one duplicate was flagged before the report was finalized.',
  workflow: () => 'Sample complete: AI read the email and drafted the reply, but nothing was sent until you approved it. Then a follow-up was set.',
  systems: (t) => `Sample only, no real booking was made: Tuesday at ${t} now shows in the sample calendar and job sheet.`,
};

export function mountPreviews() {
  document.querySelectorAll('[data-pv-figure]').forEach(setup);
}

function setup(fig) {
  const kind = fig.dataset.pvFigure;
  const box = fig.querySelector('.pv-controls');
  if (!box || !RESULT[kind]) return;
  const go = box.querySelector('[data-pv-go]');
  const result = box.querySelector('.pv-result');
  const times = [...box.querySelectorAll('[data-pv-time]')];
  const timeWrap = box.querySelector('.pv-times');
  const tryLabel = box.querySelector('.pv-try');
  let picked = null;

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'pv-again';
  again.textContent = 'Try again';
  again.hidden = true;
  box.append(again);

  const chip = (t) => fig.querySelector(`[data-pv-chip="${t}"]`);
  // Data preview: once the duplicate is flagged, Booked counts down to the de-duplicated figure.
  const kpi = fig.querySelector('[data-pv-kpi]');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let kpiTimer = null;
  const countKpi = () => {
    if (!kpi) return;
    const from = Number(kpi.dataset.pvKpi); const to = Number(kpi.dataset.pvKpiTo);
    if (reduce || typeof requestAnimationFrame !== 'function') { kpi.textContent = String(to); return; }
    kpiTimer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / 500);
        kpi.textContent = String(Math.round(from + (to - from) * p));
        if (p < 1 && fig.classList.contains('pv-done')) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 1000);
  };

  const reset = () => {
    picked = null;
    clearTimeout(kpiTimer);
    if (kpi) kpi.textContent = kpi.dataset.pvKpi;
    fig.classList.remove('pv-done');
    fig.classList.add('pv-ready');
    result.textContent = '';
    again.hidden = true;
    go.hidden = false;
    if (tryLabel) tryLabel.hidden = false;
    if (timeWrap) timeWrap.hidden = false;
    times.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    fig.querySelectorAll('.pv-chip').forEach((c) => c.classList.remove('pv-pick'));
    if (kind === 'systems') go.disabled = true;
  };

  times.forEach((b) => b.addEventListener('click', () => {
    picked = b.dataset.pvTime;
    times.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fig.querySelectorAll('.pv-chip').forEach((c) => c.classList.toggle('pv-pick', c === chip(picked)));
    go.disabled = false;
  }));

  go.addEventListener('click', () => {
    if (kind === 'systems') {
      if (!picked) return;
      fig.querySelectorAll('.pv-chip').forEach((c) => c.classList.toggle('pv-on', c.dataset.pvChip === picked));
      fig.querySelectorAll('[data-pv-slot]').forEach((g) => g.classList.toggle('pv-on', g.dataset.pvSlot === picked));
      const t = fig.querySelector('[data-pv-newtime]');
      if (t) t.textContent = `Tue ${picked}`;
    }
    fig.classList.remove('pv-ready');
    void fig.getBoundingClientRect(); // restart the "done" animations on a second try
    fig.classList.add('pv-done');
    go.hidden = true;
    if (tryLabel) tryLabel.hidden = true;
    if (timeWrap) timeWrap.hidden = true;
    result.textContent = RESULT[kind](picked);
    countKpi();
    again.hidden = false;
    again.focus({ preventScroll: true });
  });

  again.addEventListener('click', () => {
    reset();
    (times[0] || go).focus({ preventScroll: true });
  });

  box.hidden = false;
  reset();
}
