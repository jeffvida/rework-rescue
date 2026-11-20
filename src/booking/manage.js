// Change or cancel a booking, and the reminder sweep. Run inside the n8n booking workflow (tools/build_n8n.mjs
// copies this file in with slots.js and check.js; import lines are dropped there). 20 Nov 2026, Jeff: automated.
//
// How it fits together
//  - Every booking's Google Calendar event carries private details (extendedProperties.private, visible only on
//    Jeff's calendar): a random key, the visitor's name, email and time zone, the start the workflow knows about,
//    how many times it was changed, and which reminders went out.
//  - The invite and reminders link to https://rework-rescue.vercel.app/#booking=KEY. The pop-up sends that key to
//    the rr-manage webhook to look the booking up, move it (same event, same Meet link) or cancel it.
//  - Every 10 minutes the workflow reads the calendar and the bookings sheet (sweepReminders): it sends reminders
//    that are due for the event's CURRENT time, notices when Jeff moved or cancelled a review in Google Calendar,
//    or the visitor declined the invite, and keeps the sheet in step.
//
// Keep this file free of browser/Node-only APIs: it must run inside an n8n Code node.
import { RULES, isAllowedSlot } from './slots.js';
import { fmtHost, fmtSheet, reminderEmail } from './check.js';

export const CHANGE_RULES = {
  maxChanges: 2,            // a visitor can move one booking twice; after that, "reply to the invite"
  // New times follow the normal booking rules in slots.js (12 hours' notice, up to 28 days ahead).
  // Moving or cancelling is possible until the review starts.
};
export const SITE_URL = 'https://rework-rescue.vercel.app/';
export const EVENT_TITLE = 'Free review with Jeff (Rework Rescue)';
export const KEY_RE = /^[A-Za-z0-9]{24,64}$/;
export const LIST_DAYS = 60; // how far ahead the sweep reads the calendar (bookings go 28 days ahead)

const HOUR_MS = 3600e3;
const MINUTE_MS = 60e3;

/** The visitor's private link. A #fragment, so the key never reaches a server log or another site. */
export const changeLink = (key) => `${SITE_URL}#booking=${key}`;

/** Fallback key if the n8n Crypto node didn't supply one (it normally does). */
export function newKey(rand = Math.random) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let k = '';
  for (let i = 0; i < 32; i++) k += abc[Math.floor(rand() * abc.length) % abc.length];
  return k;
}

/** What a new booking keeps on its calendar event. Google needs every value as a string. */
export function bookingProps({ key, name, email, tz, start, nowMs }) {
  return {
    rr: '1', rrKey: key, rrName: name, rrEmail: email, rrTz: tz || '', rrStart: new Date(Date.parse(start)).toISOString(),
    rrSet: String(nowMs), rrChanges: '0', rrDay: '', rrHour: '', rrState: '',
  };
}

const iso = (ms) => new Date(ms).toISOString();
const props = (ev) => ({ ...((ev && ev.extendedProperties && ev.extendedProperties.private) || {}) });
const sheetTimes = (ms) => ({ 'Review time (PH)': fmtSheet(ms), 'Review time (UTC)': iso(ms) });
const host = (ms) => `${fmtHost(ms)} Philippine time`;

// ---------------------------------------------------------------- rr-manage webhook

/**
 * First check of a change request, before Google is asked anything.
 * body: { key, action: 'look' | 'move' | 'cancel', slot? (ISO, for move) }
 */
export function checkChange(body, nowMs, rules = RULES) {
  const b = body && typeof body === 'object' ? body : {};
  const key = String(b.key ?? '').trim();
  const action = String(b.action ?? '');
  if (!KEY_RE.test(key)) return { ok: false, status: 404, code: 'not_found' };
  if (!['look', 'move', 'cancel'].includes(action)) return { ok: false, status: 400, code: 'action' };
  if (action !== 'move') return { ok: true, key, action };
  const slot = String(b.slot ?? '').slice(0, 40);
  if (!isAllowedSlot(slot, nowMs, rules)) return { ok: false, status: 400, code: 'slot' };
  const startMs = Date.parse(slot);
  return { ok: true, key, action, start: iso(startMs), end: iso(startMs + rules.slotMinutes * MINUTE_MS) };
}

/**
 * Decide what to do, given the request (checkChange) and Google's answer to
 * events?privateExtendedProperty=rrKey=KEY. Returns what to answer, and for move/cancel what to change.
 */
