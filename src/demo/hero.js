// Hero card: a live preview of the weekly report. Status, items to review, three figures, the daily sales chart
// (this week against the 4-week average, Tuesday highlighted) and two actions: Review flagged items and Publish report.
// It shares one state with the live example (./store.js): a decision made there redraws this card (remove the
// duplicate and Tuesday drops back into its usual range), and publishing here unlocks the report in the example.
// Nothing is sent or changed. Without JavaScript the static HTML shows the same figures with a link to the example.

import { esc } from '../forms.js';
import { getState, subscribe, publish } from './store.js';
import { heroCard, heroSummary, publishWarning, findings } from './engine.js';

export function mountHero(card, demo) {
  if (!card) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (k) => card.querySelector(`[data-hr="${k}"]`);
  const svg = card.querySelector('.hr-chart');
  const MAX = Number(svg.dataset.max); const BASE = Number(svg.dataset.base); const H = Number(svg.dataset.h);
  const y = (v) => Math.round((BASE - (v / MAX) * H) * 10) / 10;
  let confirming = false;

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
    st.dataset.state = s.published ? (c.toReview ? 'published-open' : 'published') : (c.toReview ? 'review' : 'ready');
    q('toReview').textContent = String(c.toReview);
    q('toReviewLabel').textContent = c.toReview === 1 ? 'item to review' : c.toReview ? 'items to review' : 'All findings reviewed';
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

    // The two actions. Publishing with findings still open asks for a confirmation first.
    const actions = q('actions'); const confirm = q('confirm');
    const publishLabel = s.published ? 'View report' : 'Publish report';
    actions.innerHTML = `<button type="button" class="btn btn-primary" data-hr-act="review">Review flagged items</button>`
      + `<button type="button" class="btn btn-secondary" data-hr-act="${s.published ? 'view' : 'publish'}">${publishLabel}</button>`;
    confirm.hidden = !confirming;
    confirm.innerHTML = confirming
      ? `<p>${esc(publishWarning(s))}</p><div><button type="button" class="btn btn-primary btn-small" data-hr-act="confirm">Publish anyway</button> <button type="button" class="dt-link" data-hr-act="cancel">Cancel</button></div>`
      : '';
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hr-act]'); if (!b) return;
    const a = b.dataset.hrAct; const s = getState();
    if (a === 'review') {
      confirming = false;
      const first = findings(s).find((f) => f.status === 'open' || f.status === 'unresolved');
      goTo('findings', first?.issue); return;
    }
    if (a === 'publish') {
      if (publishWarning(s)) { confirming = true; paint(); q('confirm').querySelector('button')?.focus(); return; }
      publish(); card.querySelector('[data-hr-act="view"]')?.focus(); return;
    }
    if (a === 'confirm') { confirming = false; publish(); card.querySelector('[data-hr-act="view"]')?.focus(); return; }
    if (a === 'cancel') { confirming = false; paint(); card.querySelector('[data-hr-act="publish"]')?.focus(); return; }
    if (a === 'view') goTo('summary');
  });
  subscribe(() => { confirming = false; paint(); });
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
