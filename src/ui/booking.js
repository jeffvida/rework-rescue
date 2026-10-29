// Booking pop-up, opened by every "Book a free rework review" link on the homepage.
// NOT CONNECTED YET: the times are examples (WINDOWS below) and nothing is booked or stored.
// The last step opens an email draft to Jeff with the chosen time filled in; nothing is sent unless the visitor sends it.
// When a scheduling service (Cal.com) is connected, this is replaced by its pop-up.
import { SPECIALIST } from '../config/site.js';
import { checkName, checkCompany, checkText, tidy, LIMITS } from '../forms/rules.js';
import { wireField, showError } from '../forms/live.js';

const HOST_TZ = 'Asia/Manila'; // UTC+8, no daylight saving
const HOST_OFFSET = 8;
// Example availability in Philippine time (replace with real hours, or remove once Cal.com is connected): weekday -> start times (0 = Sunday)
const WINDOWS = { 2: ['19:00', '19:30', '20:00', '20:30'], 3: ['19:00', '19:30', '20:00', '20:30'], 4: ['19:00', '19:30', '20:00', '20:30'], 6: ['09:00', '09:30', '10:00', '10:30'] };
const DAYS_AHEAD = 28;
const ZONES = [
  ['Asia/Manila', 'Philippines'], ['Asia/Singapore', 'Singapore'], ['Australia/Sydney', 'Sydney'],
  ['Europe/London', 'London'], ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Los_Angeles', 'Los Angeles'],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function allSlots() {
  const out = [];
  const now = Date.now();
  // "today" in the host time zone
  const hostNow = new Date(now + HOST_OFFSET * 3600e3);
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const d = new Date(Date.UTC(hostNow.getUTCFullYear(), hostNow.getUTCMonth(), hostNow.getUTCDate() + i));
    const times = WINDOWS[d.getUTCDay()];
    if (!times) continue;
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - HOST_OFFSET, m)));
    }
  }
  // leave a few gaps so it reads like a real week
  return out.filter((_, i) => i % 7 !== 3);
}

const dayKey = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const fmt = (date, tz, opts) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(date);

/**
 * @param {{base?:string, getContext?:()=>({process?:string, summary?:string}|null)}} [opts]
 *   base: path prefix to the site root ('../' on the assessment page).
 *   getContext: on the assessment result page, returns a pre-fill for the process box and the result summary
 *   that is added to the request email.
 * @returns {{open:()=>void}}
 */
