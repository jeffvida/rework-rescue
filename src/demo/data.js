// The single source of truth for the main demonstration: one fictional, industry-neutral small business and one
// working week (Mon 2 – Fri 6 Nov 2026). Everything here is made up. Data, Reports, Actions, Workflows, the
// workspace overview and the hero all read these rows through ./engine.js; no view keeps its own figures.
//
// Three sources, each in its own native format (the originals are never changed):
//   REQUESTS      Requests Register, 12 requests. Dates dd/mm/yyyy. Refs "R-101".
//   TASKS         Work Tracker, 12 tasks, one per request. Dates ISO (2026-11-03). Refs "T-201".
//   TRANSACTIONS  Records & Transactions, 9 records. Dates "Tue 3 Nov". Request refs written without the
//                 hyphen ("R101"), so they have to be standardised before they match.
//
// What the configured checks find (each traceable to its rows):
//   R-104 / R-109  same customer, request type and received date, different refs: possible duplicate.
//   R-111          customer left blank. TX-307 for request R111 names the customer: Harbour & Co.
//   TX-309         refers to request R115, which isn't in the Requests Register: unmatched.
//   T-206          due Wed 4 Nov and still in progress at the end of the week: overdue.
//   T-210          open with no owner.
// No industry is implied: request types and records are ones most small businesses have.

export const WEEK = 'Week ending Fri 6 Nov 2026';
export const REPORT_DATE = '2026-11-06';
export const PERIOD = { start: '2026-11-02', end: '2026-11-06', label: '2–6 November 2026' };

export const REQUESTS = [
  { id: 'R-101', received: '02/11/2026', customer: 'Bayview Co.', type: 'Quote request', channel: 'Email' },
  { id: 'R-102', received: '02/11/2026', customer: 'Oakline Studio', type: 'Order change', channel: 'Phone' },
  { id: 'R-103', received: '02/11/2026', customer: 'Greenfield Ltd', type: 'Account question', channel: 'Web form' },
  { id: 'R-104', received: '03/11/2026', customer: 'Summit Supplies', type: 'Quote request', channel: 'Email' },
  { id: 'R-105', received: '03/11/2026', customer: 'Riverside Group', type: 'Document request', channel: 'Email' },
  { id: 'R-106', received: '03/11/2026', customer: 'Westgate Clinic', type: 'Service request', channel: 'Phone' },
  { id: 'R-107', received: '04/11/2026', customer: 'Lakeside Cafe', type: 'Order change', channel: 'Web form' },
  { id: 'R-108', received: '04/11/2026', customer: 'Northside Partners', type: 'Quote request', channel: 'Email' },
  { id: 'R-109', received: '03/11/2026', customer: 'Summit Supplies', type: 'Quote request', channel: 'Phone' },
  { id: 'R-110', received: '05/11/2026', customer: 'Pinecrest Offices', type: 'Service request', channel: 'Web form' },
  { id: 'R-111', received: '05/11/2026', customer: '', type: 'Account question', channel: 'Email' },
  { id: 'R-112', received: '05/11/2026', customer: 'Bayview Co.', type: 'Document request', channel: 'Phone' },
];

// status: 'Not started' | 'In progress' | 'Completed'. owner '' = nobody assigned.
export const TASKS = [
  { id: 'T-201', request: 'R-101', task: 'Prepare and send quote', owner: 'Ana', due: '2026-11-03', status: 'Completed', completed: '2026-11-02' },
  { id: 'T-202', request: 'R-102', task: 'Update the order', owner: 'Ben', due: '2026-11-03', status: 'Completed', completed: '2026-11-03' },
  { id: 'T-203', request: 'R-103', task: 'Answer account question', owner: 'Carla', due: '2026-11-04', status: 'Completed', completed: '2026-11-03' },
  { id: 'T-204', request: 'R-104', task: 'Prepare and send quote', owner: 'Ana', due: '2026-11-05', status: 'Completed', completed: '2026-11-05' },
  { id: 'T-205', request: 'R-105', task: 'Send the requested documents', owner: 'Carla', due: '2026-11-05', status: 'Completed', completed: '2026-11-04' },
  { id: 'T-206', request: 'R-106', task: 'Arrange the service visit', owner: 'Ben', due: '2026-11-04', status: 'In progress', completed: '' },
  { id: 'T-207', request: 'R-107', task: 'Update the order', owner: 'Ben', due: '2026-11-06', status: 'Completed', completed: '2026-11-06' },
  { id: 'T-208', request: 'R-108', task: 'Prepare and send quote', owner: 'Ana', due: '2026-11-09', status: 'In progress', completed: '' },
  { id: 'T-209', request: 'R-109', task: 'Prepare and send quote', owner: 'Ben', due: '2026-11-06', status: 'Not started', completed: '' },
  { id: 'T-210', request: 'R-110', task: 'Arrange the service visit', owner: '', due: '2026-11-10', status: 'Not started', completed: '' },
  { id: 'T-211', request: 'R-111', task: 'Answer account question', owner: 'Carla', due: '2026-11-09', status: 'In progress', completed: '' },
  { id: 'T-212', request: 'R-112', task: 'Send the requested documents', owner: 'Carla', due: '2026-11-10', status: 'Not started', completed: '' },
];

