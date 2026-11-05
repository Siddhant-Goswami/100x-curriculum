"""Test suite for the prompt the Write the Eval page hands learners.

E1  Do the task: each scenario's prompt x 2 inputs x 2 learner models (haiku ~ free tier, sonnet ~ paid).
E2  Independent grade: opus grades each output against the learner's eval, flags what each check needs
    (the output alone, the source input, or a human/future event), invented facts, missing-info handling,
    usefulness, and whether the self-scorecard was honest.
E3  Discrimination: opus writes three outputs per scenario with known labels (good, breaks a hard line,
    weak on a quality). Judge prompts must tell them apart.
E4  Meta: opus ranks each scenario's eval for usefulness, using E1 to E3.

Usage: python3 -I suite.py v1            (prompts from out/prompts_v1.json)
       python3 -I suite.py v2            (prompts from out/prompts_v2.json)
"""
import json, sys, pathlib, statistics as st
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from llm import call, call_json, pmap

HERE = pathlib.Path(__file__).parent
VER = sys.argv[1] if len(sys.argv) > 1 else 'v1'
SC = {s['id']: s for s in json.loads((HERE / 'scenarios.json').read_text())}
PR = {p['id']: p for p in json.loads((HERE / 'out' / f'prompts_{VER}.json').read_text())}
LEARNER = ['haiku', 'sonnet']
JUDGE = 'opus'
PLACE = "[paste today's input here]"


def filled(x): return bool(x and str(x).strip())


def eval_text(s):
    """The learner's eval, neutral form, for the independent grader."""
    S = s['state']; L = [f"Task: {S['row']['task']}", f"Definition of good: {S['row'].get('criteria','')}",
                         f"Decision: {S['dec'].get('decision','')}", f"Population: {S['dec'].get('population','')}"]
    hard = [x for x in S.get('hard', []) if filled(x)]
    dims = [d for d in S.get('dims', []) if filled(d.get('name')) and filled(d.get('one')) and filled(d.get('five'))]
    for k, x in enumerate(hard): L.append(f"H{k+1} (Pass/Fail): {x}")
    for k, d in enumerate(dims): L.append(f"Q{k+1} {d['name']} (1 to 5): 1 = {d['one']}; 5 = {d['five']}")
    return '\n'.join(L), hard, dims


def fill(prompt, text):
    import re
    m = re.search(r"\[paste today's input here[^\]]*\]", prompt)
    assert m, 'placeholder missing'
    return prompt[:m.start()] + text + prompt[m.end():]


# ---------- E1 + E2
def e1(job):
    sid, inp, model = job
    out = call(model, fill(PR[sid]['prompt'], SC[sid]['inputs'][inp]['text']), tag=f'{sid}-{inp}-{model}')
    return {'sid': sid, 'input': SC[sid]['inputs'][inp]['name'], 'model': model, 'output': out}


GRADE = """You are auditing an AI workflow built by a non-technical learner. They wrote an eval for a task they do at work, the page turned it into a prompt, and an LLM ran that prompt. Grade strictly and literally.

THE LEARNER'S EVAL
{ev}

THE INPUT THE LLM WAS GIVEN
{inp}

WHAT THE LLM RETURNED (its output, then its own scorecard)
{out}

Return only JSON:
{{
 "checks": [ {{"id": "H1 or Q1", "needs": "output" | "input" | "human_or_future", "independent": "Pass" | "Fail" | 1-5 | "cannot_tell", "self": "what the LLM's scorecard claimed", "inflated": true|false}} ],
 "invented_facts": [ "any number, name, date or claim not supported by the input" ],
 "missing_info": "asked" | "flagged_and_proceeded" | "silently_guessed" | "not_needed",
 "usefulness": 1-5,
 "scorecard_honest": 1-5,
 "format_followed": true|false,
 "notes": "one or two sentences: the most important thing that went right or wrong"
}}
needs: "output" = checkable by reading the output alone; "input" = needs comparing to the input; "human_or_future" = needs a person's opinion or an event after the fact (an approval, a reply, an interview result).
usefulness: 5 = the learner could use it today with light edits; 3 = a decent draft that needs real work; 1 = unusable or misleading.
scorecard_honest: 5 = the self-scorecard matches your grading and admits what it can't know; 1 = claims passes it could not have checked or that are false."""


def e2(r):
    s = SC[r['sid']]; ev, _, _ = eval_text(s)
    inp = next(i['text'] for i in s['inputs'] if i['name'] == r['input'])
    g = call_json(JUDGE, GRADE.format(ev=ev, inp=inp, out=r['output']), tag='grade')
    return {**r, 'grade': g}


