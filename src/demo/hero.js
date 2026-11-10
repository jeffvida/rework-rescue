// Hero card: a live preview of the weekly report. Status, items to review, three figures, the daily sales chart
// (this week against the 4-week average, Tuesday highlighted) and one action: Review flagged items.
// It shares one state with the live example (./store.js): a decision made there redraws this card (exclude the
// duplicate and Tuesday drops back into its usual range). Sign-off and release happen only in the example's Summary;
// the hero shows the status ("Released by you") but never the released report.
// Nothing is sent or changed. Without JavaScript the static HTML shows the same figures with a link to the example.

import { getState, subscribe } from './store.js';
import { heroCard, heroSummary, findings, ACCEPTED } from './engine.js';

export function mountHero(card, demo) {
  if (!card) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (k) => card.querySelector(`[data-hr="${k}"]`);
  const svg = card.querySelector('.hr-chart');
  const MAX = Number(svg.dataset.max); const BASE = Number(svg.dataset.base); const H = Number(svg.dataset.h);
  const y = (v) => Math.round((BASE - (v / MAX) * H) * 10) / 10;

  const h0 = heroSummary();
  card.querySelectorAll('[data-hero]').forEach((el) => { const v = h0[el.dataset.hero]; if (v !== undefined) el.textContent = String(v); });

  const goTo = (tab, issue) => {
    if (!demo) return;
    demo.show(tab, issue);
    document.getElementById('samples')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  function paint() {
    const s = getState(); const c = heroCard(s);
    const st = q('status'); st.textContent = c.status;
    st.dataset.state = s.released ? 'published' : (c.toReview ? 'review' : 'ready');
    q('toReview').textContent = String(c.toReview);
    q('toReviewLabel').textContent = c.toReview === 1 ? 'item to review' : c.toReview ? 'items to review' : 'All findings validated';
    if (!c.toReview) q('toReview').textContent = '✓';
    card.querySelector('.hr-review').classList.toggle('is-clear', !c.toReview);
    q('salesTotal').textContent = c.salesTotal; q('salesNote').textContent = c.salesNote; q('salesNote').classList.toggle('is-checked', c.salesNote === 'checked');
    q('paymentsTotal').textContent = c.paymentsTotal; q('openRequests').textContent = String(c.openRequests);

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

    // One action: into the example, at the first finding that still needs the reviewer.
    q('actions').innerHTML = `<button type="button" class="btn btn-primary" data-hr-act="review">Review flagged items</button>`;
    q('confirm').hidden = true;
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hr-act]'); if (!b) return;
    if (b.dataset.hrAct === 'review') {
      const first = findings(getState()).find((f) => !ACCEPTED.includes(f.status));
      goTo(first ? 'findings' : 'summary', first?.issue);
    }
  });
  subscribe(() => paint());
  paint();

  // Bring the card in once when it's on screen: the card rises, the bars grow, then Tuesday is highlighted.
  if (reduce || typeof IntersectionObserver !== 'function') return;
  card.classList.add('hr-wait');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting)) return;
    io.disconnect();
    card.classList.remove('hr-wait'); card.classList.add('hr-play');
    setTimeout(() => card.classList.remove('hr-play'), 2600);
  }, { threshold: 0.3 });
  io.observe(card);
}
