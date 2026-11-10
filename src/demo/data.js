// The single source of truth for the homepage demonstration (spec 10 Nov 2026, "management reporting").
// One fictional small service business, one reporting week (Mon 2 – Fri 6 Nov 2026). Everything here is made up.
// The hero, Findings, Sources, Management Summary, the published report and the departmental action register all
// read these rows through ./engine.js: no component keeps its own figures.
//
// Three sources, each in its own native format (consolidation standardises them; the originals are never changed):
//   WORK      Work Register, 18 records: 7 recorded as completed (Mon 1, Tue 2, Wed 1, Thu 2, Fri 1), 11 recorded as open.
//             Dates ISO (2026-11-03).
//   INVOICES  Invoice Tracker, 7 records. Dates dd/mm/yyyy. Each invoice references a work record or a request.
//   REQUESTS  Customer Requests, 10 records. Dates "Tue 3 Nov".
//
// The four findings the checks produce (each traceable to its rows):
//   W-1043 / W-1051  same customer, service address, job type and scheduled date, different reference; both point at
//                    request R-303. W-1043 is completed, W-1051 is still open.
//   W-1047           completed, but no invoice references it. INV-2107 (same customer) references its request R-307
//                    instead: a possible match, not a confirmed one.
//   W-1055           open and past its due date (Wed 4 Nov). Request R-308 asked to move it to Fri 13 Nov.
//   W-1056           open with no owner and no next action.
// No job type, address or amount is meant to suggest one trade. There are no prices or money amounts anywhere.

export const WEEK = 'Week ending Fri 6 Nov 2026';
export const REPORT_DATE = '2026-11-06';
export const PERIOD = { start: '2026-11-02', end: '2026-11-06', label: '2–6 November 2026' };

// status: 'Completed' | 'Open'. completed: ISO date or ''. owner / next: '' = left blank.
export const WORK = [
  { id: 'W-1041', request: 'R-301', customer: 'Bayview Co.', address: '12 Harbour Rd', jobType: 'Maintenance', scheduled: '2026-11-02', due: '2026-11-02', status: 'Completed', completed: '2026-11-02', owner: 'Ana', next: 'Done' },
  { id: 'W-1042', request: 'R-302', customer: 'Oakline Studio', address: '4 Mill Lane', jobType: 'Consultation', scheduled: '2026-11-03', due: '2026-11-03', status: 'Completed', completed: '2026-11-03', owner: 'Ben', next: 'Done' },
  { id: 'W-1043', request: 'R-303', customer: 'Greenfield Ltd', address: '88 Station St', jobType: 'Installation', scheduled: '2026-11-03', due: '2026-11-03', status: 'Completed', completed: '2026-11-03', owner: 'Ana', next: 'Done' },
  { id: 'W-1044', request: 'R-304', customer: 'Summit Supplies', address: '3 Quarry Way', jobType: 'Inspection', scheduled: '2026-11-06', due: '2026-11-06', status: 'Completed', completed: '2026-11-06', owner: 'Ben', next: 'Done' },
  { id: 'W-1045', request: 'R-305', customer: 'Riverside Group', address: '21 Bank St', jobType: 'Maintenance', scheduled: '2026-11-05', due: '2026-11-05', status: 'Completed', completed: '2026-11-05', owner: 'Carla', next: 'Done' },
  { id: 'W-1046', request: 'R-306', customer: 'Westgate Clinic', address: '9 Elm Rd', jobType: 'Site visit', scheduled: '2026-11-05', due: '2026-11-05', status: 'Completed', completed: '2026-11-05', owner: 'Ana', next: 'Done' },
  { id: 'W-1047', request: 'R-307', customer: 'Lakeside Cafe', address: '2 Pier Rd', jobType: 'Installation', scheduled: '2026-11-04', due: '2026-11-04', status: 'Completed', completed: '2026-11-04', owner: 'Ben', next: 'Done' },
  { id: 'W-1048', request: '', customer: 'Harper & Co.', address: '15 King St', jobType: 'Maintenance', scheduled: '2026-11-09', due: '2026-11-09', status: 'Open', completed: '', owner: 'Carla', next: 'Visit booked Mon 9 Nov' },
  { id: 'W-1049', request: 'R-310', customer: 'Northside Partners', address: '40 North Ave', jobType: 'Consultation', scheduled: '2026-11-06', due: '2026-11-10', status: 'Open', completed: '', owner: 'Ben', next: 'Send summary notes' },
  { id: 'W-1050', request: '', customer: 'Pinecrest Offices', address: '7 Ridge Rd', jobType: 'Inspection', scheduled: '2026-11-10', due: '2026-11-10', status: 'Open', completed: '', owner: 'Ana', next: 'Confirm site access' },
  { id: 'W-1051', request: 'R-303', customer: 'Greenfield Ltd', address: '88 Station St', jobType: 'Installation', scheduled: '2026-11-03', due: '2026-11-10', status: 'Open', completed: '', owner: 'Ben', next: 'Book installation' },
  { id: 'W-1052', request: '', customer: 'Bayview Co.', address: '12 Harbour Rd', jobType: 'Inspection', scheduled: '2026-11-11', due: '2026-11-11', status: 'Open', completed: '', owner: 'Carla', next: 'Confirm date' },
  { id: 'W-1053', request: '', customer: 'Oakline Studio', address: '4 Mill Lane', jobType: 'Maintenance', scheduled: '2026-11-12', due: '2026-11-12', status: 'Open', completed: '', owner: 'Ana', next: 'Order parts' },
  { id: 'W-1054', request: '', customer: 'Riverside Group', address: '21 Bank St', jobType: 'Site visit', scheduled: '2026-11-06', due: '2026-11-09', status: 'Open', completed: '', owner: 'Carla', next: 'Write up visit notes' },
  { id: 'W-1055', request: 'R-308', customer: 'Westgate Clinic', address: '9 Elm Rd', jobType: 'Installation', scheduled: '2026-11-03', due: '2026-11-04', status: 'Open', completed: '', owner: 'Ben', next: 'Installation pending' },
  { id: 'W-1056', request: 'R-309', customer: 'Summit Supplies', address: '3 Quarry Way', jobType: 'Consultation', scheduled: '2026-11-09', due: '2026-11-09', status: 'Open', completed: '', owner: '', next: '' },
  { id: 'W-1057', request: '', customer: 'Lakeside Cafe', address: '2 Pier Rd', jobType: 'Maintenance', scheduled: '2026-11-13', due: '2026-11-13', status: 'Open', completed: '', owner: 'Ben', next: 'Schedule visit' },
  { id: 'W-1058', request: '', customer: 'Pinecrest Offices', address: '7 Ridge Rd', jobType: 'Consultation', scheduled: '2026-11-11', due: '2026-11-11', status: 'Open', completed: '', owner: 'Ana', next: 'Prepare proposal' },
];

