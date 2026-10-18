"""Build the delegation framework's job data from the O*NET 31.0 database.

Input: a JSON dump of five O*NET 31.0 Excel files (Occupation Data, Task Statements,
Task Ratings, Job Titles, Sample of Reported Titles), as {file: [rows]}.
Output, next to this folder:
  data/jobs.json        every occupation: code, title, job titles to search on
  data/w/<major>.json   per SOC major group: each occupation's top 12 tasks,
                        estimated minutes a week and the screen's default answers

Run: python build_onet.py path/to/onet.json
"""
import json, math, os, re, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data')
o = json.load(open(sys.argv[1]))

# ---------- frequency: O*NET's seven categories as times a week ----------
FT_WEEK = {1: 1/52, 2: 4/52, 3: .5, 4: 2, 5: 5, 6: 15, 7: 40}
im, ft = {}, defaultdict(dict)
for r in o['Task_Ratings'][1:]:
    code, tid, scale, cat, val = r[0], r[2], r[4], r[6], r[7]
    if scale == 'IM': im[(code, tid)] = val
    elif scale == 'FT' and cat not in (None, 'n/a'): ft[(code, tid)][int(cat)] = val
def per_week(code, tid):
    d = ft.get((code, tid))
    if not d: return 2.0
    tot = sum(d.values()) or 1
    return sum(FT_WEEK[k] * v for k, v in d.items()) / tot

# ---------- the screen, by rule; every answer is editable on the page ----------
W = lambda *ws: re.compile(r'\b(' + '|'.join(ws) + r')(s|es)?\b')
PHYS = W('equipment', 'machines?', 'machinery', 'vehicles?', 'tools?', 'engines?', 'patients?', 'animals?', 'livestock', 'food', 'meals?', 'dishes',
         'crops?', 'soil', 'wires?', 'wiring', 'pipes?', 'tanks?', 'aircraft', 'vessels?', 'trucks?', 'furnaces?', 'metal', 'wood', 'concrete', 'fabrics?',
         'garments?', 'hair', 'skin', 'body', 'specimens?', 'instruments?', 'devices?', 'furniture', 'rooms?', 'floors?', 'buildings?', 'premises',
         'work ?sites?', 'job ?sites?', 'workpieces?', 'merchandise', 'shelves', 'cash', 'structures?',
         'boilers?', 'pumps?', 'valves?', 'gauges?', 'containers?', 'beds?', 'wounds?', 'blood', 'teeth', 'eyes?', 'children', 'residents?',
         'passengers?', 'guests?', 'roofs?', 'ladders?', 'scaffolds?', 'walls?', 'trees?', 'plants', 'water', 'fires?', 'scenes?', 'molds?', 'dies')
DIG = W('data', 'databases?', 'records?', 'reports?', 'documents?', 'documentation', 'files?', 'software', 'programs?', 'code', 'systems? (design|requirements|specifications)',
        'websites?', 'web', 'online', 'computers?', 'spreadsheets?', 'e-?mails?', 'correspondence', 'letters?', 'accounts?', 'budgets?', 'financial',
        'statements?', 'contracts?', 'proposals?', 'literature', 'publications?', 'research', 'information', 'schedules?', 'calendars?', 'policies',
        'presentations?', 'articles?', 'manuscripts?', 'news', 'market', 'trends?', 'regulations?', 'legislation', 'specifications?', 'plans', 'drawings?',
        'models?', 'charts?', 'invoices?', 'images?', 'photos?', 'photographs?', 'artwork', 'designs?', 'layouts?', 'graphics?', 'claims?', 'applications?', 'forms?', 'logs?', 'inventory', 'orders?', 'prices?', 'costs?', 'sales')
HANDS = set('operate clean install remove apply adjust repair cut assemble position serve place drive load unload move attach mix turn fill transport lay replace '
            'fabricate disassemble trim mark connect align weigh fit mount signal open sort deliver construct start lift wash treat administer bathe feed '
            'harvest plant cook bake paint spray sew weld drill tighten lubricate dismantle stack wrap pack grind polish sand pour shape bend pull push '
            'insert dispense prune water spread erect splice solder load-unload'.split())
MAYBE_HANDS = set('perform test inspect examine observe set check measure maintain prepare monitor provide conduct use make take receive produce control work'.split())
LIVE = set('confer participate collaborate train instruct attend consult teach meet interview explain discuss counsel greet visit demonstrate educate guide '
           'present sell act assist lead escort accompany talk speak lecture tutor coach mentor host welcome entertain testify mediate represent'.split())
LIVE_TEXT = W('meetings?', 'interviews?', 'classes', 'classroom', 'lectures?', 'workshops?', 'in person', 'face-to-face', 'sessions?', 'hearings?', 'court',
              'tours?', 'patients?', 'students', 'care', 'therapy', 'treatment')
JUDGE = set('direct supervise evaluate determine advise recommend establish assess manage oversee negotiate diagnose prescribe assign approve authorize '
            'formulate hire recruit select resolve refer plan decide adjudicate judge rule sign appraise award grant allocate interpret enforce'.split())
JUDGE_TEXT = W('approv(e|al|ing)', 'polic(y|ies)', 'strateg(y|ies|ic)', 'hiring', 'performance of (staff|employees|workers)', 'disciplin(e|ary)', 'goals', 'priorities')
HARD = set('calculate compute estimate forecast audit model'.split())
HARD_TEXT = W('financial models?', 'statistical (analys[ie]s|models?|methods)', 'cost estimates?', 'forecasts?', 'actuarial', 'simulations?')
AUTO = set('monitor read study research compile collect gather review search locate obtain compare track scan keep stay follow'.split())
AUTO_OBJ = W('literature', 'publications?', 'journals?', 'news', 'trends?', 'developments', 'regulations?', 'legislation', 'laws', 'market', 'industry',
             'competitors?', 'information', 'data', 'sources', 'abreast', 'informed', 'current', 'up to date', 'up-to-date', 'research', 'reports?', 'articles?',
             'websites?', 'media', 'statistics', 'prices', 'records', 'documents')
