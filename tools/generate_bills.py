"""Generates the fictional dataset for work sample 2: "Recurring bills across sites".

A small business with 12 locations receives monthly bills for electricity, water, internet, waste collection
and (at 8 sites) rent. Three exports: the contract list, this month's bills, and 6 months of utility usage history.
Everything is invented. The mess is planted on purpose, so the checks (src/bills/engine.js) must find exactly
these 8 exceptions:

  Complete       S03 waste and S11 internet: expected, not received
  Duplicates     Metro Power invoice MP-88214 (S05 electricity) entered twice
  Contract match S09 electricity billed although S09 closed and the contract ended 30 Sep;
                 waste account GB-7731 has no contract
  Price          S04 internet billed 189.00 against a contract price of 79.00
  Usage          S07 electricity 4,820 kWh, far above its 6-month average; S02 water is an estimated reading

Planted but harmless (tidied automatically, not flagged): dates written day-first, amounts written with
"USD" or thousands separators, supplier names in different capitalisation.

Run: python3 tools/generate_bills.py  (writes src/bills/data.js)
"""
import json
import random

rng = random.Random(20261031)

SITES = [
    ('S01', 'Head office'), ('S02', 'Riverside shop'), ('S03', 'Market Street shop'), ('S04', 'North clinic'),
    ('S05', 'Warehouse'), ('S06', 'Harbour shop'), ('S07', 'East clinic'), ('S08', 'Station kiosk'),
    ('S09', 'Old Town shop'), ('S10', 'West clinic'), ('S11', 'Mall unit'), ('S12', 'Training room'),
]
CLOSED = {'S09': '2026-09-30'}
RENTED = [f'S0{i}' for i in range(1, 9)]
SUPPLIER = {'Electricity': 'Metro Power', 'Water': 'City Water', 'Internet': 'LinkFast', 'Waste': 'GreenBin Collections'}
LANDLORD = ['Harbourside Properties', 'Northgate Estates', 'Kestrel Property Co']
RATE = {'Electricity': (0.28, 35.0, 'kWh'), 'Water': (3.10, 18.0, 'm³')}
MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
PERIOD = '2026-10'

# ---------------------------------------------------------------- contracts (56 rows)
contracts = []
base_usage = {}
acct_no = {'Electricity': 40010, 'Water': 51020, 'Internet': 62030, 'Waste': 73040, 'Rent': 84050}
prefix = {'Electricity': 'EL', 'Water': 'WA', 'Internet': 'IN', 'Waste': 'GB', 'Rent': 'RE'}
for sid, sname in SITES:
    cats = ['Electricity', 'Water', 'Internet', 'Waste'] + (['Rent'] if sid in RENTED else [])
    for cat in cats:
        acct_no[cat] += rng.randint(3, 17)
        acct = f'{prefix[cat]}-{acct_no[cat]}'
        row = {'site': sid, 'site_name': sname, 'category': cat,
               'supplier': SUPPLIER.get(cat) or rng.choice(LANDLORD), 'account': acct,
               'price': '', 'status': 'Active', 'end_date': ''}
        if cat == 'Internet':
            row['price'] = rng.choice([59.0, 79.0, 79.0, 99.0])
        if cat == 'Waste':
            row['price'] = float(rng.choice([120, 135, 150, 165, 180]))
        if cat == 'Rent':
            row['price'] = float(rng.randrange(2400, 5800, 50))
        if cat in RATE:
            big = sname.endswith('clinic') or sid in ('S01', 'S05')
            base_usage[acct] = (rng.randint(2600, 3400) if big else rng.randint(900, 1800)) if cat == 'Electricity' else (rng.randint(40, 90) if big else rng.randint(12, 35))
        if sid in CLOSED:
            row['status'], row['end_date'] = 'Ended', CLOSED[sid]
        contracts.append(row)
assert len(contracts) == 56
C = {(c['site'], c['category']): c for c in contracts}
C[('S04', 'Internet')]['price'] = 79.0
C[('S07', 'Electricity')]['supplier'] = 'Metro Power'
base_usage[C[('S07', 'Electricity')]['account']] = 2900

# ---------------------------------------------------------------- usage history (144 rows: 24 utility accounts x 6 months)
history = []
avg = {}
for c in contracts:
    if c['category'] not in RATE:
        continue
    b = base_usage[c['account']]
    vals = []
    for m in MONTHS:
        u = round(b * rng.uniform(0.92, 1.08))
        vals.append(u)
        rate, standing, unit = RATE[c['category']]
        history.append({'account': c['account'], 'month': m, 'usage': u, 'unit': unit,
                        'amount': round(u * rate + standing, 2)})
    avg[c['account']] = sum(vals) / len(vals)
