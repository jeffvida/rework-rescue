// Sample data for the hero card, the three-tab example and the Data & Reporting preview.
// One week for a fictional, unnamed small business. Everything here is made up.
// Three sources:
//   SALES    (12 rows): every sale recorded this week.
//   PAYMENTS  (9 rows): every payment received, with the sale it pays.
//   REQUESTS  (6 rows): customer requests, who owns them and the next action.
// Exactly three things are planted, each found by a stated rule (see CHECKS):
//   S-1051 looks like a duplicate of S-1043 (same customer, date and amount; only one payment).
//   S-1047 has no amount (payment P-307 shows 380 was paid against it).
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
  { id: 'sales', name: 'Sales log', file: 'Sales log.xlsx', fields: ['Ref', 'Date', 'Customer', 'Amount', 'Entered from'] },
  { id: 'payments', name: 'Payments received', file: 'Payments.xlsx', fields: ['Ref', 'Date', 'Sale ref', 'Customer', 'Amount', 'Method'] },
  { id: 'requests', name: 'Customer requests', file: 'Requests sheet', fields: ['Ref', 'Received', 'Customer', 'Request', 'Status', 'Owner', 'Next action'] },
];

// The rule each check applies, in plain words. A request is followed up if it is open longer than this
// many working days with no next action recorded.
export const FOLLOW_UP_DAYS = 2;

// The three kinds of finding, in the visitor's words. First person only, no "we".
export const ISSUES = {
  duplicate: {
    title: 'Potential duplicate',
    hero: 'Potential duplicate to review',
    source: 'Sales log',
    rule: 'Same customer, same date, same amount, different reference.',
    why: (f) => `One entry came in by email and one by phone, and only one payment exists. If they’re the same sale, the total is ${f.amount.toLocaleString('en-US')} too high.`,
    action: 'Confirm with the team, then remove one entry if it’s the same sale.',
    choices: [['remove', (f) => `Same sale, remove ${f.ids[1]}`], ['keep', () => 'Two separate sales, keep both']],
    prevent: 'Check for an existing sale before adding a new one.',
  },
  missing: {
    title: 'Missing information',
    hero: 'Sale with no amount',
    source: 'Sales log + Payments',
    rule: 'Every sale needs an amount.',
    why: (f) => `The total leaves this sale out. Payment ${f.payment.id} shows ${f.payment.amount.toLocaleString('en-US')} was paid against it.`,
    action: (f) => `Confirm the amount (the payment shows ${f.payment.amount.toLocaleString('en-US')}) and fill it in.`,
    choices: [['usePayment', (f) => `Use ${f.payment.amount.toLocaleString('en-US')} from the payment`], ['checkFirst', () => 'Check with the team first']],
    prevent: 'Make the amount a required field.',
  },
  followUp: {
    title: 'Outstanding follow-up',
    hero: 'Quote request with no next action',
    source: 'Customer requests',
    rule: `An open request older than ${FOLLOW_UP_DAYS} working days with no next action recorded.`,
    why: (f) => `${f.record.customer} asked for a quote on ${f.receivedDay}. ${f.days} working days later there’s no owner and no next step.`,
    action: 'Give it an owner and a next action.',
    choices: [['assign', () => 'Assign and add a next action'], ['handled', () => 'Mark as handled']],
    prevent: 'Require an owner and a next action when a request is logged.',
  },
};

// One-line consequence shown after each choice.
export const CONSEQUENCE = {
  remove: (f) => `Removed ${f.ids[1]}. The sales total drops by ${f.amount.toLocaleString('en-US')}.`,
  keep: () => 'Kept as two sales. The second one now shows as waiting for payment.',
  usePayment: (f) => `Amount filled in from ${f.payment.id}. The sales total goes up by ${f.payment.amount.toLocaleString('en-US')}.`,
  checkFirst: () => 'Left for the team to confirm. The sale stays out of the total until it has an amount.',
  assign: () => 'Assigned to Ben, with the next action “Send the quote”.',
  handled: () => 'Marked as handled. It no longer counts as an open request.',
};
