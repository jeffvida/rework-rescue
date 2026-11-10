"""Build assets/downloads/Rework-Rescue-Weekly-Work-Tracker.xlsx from src/tracker/data.js.

The sample records, owners, statuses, reporting period and flag wording are read from src/tracker/data.js (the same
module the website preview uses), so the two can't drift. The formulas below implement the rules documented at the
top of src/tracker/engine.js; tools/check_tracker_xlsx.py recalculates the file and compares it with that engine.

Run:  python3 tools/build_tracker_xlsx.py            (needs Node, openpyxl; LibreOffice to store calculated values)

Plain Excel: one Excel Table with a calculated column, SUMPRODUCT / AGGREGATE / INDEX (Excel 2010 and later), named
cells for the dates, data validation and conditional formatting. No macros, no external connections.
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableFormula, TableStyleInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'downloads', 'Rework-Rescue-Weekly-Work-Tracker.xlsx')

TRACKER = 'Weekly Tracker'
SUMMARY = 'Weekly Summary'
TABLE = 'Tracker'
FIRST = 5            # first data row (header on row 4)
ROWS = 100           # table rows ready to fill in (12 sample + 88 empty); Excel extends the table past them
LAST = FIRST + ROWS - 1
FMT_ROWS = 1000      # dropdowns and highlighting reach this far, so they also cover rows added later
FOLLOW = 25          # follow-up lines on the summary sheet

INK, TEAL, MINT, GOLD, IVORY = '0F3A3A', '2E7D72', 'E2EEE9', 'E6C078', 'F8F7ED'
AMBER_BG, AMBER_INK, RED_BG, RED_INK, GREY = 'FFF3DC', '8A6516', 'FDECEB', 'A4161A', '8A9497'
FONT = 'Arial'


def load_data():
    js = "import * as d from './src/tracker/data.js'; console.log(JSON.stringify(d));"
    out = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def iso(s):
    return dt.date.fromisoformat(s) if s else None


def f(size=10, bold=False, color='1C2A2E', italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)


def fill(c):
    return PatternFill('solid', start_color=c, end_color=c)


THIN = Side(style='thin', color='D4D0C3')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def col(name):
    return f'{TABLE}[{name}]'


def this(name):
    return f'{TABLE}[[#This Row],[{name}]]'


def build(data):
    flag = data['FLAG']
    sep = data['FLAG_SEP']
    period = data['PERIOD']
    wb = Workbook()
    ws = wb.active
    ws.title = TRACKER
    sm = wb.create_sheet(SUMMARY)
    for s in (ws, sm):
        s.sheet_view.showGridLines = False
        s.sheet_properties.tabColor = INK if s is ws else TEAL

    # ---------------------------------------------------------------- Weekly Tracker
    headers = [x['label'] for x in data['FIELDS']] + ['Notes / Next Step', 'Attention Flag']
    widths = [9, 14, 30, 24, 14, 13, 14, 34, 36, 3, 24]
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    ws['A1'] = 'Weekly Work & Follow-up Tracker'
    ws['A1'].font = f(16, True, INK)
    ws['A2'] = ('Enter your requests and tasks, assign an owner, set a due date, and update the status as work progresses. '
                'The attention flags will help identify items that need checking.')
    ws['A2'].font = f(10, color='475A60')
    ws['A2'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells('A2:I2')
    ws.row_dimensions[1].height = 26
    ws.row_dimensions[2].height = 30
    ws['A3'] = (f"Sample data for {data['BUSINESS']}, a fictional business, for demonstration purposes. Type over it or delete it, and add new records in the next empty row. "
                'Attention Flag fills in by itself; the dates it uses are on the Weekly Summary sheet.')
    ws['A3'].font = f(9, italic=True, color='475A60')
    ws.merge_cells('A3:I3')
    ws.row_dimensions[3].height = 15
    for r in range(1, 4):
        for c in range(1, 10):
            ws.cell(r, c).fill = fill(IVORY)

    for i, h in enumerate(headers, start=1):
        c = ws.cell(4, i, h)
        c.font = f(10, True, 'FFFFFF')
        c.fill = fill(INK)
        c.alignment = Alignment(vertical='center', wrap_text=True)
    ws.row_dimensions[4].height = 22

    recs = data['RECORDS']
    for n in range(ROWS):
        r = FIRST + n
        rec = recs[n] if n < len(recs) else None
        vals = [rec['ref'], iso(rec['received']), rec['task'], rec['customer'] or None, rec['owner'], iso(rec['due']), rec['status'], None] if rec else [None] * 8
        for i, v in enumerate(vals, start=1):
            c = ws.cell(r, i, v)
            c.font = f(10)
            c.alignment = Alignment(vertical='center')
            if i in (2, 6):
                c.number_format = 'dd-mmm-yyyy'
                c.alignment = Alignment(horizontal='left', vertical='center')
        ws.cell(r, 9).font = f(10, True, AMBER_INK)

    D, T, C, A, U, S = (this(x) for x in ('Date Received', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status'))
    empty = f'AND({D}="",TRIM({T})="",TRIM({C})="",TRIM({A})="",{U}="",TRIM({S})="")'
    od = f'AND(TRIM({S})<>"Completed",{U}<>"",{U}<AsAt)'
    miss = f'OR({D}="",TRIM({T})="",TRIM({C})="",{U}="")'
    only_c = f'AND(TRIM({C})="",{D}<>"",TRIM({T})<>"",{U}<>"")'
    un = f'AND(TRIM({S})<>"Completed",OR(TRIM({A})="",TRIM({A})="Unassigned"))'
    dup = (f'AND({D}<>"",TRIM({T})<>"",TRIM({C})<>"",SUMPRODUCT(({col("Date Received")}={D})'
           f'*(TRIM({col("Request / Task")})=TRIM({T}))*(TRIM({col("Customer / Area")})=TRIM({C})))>1)')
    flag_f = (f'=IF({empty},"",MID(IF({od},"{sep}{flag["overdue"]}","")'
              f'&IF({miss},"{sep}"&IF({only_c},"{flag["missingCustomer"]}","{flag["missing"]}"),"")'
              f'&IF({un},"{sep}{flag["unassigned"]}","")&IF({dup},"{sep}{flag["duplicate"]}",""),{len(sep) + 1},300))')
    for r in range(FIRST, LAST + 1):
        ws.cell(r, 9, flag_f)

    tab = Table(displayName=TABLE, ref=f'A4:I{LAST}')
    tab.tableStyleInfo = TableStyleInfo(name='TableStyleLight1', showRowStripes=False, showColumnStripes=False)
    tab._initialise_columns()
    for tc, h in zip(tab.tableColumns, headers):
        tc.name = h
    tab.tableColumns[8].calculatedColumnFormula = TableFormula(attr_text=flag_f[1:])   # Excel copies this into every new row
    ws.add_table(tab)
    ws.freeze_panes = 'A5'

    # Team names: the Assigned To dropdown reads this list (TeamList grows with it).
    ws['K4'] = 'Team (edit names here)'
    ws['K4'].font = f(10, True, 'FFFFFF')
    ws['K4'].fill = fill(TEAL)
    owners = data['OWNERS']
    for i in range(10):
        c = ws.cell(5 + i, 11, owners[i] if i < len(owners) else None)
        c.font = f(10)
        c.border = BOX
    ws['K16'] = 'Add or rename team members above. Keep "Unassigned" for work nobody owns yet.'
    ws['K16'].font = f(8, italic=True, color='475A60')
    ws['K16'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells('K16:K18')

    dv_s = DataValidation(type='list', formula1='"' + ','.join(data['STATUSES']) + '"', allow_blank=True,
                          errorTitle='Status', error='Choose a status from the list.', showErrorMessage=True)
    dv_s.add(f'G{FIRST}:G{FMT_ROWS}')
    dv_a = DataValidation(type='list', formula1='TeamList', allow_blank=True,
                          errorTitle='Assigned To', error='Choose a name from the team list in column K (add new names there).', showErrorMessage=True)
    dv_a.add(f'E{FIRST}:E{FMT_ROWS}')
    dv_d = DataValidation(type='date', operator='greaterThan', formula1='36526', allow_blank=True,
                          errorTitle='Date', error='Enter a date, for example 06-Nov-2026.', showErrorMessage=True)
    dv_d.add(f'B{FIRST}:B{FMT_ROWS}')
    dv_d.add(f'F{FIRST}:F{FMT_ROWS}')
    for dv in (dv_s, dv_a, dv_d):
        ws.add_data_validation(dv)

    used = f'COUNTA($A{FIRST}:$G{FIRST})>0'
    cf = ws.conditional_formatting
    cf.add(f'F{FIRST}:F{FMT_ROWS}', FormulaRule(formula=[f'AND(TRIM($G{FIRST})<>"Completed",$F{FIRST}<>"",$F{FIRST}<AsAt)'],
                                                fill=fill(RED_BG), font=Font(color=RED_INK, bold=True), stopIfTrue=True))
    cf.add(f'B{FIRST}:D{FMT_ROWS} F{FIRST}:F{FMT_ROWS}', FormulaRule(formula=[f'AND(TRIM(B{FIRST})="",{used})'], fill=fill(AMBER_BG),
                                                                      border=Border(bottom=Side(style='thin', color='D9A441'))))
    cf.add(f'E{FIRST}:E{FMT_ROWS}', FormulaRule(formula=[f'AND(TRIM($G{FIRST})<>"Completed",OR(TRIM($E{FIRST})="",TRIM($E{FIRST})="Unassigned"),{used})'],
                                                fill=fill(AMBER_BG), font=Font(color=AMBER_INK, bold=True)))
    cf.add(f'A{FIRST}:H{FMT_ROWS}', FormulaRule(formula=[f'TRIM($G{FIRST})="Completed"'], font=Font(color=GREY)))
    cf.add(f'I{FIRST}:I{FMT_ROWS}', FormulaRule(formula=[f'$I{FIRST}<>""'], fill=fill(AMBER_BG)))

    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = '4:4'

    # ---------------------------------------------------------------- Weekly Summary
    for k, w in {'A': 12, 'B': 30, 'C': 15, 'D': 14, 'E': 48, 'F': 3, 'G': 6}.items():
        sm.column_dimensions[k].width = w
    sm['A1'] = 'Weekly Operations Summary'
    sm['A1'].font = f(16, True, INK)
    sm.row_dimensions[1].height = 26
    sm['A2'] = 'Everything on this sheet is calculated from the Weekly Tracker. Change the three dates to report on another week.'
    sm['A2'].font = f(9, italic=True, color='475A60')

    def section(row, text, span='A{r}:E{r}'):
        c = sm.cell(row, 1, text)
        c.font = f(10, True, 'FFFFFF')
        for cc in range(1, 6):
            sm.cell(row, cc).fill = fill(INK)
        sm.row_dimensions[row].height = 20

    section(3, 'Reporting period')
    dates = [('Reporting Period Start', period['start'], 'PeriodStart'), ('Reporting Period End', period['end'], 'PeriodEnd'),
             ('As At Date', period['asAt'], 'AsAt')]
    for i, (label, value, name) in enumerate(dates):
        r = 4 + i
        sm.cell(r, 1, label).font = f(10)
        sm.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        c = sm.cell(r, 3, iso(value))
        c.number_format = 'dd-mmm-yyyy'
        c.font = f(10, True, INK)
        c.fill = fill('FFFBEA')
        c.border = Border(left=THIN, right=THIN, top=THIN, bottom=Side(style='medium', color=GOLD))
        c.alignment = Alignment(horizontal='left')
        wb.defined_names[name] = DefinedName(name, attr_text=f"'{SUMMARY}'!$C${r}")
    wb.defined_names['TeamList'] = DefinedName('TeamList', attr_text=f"OFFSET('{TRACKER}'!$K$5,0,0,COUNTA('{TRACKER}'!$K$5:$K$14),1)")
    sm['D4'] = 'Edit these dates'
    sm['D4'].font = f(8, italic=True, color=AMBER_INK)

    guide = ['How to use this tracker',
             '1. Update the sample records or replace them with your own.',
             '2. Set the reporting period and as-at date.',
             '3. Update owners and statuses as work progresses.',
             '4. Review the weekly summary and follow-up items.']
    for i, line in enumerate(guide):
        c = sm.cell(3 + i, 5, line)
        c.font = f(10, True, 'FFFFFF') if i == 0 else f(9, color='1C2A2E')
        if i:
            c.fill = fill(MINT)
            c.alignment = Alignment(wrap_text=True, vertical='center')

    inp = f'ISNUMBER({col("Date Received")})*({col("Date Received")}>=PeriodStart)*({col("Date Received")}<=PeriodEnd)'
    notc = f'(TRIM({col("Status")})<>"Completed")'
    metrics = [
        ('Total records received', f'=SUMPRODUCT({inp})'),
        ('Completed', f'=SUMPRODUCT({inp}*(TRIM({col("Status")})="Completed"))'),
        ('Still outstanding', f'=SUMPRODUCT({inp}*{notc})'),
        ('Overdue', f'=SUMPRODUCT({inp}*{notc}*({col("Due Date")}<>"")*({col("Due Date")}<AsAt))'),
        ('Unassigned', f'=SUMPRODUCT({inp}*{notc}*(((TRIM({col("Assigned To")})="")+(TRIM({col("Assigned To")})="Unassigned"))>0))'),
        ('Missing essential information', f'=SUMPRODUCT({inp}*(((TRIM({col("Request / Task")})="")+(TRIM({col("Customer / Area")})="")+({col("Due Date")}=""))>0))'),
        ('Records needing attention', f'=SUMPRODUCT({inp}*({col("Attention Flag")}<>""))'),
    ]
    section(8, 'Weekly figures')
    for i, (label, formula) in enumerate(metrics):
        r = 9 + i
        sm.cell(r, 1, label).font = f(10, i == 6)
        sm.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        c = sm.cell(r, 3, formula)
        c.font = f(12, True, AMBER_INK if i >= 3 else INK)
        c.alignment = Alignment(horizontal='center')
        c.border = BOX
        for cc in (1, 2):
            sm.cell(r, cc).border = Border(bottom=THIN)
    sm['D9'] = 'Date Received falls in the reporting period'
    sm['D12'] = 'Not completed, due before the as-at date'
    sm['D13'] = 'Not completed, Assigned To blank or "Unassigned"'
    sm['D14'] = 'Request / Task, Customer / Area or Due Date blank'
    sm['D15'] = 'Counted once, however many flags'
    for k in ('D9', 'D12', 'D13', 'D14', 'D15'):
        sm[k].font = f(8, italic=True, color='475A60')

    section(17, 'Weekly summary')
    n, c_, o, a = 'C9', 'C10', 'C11', 'C15'
    sentence = (f'=IF({n}=0,"No records were received during the reporting period.",'
                f'{n}&" record"&IF({n}=1,"","s")&IF({n}=1," was"," were")&" received during the reporting period. "'
                f'&IF({o}=0,"All "&{c_}&" are marked as completed.",IF({c_}=0,"None are marked as completed yet, and "&{o}&IF({o}=1," remains"," remain")&" outstanding.",'
                f'{c_}&IF({c_}=1," is"," are")&" marked as completed, while "&{o}&IF({o}=1," remains"," remain")&" outstanding."))'
                f'&" "&IF({a}=0,"No records need attention.",{a}&" record"&IF({a}=1,"","s")&IF({a}=1," needs"," need")&" attention."))')
    sm['A18'] = sentence
    sm.merge_cells('A18:E18')
    sm['A18'].font = f(11, color=INK)
    sm['A18'].alignment = Alignment(wrap_text=True, vertical='top')
    sm.row_dimensions[18].height = 34

    section(20, 'Follow-up items (records in the reporting period with an attention flag)')
    for i, h in enumerate(['Ref', 'Request / Task', 'Assigned To', 'Due Date', 'Reason'], start=1):
        c = sm.cell(21, i, h)
        c.font = f(10, True, INK)
        c.fill = fill(MINT)
        c.border = Border(bottom=Side(style='thin', color=TEAL))
    sm['G21'] = '#'
    sm['G21'].font = f(8, color=GREY)
    pick = [('Ref', 1), ('Request / Task', 2), ('Assigned To', 3), ('Due Date', 4), ('Attention Flag', 5)]
    for k in range(FOLLOW):
        r = 22 + k
        sm.cell(r, 7, f'=IFERROR(_xlfn.AGGREGATE(15,6,(ROW({col("Ref")})-ROW({TABLE}[#Headers]))/({inp}*({col("Attention Flag")}<>"")),ROWS($G$22:G{r})),"")')
        sm.cell(r, 7).font = f(8, color=GREY)
        for name, cc in pick:
            c = sm.cell(r, cc, f'=IF($G{r}="","",IF(INDEX({col(name)},$G{r})="","",INDEX({col(name)},$G{r})))')
            c.font = f(10, cc == 5, AMBER_INK if cc == 5 else '1C2A2E')
            c.border = Border(bottom=Side(style='hair', color='D4D0C3'))
            if cc == 4:
                c.number_format = 'dd-mmm-yyyy'
                c.alignment = Alignment(horizontal='left')
    sm.column_dimensions['G'].hidden = True
    end = 22 + FOLLOW
    sm.cell(end, 1, f'=IF(C15>{FOLLOW},"Showing the first {FOLLOW} of "&C15&" items. Filter the Attention Flag column on the Weekly Tracker to see them all.",'
                    f'IF(C15=0,"Nothing needs attention for this period.",""))').font = f(9, italic=True, color='475A60')
    sm.cell(end + 1, 1, f"Sample data for {data['BUSINESS']}, a fictional business. Rework Rescue · rework-rescue.vercel.app").font = f(8, italic=True, color=GREY)
    sm.freeze_panes = 'A3'
    sm.page_setup.orientation = 'portrait'
    sm.page_setup.fitToWidth = 1
    sm.page_setup.fitToHeight = 0
    sm.sheet_properties.pageSetUpPr.fitToPage = True

    wb.active = 0
    wb.calculation.fullCalcOnLoad = True
    wb.properties.title = 'Weekly Work & Follow-up Tracker'
    wb.properties.creator = 'Rework Rescue'
    wb.properties.created = wb.properties.modified = dt.datetime(2026, 11, 10)
    return wb


# ---------------------------------------------------------------- calculated values
# openpyxl stores formulas without results, so phone previewers would show empty cells. Recalculate a copy in
# LibreOffice, then copy each result into the original file's XML (the original keeps its table, dropdowns and
# formatting exactly as written; Excel recalculates on open anyway).

def recalc_copy(path):
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, 'in.xlsx')
    shutil.copy(path, src)
    outdir = os.path.join(tmp, 'out')
    subprocess.run(['soffice', '--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', outdir, src],
                   check=True, capture_output=True, timeout=180)
    return os.path.join(outdir, 'in.xlsx')


def store_values(path):
    calc = load_workbook(recalc_copy(path), data_only=True)
    sheets = {TRACKER: 'xl/worksheets/sheet1.xml', SUMMARY: 'xl/worksheets/sheet2.xml'}
    with zipfile.ZipFile(path) as z:
        parts = {n: z.read(n) for n in z.namelist()}
    for name, part in sheets.items():
        xml = parts[part].decode('utf-8')
        vals = calc[name]

        def put(m):
            ref, attrs, formula = m.group(1), m.group(2), m.group(3)
            v = vals[ref].value
            attrs = re.sub(r'\s+t="[^"]*"', '', attrs)
            if v is None or v == '':
                return f'<c r="{ref}"{attrs} t="str"><f>{formula}</f><v></v></c>'
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                return f'<c r="{ref}"{attrs}><f>{formula}</f><v>{v:g}</v></c>' if float(v).is_integer() else f'<c r="{ref}"{attrs}><f>{formula}</f><v>{v}</v></c>'
            if isinstance(v, dt.datetime):
                serial = (v - dt.datetime(1899, 12, 30)).days
                return f'<c r="{ref}"{attrs}><f>{formula}</f><v>{serial}</v></c>'
            text = str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            return f'<c r="{ref}"{attrs} t="str"><f>{formula}</f><v>{text}</v></c>'

        xml = re.sub(r'<c r="([A-Z]+\d+)"([^>]*)><f>(.*?)</f>(?:<v>.*?</v>|<v\s*/>)?</c>', put, xml)
        parts[part] = xml.encode('utf-8')
    tmp = path + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, b in parts.items():
            zi = zipfile.ZipInfo(n, date_time=(2026, 11, 10, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, b)
    os.replace(tmp, path)


def main():
    data = load_data()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    build(data).save(OUT)
    if '--no-values' not in sys.argv:
        store_values(OUT)
    print(OUT)


if __name__ == '__main__':
    main()
