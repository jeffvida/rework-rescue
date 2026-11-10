// Hero (spec 10 Nov 2026, simplified wording): a four-stage workflow (Collect → Combine → Check →
// Explain) feeding a Weekly report card with the jobs as logged, jobs completed by day, the number of things to check
// and two actions:
//   Review the n items → scrolls to the demo and opens Findings at the first open finding.
//   Approve report     → runs the readiness check: says what must be decided first, or asks for approval and lists
//                        what the report will show as still open. Approving is simulated: nothing is sent.
// Everything comes from the shared state (./store.js) and the engine, so the hero, Findings, Sources and the
// Management Summary always agree. Motion: one ~4.8 s CSS timeline, played once on screen, with Replay; reduced motion
// and no JavaScript show the final frame. CSP: no inline style attributes.

import { esc } from '../forms.js';
import { getState, subscribe, publish } from './store.js';
import { heroCard, readiness, findings, CLOSED } from './engine.js';

const STATUS_TEXT = { 'Awaiting review': 'Awaiting review', 'Ready to approve': 'Ready to approve', Approved: 'Approved', 'Changed since approval': 'Changed since approval' };
const STATE = { 'Awaiting review': 'review', 'Ready to approve': 'ready', Approved: 'done', 'Changed since approval': 'changed' };
const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg>';
const LENS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';

