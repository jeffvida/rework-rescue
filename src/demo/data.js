// Sample data for the hero card, the three-tab example and the Data & Reporting preview.
// One week for a fictional, unnamed small business. Everything here is made up.
// Three sources (read-only, frozen below):
//   SALES    (12 rows): every sale recorded this week.
//   PAYMENTS  (9 rows): every payment received, with the sale it pays.
//   REQUESTS  (6 rows): customer requests, who owns them and the next action.
//   HISTORY  (fictional demonstration data): daily sales totals for the previous 4 weeks, used only for the
//            pattern check.
// Four findings, each from a stated rule:
//   S-1051 looks like a duplicate of S-1043 (same customer, date and amount; only one payment).
//   S-1047 has no amount; payment P-307 shows 380 received against it (full amount or part payment: unknown).
//   Tuesday's sales (2,455) are about 58% above the 4-week Tuesday average (1,550). Partly explained by the
//   potential duplicate: without S-1051, Tuesday is 1,595 (+3%), inside the range.
//   R-205 is an open quote request with no owner and no next action after 4 working days.
// S-1049 and S-1052 are not paid yet. That's normal within the week, so they are NOT flagged.
// The engine (./engine.js) works out every number the page shows from these rows; tests/demo.test.mjs checks them.
// Amounts have no currency symbol on purpose: they are sample sales, and nothing on the page should read as a price.

// The sample week: a completed week (Mon 2 – Fri 6 Nov 2026).
export const WEEK = 'Week ending Fri 6 Nov 2026';

// amount null = left blank.
export const SALES = [
  { id: 'S-1041', date: 'Mon 2 Nov', customer: 'Bayview Co.', amount: 450, from: 'Email' },
  { id: 'S-1042', date: 'Mon 2 Nov', customer: 'R. Cruz', amount: 120, from: 'In person' },
  { id: 'S-1043', date: 'Tue 3 Nov', customer: 'Greenfield Ltd', amount: 860, from: 'Email' },
  { id: 'S-1044', date: 'Tue 3 Nov', customer: 'M. Tan', amount: 95, from: 'In person' },
  { id: 'S-1045', date: 'Tue 3 Nov', customer: 'Oakline Studio', amount: 640, from: 'Phone' },
  { id: 'S-1046', date: 'Wed 4 Nov', customer: 'J. Reyes', amount: 210, from: 'In person' },
  { id: 'S-1047', date: 'Wed 4 Nov', customer: 'Summit Supplies', amount: null, from: 'Email' },
  { id: 'S-1048', date: 'Wed 4 Nov', customer: 'K. Patel', amount: 150, from: 'Phone' },
  { id: 'S-1049', date: 'Thu 5 Nov', customer: 'Riverside Group', amount: 520, from: 'Email' },
  { id: 'S-1050', date: 'Thu 5 Nov', customer: 'L. Wong', amount: 75, from: 'In person' },
  { id: 'S-1051', date: 'Tue 3 Nov', customer: 'Greenfield Ltd', amount: 860, from: 'Phone' },
  { id: 'S-1052', date: 'Fri 6 Nov', customer: 'Harper & Co.', amount: 330, from: 'Email' },
];

export const PAYMENTS = [
  { id: 'P-301', date: 'Mon 2 Nov', sale: 'S-1041', customer: 'Bayview Co.', amount: 450, method: 'Bank transfer' },
  { id: 'P-302', date: 'Mon 2 Nov', sale: 'S-1042', customer: 'R. Cruz', amount: 120, method: 'Card' },
  { id: 'P-303', date: 'Wed 4 Nov', sale: 'S-1043', customer: 'Greenfield Ltd', amount: 860, method: 'Bank transfer' },
  { id: 'P-304', date: 'Tue 3 Nov', sale: 'S-1044', customer: 'M. Tan', amount: 95, method: 'Card' },
  { id: 'P-305', date: 'Thu 5 Nov', sale: 'S-1045', customer: 'Oakline Studio', amount: 640, method: 'Bank transfer' },
  { id: 'P-306', date: 'Wed 4 Nov', sale: 'S-1046', customer: 'J. Reyes', amount: 210, method: 'Card' },
  { id: 'P-307', date: 'Thu 5 Nov', sale: 'S-1047', customer: 'Summit Supplies', amount: 380, method: 'Bank transfer' },
  { id: 'P-308', date: 'Wed 4 Nov', sale: 'S-1048', customer: 'K. Patel', amount: 150, method: 'Card' },
  { id: 'P-309', date: 'Thu 5 Nov', sale: 'S-1050', customer: 'L. Wong', amount: 75, method: 'Card' },
];

// status: 'Open' | 'Closed'. owner / next '' = left blank.
export const REQUESTS = [
  { id: 'R-201', received: 'Mon 2 Nov', customer: 'Bayview Co.', request: 'Change to an order', status: 'Closed', owner: 'Ana', next: 'Done' },
  { id: 'R-202', received: 'Tue 3 Nov', customer: 'M. Tan', request: 'Asked for a quote', status: 'Closed', owner: 'Ben', next: 'Quote sent' },
  { id: 'R-203', received: 'Tue 3 Nov', customer: 'Greenfield Ltd', request: 'Copy of receipt', status: 'Closed', owner: 'Ana', next: 'Sent' },
  { id: 'R-204', received: 'Wed 4 Nov', customer: 'K. Patel', request: 'Question about payment', status: 'Open', owner: 'Ben', next: 'Call back Fri' },
  { id: 'R-205', received: 'Mon 2 Nov', customer: 'Northside Partners', request: 'Asked for a quote', status: 'Open', owner: '', next: '' },
  { id: 'R-206', received: 'Thu 5 Nov', customer: 'L. Wong', request: 'Change of date', status: 'Open', owner: 'Ana', next: 'Confirm Mon' },
];