// work / request: the record the invoice references ('' = none). Dates as the tracker keeps them (dd/mm/yyyy).
export const INVOICES = [
  { id: 'INV-2101', date: '02/11/2026', customer: 'Bayview Co.', work: 'W-1041', request: '', status: 'Issued' },
  { id: 'INV-2102', date: '03/11/2026', customer: 'Oakline Studio', work: 'W-1042', request: '', status: 'Issued' },
  { id: 'INV-2103', date: '03/11/2026', customer: 'Greenfield Ltd', work: 'W-1043', request: '', status: 'Issued' },
  { id: 'INV-2104', date: '05/11/2026', customer: 'Riverside Group', work: 'W-1045', request: '', status: 'Issued' },
  { id: 'INV-2105', date: '05/11/2026', customer: 'Westgate Clinic', work: 'W-1046', request: '', status: 'Issued' },
  { id: 'INV-2106', date: '06/11/2026', customer: 'Summit Supplies', work: 'W-1044', request: '', status: 'Issued' },
  { id: 'INV-2107', date: '04/11/2026', customer: 'Lakeside Cafe', work: '', request: 'R-307', status: 'Issued' },
];

// Dates as the request log keeps them ("Tue 3 Nov"). work: the work record raised from the request.
export const REQUESTS = [
  { id: 'R-301', received: 'Mon 2 Nov', customer: 'Bayview Co.', request: 'Routine maintenance', channel: 'Email', work: 'W-1041' },
  { id: 'R-302', received: 'Mon 2 Nov', customer: 'Oakline Studio', request: 'Consultation', channel: 'Phone', work: 'W-1042' },
  { id: 'R-303', received: 'Mon 2 Nov', customer: 'Greenfield Ltd', request: 'Installation at 88 Station St on Tue 3 Nov', channel: 'Email', work: 'W-1043' },
  { id: 'R-304', received: 'Tue 3 Nov', customer: 'Summit Supplies', request: 'Site inspection', channel: 'Email', work: 'W-1044' },
  { id: 'R-305', received: 'Tue 3 Nov', customer: 'Riverside Group', request: 'Maintenance visit', channel: 'Phone', work: 'W-1045' },
  { id: 'R-306', received: 'Tue 3 Nov', customer: 'Westgate Clinic', request: 'Site visit', channel: 'Email', work: 'W-1046' },
  { id: 'R-307', received: 'Tue 3 Nov', customer: 'Lakeside Cafe', request: 'Installation', channel: 'Email', work: 'W-1047' },
  { id: 'R-308', received: 'Wed 4 Nov', customer: 'Westgate Clinic', request: 'Please move the installation to Fri 13 Nov', channel: 'Email', work: 'W-1055' },
  { id: 'R-309', received: 'Thu 5 Nov', customer: 'Summit Supplies', request: 'Consultation about a second site', channel: 'Phone', work: 'W-1056' },
  { id: 'R-310', received: 'Thu 5 Nov', customer: 'Northside Partners', request: 'Consultation', channel: 'Email', work: 'W-1049' },
];