export const TRANSACTIONS = [
  { id: 'TX-301', date: 'Mon 2 Nov', request: 'R101', customer: 'Bayview Co.', record: 'Quote sent' },
  { id: 'TX-302', date: 'Tue 3 Nov', request: 'R102', customer: 'Oakline Studio', record: 'Order updated' },
  { id: 'TX-303', date: 'Wed 4 Nov', request: 'R102', customer: 'Oakline Studio', record: 'Invoice issued' },
  { id: 'TX-304', date: 'Thu 5 Nov', request: 'R104', customer: 'Summit Supplies', record: 'Quote sent' },
  { id: 'TX-305', date: 'Wed 4 Nov', request: 'R105', customer: 'Riverside Group', record: 'Documents sent' },
  { id: 'TX-306', date: 'Fri 6 Nov', request: 'R107', customer: 'Lakeside Cafe', record: 'Order updated' },
  { id: 'TX-307', date: 'Thu 5 Nov', request: 'R111', customer: 'Harbour & Co.', record: 'Account note' },
  { id: 'TX-308', date: 'Fri 6 Nov', request: 'R107', customer: 'Lakeside Cafe', record: 'Invoice issued' },
  { id: 'TX-309', date: 'Fri 6 Nov', request: 'R115', customer: 'Lakeside Cafe', record: 'Payment received' },
];

export const SOURCES = [
  { id: 'requests', name: 'Requests Register', format: 'dates as 03/11/2026', fields: [['id', 'Ref'], ['received', 'Received'], ['customer', 'Customer'], ['type', 'Request'], ['channel', 'Channel']] },
  { id: 'tasks', name: 'Work Tracker', format: 'dates as 2026-11-03', fields: [['id', 'Task'], ['request', 'Request'], ['task', 'What'], ['owner', 'Owner'], ['due', 'Due'], ['status', 'Status'], ['completed', 'Completed']] },
  { id: 'transactions', name: 'Records & Transactions', format: 'dates as Tue 3 Nov · refs as R101', fields: [['id', 'Record'], ['date', 'Date'], ['request', 'Request ref'], ['customer', 'Customer'], ['record', 'Record']] },
];

// Fictional staff, and who would usually pick up each kind of follow-up (a suggestion, not confirmed ownership).
export const STAFF = ['Ana', 'Ben', 'Carla'];
export const REQUEST_TYPES = ['Quote request', 'Order change', 'Account question', 'Document request', 'Service request'];
export const CHANNELS = ['Email', 'Phone', 'Web form'];
export const TASK_FOR = {
  'Quote request': 'Prepare and send quote', 'Order change': 'Update the order', 'Account question': 'Answer account question',
  'Document request': 'Send the requested documents', 'Service request': 'Arrange the service visit',
};

// Demonstration rules, configured for this business (not universal standards).
export const RULES = {
  duplicateKeys: ['customer', 'type', 'received'],
  required: { requests: ['id', 'received', 'customer', 'type'], tasks: ['id', 'request', 'task', 'due', 'status'], transactions: ['id', 'date', 'request', 'record'] },
  dueDays: 2, // a new request's task is due two working days after it arrives
};

// The source records are read-only: nothing on the page can change them. Everything the visitor does is stored
// separately in the review state and applied on top.
const freeze = (rows) => { rows.forEach(Object.freeze); return Object.freeze(rows); };
[REQUESTS, TASKS, TRANSACTIONS, SOURCES, STAFF, REQUEST_TYPES, CHANNELS].forEach(freeze);
SOURCES.forEach((s) => { s.fields.forEach(Object.freeze); Object.freeze(s.fields); });
Object.freeze(PERIOD); Object.freeze(TASK_FOR); Object.freeze(RULES.duplicateKeys); Object.freeze(RULES.required); Object.freeze(RULES);
