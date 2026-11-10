// Weekly Work & Follow-up Tracker: the one set of sample records, options and labels (implementation brief, 10 Nov 2026).
// This file is the single source for BOTH the website preview (src/tracker/engine.js, ui.js) and the downloadable
// workbook (tools/build_tracker_xlsx.py reads it through Node). Change the sample here, then rebuild the workbook.
// Fictional, industry-neutral business. The issues in R-104 (overdue), R-111 (blank Customer / Area) and
// R-112 (Unassigned) are deliberate; don't fix them here.

const freeze = (rows) => Object.freeze(rows.map((r) => Object.freeze({ ...r })));

export const PERIOD = Object.freeze({ start: '2026-11-02', end: '2026-11-06', asAt: '2026-11-06' });
export const PERIOD_LABEL = '2–6 November 2026';
export const AS_AT_LABEL = '6 November 2026';

export const OWNERS = Object.freeze(['Ana', 'Mark', 'Sam', 'Unassigned']);
export const STATUSES = Object.freeze(['Not Started', 'In Progress', 'Waiting', 'Completed']);
export const COMPLETED = 'Completed';
export const UNASSIGNED = 'Unassigned';

// Fields in workbook order. `essential` fields are the ones the missing-information rule checks.
export const FIELDS = Object.freeze([
  { key: 'ref', label: 'Ref' },
  { key: 'received', label: 'Date Received', essential: true },
  { key: 'task', label: 'Request / Task', essential: true },
  { key: 'customer', label: 'Customer / Area', essential: true },
  { key: 'owner', label: 'Assigned To' },
  { key: 'due', label: 'Due Date', essential: true },
  { key: 'status', label: 'Status' },
].map(Object.freeze));

// The words used for each finding, in the tracker's Attention Flag column (website and workbook alike).
export const FLAG = Object.freeze({
  overdue: 'Overdue',
  missingCustomer: 'Missing customer / area',
  missing: 'Missing information',
  unassigned: 'No owner assigned',
  duplicate: 'Possible duplicate — review',
});
export const FLAG_SEP = ' · ';

export const RECORDS = freeze([
  { ref: 'R-101', received: '2026-11-02', task: 'Send updated quotation', customer: 'Northfield Services', owner: 'Ana', due: '2026-11-03', status: 'Completed' },
  { ref: 'R-102', received: '2026-11-02', task: 'Confirm customer details', customer: 'Lakeside Trading', owner: 'Mark', due: '2026-11-04', status: 'Completed' },
  { ref: 'R-103', received: '2026-11-02', task: 'Prepare monthly report', customer: 'Cedar & Co.', owner: 'Ana', due: '2026-11-06', status: 'Completed' },
  { ref: 'R-104', received: '2026-11-03', task: 'Follow up on payment', customer: 'Harbor Works', owner: 'Mark', due: '2026-11-04', status: 'Waiting' },
  { ref: 'R-105', received: '2026-11-03', task: 'Update customer records', customer: 'Brightline Studio', owner: 'Mark', due: '2026-11-06', status: 'Completed' },
  { ref: 'R-106', received: '2026-11-04', task: 'Schedule service visit', customer: 'Northfield Services', owner: 'Ana', due: '2026-11-06', status: 'In Progress' },
  { ref: 'R-107', received: '2026-11-04', task: 'Send invoice copy', customer: 'Lakeside Trading', owner: 'Mark', due: '2026-11-06', status: 'Completed' },
  { ref: 'R-108', received: '2026-11-04', task: 'Review supplier quote', customer: 'Cedar & Co.', owner: 'Sam', due: '2026-11-06', status: 'Waiting' },
  { ref: 'R-109', received: '2026-11-05', task: 'Confirm delivery date', customer: 'Harbor Works', owner: 'Ana', due: '2026-11-06', status: 'Completed' },
  { ref: 'R-110', received: '2026-11-05', task: 'Prepare weekly update', customer: 'Brightline Studio', owner: 'Sam', due: '2026-11-06', status: 'Completed' },
  { ref: 'R-111', received: '2026-11-06', task: 'Check service notes', customer: '', owner: 'Mark', due: '2026-11-06', status: 'In Progress' },
  { ref: 'R-112', received: '2026-11-06', task: 'Confirm outstanding item', customer: 'Northfield Services', owner: 'Unassigned', due: '2026-11-06', status: 'Not Started' },
]);
