"""Generates the fictional dataset for the Rework Rescue work sample.

Three "Friday exports" from a small service business: a job tracker, an invoices export and a
customer list. Everything is invented. The mess is planted on purpose and documented below, so the
checks engine (src/sample/engine.js) must find exactly these 12 exceptions and nothing else.

Planted exceptions (one row each):
  Required fields   J-5560 and J-5571 (open, no owner), C-1077 (no email)
  Duplicates        second row of J-5548 (tracker), C-1103 (same email as C-1099)
  Formats           J-5553 due date "31/09/2026", INV-3419 amount "1.250,00"
  Cross-file match  J-5544 (customer C-1188 not in the customer list), INV-3402 (no job number)
  Not invoiced      J-5527 and J-5536 (no invoice), J-5531 (1 of 2 visits billed)

Planted but harmless (tidied automatically in the working copy, not flagged):
  tracker due dates written as dd/mm/yyyy, customer names with stray spaces,
  invoice amounts written with thousands separators.

Run: python3 tools/generate_data.py  (writes src/sample/data.js)
"""
import datetime as dt
import json
import random

rng = random.Random(20261023)
D = dt.date
REPORT = D(2026, 10, 23)

# ---------------------------------------------------------------- customers (96)
first = ['North', 'Harbor', 'Kestrel', 'West', 'Bright', 'Lumen', 'Oak', 'Silver', 'Red', 'Blue', 'Stone',
         'River', 'Summit', 'Cedar', 'Maple', 'Iron', 'Clear', 'Pine', 'Granite', 'Copper', 'Fern', 'Ash',
         'Willow', 'Coast', 'Meadow', 'Ridge', 'Falcon', 'Elm', 'Harvest', 'Beacon', 'Orchard', 'Linden']
second = ['field Supplies', ' Print', ' Fitouts', 'gate Storage', 'water Cafe', ' Signage', ' Dental Lab',
          ' Joinery', ' Logistics', ' Bakery', ' Electrical', ' Plumbing', ' Studio', ' Motors', ' Cleaning',
          ' Florists', ' Removals', ' Laundry', ' Garden Care', ' Print & Copy', ' Hardware', ' Veterinary',
          ' Glass', ' Roofing', ' Catering', ' Fitness', ' Optics', ' Pharmacy Supplies', ' Tiling', ' Kitchens']
fixed = {
    'C-1031': 'Northfield Supplies', 'C-1044': 'Kestrel Fitouts', 'C-1052': 'Westgate Storage',
    'C-1063': 'Brightwater Cafe', 'C-1070': 'Lumen Signage', 'C-1099': 'Harbor Print', 'C-1103': 'Harbour Print',
}
cust_ids = [f'C-{n}' for n in range(1010, 1106)]
used = set(fixed.values())
customers = []
for cid in cust_ids:
    if cid in fixed:
        name = fixed[cid]
    else:
        while True:
            name = rng.choice(first) + rng.choice(second)
            if name not in used and 'Harb' not in name:
                break
    used.add(name)
    slug = ''.join(ch for ch in name.lower() if ch.isalnum())
    email = f'accounts@{slug}.example'
    customers.append({'id': cid, 'name': name, 'email': email})
cust = {c['id']: c for c in customers}
cust['C-1103']['email'] = cust['C-1099']['email']   # duplicate: same email as C-1099
cust['C-1077']['email'] = ''                         # required field missing
# 9 names with stray spaces (tidied automatically, not flagged)
for cid in rng.sample([c for c in cust_ids if c not in fixed and c != 'C-1077'], 9):
    cust[cid]['name'] = '  ' + cust[cid]['name'] + ' '

# ---------------------------------------------------------------- jobs (139 unique, 140 rows)
types = ['Site visit', 'Equipment repair', 'Installation', 'Maintenance check', 'Quote visit', 'Warranty repair']
owners = ['Mia', 'Ravi', 'Ana', 'Dana', 'Leo']
numbers = list(range(5437, 5576))
assert len(numbers) == 139
special_open = {5544, 5553, 5560, 5571}
pool = [n for n in numbers if n >= 5549 and n not in special_open]
open_numbers = special_open | set(rng.sample(pool, 15))
assert len(open_numbers) == 19
overdue_numbers = set(rng.sample(sorted(open_numbers - special_open), 5))
normal_cust = [c for c in cust_ids if c not in ('C-1103',)]

jobs = []
for i, n in enumerate(numbers):
    ref = f'J-{n}'
    received = D(2026, 9, 7) + dt.timedelta(days=round(i * 44 / 138) + rng.randint(-1, 1))
    received = min(received, REPORT)
    visits = 2 if rng.random() < 0.1 else 1
    value = rng.randrange(300, 3800, 10)
    job = {'ref': ref, 'type': rng.choice(types), 'customer': rng.choice(normal_cust), 'owner': rng.choice(owners),
           'received': received, 'visits': visits, 'value': value}
    if n in open_numbers:
        job['status'] = rng.choice(['In progress', 'In progress', 'Not started', 'Waiting for update'])
        job['completed'] = None
        if n in overdue_numbers:
            job['due'] = D(2026, 10, rng.randint(14, 22))
        else:
            job['due'] = D(2026, 10, rng.randint(26, 30))
        job['received'] = min(job['received'], job['due'] - dt.timedelta(days=5))
    else:
        job['status'] = 'Completed'
        job['completed'] = min(received + dt.timedelta(days=rng.randint(2, 9)), REPORT)
        job['due'] = received + dt.timedelta(days=rng.randint(7, 14))
    jobs.append(job)
