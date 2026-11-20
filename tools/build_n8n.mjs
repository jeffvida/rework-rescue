// Builds n8n/rework-review-booking.json, the importable n8n workflow behind the booking pop-up.
// Run: node tools/build_n8n.mjs   (after changing src/booking/slots.js or src/booking/check.js)
//
// The Code nodes get the same slot rules and request checks the tests cover, copied in as plain JavaScript.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIST_DAYS } from '../src/booking/manage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_EMAIL = 'jeffhersonvida@gmail.com';
// Which websites may call the webhooks from a browser. '*' while you test on Vercel preview links;
// once live, change it in both Webhook nodes to https://rework-rescue.vercel.app (or your own domain).
const ALLOWED_ORIGINS = 'https://rework-rescue.vercel.app'; // live since 1 Nov 2026; use '*' to test on preview links

const inline = (file) => readFileSync(join(root, file), 'utf8')
  .split('\n').filter((l) => !/^import\s/.test(l)).join('\n')
  .replace(/^export\s+/gm, '');
// Rework Rescue bookings sheet: https://docs.google.com/spreadsheets/d/<this id>/edit
const BOOKINGS_SHEET_ID = '1bBmq3a-LzWgHy41YHFqgRAgIfRcGKTz7QhoxW6MGYFQ';
const LIB = `${inline('src/booking/slots.js')}\n${inline('src/booking/manage.js')}\n${inline('src/booking/check.js')}`;

// The bookings sheet, kept in the nodes so a re-import doesn't clear it. Sheet ID 0 is the first tab.
const SHEET_DOC = { __rl: true, value: BOOKINGS_SHEET_ID, mode: 'id' };
const SHEET_TAB = { __rl: true, value: '0', mode: 'id' };
// Update the booking's row, found by its Calendar link (unique per booking). Only the columns given change.
const SHEET_UPDATE = {
  operation: 'update', documentId: SHEET_DOC, sheetName: SHEET_TAB,
  columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['Calendar link'], schema: [] },
  options: {},
};

