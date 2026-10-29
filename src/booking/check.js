// Booking request checks, run inside the n8n workflow before anything touches the calendar.
// The pop-up validates too, but the webhook is public, so these checks are the real gate.
// Copied into n8n by tools/build_n8n.mjs together with slots.js (the import line is dropped there).
import { RULES, isAllowedSlot } from './slots.js';

export const BOOKING_LIMITS = {
  name: 80, email: 254, company: 120, process: 400, summary: 2000, tz: 64,
  perEmailUpcoming: 1,     // one upcoming review per email address
  perDay: 6,               // new bookings accepted in any 24 hours, across everyone
};

// The opening of the calendar invite the visitor receives. Update the link if the site moves to its own domain.
export const INVITE_PREP = [
  'Bring one report or check your team keeps redoing. Examples: https://rework-rescue.vercel.app/#samples',
  'No files or prep needed. Please leave out anything confidential.',
  '',
  'Your details',
];

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const fmtHost = (ms) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(ms));

/**
 * @param {object} body     the JSON the pop-up sent
 * @param {number} nowMs
 * @param {{email:string, slot:string, at:number}[]} history  bookings this workflow accepted before
 * @returns {{ok:true, booking:object, event:object, notify:object} | {ok:false, status:number, code:string}}
 */
export function checkBooking(body, nowMs, history = [], rules = RULES) {
  const b = body && typeof body === 'object' ? body : {};
  // Honeypot: a hidden field people never fill in. Pretend it worked so bots don't learn anything.
  if (clean(b.website, 200)) return { ok: false, status: 200, code: 'ok' };

  const name = clean(b.name, BOOKING_LIMITS.name + 1);
  const email = clean(b.email, BOOKING_LIMITS.email + 1).toLowerCase();
  const company = clean(b.company, BOOKING_LIMITS.company);
  const process = clean(b.process, BOOKING_LIMITS.process);
  const summary = String(b.summary ?? '').replace(/\r/g, '').trim().slice(0, BOOKING_LIMITS.summary);
  const tz = clean(b.tz, BOOKING_LIMITS.tz);
  const slot = clean(b.slot, 40);

  if (!name || name.length > BOOKING_LIMITS.name) return { ok: false, status: 400, code: 'name' };
  if (!EMAIL.test(email) || email.length > BOOKING_LIMITS.email) return { ok: false, status: 400, code: 'email' };
  if (!isAllowedSlot(slot, nowMs, rules)) return { ok: false, status: 400, code: 'slot' };

  const startMs = Date.parse(slot);
  const endMs = startMs + rules.slotMinutes * 60e3;
  const upcoming = history.filter((h) => h.email === email && Date.parse(h.slot) > nowMs);
  if (upcoming.length >= BOOKING_LIMITS.perEmailUpcoming) return { ok: false, status: 429, code: 'already_booked' };
  if (history.filter((h) => nowMs - h.at < 24 * 3600e3).length >= BOOKING_LIMITS.perDay) return { ok: false, status: 429, code: 'busy' };

  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();
  const whenHost = `${fmtHost(startMs)} Philippine time`;
  const footer = '\nBooked through the Rework Rescue website.';
  const resultLine = summary ? `\nFind Your Rework result:\n${summary}` : '';

  // Invite: what the visitor sees. No time zone line; Google Calendar already shows their local time.
  const inviteLines = [
    `Name: ${name}`, `Email: ${email}`, company ? `Company: ${company}` : '',
    process ? `Report or process: ${process}` : '', resultLine, footer,
  ].filter(Boolean);

  // Notification: what Jeff sees. Keeps the visitor's time zone.
  const notifyLines = [
    `Name: ${name}`, `Email: ${email}`, company ? `Company: ${company}` : '',
    process ? `Report or process: ${process}` : '', tz ? `Visitor's time zone: ${tz}` : '',
    resultLine, footer,
  ].filter(Boolean);

  return {
    ok: true,
    booking: { name, email, company, process, summary, tz, start, end },
    event: {
      summary: 'Free rework review with Jeff (Rework Rescue)',
      description: [...INVITE_PREP, ...inviteLines].join('\n'),
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: [{ email, displayName: name }],
      conferenceData: { createRequest: { requestId: `rr-${startMs}-${Math.random().toString(36).slice(2, 10)}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: true },
    },
    notify: {
      subject: `New rework review: ${name}${company ? ` (${company})` : ''}, ${whenHost}`,
      text: [`New free rework review booked for ${whenHost}.`, '', ...notifyLines, '', 'The calendar invite with the Meet link has been sent to them.'].join('\n'),
    },
  };
}

/**
 * Clear remembered bookings so an email can book again (Jeff's reset link; doesn't touch the calendar or sheet).
 * `email` is one address (any case), or 'all' to clear the whole list.
 * @returns {{history:object[], removed:number}}
 */
export function forgetBooking(history, email) {
  const list = history || [];
  const target = String(email ?? '').trim().toLowerCase();
  if (!target) return { history: list, removed: 0 };
  const kept = target === 'all' ? [] : list.filter((h) => h.email !== target);
  return { history: kept, removed: list.length - kept.length };
}

/** Bookings worth remembering for the limits: drop entries more than a day old whose slot has passed. */
export function pruneHistory(history, nowMs) {
  return (history || []).filter((h) => Date.parse(h.slot) > nowMs || nowMs - h.at < 24 * 3600e3);
}

// Google Sheet log: one row per booking. Create a sheet whose first row has exactly these headers.
export const SHEET_COLUMNS = [
  'Booked at (PH)', 'Review time (PH)', 'Review time (UTC)', 'Name', 'Email', 'Company',
  'Report or process', 'Visitor time zone', 'Find Your Rework result', 'Meet link', 'Calendar link', 'Status',
];

const fmtSheet = (ms) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(ms)).replace(',', '');

/** The sheet row for a booking that went through. Status starts as "Booked" for Jeff to update by hand. */
export function sheetRow(booking, { meet = '', eventLink = '', nowMs = Date.now() } = {}) {
  // A leading = + - @ would make Sheets treat a visitor's text as a formula; prefix those with an apostrophe.
  const safe = (v) => { const s = String(v ?? ''); return /^[=+\-@]/.test(s) ? `'${s}` : s; };
  const values = [
    fmtSheet(nowMs), fmtSheet(Date.parse(booking.start)), booking.start, booking.name, booking.email, booking.company,
    booking.process, booking.tz, booking.summary, meet, eventLink, 'Booked',
  ];
  return Object.fromEntries(SHEET_COLUMNS.map((c, i) => [c, i < 3 ? values[i] : safe(values[i])]));
}

// ---------------------------------------------------------------- Reminder emails to the visitor
// Sent by the workflow 1 day and 1 hour before the review, in the visitor's own time zone.
const SITE_EXAMPLES = 'https://rework-rescue.vercel.app/#samples';

function visitorTime(ms, tz) {
  const opts = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  try { return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz || 'Asia/Manila' }).format(new Date(ms)); }
  catch { return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'Asia/Manila' }).format(new Date(ms)); }
}

