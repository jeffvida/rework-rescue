// Builds n8n/rework-review-booking.json, the importable n8n workflow behind the booking pop-up.
// Run: node tools/build_n8n.mjs   (after changing src/booking/slots.js or src/booking/check.js)
//
// The Code nodes get the same slot rules and request checks the tests cover, copied in as plain JavaScript.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_EMAIL = 'jeffhersonvida@gmail.com';
// Which websites may call the webhooks from a browser. '*' while you test on Vercel preview links;
// once live, change it in both Webhook nodes to https://rework-rescue.vercel.app (or your own domain).
const ALLOWED_ORIGINS = '*';

const inline = (file) => readFileSync(join(root, file), 'utf8')
  .split('\n').filter((l) => !/^import\s/.test(l)).join('\n')
  .replace(/^export\s+/gm, '');
// Rework Rescue bookings sheet: https://docs.google.com/spreadsheets/d/<this id>/edit
const BOOKINGS_SHEET_ID = '1bBmq3a-LzWgHy41YHFqgRAgIfRcGKTz7QhoxW6MGYFQ';
const LIB = `${inline('src/booking/slots.js')}\n${inline('src/booking/check.js')}`;

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
      width: 600, height: 380,
      content: [
        '## Rework review booking',
        '1. Open each **Google** node (the 5 HTTP Request nodes) and pick or create a **Google Calendar OAuth2** credential for ' + OWNER_EMAIL + '.',
        '2. Open **Email Jeff** and pick or create a **Gmail OAuth2** credential.',
        '3. Open **Log to Google Sheet**: create a **Google Sheets OAuth2** credential, the bookings sheet is already filled in. Row 1 of that sheet must hold the column headers listed in n8n/SETUP.md.',
        '4. Pick the same Google Calendar credential in the two **Google: still on?** nodes and the same Gmail credential in the two **Email: … reminder** nodes.',
        '5. Save, then switch the workflow to **Active** (or Publish). Keep it active: reminders wait inside each booking run.',
        '6. Copy both **Production URLs** (Webhook nodes) into site-config.js: bookingAvailabilityUrl and bookingRequestUrl.',
        '7. After testing, set Allowed Origins in both Webhook nodes to your live site address.',
        '',
        'Slot rules and checks come from src/booking/*.js in the site repo. Edit there and rebuild, not here.',
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
    id: '7d0b9c1e-0007-4a51-9d1a-6f1c00000007', name: 'Check the request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 440],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step
const store = $getWorkflowStaticData('global');
store.bookings = pruneHistory(store.bookings, Date.now());
return [{ json: checkBooking($input.first().json.body, Date.now(), store.bookings) }];`,
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
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'append',
      // The bookings sheet, kept here so a re-import doesn't clear it. Sheet ID 0 is the first tab.
      documentId: { __rl: true, value: BOOKINGS_SHEET_ID, mode: 'id' },
      sheetName: { __rl: true, value: 0, mode: 'id' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
      options: {},
    },
  },

  // ---------- Reminders: wait inside this run, re-check the event, then email the visitor
  {
    id: '7d0b9c1e-0019-4a51-9d1a-6f1c00000019', name: 'Plan reminders', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2400, 380],
    parameters: {
      jsCode: `${LIB}
// ---- workflow step: when to send the 1-day and 1-hour reminders, and what they say
const b = $('Check the request').first().json.booking;
const ev = $('Google: create event + invite').first().json;
return [{ json: { eventId: ev.id || '', ...planReminders(b, { meet: ev.hangoutLink || '' }) } }];`,
    },
  },
  {
    id: '7d0b9c1e-0020-4a51-9d1a-6f1c00000020', name: 'Day-before reminder due?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [2640, 380],
    parameters: ifTrue('c1a00000-0000-4000-8000-000000000003', '={{ $json.sendDay === true && !!$json.eventId }}'),
  },
  ...reminderStep('day', 'Wait until 1 day before', 'Google: still on? (1 day)', 'Still on? (1 day)', 'Email: 1-day reminder', 2880, 280, 21),
  ...reminderStep('hour', 'Wait until 1 hour before', 'Google: still on? (1 hour)', 'Still on? (1 hour)', 'Email: 1-hour reminder', 3920, 480, 25),
];

// Four nodes per reminder: wait until the send time, fetch the event, check it wasn't cancelled or moved, email the visitor.
function reminderStep(kind, waitName, getName, okName, mailName, x, y, n) {
  const id = (k) => `7d0b9c1e-00${n + k}-4a51-9d1a-6f1c000000${n + k}`;
  const plan = "$('Plan reminders').first().json";
  return [
    {
      id: id(0), name: waitName, type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [x, y],
      webhookId: `5a6c2f0e-4c1b-4e8a-9a51-2b7d00000b${n}`,
      parameters: { resume: 'specificTime', dateTime: `={{ ${plan}.${kind === 'day' ? 'dayAt' : 'hourAt'} }}` },
    },
    {
      id: id(1), name: getName, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x + 240, y],
      // A deleted event can answer with an error; carry on so the check below simply says "not on".
      onError: 'continueRegularOutput',
      parameters: {
        method: 'GET', ...GCAL,
        url: `={{ 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(${plan}.eventId) }}`,
        options: {},
      },
    },
    {
      id: id(2), name: okName, type: 'n8n-nodes-base.if', typeVersion: 2, position: [x + 480, y],
      parameters: ifTrue(`c1a00000-0000-4000-8000-0000000000${n}`,
        `={{ $json.status === 'confirmed' && !!$json.start && Date.parse($json.start.dateTime) === Date.parse(${plan}.start) }}`),
    },
    {
      id: id(3), name: mailName, type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [x + 720, y],
      onError: 'continueRegularOutput',
      parameters: {
        sendTo: `={{ ${plan}.email }}`,
        subject: `={{ ${plan}.${kind}.subject }}`,
        emailType: 'text',
        message: `={{ ${plan}.${kind}.text }}`,
        options: { appendAttribution: false },
      },
    },
  ];
}

const link = (to, index = 0) => ({ node: to, type: 'main', index });
const connections = {
  'Availability request': { main: [[link('Google: busy times')]] },
  'Google: busy times': { main: [[link('Work out free slots')]] },
  'Work out free slots': { main: [[link('Send slots')]] },
  'Booking request': { main: [[link('Check the request')]] },
  'Check the request': { main: [[link('Request OK?')]] },
  'Request OK?': { main: [[link('Google: is it still free?')], [link('Reject')]] },
  'Google: is it still free?': { main: [[link('Still free?')]] },
  'Still free?': { main: [[link('Google: create event + invite')], [link('Slot taken')]] },
  'Google: create event + invite': { main: [[link('Remember booking')]] },
  'Remember booking': { main: [[link('Confirm booking')]] },
  'Confirm booking': { main: [[link('Email Jeff')]] },
  'Email Jeff': { main: [[link('Sheet row')]] },
  'Sheet row': { main: [[link('Log to Google Sheet')]] },
  'Log to Google Sheet': { main: [[link('Plan reminders')]] },
  'Plan reminders': { main: [[link('Day-before reminder due?')]] },
  'Day-before reminder due?': { main: [[link('Wait until 1 day before')], [link('Wait until 1 hour before')]] },
  'Wait until 1 day before': { main: [[link('Google: still on? (1 day)')]] },
  'Google: still on? (1 day)': { main: [[link('Still on? (1 day)')]] },
  'Still on? (1 day)': { main: [[link('Email: 1-day reminder')], []] },
  'Email: 1-day reminder': { main: [[link('Wait until 1 hour before')]] },
  'Wait until 1 hour before': { main: [[link('Google: still on? (1 hour)')]] },
  'Google: still on? (1 hour)': { main: [[link('Still on? (1 hour)')]] },
  'Still on? (1 hour)': { main: [[link('Email: 1-hour reminder')], []] },
};

const workflow = { name: 'Rework Rescue: rework review booking', nodes, connections, settings: {
  executionOrder: 'v1',
  // Privacy: don't keep a record of runs that worked (they contain booking details). Failed runs are kept so problems can be fixed.
  saveDataSuccessExecution: 'none', saveManualExecutions: false, saveDataErrorExecution: 'all',
}, pinData: {} };
mkdirSync(join(root, 'n8n'), { recursive: true });
writeFileSync(join(root, 'n8n/rework-review-booking.json'), `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`n8n/rework-review-booking.json: ${nodes.length} nodes`);
