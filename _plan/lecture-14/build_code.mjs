// Writes the downloadable files for the RAG Lab from assets/rag-file.js (the same pieces the page shows and runs).
//   node _plan/lecture-14/build_code.mjs            -> c8/module-2/lecture-14-building-rag-apps/code/rag.py (every level's starter)
//   node _plan/lecture-14/build_code.mjs --solved F -> F: rag.py with working answers, for testing only (never published)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LAB = path.join(ROOT, 'c8/module-2/lecture-14-building-rag-apps');
const box = {}; new Function('self', readFileSync(path.join(LAB, 'assets/rag-file.js'), 'utf8'))(box);
const R = box.RAGFILE;
const SOLVED = {
  count: 'def total_tokens(passages):\n    total = 0\n    for p in passages:\n        total = total + p["tokens"]\n    return total\n',
  shared: 'def score_shared(question, passage):\n    q = set(words(question))\n    p = set(words(passage["text"]))\n    return len(q & p)\n',
  rare: 'def score_rare(question, passage):\n    q = set(words(question))\n    p = set(words(passage["text"]))\n    total = 0\n    for w in q & p:\n        total += math.log(N / seen_in(w))\n    return total\n',
  meaning: 'def closeness(a, b):\n    total = 0\n    for x, y in zip(a, b):\n        total += x * y\n    return total\n',
  merge: 'def fuse(by_words, by_meaning):\n    points = {}\n    for ranked in (by_words, by_meaning):\n        for place, pid in enumerate(ranked, start=1):\n            points[pid] = points.get(pid, 0) + 1 / (60 + place)\n    return sorted(points, key=points.get, reverse=True)\n',
  pick: 'def pick(by_words, by_meaning):\n    return by_words[:3] + by_meaning[:3]\n',
  prompt: 'def build_prompt(question, passages):\n    text = ""\n    for p in passages:\n        text += "[" + p["id"] + "] " + p["text"] + "\\n\\n"\n    text += "Answer only from these passages. If they do not answer it, say it is not in the notes. Name the [id] you used.\\n\\nQuestion: " + question\n    return text\n',
  filter: 'def can_see(passage, track):\n    return track == "code" or passage["lecture"] not in CODE_ONLY\n'
};
const i = process.argv.indexOf('--solved');
const code = {}; R.PARTS.forEach(p => { code[p.id] = i > 0 ? SOLVED[p.id] : p.starter; });
const out = i > 0 ? process.argv[i + 1] : path.join(LAB, 'code/rag.py');
writeFileSync(out, R.file(code, null));
console.log('wrote', out);
