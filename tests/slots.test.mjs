// Booking slot rules (src/booking/slots.js), shared by the n8n workflow and the pop-up fallback. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, candidateSlots, freeSlots, isAllowedSlot } from '../src/booking/slots.js';

// Philippine time (UTC+8) to an ISO instant.
const ph = (s) => new Date(`${s}+08:00`).toISOString();
const has = (list, s) => list.includes(Date.parse(ph(s)));

// Wednesday 28 Oct 2026, 09:00 Philippine time. Mon 2 Nov is the next Monday.
const NOW = Date.parse(ph('2026-10-28T09:00:00'));
const slots = candidateSlots(NOW);

test('weekday windows run 8:00 am to 2:00 am the next night', () => {
  assert.ok(has(slots, '2026-11-02T08:00:00'), 'Mon 8:00 am');
  assert.ok(has(slots, '2026-11-03T01:30:00'), 'Mon night 1:30 am (Tue early hours)');
  assert.ok(!has(slots, '2026-11-03T02:00:00'), 'no 2:00 am start');
  assert.ok(!has(slots, '2026-11-02T07:30:00'), 'nothing before 8:00 am');
  assert.ok(!has(slots, '2026-11-02T08:15:00'), 'only on the half hour');
});

test('Friday night runs into Saturday; weekends start nothing', () => {
  assert.ok(has(slots, '2026-10-31T01:30:00'), 'Sat 1:30 am belongs to Friday');
  assert.ok(!has(slots, '2026-10-31T08:00:00'), 'no Saturday daytime');
  assert.ok(!has(slots, '2026-11-01T08:00:00'), 'no Sunday daytime');
  assert.ok(!has(slots, '2026-11-02T00:30:00'), 'Sunday has no late-night window');
});

test('each full weekday offers 36 half-hour slots', () => {
  const start = Date.parse(ph('2026-11-04T08:00:00'));
  const end = Date.parse(ph('2026-11-05T02:00:00'));
  assert.equal(slots.filter((t) => t >= start && t < end).length, 36);
});

test('minimum notice and booking horizon are respected', () => {
  const earliest = NOW + RULES.minNoticeHours * 3600e3;
  assert.ok(slots.every((t) => t >= earliest), 'nothing inside the notice period');
  assert.ok(!has(slots, '2026-10-28T20:30:00'), 'today 8:30 pm is under 12 hours away');
  assert.ok(has(slots, '2026-10-28T21:00:00'), 'today 9:00 pm is exactly 12 hours away');
  assert.ok(slots.every((t) => t <= NOW + RULES.daysAhead * 86400e3), 'nothing past the horizon');
  assert.deepEqual([...slots].sort((a, b) => a - b), slots, 'sorted');
});

test('busy calendar periods remove overlapping slots only', () => {
  const busy = [{ start: ph('2026-11-02T10:00:00'), end: ph('2026-11-02T11:00:00') },
    { start: ph('2026-11-02T13:10:00'), end: ph('2026-11-02T13:20:00') }];
  const free = freeSlots(NOW, busy);
  assert.ok(has(free, '2026-11-02T09:30:00'), 'ends as busy starts: free');
  assert.ok(!has(free, '2026-11-02T10:00:00'));
  assert.ok(!has(free, '2026-11-02T10:30:00'));
  assert.ok(has(free, '2026-11-02T11:00:00'), 'starts as busy ends: free');
  assert.ok(!has(free, '2026-11-02T13:00:00'), 'short meeting inside the slot blocks it');
  assert.equal(free.length, slots.length - 3);
});

test('isAllowedSlot accepts only exact rule times', () => {
  assert.equal(isAllowedSlot(ph('2026-11-02T08:00:00'), NOW), true);
  assert.equal(isAllowedSlot(ph('2026-11-02T08:15:00'), NOW), false);
  assert.equal(isAllowedSlot(ph('2026-11-07T10:00:00'), NOW), false, 'Saturday');
  assert.equal(isAllowedSlot('not a date', NOW), false);
  assert.equal(isAllowedSlot(ph('2026-10-28T10:00:00'), NOW), false, 'too soon');
});
