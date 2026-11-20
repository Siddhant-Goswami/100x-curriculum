// Runs the Retrieval Bench's Q4 against the real model, the way station 6 sends it: the nearest 3 passages, the same
// prompt, 3 runs without the honest line and 3 with it, each marked by the bench's own Q4 rule.
//   GROQ_API_KEY=gsk_... node _plan/lecture-13/check_q4.mjs      (or put GROQ_API_KEY=... in .env.local)
// Want: without the line the rule fails (it names a lecture); with the line it passes ("not in the notes").
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
let key = process.env.GROQ_API_KEY || '';
const envf = new URL('.env.local', root);
if (!key && existsSync(envf)) { const m = /^GROQ_API_KEY=(.+)$/m.exec(readFileSync(envf, 'utf8')); if (m) key = m[1].trim().replace(/^["']|["']$/g, ''); }
if (!key) { console.error('No key: set GROQ_API_KEY or add it to .env.local'); process.exit(1); }
const { PILE } = await import(new URL('api/_pile.mjs', root));
const page = JSON.parse(readFileSync(new URL('c8/module-2/lecture-13-retrieval-augmented-generation/assets/pile.json', root), 'utf8'));
const bench = readFileSync(new URL('c8/module-2/lecture-13-retrieval-augmented-generation/assets/bench.js', root), 'utf8');
const rule = eval(/Q4: \{[\s\S]*?test: function \(a\) \{\s*return (\/[\s\S]*?\/i)\.test/.exec(bench)[1]);
const HONEST = ' If the passages do not answer it, say it is not in the notes.';
const q = page.questions.find(x => x.id === 'Q4'), v = q.v;
const hits = PILE.chunks.map(c => ({ c, s: c.v.reduce((a, x, d) => a + x * v[d], 0) })).sort((a, b) => b.s - a.s).slice(0, 3);
console.log('Q4:', q.q); hits.forEach(h => console.log('  ' + h.s.toFixed(3) + ' L' + h.c.l + ' ' + h.c.title));
const prompt = honest => 'Answer the question using these passages from our course notes.' + (honest ? HONEST : '') + '\n\n' +
  hits.map((h, i) => '[' + (i + 1) + '] Lecture ' + h.c.l + ', "' + h.c.title + '"\n' + h.c.text + '\n\n').join('') + 'Question: ' + q.q;
for (const honest of [false, true]) {
  let pass = 0;
  for (let n = 1; n <= 3; n++) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt(honest) }] }) });
    const d = await r.json(); const a = d.choices ? d.choices[0].message.content : JSON.stringify(d.error || d);
    const ok = rule.test(a); pass += ok;
    console.log('\n[' + (honest ? 'line on ' : 'line off') + ' run ' + n + '] rule ' + (ok ? 'PASS' : 'FAIL') + '\n' + a.replace(/\s+/g, ' ').slice(0, 300));
    await new Promise(res => setTimeout(res, 2500));
  }
  console.log('\n== line ' + (honest ? 'on' : 'off') + ': ' + pass + ' of 3 pass the rule ==');
}
