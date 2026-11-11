"""Check the downloadable workbook: structure, dropdowns, formulas, and results against the website's engine.

Run:  python3 tools/check_tracker_xlsx.py        (needs Node, openpyxl and LibreOffice)

1. Structure: three sheets (Start here, Weekly Tracker, Weekly Report), the table and its columns, the 12 sample
   records exactly as in src/tracker/data.js, dropdown lists, conditional formatting, defined names, logo, chart and
   links, no hardcoded results, no macros or external links.
2. Stored values: the file as shipped already shows 12 / 7 / 5 / 3 and R-104, R-112, R-111 (for previewers that
   don't recalculate).
3. Scenarios: edits a copy of the workbook (complete R-104, assign R-112, fill R-111's customer, add a near-identical
   record, change the dates, ...), recalculates it in LibreOffice, and compares every flag, figure, "What needs
   attention" line, check, status count and the summary sentence with the website (engine.js, hero.js checks and the
   live example's report) run on the same records.
LibreOffice Calc is the calculation engine here, not Microsoft Excel.
"""
import copy
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

from openpyxl import load_workbook

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_tracker_xlsx as B  # noqa: E402

PATH = B.OUT
FAILS = []


def check(cond, msg):
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if not cond:
        FAILS.append(msg)


def recalc(path):
    return load_workbook(B.recalc_copy(path), data_only=True)


