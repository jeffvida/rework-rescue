// Live demo data: one week for a fictional, unnamed small-business operations team. Everything here is made up.
// Three sources that share a Work ID:
//   TRACKER    (18 rows): every piece of work, who owns it, its status and due date.
//   COMPLETION  (7 rows): one row per completed item, with how it was completed.
//   FINANCE     (5 rows): one row per invoice raised.
// Exactly three problems are planted (W-316 duplicates W-311; W-307 was delivered but has no invoice; W-314 has no
// owner). W-304 is also missing from finance, but it was internal work, so it must NOT be flagged.
// The engine (./engine.js) works out every number the page shows from these rows; tests/demo.test.mjs checks them.

// The sample week: a completed week (Mon 2 – Fri 6 Nov 2026). Work due after it is still open.
// The demo window's title bar in index.html shows this label; home.js writes it in and tests/demo.test.mjs pins the HTML to it.
export const WEEK = 'Week ending Fri 6 Nov 2026';

// status: 'Not started' | 'In progress' | 'Complete'. owner '' = nobody assigned.
export const TRACKER = [
  { id: 'W-301', work: 'Monthly supplier statement', owner: 'Alex', status: 'Complete', due: 'Mon 2 Nov' },
  { id: 'W-302', work: 'New customer setup', owner: 'Priya', status: 'Complete', due: 'Tue 3 Nov' },
  { id: 'W-303', work: 'Service contract renewal', owner: 'Sam', status: 'Complete', due: 'Tue 3 Nov' },
  { id: 'W-304', work: 'Update the staff rota', owner: 'Jordan', status: 'Complete', due: 'Wed 4 Nov' },
  { id: 'W-305', work: 'Equipment order for a customer', owner: 'Alex', status: 'Complete', due: 'Wed 4 Nov' },
  { id: 'W-306', work: 'Quarterly customer review', owner: 'Priya', status: 'Complete', due: 'Thu 5 Nov' },
  { id: 'W-307', work: 'Customer training session', owner: 'Sam', status: 'Complete', due: 'Thu 5 Nov' },
  { id: 'W-308', work: 'Monthly sales report', owner: 'Jordan', status: 'In progress', due: 'Fri 6 Nov' },
  { id: 'W-309', work: 'Follow up overdue payments', owner: 'Alex', status: 'In progress', due: 'Fri 6 Nov' },
  { id: 'W-310', work: 'Quarterly stock count', owner: 'Priya', status: 'Not started', due: 'Mon 9 Nov' },
  { id: 'W-311', work: 'Website content update', owner: 'Sam', status: 'In progress', due: 'Tue 10 Nov' },
  { id: 'W-312', work: 'Supplier price review', owner: 'Jordan', status: 'Not started', due: 'Wed 11 Nov' },
  { id: 'W-313', work: 'New starter onboarding', owner: 'Priya', status: 'In progress', due: 'Wed 11 Nov' },
  { id: 'W-314', work: 'Customer feedback survey', owner: '', status: 'Not started', due: 'Fri 6 Nov' },
  { id: 'W-315', work: 'Insurance renewal paperwork', owner: 'Alex', status: 'Not started', due: 'Thu 12 Nov' },
  { id: 'W-316', work: 'Website content update', owner: 'Jordan', status: 'Not started', due: 'Tue 10 Nov' },
  { id: 'W-317', work: 'Office equipment check', owner: 'Sam', status: 'Not started', due: 'Fri 13 Nov' },
  { id: 'W-318', work: 'Annual pricing update', owner: 'Jordan', status: 'Not started', due: 'Fri 13 Nov' },
];

// billable: whether the completed work should lead to an invoice (shown to the visitor as the result text).
export const COMPLETION = [
  { id: 'W-301', completed: 'Mon 2 Nov', result: 'Delivered to customer', billable: true },
  { id: 'W-302', completed: 'Tue 3 Nov', result: 'Delivered to customer', billable: true },
  { id: 'W-303', completed: 'Tue 3 Nov', result: 'Delivered to customer', billable: true },
  { id: 'W-304', completed: 'Wed 4 Nov', result: 'Internal task, no invoice', billable: false },
  { id: 'W-305', completed: 'Wed 4 Nov', result: 'Delivered to customer', billable: true },
  { id: 'W-306', completed: 'Thu 5 Nov', result: 'Delivered to customer', billable: true },
  { id: 'W-307', completed: 'Thu 5 Nov', result: 'Delivered to customer', billable: true },
];

