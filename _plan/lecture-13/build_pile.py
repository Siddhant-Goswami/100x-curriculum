#!/usr/bin/env python3
"""Builds the pile for the Retrieval Bench (Lecture 13) from the twelve C8 notes pages.

  python3 _plan/lecture-13/build_pile.py          (first time: cd _plan/lecture-13 && npm i)

Reads   c8/module-2/lecture-NN-*/notes.html (L4: post-lecture/notes.html)
Writes  c8/module-2/lecture-13-retrieval-augmented-generation/assets/pile.json   what the page draws: text, map x/y, tokens
        api/_pile.mjs                                                            what the server searches: text + 384 numbers

Steps, each one the bench can show:
  1. strip each notes page to its sections, and each section to plain blocks (paragraphs, list items, table rows, captions)
  2. split each section into passages of up to WORDS words, never cutting a block
  3. turn each passage into 384 numbers (embed.mjs: Xenova/gte-small, the same model the browser loads)
  4. flatten the 384 numbers to two map coordinates with PCA (a straight-line projection, so a new question is placed
     on the same picture by the same arithmetic: (v - mean) . component)
Nothing is added to a passage before it is turned into numbers: no title, no lecture name. Rerun when a notes page changes.
"""
import glob, json, os, re, subprocess, sys, tempfile, datetime
import numpy as np
import tiktoken
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PAGE = os.path.join(ROOT, 'c8/module-2/lecture-13-retrieval-augmented-generation/assets/pile.json')
OUT_API = os.path.join(ROOT, 'api/_pile.mjs')
WORDS = 170
ENC = tiktoken.get_encoding('o200k_base')   # GPT-OSS uses this family of tokenizer; counts are close, not exact

# lecture titles as the curriculum sheet has them (the map is the source of truth)
TITLES = {
    1: 'Orientation and State of AI 2026', 2: 'What is an interface; UI as the first interface', 3: 'Building UI: Design to Deploy',
    4: 'API as the second interface', 5: 'Building APIs and backend', 6: 'Databases and domain modelling',
    7: 'Connect backend to database', 8: 'End to end MVP build and deploy', 9: 'LLMs from First Principles',
    10: 'Tool calling and MCP', 11: 'Tool calling and MCP (practical)', 12: 'Building with tool calling and MCP',
}
# the five scoreboard questions (the Lecture 13 plan), shipped with their numbers so they work before the browser model loads
QUESTIONS = [
    {'id': 'Q1', 'q': 'What is Lecture 6 about?', 'known': 'Databases and domain modelling'},
    {'id': 'Q2', 'q': "Which lecture teaches Verifier's Law?", 'known': 'Lecture 1'},
    {'id': 'Q3', 'q': 'Why is the model making things up?', 'known': 'The Lecture 10 passage on hallucination'},
    {'id': 'Q4', 'q': 'Which lecture shows how to put our app on the App Store?', 'known': 'Not in the notes (Lecture 7 deploys to a URL, not the App Store)'},
    {'id': 'Q5', 'q': 'Lecture 11 says the model "still named Zapier". In the lecture with the runs, the fix added three real UI builders to the data. Which three?', 'known': 'Lovable, Google AI Studio and Antigravity (Lecture 10)'},
]
# card sort (station 5): eight sentences, placed by the learner first, then by the model
CARDS = [
    'The model guesses when it has no facts to go on.',
    'A language model invents an answer it cannot know.',
    'Ask the model to say "I don\'t know" instead of guessing.',
    'A table needs a primary key so every row is unique.',
    'Each order row points to one customer with a foreign key.',
    'The server fetches the row and hands it back to the model.',
    'The model writes a request; it never runs the tool itself.',
    'Store the data so it survives a restart.',
]

def pages():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'c8/module-2/lecture-*/notes.html')) + glob.glob(os.path.join(ROOT, 'c8/module-2/lecture-04-*/post-lecture/notes.html'))):
        n = int(re.search(r'lecture-(\d+)', path).group(1))
        if n in TITLES:
            out.append((n, path))
    return sorted(out)

def clean(t):
    return re.sub(r'\s+', ' ', t.replace(' ', ' ')).strip()

def blocks_of(section):
    for bad in section.find_all(['svg', 'script', 'style', 'button', 'nav']):
        bad.decompose()
    out = []
    for el in section.find_all(['p', 'li', 'tr', 'figcaption', 'blockquote', 'h3', 'pre', 'dt', 'dd']):
        if el.find_parent(['li', 'blockquote', 'tr', 'dd']) and el.name != 'tr':   # nested: the parent already has it
            if el.find_parent(['li', 'blockquote', 'dd']):
                continue
        if el.name == 'tr':
            t = ' · '.join(clean(c.get_text(' ')) for c in el.find_all(['td', 'th']))
        else:
            t = clean(el.get_text(' '))
        t = re.sub(r'\s+([.,;:!?)])', r'\1', t).replace('( ', '(')
        if t and not (out and out[-1] == t):
            out.append(t)
    return out