export function decideChange(req, list, nowMs, rules = CHANGE_RULES) {
  const no = (status, code) => ({ ok: false, status, code, respond: { ok: false, error: code } });
  const items = (list && Array.isArray(list.items)) ? list.items : [];
  const ev = items.find((e) => e && e.status !== 'cancelled' && props(e).rrKey === req.key && e.start && e.start.dateTime);
  if (!ev) return no(404, 'not_found');
  const p = props(ev);
  const startMs = Date.parse(ev.start.dateTime);
  const endMs = Date.parse((ev.end && ev.end.dateTime) || '') || startMs + 30 * MINUTE_MS;
  if (!(startMs > nowMs)) return no(410, 'started');
  const changes = Number(p.rrChanges) || 0;
  const left = Math.max(0, rules.maxChanges - changes);
  const name = p.rrName || '';
  const first = name.split(' ')[0] || '';
  const base = { eventId: ev.id, link: ev.htmlLink || '', email: p.rrEmail || '', from: iso(startMs) };

  if (req.action === 'look') {
    return { ok: true, status: 200, action: 'look', respond: { ok: true, start: iso(startMs), end: iso(endMs), name: first, changesLeft: left } };
  }

  const who = [`Name: ${name}`, `Email: ${p.rrEmail || ''}`, p.rrTz ? `Visitor's time zone: ${p.rrTz}` : ''].filter(Boolean);

  if (req.action === 'move') {
    if (left <= 0) return no(409, 'no_changes_left');
    const toMs = Date.parse(req.start);
    if (toMs === startMs) return no(400, 'same_time');
    return {
      ok: true, status: 200, action: 'move', ...base, to: iso(toMs),
      patch: {
        start: { dateTime: req.start }, end: { dateTime: req.end },
        extendedProperties: { private: { ...p, rrStart: iso(toMs), rrSet: String(nowMs), rrChanges: String(changes + 1), rrDay: '', rrHour: '', rrState: '' } },
      },
      sheet: { 'Calendar link': ev.htmlLink || '', ...sheetTimes(toMs), Status: 'Rescheduled' },
      notify: {
        subject: `Review moved: ${name}, now ${host(toMs)}`,
        text: [`${name} moved their free review using the change link.`, '', `From: ${host(startMs)}`, `To:   ${host(toMs)}`, '',
          ...who, '', 'The calendar event and their invite are updated. The Meet link stays the same.',
          `Changes used: ${changes + 1} of ${rules.maxChanges}.`].join('\n'),
      },
      respond: { ok: true, action: 'move', start: iso(toMs), end: req.end, changesLeft: left - 1 },
    };
  }

  // cancel
  return {
    ok: true, status: 200, action: 'cancel', ...base, to: null,
    sheet: { 'Calendar link': ev.htmlLink || '', Status: 'Cancelled' },
    notify: {
      subject: `Review cancelled: ${name}, ${host(startMs)}`,
      text: [`${name} cancelled their free review using the change link.`, '', `Was: ${host(startMs)}`, '', ...who, '',
        'The calendar event is cancelled and Google has told them. Their email can book again.'].join('\n'),
    },
    respond: { ok: true, action: 'cancel' },
  };
}

// ---------------------------------------------------------------- 10-minute sweep: reminders and keeping in step

/** "2026-11-24 09:00" (or with seconds) in Philippine time, as the sheet shows it. */
function parsePh(v) {
  const m = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})[ T,]+(\d{1,2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5]);
}
function rowStart(row) {
  const utc = String(row['Review time (UTC)'] ?? '');
  if (/Z$|[+-]\d\d:\d\d$/.test(utc) && Number.isFinite(Date.parse(utc))) return Date.parse(utc);
  return parsePh(row['Review time (PH)']);
}

/**
 * @param {object} list   Google events.list for now .. now + LIST_DAYS (singleEvents), ALL events on the calendar
 * @param {object[]} rows the bookings sheet rows (header names as keys)
 * @param {number} nowMs
 * @returns {{items: object[], moves: {email, from, to}[]}}
 *   items: one per thing to do, with any of
 *     eventId + patch  (update the event's private details; done BEFORE the email so a reminder is never sent twice)
 *     email            ({to, subject, text})
 *     sheet            (row update, matched on 'Calendar link')
 *   moves: for the remembered bookings (to = null: cancelled)
 */