/**
 * When to send each reminder, and what it says.
 * The 1-day reminder is skipped when the booking is made less than a day (plus 5 minutes) ahead.
 */
export function planReminders(booking, { meet = '', nowMs = Date.now() } = {}) {
  const startMs = Date.parse(booking.start);
  const when = visitorTime(startMs, booking.tz);
  const first = String(booking.name || '').split(' ')[0] || 'there';
  const join = meet ? `Join with Google Meet: ${meet}` : 'The Google Meet link is in your calendar invite.';
  const sign = ['Jeff Herson Vida', 'Rework Rescue · Less rework. More real work.'];
  return {
    start: booking.start,
    email: booking.email,
    dayAt: new Date(startMs - 24 * 3600e3).toISOString(),
    hourAt: new Date(startMs - 3600e3).toISOString(),
    sendDay: startMs - 24 * 3600e3 > nowMs + 5 * 60e3,
    day: {
      subject: 'Reminder: your free rework review is tomorrow',
      text: [
        `Hi ${first},`, '',
        'A quick reminder of your free 30-minute rework review with me tomorrow:', when, join, '',
        `Before the call, have one report, check or workflow in mind that your team keeps redoing, like the examples on my site: ${SITE_EXAMPLES}`,
        'No preparation or files needed, and please leave out anything confidential.', '',
        'Need to change the time? Just reply to this email.', '', ...sign,
      ].join('\n'),
    },
    hour: {
      subject: 'Starting in an hour: your free rework review',
      text: [`Hi ${first},`, '', `Your free rework review starts in an hour: ${when}.`, join, '', 'See you soon,', ...sign].join('\n'),
    },
  };
}