assert len(history) == 144

# ---------------------------------------------------------------- October bills (53 rows)
bills = []
inv_no = {'Metro Power': 88190, 'City Water': 30410, 'LinkFast': 7720, 'GreenBin Collections': 5510}
def next_inv(supplier):
    if supplier in inv_no:
        inv_no[supplier] += rng.randint(1, 4)
        pre = {'Metro Power': 'MP', 'City Water': 'CW', 'LinkFast': 'LF', 'GreenBin Collections': 'GC'}[supplier]
        return f'{pre}-{inv_no[supplier]}'
    return f'R-{rng.randint(1000, 9999)}'

for c in contracts:
    if c['status'] != 'Active':
        continue
    if (c['site'], c['category']) in (('S03', 'Waste'), ('S11', 'Internet')):
        continue  # missing
    b = {'invoice': next_inv(c['supplier']), 'supplier': c['supplier'], 'account': c['account'],
         'site_on_bill': c['site_name'], 'period': PERIOD, 'issued': f'2026-10-{rng.randint(20, 30):02d}',
         'usage': '', 'unit': '', 'read': '', 'amount': None}
    if c['category'] in RATE:
        rate, standing, unit = RATE[c['category']]
        u = round(avg[c['account']] * rng.uniform(0.9, 1.12))
        if (c['site'], c['category']) == ('S07', 'Electricity'):
            u = 4820
        b.update(usage=u, unit=unit, read='Actual', amount=round(u * rate + standing, 2))
        if (c['site'], c['category']) == ('S02', 'Water'):
            b['read'] = 'Estimated'
    else:
        b['amount'] = c['price']
        if (c['site'], c['category']) == ('S04', 'Internet'):
            b['amount'] = 189.0
    bills.append(b)

# duplicate: S05 electricity entered twice with the same invoice number
s05 = next(b for b in bills if b['account'] == C[('S05', 'Electricity')]['account'])
s05['invoice'] = 'MP-88214'
bills.append(dict(s05))
# closed site still billed
s09 = C[('S09', 'Electricity')]
u = round(avg[s09['account']] * 0.35)
bills.append({'invoice': next_inv('Metro Power'), 'supplier': 'Metro Power', 'account': s09['account'],
              'site_on_bill': s09['site_name'], 'period': PERIOD, 'issued': '2026-10-27', 'usage': u, 'unit': 'kWh',
              'read': 'Actual', 'amount': round(u * 0.28 + 35, 2)})
# unknown waste account
bills.append({'invoice': next_inv('GreenBin Collections'), 'supplier': 'GreenBin Collections', 'account': 'GB-7731',
              'site_on_bill': 'Training room', 'period': PERIOD, 'issued': '2026-10-24', 'usage': '', 'unit': '',
              'read': '', 'amount': 145.0})
assert len(bills) == 53
bills.sort(key=lambda b: (b['supplier'], b['invoice']))

# ---------------------------------------------------------------- export formatting (the harmless mess)
def fmt_amount(a, i):
    if i % 7 == 3:
        return f'USD {a:,.2f}'
    if a >= 1000 and i % 2 == 0:
        return f'{a:,.2f}'
    return f'{a:.2f}'
for i, b in enumerate(bills):
    b['amount'] = fmt_amount(b['amount'], i)
    if i % 5 == 1:
        y, m, d = b['issued'].split('-')
        b['issued'] = f'{d}/{m}/{y}'
    if i % 6 == 2:
        b['supplier'] = b['supplier'].upper()
# keep the duplicate rows identical, as an export of the same invoice would be
dups = [b for b in bills if b['invoice'] == 'MP-88214']
dups[1].update({k: dups[0][k] for k in ('amount', 'issued', 'supplier')})

out = {'PERIOD': PERIOD, 'MONTHS': MONTHS, 'SITES': [{'id': s, 'name': n, 'closed': CLOSED.get(s, '')} for s, n in SITES],
       'CONTRACTS': contracts, 'BILLS': bills, 'HISTORY': history}
with open('src/bills/data.js', 'w') as f:
    f.write('// Fictional dataset for work sample 2, "Recurring bills across sites". Generated by tools/generate_bills.py.\n')
    f.write('// Every site, supplier, account and amount is invented. Do not edit by hand: regenerate instead.\n\n')
    for k, v in out.items():
        f.write(f'export const {k} = {json.dumps(v, ensure_ascii=False)};\n')
print('contracts', len(contracts), 'bills', len(bills), 'history', len(history), 'total', len(contracts) + len(bills) + len(history))
print('S07 avg', round(avg[C[('S07', 'Electricity')]['account']]), 'S04 price', C[('S04', 'Internet')]['price'])