const GCAL = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleCalendarOAuth2Api' };
const noStore = { responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-store' }] } };
const ifTrue = (id, expr) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
    conditions: [{ id, leftValue: expr, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});

const nodes = [
  {
    id: '7d0b9c1e-0001-4a51-9d1a-6f1c00000001', name: 'Setup notes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-260, -260],
    parameters: {
      width: 640, height: 340,
      content: [
        '## Process review booking (20 Nov 2026: change/cancel links + reminder sweep)',
        '1. Every **Google** HTTP Request node: pick the **Google Calendar OAuth2** credential for ' + OWNER_EMAIL + '.',
        '2. Every **Email** node: pick the **Gmail OAuth2** credential. Every **sheet** node: the **Google Sheets OAuth2** credential.',
        '3. Save and keep the workflow **Active**. Reminders now come from **Every 10 minutes**, not from waiting runs.',
        '4. Webhooks: rr-availability (GET), rr-book (POST), rr-manage (POST, change or cancel), rr-forget (GET, Basic Auth).',
        '',
        'Slot rules, checks and reminder timing come from src/booking/*.js in the site repo. Edit there and rebuild, not here.',
      ].join('\n'),
    },
  },

  // ---------- Availability: GET -> Google free/busy -> free slots
  {
    id: '7d0b9c1e-0002-4a51-9d1a-6f1c00000002', name: 'Availability request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-260, 120],
    webhookId: '5a6c2f0e-4c1b-4e8a-9a51-2b7d00000a01',
    parameters: { httpMethod: 'GET', path: 'rr-availability', responseMode: 'responseNode', options: { allowedOrigins: ALLOWED_ORIGINS } },
  },
  {
    id: '7d0b9c1e-0003-4a51-9d1a-6f1c00000003', name: 'Google: busy times', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [0, 120],
    parameters: {
      method: 'POST', url: 'https://www.googleapis.com/calendar/v3/freeBusy', ...GCAL,
      sendBody: true, specifyBody: 'json',
      // 30 days covers the 28-day booking horizon plus the overnight window.
      jsonBody: "={{ JSON.stringify({ timeMin: $now.toISO(), timeMax: $now.plus({ days: 30 }).toISO(), items: [{ id: 'primary' }] }) }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0004-4a51-9d1a-6f1c00000004', name: 'Work out free slots', type: 'n8n-nodes-base.code', typeVersion: 2, position: [240, 120],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step
const cal = (($input.first().json.calendars || {}).primary) || {};
if (cal.errors && cal.errors.length) throw new Error('Google Calendar could not be read: ' + JSON.stringify(cal.errors));
const slots = freeSlots(Date.now(), cal.busy || []).map((t) => new Date(t).toISOString());
return [{ json: { slots, minutes: RULES.slotMinutes } }];`,
    },
  },
  {
    id: '7d0b9c1e-0005-4a51-9d1a-6f1c00000005', name: 'Send slots', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [480, 120],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: noStore },
  },

  // ---------- Booking: POST -> checks -> slot still free? -> create event (Meet + invite) -> reply -> email Jeff
  {
    id: '7d0b9c1e-0006-4a51-9d1a-6f1c00000006', name: 'Booking request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-260, 440],
    webhookId: '5a6c2f0e-4c1b-4e8a-9a51-2b7d00000a02',
    parameters: { httpMethod: 'POST', path: 'rr-book', responseMode: 'responseNode', options: { allowedOrigins: ALLOWED_ORIGINS } },
  },
  {
    // A random key for the visitor's private change/cancel link (the Crypto node uses a secure random source).
    id: '7d0b9c1e-0050-4a51-9d1a-6f1c00000050', name: 'Make a change-link key', type: 'n8n-nodes-base.crypto', typeVersion: 1, position: [-40, 300],
    parameters: { action: 'generate', dataPropertyName: 'changeKey', encodingType: 'hex', stringLength: 32 },
  },
  {
    id: '7d0b9c1e-0007-4a51-9d1a-6f1c00000007', name: 'Check the request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 440],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step
const store = $getWorkflowStaticData('global');
store.bookings = pruneHistory(store.bookings, Date.now());
return [{ json: checkBooking($input.first().json.body, Date.now(), store.bookings, RULES, $input.first().json.changeKey) }];`,
    },
  },
  {
    id: '7d0b9c1e-0008-4a51-9d1a-6f1c00000008', name: 'Request OK?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [240, 440],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000001', '={{ $json.ok === true }}'),
  },
  {
    id: '7d0b9c1e-0009-4a51-9d1a-6f1c00000009', name: 'Reject', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [480, 620],
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify($json.status === 200 ? { ok: true } : { ok: false, error: $json.code }) }}',
      options: { responseCode: '={{ $json.status }}', ...noStore },
    },
  },
  {
    id: '7d0b9c1e-0010-4a51-9d1a-6f1c00000010', name: 'Google: is it still free?', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [480, 400],
    parameters: {
      method: 'POST', url: 'https://www.googleapis.com/calendar/v3/freeBusy', ...GCAL,
      sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ timeMin: $json.booking.start, timeMax: $json.booking.end, items: [{ id: 'primary' }] }) }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0011-4a51-9d1a-6f1c00000011', name: 'Still free?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [720, 400],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000002',
      '={{ !!$json.calendars && !!$json.calendars.primary && !$json.calendars.primary.errors && $json.calendars.primary.busy.length === 0 }}'),
  },
  {
    id: '7d0b9c1e-0012-4a51-9d1a-6f1c00000012', name: 'Slot taken', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [960, 580],
    parameters: { respondWith: 'json', responseBody: '{"ok":false,"error":"taken"}', options: { responseCode: 409, ...noStore } },
  },
  {
    id: '7d0b9c1e-0013-4a51-9d1a-6f1c00000013', name: 'Google: create event + invite', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [960, 380],
    parameters: {
      method: 'POST',
      // conferenceDataVersion=1 adds a Google Meet link; sendUpdates=all emails the invite to the visitor.
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', ...GCAL,
      sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify($('Check the request').first().json.event) }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0014-4a51-9d1a-6f1c00000014', name: 'Remember booking', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1200, 380],
    parameters: {
      jsCode: `// Kept for the limits in check.js (one upcoming review per email, daily cap). Only email, time and when it was booked.
const b = $('Check the request').first().json.booking;
const store = $getWorkflowStaticData('global');
store.bookings = (store.bookings || []).concat({ email: b.email, slot: b.start, at: Date.now() });
return [{ json: { start: b.start, meet: $input.first().json.hangoutLink || '' } }];`,
    },
  },
  {
    id: '7d0b9c1e-0015-4a51-9d1a-6f1c00000015', name: 'Confirm booking', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1440, 380],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ ok: true, start: $json.start, meet: $json.meet }) }}', options: noStore },
  },
  {
    id: '7d0b9c1e-0016-4a51-9d1a-6f1c00000016', name: 'Email Jeff', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [1680, 380],
    onError: 'continueRegularOutput',
    parameters: {
      sendTo: OWNER_EMAIL,
      subject: "={{ $('Check the request').first().json.notify.subject }}",
      emailType: 'text',
      message: "={{ $('Check the request').first().json.notify.text }}",
      options: { appendAttribution: false },
    },
  },
  {
    id: '7d0b9c1e-0017-4a51-9d1a-6f1c00000017', name: 'Sheet row', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1920, 380],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step: one row for the bookings log (headers in SHEET_COLUMNS)