export const SOURCES = [
  { id: 'sales', name: 'Sales log', fields: ['Ref', 'Date', 'Customer', 'Amount', 'Entered from'] },
  { id: 'payments', name: 'Payments received', fields: ['Ref', 'Date', 'Sale ref', 'Customer', 'Amount', 'Method'] },
  { id: 'requests', name: 'Customer requests', fields: ['Ref', 'Received', 'Customer', 'Request', 'Status', 'Owner', 'Next action'] },
];

// Fictional demonstration data: daily sales totals for the 4 weeks before the sample week (oldest first).
export const HISTORY = {
  weeks: ['w/e 9 Oct', 'w/e 16 Oct', 'w/e 23 Oct', 'w/e 30 Oct'],
  days: {
    Mon: [640, 590, 610, 640],
    Tue: [1520, 1610, 1480, 1590],
    Wed: [540, 600, 520, 580],
    Thu: [660, 610, 650, 640],
    Fri: [360, 410, 350, 400],
  },
};

// Demonstration rules. Configurable per business, not universal standards.
export const RULES = {
  patternThreshold: 0.4,  // flag a day more than 40% above or below its 4-week average for the same weekday
  followUpDays: 2,        // flag an open request older than this many working days with no next action
};

// Original records (evidence) behind four rows. A reviewer opens these to investigate; they are not extra data rows,
// so the 27-record count stays. The phone note and the order email are what a real owner would check.
export const EVIDENCE = [
  { id: 'E-101', type: 'Order email', ref: 'S-1043', date: 'Tue 3 Nov', from: 'Greenfield Ltd', text: 'Please go ahead with the order as discussed. Total 860.', amount: 860 },
  { id: 'E-102', type: 'Phone note', ref: 'S-1051', date: 'Tue 3 Nov', from: 'Greenfield Ltd', text: 'Called to check the order they emailed this morning arrived. Total 860.', amount: 860 },
  { id: 'E-103', type: 'Order email', ref: 'S-1047', date: 'Wed 4 Nov', from: 'Summit Supplies', text: 'Confirming the order as quoted. Agreed amount: 380.', amount: 380 },
  { id: 'E-104', type: 'Inbox message', ref: 'R-205', date: 'Mon 2 Nov', from: 'Northside Partners', text: 'Could you send a quote for the order discussed on the phone? Thanks.', amount: null },
];

// Who a reviewer can make the owner of a follow-up (fictional staff).
export const STAFF = ['Ana', 'Ben'];

// The four findings, in the visitor's words. First person only, no "we". Each choice: [value, label, outcome].
//   resolved = an error corrected or a rule satisfied; legitimate = checked and confirmed as genuine;
//   unresolved = still needs confirming (blocks sign-off and release).
// Tuesday's "verify" choice only exists when the recalculation has cleared it: the reviewer still has to look at the
// recalculated figures and confirm them.
export const ISSUES = {
  duplicate: {
    title: 'Potential duplicate',
    kind: 'Duplicate check',
    hero: 'Potential duplicate',
    choices: [['exclude', 'Same order: exclude S-1051', 'resolved'], ['separate', 'Two separate orders: keep both', 'legitimate'], ['notSure', 'Not sure yet', 'unresolved']],
    prevent: 'Check for an existing sale before adding a new one.',
  },
  missing: {
    title: 'Sale with no amount',
    kind: 'Missing information · cross-source',
    hero: 'Sale with no amount',
    choices: [['confirmFromOrder', 'Order email confirms 380: enter it', 'resolved'], ['cantConfirm', 'Can’t confirm yet', 'unresolved']],
    prevent: 'Make the amount a required field.',
  },
  pattern: {
    title: 'Unusual Tuesday sales',
    kind: 'Historical pattern',
    hero: 'Unusual Tuesday sales',
    choices: [['genuine', 'Genuine: keep as is', 'legitimate'], ['verifyRecalc', 'I’ve checked the recalculated figures', 'resolved'], ['investigate', 'Investigate further', 'unresolved']],
    prevent: 'Check unusual days against the source records before the report is shared.',
  },
  followUp: {
    title: 'Request with no next action',
    kind: 'Business rule',
    hero: 'Request with no next action',
    choices: [['assign', 'Assign an owner', 'resolved'], ['handled', 'Already handled (add a note)', 'resolved'], ['leave', 'Leave for now', 'unresolved']],
    prevent: 'Require an owner and a next action when a request is logged.',
  },
};

// The source records are read-only: nothing on the page can change them. Review decisions are stored separately.
const freeze = (rows) => { rows.forEach(Object.freeze); return Object.freeze(rows); };
[SALES, PAYMENTS, REQUESTS, SOURCES, EVIDENCE, STAFF].forEach(freeze);
Object.values(HISTORY.days).forEach(Object.freeze); Object.freeze(HISTORY.weeks); Object.freeze(HISTORY.days); Object.freeze(HISTORY);
