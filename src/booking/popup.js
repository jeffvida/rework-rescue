// Booking pop-up, opened by every "Book a free rework review" link (homepage, contact page, assessment result).
//
// Two modes, chosen by site-config.js:
//  - LIVE (bookingAvailabilityUrl and bookingRequestUrl set): free times come from the n8n workflow
//    (n8n/rework-review-booking.json), which reads Jeff's Google Calendar. Booking creates the calendar event
//    with a Google Meet link and emails the visitor the invite.
//  - NOT CONNECTED (either URL empty): times follow the slot rules but aren't checked against the calendar,
//    and the last step opens an email draft to Jeff. Nothing is sent unless the visitor sends it.
// If the live service fails, the pop-up falls back to the email draft, so a visitor is never stuck.
import { SPECIALIST, SITE } from '../../site-config.js';
import { checkName, checkEmail, checkCompany, checkText, tidy, LIMITS } from '../forms.js';
import { wireField, wireEmailHint, showError } from '../forms.js';
import { candidateSlots } from './slots.js';
import { SERVICE_OPTIONS, serviceLabel } from '../inquiry.js';

const HOST_TZ = 'Asia/Manila'; // UTC+8, no daylight saving
const LIVE = Boolean(SITE.bookingAvailabilityUrl && SITE.bookingRequestUrl);
const ZONES = [
  ['Asia/Manila', 'Philippines'], ['Asia/Singapore', 'Singapore'], ['Australia/Sydney', 'Sydney'],
  ['Europe/London', 'London'], ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Los_Angeles', 'Los Angeles'],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const fmt = (date, tz, opts) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).format(date);
const MAILTO_TIME = `mailto:${SPECIALIST.email}?subject=${encodeURIComponent('Rework review: finding a time')}`;

/** Calls the n8n workflow. Never throws: returns {status, data}. status 0 means no answer (network/timeout). */
async function call(url, { method = 'GET', body } = {}) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 15000) : null;
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      signal: ctl ? ctl.signal : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {{base?:string, getContext?:()=>({process?:string, summary?:string}|null)}} [opts]
 *   base: path prefix to the site root ('../' on the assessment and contact pages).
 *   getContext: on the assessment result page, returns a pre-fill for the process box and the result summary
 *   that travels with the request.
 * @returns {{open:()=>void}}
 */
