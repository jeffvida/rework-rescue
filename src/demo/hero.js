// Hero: an illustration of scattered information becoming one connected workspace (master brief, 10 Nov 2026).
// Three sources (spreadsheet files, business records, requests and tasks) flow into a workspace with organised
// records, a report, a workflow, actions and an AI-drafted insight. The figures come from the main demo's engine and
// follow the same state, so what the visitor does in the demo shows here too. It is an illustration of a possible
// solution, not a product. Motion: one ~4.6 s CSS timeline (.hw-play), played once on screen, with Replay; reduced
// motion and no JavaScript show the finished picture. CSP: no inline style attributes.

import { getState, subscribe } from './store.js';
import { overview, board, metrics } from './engine.js';

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const set = (k, v) => fig.querySelectorAll(`[data-hw="${k}"]`).forEach((el) => { el.textContent = String(v); });

  function paint() {
    const s = getState(); const o = overview(s); const m = metrics(s);
    for (const k of ['records', 'requests', 'openRequests', 'completed', 'attention']) set(k, o[k]);
    for (const col of board(s)) { const el = fig.querySelector(`[data-hw-stage="${col.stage}"]`); if (el) el.textContent = String(col.items.length); }
    const max = Math.max(2, ...m.byDay.map((d) => d.completed));
    for (const d of m.byDay) {
      const el = fig.querySelector(`[data-hw-day="${d.day}"]`); if (!el) continue;
      el.dataset.v = String(d.completed);
      el.querySelector('i').style.setProperty('height', `${Math.round((d.completed / max) * 100)}%`);
    }
  }
  subscribe(() => paint());
  paint();

  if (reduce || typeof IntersectionObserver !== 'function') return;
  const replay = fig.querySelector('.hw-replay');
  const play = () => { fig.classList.remove('hw-play'); void fig.offsetWidth; fig.classList.add('hw-play'); };
  fig.classList.add('hw-wait');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting)) return;
    io.disconnect();
    fig.classList.remove('hw-wait'); play();
    if (replay) replay.hidden = false;
  }, { threshold: 0.25 });
  io.observe(fig);
  replay?.addEventListener('click', play);
}
