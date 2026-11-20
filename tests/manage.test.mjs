// Change/cancel links and the 10-minute reminder sweep (src/booking/manage.js). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkChange, decideChange, sweepReminders, changeLink, CHANGE_RULES, EVENT_TITLE } from '../src/booking/manage.js';
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
  assert.equal(p.rrStart, to);
  assert.equal(p.rrChanges, '1');
  assert.equal(p.rrDay, '');
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

// ---- sweep
const at = (s) => Date.parse(ph(s));

test('sweep: 1-day reminder once, in the window, marked on the event first', () => {
  const ev = eventFor();
  assert.equal(sweepReminders(list(ev), [], at('2026-11-01T09:00:00')).items.length, 0, '25 hours ahead: nothing yet');
  const r = sweepReminders(list(ev), [], at('2026-11-01T10:05:00'));
  assert.equal(r.items.length, 1);
  const it = r.items[0];
  assert.equal(it.eventId, 'ev1');
  assert.equal(it.patch.extendedProperties.private.rrDay, SLOT);
  assert.equal(it.email.to, 'ana@example.com');
  assert.match(it.email.subject, /tomorrow/);
  assert.match(it.email.text, new RegExp(`#booking=${KEY}`));
  ev.extendedProperties.private = it.patch.extendedProperties.private;
  assert.equal(sweepReminders(list(ev), [], at('2026-11-01T10:15:00')).items.length, 0, 'not sent twice');
});

test('sweep: 1-hour reminder once; it also covers a missed 1-day reminder', () => {
  const ev = eventFor();
  const r = sweepReminders(list(ev), [], at('2026-11-02T09:05:00'));
  assert.match(r.items[0].email.subject, /Starting in an hour/);
  assert.equal(r.items[0].patch.extendedProperties.private.rrDay, SLOT);
  ev.extendedProperties.private = r.items[0].patch.extendedProperties.private;
  assert.equal(sweepReminders(list(ev), [], at('2026-11-02T09:15:00')).items.length, 0);
  assert.equal(sweepReminders(list(eventFor()), [], at('2026-11-02T09:55:00')).items.length, 0, 'under 10 minutes to go: too late for "in an hour"');
});

test('sweep: no 1-day reminder when booked less than a day ahead', () => {
  const ev = eventFor({ bookedAt: at('2026-11-01T20:00:00') });
  assert.equal(sweepReminders(list(ev), [], at('2026-11-01T20:10:00')).items.length, 0);
  assert.match(sweepReminders(list(ev), [], at('2026-11-02T09:05:00')).items[0].email.subject, /in an hour/);
});

test('sweep: moved in Google Calendar by Jeff, reminders follow the new time and the sheet updates', () => {
  const ev = eventFor({ start: ph('2026-11-03T15:00:00') });
  const r = sweepReminders(list(ev), [], at('2026-10-29T09:00:00'));
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].patch.extendedProperties.private.rrStart, ph('2026-11-03T15:00:00'));
  assert.deepEqual(r.items[0].sheet, { 'Calendar link': LINK, 'Review time (PH)': '2026-11-03 15:00', 'Review time (UTC)': ph('2026-11-03T15:00:00'), Status: 'Rescheduled' });
  assert.deepEqual(r.moves, [{ email: 'ana@example.com', from: SLOT, to: ph('2026-11-03T15:00:00') }]);
  assert.equal(r.items[0].email, undefined);
  ev.extendedProperties.private = r.items[0].patch.extendedProperties.private;
  assert.match(sweepReminders(list(ev), [], at('2026-11-02T15:05:00')).items[0].email.subject, /tomorrow/, 'day reminder for the new time');
});

test('sweep: a declined invite gets no reminders and the sheet says Declined', () => {
  const ev = eventFor({ attendees: [{ email: 'ana@example.com', responseStatus: 'declined' }] });
  const r = sweepReminders(list(ev), [], at('2026-11-02T09:05:00'));
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].email, undefined);
  assert.deepEqual(r.items[0].sheet, { 'Calendar link': LINK, Status: 'Declined' });
  ev.extendedProperties.private = r.items[0].patch.extendedProperties.private;
  assert.equal(sweepReminders(list(ev), [], at('2026-11-02T09:15:00')).items.length, 0, 'marked once');
});

test('sweep: cancelled in Google Calendar (row still Booked, event gone) marks the sheet and frees the email', () => {
  const row = { 'Calendar link': 'https://www.google.com/calendar/event?eid=gone', Email: 'Ben@x.com', Status: 'Booked', 'Review time (UTC)': SLOT, 'Review time (PH)': '2026-11-02 10:00' };
  const r = sweepReminders(list(), [row], NOW);
  assert.deepEqual(r.items, [{ sheet: { 'Calendar link': row['Calendar link'], Status: 'Cancelled' } }]);
  assert.deepEqual(r.moves, [{ email: 'ben@x.com', from: SLOT, to: null }]);
  assert.equal(sweepReminders({ items: [], nextPageToken: 'more' }, [row], NOW).items.length, 0, 'an incomplete list never cancels anything');
  assert.equal(sweepReminders(list(), [{ ...row, Status: 'Done' }], NOW).items.length, 0);
  assert.equal(sweepReminders(list(), [{ ...row, 'Review time (UTC)': '', 'Review time (PH)': '2026-10-01 10:00' }], NOW).items.length, 0, 'past rows are left alone');
  assert.equal(sweepReminders(list(), [{ ...row, 'Review time (UTC)': '2026-11-02 2:00:00' }], NOW).items.length, 1, 'falls back to the PH time column');
  assert.throws(() => sweepReminders({ error: { code: 401 } }, [row], NOW), /list missing/, 'a failed Google read stops the sweep');
});

test('sweep: bookings made before the update are adopted from their sheet row (reply instead of a link)', () => {
  const ev = { id: 'old', status: 'confirmed', summary: EVENT_TITLE, htmlLink: 'L-old', start: { dateTime: SLOT }, attendees: [{ email: 'cara@x.com' }] };
  const row = { 'Calendar link': 'L-old', Name: 'Cara Lim', Email: 'cara@x.com', 'Visitor time zone': 'America/New_York', 'Booked at (PH)': '2026-10-20 09:00', Status: 'Booked' };
  const r = sweepReminders(list(ev), [row], at('2026-11-01T10:05:00'));
  assert.equal(r.items.length, 1);
  assert.match(r.items[0].email.text, /^Hi Cara,/);
  assert.match(r.items[0].email.text, /EST/);
  assert.match(r.items[0].email.text, /reply to this email/);
  assert.equal(r.items[0].patch.extendedProperties.private.rr, '1');
  assert.equal(sweepReminders(list({ ...ev, summary: 'Dentist' }), [row], at('2026-11-01T10:05:00')).items.length, 0, 'other events are never touched');
  assert.equal(sweepReminders(list(ev), [], at('2026-11-01T10:05:00')).items.length, 0, 'no sheet row: not adopted');
});