const b = $('Check the request').first().json.booking;
const ev = $('Google: create event + invite').first().json;
return [{ json: sheetRow(b, { meet: ev.hangoutLink || '', eventLink: ev.htmlLink || '' }) }];`,
    },
  },
  {
    id: '7d0b9c1e-0018-4a51-9d1a-6f1c00000018', name: 'Log to Google Sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [2160, 380],
    // The visitor already has their answer by now; a logging problem must not undo or block the booking.
    // On an error, email Jeff the reason (successful runs aren't saved, so it would otherwise go unseen).
    onError: 'continueErrorOutput',
    parameters: {
      operation: 'append',
      // The bookings sheet, kept here so a re-import doesn't clear it. Sheet ID 0 is the first tab.
      documentId: { __rl: true, value: BOOKINGS_SHEET_ID, mode: 'id' },
      sheetName: { __rl: true, value: '0', mode: 'id' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
      options: {},
    },
  },

  {
    id: '7d0b9c1e-0043-4a51-9d1a-6f1c00000043', name: 'Email Jeff: sheet problem', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [2400, 600],
    onError: 'continueRegularOutput',
    parameters: {
      sendTo: OWNER_EMAIL,
      subject: "={{ 'Booking not logged to the sheet: ' + $('Check the request').first().json.booking.name }}",
      emailType: 'text',
      message: "={{ 'The booking went through (calendar invite sent), but adding the row to the bookings sheet failed.\\n\\nReason from Google Sheets:\\n' + ($json.error?.message || $json.error || JSON.stringify($json)) + '\\n\\nCheck the Log to Google Sheet node: credential, Document, Sheet, and that row 1 holds the headers.' }}",
      options: { appendAttribution: false },
    },
  },
  // ---------- Change or cancel (rr-manage): the visitor's private link -> look up / move / cancel the same event
  {
    id: '7d0b9c1e-0051-4a51-9d1a-6f1c00000051', name: 'Change request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-260, 1180],
    webhookId: '5a6c2f0e-4c1b-4e8a-9a51-2b7d00000a04',
    parameters: { httpMethod: 'POST', path: 'rr-manage', responseMode: 'responseNode', options: { allowedOrigins: ALLOWED_ORIGINS } },
  },
  {
    id: '7d0b9c1e-0052-4a51-9d1a-6f1c00000052', name: 'Check the change request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 1180],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step
return [{ json: checkChange($input.first().json.body, Date.now()) }];`,
    },
  },
  {
    id: '7d0b9c1e-0053-4a51-9d1a-6f1c00000053', name: 'Change request OK?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [240, 1180],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000053', '={{ $json.ok === true }}'),
  },
  {
    id: '7d0b9c1e-0054-4a51-9d1a-6f1c00000054', name: 'Change: reject', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [480, 1360],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ ok: false, error: $json.code }) }}', options: { responseCode: '={{ $json.status }}', ...noStore } },
  },
  {
    id: '7d0b9c1e-0055-4a51-9d1a-6f1c00000055', name: 'Google: find the booking', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [480, 1160],
    parameters: {
      method: 'GET', ...GCAL,
      // The key is checked (letters and digits only) before it gets here.
      url: "={{ 'https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=5&privateExtendedProperty=' + encodeURIComponent('rrKey=' + $json.key) }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0056-4a51-9d1a-6f1c00000056', name: 'Decide the change', type: 'n8n-nodes-base.code', typeVersion: 2, position: [720, 1160],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step
return [{ json: decideChange($('Check the change request').first().json, $input.first().json, Date.now()) }];`,
    },
  },
  {
    id: '7d0b9c1e-0057-4a51-9d1a-6f1c00000057', name: 'Change or cancel?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [960, 1160],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000057', "={{ $json.ok === true && $json.action !== 'look' }}"),
  },
  {
    // Looking the booking up, or anything that stops a change (not found, already started, no changes left).
    id: '7d0b9c1e-0058-4a51-9d1a-6f1c00000058', name: 'Change: answer', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1200, 1360],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json.respond) }}', options: { responseCode: '={{ $json.status }}', ...noStore } },
  },
  {
    id: '7d0b9c1e-0059-4a51-9d1a-6f1c00000059', name: 'Moving it?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1200, 1140],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000059', "={{ $json.action === 'move' }}"),
  },
  {
    id: '7d0b9c1e-0060-4a51-9d1a-6f1c00000060', name: 'Google: is the new time free?', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1440, 1060],
    parameters: {
      method: 'POST', url: 'https://www.googleapis.com/calendar/v3/freeBusy', ...GCAL,
      sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ timeMin: $json.patch.start.dateTime, timeMax: $json.patch.end.dateTime, items: [{ id: 'primary' }] }) }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0061-4a51-9d1a-6f1c00000061', name: 'New time free?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1680, 1060],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000061',
      '={{ !!$json.calendars && !!$json.calendars.primary && !$json.calendars.primary.errors && $json.calendars.primary.busy.length === 0 }}'),
  },
  {
    id: '7d0b9c1e-0062-4a51-9d1a-6f1c00000062', name: 'Change: taken', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [1920, 1240],
    parameters: { respondWith: 'json', responseBody: '{"ok":false,"error":"taken"}', options: { responseCode: 409, ...noStore } },
  },
  {
    id: '7d0b9c1e-0063-4a51-9d1a-6f1c00000063', name: 'Google: move the event', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1920, 1040],
    // Same event, so the Meet link and the change link stay the same. sendUpdates=all: Google sends the updated invite.
    onError: 'continueErrorOutput',
    parameters: {
      method: 'PATCH', ...GCAL,
      url: "={{ 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent($('Decide the change').first().json.eventId) + '?sendUpdates=all' }}",
      sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify($('Decide the change').first().json.patch) }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0064-4a51-9d1a-6f1c00000064', name: 'Google: cancel the event', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1440, 1300],
    // sendUpdates=all: Google emails the visitor the cancellation.
    onError: 'continueErrorOutput',
    parameters: {
      method: 'DELETE', ...GCAL,
      url: "={{ 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent($json.eventId) + '?sendUpdates=all' }}",
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0065-4a51-9d1a-6f1c00000065', name: 'Change: failed', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [2160, 1460],
    parameters: { respondWith: 'json', responseBody: '{"ok":false,"error":"failed"}', options: { responseCode: 502, ...noStore } },
  },
  {
    id: '7d0b9c1e-0066-4a51-9d1a-6f1c00000066', name: 'Remember the change', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2160, 1160],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step: keep the one-upcoming-review-per-email limit in step (cancelled: the email can book again)
const d = $('Decide the change').first().json;
const store = $getWorkflowStaticData('global');
store.bookings = moveBooking(store.bookings, { email: d.email, from: d.from, to: d.to });
return [{ json: d.respond }];`,
    },
  },
  {
    id: '7d0b9c1e-0067-4a51-9d1a-6f1c00000067', name: 'Change: done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [2400, 1160],
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: noStore },
  },
  {
    id: '7d0b9c1e-0068-4a51-9d1a-6f1c00000068', name: 'Email Jeff: change', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [2640, 1160],
    onError: 'continueRegularOutput',
    parameters: {
      sendTo: OWNER_EMAIL,
      subject: "={{ $('Decide the change').first().json.notify.subject }}",
      emailType: 'text',
      message: "={{ $('Decide the change').first().json.notify.text }}",
      options: { appendAttribution: false },
    },
  },
  {
    id: '7d0b9c1e-0069-4a51-9d1a-6f1c00000069', name: 'Change: sheet row', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2880, 1160],
    parameters: { jsCode: "return [{ json: $('Decide the change').first().json.sheet }];" },
  },
  {
    id: '7d0b9c1e-0070-4a51-9d1a-6f1c00000070', name: 'Update the sheet row', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [3120, 1160],
    onError: 'continueErrorOutput',
    parameters: SHEET_UPDATE,
  },
  {
    id: '7d0b9c1e-0071-4a51-9d1a-6f1c00000071', name: 'Email Jeff: sheet update problem', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [3360, 1340],
    onError: 'continueRegularOutput',
    parameters: {
      sendTo: OWNER_EMAIL,
      subject: 'Bookings sheet not updated after a change',
      emailType: 'text',
      message: "={{ 'A visitor changed or cancelled a review (the calendar is already updated), but updating their row in the bookings sheet failed.\\n\\nRow: ' + JSON.stringify($('Change: sheet row').first().json) + '\\n\\nReason from Google Sheets:\\n' + ($json.error?.message || $json.error || JSON.stringify($json)) }}",
      options: { appendAttribution: false },
    },
  },

  // ---------- Reminder sweep: every 10 minutes, read the calendar and the sheet, send what's due, keep things in step
  {
    id: '7d0b9c1e-0072-4a51-9d1a-6f1c00000072', name: 'Every 10 minutes', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-260, 1700],
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 10 }] } },
  },
  {
    id: '7d0b9c1e-0073-4a51-9d1a-6f1c00000073', name: 'Google: upcoming events', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [0, 1700],
    parameters: {
      method: 'GET', ...GCAL,
      url: `={{ 'https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=2500&timeMin=' + encodeURIComponent($now.toUTC().toISO()) + '&timeMax=' + encodeURIComponent($now.plus({ days: ${LIST_DAYS} }).toUTC().toISO()) }}`,
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0074-4a51-9d1a-6f1c00000074', name: 'Read the bookings sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [240, 1700],
    // An empty or unreadable sheet still lets the reminders go out (it only stops the sheet checks).
    alwaysOutputData: true, onError: 'continueRegularOutput',
    parameters: { documentId: SHEET_DOC, sheetName: SHEET_TAB, filtersUI: {}, options: {} },
  },
  {
    id: '7d0b9c1e-0075-4a51-9d1a-6f1c00000075', name: 'What needs doing', type: 'n8n-nodes-base.code', typeVersion: 2, position: [480, 1700],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step: reminders due now, and anything moved, cancelled or declined in Google Calendar
const list = $('Google: upcoming events').first().json;
const rows = $input.all().map((i) => i.json).filter((r) => r && r['Calendar link']);
const r = sweepReminders(list, rows, Date.now());
if (r.moves.length) {
  const store = $getWorkflowStaticData('global');
  for (const m of r.moves) store.bookings = moveBooking(store.bookings, m);
}
return r.items.map((json) => ({ json }));`,
    },
  },
  {
    id: '7d0b9c1e-0076-4a51-9d1a-6f1c00000076', name: 'Event to update?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [720, 1620],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000076', '={{ !!$json.eventId && !!$json.patch }}'),
  },
  {
    // Marks the reminder as sent BEFORE it goes out, so a hiccup can never send it twice.
    // No sendUpdates: Google doesn't email anyone about these private details.
    id: '7d0b9c1e-0077-4a51-9d1a-6f1c00000077', name: 'Google: update the event', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [960, 1600],
    onError: 'continueErrorOutput',
    parameters: {
      method: 'PATCH', ...GCAL,
      url: "={{ 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent($json.eventId) }}",
      sendBody: true, specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.patch) }}',
      options: {},
    },
  },
  {
    id: '7d0b9c1e-0078-4a51-9d1a-6f1c00000078', name: 'Reminder to send?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1200, 1600],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000078', "={{ !!$('Event to update?').item.json.email }}"),
  },
  {
    id: '7d0b9c1e-0079-4a51-9d1a-6f1c00000079', name: 'Email: reminder', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [1440, 1600],
    onError: 'continueRegularOutput',
    parameters: {
      sendTo: "={{ $('Event to update?').item.json.email.to }}",
      subject: "={{ $('Event to update?').item.json.email.subject }}",
      emailType: 'text',
      message: "={{ $('Event to update?').item.json.email.text }}",
      options: { appendAttribution: false },
    },
  },
  {
    id: '7d0b9c1e-0080-4a51-9d1a-6f1c00000080', name: 'Sheet to update?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [720, 1860],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000080', '={{ !!$json.sheet }}'),
  },
  {
    id: '7d0b9c1e-0081-4a51-9d1a-6f1c00000081', name: 'Sweep: sheet rows', type: 'n8n-nodes-base.code', typeVersion: 2, position: [960, 1860],
    parameters: { jsCode: 'return $input.all().map((i) => ({ json: i.json.sheet }));' },
  },
  {
    id: '7d0b9c1e-0082-4a51-9d1a-6f1c00000082', name: 'Sweep: update the sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [1200, 1860],
    onError: 'continueRegularOutput',
    parameters: SHEET_UPDATE,
  },

  // ---------- Reset (Jeff only): GET .../webhook/rr-forget?email=someone@example.com  (or ?email=all)
  // Clears remembered bookings so that email can book again. Protected by a Basic Auth credential you create in n8n.
  {
    id: '7d0b9c1e-0040-4a51-9d1a-6f1c00000040', name: 'Reset request', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-260, 820],
    webhookId: '5a6c2f0e-4c1b-4e8a-9a51-2b7d00000a03',
    parameters: { httpMethod: 'GET', path: 'rr-forget', authentication: 'basicAuth', responseMode: 'responseNode', options: {} },
  },
  {
    id: '7d0b9c1e-0041-4a51-9d1a-6f1c00000041', name: 'Forget email', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 820],
    parameters: {
      jsCode: `${inline('src/booking/check.js').slice(inline('src/booking/check.js').indexOf('function forgetBooking'), inline('src/booking/check.js').indexOf('/** Bookings worth remembering'))}
// ---- workflow step
const email = String($input.first().json.query?.email ?? '');
const store = $getWorkflowStaticData('global');
const r = forgetBooking(store.bookings, email);
store.bookings = r.history;
const message = !email.trim()
  ? 'Add ?email=someone@example.com (or ?email=all) to the address.'
  : \`Cleared \${r.removed} remembered booking(s) for \${email.trim().toLowerCase()}. \${store.bookings.length} still remembered.\`;
return [{ json: { ok: Boolean(email.trim()), removed: r.removed, remaining: store.bookings.length, message } }];`,
    },
  },
  {
    id: '7d0b9c1e-0042-4a51-9d1a-6f1c00000042', name: 'Reset done', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [240, 820],
    parameters: { respondWith: 'text', responseBody: '={{ $json.message }}', options: noStore },
  },
];

