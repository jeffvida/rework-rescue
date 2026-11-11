// Weekly Work & Follow-up Tracker: the one set of sample records, options and labels (implementation brief, 10 Nov 2026).
// This file is the single source for BOTH the website preview (src/tracker/engine.js, ui.js) and the downloadable
// workbook (tools/build_tracker_xlsx.py reads it through Node). Change the sample here, then rebuild the workbook.
// Fictional business: Northstar Services (BUSINESS), a small service business; the name is shown in the hero report,
// the live example and the workbook. The issues in R-104 (overdue), R-111 (blank Customer / Area) and
// R-112 (Unassigned) are deliberate; don't fix them here. Sample jobs are field work (cleaning and maintenance, 11 Nov 2026 PM review).
// Completed jobs carry their Date Completed (11 Nov 2026:
// the report counts jobs completed this week and every job still open, wherever it started).

const freeze = (rows) => Object.freeze(rows.map((r) => Object.freeze({ ...r })));

export const PERIOD = Object.freeze({ start: '2026-11-02', end: '2026-11-06', asAt: '2026-11-06' });
export const BUSINESS = 'Northstar Services';
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
  { key: 'completed', label: 'Date Completed' },
].map(Object.freeze));

// The words used for each finding, in the tracker's Attention Flag column (website and workbook alike); they match the
// issue tags in the live example's report (11 Nov 2026).
export const FLAG = Object.freeze({
  overdue: 'Overdue',
  missingCustomer: 'Missing customer',
  missing: 'Missing information',
  unassigned: 'No owner',
  duplicate: 'Possible duplicate',
  noDate: 'No completion date',
});
export const FLAG_SEP = ' · ';

export const RECORDS = freeze([
  { ref: 'R-101', received: '2026-11-02', task: 'Quote for end-of-lease clean', customer: 'Ridgeway Apartments', owner: 'Ana', due: '2026-11-03', status: 'Completed', completed: '2026-11-03' },
  { ref: 'R-102', received: '2026-11-02', task: 'Confirm site access', customer: 'Lakeside Trading', owner: 'Mark', due: '2026-11-04', status: 'Completed', completed: '2026-11-04' },
  { ref: 'R-103', received: '2026-11-02', task: 'Monthly office clean', customer: 'Cedar & Co.', owner: 'Ana', due: '2026-11-06', status: 'Completed', completed: '2026-11-06' },
  { ref: 'R-104', received: '2026-11-03', task: 'Follow up on payment', customer: 'Harbor Works', owner: 'Mark', due: '2026-11-04', status: 'Waiting', completed: '' },
  { ref: 'R-105', received: '2026-11-03', task: 'Replace broken door closer', customer: 'Brightline Dental', owner: 'Mark', due: '2026-11-06', status: 'Completed', completed: '2026-11-06' },
  { ref: 'R-106', received: '2026-11-04', task: 'Reschedule site visit', customer: 'Ridgeway Apartments', owner: 'Ana', due: '2026-11-06', status: 'In Progress', completed: '' },
  { ref: 'R-107', received: '2026-11-04', task: 'Send invoice copy', customer: 'Lakeside Trading', owner: 'Mark', due: '2026-11-06', status: 'Completed', completed: '2026-11-06' },
  { ref: 'R-108', received: '2026-11-04', task: 'Order replacement filters', customer: 'Cedar & Co.', owner: 'Sam', due: '2026-11-06', status: 'Waiting', completed: '' },
  { ref: 'R-109', received: '2026-11-05', task: 'Gutter clean', customer: 'Harbor Works', owner: 'Ana', due: '2026-11-06', status: 'Completed', completed: '2026-11-06' },
  { ref: 'R-110', received: '2026-11-05', task: 'Window clean, ground floor', customer: 'Brightline Dental', owner: 'Sam', due: '2026-11-06', status: 'Completed', completed: '2026-11-06' },
  { ref: 'R-111', received: '2026-11-06', task: 'Check service notes', customer: '', owner: 'Mark', due: '2026-11-06', status: 'In Progress', completed: '' },
  { ref: 'R-112', received: '2026-11-06', task: 'Fix leaking tap, unit 4', customer: 'Ridgeway Apartments', owner: 'Unassigned', due: '2026-11-06', status: 'Not Started', completed: '' },
]);
