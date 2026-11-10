// Hero: an illustration of scattered information becoming one connected workspace (master brief, 10 Nov 2026).
// Three sources (spreadsheet files, business records, requests and tasks) flow into a workspace with organised
// records, a report, a workflow, actions and an insight. Since 10 Nov (evening) its figures come from the Weekly Work
// & Follow-up Tracker (src/tracker/), the homepage's main example, and follow the same state, so what the visitor
// changes in the tracker shows here too. It is an illustration of a possible solution, not a product. Motion: one
// ~4.6 s CSS timeline (.hw-play), played once on screen, with Replay; reduced motion and no JavaScript show the
// finished picture. CSP: no inline style attributes.

import { getRecords, subscribe } from '../tracker/store.js';
import { summarise, findings, receivedByDay, byStatus, heroInsight } from '../tracker/engine.js';
import { esc } from '../forms.js';

// Short tags for the small Actions panel; the tracker itself shows the full wording.
export const SHORT = { overdue: 'Overdue', missing: 'Missing details', unassigned: 'No owner', duplicate: 'Check duplicate' };

export function mountHero(fig) {
  if (!fig) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const set = (k, v) => fig.querySelectorAll(`[data-hw="${k}"]`).forEach((el) => { el.textContent = String(v); });

  function paint() {
    const rec = getRecords(); const s = summarise(rec);
    set('records', s.total); set('requests', s.total); set('openRequests', s.outstanding); set('completed', s.completed); set('attention', s.attention);
    for (const st of byStatus(rec)) { const el = fig.querySelector(`[data-hw-stage="${st.status}"]`); if (el) el.textContent = String(st.count); }
    // The three sample rows show a check mark or "check", following the tracker's findings.
    fig.querySelectorAll('[data-hw-row]').forEach((li) => {
      const r = rec.find((x) => x.ref === li.dataset.hwRow); if (!r) return;
      const on = findings(r, rec).length > 0; const mark = li.lastElementChild;
      mark.className = on ? 'hw-flag' : 'hw-ok'; mark.textContent = on ? 'check' : '✓';
      li.children[1].textContent = r.customer.trim() || 'No customer';
    });
    const list = fig.querySelector('[data-hw-list]');
    if (list) list.innerHTML = s.followUps.length ? s.followUps.slice(0, 3).map((f) => `<li>${esc(f.title)} <em>${esc(SHORT[f.keys[0]])}</em></li>`).join('') : '<li>Nothing waiting <em class="is-prog">Up to date</em></li>';
    const ins = fig.querySelector('[data-hw-insight]'); if (ins) ins.textContent = heroInsight(s);
    const days = receivedByDay(rec); const max = Math.max(2, ...days.map((d) => d.received));
    for (const d of days) {
      const el = fig.querySelector(`[data-hw-day="${d.day}"]`); if (!el) continue;
      el.dataset.v = String(d.received);
      el.querySelector('i').style.setProperty('height', `${Math.round((d.received / max) * 100)}%`);
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
