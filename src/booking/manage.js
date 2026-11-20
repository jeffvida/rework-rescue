// Change or cancel a booking. Run inside the n8n booking workflow (tools/build_n8n.mjs
// copies this file in with slots.js and check.js; import lines are dropped there). 20 Nov 2026, Jeff: automated.
//
// How it fits together (kept simple, 20 Nov: no timer that keeps checking)
//  - Every booking's Google Calendar event carries private details (extendedProperties.private, visible only on
//    Jeff's calendar): a random key, the visitor's name, email and time zone, and how many times it was changed.
//  - The invite and reminders link to https://rework-rescue.vercel.app/#booking=KEY. The pop-up sends that key to
//    the rr-manage webhook to look the booking up, move it (same event, same Meet link) or cancel it.
//  - Reminders wait inside the booking's own run. A move starts a new wait for the new time; the old wait wakes,
//    sees the time changed (or the event cancelled) and sends nothing.
//
// Keep this file free of browser/Node-only APIs: it must run inside an n8n Code node.
import { RULES, isAllowedSlot } from './slots.js';
import { fmtHost, fmtSheet } from './check.js';

export const CHANGE_RULES = {
  maxChanges: 2,            // a visitor can move one booking twice; after that, "reply to the invite"
  // New times follow the normal booking rules in slots.js (12 hours' notice, up to 28 days ahead).
  // Moving or cancelling is possible until the review starts.
};
export const SITE_URL = 'https://rework-rescue.vercel.app/';
export const EVENT_TITLE = 'Free review with Jeff (Rework Rescue)';
export const KEY_RE = /^[A-Za-z0-9]{24,64}$/;

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
export function bookingProps({ key, name, email, tz }) {
  return {
    rr: '1', rrKey: key, rrName: name, rrEmail: email, rrTz: tz || '', rrChanges: '0',
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
        extendedProperties: { private: { ...p, rrChanges: String(changes + 1) } },
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