def passages(blocks):
    cur, n, out = [], 0, []
    for b in blocks:
        w = len(b.split())
        if cur and n + w > WORDS:
            out.append(cur); cur, n = [], 0
        cur.append(b); n += w
    if cur:
        if out and n < 40 and sum(len(x.split()) for x in out[-1]) + n <= WORDS + 60:
            out[-1].extend(cur)   # a short tail joins the passage before it
        else:
            out.append(cur)
    return ['\n'.join(p) for p in out]

def embed(texts):
    with tempfile.TemporaryDirectory() as d:
        i, o = os.path.join(d, 'in.json'), os.path.join(d, 'out.json')
        json.dump(texts, open(i, 'w'))
        subprocess.run(['node', os.path.join(HERE, 'embed.mjs'), i, o], check=True, cwd=HERE)
        return np.array(json.load(open(o)), dtype=np.float64)

def main():
    lectures, chunks = [], []
    for n, path in pages():
        soup = BeautifulSoup(open(path, encoding='utf-8').read(), 'html.parser')
        url = '/' + os.path.relpath(path, ROOT).replace('\\', '/')[:-5]
        whole = []
        for sec in soup.select('section.s'):
            h2 = sec.find('h2')
            if h2 and h2.find('span', class_='n'):
                h2.find('span', class_='n').decompose()
            title = clean(h2.get_text(' ')) if h2 else ''
            if h2: h2.decompose()
            bl = blocks_of(sec)
            if not bl:
                continue
            whole.append(title + '\n' + '\n'.join(bl))
            for k, text in enumerate(passages(bl)):
                chunks.append({'id': 'L%d.%s.%d' % (n, sec.get('id', ''), k + 1), 'l': n, 's': sec.get('id', ''), 'title': title,
                               'url': url + '#' + sec.get('id', ''), 'text': text, 'tok': len(ENC.encode(text))})
        full = '\n\n'.join(whole)
        lectures.append({'n': n, 'title': TITLES[n], 'url': url, 'words': len(full.split()), 'tok': len(ENC.encode(full)), 'text': full})
        print('L%-2d %5d words %5d tokens  %s' % (n, lectures[-1]['words'], lectures[-1]['tok'], path), file=sys.stderr)

    V = embed([c['text'] for c in chunks])
    Q = embed([q['q'] for q in QUESTIONS])
    C = embed(CARDS)
    mean = V.mean(axis=0)
    _, _, vt = np.linalg.svd(V - mean, full_matrices=False)
    comps = vt[:2]
    xy = (V - mean) @ comps.T
    # keep the map's orientation stable between rebuilds: L1 on the left, L12 to the right where possible
    for d in range(2):
        if np.mean(xy[[c['l'] == 1 for c in chunks], d]) > np.mean(xy[:, d]):
            xy[:, d] *= -1; comps[d] *= -1
    var = (np.var(xy, axis=0).sum() / np.var(V - mean, axis=0).sum())
    r = lambda a, k=5: [round(float(x), k) for x in a]
    for c, p in zip(chunks, xy):
        c['x'], c['y'] = r(p, 4)
    for q, v in zip(QUESTIONS, Q):
        q['v'] = r(v)
        q['x'], q['y'] = r((v - mean) @ comps.T, 4)
    cards = [{'text': t, 'x': r((v - mean) @ comps.T, 4)[0], 'y': r((v - mean) @ comps.T, 4)[1], 'v': r(v)} for t, v in zip(CARDS, C)]

    built = datetime.date.today().isoformat()
    page = {
        'built': built, 'model': 'Xenova/gte-small', 'dims': V.shape[1], 'words': WORDS,
        'pca': {'mean': r(mean), 'comps': [r(comps[0]), r(comps[1])], 'kept': round(float(var), 3)},
        'lectures': [{k: l[k] for k in ('n', 'title', 'url', 'words', 'tok', 'text')} for l in lectures],
        'chunks': [{k: c[k] for k in ('id', 'l', 's', 'title', 'url', 'text', 'tok', 'x', 'y')} for c in chunks],
        'questions': QUESTIONS, 'cards': cards,
    }
    json.dump(page, open(OUT_PAGE, 'w'), ensure_ascii=False, separators=(',', ':'))
    api = {'built': built, 'model': page['model'], 'chunks': [{'id': c['id'], 'l': c['l'], 'title': c['title'], 'text': c['text'], 'tok': c['tok'], 'v': r(v)} for c, v in zip(chunks, V)],
           'lectures': [{'n': l['n'], 'title': l['title'], 'text': l['text'], 'tok': l['tok']} for l in lectures]}
    with open(OUT_API, 'w') as f:
        f.write('/* Built by _plan/lecture-13/build_pile.py on %s. Do not edit: rerun the script.\n'
                '   The pile the Retrieval Bench searches: %d passages from the twelve notes pages, each with its 384 numbers (%s). */\n'
                'export const PILE = ' % (built, len(chunks), page['model']))
        json.dump(api, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    tot = sum(l['tok'] for l in lectures)
    print('%d passages, %d tokens in all, map keeps %.0f%% of the spread; pile.json %d KB, _pile.mjs %d KB' % (
        len(chunks), tot, 100 * var, os.path.getsize(OUT_PAGE) // 1024, os.path.getsize(OUT_API) // 1024), file=sys.stderr)

if __name__ == '__main__':
    main()