# ---------- E3
SEED = """Here is an eval a learner wrote, and one real input.

EVAL
{ev}

INPUT
{inp}

Write three outputs for this task and input, as JSON only:
{{"good": "an output that passes every hard line and would score 4 or 5 on every quality",
 "hard_fail": "a convincing output that quietly breaks {hard_target} but is otherwise good" ,
 "weak_quality": "an output that passes the hard lines but is a 2 on {q_target}, written to look fine at a glance"}}
If there is no hard line, make hard_fail an output that invents a fact not in the input. Keep each output realistic in length."""


def seeds(sid):
    s = SC[sid]; ev, hard, dims = eval_text(s)
    f = HERE / 'out' / f'seeds_{sid}.json'
    if f.exists(): return json.loads(f.read_text())
    j = call_json(JUDGE, SEED.format(ev=ev, inp=s['inputs'][0]['text'], hard_target=('H1: ' + hard[0]) if hard else 'a fact', q_target=('Q1 ' + dims[0]['name']) if dims else 'overall usefulness'), tag='seed')
    f.write_text(json.dumps(j, indent=2)); return j


OLD_JUDGE = """You are scoring one output for this task: {task}.

Score each line from 1 to 5, using only these ends:
{lines}

Reply with one line per item: name, score, one reason.

Output to score:
{out}"""

VERDICT = """Here is a grader's reply about one output. Read it and return only JSON: {{"verdict": "pass" | "fail" | "needs_you" | "unclear", "flagged": ["ids or names of checks it marked as failing or under 4"]}}
A grader that gives every quality 4 or more and passes every hard line is "pass". If it says the only open items are things a person must check (Can't tell), that is "needs_you".

GRADER REPLY
{reply}"""


def judge_prompt(sid, out):
    s = SC[sid]
    if VER != 'v1' and PR[sid].get('judge'):
        return PR[sid]['judge'].replace('[paste the output here]', out).replace('[paste the input here]', s['inputs'][0]['text'])
    _, hard, dims = eval_text(s)
    if not dims: return None  # the old page only had a quality judge
    return OLD_JUDGE.format(task=s['state']['row']['task'], lines='\n'.join(f"- {d['name']}: 1 = {d['one']}; 5 = {d['five']}" for d in dims), out=out)


def e3(job):
    sid, kind, model = job
    sd = seeds(sid); out = sd.get(kind)
    if not out: return None
    jp = judge_prompt(sid, out)
    if not jp: return {'sid': sid, 'kind': kind, 'model': model, 'verdict': 'no_judge'}
    reply = call(model, jp, tag='judge')
    v = call_json('haiku', VERDICT.format(reply=reply), tag='verdict')
    want = 'pass' if kind == 'good' else 'fail'
    return {'sid': sid, 'kind': kind, 'model': model, 'verdict': v.get('verdict'), 'correct': (v.get('verdict') in ('pass', 'needs_you')) if want == 'pass' else v.get('verdict') == 'fail', 'reply': reply}


# ---------- E4
META = """You are reviewing evals written by learners in a beginner AI course. Each learner wrote a decision, a population, hard lines (Pass/Fail) and qualities (1 to 5 with written ends). The course page turns the eval into a prompt that does the task and grades itself.

LEARNER EVAL
{ev}

THE PROMPT THE PAGE GENERATED
{prompt}

WHAT HAPPENED WHEN WE RAN IT (independent grades of 4 runs)
{runs}

DISCRIMINATION TEST (could a judge tell a good output from seeded bad ones)
{disc}

Return only JSON:
{{"usefulness": 1-10, "why": "two sentences", "eval_problems": ["specific problems in what the learner wrote"], "prompt_problems": ["specific problems in how the page turned it into a prompt"], "best_fix_on_final_page": "the one change to the generated prompt or instructions that would help this learner most, without changing the questions they were asked"}}
usefulness: how much this eval, as turned into a prompt, actually helps the learner get reliably good work from an LLM and know when it is good."""


def e4(sid, runs, disc):
    ev, _, _ = eval_text(SC[sid])
    rs = '\n'.join(f"- {r['model']} / {r['input']}: usefulness {r['grade'].get('usefulness')}, honest {r['grade'].get('scorecard_honest')}, invented {len(r['grade'].get('invented_facts') or [])}, missing_info {r['grade'].get('missing_info')}, needs {[c.get('needs') for c in r['grade'].get('checks', [])]}, note: {r['grade'].get('notes')}" for r in runs)
    ds = '\n'.join(f"- {d['model']} on {d['kind']}: {d['verdict']}" for d in disc if d) or 'no judge prompt available'
    return call_json(JUDGE, META.format(ev=ev, prompt=PR[sid]['prompt'], runs=rs, disc=ds), tag='meta')


