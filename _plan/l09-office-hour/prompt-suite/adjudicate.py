"""Were the 'good' seeds actually clean? Opus checks each for invented facts or promises (not sums or rewordings)."""
import json, sys, pathlib, statistics as st
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from llm import call_json, pmap
HERE = pathlib.Path(__file__).parent
SC = {s['id']: s for s in json.loads((HERE / 'scenarios.json').read_text())}
Q = """INPUT
{inp}

OUTPUT
{out}

Does the output state any fact, number, date, name, promise or completed action that the input does not support? Correct arithmetic on input numbers, plain rewordings and format changes do NOT count. Return only JSON: {{"invents": true|false, "items": ["..."]}}"""
def adj(sid):
    sd = json.loads((HERE / 'out' / f'seeds_{sid}.json').read_text())
    return sid, call_json('opus', Q.format(inp=SC[sid]['inputs'][0]['text'], out=sd['good']))
res = dict(pmap(adj, list(SC)))
(HERE / 'out' / 'seed_adjudication.json').write_text(json.dumps(res, indent=2))
for sid, r in res.items(): print(sid, r.get('invents'), '|', '; '.join(r.get('items', []))[:200])
for v in ['v1', 'v2']:
    d = json.loads((HERE / 'out' / f'results_{v}.json').read_text())
    for name in ['typical', 'tricky']:
        u = [float(r['grade']['usefulness']) for r in d['runs'] if r['input'] == name and r['grade'].get('usefulness')]
        print(v, name, round(st.mean(u), 2))
