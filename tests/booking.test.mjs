// Booking request checks (src/booking/check.js), the gate inside the n8n booking webhook. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBooking, pruneHistory, BOOKING_LIMITS } from '../src/booking/check.js';

const ph = (s) => new Date(`${s}+08:00`).toISOString();
const NOW = Date.parse(ph('2026-10-28T09:00:00'));
const SLOT = ph('2026-11-02T10:00:00');
const ok = { name: '  Ana  Reyes ', email: 'Ana@Example.com', company: 'Kestrel Hardware', process: 'Weekly billing report', slot: SLOT, tz: 'Australia/Sydney', website: '' };

test('a valid request becomes a calendar event with a Meet link and an invite', () => {
  const r = checkBooking(ok, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.booking.name, 'Ana Reyes');
  assert.equal(r.booking.email, 'ana@example.com');
  assert.equal(r.event.start.dateTime, SLOT);
  assert.equal(Date.parse(r.event.end.dateTime) - Date.parse(SLOT), 30 * 60e3);
  assert.deepEqual(r.event.attendees, [{ email: 'ana@example.com', displayName: 'Ana Reyes' }]);
  assert.equal(r.event.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  assert.match(r.event.summary, /Ana Reyes \(Kestrel Hardware\)/);
  assert.match(r.notify.subject, /Monday, November 2.*10:00 AM Philippine time/);
  assert.match(r.notify.text, /Australia\/Sydney/);
});

test('the invite opens with what to prepare, then the details', () => {
  const d = checkBooking(ok, NOW).event.description;
  assert.match(d, /^Before the call\nBring one report, check or workflow/);
  assert.match(d, /https:\/\/rework-rescue\.vercel\.app\/#samples/);
  assert.ok(d.indexOf('Your details') < d.indexOf('Name: Ana Reyes'));
});

test('the assessment result travels in the description when present', () => {
  const r = checkBooking({ ...ok, summary: 'Result: Reporting Rework\nAbout 6 hours a week' }, NOW);
  assert.match(r.event.description, /Find Your Rework result:\nResult: Reporting Rework/);
  assert.doesNotMatch(checkBooking(ok, NOW).event.description, /Find Your Rework/);
});

test('bad input is rejected before the calendar is touched', () => {
  assert.equal(checkBooking({ ...ok, name: '' }, NOW).code, 'name');
  assert.equal(checkBooking({ ...ok, name: 'x'.repeat(BOOKING_LIMITS.name + 1) }, NOW).code, 'name');
  for (const e of ['', 'ana', 'ana@', 'ana@example', 'a b@example.com', '<a@b.co>'])
    assert.equal(checkBooking({ ...ok, email: e }, NOW).code, 'email', e);
  assert.equal(checkBooking({ ...ok, slot: ph('2026-11-02T10:15:00') }, NOW).code, 'slot', 'off the half hour');
  assert.equal(checkBooking({ ...ok, slot: ph('2026-11-07T10:00:00') }, NOW).code, 'slot', 'Saturday');
  assert.equal(checkBooking({ ...ok, slot: ph('2026-10-28T12:00:00') }, NOW).code, 'slot', 'too soon');
  assert.equal(checkBooking(null, NOW).ok, false);
  assert.equal(checkBooking({ ...ok, name: 'Ana', company: 'y'.repeat(500) }, NOW).booking.company.length, BOOKING_LIMITS.company);
});

test('a filled honeypot answers "ok" without booking anything', () => {
  const r = checkBooking({ ...ok, website: 'http://spam.example' }, NOW);
  assert.deepEqual(r, { ok: false, status: 200, code: 'ok' });
});

test('limits: one upcoming review per email, and a daily cap overall', () => {
  const mine = [{ email: 'ana@example.com', slot: ph('2026-11-03T09:00:00'), at: NOW - 3600e3 }];
  assert.equal(checkBooking(ok, NOW, mine).code, 'already_booked');
  const past = [{ email: 'ana@example.com', slot: ph('2026-10-20T09:00:00'), at: NOW - 9 * 86400e3 }];
  assert.equal(checkBooking(ok, NOW, past).ok, true, 'an earlier review that already happened is fine');
  const many = Array.from({ length: BOOKING_LIMITS.perDay }, (_, i) => ({ email: `p${i}@x.com`, slot: ph('2026-11-04T09:00:00'), at: NOW - i * 60e3 }));
  assert.equal(checkBooking(ok, NOW, many).code, 'busy');
  assert.equal(checkBooking(ok, NOW + 25 * 3600e3, many.map((h) => ({ ...h, slot: ph('2026-11-20T09:00:00') }))).ok, true, 'cap resets after 24 hours');
});

test('pruneHistory keeps upcoming slots and the last day of bookings', () => {
  const h = [
    { email: 'a@x.com', slot: ph('2026-11-02T09:00:00'), at: NOW - 5 * 86400e3 },  // upcoming: keep
    { email: 'b@x.com', slot: ph('2026-10-27T09:00:00'), at: NOW - 3600e3 },       // past slot, recent: keep
    { email: 'c@x.com', slot: ph('2026-10-20T09:00:00'), at: NOW - 9 * 86400e3 },  // old: drop
  ];
  assert.deepEqual(pruneHistory(h, NOW).map((x) => x.email), ['a@x.com', 'b@x.com']);
});

test('sheet row: one column per header, Philippine times, formulas neutralised', async () => {
  const { sheetRow, SHEET_COLUMNS } = await import('../src/booking/check.js');
  const b = checkBooking({ ...ok, process: '=HYPERLINK("http://x")', summary: 'Result: Data Rework' }, NOW).booking;
  const row = sheetRow(b, { meet: 'https://meet.google.com/abc', eventLink: 'https://calendar.google.com/e', nowMs: NOW });
  assert.deepEqual(Object.keys(row), SHEET_COLUMNS);
  assert.equal(row['Booked at (PH)'], '2026-10-28 09:00');
  assert.equal(row['Review time (PH)'], '2026-11-02 10:00');
  assert.equal(row['Review time (UTC)'], SLOT);
  assert.equal(row['Report or process'], `'=HYPERLINK("http://x")`);
  assert.equal(row['Find Your Rework result'], 'Result: Data Rework');
  assert.equal(row.Status, 'Booked');
});

test('reminders: times, skipping the 1-day one when too close, visitor time zone', async () => {
  const { planReminders } = await import('../src/booking/check.js');
  const b = checkBooking(ok, NOW).booking; // Mon 2 Nov 10:00 PH, visitor in Sydney
  const r = planReminders(b, { meet: 'https://meet.google.com/abc', nowMs: NOW });
  assert.equal(r.dayAt, ph('2026-11-01T10:00:00'));
  assert.equal(r.hourAt, ph('2026-11-02T09:00:00'));
  assert.equal(r.sendDay, true);
  assert.match(r.day.text, /^Hi Ana,/);
  assert.match(r.day.text, /Monday, November 2 at 1:00 PM GMT\+11/, 'shown in Sydney time');
  assert.match(r.day.text, /Join with Google Meet: https:\/\/meet\.google\.com\/abc/);
  assert.match(r.day.text, /#samples/);
  assert.match(r.hour.subject, /Starting in an hour/);
  const soon = planReminders(b, { nowMs: Date.parse(ph('2026-11-01T22:00:00')) });
  assert.equal(soon.sendDay, false, 'booked 12 hours ahead: no 1-day reminder');
  assert.match(soon.hour.text, /link is in your calendar invite/);
  assert.match(planReminders({ ...b, tz: 'Not/AZone' }, { nowMs: NOW }).hour.text, /GMT\+8/, 'bad time zone falls back to PH');
});