J = {j['ref']: j for j in jobs}

# Specials
J['J-5560']['owner'] = ''
J['J-5571']['owner'] = ''
J['J-5544']['customer'] = 'C-1188'        # not in the customer list
J['J-5553']['due_raw'] = '31/09/2026'     # not a real date
J['J-5553']['due'] = None
def setc(ref, received, completed, value, visits=1):
    j = J[ref]; j.update(status='Completed', received=received, completed=completed, value=value, visits=visits,
                         due=received + dt.timedelta(days=10))
setc('J-5527', D(2026, 10, 6), D(2026, 10, 14), 1640)
setc('J-5536', D(2026, 10, 7), D(2026, 10, 12), 1980)
setc('J-5531', D(2026, 10, 8), D(2026, 10, 16), 1520, visits=2)
setc('J-5540', D(2026, 10, 13), D(2026, 10, 21), 2310)
for ref in ('J-5527', 'J-5536', 'J-5531', 'J-5540'):
    J[ref]['customer'] = rng.choice(normal_cust)
J['J-5540']['customer'] = 'C-1063'  # Brightwater Cafe
J['J-5548'].update(status='Completed')
if J['J-5548']['completed'] is None:
    J['J-5548']['completed'] = D(2026, 10, 19)

completed = [j for j in jobs if j['status'] == 'Completed']
assert len(completed) == 120, len(completed)

# ---------------------------------------------------------------- invoices (118)
invoices = []
for j in completed:
    if j['ref'] in ('J-5527', 'J-5536'):
        continue
    billed = 1 if j['ref'] == 'J-5531' else j['visits']
    date = min(j['completed'] + dt.timedelta(days=rng.randint(0, 3)), REPORT)
    if j['ref'] == 'J-5540':
        date = D(2026, 10, 22)
    amount = round(j['value'] * billed / j['visits'], 2)
    invoices.append({'job': j['ref'], 'customer': j['customer'], 'date': date, 'billed': billed, 'amount': amount})
assert len(invoices) == 118
invoices.sort(key=lambda r: (r['date'], r['job']))
for k, inv in enumerate(invoices):
    inv['ref'] = f'INV-{3302 + k}'
# Name the two special invoices as documented (swap labels to keep the published ids)
def relabel(job_ref, new_ref):
    a = next(v for v in invoices if v['job'] == job_ref)
    b = next(v for v in invoices if v['ref'] == new_ref)
    a['ref'], b['ref'] = b['ref'], a['ref']
relabel('J-5540', 'INV-3402')
last = invoices[-1]
if last['ref'] != 'INV-3419':
    relabel(last['job'], 'INV-3419')
inv3419 = next(v for v in invoices if v['ref'] == 'INV-3419')
inv3402 = next(v for v in invoices if v['ref'] == 'INV-3402')
inv3402['job'] = ''                       # no job number
J[inv3419['job']]['value'] = 1250.0 * J[inv3419['job']]['visits'] / inv3419['billed']
inv3419['amount'] = 1250.0
invoices.sort(key=lambda r: r['ref'])

# ---------------------------------------------------------------- raw strings as the exports would show them
dmy = set(rng.sample([j['ref'] for j in jobs if j.get('due')], 37))
def due_raw(j):
    if 'due_raw' in j:
        return j['due_raw']
    return j['due'].strftime('%d/%m/%Y') if j['ref'] in dmy else j['due'].isoformat()

tracker = []
for j in jobs:
    row = {'ref': j['ref'], 'type': j['type'], 'customer': j['customer'], 'status': j['status'], 'owner': j['owner'],
           'received': j['received'].isoformat(), 'due': due_raw(j),
           'completed': j['completed'].isoformat() if j['completed'] else '', 'visits': j['visits'],
           'value': j['value']}
    tracker.append(row)
    if j['ref'] == 'J-5548':
        tracker.append(dict(row))         # exported twice
assert len(tracker) == 140

thousands = set(rng.sample([v['ref'] for v in invoices if v['amount'] >= 1000 and v['ref'] != 'INV-3419'], 14))
def amount_raw(v):
    if v['ref'] == 'INV-3419':
        return '1.250,00'
    return f"{v['amount']:,.2f}" if v['ref'] in thousands else f"{v['amount']:.2f}"

inv_rows = [{'ref': v['ref'], 'job': v['job'], 'customer': v['customer'], 'date': v['date'].isoformat(),
             'visits_billed': v['billed'], 'amount': amount_raw(v)} for v in invoices]

out = {
    'REPORT_DATE': REPORT.isoformat(),
    'WEEK': {'start': '2026-10-19', 'end': '2026-10-23'},
    'TRACKER': tracker,
    'INVOICES': inv_rows,
    'CUSTOMERS': [{'id': c['id'], 'name': c['name'], 'email': c['email']} for c in customers],
}
with open('src/sample/data.js', 'w') as f:
    f.write('// Fictional dataset for the "three messy exports" work sample. Generated by tools/generate_data.py.\n')
    f.write('// Every name, number and amount is invented. Do not edit by hand: regenerate instead.\n\n')
    for k, v in out.items():
        f.write(f'export const {k} = {json.dumps(v, ensure_ascii=False, indent=None)};\n')
print('jobs rows', len(tracker), 'invoices', len(inv_rows), 'customers', len(customers),
      'total', len(tracker) + len(inv_rows) + len(customers))
print('INV-3419 job', inv3419['job'], '| INV-3402 date', inv3402['date'])