export const SOURCES = [
  { id: 'work', name: 'Work Register', format: 'Dates as 2026-11-03', fields: ['Ref', 'Request', 'Customer', 'Service address', 'Job type', 'Scheduled', 'Due', 'Status', 'Completed', 'Owner', 'Next action'] },
  { id: 'invoices', name: 'Invoice Tracker', format: 'Dates as 03/11/2026', fields: ['Invoice', 'Date', 'Customer', 'Work ref', 'Request ref', 'Status'] },
  { id: 'requests', name: 'Customer Requests', format: 'Dates as Tue 3 Nov', fields: ['Ref', 'Received', 'Customer', 'Request', 'Channel', 'Work ref'] },
];

// Fictional staff a reviewer can choose as an owner.
export const STAFF = ['Ana', 'Ben', 'Carla'];

// Demonstration rules (configurable per business, not universal standards).
export const RULES = {
  duplicateKeys: ['customer', 'address', 'jobType', 'scheduled'],
  required: { work: ['id', 'customer', 'address', 'jobType', 'scheduled', 'due', 'status'], invoices: ['id', 'date', 'customer', 'status'], requests: ['id', 'received', 'customer', 'request'] },
};

// The four findings, in plain words. Type (plain label, with the technical classification kept for reference), whether
// the finding can stop the report going out, who could handle it (a suggestion, not confirmed ownership), and the
// reviewer's choices: [value, label, resulting status].
//   status: investigate = To check · resolved = Fixed · legitimate = Confirmed OK · action = Needs action ·
//           disclosed = Noted in the report
export const ISSUES = {
  duplicate: {
    title: 'Possible double entry',
    category: 'integrity',
    blocking: true,
    team: 'Admin',
    action: 'Check the two original records',
    choices: [
      ['exclude', 'Same job: count it once', 'resolved'],
      ['separate', 'Two different jobs: keep both', 'legitimate'],
      ['disclose', 'Not sure yet: send the report with a note', 'disclosed'],
    ],
  },
  invoice: {
    title: 'Finished job not invoiced',
    category: 'reconciliation',
    blocking: false,
    team: 'Finance',
    action: 'Check the invoices',
    choices: [
      ['link', 'It’s on invoice INV-2107: link them', 'resolved'],
      ['outstanding', 'Not invoiced yet: add a follow-up', 'action'],
      ['leave', 'Check later', 'investigate'],
    ],
  },
  overdue: {
    title: 'Late job',
    category: 'operational',
    blocking: false,
    team: 'Operations',
    action: 'Find out why and agree the next step',
    choices: [
      ['confirm', 'Yes, it’s late', 'action'],
      ['correctDate', 'The date was wrong: change it to Fri 13 Nov', 'resolved'],
      ['assign', 'Give someone the follow-up', 'action'],
    ],
  },
  owner: {
    title: 'No one assigned',
    category: 'operational',
    blocking: false,
    team: 'Operations',
    action: 'Assign someone',
    choices: [
      ['assign', 'Assign someone', 'resolved'],
      ['handled', 'Already dealt with', 'resolved'],
      ['leave', 'Leave for now', 'action'],
    ],
  },
};

// Plain labels first; the technical classification stays available for anyone who wants it.
export const CATEGORIES = {
  integrity: 'Affects the numbers',
  reconciliation: 'Files don’t match',
  operational: 'Work to follow up',
  insight: 'Trend',
};
export const CATEGORY_TERMS = {
  integrity: 'Data integrity issue',
  reconciliation: 'Reconciliation issue',
  operational: 'Operational exception',
  insight: 'Performance insight',
};

// The source records are read-only: nothing on the page can change them. Review decisions are stored separately.
const freeze = (rows) => { rows.forEach(Object.freeze); return Object.freeze(rows); };
[WORK, INVOICES, REQUESTS, SOURCES, STAFF].forEach(freeze);
Object.freeze(CATEGORIES); Object.freeze(CATEGORY_TERMS);
Object.freeze(PERIOD); Object.freeze(RULES.duplicateKeys); Object.freeze(RULES.required); Object.freeze(RULES);
