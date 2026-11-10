"""Check the downloadable workbook: structure, dropdowns, formulas, and results against the website's engine.

Run:  python3 tools/check_tracker_xlsx.py        (needs Node, openpyxl and LibreOffice)

1. Structure: two sheets, the table and its columns, the 12 sample records exactly as in src/tracker/data.js,
   dropdown lists, conditional formatting, defined names, no hardcoded results, no macros or external links.
2. Stored values: the file as shipped already shows 12 / 7 / 5 / 1 / 1 / 1 / 3 (for previewers that don't recalculate).
3. Scenarios: edits a copy of the workbook (complete R-104, assign R-112, fill R-111's customer, add a near-identical
   record, change the dates, ...), recalculates it in LibreOffice, and compares every flag, figure, follow-up line
   and the summary sentence with src/tracker/engine.js run on the same records.
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
    ws, sm = wb[B.TRACKER], wb[B.SUMMARY]
    flags = {}
    for r in range(B.FIRST, B.LAST + 1):
        ref = ws.cell(r, 1).value
        if ref:
            flags[ref] = ws.cell(r, 9).value or ''
    keys = ['total', 'completed', 'outstanding', 'overdue', 'unassigned', 'missing', 'attention']
    metrics = {k: sm.cell(9 + i, 3).value for i, k in enumerate(keys)}
    follow = []
    for r in range(22, 22 + B.FOLLOW):
        if sm.cell(r, 1).value:
            follow.append([d2s(sm.cell(r, c).value).strip() for c in range(1, 6)])  # the sheet shows text as typed
    return {'metrics': metrics, 'text': sm['A18'].value, 'flags': flags, 'followUps': follow}


def records_from(wb_formulas):
    ws = wb_formulas[B.TRACKER]
    out = []
    for r in range(B.FIRST, B.LAST + 1):
        vals = [ws.cell(r, c).value for c in range(1, 8)]
        if vals[0] is None and all(v is None for v in vals[1:]):
            continue
        ref, rec, task, cust, owner, due, status = vals
        out.append({'ref': ref, 'received': d2s(rec), 'task': task or '', 'customer': cust or '', 'owner': owner or '',
                    'due': d2s(due), 'status': status or ''})
    return out


def period_from(wb_formulas):
    sm = wb_formulas[B.SUMMARY]
    return {'start': d2s(sm['C4'].value), 'end': d2s(sm['C5'].value), 'asAt': d2s(sm['C6'].value)}


def compare(label, path):
    wbf = load_workbook(path)
    expect = js(records_from(wbf), period_from(wbf))
    got = read_results(recalc(path))
    for k in ('metrics', 'text', 'flags'):
        check(got[k] == expect[k], f'{label}: {k} match the website engine' + ('' if got[k] == expect[k] else f'\n         workbook {got[k]}\n         website  {expect[k]}'))
    exp_f = [[ref, title, owner, due, reason] for ref, title, owner, due, reason in expect['followUps']]
    check(got['followUps'] == exp_f, f'{label}: follow-up list matches' + ('' if got['followUps'] == exp_f else f'\n         workbook {got["followUps"]}\n         website  {exp_f}'))
    return got


def scenario(label, edit):
    tmp = tempfile.mkdtemp()
    p = os.path.join(tmp, 's.xlsx')
    shutil.copy(PATH, p)
    wb = load_workbook(p)
    edit(wb[B.TRACKER], wb[B.SUMMARY])
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
    wb = load_workbook(PATH)
    check(wb.sheetnames == [B.TRACKER, B.SUMMARY], f'exactly two sheets: {wb.sheetnames}')
    ws, sm = wb[B.TRACKER], wb[B.SUMMARY]
    check(ws['A1'].value == 'Weekly Work & Follow-up Tracker' and sm['A1'].value == 'Weekly Operations Summary', 'sheet titles')
    check(ws['A2'].value.startswith('Enter your requests and tasks, assign an owner, set a due date, and update the status as work progresses.'), 'tracker instruction')
    t = ws.tables[B.TABLE]
    check([c.name for c in t.tableColumns] == ['Ref', 'Date Received', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status', 'Notes / Next Step', 'Attention Flag'], 'table columns in order')
    check(t.ref == f'A4:I{B.LAST}' and t.autoFilter is not None, f'Excel Table {t.ref} with filters')
    check(t.tableColumns[8].calculatedColumnFormula is not None, 'Attention Flag is a calculated column (new rows get the formula)')
    check(ws.freeze_panes == 'A5', 'header row frozen')
    got = records_from(wb)
    want = [dict(r, customer=r['customer']) for r in data['RECORDS']]
    check(got == want, '12 sample records exactly as in src/tracker/data.js')
    check(all(isinstance(ws.cell(r, c).value, dt.datetime) and ws.cell(r, c).number_format == 'dd-mmm-yyyy' for r in range(5, 17) for c in (2, 6)), 'dates are real dates, dd-mmm-yyyy')
    check(all(str(ws.cell(r, 9).value).startswith('=') for r in range(B.FIRST, B.LAST + 1)), f'flag formula on all {B.ROWS} table rows')
    dvs = {str(d.sqref): d for d in ws.data_validations.dataValidation}
    check(dvs.get(f'G5:G{B.FMT_ROWS}') is not None and dvs[f'G5:G{B.FMT_ROWS}'].formula1 == '"Not Started,In Progress,Waiting,Completed"', 'Status dropdown')
    check(dvs.get(f'E5:E{B.FMT_ROWS}') is not None and dvs[f'E5:E{B.FMT_ROWS}'].formula1 == 'TeamList', 'Assigned To dropdown reads the team list')
    check([ws.cell(r, 11).value for r in range(5, 9)] == data['OWNERS'], 'editable team list K5:K14 starts Ana, Mark, Sam, Unassigned')
    check('OFFSET' in wb.defined_names['TeamList'].attr_text, 'team list grows with the names entered')
    for n, cell in (('PeriodStart', '$C$4'), ('PeriodEnd', '$C$5'), ('AsAt', '$C$6')):
        check(wb.defined_names[n].attr_text.endswith(cell), f'{n} → {cell}')
    check([d2s(sm[c].value) for c in ('C4', 'C5', 'C6')] == ['2026-11-02', '2026-11-06', '2026-11-06'], 'reporting dates 2 Nov – 6 Nov, as at 6 Nov')
    check(all(str(sm.cell(r, 3).value).startswith('=') for r in range(9, 16)) and str(sm['A18'].value).startswith('='), 'all summary figures and the sentence are formulas')
    check(len(ws.conditional_formatting) >= 5, 'conditional formatting: overdue, missing, unassigned, completed, flagged')
    check('fullCalcOnLoad="1"' in wbxml, 'Excel recalculates on open')
    check([sm.cell(r, 5).value for r in range(4, 8)] == ['1. Update the sample records or replace them with your own.', '2. Set the reporting period and as-at date.',
                                                       '3. Update owners and statuses as work progresses.', '4. Review the weekly summary and follow-up items.'], 'usage guide')

    print('Values stored in the file (what a previewer shows without recalculating)')
    vals = load_workbook(PATH, data_only=True)[B.SUMMARY]
    check([vals.cell(r, 3).value for r in range(9, 16)] == [12, 7, 5, 1, 1, 1, 3], f'12 / 7 / 5 / 1 / 1 / 1 / 3: {[vals.cell(r, 3).value for r in range(9, 16)]}')
    check([vals.cell(r, 1).value for r in range(22, 26)] == ['R-104', 'R-111', 'R-112', None], 'follow-up list R-104, R-111, R-112')

    print('Recalculated in LibreOffice and compared with the website engine')
    base = compare('sample', PATH)
    check(list(base['metrics'].values()) == [12, 7, 5, 1, 1, 1, 3], f'acceptance figures 12, 7, 5, 1, 1, 1, 3: {list(base["metrics"].values())}')
    check(base['followUps'] == [['R-104', 'Follow up on payment', 'Mark', '2026-11-04', 'Overdue'],
                                ['R-111', 'Check service notes', 'Mark', '2026-11-06', 'Missing customer / area'],
                                ['R-112', 'Confirm outstanding item', 'Unassigned', '2026-11-06', 'No owner assigned']], 'follow-up items as specified')
    check(base['text'] == '12 records were received during the reporting period. 7 are marked as completed, while 5 remain outstanding. 3 records need attention.', 'summary sentence')

    def set_(ref, col, v):
        return lambda ws, sm: ws.cell(row_of(ws, ref), col, v)

    s = scenario('R-104 completed', set_('R-104', 7, 'Completed'))
    check(s['metrics']['overdue'] == 0 and s['flags']['R-104'] == '', 'R-104 no longer overdue or flagged')
    s = scenario('R-112 assigned to Ana', set_('R-112', 5, 'Ana'))
    check(s['metrics']['unassigned'] == 0 and s['flags']['R-112'] == '', 'R-112 no longer unassigned')
    s = scenario('R-111 customer filled', set_('R-111', 4, 'Harbor Works'))
    check(s['metrics']['missing'] == 0 and s['flags']['R-111'] == '', 'R-111 no longer missing information')

    def add_dup(ws, sm):
        r = B.FIRST + 12
        for c, v in enumerate(['R-113', dt.datetime(2026, 11, 2), '  send UPDATED quotation ', 'northfield services', 'Sam', dt.datetime(2026, 11, 9), 'Not Started'], 1):
            ws.cell(r, c, v)
    s = scenario('new record R-113 matching R-101 (case and spaces differ)', add_dup)
    check(s['flags']['R-113'] == 'Possible duplicate — review' and s['flags']['R-101'] == 'Possible duplicate — review', 'both records flagged "Possible duplicate — review"')
    check(s['metrics']['total'] == 13 and s['metrics']['attention'] == 5, 'new row counted without copying formulas (13 records, 5 need attention)')

    def multi(ws, sm):
        r = row_of(ws, 'R-112')
        ws.cell(r, 4).value = None
        ws.cell(r, 6, dt.datetime(2026, 11, 5))
    s = scenario('R-112 overdue, missing customer and unassigned', multi)
    check(s['flags']['R-112'] == 'Overdue · Missing customer / area · No owner assigned' and s['metrics']['attention'] == 3, 'one record, three reasons, counted once')

    s = scenario('as-at date moved to 9 Nov', lambda ws, sm: sm.__setitem__('C6', dt.datetime(2026, 11, 9)))
    check(s['metrics']['overdue'] == 5, f'all five open items now overdue: {s["metrics"]["overdue"]}')
    s = scenario('period ends 4 Nov', lambda ws, sm: sm.__setitem__('C5', dt.datetime(2026, 11, 4)))
    check(s['metrics']['total'] == 8, f'eight records received 2–4 Nov: {s["metrics"]["total"]}')

    def everything_done(ws, sm):
        for r in range(B.FIRST, B.FIRST + 12):
            ws.cell(r, 7, 'Completed')
        ws.cell(row_of(ws, 'R-111'), 4, 'Harbor Works')
    s = scenario('all completed and fixed', everything_done)
    check(s['text'] == '12 records were received during the reporting period. All 12 are marked as completed. No records need attention.', 'sentence when nothing is outstanding')

    print()
    if FAILS:
        print(f'{len(FAILS)} check(s) failed')
        sys.exit(1)
    print('All workbook checks passed (calculation engine: LibreOffice Calc).')


if __name__ == '__main__':
    main()