def js(records, period):
    out = subprocess.run(['node', 'tools/tracker_eval.mjs'], cwd=B.ROOT, input=json.dumps({'records': records, 'period': period}),
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def d2s(v):
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime('%Y-%m-%d')
    return '' if v is None else str(v)


def read_results(wb):
    ws, sm = wb[B.TRACKER], wb[B.REPORT]
    flags = {}
    for r in range(B.FIRST, B.LAST + 1):
        ref = ws.cell(r, 1).value
        if ref:
            flags[ref] = ws.cell(r, 10).value or ''
    keys = ['total', 'completed', 'outstanding', 'overdue', 'unassigned', 'missing', 'attention']
    metrics = {k: sm.cell(6 + i, 15).value for i, k in enumerate(keys)}
    attention = []
    for r in range(B.ITEM0, B.ITEM0 + B.FOLLOW):
        if sm.cell(r, 3).value:
            attention.append([d2s(sm.cell(r, c).value).strip() for c in (3, 4, 9, 11, 12)])
    checks = [[sm.cell(r, 4).value, sm.cell(r, 8).value, sm.cell(r, 12).value] for r in range(B.CHECK0, B.CHECK0 + 9)]
    tiles = [sm['B7'].value, sm['F7'].value, sm['J7'].value, sm['J9'].value or '', sm['J4'].value]
    return {'metrics': metrics, 'text': sm['B52'].value, 'flags': flags, 'attention': attention, 'checks': checks,
            'byStatus': [sm.cell(r, 5).value for r in range(B.STAT0, B.STAT0 + 4)], 'tiles': tiles}


def records_from(wb_formulas):
    ws = wb_formulas[B.TRACKER]
    out = []
    for r in range(B.FIRST, B.LAST + 1):
        vals = [ws.cell(r, c).value for c in range(1, 9)]
        if vals[0] is None and all(v is None for v in vals[1:]):
            continue
        ref, rec, task, cust, owner, due, status, done = vals
        out.append({'ref': ref, 'received': d2s(rec), 'task': task or '', 'customer': cust or '', 'owner': owner or '',
                    'due': d2s(due), 'status': status or '', 'completed': d2s(done)})
    return out


def period_from(wb_formulas):
    sm = wb_formulas[B.REPORT]
    return {'start': d2s(sm['D4'].value), 'end': d2s(sm['G4'].value), 'asAt': d2s(sm['D5'].value)}


def compare(label, path):
    wbf = load_workbook(path)
    expect = js(records_from(wbf), period_from(wbf))
    got = read_results(recalc(path))
    for k in ('metrics', 'text', 'flags', 'attention', 'checks', 'byStatus'):
        check(got[k] == expect[k], f'{label}: {k} match the website' + ('' if got[k] == expect[k] else f'\n         workbook {got[k]}\n         website  {expect[k]}'))
    m = expect['metrics']
    want_tiles = [m['completed'], m['outstanding'], m['attention'], f"Of the {m['outstanding']} still outstanding" if m['outstanding'] else '',
                  f"{m['total']} job{'' if m['total'] == 1 else 's'} checked"]
    check(got['tiles'] == want_tiles, f'{label}: report tiles and header' + ('' if got['tiles'] == want_tiles else f'\n         workbook {got["tiles"]}\n         expected {want_tiles}'))
    return got


def scenario(label, edit):
    tmp = tempfile.mkdtemp()
    p = os.path.join(tmp, 's.xlsx')
    shutil.copy(PATH, p)
    wb = load_workbook(p)
    edit(wb[B.TRACKER], wb[B.REPORT])
    wb.save(p)
    return compare(label, p)


def row_of(ws, ref):
    for r in range(B.FIRST, B.LAST + 1):
        if ws.cell(r, 1).value == ref:
            return r
    raise KeyError(ref)


def main():
    data = B.load_data()
    print('Structure')
    with zipfile.ZipFile(PATH) as z:
        names = z.namelist()
        check(not any('vbaProject' in n or 'externalLink' in n or 'connections' in n for n in names), 'no macros, external links or data connections')
        wbxml = z.read('xl/workbook.xml').decode()
        media = [n for n in names if n.startswith('xl/media/')]
        charts = [n for n in names if n.startswith('xl/charts/chart')]
    check(len(media) >= 2, f'Rework Rescue logo on Start here and the report: {media}')
    check(len(charts) == 1, f'one chart (jobs by status): {charts}')
    wb = load_workbook(PATH)
    check(wb.sheetnames == [B.START, B.TRACKER, B.REPORT], f'three sheets in order: {wb.sheetnames}')
    st, ws, sm = wb[B.START], wb[B.TRACKER], wb[B.REPORT]
    check(st['B3'].value == 'Weekly Work & Follow-up Tracker' and ws['A1'].value == 'Weekly Work & Follow-up Tracker' and sm['B3'].value == data['BUSINESS'], 'sheet titles')
    check(sm['B2'].value == 'WEEKLY OPERATIONS REPORT \u00b7 FICTIONAL SAMPLE', 'report label says fictional sample')
    check(ws['A2'].value.startswith('Enter your requests and tasks, assign an owner, set a due date, and update the status as work progresses.'), 'tracker instruction')
    links = {c.hyperlink.location or c.hyperlink.target for row in st.iter_rows() for c in row if c.hyperlink}
    check(f"'{B.TRACKER}'!A1" in links and f"'{B.REPORT}'!A1" in links and f'{B.SITE}/contact/#contact-form-area' in links, f'Start here links to both sheets and the booking page: {links}')
    check(any('Excel 2010' in str(st.cell(r, 3).value) for r in range(19, 24)), 'Start here says which Excel versions it works in')
    t = ws.tables[B.TABLE]
    check([c.name for c in t.tableColumns] == ['Ref', 'Date Received', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status', 'Date Completed', 'Notes / Next Step', 'Attention Flag'], 'table columns in order')
    check(t.ref == f'A4:J{B.LAST}' and t.autoFilter is not None, f'Excel Table {t.ref} with filters')
    check(t.tableColumns[9].calculatedColumnFormula is not None, 'Attention Flag is a calculated column (new rows get the formula)')
    check(ws.freeze_panes == 'A5', 'header row frozen')
    got = records_from(wb)
    want = [dict(r, customer=r['customer']) for r in data['RECORDS']]
    check(got == want, '12 sample records exactly as in src/tracker/data.js')
    check(all(isinstance(ws.cell(r, c).value, dt.datetime) and ws.cell(r, c).number_format == 'dd-mmm-yyyy' for r in range(5, 17) for c in (2, 6)), 'dates are real dates, dd-mmm-yyyy')
    check(all(str(ws.cell(r, 10).value).startswith('=') for r in range(B.FIRST, B.LAST + 1)), f'flag formula on all {B.ROWS} table rows')
    dvs = {str(d.sqref): d for d in ws.data_validations.dataValidation}
    check(dvs.get(f'G5:G{B.FMT_ROWS}') is not None and dvs[f'G5:G{B.FMT_ROWS}'].formula1 == '"Not Started,In Progress,Waiting,Completed"', 'Status dropdown')
    check(dvs.get(f'E5:E{B.FMT_ROWS}') is not None and dvs[f'E5:E{B.FMT_ROWS}'].formula1 == 'TeamList', 'Assigned To dropdown reads the team list')
    check([ws.cell(r, 12).value for r in range(5, 9)] == data['OWNERS'], 'editable team list L5:L14 starts Ana, Mark, Sam, Unassigned')
    check('OFFSET' in wb.defined_names['TeamList'].attr_text, 'team list grows with the names entered')
    for n, cell in (('PeriodStart', '$D$4'), ('PeriodEnd', '$G$4'), ('AsAt', '$D$5')):
        check(wb.defined_names[n].attr_text == f"'{B.REPORT}'!{cell}", f'{n} → Weekly Report {cell}')
    check([d2s(sm[c].value) for c in ('D4', 'G4', 'D5')] == ['2026-11-02', '2026-11-06', '2026-11-06'], 'reporting dates 2 Nov – 6 Nov, as at 6 Nov')
    formula_cells = [sm.cell(r, 15) for r in range(6, 13)] + [sm[c] for c in ('B7', 'F7', 'J7', 'J9', 'J4', 'B52')] + \
        [sm.cell(r, c) for r in range(B.CHECK0, B.CHECK0 + 9) for c in (8, 12, 16)] + [sm.cell(r, 5) for r in range(B.STAT0, B.STAT0 + 5)] + \
        [sm.cell(r, c) for r in range(B.ITEM0, B.ITEM0 + B.FOLLOW) for c in (3, 4, 9, 11, 12, 15)]
    check(all(str(c.value).startswith('=') for c in formula_cells), 'every figure, check, status count and action line on the report is a formula')
    check(len(ws.conditional_formatting) >= 5, 'tracker conditional formatting: overdue, missing, unassigned, completed, flagged')
    check(len(sm.conditional_formatting) >= 4, 'report conditional formatting: status colours, issue colours, tile, lines')
    check('fullCalcOnLoad="1"' in wbxml, 'Excel recalculates on open')

    print('Values stored in the file (what a previewer shows without recalculating)')
    vals = load_workbook(PATH, data_only=True)[B.REPORT]
    stored = [vals.cell(r, 15).value for r in range(6, 13)]
    check(stored == [12, 7, 5, 1, 1, 1, 3], f'12 / 7 / 5 / 1 / 1 / 1 / 3: {stored}')
    check([vals['B7'].value, vals['F7'].value, vals['J7'].value] == [7, 5, 3], 'tiles 7 / 5 / 3')
    check([vals.cell(r, 3).value for r in range(B.ITEM0, B.ITEM0 + 4)] == ['R-104', 'R-112', 'R-111', None], 'What needs attention: R-104, R-112, R-111')

    print('Recalculated in LibreOffice and compared with the website')
    base = compare('sample', PATH)
    check(list(base['metrics'].values()) == [12, 7, 5, 1, 1, 1, 3], f'acceptance figures 12, 7, 5, 1, 1, 1, 3: {list(base["metrics"].values())}')
    check(base['attention'] == [['R-104', 'Follow up on overdue work', 'Mark', '2026-11-04', 'Overdue'],
                                ['R-112', 'Assign an owner', 'Unassigned', '2026-11-06', 'No owner'],
                                ['R-111', 'Complete the missing customer information', 'Mark', '2026-11-06', 'Missing customer']], 'What needs attention, as in the live example')
    check([c[2] for c in base['checks']] == ['\u2713 Passed', '! Flagged', '\u2713 Passed', '\u25CF Action required', '\u2713 Passed', '\u25CF Action required', '\u2713 Passed', '\u2713 Passed', '! Flagged'],
          'nine checks: Passed / Flagged / Passed · Action required / Passed / Action required · Passed / Passed / Flagged')
    check(base['byStatus'] == [7, 2, 2, 1], f'jobs by status 7 / 2 / 2 / 1: {base["byStatus"]}')
    check(base['text'] == '12 jobs in this report. 7 are marked as completed, while 5 remain outstanding. 3 jobs need attention.', 'summary sentence')

    def set_(ref, col, v):
        return lambda ws, sm: ws.cell(row_of(ws, ref), col, v)

    s = scenario('R-104 completed', set_('R-104', 7, 'Completed'))
    check(s['metrics']['overdue'] == 0 and s['flags']['R-104'] == '', 'R-104 no longer overdue or flagged')
    s = scenario('R-112 assigned to Sam (the Start here exercise)', set_('R-112', 5, 'Sam'))
    check(s['metrics']['unassigned'] == 0 and s['flags']['R-112'] == '', 'R-112 no longer unassigned')
    check(s['tiles'][2] == 2 and s['checks'][3][2] == '\u2713 Passed', 'Need attention drops to 2 and "Assigned owners" shows Passed, as Start here says')
    s = scenario('R-111 customer filled', set_('R-111', 4, 'Harbor Works'))
    check(s['metrics']['missing'] == 0 and s['flags']['R-111'] == '', 'R-111 no longer missing information')

    def add_dup(ws, sm):
        r = B.FIRST + 12
        for c, v in enumerate(['R-113', dt.datetime(2026, 11, 2), '  send UPDATED quotation ', 'northfield services', 'Sam', dt.datetime(2026, 11, 9), 'Not Started', None], 1):
            ws.cell(r, c, v)
    s = scenario('new record R-113 matching R-101 (case and spaces differ)', add_dup)
    check(s['flags']['R-113'] == 'Possible duplicate' and s['flags']['R-101'] == 'Possible duplicate', 'both records flagged "Possible duplicate"')
    check(s['metrics']['total'] == 13 and s['metrics']['attention'] == 5, 'new row counted without copying formulas (13 records, 5 need attention)')

    def multi(ws, sm):
        r = row_of(ws, 'R-112')
        ws.cell(r, 4).value = None
        ws.cell(r, 6, dt.datetime(2026, 11, 5))
    s = scenario('R-112 overdue, missing customer and unassigned', multi)
    check(s['flags']['R-112'] == 'Overdue · Missing customer · No owner' and s['metrics']['attention'] == 3, 'one record, three reasons, counted once')

    s = scenario('as-at date moved to 9 Nov', lambda ws, sm: sm.__setitem__('D5', dt.datetime(2026, 11, 9)))
    check(s['metrics']['overdue'] == 5, f'all five open items now overdue: {s["metrics"]["overdue"]}')
    def next_week(ws, sm):
        sm['D4'] = dt.datetime(2026, 11, 9)
        sm['G4'] = dt.datetime(2026, 11, 13)
        sm['D5'] = dt.datetime(2026, 11, 13)
    s = scenario('next week (9–13 Nov): open jobs carry over', next_week)
    check([s['metrics'][k] for k in ('total', 'completed', 'outstanding', 'overdue', 'attention')] == [5, 0, 5, 5, 5], f'5 open jobs carried over, all overdue: {s["metrics"]}')
    check(any(a[0] == 'R-104' and a[4] == 'Overdue' for a in s['attention']), 'R-104 still on the report as overdue')

    def done_next_week(ws, sm):
        next_week(ws, sm)
        r = row_of(ws, 'R-106')
        ws.cell(r, 7, 'Completed')
        ws.cell(r, 8, dt.datetime(2026, 11, 10))
    s = scenario('next week, R-106 completed on 10 Nov', done_next_week)
    check([s['metrics'][k] for k in ('total', 'completed', 'outstanding')] == [5, 1, 4], f'R-106 counts as completed that week: {s["metrics"]}')

    s = scenario('period ends 4 Nov', lambda ws, sm: sm.__setitem__('G4', dt.datetime(2026, 11, 4)))
    check(s['metrics']['total'] == 8, f'eight records received 2–4 Nov: {s["metrics"]["total"]}')

    def everything_done(ws, sm):
        for r in range(B.FIRST, B.FIRST + 12):
            ws.cell(r, 7, 'Completed')
        ws.cell(row_of(ws, 'R-111'), 4, 'Harbor Works')
    s = scenario('all completed and fixed', everything_done)
    check(s['text'] == '12 jobs in this report. All 12 are marked as completed. No jobs need attention.', 'sentence when nothing is outstanding')

    print()
    if FAILS:
        print(f'{len(FAILS)} check(s) failed')
        sys.exit(1)
    print('All workbook checks passed (calculation engine: LibreOffice Calc).')


if __name__ == '__main__':
    main()
