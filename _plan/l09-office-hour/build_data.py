#!/usr/bin/env python3
"""Cut the five-reply set for the L9 office hour from the Writing Evals data.
Run from the repo root: python3 _plan/l09-office-hour/build_data.py
Reads c8/writing-evals/data/{dispute20,cohort}.json and support.json, writes
c8/module-2/lecture-09-llms-from-first-principles/office-hour/data.json."""
import json
SRC = 'c8/writing-evals/data/'
OUT = 'c8/module-2/lecture-09-llms-from-first-principles/office-hour/data.json'
PICK = ['d14', 'd13', 'd11', 'd01', 'd07']        # wide spread, two break the policy
BREAKS = {'d14': 'Credit with no outage on record. Policy: line test first, no credit until a fault is confirmed.',
          'd01': 'Refunded $29.97 for a $9.99 add-on. Policy: refund the add-on in full, nothing extra.'}
d = json.load(open(SRC + 'dispute20.json'))
c = json.load(open(SRC + 'cohort.json'))
pol = json.load(open(SRC + 'industries/support.json'))['policy']
idx = {it['id']: k for k, it in enumerate(d['items'])}
items = []
for i in PICK:
    it = d['items'][idx[i]]
    assert it['flags']['violates_policy'] == (i in BREAKS), i
    items.append({'id': i, 'message': it['message'], 'account': it['account'], 'reply': it['reply'], 'breaks': BREAKS.get(i)})
sheets = [[s['scores'][idx[i]] for i in PICK] for s in c['sheets']]
defs = dict(c['defences'])
reasons = [r for r in c['reasons'] if r['text'] in (
    'Promised a refund the policy does not allow', 'Mentioned another customer',
    'Sounded cold', 'Never said what happens next',
    'I would rather send what our best agent wrote', 'Our senior agent would have handled it better')]
json.dump({'version': d['version'], 'policy': pol, 'items': items, 'sheets': sheets,
           'defence': defs['d14'], 'reasons': reasons}, open(OUT, 'w'), indent=1)
print('wrote', OUT, len(items), 'items,', len(sheets), 'sheets')