export function mountBooking({ base = '', getContext = () => null } = {}) {
  const SLOTS = allSlots();
  let tz;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || HOST_TZ; } catch { tz = HOST_TZ; }
  const zones = ZONES.some(([z]) => z === tz) ? ZONES : [[tz, `Your time zone (${tz.replace(/_/g, ' ')})`], ...ZONES];
  let month = null; let day = null; let slot = null; let req = {};

  const dlg = document.createElement('dialog');
  dlg.className = 'bk';
  dlg.setAttribute('aria-labelledby', 'bk-title');
  document.body.appendChild(dlg);

  const byDay = () => {
    const m = new Map();
    for (const s of SLOTS) { const k = dayKey(s, tz); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return m;
  };

  function calendar() {
    const days = byDay();
    const keys = [...days.keys()].sort();
    const shown = keys.slice(0, month === 'all' ? keys.length : 6);
    if (!day) day = keys[0];
    const times = days.get(day) || [];
    const label = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
    return `
      <div class="bk-pick">
        <label class="bk-tz"><span>Times shown for</span><select id="bk-tz">${zones.map(([z, n]) => `<option value="${esc(z)}"${z === tz ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <p class="bk-step">1. Choose a day</p>
        <div class="bk-days" role="group" aria-label="Choose a day">
          ${shown.map((k) => `<button type="button" class="bk-day${k === day ? ' is-on' : ''}" data-day="${k}" aria-pressed="${k === day}">
            <span class="bk-dw">${fmt(label(k), 'UTC', { weekday: 'short' })}</span><span class="bk-dn">${fmt(label(k), 'UTC', { day: 'numeric' })}</span><span class="bk-dm">${fmt(label(k), 'UTC', { month: 'short' })}</span></button>`).join('')}
        </div>
        ${keys.length > shown.length ? '<button type="button" class="bk-link bk-more" data-month="all">More dates</button>' : ''}
        <p class="bk-step">2. Choose a time <span class="bk-opt">on ${fmt(label(day), 'UTC', { weekday: 'long', month: 'long', day: 'numeric' })}</span></p>
        <div class="bk-times" aria-live="polite">
          ${times.map((t) => `<button type="button" class="bk-time" data-slot="${SLOTS.indexOf(t)}">${fmt(t, tz, { hour: 'numeric', minute: '2-digit' })}</button>`).join('')}
        </div>
        <p class="bk-none">None of these work? <a href="mailto:jeffhersonvida@gmail.com?subject=Rework%20review%3A%20finding%20a%20time">Email me</a> and we&rsquo;ll find a time.</p>
      </div>`;
  }

  function details() {
    return `
      <form class="bk-form" novalidate>
        <p class="bk-chosen"><strong>${fmt(slot, tz, { weekday: 'long', month: 'long', day: 'numeric' })}, ${fmt(slot, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</strong><button type="button" class="bk-link" data-back>Change</button></p>
        <label for="bk-name">Your name</label><input id="bk-name" name="name" value="${esc(req.name || '')}" required autocomplete="name" maxlength="${LIMITS.name}" aria-describedby="bk-name-err"><p class="error" id="bk-name-err" hidden></p>
        <label for="bk-company">Company <span class="bk-opt">(optional)</span></label><input id="bk-company" name="company" value="${esc(req.company || '')}" autocomplete="organization" maxlength="${LIMITS.company}" aria-describedby="bk-company-err"><p class="error" id="bk-company-err" hidden></p>
        <label for="bk-process">Which report or process do you want to look at? <span class="bk-opt">(optional, keep it general)</span></label><textarea id="bk-process" name="process" rows="3" maxlength="400" placeholder="For example: our weekly sales report takes half a day to rebuild." aria-describedby="bk-process-err">${esc(req.process || (getContext() || {}).process || '')}</textarea><p class="error" id="bk-process-err" hidden></p>
        <button type="submit" class="btn btn-primary">Continue</button>
      </form>`;
  }

  function done() {
    const when = `${fmt(slot, tz, { weekday: 'long', month: 'long', day: 'numeric' })}, ${fmt(slot, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
    const body = [
      'Hi Jeff,', '', "I'd like to book a free rework review.", '',
      `Preferred time: ${when}${fmt(slot, tz, { day: 'numeric', hour: 'numeric', minute: '2-digit' }) === fmt(slot, HOST_TZ, { day: 'numeric', hour: 'numeric', minute: '2-digit' }) ? '' : ` (${fmt(slot, HOST_TZ, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} Philippine time)`}`,
      `Name: ${req.name}`,
      req.company ? `Company: ${req.company}` : '',
      req.process ? `Report or process: ${req.process}` : '',
      ...((getContext() || {}).summary ? ['', 'My Find Your Rework result:', getContext().summary] : []),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    const href = `mailto:${SPECIALIST.email}?subject=${encodeURIComponent(`Rework review request: ${when}`)}&body=${encodeURIComponent(body)}`;
    return `
      <div class="bk-done">
        <h3>One last step: send your request.</h3>
        <p>Booking isn&rsquo;t connected yet, so nothing has been booked. This opens an email to me with <strong>${when}</strong> and your details${(getContext() || {}).summary ? ', plus your assessment result,' : ''} filled in.</p>
        <p class="bk-done-actions"><a class="btn btn-primary" href="${esc(href)}">Email me this request</a><button type="button" class="bk-link" data-back>Change the time</button></p>
        <p class="bk-step">What happens next</p>
        <ol class="bk-next">
          <li>Send the email from your own email app. You can edit it first.</li>
          <li>I reply to confirm the time, or suggest another, and send a calendar invite with the video link.</li>
          <li>Before the call, have the report or process in mind. There&rsquo;s no need to send any files.</li>
        </ol>
      </div>`;
  }

  function render(step = 'pick') {
    dlg.innerHTML = `
      <div class="bk-head"><div><p class="eyebrow">Book a free rework review</p><h2 id="bk-title">Pick a time that works for you.</h2></div>
        <button type="button" class="bk-x" data-close aria-label="Close">&times;</button></div>
      <p class="bk-sample"><strong>Booking isn&rsquo;t connected yet.</strong> Pick the time that suits you best and I&rsquo;ll confirm it by email.</p>
      <div class="bk-body">
        <aside class="bk-side">
          <div class="bk-who"><img src="${base}assets/photo/jeff-avatar.jpg" width="56" height="56" alt=""><p><strong>Jeff Herson Vida</strong><span>Rework Rescue</span></p></div>
          <p class="bk-meet"><strong>Free rework review</strong><span>30 min</span></p>
          <p class="bk-desc">Just bring one report or process. No preparation needed. You&rsquo;ll leave knowing whether it&rsquo;s worth fixing and roughly what it would take.</p>
          <ul class="bk-facts"><li>Video call link comes with the calendar invite.</li><li>Times are shown in your time zone.</li></ul>
        </aside>
        <div class="bk-main">${step === 'pick' ? calendar() : step === 'details' ? details() : done()}</div>
      </div>`;
  }

  dlg.addEventListener('click', (e) => {
    const t = e.target;
    if (t === dlg || t.closest('[data-close]')) { dlg.close(); return; }
    const d = t.closest('[data-day]'); if (d) { day = d.dataset.day; render(); dlg.querySelector(`[data-day="${day}"]`)?.focus(); return; }
    const m = t.closest('[data-month]'); if (m && m.dataset.month) { month = m.dataset.month; render(); dlg.querySelectorAll('.bk-day')[6]?.focus(); return; }
    const s = t.closest('[data-slot]'); if (s) {
      slot = SLOTS[Number(s.dataset.slot)]; render('details');
      const f = dlg.querySelector('.bk-form');
      wireField(f.name, f.querySelector('#bk-name-err'), checkName, { tidyOnBlur: true });
      wireField(f.company, f.querySelector('#bk-company-err'), (v) => checkCompany(v), { tidyOnBlur: true });
      wireField(f.process, f.querySelector('#bk-process-err'), (v) => checkText(v, { max: 300 }));
      f.name.focus(); return;
    }
    if (t.closest('[data-back]')) { render(); }
  });
  dlg.addEventListener('change', (e) => {
    if (e.target.id === 'bk-tz') { tz = e.target.value; day = null; month = null; render(); dlg.querySelector('#bk-tz')?.focus(); }
  });
  dlg.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const checks = { name: checkName, company: (v) => checkCompany(v), process: (v) => checkText(v, { max: 300 }) };
    let first = null;
    for (const [k, fn] of Object.entries(checks)) {
      const m = fn(f[k].value);
      showError(f[k], f.querySelector(`#bk-${k}-err`), m);
      if (m && !first) first = f[k];
    }
    if (first) { first.focus(); return; }
    req = { name: tidy(f.name.value), company: tidy(f.company.value), process: f.process.value.trim() };
    render('done'); dlg.querySelector('.bk-done .btn')?.focus();
  });

  const open = () => {
    if (typeof dlg.showModal !== 'function') return false;
    day = null; month = null; slot = null; req = {};
    render();
    dlg.showModal();
    return true;
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="contact/#contact-form-area"], [data-book]');
    if (!a) return;
    if (open()) e.preventDefault();
  });

  return { open };
}