const link = (to, index = 0) => ({ node: to, type: 'main', index });
const connections = {
  'Availability request': { main: [[link('Google: busy times')]] },
  'Google: busy times': { main: [[link('Work out free slots')]] },
  'Work out free slots': { main: [[link('Send slots')]] },
  'Booking request': { main: [[link('Make a change-link key')]] },
  'Make a change-link key': { main: [[link('Check the request')]] },
  'Reset request': { main: [[link('Forget email')]] },
  'Forget email': { main: [[link('Reset done')]] },
  'Check the request': { main: [[link('Request OK?')]] },
  'Request OK?': { main: [[link('Google: is it still free?')], [link('Reject')]] },
  'Google: is it still free?': { main: [[link('Still free?')]] },
  'Still free?': { main: [[link('Google: create event + invite')], [link('Slot taken')]] },
  'Google: create event + invite': { main: [[link('Remember booking')]] },
  'Remember booking': { main: [[link('Confirm booking')]] },
  'Confirm booking': { main: [[link('Email Jeff')]] },
  'Email Jeff': { main: [[link('Sheet row')]] },
  'Sheet row': { main: [[link('Log to Google Sheet')]] },
  'Log to Google Sheet': { main: [[], [link('Email Jeff: sheet problem')]] },

  // Change or cancel (rr-manage)
  'Change request': { main: [[link('Check the change request')]] },
  'Check the change request': { main: [[link('Change request OK?')]] },
  'Change request OK?': { main: [[link('Google: find the booking')], [link('Change: reject')]] },
  'Google: find the booking': { main: [[link('Decide the change')]] },
  'Decide the change': { main: [[link('Change or cancel?')]] },
  'Change or cancel?': { main: [[link('Moving it?')], [link('Change: answer')]] },
  'Moving it?': { main: [[link('Google: is the new time free?')], [link('Google: cancel the event')]] },
  'Google: is the new time free?': { main: [[link('New time free?')]] },
  'New time free?': { main: [[link('Google: move the event')], [link('Change: taken')]] },
  'Google: move the event': { main: [[link('Remember the change')], [link('Change: failed')]] },
  'Google: cancel the event': { main: [[link('Remember the change')], [link('Change: failed')]] },
  'Remember the change': { main: [[link('Change: done')]] },
  'Change: done': { main: [[link('Email Jeff: change')]] },
  'Email Jeff: change': { main: [[link('Change: sheet row')]] },
  'Change: sheet row': { main: [[link('Update the sheet row')]] },
  'Update the sheet row': { main: [[], [link('Email Jeff: sheet update problem')]] },

  // Reminder sweep
  'Every 10 minutes': { main: [[link('Google: upcoming events')]] },
  'Google: upcoming events': { main: [[link('Read the bookings sheet')]] },
  'Read the bookings sheet': { main: [[link('What needs doing')]] },
  'What needs doing': { main: [[link('Event to update?'), link('Sheet to update?')]] },
  'Event to update?': { main: [[link('Google: update the event')], []] },
  'Google: update the event': { main: [[link('Reminder to send?')], []] },
  'Reminder to send?': { main: [[link('Email: reminder')], []] },
  'Sheet to update?': { main: [[link('Sweep: sheet rows')], []] },
  'Sweep: sheet rows': { main: [[link('Sweep: update the sheet')]] },
};

const workflow = { name: 'Rework Rescue: process review booking', nodes, connections, settings: {
  executionOrder: 'v1',
  // Privacy: don't keep a record of runs that worked (they contain booking details). Failed runs are kept so problems can be fixed.
  saveDataSuccessExecution: 'none', saveManualExecutions: false, saveDataErrorExecution: 'all',
}, pinData: {} };
mkdirSync(join(root, 'n8n'), { recursive: true });
writeFileSync(join(root, 'n8n/rework-review-booking.json'), `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`n8n/rework-review-booking.json: ${nodes.length} nodes`);
