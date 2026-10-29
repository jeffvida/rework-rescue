// Checks engine for the "three messy exports" work sample. Pure functions: no DOM, no clock, no network.
//
// Pipeline: standardise (in a working copy) -> validate -> reconcile -> exception list -> weekly report.
// Each row is checked against the rules in a fixed order and flagged at most once, so
// rows in = rows passed + rows to review, always.

export const CHECKS = [
  { id: 'required', label: 'Required fields', rule: 'Open jobs need an owner; customers need an email address.' },
  { id: 'duplicates', label: 'Duplicates', rule: 'A job number appears once; no two customers share an email address.' },
  { id: 'formats', label: 'Formats', rule: 'Dates are real dates; amounts are numbers.' },
  { id: 'crossfile', label: 'Cross-file match', rule: "Every job's customer is in the customer list; every invoice has a job number that exists." },
  { id: 'billing', label: 'Completed but not invoiced', rule: 'Jobs completed 5 or more days ago are fully invoiced.' },
];
export const INVOICE_WINDOW_DAYS = 5;

// What a reviewer can decide for each kind of exception (the first option is the usual one).
export const DECISIONS = {
  'No owner': ['Assign an owner', 'Leave for now'],
  'Missing email': ['Request the email', 'Leave for now'],
  'Possible duplicate': ['Merge the records', 'Keep both'],
  'Duplicate row': ['Delete the extra row', 'Keep both'],
  'Amount not a number': ['Correct at source', 'Leave for now'],
  'Invalid due date': ['Correct at source', 'Leave for now'],
  'Unknown customer': ['Fix the customer number', 'Add as a new customer'],
  'No job number': ['Add the job number', 'Investigate first'],
  'Not invoiced': ['Raise the invoice', 'Not billable'],
  'Partly invoiced': ['Invoice the remaining visit', 'Not billable'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Real calendar date from "yyyy-mm-dd" or "dd/mm/yyyy". Returns { iso, converted } or null. */
export function parseDate(raw) {
  const s = String(raw || '').trim();
  let y; let m; let d; let converted = false;
  let x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (x) { [y, m, d] = [Number(x[1]), Number(x[2]), Number(x[3])]; } else {
    x = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!x) return null;
    [d, m, y] = [Number(x[1]), Number(x[2]), Number(x[3])];
    converted = true;
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, converted };
}

/** Amount from "1640.00" or "1,640.00". Returns { value, converted } or null. */
export function parseAmount(raw) {
  const s = String(raw ?? '').trim();
  if (/^\d+(\.\d{1,2})?$/.test(s)) return { value: Number(s), converted: false };
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) return { value: Number(s.replace(/,/g, '')), converted: true };
  return null;
}

const dayNo = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const daysBetween = (a, b) => dayNo(b) - dayNo(a);
export const shortDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
export const units = (n) => Math.round(n).toLocaleString('en-US');
/** Fictional amounts, shown in dollars so they read as money. */
export const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const listRefs = (refs) => (refs.length < 2 ? refs.join('') : `${refs.slice(0, -1).join(', ')} and ${refs[refs.length - 1]}`);

/**
 * @param {{REPORT_DATE:string, WEEK:{start:string,end:string}, TRACKER:object[], INVOICES:object[], CUSTOMERS:object[]}} data
 */
