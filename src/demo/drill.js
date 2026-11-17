// Safety net section: the failure drill (17 Nov 2026, Jeff + ChatGPT). A scripted, fictional example of one failed
// step from first error to recovery: caught → checked before retrying (only retried because nothing was saved) →
// held for review → the named person alerted with what to do → restarted by a person → logged.
// The HTML is the finished picture, so without JavaScript or with reduced motion every row shows at once.
// With motion allowed, the rows appear one after another the first time the drill is on screen; then
// "Play the example" replays it. CSP: classes only.

export const ROW_MS = 750;

export function mountDrill(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof IntersectionObserver !== 'function') return;
  const rows = [...fig.querySelectorAll('.sn-row')];
  const btn = fig.querySelector('.sn-play');
  let timers = [];

  function play() {
    timers.forEach(clearTimeout); timers = [];
    fig.classList.add('is-running');
    rows.forEach((r) => r.classList.remove('is-on'));
    if (btn) btn.hidden = true;
    rows.forEach((r, i) => timers.push(setTimeout(() => r.classList.add('is-on'), 200 + i * ROW_MS)));
    timers.push(setTimeout(() => {
      fig.classList.remove('is-running');
      if (btn) { btn.hidden = false; btn.textContent = 'Play the example again'; }
    }, 200 + rows.length * ROW_MS + 300));
  }

  btn?.addEventListener('click', play);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    play();
  }, { threshold: 0.35 });
  io.observe(fig);
}