export const FINANCE = [
  { id: 'W-301', invoice: 'INV-2041', amount: 1250, status: 'Paid' },
  { id: 'W-302', invoice: 'INV-2042', amount: 640, status: 'Sent' },
  { id: 'W-303', invoice: 'INV-2043', amount: 2100, status: 'Sent' },
  { id: 'W-305', invoice: 'INV-2044', amount: 890, status: 'Sent' },
  { id: 'W-306', invoice: 'INV-2045', amount: 480, status: 'Sent' },
];

export const SOURCES = [
  { id: 'tracker', name: 'Operations Tracker', fields: ['Work ID', 'Work', 'Owner', 'Status', 'Due'] },
  { id: 'completion', name: 'Completion Log', fields: ['Work ID', 'Completed', 'Result'] },
  { id: 'finance', name: 'Finance Register', fields: ['Work ID', 'Invoice', 'Amount', 'Status'] },
];

// Fictional team for "Assign someone", and the preset reasons for leaving an item pending (no free text).
export const TEAM = ['Alex', 'Priya', 'Sam', 'Jordan'];
export const PENDING_REASONS = ['Waiting for information', 'Work is on hold', 'Owner not yet confirmed', 'Needs further review'];

// The three issues the checks can find, in the visitor's words. First person only, no "we".
export const ISSUES = {
  duplicate: {
    title: 'Possible duplicate',
    card: ['Possible duplicate task', 'Two records may describe the same work.'],
    explain: 'This work appears more than once. Should these records be treated as one item or kept separate?',
    why: 'A duplicate makes the workload look bigger than it is, and two people may end up doing the same work.',
    choices: [['merge', 'Merge these records'], ['separate', 'Keep them separate']],
  },
  finance: {
    title: 'Completed work without a finance match',
    card: ['Completed work not invoiced', 'One completed item has no matching invoice.'],
    explain: 'This work is marked as complete, but there’s no matching entry in the finance register.',
    why: 'Not every completed item needs an invoice. Some work is internal, under warranty or not billable, so this needs a decision rather than an automatic fix.',
    choices: [['followUp', 'Flag for invoice follow-up'], ['noInvoiceDue', 'Confirm no invoice is due']],
  },
  owner: {
    title: 'No one assigned',
    card: ['Work without an owner', 'One open task needs someone responsible.'],
    explain: 'This item is still open, but nobody is listed as responsible for it.',
    why: 'Work without an owner is easy to miss, and nobody knows who should follow it up.',
    choices: [['assign', 'Assign someone'], ['pending', 'Leave it pending']],
  },
};

// One-line consequence shown after each choice.
export const CONSEQUENCE = {
  merge: 'Merged into one item. Open work goes down by one.',
  separate: 'Kept as two items. They won’t be flagged again.',
  followUp: 'Added to the invoice follow-ups. It stays counted as not invoiced until an invoice is raised.',
  noInvoiceDue: 'Recorded as not billable. It no longer counts as not invoiced.',
  assign: (who) => `Assigned to ${who}. Every open item now has an owner.`,
  pending: (reason) => `Left pending: ${reason.toLowerCase()}. It stays visible as open with no owner, with the reason recorded.`,
};

// Stage 4: how each problem gets prevented next time.
export const PREVENTION = [
  { issue: 'duplicate', before: 'New work is added without checking the tracker.', after: 'Check for an existing record before creating a new one.' },
  { issue: 'finance', before: 'Invoices are matched to completed work by memory.', after: 'Add a completion-to-invoice check.' },
  { issue: 'owner', before: 'Items can become active with no one responsible.', after: 'Require an owner before an item becomes active.' },
];