def main():
    ids = list(SC)
    jobs = [(sid, i, m) for sid in ids for i in range(2) for m in LEARNER]
    print(f'[{VER}] E1 do: {len(jobs)} runs', flush=True)
    runs = pmap(e1, jobs)
    print(f'[{VER}] E2 grade', flush=True)
    runs = pmap(e2, runs)
    print(f'[{VER}] E3 seeds + judge', flush=True)
    pmap(seeds, ids, 8)
    disc = [d for d in pmap(e3, [(sid, k, m) for sid in ids for k in ['good', 'hard_fail', 'weak_quality'] for m in LEARNER]) if d]
    print(f'[{VER}] E4 meta', flush=True)
    meta = dict(zip(ids, pmap(lambda sid: e4(sid, [r for r in runs if r['sid'] == sid], [d for d in disc if d['sid'] == sid]), ids)))
    (HERE / 'out' / f'results_{VER}.json').write_text(json.dumps({'runs': runs, 'disc': disc, 'meta': meta}, indent=2))
    summarise(runs, disc, meta)


def num(x):
    try: return float(x)
    except Exception: return None


def summarise(runs, disc, meta):
    rows = []
    for sid in SC:
        rr = [r for r in runs if r['sid'] == sid]; g = [r['grade'] for r in rr]
        use = [num(x.get('usefulness')) for x in g if num(x.get('usefulness'))]
        hon = [num(x.get('scorecard_honest')) for x in g if num(x.get('scorecard_honest'))]
        checks = [c for x in g for c in x.get('checks', [])]
        infl = sum(1 for c in checks if c.get('inflated') is True)
        unseen = sum(1 for c in checks if c.get('needs') == 'human_or_future')
        inv = sum(len(x.get('invented_facts') or []) for x in g)
        guessed = sum(1 for x in g if x.get('missing_info') == 'silently_guessed')
        dd = [d for d in disc if d['sid'] == sid and d.get('verdict') != 'no_judge']
        acc = (sum(d['correct'] for d in dd) / len(dd)) if dd else None
        m = meta[sid]
        rows.append({'sid': sid, 'label': SC[sid]['label'], 'meta': num(m.get('usefulness')), 'use': st.mean(use) if use else None,
                     'honest': st.mean(hon) if hon else None, 'inflated': f'{infl}/{len(checks)}', 'unseen': f'{unseen}/{len(checks)}',
                     'invented': inv, 'guessed': guessed, 'judge_acc': acc, 'fix': m.get('best_fix_on_final_page')})
    rows.sort(key=lambda r: -(r['meta'] or 0))
    f = lambda x: '–' if x is None else (f'{x:.1f}' if isinstance(x, float) else str(x))
    L = [f'# Prompt suite results ({VER})', '', '| Rank | Scenario | Meta /10 | Output use /5 | Scorecard honest /5 | Inflated checks | Checks the model can\'t see | Invented facts | Silent guesses | Judge accuracy |', '|---|---|---|---|---|---|---|---|---|---|']
    for k, r in enumerate(rows):
        L.append(f"| {k+1} | {r['sid']} {r['label']} | {f(r['meta'])} | {f(r['use'])} | {f(r['honest'])} | {r['inflated']} | {r['unseen']} | {r['invented']} | {r['guessed']} | {'–' if r['judge_acc'] is None else format(r['judge_acc'], '.0%')} |")
    allg = [r['grade'] for r in runs]
    L += ['', f"Overall: output usefulness {st.mean([num(x.get('usefulness')) for x in allg if num(x.get('usefulness'))]):.2f}/5, scorecard honesty {st.mean([num(x.get('scorecard_honest')) for x in allg if num(x.get('scorecard_honest'))]):.2f}/5, "
          f"format followed {sum(1 for x in allg if x.get('format_followed'))}/{len(allg)}, judge accuracy {sum(d['correct'] for d in disc if d.get('verdict')!='no_judge')}/{sum(1 for d in disc if d.get('verdict')!='no_judge')} (no judge for {sum(1 for d in disc if d.get('verdict')=='no_judge')})", '']
    for m_ in LEARNER:
        mg = [r['grade'] for r in runs if r['model'] == m_]
        L.append(f"- {m_}: usefulness {st.mean([num(x.get('usefulness')) for x in mg if num(x.get('usefulness'))]):.2f}, honesty {st.mean([num(x.get('scorecard_honest')) for x in mg if num(x.get('scorecard_honest'))]):.2f}")
    L += ['', '## Best fix per scenario (opus)', ''] + [f"- **{r['sid']}**: {r['fix']}" for r in rows]
    L += ['', '## Problems found', '']
    for sid in SC:
        m = meta[sid]; L.append(f"### {sid} {SC[sid]['label']}"); L.append(f"{m.get('why','')}")
        L += [f'- eval: {p}' for p in m.get('eval_problems', [])] + [f'- prompt: {p}' for p in m.get('prompt_problems', [])]
        L += [f"- run {r['model']}/{r['input']}: {r['grade'].get('notes')}" for r in runs if r['sid'] == sid]; L.append('')
    (HERE / 'out' / f'report_{VER}.md').write_text('\n'.join(L))
    print('\n'.join(L[:16]))


if __name__ == '__main__':
    main()
