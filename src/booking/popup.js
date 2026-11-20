// Booking pop-up, opened by every "Book a free process review" link (homepage, contact page, assessment result).
//
// Two modes, chosen by site-config.js:
//  - LIVE (bookingAvailabilityUrl and bookingRequestUrl set): free times come from the n8n workflow
//    (n8n/rework-review-booking.json), which reads Jeff's Google Calendar. Booking creates the calendar event
//    with a Google Meet link and emails the visitor the invite.
//  - NOT CONNECTED (either URL empty): times follow the slot rules but aren't checked against the calendar,
//    and the last step opens an email draft to Jeff. Nothing is sent unless the visitor sends it.
// If the live service fails, the pop-up falls back to the email draft, so a visitor is never stuck.
//
// Change or cancel (20 Nov 2026): the invite and reminders link to /#booking=KEY. src/home.js calls manage(KEY),
// which looks the booking up (rr-manage webhook), then lets the visitor pick a new time or cancel.
// /#booking=preview shows the same screens with a sample booking and changes nothing.
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
const MAILTO_TIME = `mailto:${SPECIALIST.email}?subject=${encodeURIComponent('Free review: finding a time')}`;
const MAILTO_CHANGE = `mailto:${SPECIALIST.email}?subject=${encodeURIComponent('Changing my free review')}`;
export const MANAGE_KEY = /^([A-Za-z0-9]{24,64}|preview)$/;

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
 * @param {HTMLElement} [opts.inline]  When given, the calendar is drawn inside this element on the page instead
 *   of a pop-up (no close button, no sidebar). Call start() to load the times, e.g. when it scrolls into view.
 * @returns {{open:()=>boolean, start:()=>void}}
 */
