// Checks engine for work sample 2, "Recurring bills across sites". Pure functions: no DOM, no clock, no network.
//
// Pipeline: tidy (in a working copy) -> expected vs received -> per-bill checks -> exception list -> monthly summary.
// Each row is flagged at most once, so rows in = rows passed + rows to review, always.

import { parseDate, parseAmount, money, shortDate } from '../sample/engine.js';

export const USAGE_LIMIT = 0.4; // flag utility usage more than 40% above its 6-month average
const FIXED = new Set(['Internet', 'Waste', 'Rent']);
const SUPPLIER_CATEGORY = { 'metro power': 'Electricity', 'city water': 'Water', linkfast: 'Internet', 'greenbin collections': 'Waste' };

export const CHECKS = [
  { id: 'complete', label: 'Every bill received', rule: 'Every active contract has a bill for this month.' },
  { id: 'duplicates', label: 'Duplicates', rule: 'Each supplier invoice number appears once.' },
  { id: 'match', label: 'Contract match', rule: 'Every bill belongs to an active contract.' },
  { id: 'price', label: 'Price', rule: 'Fixed-price bills match the contract price.' },
  { id: 'usage', label: 'Usage and readings', rule: `Utility bills use actual readings, and usage is no more than ${USAGE_LIMIT * 100}% above the 6-month average.` },
];

export const DECISIONS = {
  'Bill not received': ['Request a copy from the supplier', 'Not due this month'],
  'Duplicate bill': ['Pay once, remove the copy', 'Keep both'],
  'Site closed': ['Dispute with the supplier', 'Approve as a final bill'],
  'No contract': ['Query with the supplier', 'Add to the contract list'],
  'Price above contract': ['Query the price change', 'Approve the new price'],
  'Usage spike': ['Ask the site to check', 'Approve as normal'],
  'Estimated reading': ['Submit an actual reading', 'Accept the estimate'],
};

/** "USD 1,234.50", "1,234.50" or "1234.50" -> { value, converted } */
export function parseMoney(raw) {
  const s = String(raw ?? '').trim();
  const usd = /^USD\s+/i.test(s);
  const a = parseAmount(s.replace(/^USD\s+/i, ''));
  return a ? { value: a.value, converted: a.converted || usd } : null;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const monthName = (ym) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(ym.split('-')[1]) - 1];

