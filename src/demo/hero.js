// Hero visual (approved spec, 10 Nov 2026): three source files become one weekly report. The checks flag four items
// (Tuesday in gold), an AI-drafted note gives a possible cause, a line traces it back to row S-1051 in the sales log, and
// the report stops at "Awaiting your review · 4 items" with one action: Review the 4 items.
// No publishing, approval or release in the hero. It shares one state with the live example (./store.js): decisions
// made there update the status, the count, the chart and the finding marks here, and after the visitor releases the
// report in Summary the status reads "Released by you" (the report itself stays in Summary).
// Motion: one ~5 s CSS timeline, started once when the visual is on screen, with Replay. Reduced motion and no
// JavaScript show the final frame. CSP: no inline style attributes; geometry is set with SVG setAttribute only.

import { getState, subscribe } from './store.js';
import { heroCard, heroSummary, findings, ACCEPTED } from './engine.js';

const STATUS_TEXT = (status, left) => ({
  'Awaiting review': `Awaiting your review · ${left} ${left === 1 ? 'item' : 'items'}`,
  'Under review': `Under review · ${left} left`,
}[status] || status);
const STATE = { 'Released by you': 'done', 'Signed off': 'ready', 'Ready for sign-off': 'ready', 'Changed since release': 'changed' };
const MARK = { open: 'To review', recalculated: 'Recalculated · check it', stale: 'Look again', unresolved: 'Unresolved', resolved: 'Validated', legitimate: 'Validated' };

export function mountHero(card, demo) {
  if (!card) return;
  const fig = card.closest('.hx');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (k) => card.querySelector(`[data-hr="${k}"]`);
  const svg = card.querySelector('.hr-chart');
  const MAX = Number(svg.dataset.max); const BASE = Number(svg.dataset.base); const H = Number(svg.dataset.h);
  const y = (v) => Math.round((BASE - (v / MAX) * H) * 10) / 10;

  const h0 = heroSummary();
  card.querySelectorAll('[data-hero]').forEach((el) => { const v = h0[el.dataset.hero]; if (v !== undefined) el.textContent = String(v); });

  const goTo = (tab, issue) => {
    if (!demo) return false;
    demo.show(tab, issue);
    document.getElementById('samples')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { const p = document.querySelector('#samples [role="tabpanel"]:not([hidden])'); (p?.querySelector('.dt-detail') || p)?.focus({ preventScroll: true }); }, reduce ? 0 : 500);
    return true;
  };

  function paint() {
    const s = getState(); const c = heroCard(s); const fs = findings(s);
    const st = q('status');
    st.textContent = STATUS_TEXT(c.status, c.toReview);
    st.dataset.state = STATE[c.status] || 'review';
    q('salesTotal').textContent = c.salesTotal;
    q('salesNote').textContent = c.salesNote;
    q('salesNote').classList.toggle('is-checked', c.salesNote === 'checked');
    const go = q('review');
    go.textContent = c.toReview ? `Review the ${c.toReview} ${c.toReview === 1 ? 'item' : 'items'}` : (s.released ? 'See the released report' : 'Go to sign-off');
    for (const f of fs) {
      const li = card.querySelector(`[data-hx-f="${f.issue}"]`); if (!li) continue;
      li.dataset.state = ACCEPTED.includes(f.status) ? 'done' : f.status;
      li.querySelector('.hx-f-st').textContent = MARK[f.status];
    }

    // The chart: same scale as the static picture, so a corrected Tuesday visibly drops back.
    for (const d of c.daily) {
      const g = svg.querySelector(`[data-day="${d.day}"]`); if (!g) continue;
      const bar = g.querySelector('.hr-bar'); const top = y(d.total);
      bar.setAttribute('y', String(top)); bar.setAttribute('height', String(Math.round((BASE - top) * 10) / 10));
      const avg = g.querySelector('.hr-avg'); avg.setAttribute('y1', String(y(d.avg))); avg.setAttribute('y2', String(y(d.avg)));
      g.classList.toggle('is-flag', d.flagged);
    }
    q('tueTotal').textContent = c.tuesday.total; q('tueChange').textContent = c.tuesday.change;
    q('callout').classList.toggle('is-normal', !c.tuesday.flagged);
    q('callout').querySelector('text').lastChild.textContent = c.tuesday.flagged ? ' vs usual' : ' · within range';
    q('chartLabel').textContent = `Daily sales this week against the 4-week average. Tuesday, ${c.tuesday.total}, is ${c.tuesday.change} against its usual level${c.tuesday.flagged ? ', outside the demonstration ±40% range' : ''}.`;
  }

  q('review').addEventListener('click', (e) => {
    const first = findings(getState()).find((f) => !ACCEPTED.includes(f.status));
    if (goTo(first ? 'findings' : 'summary', first?.issue)) e.preventDefault();
  });
  subscribe(() => paint());
  paint();

  if (!fig) return;

  // The trace line: from the source chip in the report back to row S-1051 in the sales log (or the file itself when the
  // rows are hidden on phones). It runs in the gutter left of the card, so it never crosses the card's content.
  const line = fig.querySelector('.hx-line'); const path = line?.querySelector('path');
  function drawTrace() {
    if (!line || !path) return;
    const chip = fig.querySelector('.hx-chip'); const row = fig.querySelector('.hx-target');
    const target = row && row.offsetParent ? row : fig.querySelector('.hx-file-sales');
    if (!chip || !target) return;
    // Layout positions (offsetLeft/Top), not getBoundingClientRect: they ignore the animation's transforms, so the line
    // lands on the right row even if it is redrawn mid-animation (a font load or a resize).
    const pos = (el) => { let x = 0; let yy = 0; let e = el; while (e && e !== fig) { x += e.offsetLeft; yy += e.offsetTop; e = e.offsetParent; } return { x, y: yy, w: el.offsetWidth, h: el.offsetHeight }; };
    const f = { width: fig.offsetWidth, height: fig.offsetHeight };
    const a = pos(chip); const b = pos(target);
    const gx = Math.max(2, Math.min(pos(card).x, pos(fig.querySelector('.hx-files')).x) - 12);
    const x0 = a.x; const y0 = a.y + a.h / 2;
    const x1 = b.x; const y1 = b.y + b.h / 2;
    const r = 8;
    line.setAttribute('width', String(Math.ceil(f.width))); line.setAttribute('height', String(Math.ceil(f.height)));
    line.setAttribute('viewBox', `0 0 ${Math.ceil(f.width)} ${Math.ceil(f.height)}`);
    path.setAttribute('d', `M${x0} ${y0}H${gx + r}Q${gx} ${y0} ${gx} ${y0 - r}V${y1 + r}Q${gx} ${y1} ${gx + r} ${y1}H${x1 - 2}`);
  }
  drawTrace();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => drawTrace()).observe(fig);
  document.fonts?.ready?.then(drawTrace);

  // The 5-second timeline lives in CSS (.hx-play); this only starts it once, on screen, and replays it.
  if (reduce || typeof IntersectionObserver !== 'function') return;
  const replay = fig.querySelector('.hx-replay');
  const play = () => { fig.classList.remove('hx-play'); void fig.offsetWidth; drawTrace(); fig.classList.add('hx-play'); };
  fig.classList.add('hx-wait');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting)) return;
    io.disconnect();
    fig.classList.remove('hx-wait'); play();
    if (replay) replay.hidden = false;
  }, { threshold: 0.3 });
  io.observe(fig);
  replay?.addEventListener('click', play);
}
