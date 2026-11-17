// "Checks and control, built in" section: the failure drill (Jeff + ChatGPT, 17 Nov 2026). Optional proof, closed by
// default behind "See what happens when a step fails". A scripted, fictional example: an outside tool (Google Sheets)
// stops responding → caught → checked before retrying (only retried because nothing was saved) → held for review →
// the named person told what to do → the tool is back, a person restarts the run → processed, checked and logged.
// Without JavaScript the <details> still opens and shows every row. With motion allowed, the rows appear one after
// another each time it's opened; with reduced motion they all show at once. CSP: classes only.

export const ROW_MS = 700;

export function mountDrill(fig) {
  if (!fig) return;
  const box = fig.closest('details');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = [...fig.querySelectorAll('.sn-row')];
  const btn = fig.querySelector('.sn-play');
  if (!box || reduce) return;
  let timers = [];

  function play() {
    timers.forEach(clearTimeout); timers = [];
    fig.classList.add('is-running');
    rows.forEach((r) => r.classList.remove('is-on'));
    if (btn) btn.hidden = true;
    rows.forEach((r, i) => timers.push(setTimeout(() => r.classList.add('is-on'), 150 + i * ROW_MS)));
    timers.push(setTimeout(() => {
      fig.classList.remove('is-running');
      if (btn) btn.hidden = false;
    }, 150 + rows.length * ROW_MS + 300));
  }

  box.addEventListener('toggle', () => { if (box.open) play(); else { timers.forEach(clearTimeout); fig.classList.remove('is-running'); } });
  btn?.addEventListener('click', play);
}