export function runBills(data) {
  const period = data.PERIOD;
  const exceptions = [];
  const tidy = { dates: 0, amounts: 0, suppliers: 0 };
  const flag = (e) => exceptions.push(e);
  const contractByAccount = new Map(data.CONTRACTS.map((c) => [c.account, c]));
  const siteName = new Map(data.SITES.map((s) => [s.id, s.name]));

  // 6-month average usage per utility account
  const hist = new Map();
  for (const h of data.HISTORY) {
    const x = hist.get(h.account) || { sum: 0, n: 0 };
    x.sum += h.usage; x.n += 1; hist.set(h.account, x);
  }
  const average = (acct) => { const x = hist.get(acct); return x ? x.sum / x.n : null; };

  // ---- bills
  const bills = [];
  const seen = new Set();
  for (const raw of data.BILLS) {
    const supplier = raw.supplier.trim();
    const canonical = supplier.toLowerCase();
    const d = parseDate(raw.issued); if (d && d.converted) tidy.dates += 1;
    const m = parseMoney(raw.amount); if (m && m.converted) tidy.amounts += 1;
    const amount = m ? m.value : 0;
    const contract = contractByAccount.get(raw.account);
    if (supplier.toLowerCase() === (contract ? contract.supplier : supplier).toLowerCase() && supplier === supplier.toUpperCase()) tidy.suppliers += 1;
    const category = contract ? contract.category : SUPPLIER_CATEGORY[canonical] || 'Other';
    const site = contract ? contract.site : '';
    const bill = { ...raw, supplier: contract ? contract.supplier : supplier, amount, category, site, flagged: false };
    bills.push(bill);
    const key = `${canonical}|${raw.invoice}`;
    const where = contract ? `${site} ${siteName.get(site)}` : raw.site_on_bill;
    const base = { record: raw.invoice, file: 'bills', site, siteLabel: where, category, amount };

    if (seen.has(key)) {
      bill.flagged = true;
      flag({ ...base, check: 'duplicates', issue: 'Duplicate bill', at: money(amount),
        why: `Invoice ${raw.invoice} from ${bill.supplier} appears twice in this month's bills. Paying both copies would pay the same ${money(amount)} bill twice.`,
        action: 'Pay it once and remove the copy from the payment run.', detail: `${where} · ${category} · ${money(amount)}` });
      continue;
    }
    seen.add(key);
    if (!contract) {
      bill.flagged = true;
      flag({ ...base, check: 'match', issue: 'No contract', at: money(amount),
        why: `Account ${raw.account} isn't in the contract list. The bill says "${raw.site_on_bill}", which already has a different ${category.toLowerCase()} account.`,
        action: 'Ask the supplier what this account is before paying.', detail: `${bill.supplier} · ${raw.site_on_bill} · ${money(amount)}` });
      continue;
    }
    if (contract.status !== 'Active') {
      bill.flagged = true;
      flag({ ...base, check: 'match', issue: 'Site closed', at: money(amount),
        why: `${where} closed and this contract ended on ${shortDate(contract.end_date)}. The bill is for ${monthName(period)}.`,
        action: 'Check whether it is a final bill; otherwise dispute it.', detail: `${bill.supplier} · ${category} · ${money(amount)}` });
      continue;
    }
    if (FIXED.has(category) && Math.abs(amount - contract.price) > 0.005) {
      bill.flagged = true;
      flag({ ...base, check: 'price', issue: 'Price above contract', at: money(amount - contract.price),
        why: `Billed ${money(amount)}; the contract price is ${money(contract.price)}. That is ${money(amount - contract.price)} more than agreed.`,
        action: 'Query the change with the supplier before paying.', detail: `${where} · ${bill.supplier} · account ${raw.account}` });
      continue;
    }
    if (!FIXED.has(category)) {
      const avg = average(raw.account);
      if (raw.read === 'Estimated') {
        bill.flagged = true;
        flag({ ...base, check: 'usage', issue: 'Estimated reading', at: money(amount),
          why: `The supplier estimated this month's reading (${raw.usage} ${raw.unit}) instead of reading the meter, so the bill may be wrong.`,
          action: 'Send the supplier an actual meter reading.', detail: `${where} · ${bill.supplier} · ${money(amount)}` });
        continue;
      }
      if (avg && raw.usage > avg * (1 + USAGE_LIMIT)) {
        bill.flagged = true;
        const up = raw.usage / avg - 1;
        bill.spike = up;
        flag({ ...base, check: 'usage', issue: 'Usage spike', at: `+${pct(up)}`,
          why: `${raw.usage.toLocaleString('en-US')} ${raw.unit} this month against a 6-month average of about ${Math.round(avg).toLocaleString('en-US')} ${raw.unit} (+${pct(up)}).`,
          action: 'Ask the site whether anything changed, such as new equipment or a fault.', detail: `${where} · ${bill.supplier} · ${money(amount)}` });
        continue;
      }
    }
  }

  // ---- expected bills not received
  const billedAccounts = new Set(bills.map((b) => b.account));
  const active = data.CONTRACTS.filter((c) => c.status === 'Active');
  const missing = active.filter((c) => !billedAccounts.has(c.account));
  for (const c of missing) {
    flag({ record: `${c.site} ${c.category}`, file: 'contracts', site: c.site, siteLabel: `${c.site} ${c.site_name}`, category: c.category, amount: c.price || 0,
      check: 'complete', issue: 'Bill not received', at: c.price ? money(c.price) : '',
      why: `${c.supplier} bills this ${c.category.toLowerCase()} contract every month (${c.price ? `${money(c.price)} a month` : 'usage-based'}), but no ${monthName(period)} bill has arrived.`,
      action: 'Ask the supplier for a copy, so it isn\'t paid late.', detail: `${c.supplier} · account ${c.account}` });
  }

  // ---- order, ids, decisions, counts
  const order = Object.fromEntries(CHECKS.map((c, i) => [c.id, i]));
  exceptions.sort((a, b) => order[a.check] - order[b.check] || a.record.localeCompare(b.record));
  exceptions.forEach((e, i) => { e.id = `b${i + 1}`; e.options = DECISIONS[e.issue]; });
  const checks = CHECKS.map((c) => ({ ...c, flagged: exceptions.filter((e) => e.check === c.id).length }));
  const files = [
    { key: 'contracts', label: 'Contract list', file: 'contracts.xlsx', rows: data.CONTRACTS.length },
    { key: 'bills', label: `${monthName(period)} bills`, file: 'bills-october.csv', rows: data.BILLS.length },
    { key: 'history', label: 'Usage history (6 months)', file: 'usage-history.csv', rows: data.HISTORY.length },
  ];
  const rows = files.reduce((n, f) => n + f.rows, 0);
  const totals = { rows, review: exceptions.length, passed: rows - exceptions.length };

  // ---- monthly summary
  const flaggedBills = bills.filter((b) => b.flagged);
  const total = bills.reduce((s, b) => s + b.amount, 0);
  const onHold = flaggedBills.reduce((s, b) => s + b.amount, 0);
  const approve = total - onHold;
  const by = (issue) => exceptions.filter((e) => e.issue === issue);
  const dup = by('Duplicate bill'); const closed = by('Site closed'); const price = by('Price above contract');
  const notOwed = dup.reduce((s, e) => s + e.amount, 0) + closed.reduce((s, e) => s + e.amount, 0)
    + price.reduce((s, e) => s + (e.amount - contractByAccount.get(bills.find((b) => b.invoice === e.record).account).price), 0);
  const spike = bills.find((b) => b.spike);
  const openSites = data.SITES.filter((s) => !s.closed).length;
  const categories = ['Electricity', 'Water', 'Internet', 'Waste', 'Rent'].map((cat) => {
    const list = bills.filter((b) => b.category === cat);
    return { category: cat, bills: list.length, amount: list.reduce((s, b) => s + b.amount, 0), flagged: list.filter((b) => b.flagged).length,
      expected: active.filter((c) => c.category === cat).length };
  });
  const refs = (list) => list.map((e) => e.record);
  const followUps = [
    { action: `Hold ${dup.length + closed.length + price.length} bills before paying (${money(notOwed)} may not be owed).`, why: 'A duplicate invoice, a bill for a closed site and a price above contract.', refs: refs([...dup, ...closed, ...price]) },
    { action: `Request ${missing.length} missing bills from the suppliers.`, why: 'Expected every month, not received yet.', refs: refs(by('Bill not received')) },
    spike && { action: `Ask ${siteName.get(spike.site)} (${spike.site}) why electricity use rose ${pct(spike.spike)}.`, why: 'Well above its 6-month average.', refs: [spike.invoice] },
    { action: 'Send an actual meter reading for the estimated bill.', why: 'Estimated bills are often corrected later.', refs: refs(by('Estimated reading')) },
    { action: 'Confirm the unknown waste account with the supplier.', why: 'No contract matches it.', refs: refs(by('No contract')) },
    { action: `Approve the other ${bills.length - flaggedBills.length} bills for payment (${money(approve)}).`, why: 'They passed every check.', refs: [] },
  ].filter(Boolean);
  const summary = `This month: ${bills.length} bills received for ${openSites} open sites. ${money(notOwed)} may not be owed, ${missing.length} expected bills haven't arrived and one site used ${pct(spike.spike)} more electricity than usual. ${exceptions.length} items were flagged for review.`;

  return {
    files, tidy, checks, exceptions, totals,
    report: { period, monthLabel: `${monthName(period)} ${period.slice(0, 4)}`, expected: active.length, received: bills.length,
      matched: active.length - missing.length, missing: missing.length, openSites, total, onHold, approve, notOwed,
      heldBills: flaggedBills.length, passedBills: bills.length - flaggedBills.length, categories, followUps, summary },
  };
}