export function sweepReminders(list, rows, nowMs) {
  if (!list || !Array.isArray(list.items)) throw new Error('Google Calendar list missing: ' + JSON.stringify(list).slice(0, 300));
  const complete = !list.nextPageToken;
  const events = list.items.filter((e) => e && e.status !== 'cancelled');
  const links = new Set(events.map((e) => e.htmlLink).filter(Boolean));
  const rowByLink = new Map((rows || []).filter((r) => r && r['Calendar link']).map((r) => [r['Calendar link'], r]));
  const items = [];
  const moves = [];

  for (const ev of events) {
    let p = props(ev);
    const row = rowByLink.get(ev.htmlLink);
    const tagged = p.rr === '1';
    // Bookings made before 20 Nov have no private details: adopt them from their sheet row (no change link).
    const legacy = !tagged && ev.summary === EVENT_TITLE && !!row;
    if (!tagged && !legacy) continue;
    if (!ev.start || !ev.start.dateTime) continue;
    const startMs = Date.parse(ev.start.dateTime);
    if (!(startMs > nowMs)) continue;
    const start = iso(startMs);
    let changed = false;
    let sheet = null;
    if (legacy) {
      const guest0 = (ev.attendees || []).find((a) => a && !a.organizer && !a.self) || {};
      const bookedAt = parsePh(row['Booked at (PH)']);
      p = {
        rr: '1', rrKey: '', rrName: row.Name || guest0.displayName || '', rrEmail: String(row.Email || guest0.email || '').toLowerCase(),
        rrTz: row['Visitor time zone'] || '', rrStart: start, rrSet: String(Number.isFinite(bookedAt) ? bookedAt : 0),
        rrChanges: '0', rrDay: '', rrHour: '', rrState: '',
      };
      changed = true;
    }

    const guest = (ev.attendees || []).find((a) => a && String(a.email || '').toLowerCase() === p.rrEmail);
    if (guest && guest.responseStatus === 'declined') {
      if (p.rrState !== 'declined') items.push({ eventId: ev.id, patch: { extendedProperties: { private: { ...p, rrState: 'declined' } } }, sheet: { 'Calendar link': ev.htmlLink, Status: 'Declined' } });
      else if (changed) items.push({ eventId: ev.id, patch: { extendedProperties: { private: p } } });
      continue; // no reminders for a declined invite
    }
    if (p.rrState === 'declined') { p.rrState = ''; changed = true; sheet = { 'Calendar link': ev.htmlLink, Status: 'Booked' }; }

    // Moved in Google Calendar (by Jeff, or by a change the sweep hasn't seen): follow the new time.
    if (Date.parse(p.rrStart) !== startMs) {
      moves.push({ email: p.rrEmail, from: p.rrStart, to: start });
      p = { ...p, rrStart: start, rrSet: String(nowMs) };
      changed = true;
      sheet = { 'Calendar link': ev.htmlLink, ...sheetTimes(startMs), Status: 'Rescheduled' };
    }

    // Reminders for the event's current time. The sweep runs every 10 minutes.
    let email = null;
    const ahead = startMs - nowMs;
    const data = { name: p.rrName, email: p.rrEmail, tz: p.rrTz, start, meet: ev.hangoutLink || '', key: p.rrKey };
    if (p.rrHour !== start && ahead <= HOUR_MS && ahead > 10 * MINUTE_MS) {
      email = reminderEmail('hour', data);
      p = { ...p, rrHour: start, rrDay: start };
    } else if (p.rrDay !== start && ahead <= 24 * HOUR_MS && ahead > 2 * HOUR_MS && startMs - (Number(p.rrSet) || 0) >= 24 * HOUR_MS + 5 * MINUTE_MS) {
      // Skipped when the booking (or the last move) was made less than a day ahead, as before.
      email = reminderEmail('day', data);
      p = { ...p, rrDay: start };
    }
    if (email && !p.rrEmail) email = null;
    if (changed || email) items.push({ eventId: ev.id, patch: { extendedProperties: { private: p } }, ...(email ? { email } : {}), ...(sheet ? { sheet } : {}) });
  }

  // Cancelled in Google Calendar: a sheet row still "Booked" or "Rescheduled" whose event is gone.
  // Only when Google's list is complete, so a short or failed read never marks real bookings as cancelled.
  if (complete) {
    for (const row of rows || []) {
      const link = row && row['Calendar link'];
      const t = row ? rowStart(row) : NaN;
      if (!link || !['Booked', 'Rescheduled'].includes(String(row.Status || '').trim())) continue;
      if (!(t > nowMs && t < nowMs + (LIST_DAYS - 1) * 24 * HOUR_MS) || links.has(link)) continue;
      items.push({ sheet: { 'Calendar link': link, Status: 'Cancelled' } });
      moves.push({ email: String(row.Email || '').toLowerCase(), from: iso(t), to: null });
    }
  }
  return { items, moves };
}
