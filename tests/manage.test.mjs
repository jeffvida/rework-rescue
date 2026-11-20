// Change/cancel links and reminders after a move (src/booking/manage.js). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkChange, decideChange, changeLink, CHANGE_RULES } from '../src/booking/manage.js';
import { planReminders, movedReminderData } from '../src/booking/check.js';
import { checkBooking } from '../src/booking/check.js';

const ph = (s) => new Date(`${s}+08:00`).toISOString();
const NOW = Date.parse(ph('2026-10-28T09:00:00'));
const SLOT = ph('2026-11-02T10:00:00');
const KEY = 'k3y'.repeat(10) + 'ab';
const LINK = 'https://www.google.com/calendar/event?eid=abc';

// The calendar event as Google returns it after the workflow created it.
function eventFor({ start = SLOT, key = KEY, bookedAt = NOW, ...over } = {}) {
  const r = checkBooking({ name: 'Ana Reyes', email: 'ana@example.com', slot: SLOT, tz: 'Australia/Sydney' }, bookedAt, [], undefined, key);
  const startMs = Date.parse(start);
  return {
    id: 'ev1', status: 'confirmed', summary: r.event.summary, htmlLink: LINK, hangoutLink: 'https://meet.google.com/abc',
    start: { dateTime: new Date(startMs).toISOString() }, end: { dateTime: new Date(startMs + 30 * 60e3).toISOString() },
    attendees: [{ email: 'ana@example.com', responseStatus: 'needsAction' }, { email: 'jeff@x.com', organizer: true, self: true }],
    extendedProperties: r.event.extendedProperties, ...over,
  };
}
const list = (...items) => ({ items });

test('change link: a #fragment on the live site', () => {
  assert.equal(changeLink(KEY), `https://rework-rescue.vercel.app/#booking=${KEY}`);
});

test('checkChange: bad key, action or time are stopped before Google is asked', () => {
  assert.equal(checkChange({ key: 'short', action: 'look' }, NOW).code, 'not_found');
  assert.equal(checkChange({ key: `${KEY}&x=1`, action: 'look' }, NOW).code, 'not_found', 'nothing odd reaches the Google query');
  assert.equal(checkChange({ key: KEY, action: 'delete' }, NOW).code, 'action');
  assert.equal(checkChange({ key: KEY, action: 'move', slot: ph('2026-10-28T12:00:00') }, NOW).code, 'slot', 'new time follows the 12-hour notice');
  assert.equal(checkChange({ key: KEY, action: 'move', slot: ph('2026-11-07T10:00:00') }, NOW).code, 'slot', 'Saturday');
  const m = checkChange({ key: KEY, action: 'move', slot: ph('2026-11-04T10:00:00') }, NOW);
  assert.deepEqual(m, { ok: true, key: KEY, action: 'move', start: ph('2026-11-04T10:00:00'), end: ph('2026-11-04T10:30:00') });
  assert.equal(checkChange(null, NOW).ok, false);
});

test('look: first name, time and changes left only (no email back to the browser)', () => {
  const d = decideChange({ key: KEY, action: 'look' }, list(eventFor()), NOW);
  assert.deepEqual(d.respond, { ok: true, start: SLOT, end: ph('2026-11-02T10:30:00'), name: 'Ana', changesLeft: CHANGE_RULES.maxChanges });
});

test('not found, cancelled, other key, or already started', () => {
  assert.equal(decideChange({ key: KEY, action: 'look' }, list(), NOW).code, 'not_found');
  assert.equal(decideChange({ key: KEY, action: 'look' }, list(eventFor({ status: 'cancelled' })), NOW).code, 'not_found');
  assert.equal(decideChange({ key: KEY, action: 'look' }, list(eventFor({ key: 'z'.repeat(32) })), NOW).code, 'not_found');
  assert.equal(decideChange({ key: KEY, action: 'look' }, { error: 'x' }, NOW).code, 'not_found');
  const d = decideChange({ key: KEY, action: 'cancel' }, list(eventFor()), Date.parse(SLOT) + 60e3);
  assert.deepEqual([d.status, d.code], [410, 'started']);
});

test('move: same event, new time, counted, reminders reset; Jeff and the sheet told', () => {
  const to = ph('2026-11-04T10:00:00');
  const req = checkChange({ key: KEY, action: 'move', slot: to }, NOW);
  const d = decideChange(req, list(eventFor()), NOW);
  assert.equal(d.ok, true);
  assert.equal(d.eventId, 'ev1');
  assert.equal(d.patch.start.dateTime, to);
  const p = d.patch.extendedProperties.private;
  assert.equal(p.rrKey, KEY, 'the same link keeps working');
  assert.equal(p.rrChanges, '1');
  assert.deepEqual(d.sheet, { 'Calendar link': LINK, 'Review time (PH)': '2026-11-04 10:00', 'Review time (UTC)': to, Status: 'Rescheduled' });
  assert.match(d.notify.subject, /^Review moved: Ana Reyes, now Wednesday, November 4 at 10:00 AM Philippine time$/);
  assert.match(d.notify.text, /From: Monday, November 2/);
  assert.deepEqual([d.email, d.from, d.to], ['ana@example.com', SLOT, to]);
  assert.equal(d.respond.changesLeft, CHANGE_RULES.maxChanges - 1);
  assert.equal(decideChange({ ...req, start: SLOT }, list(eventFor()), NOW).code, 'same_time');
});

test('move: stops after the allowed number of changes', () => {
  const ev = eventFor();
  ev.extendedProperties.private.rrChanges = String(CHANGE_RULES.maxChanges);
  const req = checkChange({ key: KEY, action: 'move', slot: ph('2026-11-04T10:00:00') }, NOW);
  assert.equal(decideChange(req, list(ev), NOW).code, 'no_changes_left');
  assert.equal(decideChange({ key: KEY, action: 'look' }, list(ev), NOW).respond.changesLeft, 0);
  assert.equal(decideChange({ key: KEY, action: 'cancel' }, list(ev), NOW).ok, true, 'cancelling still works');
});

test('cancel: sheet Cancelled, Jeff told, email freed', () => {
  const d = decideChange({ key: KEY, action: 'cancel' }, list(eventFor()), NOW);
  assert.deepEqual(d.sheet, { 'Calendar link': LINK, Status: 'Cancelled' });
  assert.match(d.notify.subject, /^Review cancelled: Ana Reyes, Monday, November 2/);
  assert.equal(d.to, null);
  assert.deepEqual(d.respond, { ok: true, action: 'cancel' });
});

test('after a move, reminders are planned again for the new time from the updated event', () => {
  const to = ph('2026-11-04T10:00:00');
  const moved = eventFor({ start: to });
  const plan = planReminders(movedReminderData(moved), { eventId: 'ev1', nowMs: NOW });
  assert.equal(plan.start, to);
  assert.equal(plan.dayAt, ph('2026-11-03T10:00:00'));
  assert.equal(plan.hourAt, ph('2026-11-04T09:00:00'));
  assert.equal(plan.sendDay, true);
  assert.equal(plan.email, 'ana@example.com');
  assert.match(plan.day.text, /^Hi Ana,/);
  assert.match(plan.day.text, /Wednesday, November 4 at 1:00 PM GMT\+11/);
  assert.match(plan.hour.text, new RegExp(`#booking=${KEY}`));
  assert.equal(planReminders(movedReminderData(moved), { nowMs: Date.parse(ph('2026-11-03T20:00:00')) }).sendDay, false, 'moved to less than a day away: hour reminder only');
});