export function runSample(data) {
  const report = data.REPORT_DATE;
  const exceptions = [];
  const tidy = { dates: 0, names: 0, amounts: 0 };
  const flag = (e) => exceptions.push(e);

  // ---- customers
  const customers = [];
  const byEmail = new Map();
  const custIds = new Set();
  for (const raw of data.CUSTOMERS) {
    const name = raw.name.trim();
    if (name !== raw.name) tidy.names += 1;
    const c = { id: raw.id, name, email: raw.email.trim() };
    custIds.add(c.id);
    if (!c.email) {
      flag({ record: c.id, file: 'customers', check: 'required', issue: 'Missing email',
        why: 'The customer has no email address, so invoices and reminders have nowhere to go.',
        action: 'Add the email address in the customer list.', detail: `${c.name} · email: (blank)` });
      continue;
    }
    if (byEmail.has(c.email)) {
      const first = byEmail.get(c.email);
      flag({ record: c.id, file: 'customers', check: 'duplicates', issue: 'Possible duplicate',
        why: `Same email address as ${first.id} (${first.name}).`,
        action: 'Confirm whether these are the same customer before merging anything.', detail: `${c.name} · ${c.email}` });
      continue;
    }
    byEmail.set(c.email, c);
    customers.push(c);
  }
  const custName = new Map(data.CUSTOMERS.map((c) => [c.id, c.name.trim()]));

  // ---- jobs (first pass: everything except the billing rule, which needs the invoices)
  const jobs = [];
  const seen = new Set();
  for (const raw of data.TRACKER) {
    if (seen.has(raw.ref)) {
      flag({ record: raw.ref, file: 'tracker', check: 'duplicates', issue: 'Duplicate row',
        why: `Job number ${raw.ref} appears twice in the tracker. Counting both would double it in the report.`,
        action: 'Delete the extra row in the tracker.', detail: `${raw.type} · ${custName.get(raw.customer) || raw.customer}` });
      continue;
    }
    seen.add(raw.ref);
    const open = raw.status !== 'Completed';
    if (open && !raw.owner.trim()) {
      flag({ record: raw.ref, file: 'tracker', check: 'required', issue: 'No owner',
        why: 'The job is open, but nobody is assigned to it.', action: 'Assign an owner.',
        detail: `${raw.type} · ${raw.status} · ${custName.get(raw.customer) || raw.customer}` });
      jobs.push({ ...raw, due: parseDate(raw.due)?.iso || null, flagged: true });
      continue;
    }
    const due = parseDate(raw.due);
    if (!due) {
      flag({ record: raw.ref, file: 'tracker', check: 'formats', issue: 'Invalid due date',
        why: `"${raw.due}" is not a real date, so the job can't be checked for being overdue.`,
        action: 'Correct the due date in the tracker.', detail: `${raw.type} · ${raw.status} · owner ${raw.owner}` });
      jobs.push({ ...raw, due: null, flagged: true });
      continue;
    }
    if (due.converted) tidy.dates += 1;
    if (!custIds.has(raw.customer) && !data.CUSTOMERS.some((c) => c.id === raw.customer)) {
      flag({ record: raw.ref, file: 'tracker', check: 'crossfile', issue: 'Unknown customer',
        why: `Customer ${raw.customer} isn't in the customer list, so the job can't be invoiced correctly.`,
        action: 'Check the customer number, or add the customer to the list.', detail: `${raw.type} · ${raw.status} · owner ${raw.owner}` });
      jobs.push({ ...raw, due: due.iso, flagged: true });
      continue;
    }
    jobs.push({ ...raw, due: due.iso, flagged: false });
  }
  const jobByRef = new Map(jobs.map((j) => [j.ref, j]));

  // ---- invoices
  const invoices = [];
  const billed = new Map();
  for (const raw of data.INVOICES) {
    const amount = parseAmount(raw.amount);
    if (!amount) {
      flag({ record: raw.ref, file: 'invoices', check: 'formats', issue: 'Amount not a number',
        why: `"${raw.amount}" uses a comma for decimals, so it can't be read as an amount.`,
        action: 'Correct the amount in the accounting software.', detail: `Job ${raw.job} · ${shortDate(raw.date)}` });
      if (raw.job) billed.set(raw.job, (billed.get(raw.job) || 0) + raw.visits_billed);
      invoices.push({ ...raw, amount: null, flagged: true });
      continue;
    }
    if (amount.converted) tidy.amounts += 1;
    if (!raw.job || !jobByRef.has(raw.job)) {
      const guess = jobs.find((j) => j.status === 'Completed' && j.customer === raw.customer
        && Math.abs(j.value - amount.value) < 0.005 && !data.INVOICES.some((v) => v.job === j.ref));
      flag({ record: raw.ref, file: 'invoices', check: 'crossfile', issue: raw.job ? 'Unknown job number' : 'No job number', link: guess ? guess.ref : '',
        why: 'The invoice can\'t be matched to a job, so that job looks unbilled.',
        action: guess ? `Likely ${guess.ref} (same customer and amount, completed ${shortDate(guess.completed)}). Add the job number in the accounting software.` : 'Add the job number in the accounting software.',
        detail: `${custName.get(raw.customer) || raw.customer} · ${money(amount.value)} · ${shortDate(raw.date)}` });
      invoices.push({ ...raw, amount: amount.value, flagged: true });
      continue;
    }
    billed.set(raw.job, (billed.get(raw.job) || 0) + raw.visits_billed);
    invoices.push({ ...raw, amount: amount.value, flagged: false });
  }

  // ---- billing rule (jobs that passed the other checks)
  let atRisk = 0;
  const notInvoiced = [];
  for (const j of jobs) {
    if (j.flagged || j.status !== 'Completed' || !j.completed) continue;
    const age = daysBetween(j.completed, report);
    const done = billed.get(j.ref) || 0;
    if (age < INVOICE_WINDOW_DAYS || done >= j.visits) continue;
    const missing = j.value * (j.visits - done) / j.visits;
    atRisk += missing;
    notInvoiced.push(j.ref);
    j.flagged = true;
    flag({ record: j.ref, file: 'tracker', check: 'billing', issue: done ? 'Partly invoiced' : 'Not invoiced',
      why: done ? `Completed ${shortDate(j.completed)}; ${done} of ${j.visits} visits invoiced. ${money(missing)} not yet billed.`
        : `Completed ${shortDate(j.completed)} (${age} days ago) with no invoice. ${money(missing)} not yet billed.`,
      action: 'Raise the invoice, or record why none is needed.', detail: `${j.type} · ${custName.get(j.customer) || j.customer} · owner ${j.owner}` });
  }

  // ---- totals and per-check counts
  const files = [
    { key: 'tracker', label: 'Job tracker', file: 'job-tracker.csv', rows: data.TRACKER.length },
    { key: 'invoices', label: 'Invoices export', file: 'invoices.csv', rows: data.INVOICES.length },
    { key: 'customers', label: 'Customer list', file: 'customers.xlsx', rows: data.CUSTOMERS.length },
  ];
  const rows = files.reduce((n, f) => n + f.rows, 0);
  const order = Object.fromEntries(CHECKS.map((c, i) => [c.id, i]));
  exceptions.sort((a, b) => order[a.check] - order[b.check] || a.record.localeCompare(b.record));
  exceptions.forEach((e, i) => {
    e.id = `x${i + 1}`;
    e.options = e.link ? [`Link to ${e.link}`, 'Investigate first'] : (DECISIONS[e.issue] || ['Correct at source', 'Leave for now']);
  });
  const checks = CHECKS.map((c) => ({ ...c, flagged: exceptions.filter((e) => e.check === c.id).length }));
  const totals = { rows, review: exceptions.length, passed: rows - exceptions.length };

  // ---- weekly report (from the working copy; flagged rows are listed, not silently "fixed")
  const inWeek = (iso) => iso && iso >= data.WEEK.start && iso <= data.WEEK.end;
  const open = jobs.filter((j) => j.status !== 'Completed');
  const overdue = open.filter((j) => j.due && j.due < report).map((j) => j.ref);
  const noOwner = open.filter((j) => !j.owner.trim()).map((j) => j.ref);
  const dueToConfirm = open.filter((j) => !j.due).map((j) => j.ref);
  const weekInvoices = invoices.filter((v) => inWeek(v.date));
  const heldAmounts = weekInvoices.filter((v) => v.amount === null).map((v) => v.ref);
  const sourceFixes = exceptions.filter((e) => e.file !== 'customers' && !['billing', 'required'].includes(e.check)).map((e) => e.record);
  const customerChecks = exceptions.filter((e) => e.file === 'customers').map((e) => e.record);

  const followUps = [];
  if (notInvoiced.length) followUps.push({ action: `Raise or confirm invoices for ${listRefs(notInvoiced)}.`, why: `Completed ${INVOICE_WINDOW_DAYS} or more days ago and not fully invoiced: ${money(atRisk)} not yet billed.`, refs: notInvoiced });
  if (noOwner.length) followUps.push({ action: `Assign owners to ${listRefs(noOwner)}.`, why: 'Open jobs with nobody responsible.', refs: noOwner });
  if (overdue.length) followUps.push({ action: `Agree next steps on ${overdue.length} overdue jobs.`, why: `Open, and due before ${shortDate(report)}.`, refs: overdue });
  if (sourceFixes.length) followUps.push({ action: `Correct ${sourceFixes.length} records in the tracker and accounting exports.`, why: 'So the same problems don\'t come back next week.', refs: sourceFixes });
  if (customerChecks.length) followUps.push({ action: `Confirm ${customerChecks.length} customer records.`, why: 'A missing email and a possible duplicate.', refs: customerChecks });

  // ---- open jobs: weekly flow, age, status and the ones that need attention
  const AGE_BANDS = [{ label: '0–7 days', max: 7 }, { label: '8–14 days', max: 14 }, { label: '15+ days', max: Infinity }];
  const STATUS_ORDER = ['In progress', 'Waiting for update', 'Not started'];
  const openedThisWeek = jobs.filter((j) => inWeek(j.received)).length;
  const completedThisWeek = jobs.filter((j) => j.status === 'Completed' && inWeek(j.completed)).length;
  const openRows = open.map((j) => {
    const reasons = [];
    if (j.due && j.due < report) reasons.push(`Overdue by ${daysBetween(j.due, report)} days`);
    if (!j.owner.trim()) reasons.push('No owner');
    if (!j.due) reasons.push('Due date to confirm');
    return { ref: j.ref, type: j.type, customer: custName.get(j.customer) || j.customer, owner: j.owner.trim(), status: j.status,
      age: daysBetween(j.received, report), due: j.due ? shortDate(j.due) : 'To confirm', dueIso: j.due || '', reasons };
  }).sort((a, b) => b.age - a.age || a.ref.localeCompare(b.ref));
  const rank = (r) => (r.reasons.some((x) => x.startsWith('Overdue')) ? 0 : r.reasons.includes('No owner') ? 1 : 2);
  const openJobs = {
    inTracker: jobs.length,
    completedAll: jobs.filter((j) => j.status === 'Completed').length,
    opened: openedThisWeek,
    completed: completedThisWeek,
    now: open.length,
    startOfWeek: open.length + completedThisWeek - openedThisWeek,
    ageing: AGE_BANDS.map((band, i) => ({ label: band.label,
      count: openRows.filter((r) => r.age <= band.max && (i === 0 || r.age > AGE_BANDS[i - 1].max)).length })),
    byStatus: STATUS_ORDER.map((st) => ({ status: st, count: openRows.filter((r) => r.status === st).length })).filter((x) => x.count),
    attention: openRows.filter((r) => r.reasons.length).sort((a, b) => rank(a) - rank(b) || (a.dueIso || '9').localeCompare(b.dueIso || '9') || a.ref.localeCompare(b.ref)),
    all: openRows,
  };

  const reportData = {
    openJobs,
    jobs: jobs.length,
    completedThisWeek: jobs.filter((j) => j.status === 'Completed' && inWeek(j.completed)).length,
    open: open.length,
    overdue: overdue.length,
    noOwner: noOwner.length,
    dueToConfirm,
    invoicesThisWeek: weekInvoices.length,
    invoicedThisWeek: weekInvoices.reduce((s, v) => s + (v.amount || 0), 0),
    heldAmounts,
    notInvoiced,
    atRisk,
    followUps,
    summary: `This week: ${money(atRisk)} not yet billed across ${notInvoiced.length} jobs, ${overdue.length} jobs overdue and ${noOwner.length} with no owner. ${exceptions.length} data issues were flagged for review.`,
  };

  return { files, tidy, checks, exceptions, totals, report: reportData };
}
