// Booking slot rules: the ONE place that decides which times can be booked.
//
// Used in two places:
//  - the n8n workflow (copied into its Code nodes by tools/build_n8n.mjs), which checks Google Calendar
//    and returns only the free slots, and re-checks a slot before booking it;
//  - the booking pop-up (src/ui/booking.js), only as a fallback while n8n isn't connected.
//
// Change the hours here, run `node tools/build_n8n.mjs`, and re-import n8n/rework-review-booking.json.
// Keep this file free of imports and browser/Node-only APIs: it must run inside an n8n Code node.

export const RULES = {
  hostOffsetHours: 8,          // Philippine time, UTC+8, no daylight saving
  days: [1, 2, 3, 4, 5],       // days a window STARTS on (0 = Sunday): Monday to Friday
  start: '08:00',              // first start time, Philippine time
  end: '02:00',                // window ends at this time; earlier than start means the next day (Fri 8:00 am to Sat 2:00 am)
  slotMinutes: 30,             // meeting length, and the step between start times
  minNoticeHours: 12,          // no bookings sooner than this
  daysAhead: 28,               // how far ahead people can book
};

const MIN = 60e3;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Every bookable start time (ms since epoch, UTC) from now, before checking the calendar. */
export function candidateSlots(nowMs, rules = RULES) {
  const off = rules.hostOffsetHours * 60 * MIN;
  const startMin = toMinutes(rules.start);
  let endMin = toMinutes(rules.end);
  if (endMin <= startMin) endMin += 24 * 60;
  const earliest = nowMs + rules.minNoticeHours * 60 * MIN;
  const latest = nowMs + rules.daysAhead * 24 * 60 * MIN;

  // Host-local midnight of "today", as a UTC timestamp. Start one day back so a window that began
  // yesterday evening and runs past midnight is still included.
  const hostNow = new Date(nowMs + off);
  const todayMidnight = Date.UTC(hostNow.getUTCFullYear(), hostNow.getUTCMonth(), hostNow.getUTCDate()) - off;

  const out = [];
  for (let i = -1; i <= rules.daysAhead + 1; i++) {
    const dayStart = todayMidnight + i * 24 * 60 * MIN;
    const weekday = new Date(dayStart + off).getUTCDay();
    if (!rules.days.includes(weekday)) continue;
    for (let m = startMin; m + rules.slotMinutes <= endMin; m += rules.slotMinutes) {
      const t = dayStart + m * MIN;
      if (t >= earliest && t <= latest) out.push(t);
    }
  }
  return out;
}

/** Free start times: candidates that don't overlap any busy period ({start, end} ISO strings). */
export function freeSlots(nowMs, busy = [], rules = RULES) {
  const periods = busy
    .map((b) => [Date.parse(b.start), Date.parse(b.end)])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e));
  const len = rules.slotMinutes * MIN;
  return candidateSlots(nowMs, rules).filter((t) => !periods.some(([s, e]) => t < e && t + len > s));
}

/** True if this exact start time (ISO string) is one the rules allow. Does not check the calendar. */
export function isAllowedSlot(iso, nowMs, rules = RULES) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return candidateSlots(nowMs, rules).includes(t);
}
