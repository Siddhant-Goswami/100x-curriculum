"""Build the page's task bank from the hand-written roles.

Input:  _plan/bank_written.json  {"roles":[{"role", "alias":[...], "tasks":[[line, how_often, minutes], ...]}]}
Output: data/bank.json           {"roles":[[role, [alias...], [[line, how_often, minutes], ...]], ...]}
O*NET's tasks are not copied in: the page loads the matched job's twelve from data/w/ instead.

Run: python build_bank.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
src = json.load(open(os.path.join(HERE, 'bank_written.json')))
OFTEN = {'daily', 'few_week', 'weekly', 'monthly', 'quarterly'}
roles = []
for r in src['roles']:
    tasks = [[t, f, int(m)] for t, f, m in r['tasks'] if f in OFTEN and t.strip()]
    roles.append([r['role'], r.get('alias', []), tasks])
out = os.path.join(HERE, '..', 'data', 'bank.json')
json.dump({'v': 1, 'roles': roles}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(roles), 'roles,', sum(len(r[2]) for r in roles), 'tasks ->', os.path.relpath(out), os.path.getsize(out), 'bytes')