export function mountBooking({ base = '', getContext = () => null, inline = null } = {}) {
  let SLOTS = [];
  let tz;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || HOST_TZ; } catch { tz = HOST_TZ; }
  const zones = ZONES.some(([z]) => z === tz) ? ZONES : [[tz, `Your time zone (${tz.replace(/_/g, ' ')})`], ...ZONES];
  let month = null; let day = null; let slot = null; let req = {};
  let service = ''; // what the visitor wants help with (SERVICE_OPTIONS value); optional, asked in the details step
  let notice = '';      // one-line message above the calendar (e.g. "that time was just taken")
  let fallback = false; // live booking failed: the "done" step offers the email draft instead
  let busy = false;
  // Change or cancel: { key, start, end, name, changesLeft, to (new time picked), sample (preview only) }
  let mg = null;
  let mgMsg = ''; // one-line message on the booking screen (e.g. no changes left)

  const dlg = document.createElement(inline ? 'div' : 'dialog');
  dlg.className = inline ? 'bk bk-inline' : 'bk';
  if (inline) inline.appendChild(dlg); else { dlg.setAttribute('aria-labelledby', 'bk-title'); document.body.appendChild(dlg); }
  const isOpen = () => (inline ? true : dlg.open);

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
        <p>Email me and I&rsquo;ll find a time that works for you.</p>
        <p class="bk-done-actions"><a class="btn btn-primary" href="${esc(MAILTO_TIME)}">Email me</a>${empty ? '' : '<button type="button" class="bk-link" data-retry>Try again</button>'}</p>
      </div>`;
  }

  // Sent with the booking inside the existing "process" text, so the n8n workflow needs no change.
  const withService = (text) => {
    const label = serviceLabel(service) || 'Not sure yet';
    return `Help with: ${label}${text ? `. ${text}` : ''}`;
  };

  const at = (d) => `${fmt(d, tz, { weekday: 'long', month: 'long', day: 'numeric' })}, ${fmt(d, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;

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
        ${mg ? `<p class="bk-current">Your current time: <strong>${at(mg.start)}</strong> <button type="button" class="bk-link" data-mg-view>Keep it</button></p>` : ''}
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
        <label for="bk-company">Company <span class="bk-opt">(optional)</span></label><input id="bk-company" name="company" value="${esc(req.company || '')}" autocomplete="organization" maxlength="${LIMITS.company}" aria-describedby="bk-company-err"><p class="error" id="bk-company-err" hidden></p>
        <label for="bk-service">What would you like help with? <span class="bk-opt">(optional)</span></label><select id="bk-service" name="service">${SERVICE_OPTIONS.map(([v, l]) => `<option value="${esc(v)}"${v === service ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <label for="bk-process">Which report or process do you want to look at? <span class="bk-opt">(optional, keep it general)</span></label><textarea id="bk-process" name="process" rows="3" maxlength="400" placeholder="For example: our weekly sales report takes half a day to rebuild." aria-describedby="bk-process-err">${esc(req.process || (getContext() || {}).process || '')}</textarea><p class="error" id="bk-process-err" hidden></p>
        <div class="hp" aria-hidden="true"><label for="bk-website">Leave this field empty</label><input id="bk-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        ${LIVE && (getContext() || {}).summary ? '<p class="bk-sample-note">Your Find Your Rework result is included with the booking.</p>' : ''}
        ${LIVE ? '<p class="bk-sample-note">Your details go to me only, to arrange this review. Please don&rsquo;t include confidential information. See the <a href="' + base + 'privacy/">privacy notice</a>.</p>' : ''}
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
      'Hi Jeff,', '', "I'd like to book a free review.", '',
      `Preferred time: ${w}${fmt(slot, tz, { day: 'numeric', hour: 'numeric', minute: '2-digit' }) === fmt(slot, HOST_TZ, { day: 'numeric', hour: 'numeric', minute: '2-digit' }) ? '' : ` (${fmt(slot, HOST_TZ, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} Philippine time)`}`,
      `Name: ${req.name}`,
      `Help with: ${serviceLabel(service) || 'Not sure yet'}`,
      req.company ? `Company: ${req.company}` : '',
      req.process ? `Report or process: ${req.process}` : '',
      ...((getContext() || {}).summary ? ['', 'My Find Your Rework result:', getContext().summary] : []),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
    const href = `mailto:${SPECIALIST.email}?subject=${encodeURIComponent(`Review request: ${w}`)}&body=${encodeURIComponent(body)}`;
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

  // ---- Change or cancel screens
  const sampleNote = () => (mg && mg.sample ? '<p class="bk-sample">Preview with a sample booking. Nothing is changed.</p>' : '');
  function mfind() { return '<div class="bk-pick"><p class="bk-step" role="status">Finding your booking…</p></div>'; }
  function mview() {
    const left = mg.changesLeft;
    return `
      <div class="bk-done bk-manage">
        ${sampleNote()}
        <h3>${mg.name ? `Hi ${esc(mg.name)}, your` : 'Your'} review is booked for</h3>
        <p><strong>${at(mg.start)}</strong></p>
        ${mgMsg ? `<p class="bk-sample" role="alert">${esc(mgMsg)}</p>` : ''}
        ${left > 0
          ? `<p class="bk-done-actions"><button type="button" class="btn btn-primary" data-mg-pick>Pick a new time</button><button type="button" class="bk-link" data-mg-cancel>Cancel the review</button></p>
             <p class="bk-sample-note">You can change it ${left === 1 ? 'once more' : `${left} more times`}. The Meet link stays the same.</p>`
          : `<p>You&rsquo;ve already changed this review ${CHANGES_TEXT}. To change it again, reply to the invite or <a href="${esc(MAILTO_CHANGE)}">email me</a>.</p>
             <p class="bk-done-actions"><button type="button" class="bk-link" data-mg-cancel>Cancel the review</button></p>`}
      </div>`;
  }
  function mconfirm() {
    return `
      <div class="bk-done bk-manage">
        ${sampleNote()}
        <h3>Move your review?</h3>
        <p>From <s>${at(mg.start)}</s></p>
        <p>To <strong>${at(mg.to)}</strong></p>
        <p class="error" id="bk-mg-err" role="alert" hidden></p>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-mg-move${busy ? ' disabled' : ''}>${busy ? 'Moving…' : 'Move my review'}</button><button type="button" class="bk-link" data-mg-pick>Choose another time</button></p>
      </div>`;
  }
  function mmoved() {
    return `
      <div class="bk-done bk-manage">
        ${sampleNote()}
        <h3>Your review is moved.</h3>
        <p><strong>${at(mg.start)}</strong></p>
        <p>Google Calendar will send you the updated invite. The Meet link stays the same, and I&rsquo;ll email you a reminder a day before and an hour before.</p>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-close>Done</button></p>
      </div>`;
  }
  function mcancel() {
    return `
      <div class="bk-done bk-manage">
        ${sampleNote()}
        <h3>Cancel your review?</h3>
        <p><strong>${at(mg.start)}</strong></p>
        <p class="error" id="bk-mg-err" role="alert" hidden></p>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-mg-docancel${busy ? ' disabled' : ''}>${busy ? 'Cancelling…' : 'Yes, cancel it'}</button><button type="button" class="bk-link" data-mg-view>Keep my booking</button></p>
      </div>`;
  }
  function mcancelled() {
    return `
      <div class="bk-done bk-manage">
        ${sampleNote()}
        <h3>Your review is cancelled.</h3>
        <p>Google Calendar will send you the cancellation. If you&rsquo;d like to talk another time, you can book a new review whenever it suits you.</p>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-mg-new>Book a new time</button><button type="button" class="bk-link" data-close>Close</button></p>
      </div>`;
  }
  function mmissing(code) {
    return `
      <div class="bk-done bk-manage">
        <h3>${code === 'started' ? 'This review has already started or passed.' : 'I can&rsquo;t find this booking.'}</h3>
        <p>${code === 'started' ? 'If you&rsquo;d like another review, you can book a new time.' : 'It may have been cancelled, or the link may be incomplete. Try the link in your latest invite, or book a new time.'}</p>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-mg-new>Book a new time</button><a class="bk-link" href="${esc(MAILTO_CHANGE)}">Email me</a></p>
      </div>`;
  }
  function mfail() {
    return `
      <div class="bk-done bk-manage">
        <h3>Your booking couldn&rsquo;t be changed right now.</h3>
        <p>Nothing has changed. Please try again in a few minutes, or reply to the invite or email me and I&rsquo;ll change it for you.</p>
        <p class="bk-done-actions"><button type="button" class="btn btn-primary" data-mg-retry>Try again</button><a class="bk-link" href="${esc(MAILTO_CHANGE)}">Email me</a></p>
      </div>`;
  }

  function render(step = 'pick', arg) {
    const main = {
      loading, unavailable: () => unavailable(false), pick: calendar, details, booked, done,
      mfind, mview, mconfirm, mmoved, mcancel, mcancelled, mmissing: () => mmissing(arg), mfail,
    }[step]();
    if (inline) {
      dlg.innerHTML = `${LIVE ? '' : '<p class="bk-sample"><strong>Booking isn&rsquo;t connected yet.</strong> The times shown are example times, not confirmed availability. Pick the one that suits you best and I&rsquo;ll confirm it by email.</p>'}
      <div class="bk-main">${main}</div>`;
      return;
    }
    dlg.innerHTML = `
      <div class="bk-head"><div><p class="eyebrow">${mg ? 'Your free process review' : 'Book a free process review'}</p><h2 id="bk-title">${title(step)}</h2></div>
        <button type="button" class="bk-x" data-close aria-label="Close">&times;</button></div>
      ${LIVE ? '' : '<p class="bk-sample"><strong>Booking isn&rsquo;t connected yet.</strong> The times shown are example times, not confirmed availability. Pick the one that suits you best and I&rsquo;ll confirm it by email.</p>'}
      <div class="bk-body">
        <aside class="bk-side">
          <div class="bk-who"><img src="${base}assets/photo/jeff-avatar.jpg" width="56" height="56" alt=""><p><strong>Jeff Herson Vida</strong><span>Rework Rescue</span></p></div>
          <p class="bk-meet"><strong>Free review</strong><span>30 min</span></p>
          <p class="bk-desc">Just bring one task or process that takes more time than it should. No preparation needed. I&rsquo;ll help you understand where the work gets stuck and identify a practical next step.</p>
          <ul class="bk-facts"><li>${LIVE ? 'Google Meet link comes with the calendar invite.' : 'Video call link comes with the calendar invite.'}</li><li>Times are shown in your time zone.</li></ul>
        </aside>
        <div class="bk-main">${main}</div>
      </div>`;
  }

  function title(step) {
    if (step === 'booked' || step === 'mmoved') return 'See you then.';
    if (step === 'mcancelled') return 'Review cancelled.';
    if (mg) return step === 'pick' ? 'Pick a new time.' : 'Change or cancel your review.';
    return 'Pick a time that works for you.';
  }

  async function loadSlots() {
    if (!LIVE || (mg && mg.sample)) { SLOTS = candidateSlots(Date.now()).map((t) => new Date(t)); return true; }
    render('loading');
    const { status, data } = await call(SITE.bookingAvailabilityUrl);
    if (status !== 200 || !data || !Array.isArray(data.slots)) return false;
    SLOTS = data.slots.map((s) => new Date(s)).filter((d) => !Number.isNaN(+d)).sort((a, b) => a - b);
    return true;
  }

  async function showCalendar(focus = true) {
    const ok = await loadSlots();
    if (!isOpen()) return;
    render(ok ? 'pick' : 'unavailable');
    if (focus) dlg.querySelector('.bk-day, .bk-time, [data-retry], .btn')?.focus();
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
    if (!isOpen()) return;
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
    if (inline && t.closest('[data-close]')) { reset(); showCalendar(); return; }
    if (busy && t.closest('[data-mg-move], [data-mg-docancel]')) return;
    if (!inline && (t === dlg || t.closest('[data-close]'))) { dlg.close(); return; }
    if (t.closest('[data-retry]')) { showCalendar(); return; }
    const d = t.closest('[data-day]'); if (d) { day = d.dataset.day; notice = ''; render(); dlg.querySelector(`[data-day="${day}"]`)?.focus(); return; }
    const m = t.closest('[data-month]'); if (m && m.dataset.month) { month = m.dataset.month; render(); dlg.querySelectorAll('.bk-day')[6]?.focus(); return; }
    const s = t.closest('[data-slot]'); if (s) {
      slot = SLOTS[Number(s.dataset.slot)]; notice = ''; fallback = false;
      if (mg) { mg.to = slot; show('mconfirm'); return; }
      showDetails().name.focus(); return;
    }
    if (t.closest('[data-mg-view]')) { notice = ''; show('mview'); return; }
    if (t.closest('[data-mg-pick]')) { mgMsg = ''; showCalendar(); return; }
    if (t.closest('[data-mg-cancel]')) { show('mcancel'); return; }
    if (t.closest('[data-mg-move]')) { change('move'); return; }
    if (t.closest('[data-mg-docancel]')) { change('cancel'); return; }
    if (t.closest('[data-mg-retry]')) { look(mg && mg.key); return; }
    if (t.closest('[data-mg-new]')) { reset(); showCalendar(); return; }
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

  function show(step, arg) {
    render(step, arg);
    dlg.querySelector('.bk-done .btn, .bk-done .bk-link, .bk-day')?.focus();
  }

  // ---- Change or cancel: talk to the rr-manage webhook (or fake it for #booking=preview)
  const MANAGE_LIVE = Boolean(SITE.bookingManageUrl);
  async function manageCall(body) {
    if (mg && mg.sample) {
      await new Promise((r) => setTimeout(r, 400));
      if (body.action === 'look') return { status: 200, data: { ok: true, ...mg.sample } };
      if (body.action === 'move') return { status: 200, data: { ok: true, action: 'move', start: body.slot, changesLeft: Math.max(0, mg.changesLeft - 1) } };
      return { status: 200, data: { ok: true, action: 'cancel' } };
    }
    if (!MANAGE_LIVE) return { status: 0, data: null };
    return call(SITE.bookingManageUrl, { method: 'POST', body });
  }

  async function look(key) {
    if (!key) return;
    render('mfind');
    const { status, data } = await manageCall({ key, action: 'look' });
    if (!isOpen()) return;
    if (status === 200 && data && data.ok) {
      mg = { ...mg, key, start: new Date(data.start), end: new Date(data.end), name: String(data.name || ''), changesLeft: Number(data.changesLeft) || 0 };
      show('mview'); return;
    }
    const code = data && data.error;
    if (code === 'not_found' || code === 'started') { show('mmissing', code); return; }
    show('mfail');
  }

  async function change(action) {
    if (busy || !mg) return;
    busy = true;
    render(action === 'move' ? 'mconfirm' : 'mcancel');
    const { status, data } = await manageCall({ key: mg.key, action, ...(action === 'move' ? { slot: mg.to.toISOString(), tz } : {}) });
    busy = false;
    if (!isOpen()) return;
    const code = data && data.error;
    if (status === 200 && data && data.ok) {
      if (action === 'move') { mg.start = new Date(data.start); mg.changesLeft = Number(data.changesLeft) || 0; show('mmoved'); }
      else show('mcancelled');
      return;
    }
    if (code === 'taken' || code === 'slot' || code === 'same_time') {
      notice = code === 'same_time' ? 'That’s your current time. Please pick another.' : 'Sorry, that time was just taken. Please pick another.';
      await showCalendar(); return;
    }
    if (code === 'no_changes_left') { mg.changesLeft = 0; mgMsg = ''; show('mview'); return; }
    if (code === 'not_found' || code === 'started') { show('mmissing', code); return; }
    show('mfail');
  }

  const valid = (v) => SERVICE_OPTIONS.some(([o]) => o && o === v);
  const reset = (preselect = '') => {
    day = null; month = null; slot = null; req = {}; notice = ''; fallback = false; busy = false; mg = null; mgMsg = '';
    service = valid(preselect) ? preselect : (valid((getContext() || {}).service) ? getContext().service : '');
  };

  if (inline) {
    let started = false;
    // Without a start() call the visitor still sees the times once they reach this section (see src/home.js).
    const start = () => { if (started) return; started = true; reset(); showCalendar(false); };
    return { open: () => false, start };
  }

  const open = (preselect = '') => {
    if (typeof dlg.showModal !== 'function') return false;
    reset(preselect);
    dlg.showModal();
    showCalendar();
    return true;
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="contact/#contact-form-area"], [data-book]');
    if (!a) return;
    if (open(a.dataset.bookService || '')) e.preventDefault();
  });

  // Opened from the private link in the invite or a reminder (src/home.js).
  const manage = (key) => {
    if (typeof dlg.showModal !== 'function' || !MANAGE_KEY.test(String(key))) return false;
    reset();
    mg = key === 'preview'
      ? { key, sample: { start: new Date(sampleStart()).toISOString(), end: new Date(sampleStart() + 30 * 60e3).toISOString(), name: 'Dana', changesLeft: 2 } }
      : { key };
    dlg.showModal();
    look(key);
    return true;
  };

  return { open, start: () => {}, manage };
}

const CHANGES_TEXT = 'twice';
// Preview only: a sample booking three days from now at 10:00 Philippine time.
function sampleStart() {
  const d = new Date(Date.now() + 3 * 86400e3);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 2, 0);
}
