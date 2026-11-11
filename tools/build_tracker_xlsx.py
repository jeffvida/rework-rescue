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
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.drawing.image import Image as XLImage
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.marker import DataPoint
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.text import RichText
from openpyxl.drawing.text import Paragraph, ParagraphProperties, CharacterProperties, Font as DFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'downloads', 'Rework-Rescue-Weekly-Work-Tracker.xlsx')

START = 'Start here'
TRACKER = 'Weekly Tracker'
REPORT = 'Weekly Report'
SUMMARY = REPORT     # older name kept for the checker
TABLE = 'Tracker'
FIRST = 5            # first data row (header on row 4)
ROWS = 100           # table rows ready to fill in (12 sample + 88 empty); Excel extends the table past them
LAST = FIRST + ROWS - 1
FMT_ROWS = 1000      # dropdowns and highlighting reach this far, so they also cover rows added later
FOLLOW = 10          # "What needs attention" lines on the report (a note says when there are more)
ITEM0 = 13           # first "What needs attention" row on the report
CHECK0 = 27          # first check row on the report
STAT0 = 38           # first "Jobs by status" row on the report
LOGO = os.path.join(ROOT, 'assets', 'brand', 'logo.png')
SITE = 'https://rework-rescue.vercel.app'

# Website colours (assets/styles.css): deep teal, teal, ochre accent, gold signal, cream paper; status colours as in the demo.
INK, TEAL, MINT, GOLD, IVORY, OCHRE = '0F3A3A', '2E7D72', 'E2EEE9', 'E6C078', 'F8F7ED', '7A5B16'
AMBER_BG, AMBER_INK, RED_BG, RED_INK, GREY = 'FCEFD6', '8A5200', 'FBE4E0', 'A33B2F', '6B7478'
GREEN_BG, GREEN_INK, BLUE_BG, BLUE_INK, MUTED = 'E2F3E8', '1F6B43', 'E8EFF9', '3F5F8F', '5B6670'
PASS, FLAGGED, ACTION = '\u2713 Passed', '! Flagged', '\u25CF Action required'
STATUS_FILL = {'Completed': GREEN_INK, 'In Progress': BLUE_INK, 'Waiting': 'C08A1E', 'Not Started': '9AA3A6'}
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
    st = wb.active
    st.title = START
    ws = wb.create_sheet(TRACKER)
    sm = wb.create_sheet(REPORT)
    for s, tab_c in ((st, GOLD), (ws, INK), (sm, TEAL)):
        s.sheet_view.showGridLines = False
        s.sheet_properties.tabColor = tab_c

    # ---------------------------------------------------------------- Weekly Tracker
    headers = [x['label'] for x in data['FIELDS']] + ['Notes / Next Step', 'Attention Flag']
    widths = [9, 14, 30, 24, 14, 13, 14, 15, 30, 32, 3, 24]
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    ws['A1'] = 'Weekly Work & Follow-up Tracker'
    ws['A1'].font = f(16, True, INK)
    ws['A2'] = ('Enter your requests and tasks, assign an owner, set a due date, and update the status as work progresses. '
                'The attention flags will help identify items that need checking.')
    ws['A2'].font = f(10, color='475A60')
    ws['A2'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells('A2:J2')
    ws.row_dimensions[1].height = 26
    ws.row_dimensions[2].height = 30
    ws['A3'] = (f"Sample data for {data['BUSINESS']}, a fictional business, for demonstration purposes. Type over it or delete it, and add new records in the next empty row. "
                'Attention Flag fills in by itself; the reporting dates are at the top of the Weekly Report sheet.')
    ws['A3'].font = f(9, italic=True, color='475A60')
    ws.merge_cells('A3:J3')
    ws.row_dimensions[3].height = 15
    for r in range(1, 4):
        for c in range(1, 11):
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
        vals = [rec['ref'], iso(rec['received']), rec['task'], rec['customer'] or None, rec['owner'], iso(rec['due']), rec['status'], iso(rec.get('completed')), None] if rec else [None] * 9
        for i, v in enumerate(vals, start=1):
            c = ws.cell(r, i, v)
            c.font = f(10)
            c.alignment = Alignment(vertical='center')
            if i in (2, 6, 8):
                c.number_format = 'dd-mmm-yyyy'
                c.alignment = Alignment(horizontal='left', vertical='center')
        ws.cell(r, 10).font = f(10, True, AMBER_INK)

    D, T, C, A, U, S = (this(x) for x in ('Date Received', 'Request / Task', 'Customer / Area', 'Assigned To', 'Due Date', 'Status'))
    empty = f'AND({D}="",TRIM({T})="",TRIM({C})="",TRIM({A})="",{U}="",TRIM({S})="")'
    DC = this('Date Completed')
    # Open at the cut-off (engine isOpen): not Completed, or completed after the period end.
    is_open = f'OR(TRIM({S})<>"Completed",AND(ISNUMBER({DC}),{DC}>PeriodEnd))'
    od = f'AND({is_open},{U}<>"",{U}<AsAt)'
    nodate = f'AND(TRIM({S})="Completed",TRIM({DC}&"")="")'
    miss = f'OR({D}="",TRIM({T})="",TRIM({C})="",{U}="")'
    only_c = f'AND(TRIM({C})="",{D}<>"",TRIM({T})<>"",{U}<>"")'
    un = f'AND({is_open},OR(TRIM({A})="",TRIM({A})="Unassigned"))'
    dup = (f'AND({D}<>"",TRIM({T})<>"",TRIM({C})<>"",SUMPRODUCT(({col("Date Received")}={D})'
           f'*(TRIM({col("Request / Task")})=TRIM({T}))*(TRIM({col("Customer / Area")})=TRIM({C})))>1)')
    flag_f = (f'=IF({empty},"",MID(IF({od},"{sep}{flag["overdue"]}","")'
              f'&IF({miss},"{sep}"&IF({only_c},"{flag["missingCustomer"]}","{flag["missing"]}"),"")'
              f'&IF({un},"{sep}{flag["unassigned"]}","")&IF({dup},"{sep}{flag["duplicate"]}","")&IF({nodate},"{sep}{flag["noDate"]}",""),{len(sep) + 1},300))')
    for r in range(FIRST, LAST + 1):
        ws.cell(r, 10, flag_f)

    tab = Table(displayName=TABLE, ref=f'A4:J{LAST}')
    tab.tableStyleInfo = TableStyleInfo(name='TableStyleLight1', showRowStripes=False, showColumnStripes=False)
    tab._initialise_columns()
    for tc, h in zip(tab.tableColumns, headers):
        tc.name = h
    tab.tableColumns[9].calculatedColumnFormula = TableFormula(attr_text=flag_f[1:])   # Excel copies this into every new row
    ws.add_table(tab)
    ws.freeze_panes = 'A5'

    # Team names: the Assigned To dropdown reads this list (TeamList grows with it).
    ws['L4'] = 'Team (edit names here)'
    ws['L4'].font = f(10, True, 'FFFFFF')
    ws['L4'].fill = fill(TEAL)
    owners = data['OWNERS']
    for i in range(10):
        c = ws.cell(5 + i, 12, owners[i] if i < len(owners) else None)
        c.font = f(10)
        c.border = BOX
    ws['L16'] = 'Add or rename team members above. Keep "Unassigned" for work nobody owns yet.'
    ws['L16'].font = f(8, italic=True, color='475A60')
    ws['L16'].alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells('L16:L18')

    dv_s = DataValidation(type='list', formula1='"' + ','.join(data['STATUSES']) + '"', allow_blank=True,
                          errorTitle='Status', error='Choose a status from the list.', showErrorMessage=True)
    dv_s.add(f'G{FIRST}:G{FMT_ROWS}')
    dv_a = DataValidation(type='list', formula1='TeamList', allow_blank=True,
                          errorTitle='Assigned To', error='Choose a name from the team list in column L (add new names there).', showErrorMessage=True)
    dv_a.add(f'E{FIRST}:E{FMT_ROWS}')
    dv_d = DataValidation(type='date', operator='greaterThan', formula1='36526', allow_blank=True,
                          errorTitle='Date', error='Enter a date, for example 06-Nov-2026.', showErrorMessage=True)
    dv_d.add(f'B{FIRST}:B{FMT_ROWS}')
    dv_d.add(f'F{FIRST}:F{FMT_ROWS}')
    dv_d.add(f'H{FIRST}:H{FMT_ROWS}')
    for dv in (dv_s, dv_a, dv_d):
        ws.add_data_validation(dv)

    used = f'COUNTA($A{FIRST}:$G{FIRST})>0'
    cf = ws.conditional_formatting
    cf.add(f'F{FIRST}:F{FMT_ROWS}', FormulaRule(formula=[f'AND(OR(TRIM($G{FIRST})<>"Completed",AND(ISNUMBER($H{FIRST}),$H{FIRST}>PeriodEnd)),$F{FIRST}<>"",$F{FIRST}<AsAt)'],
                                                fill=fill(RED_BG), font=Font(color=RED_INK, bold=True), stopIfTrue=True))
    cf.add(f'B{FIRST}:D{FMT_ROWS} F{FIRST}:F{FMT_ROWS}', FormulaRule(formula=[f'AND(TRIM(B{FIRST})="",{used})'], fill=fill(AMBER_BG),
                                                                      border=Border(bottom=Side(style='thin', color='D9A441'))))
    cf.add(f'E{FIRST}:E{FMT_ROWS}', FormulaRule(formula=[f'AND(OR(TRIM($G{FIRST})<>"Completed",AND(ISNUMBER($H{FIRST}),$H{FIRST}>PeriodEnd)),OR(TRIM($E{FIRST})="",TRIM($E{FIRST})="Unassigned"),{used})'],
                                                fill=fill(AMBER_BG), font=Font(color=AMBER_INK, bold=True)))
    # A completed job without its Date Completed: amber hint (the report needs it to count the job in the right week).
    cf.add(f'H{FIRST}:H{FMT_ROWS}', FormulaRule(formula=[f'AND(TRIM($G{FIRST})="Completed",$H{FIRST}="")'], fill=fill(AMBER_BG),
                                                border=Border(bottom=Side(style='thin', color='D9A441')), stopIfTrue=True))
    cf.add(f'A{FIRST}:I{FMT_ROWS}', FormulaRule(formula=[f'TRIM($G{FIRST})="Completed"'], font=Font(color=GREY)))
    cf.add(f'J{FIRST}:J{FMT_ROWS}', FormulaRule(formula=[f'$J{FIRST}<>""'], fill=fill(AMBER_BG)))

    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = '4:4'

    report_sheet(wb, sm, data)
    start_sheet(wb, st, data)

    wb.active = 0
    wb.calculation.fullCalcOnLoad = True
    wb.properties.title = 'Weekly Work & Follow-up Tracker'
    wb.properties.creator = 'Rework Rescue'
    wb.properties.created = wb.properties.modified = dt.datetime(2026, 11, 10)
    return wb


# ---------------------------------------------------------------- Weekly Report (laid out like the website's live example)
GRID = 'BCDEFGHIJKLM'          # 12 equal content columns; A and N are margins, O:R hidden helpers


def put(ws, rng, value=None, font=None, fill_c=None, align=None, fmt=None, border=None):
    """Write value into the top-left cell of rng (merging it) and style every cell in the range."""
    first = rng.split(':')[0]
    if ':' in rng:
        ws.merge_cells(rng)
    c = ws[first]
    if value is not None:
        c.value = value
    cells = [cell for row in ws[rng] for cell in (row if isinstance(row, tuple) else (row,))] if ':' in rng else [c]
    for cell in cells:
        if font: cell.font = font
        if fill_c: cell.fill = fill(fill_c)
        if align: cell.alignment = align
        if fmt: cell.number_format = fmt
        if border: cell.border = border
    return c


def logo(ws, anchor, height=38):
    """The Rework Rescue logo, scaled down (2x the shown size, for sharp screens) so the file stays small."""
    if not os.path.exists(LOGO):
        return
    from io import BytesIO
    from PIL import Image as PILImage
    src = PILImage.open(LOGO)
    w = round(src.width * height * 2 / src.height)
    buf = BytesIO()
    src.resize((w, height * 2), PILImage.LANCZOS).save(buf, 'PNG', optimize=True)
    buf.seek(0)
    img = XLImage(buf)
    img.height, img.width = height, w // 2
    ws.add_image(img, anchor)


def section_head(ws, row, text):
    put(ws, f'B{row}:M{row}', text, f(9, True, OCHRE), align=Alignment(vertical='bottom'),
        border=Border(bottom=Side(style='thin', color='D9D3C2')))
    ws.row_dimensions[row].height = 20


def ref_list(cond, count, col_q, col_r, row):
    """Text like hero.js refText(): 'R-111', 'R-111, R-112' or 'n records' (refs found with AGGREGATE)."""
    return f'IF({count}<=2,{col_q}{row}&IF({count}=2,", "&{col_r}{row},""),{count}&" records")'


def nth_ref(cond, k):
    return f'=IFERROR(INDEX({col("Ref")},_xlfn.AGGREGATE(15,6,(ROW({col("Ref")})-ROW({TABLE}[#Headers]))/({cond}),{k})),"")'


def report_sheet(wb, sm, data):
    flag = data['FLAG']
    period = data['PERIOD']
    sm.column_dimensions['A'].width = 2.5
    for k in GRID:
        sm.column_dimensions[k].width = 8.6
    sm.column_dimensions['N'].width = 2.5
    for k in 'OPQR':
        sm.column_dimensions[k].width = 10
        sm.column_dimensions[k].hidden = True

    # Header: logo, title, business, dates (the inputs), records checked.
    sm.row_dimensions[1].height = 34
    logo(sm, 'B1', 36)
    put(sm, 'B2:M2', 'WEEKLY OPERATIONS REPORT · FICTIONAL SAMPLE', f(9, True, OCHRE))
    put(sm, 'B3:I3', data['BUSINESS'], f(18, True, INK))
    sm.row_dimensions[3].height = 28
    date_box = Border(left=THIN, right=THIN, top=THIN, bottom=Side(style='medium', color=GOLD))
    put(sm, 'B4:C4', 'Reporting period', f(10, color=MUTED), align=Alignment(vertical='center'))
    put(sm, 'D4:E4', iso(period['start']), f(10, True, INK), 'FFFBEA', Alignment(horizontal='center'), 'dd-mmm-yyyy', date_box)
    put(sm, 'F4', 'to', f(10, color=MUTED), align=Alignment(horizontal='center'))
    put(sm, 'G4:H4', iso(period['end']), f(10, True, INK), 'FFFBEA', Alignment(horizontal='center'), 'dd-mmm-yyyy', date_box)
    put(sm, 'B5:C5', 'As at', f(10, color=MUTED), align=Alignment(vertical='center'))
    put(sm, 'D5:E5', iso(period['asAt']), f(10, True, INK), 'FFFBEA', Alignment(horizontal='center'), 'dd-mmm-yyyy', date_box)
    put(sm, 'F5:I5', 'Edit the dates to report on another week', f(8, italic=True, color=AMBER_INK), align=Alignment(vertical='center'))
    for name, cell in (('PeriodStart', 'D4'), ('PeriodEnd', 'G4'), ('AsAt', 'D5')):
        wb.defined_names[name] = DefinedName(name, attr_text=f"'{REPORT}'!${cell[0]}${cell[1:]}")
    wb.defined_names['TeamList'] = DefinedName('TeamList', attr_text=f"OFFSET('{TRACKER}'!$L$5,0,0,COUNTA('{TRACKER}'!$L$5:$L$14),1)")
    put(sm, 'J4:M4', '=O6&" job"&IF(O6=1,"","s")&" checked"', f(11, True, TEAL), align=Alignment(horizontal='right'))
    put(sm, 'J5:M5', 'Calculated from the Weekly Tracker', f(8, italic=True, color=MUTED), align=Alignment(horizontal='right'))

    # Hidden helper figures (the same as the website's summarise()).
    # Reporting definitions (src/tracker/engine.js, approved 11 Nov 2026):
    #   Completed this week = Completed with Date Completed inside the period
    #   Still outstanding   = received by the period end and not completed by it (no Date Completed, or a later one)
    #   Need attention      = still-outstanding jobs with a flag
    D, S, C = col('Date Received'), col('Status'), col('Date Completed')
    recv = f'ISNUMBER({D})*({D}<=PeriodEnd)'
    is_c = f'(TRIM({S})="Completed")'
    comp = f'{recv}*{is_c}*ISNUMBER({C})*({C}>=PeriodStart)*({C}<=PeriodEnd)'
    outs = f'{recv}*(1-{is_c}*ISNUMBER({C})*({C}<=PeriodEnd))'
    inp = f'({comp}+{outs})'
    opn = f'((1-{is_c})+{is_c}*ISNUMBER({C})*({C}>PeriodEnd))'
    miss_c = f'{inp}*(((TRIM({col("Request / Task")})="")+(TRIM({col("Customer / Area")})="")+({col("Due Date")}=""))>0)'
    un_c = f'{inp}*{opn}*(((TRIM({col("Assigned To")})="")+(TRIM({col("Assigned To")})="Unassigned"))>0)'
    od_c = f'{inp}*{opn}*({col("Due Date")}<>"")*({col("Due Date")}<AsAt)'
    flagged = f'{outs}*({col("Attention Flag")}<>"")'
    figures = [('Total', f'=SUMPRODUCT({inp})'), ('Completed', f'=SUMPRODUCT({comp})'),
               ('Outstanding', f'=SUMPRODUCT({outs})'), ('Overdue', f'=SUMPRODUCT({od_c})'), ('Unassigned', f'=SUMPRODUCT({un_c})'),
               ('Missing', f'=SUMPRODUCT({miss_c})'), ('Attention', f'=SUMPRODUCT({flagged})')]
    sm['O5'] = 'Figures (helper)'
    for i, (label, formula) in enumerate(figures):
        sm.cell(6 + i, 15, formula)
        sm.cell(6 + i, 16, label)

    # Tiles: Completed this week / Still outstanding / Need attention (of the n still outstanding).
    tiles = [('B', 'E', '=O7', 'Completed this week', None, GREEN_BG, GREEN_INK),
             ('F', 'I', '=O8', 'Still outstanding', None, BLUE_BG, BLUE_INK),
             ('J', 'M', '=O12', 'Need attention', '=IF(O8>0,"Of the "&O8&" still outstanding","")', AMBER_BG, AMBER_INK)]
    gap = Side(style='thick', color='FFFFFF')
    for a, b, num, label, sub, bg, ink in tiles:
        put(sm, f'{a}7:{b}7', num, f(26, True, ink), bg, Alignment(horizontal='left', vertical='bottom', indent=1))
        put(sm, f'{a}8:{b}8', label, f(10, True, INK), bg, Alignment(horizontal='left', vertical='center', indent=1))
        put(sm, f'{a}9:{b}9', sub or '', f(8, color=MUTED), bg, Alignment(horizontal='left', vertical='top', indent=1))
        for r in (7, 8, 9):
            for cc in (a, b):
                cell = sm[f'{cc}{r}']
                cell.border = Border(left=gap if cc == a else None, right=gap if cc == b else None)
    sm.row_dimensions[7].height = 38
    sm.row_dimensions[8].height = 18
    sm.row_dimensions[9].height = 18
    # Conditional: "Need attention" tile turns green when nothing needs attention.
    sm.conditional_formatting.add('J7:M9', FormulaRule(formula=['$O$12=0'], fill=fill(GREEN_BG), font=Font(color=GREEN_INK)))

    # What needs attention: one line per flagged record, most urgent first (as on the website).
    section_head(sm, 11, 'WHAT NEEDS ATTENTION')
    heads = [('B', '#'), ('C', 'Ref'), ('D:H', 'Action'), ('I:J', 'Owner'), ('K', 'Due'), ('L:M', 'Issue')]
    for rng, h in heads:
        a = rng.split(':')[0]
        put(sm, f'{a}12:{rng.split(":")[-1]}12' if ':' in rng else f'{a}12', h, f(8, True, MUTED))
    high = f'((ISNUMBER(SEARCH("{flag["overdue"]}",{col("Attention Flag")}))+ISNUMBER(SEARCH("{flag["unassigned"]}",{col("Attention Flag")})))>0)'
    key = f'((1-{high})*100000+ROW({col("Ref")})-ROW({TABLE}[#Headers]))'
    line = Border(bottom=Side(style='hair', color='D4D0C3'))
    for k in range(FOLLOW):
        r = ITEM0 + k
        sm.cell(r, 15, f'=IFERROR(MOD(_xlfn.AGGREGATE(15,6,{key}/({flagged}),ROWS($O${ITEM0}:O{r})),100000),"")')
        fl = f'INDEX({col("Attention Flag")},$O{r})'
        has = lambda w: f'ISNUMBER(SEARCH("{w}",{fl}))'
        action = (f'=IF($O{r}="","",IF({has(flag["overdue"])},"Follow up on overdue work",IF({has(flag["unassigned"])},"Assign an owner",'
                  f'IF({has(flag["missingCustomer"])},"Complete the missing customer information",IF({has(flag["missing"])},"Complete the missing information",IF({has(flag["duplicate"])},"Check the possible duplicate","Add the completion date"))))))')
        issue = (f'=IF($O{r}="","",IF({has(flag["overdue"])},"Overdue",IF({has(flag["unassigned"])},"No owner",'
                 f'IF({has(flag["missingCustomer"])},"Missing customer",IF({has(flag["missing"])},"Missing information",IF({has(flag["duplicate"])},"Possible duplicate","No completion date"))))))')
        cells = [('B', f'=IF($O{r}="","",ROWS($O${ITEM0}:O{r}))', f(10, color=MUTED), '0"."'),
                 ('C', f'=IF($O{r}="","",INDEX({col("Ref")},$O{r}))', f(10, True, INK), None),
                 ('D:H', action, f(10, color=INK), None),
                 ('I:J', f'=IF($O{r}="","",IF(TRIM(INDEX({col("Assigned To")},$O{r}))="","Unassigned",INDEX({col("Assigned To")},$O{r})))', f(10, color=INK), None),
                 ('K', f'=IF($O{r}="","",IF(INDEX({col("Due Date")},$O{r})="","",INDEX({col("Due Date")},$O{r})))', f(10, color=INK), 'd mmm'),
                 ('L:M', issue, f(9, True, AMBER_INK), None)]
        for rng, formula, fnt, fmt in cells:
            a = rng.split(':')[0]
            target = f'{a}{r}:{rng.split(":")[-1]}{r}' if ':' in rng else f'{a}{r}'
            put(sm, target, formula, fnt, align=Alignment(vertical='center', horizontal='left'), fmt=fmt)
        sm.row_dimensions[r].height = 18
    sm.conditional_formatting.add(f'B{ITEM0}:K{ITEM0 + FOLLOW - 1}', FormulaRule(formula=[f'$O{ITEM0}<>""'], border=Border(bottom=Side(style='thin', color='E3DFD2'))))
    sm.conditional_formatting.add(f'L{ITEM0}:M{ITEM0 + FOLLOW - 1}', FormulaRule(formula=[f'OR($L{ITEM0}="Overdue",$L{ITEM0}="No owner")'], fill=fill(RED_BG), font=Font(color=RED_INK, bold=True), border=Border(bottom=Side(style='thin', color='FFFFFF'))))
    sm.conditional_formatting.add(f'L{ITEM0}:M{ITEM0 + FOLLOW - 1}', FormulaRule(formula=[f'AND($L{ITEM0}<>"",$L{ITEM0}<>"Overdue",$L{ITEM0}<>"No owner")'], fill=fill(AMBER_BG), border=Border(bottom=Side(style='thin', color='FFFFFF'))))
    note_r = ITEM0 + FOLLOW
    put(sm, f'B{note_r}:M{note_r}', f'=IF(O12=0,"Nothing needs attention for this period.",IF(O12>{FOLLOW},"Showing the first {FOLLOW} of "&O12&". Filter the Attention Flag column on the Weekly Tracker to see them all.",""))',
        f(9, italic=True, color=MUTED))

    # Checks, by stage (the same nine checks as the website).
    section_head(sm, 25, 'CHECKS · CAPTURE → MOVE → SEE')
    for rng, h in (('B26:C26', 'Stage'), ('D26:G26', 'Check'), ('H26:K26', 'Result'), ('L26:M26', 'Status')):
        put(sm, rng, h, f(8, True, MUTED))
    statuses = '{"' + '","'.join(data['STATUSES']) + '"}'
    status_ok = f'ISNUMBER(MATCH(TRIM({col("Status")}),{statuses},0))'
    date_ok = lambda c: f'((ISNUMBER({col(c)})+({col(c)}=""))>0)'
    dup_c = f'{inp}*ISNUMBER(SEARCH("{flag["duplicate"]}",{col("Attention Flag")}))'
    r = CHECK0
    checks = [
        ('Capture', 'No duplicate jobs', f'=SUMPRODUCT({dup_c})', None,
         '=IF(P{r}=0,"None found",P{r}&" found")', f'=IF(P{r}=0,"{PASS}","{FLAGGED}")'),
        ('', 'Job details complete', f'=SUMPRODUCT({miss_c})', miss_c,
         '=IF(P{r}=0,$O$6&" of "&$O$6&" complete",($O$6-P{r})&" of "&$O$6&" complete · "&' + ref_list(None, 'P{r}', 'Q', 'R', '{r}') + ')',
         f'=IF(P{{r}}=0,"{PASS}","{FLAGGED}")'),
        ('', 'Dates entered correctly', f'=SUMPRODUCT({inp}*{date_ok("Due Date")}*{status_ok})', None,
         '=P{r}&" of "&$O$6', f'=IF(P{{r}}=$O$6,"{PASS}","{FLAGGED}")'),
        ('Move', 'Every open job has an owner', f'=SUMPRODUCT({un_c})', un_c,
         '=IF(P{r}=0,"All open jobs","No owner · "&' + ref_list(None, 'P{r}', 'Q', 'R', '{r}') + ')', f'=IF(P{{r}}=0,"{PASS}","{ACTION}")'),
        ('', 'Every job has a status', f'=SUMPRODUCT({inp}*{status_ok})', None,
         '=P{r}&" of "&$O$6', None),
        ('', 'Follow-ups on time', f'=SUMPRODUCT({od_c})', od_c,
         '=IF(P{r}=0,"None overdue","Overdue · "&' + ref_list(None, 'P{r}', 'Q', 'R', '{r}') + ')', f'=IF(P{{r}}=0,"{PASS}","{ACTION}")'),
        ('See', 'Totals add up', '=$O$7+$O$8', None, '=$O$7&" done + "&$O$8&" open = "&$O$6', f'=IF(P{{r}}=$O$6,"{PASS}","{FLAGGED}")'),
        ('', 'Every job counted', f'=SUM($E${STAT0}:$E${STAT0 + 3})', None, '=P{r}&" of "&$O$6&" counted"', f'=IF(P{{r}}=$O$6,"{PASS}","{FLAGGED}")'),
        ('', 'Problems shown, not hidden', '=$O$12', None, '=IF(P{r}=0,"None this week",P{r}&" on the report")', f'=IF(P{{r}}=0,"{PASS}","{FLAGGED}")'),
    ]
    owners_ok = f'=SUMPRODUCT({inp}*(((COUNTIF(TeamList,TRIM({col("Assigned To")}))>0)+(TRIM({col("Assigned To")})=""))>0))'
    for i, (stage, label, count, cond, result, status) in enumerate(checks):
        r = CHECK0 + i
        top = Border(top=Side(style='thin', color='D9D3C2')) if stage and i else Border(bottom=Side(style='hair', color='EBE7DA'))
        put(sm, f'B{r}:C{r}', stage, f(10, True, TEAL), align=Alignment(vertical='center'), border=top)
        put(sm, f'D{r}:G{r}', label, f(10, True, INK), align=Alignment(vertical='center'), border=top)
        sm.cell(r, 16, count)
        if cond:
            sm.cell(r, 17, nth_ref(cond, 1))
            sm.cell(r, 18, nth_ref(cond, 2))
        put(sm, f'H{r}:K{r}', result.replace('{r}', str(r)), f(10, color=MUTED), align=Alignment(vertical='center'), border=top)
        if label == 'Every job has a status':
            sm.cell(r, 18, owners_ok)          # team names in the list (or blank)
            status = f'=IF(AND(P{r}=$O$6,R{r}=$O$6),"{PASS}","{FLAGGED}")'
        put(sm, f'L{r}:M{r}', status.replace('{r}', str(r)), f(9, True, GREEN_INK), align=Alignment(vertical='center'), border=top)
        sm.row_dimensions[r].height = 20
    rng = f'L{CHECK0}:M{CHECK0 + 8}'
    sm.conditional_formatting.add(rng, FormulaRule(formula=[f'ISNUMBER(SEARCH("Passed",$L{CHECK0}))'], fill=fill(GREEN_BG), font=Font(color=GREEN_INK, bold=True)))
    sm.conditional_formatting.add(rng, FormulaRule(formula=[f'ISNUMBER(SEARCH("Flagged",$L{CHECK0}))'], fill=fill(AMBER_BG), font=Font(color=AMBER_INK, bold=True)))
    sm.conditional_formatting.add(rng, FormulaRule(formula=[f'ISNUMBER(SEARCH("Action",$L{CHECK0}))'], fill=fill(RED_BG), font=Font(color=RED_INK, bold=True)))

    # Jobs by status: a small table and one chart.
    section_head(sm, 37, 'JOBS BY STATUS')
    for i, stt in enumerate(['Completed', 'In Progress', 'Waiting', 'Not Started']):
        r = STAT0 + i
        put(sm, f'B{r}:D{r}', stt, f(10, color=INK), border=line)
        put(sm, f'E{r}', f'=SUMPRODUCT({inp}*(TRIM({col("Status")})="{stt}"))', f(10, True, INK), align=Alignment(horizontal='center'), border=line)
    put(sm, f'B{STAT0 + 4}:D{STAT0 + 4}', 'Total', f(10, True, INK))
    put(sm, f'E{STAT0 + 4}', f'=SUM(E{STAT0}:E{STAT0 + 3})', f(10, True, INK), align=Alignment(horizontal='center'))
    ch = BarChart()
    ch.type = 'col'
    ch.legend = None
    ch.add_data(Reference(sm, min_col=5, min_row=STAT0, max_row=STAT0 + 3), titles_from_data=False)
    ch.set_categories(Reference(sm, min_col=2, min_row=STAT0, max_row=STAT0 + 3))
    ser = ch.series[0]
    for i, stt in enumerate(['Completed', 'In Progress', 'Waiting', 'Not Started']):
        pt = DataPoint(idx=i)
        pt.graphicalProperties.solidFill = STATUS_FILL[stt]
        pt.graphicalProperties.line.solidFill = STATUS_FILL[stt]
        ser.dPt.append(pt)
    ser.dLbls = DataLabelList()
    ser.dLbls.showVal = True
    for attr in ('showSerName', 'showCatName', 'showLegendKey', 'showPercent'):
        setattr(ser.dLbls, attr, False)
    ch.gapWidth = 70
    ch.y_axis.delete = True
    ch.y_axis.majorGridlines = None
    ch.y_axis.scaling.min = 0
    ch.x_axis.delete = False
    ch.x_axis.majorTickMark = 'none'
    ch.width, ch.height = 11.2, 5.6
    sm.add_chart(ch, f'G{STAT0}')

    # Summary line, closing line, footer.
    section_head(sm, 51, 'SUMMARY')
    n, c_, o, a = 'O6', 'O7', 'O8', 'O12'
    sentence = (f'=IF({n}=0,"No jobs in this report.",'
                f'{n}&" job"&IF({n}=1,"","s")&" in this report. "'
                f'&IF({o}=0,"All "&{c_}&IF({c_}=1," was"," were")&" completed this week.",IF({c_}=0,"None were completed this week, and "&{o}&IF({o}=1," remains"," remain")&" outstanding.",'
                f'{c_}&IF({c_}=1," was"," were")&" completed this week, while "&{o}&IF({o}=1," remains"," remain")&" outstanding."))'
                f'&" "&IF({a}=0,"No jobs need attention.",{a}&" job"&IF({a}=1,"","s")&IF({a}=1," needs"," need")&" attention."))')
    put(sm, 'B52:M52', sentence, f(10, color=INK), align=Alignment(wrap_text=True, vertical='top'))
    sm.row_dimensions[52].height = 30
    put(sm, 'B54:M54', 'Know what’s completed. See what’s outstanding. Know what to do next.', f(12, True, TEAL))
    sm.row_dimensions[54].height = 22
    put(sm, 'B56:M56', f"Sample data for {data['BUSINESS']}, a fictional business, for demonstration purposes. Rework Rescue · rework-rescue.vercel.app",
        f(8, italic=True, color=GREY))
    sm.freeze_panes = 'A6'
    sm.page_setup.orientation = 'portrait'
    sm.page_setup.fitToWidth = 1
    sm.page_setup.fitToHeight = 1          # the report prints on one page
    sm.sheet_properties.pageSetUpPr.fitToPage = True
    sm.print_area = 'A1:N56'


# ---------------------------------------------------------------- Start here
def start_sheet(wb, st, data):
    st.column_dimensions['A'].width = 2.5
    st.column_dimensions['B'].width = 14
    st.column_dimensions['C'].width = 78
    st.row_dimensions[1].height = 40
    logo(st, 'B1', 40)
    put(st, 'B3:C3', 'Weekly Work & Follow-up Tracker', f(18, True, INK))
    st.row_dimensions[3].height = 28
    put(st, 'B4:C4', f"A sample tracker and weekly operations report for {data['BUSINESS']}, a fictional service business. "
        'Try it, then replace the sample with your own work.', f(10, color=MUTED), align=Alignment(wrap_text=True, vertical='top'))
    st.row_dimensions[4].height = 30

    def head(row, text):
        put(st, f'B{row}:C{row}', text, f(9, True, OCHRE), border=Border(bottom=Side(style='thin', color='D9D3C2')))
        st.row_dimensions[row].height = 22

    def link_sheet(cell, sheet, text):
        c = st[cell]
        c.value = text
        c.hyperlink = Hyperlink(ref=cell, location=f"'{sheet}'!A1", display=text)
        c.font = Font(name=FONT, size=10, bold=True, color=TEAL, underline='single')

    head(6, 'HOW IT WORKS · CAPTURE → MOVE → SEE')
    rows = [('Capture', 'The Weekly Tracker holds one row per job. Checks catch missing details and possible duplicates.', TRACKER, 'Open the Weekly Tracker'),
            ('Move', 'Owners, due dates and statuses. Overdue and unassigned work is flagged by formulas as you type.', TRACKER, None),
            ('See', 'The Weekly Report shows the figures, what needs attention, the checks and a chart, all calculated from the tracker.', REPORT, 'Open the Weekly Report')]
    r = 7
    for stage, text, sheet, link in rows:
        put(st, f'B{r}', stage, f(11, True, TEAL), align=Alignment(vertical='top'))
        put(st, f'C{r}', text, f(10, color=INK), align=Alignment(wrap_text=True, vertical='top'))
        st.row_dimensions[r].height = 30
        r += 1
        if link:
            link_sheet(f'C{r}', sheet, link + ' →')
            r += 1
    head(13, 'TRY IT IN ONE MINUTE')
    steps = ['Open the Weekly Report: 7 completed, 5 still outstanding, 3 need attention (R-104, R-112 and R-111).',
             'On the Weekly Tracker, set R-112’s Assigned To to Sam. Back on the report, Need attention drops to 2 and "Every open job has an owner" shows Passed.',
             'Replace the sample rows with your own, and change the reporting dates at the top of the Weekly Report.']
    for i, t in enumerate(steps):
        put(st, f'B{14 + i}', f'{i + 1}.', f(11, True, TEAL), align=Alignment(horizontal='right', vertical='top', indent=1))
        put(st, f'C{14 + i}', t, f(10, color=INK), align=Alignment(wrap_text=True, vertical='top'))
        st.row_dimensions[14 + i].height = 30
    head(18, 'GOOD TO KNOW')
    notes = ['Works in Microsoft Excel 2010 or later, on the desktop or Excel on the web. No macros or add-ins, and nothing is sent anywhere.',
             'Add or rename team members in the Team list on the Weekly Tracker (column L); the Assigned To dropdown follows it.',
             'When a job is done, set Status to Completed and add the Date Completed. Jobs still open carry over to next week\u2019s report by themselves.',
             'How the report counts: Completed this week = a Date Completed inside the reporting period. Still outstanding = received by the end of the period and not completed by then, including older jobs. Need attention = outstanding jobs that are overdue, missing details, have no owner, may be duplicates or are marked Completed without a date.',
             'Type new jobs in the next empty row of the tracker: the checks and the report include them automatically.',
             'Status colours: green Passed, amber Flagged, red Action required. Each status is also written out in words.',
             f"{data['BUSINESS']} and its records are fictional, for demonstration only."]
    for i, t in enumerate(notes):
        put(st, f'B{19 + i}', '•', f(10, color=TEAL), align=Alignment(horizontal='right', vertical='top', indent=1))
        put(st, f'C{19 + i}', t, f(10, color=INK), align=Alignment(wrap_text=True, vertical='top'))
        st.row_dimensions[19 + i].height = 28
    cta = 19 + len(notes) + 1
    st.row_dimensions[19 + [n.startswith('How the report counts') for n in notes].index(True)].height = 54   # longer note
    put(st, f'B{cta}:C{cta}', 'Want this built around your own process?', f(11, True, INK), IVORY,
        border=Border(top=Side(style='medium', color=GOLD)))
    c = put(st, f'B{cta + 1}:C{cta + 1}', 'Book a free report review: 30 minutes, no obligation \u2192', Font(name=FONT, size=10, bold=True, color=TEAL, underline='single'), IVORY)
    c.hyperlink = Hyperlink(ref=f'B{cta + 1}', target=f'{SITE}/contact/#contact-form-area', display=c.value)
    put(st, f'B{cta + 2}:C{cta + 2}', 'Rework Rescue \u00b7 rework-rescue.vercel.app', f(8, italic=True, color=GREY), IVORY)
    st.row_dimensions[cta].height = 24
    st.page_setup.orientation = 'portrait'
    st.page_setup.fitToWidth = 1
    st.sheet_properties.pageSetUpPr.fitToPage = True


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
    sheets = {TRACKER: 'xl/worksheets/sheet2.xml', REPORT: 'xl/worksheets/sheet3.xml'}
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