export function mountBooking({ base = '', getContext = () => null } = {}) {
  let SLOTS = [];
  let tz;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || HOST_TZ; } catch { tz = HOST_TZ; }
  const zones = ZONES.some(([z]) => z === tz) ? ZONES : [[tz, `Your time zone (${tz.replace(/_/g, ' ')})`], ...ZONES];
  let month = null; let day = null; let slot = null; let req = {};
  let service = ''; // what the visitor wants help with (SERVICE_OPTIONS value); optional, asked in the details step
  let notice = '';      // one-line message above the calendar (e.g. "that time was just taken")
  let fallback = false; // live booking failed: the "done" step offers the email draft instead
  let busy = false;

  const dlg = document.createElement('dialog');
  dlg.className = 'bk';
  dlg.setAttribute('aria-labelledby', 'bk-title');
  document.body.appendChild(dlg);

  const byDay = () => {
    const m = new Map();
    for (const s of SLOTS) { const k = dayKey(s, tz); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return m;
  };
  const when = () => `${fmt(slot, tz, { weekday: 'long', month: 'long', day: 'numeric' })}, ${fmt(slot, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;

  function loading() {
    return '<div class="bk-pick"><p class="bk-step" role="status">Loading available times…</p></div>';
  }

  function unavailable(empty) {
    return `
      <div class="bk-pick">
        <p class="bk-step" role="status">${empty ? 'No times are free in the next four weeks.' : 'Available times couldn&rsquo;t be loaded right now.'}</p>
        <p>Email me and we&rsquo;ll find a time that works.</p>
        <p class="bk-done-actions"><a class="btn btn-primary" href="${esc(MAILTO_TIME)}">Email me</a>${empty ? '' : '<button type="button" class="bk-link" data-retry>Try again</button>'}</p>
      </div>`;
  }

  // Sent with the booking inside the existing "process" text, so the n8n workflow needs no change.
  const withService = (text) => {
    const label = serviceLabel(service) || 'Not sure yet';
    return `Help with: ${label}${text ? `. ${text}` : ''}`;
  };

  function calendar() {
    const days = byDay();
    const keys = [...days.keys()].sort();
    if (!keys.length) return unavailable(true);
    const shown = keys.slice(0, month === 'all' ? keys.length : 6);
    if (!day || !days.has(day)) day = keys[0];
    const times = days.get(day) || [];
    const label = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
    return `
      <div class="bk-pick">
        ${notice ? `<p class="bk-sample" role="alert">${esc(notice)}</p>` : ''}
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
        <p class="bk-none">None of these work? <a href="${esc(MAILTO_TIME)}">Email me</a> and we&rsquo;ll find a time.</p>
      </div>`;
  }

  function details() {
    return `
      <form class="bk-form" novalidate>
        <p class="bk-chosen"><strong>${when()}</strong><button type="button" class="bk-link" data-back>Change</button></p>

        <label for="bk-name">Your name</label><input id="bk-name" name="name" value="${esc(req.name || '')}" required autocomplete="name" maxlength="${LIMITS.name}" aria-describedby="bk-name-err"><p class="error" id="bk-name-err" hidden></p>
        ${LIVE ? `<label for="bk-email">Email <span class="bk-opt">(the calendar invite goes here)</span></label><input id="bk-email" name="email" type="email" inputmode="email" value="${esc(req.email || '')}" required autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="${LIMITS.email}" aria-describedby="bk-email-err bk-email-hint"><p class="error" id="bk-email-err" hidden></p><p class="hint" id="bk-email-hint" aria-live="polite" hidden></p>` : ''}
        <label for="bk-service">What would you like help with? <span class="bk-opt">(optional)</span></label><select id="bk-service" name="service">${SERVICE_OPTIONS.map(([v, l]) => `<option value="${esc(v)}"${v === service ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <label for="bk-company">Company <span class="bk-opt">(optional)</span></label><input id="bk-company" name="company" value="${esc(req.company || '')}" autocomplete="organization" maxlength="${LIMITS.company}" aria-describedby="bk-company-err"><p class="error" id="bk-company-err" hidden></p>
        <label for="bk-process">Which report or process do you want to look at? <span class="bk-opt">(optional, keep it general)</span></label><textarea id="bk-process" name="process" rows="3" maxlength="400" placeholder="For example: our weekly sales report takes half a day to rebuild." aria-describedby="bk-process-err">${esc(req.process || (getContext() || {}).process || '')}</textarea><p class="error" id="bk-process-err" hidden></p>
        <div class="hp" aria-hidden="true"><label for="bk-website">Leave this field empty</label><input id="bk-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        ${LIVE && (getContext() || {}).summary ? '<p class="bk-sample-note">Your Find Your Rework result is included with the booking.</p>' : ''}
        ${LIVE ? '<p class="bk-sample-note">Your details go to me only, to arrange this review. See the <a href="' + base + 'privacy/">privacy notice</a>.</p>' : ''}
        <p class="error" id="bk-form-err" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary"${busy ? ' disabled' : ''}>${LIVE ? (busy ? 'Booking…' : 'Book this time') : 'Continue'}</button>
      </form>`;
  }

  function booked() {
    return `
      <div class="bk-done">
        <h3>You&rsquo;re booked.</h3>
        <p><strong>${when()}</strong></p>
        <p>A calendar invite with the Google Meet link is on its way to <strong>${esc(req.email)}</strong>. If it isn&rsquo;t there in a few minutes, check your spam folder or <a href="mailto:${esc(SPECIALIST.email)}">email me</a>.</p>
        <p class="bk-step">What happens next</p>
        <ol class="bk-next">
          <li>Accept the invite so the time is in your calendar. I&rsquo;ll also email you a reminder a day before and an hour before.</li>
          <li>Need to change it? Reply to the invite or email me.</li>
          <li>Before the call, have the report or process in mind. There&rsquo;s no need to send any files.</li>
        </ol>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-close>Done</button></p>
      </div>`;
  }

  function done() {
    const w = when();
    const body = [
      'Hi Jeff,', '', "I'd like to book a free rework review.", '',
      `Preferred time: ${w}${fmt(slot, tz, { day: 'numeric', hour: 'numeric', minute: '2-digit' }) === fmt(slot, HOST_TZ, { day: 'numeric', hour: 'numeric', minute: '2-digit' }) ? '' : ` (${fmt(slot, HOST_TZ, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} Philippine time)`}`,
      `Name: ${req.name}`,
      `Help with: ${serviceLabel(service) || 'Not sure yet'}`,
      req.company ? `Company: ${req.company}` : '',
      req.process ? `Report or process: ${req.process}` : '',
      ...((getContext() || {}).summary ? ['', 'My Find Your Rework result:', getContext().summary] : []),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    const href = `mailto:${SPECIALIST.email}?subject=${encodeURIComponent(`Rework review request: ${w}`)}&body=${encodeURIComponent(body)}`;
    return `
      <div class="bk-done">
        <h3>${fallback ? 'Online booking didn&rsquo;t go through.' : 'One last step: send your request.'}</h3>
        <p>${fallback ? 'Nothing has been booked. You can still send the request by email: this opens' : 'Booking isn&rsquo;t connected yet, so nothing has been booked. This opens'} an email to me with <strong>${w}</strong> and your details${(getContext() || {}).summary ? ', plus your assessment result,' : ''} filled in.</p>
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
    const main = { loading, unavailable: () => unavailable(false), pick: calendar, details, booked, done }[step]();
    dlg.innerHTML = `
      <div class="bk-head"><div><p class="eyebrow">Book a free rework review</p><h2 id="bk-title">${step === 'booked' ? 'See you then.' : 'Pick a time that works for you.'}</h2></div>
        <button type="button" class="bk-x" data-close aria-label="Close">&times;</button></div>
      ${LIVE ? '' : '<p class="bk-sample"><strong>Booking isn&rsquo;t connected yet.</strong> The times shown are example times, not confirmed availability. Pick the one that suits you best and I&rsquo;ll confirm it by email.</p>'}
      <div class="bk-body">
        <aside class="bk-side">
          <div class="bk-who"><img src="${base}assets/photo/jeff-avatar.jpg" width="56" height="56" alt=""><p><strong>Jeff Herson Vida</strong><span>Rework Rescue</span></p></div>
          <p class="bk-meet"><strong>Free rework review</strong><span>30 min</span></p>
          <p class="bk-desc">Just bring one report or process. No preparation needed. You&rsquo;ll leave knowing whether it&rsquo;s worth fixing and roughly what it would take.</p>
          <ul class="bk-facts"><li>${LIVE ? 'Google Meet link comes with the calendar invite.' : 'Video call link comes with the calendar invite.'}</li><li>Times are shown in your time zone.</li></ul>
        </aside>
        <div class="bk-main">${main}</div>
      </div>`;
  }

  async function loadSlots() {
    if (!LIVE) { SLOTS = candidateSlots(Date.now()).map((t) => new Date(t)); return true; }
    render('loading');
    const { status, data } = await call(SITE.bookingAvailabilityUrl);
    if (status !== 200 || !data || !Array.isArray(data.slots)) return false;
    SLOTS = data.slots.map((s) => new Date(s)).filter((d) => !Number.isNaN(+d)).sort((a, b) => a - b);
    return true;
  }

  async function showCalendar() {
    const ok = await loadSlots();
    if (!dlg.open) return;
    render(ok ? 'pick' : 'unavailable');
    dlg.querySelector('.bk-day, .bk-time, [data-retry], .btn')?.focus();
  }

  function showDetails() {
    render('details');
    const f = dlg.querySelector('.bk-form');
    wireField(f.name, f.querySelector('#bk-name-err'), checkName, { tidyOnBlur: true });
    if (f.email) { wireField(f.email, f.querySelector('#bk-email-err'), checkEmail); wireEmailHint(f.email, f.querySelector('#bk-email-hint')); }
    wireField(f.company, f.querySelector('#bk-company-err'), (v) => checkCompany(v), { tidyOnBlur: true });
    wireField(f.process, f.querySelector('#bk-process-err'), (v) => checkText(v, { max: 300 }));
    return f;
  }

  async function book(f) {
    busy = true;
    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Booking…';
    const ctx = getContext() || {};
    const { status, data } = await call(SITE.bookingRequestUrl, {
      method: 'POST',
      body: { slot: slot.toISOString(), name: req.name, email: req.email, company: req.company, process: withService(req.process), summary: ctx.summary || '', tz, website: f.website.value },
    });
    busy = false;
    if (!dlg.open) return;
    const code = data && data.error;
    if (status === 200 && data && data.ok) { render('booked'); dlg.querySelector('.bk-done .btn')?.focus(); return; }
    if (status === 409 || code === 'taken' || code === 'slot') {
      notice = 'Sorry, that time was just taken. Please pick another.';
      slot = null; await showCalendar(); return;
    }
    if (code === 'already_booked') {
      btn.disabled = false; btn.textContent = 'Book this time';
      const err = f.querySelector('#bk-form-err');
      err.innerHTML = `You already have a review booked with this email. To change it, reply to the invite or <a href="mailto:${esc(SPECIALIST.email)}">email me</a>.`;
      err.hidden = false; return;
    }
    if (code === 'email' || code === 'name') {
      btn.disabled = false; btn.textContent = 'Book this time';
      const field = f[code];
      showError(field, f.querySelector(`#bk-${code}-err`), code === 'email' ? 'Please check this email address.' : 'Please check your name.');
      field.focus(); return;
    }
    // Anything else (service down, daily cap, unexpected answer): offer the email draft so nobody is stuck.
    fallback = true; render('done'); dlg.querySelector('.bk-done .btn')?.focus();
  }

  dlg.addEventListener('click', (e) => {
    const t = e.target;
    if (t === dlg || t.closest('[data-close]')) { dlg.close(); return; }
    if (t.closest('[data-retry]')) { showCalendar(); return; }
    const d = t.closest('[data-day]'); if (d) { day = d.dataset.day; notice = ''; render(); dlg.querySelector(`[data-day="${day}"]`)?.focus(); return; }
    const m = t.closest('[data-month]'); if (m && m.dataset.month) { month = m.dataset.month; render(); dlg.querySelectorAll('.bk-day')[6]?.focus(); return; }
    const s = t.closest('[data-slot]'); if (s) {
      slot = SLOTS[Number(s.dataset.slot)]; notice = ''; fallback = false;
      showDetails().name.focus(); return;
    }
    if (t.closest('[data-back]')) { fallback = false; render(); }
  });
  dlg.addEventListener('change', (e) => {
    if (e.target.id === 'bk-tz') { tz = e.target.value; day = null; month = null; render(); dlg.querySelector('#bk-tz')?.focus(); }
  });
  dlg.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const f = e.target;
    const checks = { name: checkName, company: (v) => checkCompany(v), process: (v) => checkText(v, { max: 300 }) };
    if (f.email) checks.email = checkEmail;
    let first = null;
    for (const [k, fn] of Object.entries(checks)) {
      const msg = fn(f[k].value);
      showError(f[k], f.querySelector(`#bk-${k}-err`), msg);
      if (msg && !first) first = f[k];
    }
    if (first) { first.focus(); return; }
    service = f.service.value;
    req = { name: tidy(f.name.value), email: f.email ? f.email.value.trim() : '', company: tidy(f.company.value), process: f.process.value.trim() };
    if (LIVE) { book(f); return; }
    render('done'); dlg.querySelector('.bk-done .btn')?.focus();
  });

  const valid = (v) => SERVICE_OPTIONS.some(([o]) => o && o === v);
  const open = (preselect = '') => {
    if (typeof dlg.showModal !== 'function') return false;
    day = null; month = null; slot = null; req = {}; notice = ''; fallback = false; busy = false;
    service = valid(preselect) ? preselect : (valid((getContext() || {}).service) ? getContext().service : '');
    dlg.showModal();
    showCalendar();
    return true;
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="contact/#contact-form-area"], [data-book]');
    if (!a) return;
    if (open(a.dataset.bookService || '')) e.preventDefault();
  });

  return { open };
}
