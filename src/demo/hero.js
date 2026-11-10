// Hero card: the automated weekly report as a run log. Collect → format → validate and detect patterns → AI findings
// → your review and approval → deliver. It plays once when it comes into view and stops at the review step.
// It shares one state with the live example (./store.js): decisions made there update this card, and the release
// made here unlocks the outputs shown in both. Nothing is sent or changed: it all runs in the page.
// Without JavaScript the static HTML shows the approval-ready card with a link to the example.

import { esc } from '../forms.js';
import { getState, subscribe, release, reset } from './store.js';
import { findings, report, status, heroLine, heroSummary, outputs, canApproveFinal, n } from './engine.js';

const STATUS_LABEL = { open: 'To review', resolved: 'Resolved', legitimate: 'Legitimate', unresolved: 'Unresolved' };

export function mountHero(card, demo) {
  if (!card) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (k) => card.querySelector(`[data-rl="${k}"]`);
  const replay = card.querySelector('.hs-replay');

  // Static figures (the HTML already holds them; the engine wins).
  const h = heroSummary();
  card.querySelectorAll('[data-hero]').forEach((el) => { const v = h[el.dataset.hero]; if (v !== undefined) el.textContent = String(v); });

  const goTo = (tab, issue) => {
    if (!demo) return;
    demo.show(tab, issue);
    document.getElementById('samples')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  function paint() {
    const s = getState(); const fs = findings(s); const r = report(s); const out = outputs(s);
    const st = q('status'); st.textContent = status(s); st.parentElement.dataset.state = s.release || (canApproveFinal(s) ? 'ready' : 'review');
    q('flagged').innerHTML = r.review.open ? `${r.review.open} of ${r.review.total} to review` : `${r.review.total} reviewed`;
    const clear = !r.review.open && !r.review.unresolved;
    q('flagged').classList.toggle('is-clear', clear);
    const vStep = q('flags').closest('.rl-step'); vStep.classList.toggle('is-warn', !clear); vStep.classList.toggle('is-done', clear);
    q('flags').innerHTML = fs.map((f) => `<li data-flag="${f.issue}" class="is-${f.status}">${esc(f.hero)} <span>${STATUS_LABEL[f.status]}</span></li>`).join('');
    q('summary').textContent = heroLine(s);

    const actions = q('actions'); const note = q('note');
    if (s.release === 'final' || s.release === 'provisional') {
      note.textContent = s.release === 'final' ? 'Approved by you. Final report released.' : `Released as provisional. ${out.unresolved.length} open or unresolved ${out.unresolved.length === 1 ? 'item is' : 'items are'} listed in the report.`;
      actions.innerHTML = '<button type="button" class="dt-link" data-hero-act="reopen">Reopen the review</button>';
    } else if (s.release === 'hold') {
      note.textContent = 'On hold. Nothing has been shared.';
      actions.innerHTML = '<button type="button" class="btn btn-primary btn-small" data-hero-act="review">Review flagged items</button> <button type="button" class="dt-link" data-hero-act="reopen">Take off hold</button>';
    } else if (canApproveFinal(s)) {
      note.textContent = 'Every finding is resolved or confirmed. Nothing is shared until you approve.';
      actions.innerHTML = '<button type="button" class="btn btn-primary btn-small" data-hero-act="final">Approve final report</button> <button type="button" class="dt-link" data-hero-act="review">Review again</button>';
    } else {
      const left = r.review.open + r.review.unresolved;
      note.textContent = r.review.open === r.review.total
        ? 'Nothing is shared or changed until you decide.'
        : `${left} ${left === 1 ? 'item still needs' : 'items still need'} attention. Final approval unlocks when every item is resolved or confirmed.`;
      actions.innerHTML = '<button type="button" class="btn btn-primary btn-small" data-hero-act="review">Review flagged items</button>'
        + '<button type="button" class="btn btn-secondary btn-small" data-hero-act="provisional">Release as provisional</button>'
        + '<button type="button" class="dt-link" data-hero-act="hold">Keep on hold</button>';
    }

    const o = q('outputs'); const li = o.closest('.rl-step');
    li.classList.toggle('is-locked', !out); li.classList.toggle('is-done', !!out);
    if (!out) {
      o.innerHTML = 'Report, dashboard and follow-up tasks unlock after release.';
    } else {
      const rep = out.report;
      o.innerHTML = `<ul class="rl-outs">
        <li><strong>${esc(rep.label)}</strong> <span>Sales ${n(rep.salesTotal)}${rep.salesTotal !== rep.recordedTotal ? ` (recorded ${n(rep.recordedTotal)})` : ''} · payments ${n(rep.paymentsTotal)}${out.unresolved.length ? ` · ${out.unresolved.length} open or unresolved` : ''}</span></li>
        <li><strong>Dashboard refreshed</strong> <span>Daily sales against 4-week averages</span></li>
        ${out.task ? `<li><strong>Follow-up task</strong> <span>${esc(out.task.id)}: ${esc(out.task.text)} (${esc(out.task.owner)})</span></li>` : ''}
      </ul><button type="button" class="dt-link" data-hero-act="open">Open the report and dashboard &darr;</button>`;
    }
  }

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hero-act]'); if (!b) return;
    const a = b.dataset.heroAct;
    if (a === 'review') { const first = findings(getState()).find((f) => f.status === 'open' || f.status === 'unresolved'); goTo('exceptions', first?.issue); }
    if (a === 'provisional' || a === 'hold' || a === 'final') release(a);
    if (a === 'reopen') release(null);
    if (a === 'open') goTo('overview');
    if (['provisional', 'hold', 'final', 'reopen'].includes(a)) card.querySelector('[data-hero-act]')?.focus();
  });
  // The static "Review flagged items" link (no-JS) is replaced by the button on first paint.
  subscribe(paint);
  paint();

  // Play once when the card comes into view; stop at the review step. Replay starts the example again.
  const play = () => {
    card.classList.remove('rl-play'); void card.offsetWidth; card.classList.add('rl-play');
    // Once played, drop the class so repainted parts (after a decision) don't replay their entrance.
    clearTimeout(card._rlDone); card._rlDone = setTimeout(() => card.classList.remove('rl-play'), 4300);
    if (replay) { replay.hidden = true; setTimeout(() => { replay.hidden = false; }, 3600); }
  };
  if (replay) replay.addEventListener('click', () => { reset(); if (!reduce) play(); });
  if (reduce) { if (replay) replay.hidden = false; return; }
  if (typeof IntersectionObserver !== 'function') { play(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((x) => x.isIntersecting)) { io.disconnect(); play(); }
  }, { threshold: 0.35 });
  io.observe(card);
}