COMMIT = W('approve', 'sign', 'submit', 'send', 'issue', 'pay', 'purchase', 'order', 'enter into', 'execute', 'file', 'publish', 'post', 'update', 'change',
           'clients?', 'customers?', 'money', 'payments?', 'funds', 'accounts?')

def screen(text):
    """Default answers: j junior could sign, r agent can reach it from a screen, c checkable in 2 min, u cheap to undo."""
    t = text.lower(); v = re.split(r'[\s,]', t)[0]
    phys, dig = bool(PHYS.search(t)), bool(DIG.search(t))
    a = {'j': 1, 'r': 1, 'c': 1, 'u': 0}
    if v in HANDS and not (dig and not phys): a['r'] = 0
    elif v in MAYBE_HANDS and phys and not dig: a['r'] = 0
    elif v in LIVE or (v in ('conduct', 'provide', 'perform') and LIVE_TEXT.search(t)) or (v not in AUTO and re.search(r'\b(patients?|students?|class(es|room)?|court)\b', t)): a['r'] = 0
    if v in JUDGE or (JUDGE_TEXT.search(t) and v not in AUTO and v not in ('prepare', 'write', 'compile', 'document', 'record', 'maintain', 'create', 'produce')): a['j'] = 0
    if v in HARD or HARD_TEXT.search(t): a['c'] = 0
    if v in AUTO and AUTO_OBJ.search(t) and not re.search(r'\b(approve|sign|recommend|confer|meet|discuss|patients?|equipment|machines?|operations?)\b', t): a['u'] = 1
    return a

STOP = set('of the a an and or in on to for with from by at as its their his her'.split())
def short(text):
    s = re.sub(r'^(\w+)((, \w+)*,? (or|and) \w+)+\b', r'\1', text).rstrip('.')  # "Plan, direct, or coordinate x" -> "Plan x"
    # cut at the first break that leaves a head of at least two words (three for a comma or "and")
    for m in re.finditer(r',|;|:| to | for | such as| in order| including| by | that | which | according to| so that| when | where | through | and ', s):
        head = s[:m.start()]
        if len(head.split()) >= (3 if m.group() in (',', ' and ') else 2): s = head; break
    w = s.split()
    if len(w) > 5: w = w[:5]
    while w and w[-1].lower().strip(',') in STOP: w.pop()
    s = ' '.join(w).rstrip(',')
    return s[0].upper() + s[1:] if s else text[:40]

# ---------- occupations and tasks ----------
occ = {r[0]: r[1] for r in o['Occupation_Data'][1:]}
tasks = defaultdict(list)
for r in o['Task_Statements'][1:]:
    code, tid, text, typ = r[0], r[2], r[3], r[4]
    tasks[code].append((tid, text.strip(), typ))

HOURS = 40
weeks = defaultdict(dict)
for code, ts in tasks.items():
    rows = []
    for tid, text, typ in ts:
        imp = im.get((code, tid), 3.0 if typ == 'Core' else 2.5)
        f = per_week(code, tid)
        w = (imp ** 2) * math.sqrt(f) * (1 if typ == 'Core' else .8)
        rows.append((w, tid, text))
    rows.sort(key=lambda x: -x[0]); rows = rows[:12]
    tot = sum(r[0] for r in rows) or 1
    out = []
    for w, tid, text in rows:
        m = max(15, int(round(HOURS * 60 * w / tot / 15.0)) * 15)
        a = screen(text)
        out.append({'i': tid, 't': text, 's': short(text), 'm': m, **a})
    weeks[code.split('-')[0]][code] = out

titles, reported = defaultdict(list), defaultdict(set)
for r in o['Sample_of_Reported_Titles'][1:]: titles[r[0]].append(r[2]); reported[r[0]].add(r[2])
for r in o['Job_Titles'][1:]:
    if r[3]: titles[r[0]].append(r[3])
    titles[r[0]].append(r[2])
jobs = []
jobs_with_tasks = [c for c in occ if c in tasks]
for code, t in occ.items():
    if code not in tasks: continue
    seen, alts = {t.lower()}, []
    for a in titles[code]:
        k = a.lower()
        if k in seen: continue
        seen.add(k); alts.append(a)
        if len(alts) >= 16: break
    rep = sum(1 for a in alts if a in reported[code])  # reported titles come first: the names people actually use
    jobs.append([code, t, alts, rep])
jobs.sort(key=lambda j: j[1])

# the average job's split of hours, for the K section
share = {'stay': 0, 'acc': 0, 'auto': 0}
for d in weeks.values():
    for ts in d.values():
        tot = sum(t['m'] for t in ts) or 1
        for t in ts:
            k = 'stay' if not (t['j'] and t['r'] and t['c']) else 'auto' if t['u'] else 'acc'
            share[k] += t['m'] / tot / len(jobs_with_tasks)
os.makedirs(os.path.join(OUT, 'w'), exist_ok=True)
json.dump({'v': 'O*NET 31.0', 'hours': HOURS, 'avg': {k: round(v, 3) for k, v in share.items()}, 'jobs': jobs}, open(os.path.join(OUT, 'jobs.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
for mg, d in weeks.items():
    json.dump(d, open(os.path.join(OUT, 'w', mg + '.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(jobs), 'jobs;', sum(len(d) for d in weeks.values()), 'weeks in', len(weeks), 'files')
