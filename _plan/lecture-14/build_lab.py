#!/usr/bin/env python3
"""Builds the data file for the Lecture 14 RAG Lab.
   python3 _plan/lecture-14/build_lab.py
Reads the Retrieval Bench's passages and their 384 numbers (api/_pile.mjs, built by _plan/lecture-13/build_pile.py),
turns the questions in questions.json into 384 numbers with the same model (_plan/lecture-13/embed.mjs; run `npm i` there once),
and writes c8/module-2/lecture-14-building-rag-apps/assets/lab-data.json.
The questions and their known passages live in questions.json. Edit that file, then rerun this script."""
import json, os, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
s = open(os.path.join(ROOT, 'api/_pile.mjs')).read()
pile = json.loads(s[s.index('{', s.index('export const PILE')):].rstrip().rstrip(';'))
ids = {c['id'] for c in pile['chunks']}
qs = json.load(open(os.path.join(HERE, 'questions.json')))
for q in qs:
    assert all(g in ids for g in q['gold']), q
with tempfile.TemporaryDirectory() as t:
    i, o = os.path.join(t, 'in.json'), os.path.join(t, 'out.json')
    json.dump([q['q'] for q in qs], open(i, 'w'))
    subprocess.run(['node', 'embed.mjs', i, o], check=True, cwd=os.path.join(ROOT, '_plan/lecture-13'))
    vecs = json.load(open(o))
r4 = lambda v: [round(x, 4) for x in v]
out = {
    'built': pile['built'], 'model': pile['model'],
    'passages': [{'id': c['id'], 'lecture': int(c['l']), 'title': c['title'], 'text': c['text'], 'tokens': int(c['tok']), 'numbers': r4(c['v'])} for c in pile['chunks']],
    'questions': [dict(q, numbers=r4(v)) for q, v in zip(qs, vecs)],
}
p = os.path.join(ROOT, 'c8/module-2/lecture-14-building-rag-apps/assets/lab-data.json')
json.dump(out, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print('wrote', p, os.path.getsize(p), 'bytes;', len(out['passages']), 'passages,', len(out['questions']), 'questions')
