"""Builds the Lecture 9 practice set template (Verify Your Own Job) as an .xlsx.
Two tabs with the same layout: Aarav's week (the example) and Your week (blank).
Import it into the existing Google Sheet with File > Import > Replace spreadsheet;
the dropdowns and formulas survive the import.
Run: python build_template.py out.xlsx  (needs openpyxl)"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

HEAD = Font(bold=True, color='FFFFFF')
HEAD_FILL = PatternFill('solid', fgColor='2B2B2B')
INPUT_FILL = PatternFill('solid', fgColor='FFF4D6')
BOLD = Font(bold=True)
WRAP = Alignment(wrap_text=True, vertical='top')
H, FIRST, LAST = 8, 9, 88  # header row, first and last task rows

COLUMNS = [  # header, width, dropdown options
    ('Atomic task\n(verb + what you produced)', 36, None),
    ('Time spent\n(minutes)', 10, None),
    ('Success criteria\n(what must be true for it to count as done)', 34, None),
    ('Moves my North Star?\n(Not at all: stop here)', 17, ['A lot', 'A little', 'Not at all']),
    ('Verifier\n(a rule, or judge · signal · when)', 44, None),
    ('Verification type', 17, ['Rule', 'Judgment', 'Unverifiable']),
    ('Data\n(past input and output pairs)', 16, ['None', 'Under 10', '10 to 100', 'Over 100']),
    ('Bucket', 14, ['Automate', 'Augment', 'Human']),
]


def rng(col):
    return f'{col}{FIRST}:{col}{LAST}'


def build(ws, title, north_star, guess, rows):
    ws['A1'] = title
    ws['A1'].font = Font(bold=True, size=14)
    top = [
        ('My North Star: By [month + year], I am [role or identity] doing [specific thing] at [level, income or scale].', north_star),
        ('My guess, before counting: share of tasks that are verifiable', guess),
    ]
    for i, (label, value) in enumerate(top, start=2):
        ws[f'A{i}'], ws[f'B{i}'] = label, value
        ws.merge_cells(f'B{i}:E{i}')
        ws[f'B{i}'].fill = INPUT_FILL
    ws['B3'].number_format = '0%'

    typed = f'(COUNTIF({rng("F")},"Rule")+COUNTIF({rng("F")},"Judgment")+COUNTIF({rng("F")},"Unverifiable"))'
    checkable = f'(COUNTIF({rng("F")},"Rule")+COUNTIF({rng("F")},"Judgment"))'
    hours = f'(SUMIFS({rng("B")},{rng("F")},"Rule")+SUMIFS({rng("B")},{rng("F")},"Judgment"))'
    all_hours = f'(SUMIFS({rng("B")},{rng("F")},"<>"))'
    with_data = '+'.join(f'COUNTIFS({rng("F")},"{t}",{rng("G")},"<>None",{rng("G")},"<>")'
                         for t in ('Rule', 'Judgment'))
    for i, (label, formula) in enumerate([
        ('Verifiable tasks', f'=IFERROR({checkable}/{typed},"")'),
        ('Verifiable time', f'=IFERROR({hours}/{all_hours},"")'),
        ('Verifiable, and the data exists', f'=IFERROR(({with_data})/{typed},"")'),
    ], start=4):
        ws[f'A{i}'], ws[f'B{i}'] = label, formula
        ws[f'B{i}'].number_format = '0%'
        ws[f'B{i}'].font = BOLD
    for r in range(2, 7):
        ws[f'A{r}'].alignment = WRAP
        ws[f'B{r}'].alignment = WRAP
    ws.row_dimensions[2].height = 58

    for c, (name, width, _) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=H, column=c, value=name)
        cell.font, cell.fill, cell.alignment = HEAD, HEAD_FILL, WRAP
        ws.column_dimensions[cell.column_letter].width = width
    ws.row_dimensions[H].height = 66
    for r, values in enumerate(rows, start=FIRST):
        for c, v in enumerate(values, start=1):
            ws.cell(row=r, column=c, value=v)
    for row in ws.iter_rows(min_row=FIRST, max_row=LAST, max_col=len(COLUMNS)):
        for cell in row:
            cell.alignment = WRAP
    for c, (_, _, opts) in enumerate(COLUMNS, start=1):
        if opts:
            col = ws.cell(row=H, column=c).column_letter
            dv = DataValidation(type='list', formula1='"' + ','.join(opts) + '"', allow_blank=True)
            dv.add(rng(col))
            ws.add_data_validation(dv)
    ws.freeze_panes = f'B{FIRST}'


AARAV = [
    ["Pull last week's GMV, orders, AOV and return rate into the weekly business review deck", 90,
     'Leadership sees correct numbers at Monday 11am', 'A little',
     "Rule: totals match the Databricks gold table; GMV within 0.5% of finance's SAP export",
     'Rule', '10 to 100', 'Automate'],
    ["Answer the category manager's Slack ask: why did Pune returns jump 38% last week?", 120,
     'The manager acts on the root cause without a follow-up question', 'A lot',
     'Category manager · acts on it with no follow-up question · within 2 days',
     'Judgment', 'Over 100', 'Augment'],
    ['Pull Q3 sales by channel for the cost-cut deck', 60,
     'Q3 numbers in the deck match finance', 'A little',
     'Rule: year-to-date minus Q1 and Q2 equals Q3; within 0.5% of SAP',
     'Rule', '10 to 100', 'Automate'],
    ['Write SQL for repeat-purchase rate by acquisition channel', 75,
     'Growth team uses the number to set CAC payback', 'A little',
     'Rule: cohort sizes sum to total new customers; June matches the signed-off Power BI number',
     'Rule', '10 to 100', 'Automate'],
    ['Write user stories for "Buy 2, get 10% off" in Jira', 90,
     'Engineering builds it without reopening the ticket', 'Not at all'],
    ['Competitor pricing scan for the Q4 pricing recommendation', 180,
     'Manager takes it to the CFO as is', 'A lot',
     'Manager · would take it to the CFO, every price has a dated source · by Friday',
     'Judgment', 'Under 10', 'Augment'],
    ['A/B test readout for the one-page checkout', 120,
     'Growth lead makes the ship call from it', 'A little',
     'Growth lead · agrees with the ship call · same day (sample-ratio check passes first)',
     'Judgment', '10 to 100', 'Augment'],
    ['Build the Q4 cost-cut deck for leadership', 240,
     'Manager approves it for the CFO with no rework', 'A lot',
     'Manager · approves it for the CFO with no rework · same day (every number traces to the Q3 pull)',
     'Judgment', '10 to 100', 'Augment'],
    ['Present the recommendation to the CFO and handle pushback', 60,
     'The CFO approves the cuts', 'A lot',
     'Nobody at the time. Savings show up next quarter: too late to learn from',
     'Unverifiable', 'None', 'Human'],
]

wb = Workbook()
build(wb.active, "Aarav's week · example (9 of his 41 rows)",
      'By April 2027, I am a senior analyst on the pricing team, owning the "why did this metric move" '
      'answers for leadership with AI drafting them, at a 20% raise over my current pay.', 0.5, AARAV)
wb.active.title = "Aarav's week (example)"
ws = wb.create_sheet('Your week')
build(ws, 'Your week · one row per atomic task from last week, from your calendar, mail and Slack', '', None, [])
wb.save(sys.argv[1])