export function mountHero(card, demo) {
  if (!card) return;
  const fig = card.closest('.hm');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (k) => card.querySelector(`[data-hr="${k}"]`);
  const svg = card.querySelector('.hm-chart');
  const BASE = Number(svg.dataset.base); const UNIT = Number(svg.dataset.unit);
  const check = q('check'); const pub = q('publish');
  let panel = null; // null | 'check' | 'done'
  let preparing = false;

  pub.hidden = false;
  const goTo = (tab, issue) => {
    if (!demo) return false;
    demo.show(tab, issue);
    document.getElementById('samples')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => { const p = document.querySelector('#samples [role="tabpanel"]:not([hidden])'); (p?.querySelector('.dt-detail') || p)?.focus({ preventScroll: true }); }, reduce ? 0 : 500);
    return true;
  };

  function paintCheck() {
    const s = getState(); const r = readiness(s);
    check.hidden = !panel;
    if (!panel) { check.innerHTML = ''; return; }
    if (panel === 'done' || r.published) {
      check.dataset.kind = 'done';
      check.innerHTML = '<p><strong>Approved.</strong> The final report and the follow-up list are ready in the Report tab below. Nothing was sent.</p><p><button type="button" class="dt-link" data-hm="summary">See the approved report &rarr;</button></p>';
      return;
    }
    if (!r.ready) {
      check.dataset.kind = 'blocked';
      check.innerHTML = `<p><strong>Not ready yet.</strong> ${r.blockers.length === 1 ? 'One thing needs' : `${r.blockers.length} things need`} your decision first:</p>
        <ul>${r.blockers.map((b) => `<li>${esc(b.text)}</li>`).join('')}</ul>
        <p><button type="button" class="dt-link" data-hm="review">Decide it now &rarr;</button> <button type="button" class="dt-link" data-hm="close">Close</button></p>`;
      return;
    }
    check.dataset.kind = 'ready';
    check.innerHTML = `<p><strong>Ready to approve.</strong> ${r.disclosures.length ? `The report will list ${r.disclosures.length === 1 ? 'this as still open' : `these ${r.disclosures.length} as still open`}:` : 'Nothing is left open.'}</p>
      ${r.disclosures.length ? `<ul>${r.disclosures.map((d) => `<li>${esc(d.title)}: ${esc(d.label)}${d.note ? ` (“${esc(d.note)}”)` : ''}</li>`).join('')}</ul>` : ''}
      <p class="hm-check-actions"><button type="button" class="btn btn-primary btn-small" data-hm="approve">Approve report</button> <button type="button" class="dt-link" data-hm="close">Cancel</button></p>`;
  }

  function paint() {
    const s = getState(); const c = heroCard(s);
    const st = q('status');
    st.textContent = preparing ? 'Preparing' : STATUS_TEXT[c.status];
    st.dataset.state = preparing ? 'preparing' : STATE[c.status];
    q('attention').textContent = String(c.attention);
    q('attentionLabel').textContent = c.attention === 1 ? 'thing to check' : 'things to check';
    card.querySelector('.hm-attn').classList.toggle('is-clear', !c.attention);
    for (const x of c.byCategory) card.querySelector(`[data-hm-c="${x.issue}"]`)?.classList.toggle('is-closed', !x.open);
    pub.innerHTML = `${SEND}${s.published ? 'See the approved report' : 'Approve report'}`;
    const open = findings(s).filter((f) => !CLOSED.includes(f.status)).length;
    q('review').innerHTML = `${LENS}${open ? `Review the ${open} ${open === 1 ? 'item' : 'items'}` : 'See the report'}`;
    for (const d of c.daily) {
      const g = svg.querySelector(`[data-day="${d.day}"]`); if (!g) continue;
      const h = d.completed * UNIT; const bar = g.querySelector('.hm-bar');
      bar.setAttribute('y', String(BASE - h)); bar.setAttribute('height', String(h));
      const v = g.querySelector('.hm-val'); v.setAttribute('y', String(BASE - h - 7)); v.textContent = String(d.completed);
    }
    paintCheck();
  }

  q('review').addEventListener('click', (e) => {
    const first = findings(getState()).find((f) => !CLOSED.includes(f.status));
    if (goTo('findings', first?.issue)) e.preventDefault();
  });
  pub.addEventListener('click', () => {
    if (getState().published) { goTo('summary'); return; }
    panel = 'check'; paintCheck();
    check.querySelector('button')?.focus();
  });
  check.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hm]'); if (!b) return;
    const a = b.dataset.hm;
    if (a === 'close') { panel = null; paintCheck(); pub.focus(); return; }
    if (a === 'review') { panel = null; paintCheck(); const first = findings(getState()).find((f) => !CLOSED.includes(f.status)); goTo('findings', first?.issue); return; }
    if (a === 'approve') { panel = 'done'; publish(); check.querySelector('button')?.focus(); return; }
    if (a === 'summary') { panel = null; paintCheck(); goTo('summary'); }
  });
  subscribe((st, why) => { if (panel === 'done' && why?.type !== 'publish') panel = null; paint(); });
  paint();

  if (!fig) return;
  // The ~4.8 s timeline lives in CSS (.hm-play); this starts it once on screen, counts the KPIs up, and replays it.
  if (reduce || typeof IntersectionObserver !== 'function') return;
  const replay = fig.querySelector('.hm-replay');
  const kpis = [...card.querySelectorAll('.hm-kpi dd')];
  const timers = [];
  function countUp() {
    const c = heroCard(getState()); const to = [c.sourceRecords, c.recordedCompleted, c.recordedOpen];
    const t0 = performance.now(); const dur = 650;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      kpis.forEach((el, i) => { el.textContent = String(Math.round(to[i] * (1 - (1 - k) ** 3))); });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function play() {
    timers.splice(0).forEach(clearTimeout);
    fig.classList.remove('hm-play'); void fig.offsetWidth; fig.classList.add('hm-play');
    preparing = true; paint();
    kpis.forEach((el) => { el.textContent = '0'; });
    timers.push(setTimeout(countUp, 3300));
    timers.push(setTimeout(() => { preparing = false; paint(); }, 4450));
  }
  fig.classList.add('hm-wait');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((x) => x.isIntersecting)) return;
    io.disconnect();
    fig.classList.remove('hm-wait'); play();
    if (replay) replay.hidden = false;
  }, { threshold: 0.25 });
  io.observe(fig);
  replay?.addEventListener('click', play);
}
