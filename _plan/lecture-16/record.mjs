// Lecture 16 Harness Bench: runs the ten questions through the real model with every combination of the four
// switches (reads, asks, remembers, checks) and writes what happened, message by message, to the bench's runs.json.
// The bench replays these recorded runs; nothing on the page is made up.
//
//   node _plan/lecture-16/record.mjs            record every cell not recorded yet (resumes from cache.json)
//   node _plan/lecture-16/record.mjs 0000 A     one cell, printed (switch order: reads asks remembers checks)
//   node _plan/lecture-16/record.mjs build      write runs.json from cache.json without calling the model
//
// Key: GROQ_API_KEY in the environment, or in .env.local here or in ../100x-level-1/100x-curriculum/.env.local.
// Same rules as the other benches: no system prompt, no settings, model openai/gpt-oss-120b, so any request in the
// record can be pasted into the Groq playground.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url), here = new URL('./', import.meta.url);
const P = u => fileURLToPath(u);
const MODEL = 'openai/gpt-oss-120b', GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const RUNS = 1, K = 3, ROUNDS = 3;
const OUT = new URL('c8/module-2/lecture-16-deriving-harness-engineering/assets/runs.json', root);
const CACHE = new URL('cache.json', here);

let key = process.env.GROQ_API_KEY || '';
for (const f of [new URL('.env.local', root), new URL('../100x-level-1/100x-curriculum/.env.local', root)]) {
  if (!key && existsSync(f)) { const m = /^GROQ_API_KEY=(.+)$/m.exec(readFileSync(f, 'utf8')); if (m) key = m[1].trim().replace(/^["']|["']$/g, ''); }
}

const { PILE } = await import(new URL('api/_pile.mjs', root));
const sheet = await import(new URL('api/_sheet.mjs', root));
const QUESTIONS = JSON.parse(readFileSync(new URL('questions.json', here), 'utf8'));

/* ---------- the four parts ---------- */
export const NOTE = 'On Monday the learner said: "I am stuck on Lecture 6."';
const CONTRACT = [
  'Reply in exactly this shape:',
  'ANSWER: one or two sentences',
  'SOURCE: the id of the one thing you used: a passage id like [L4.s02.1], or [note], or [sheet] for a tool result',
  'QUOTE: the exact words copied from that source that hold the answer',
  'If nothing you were given holds the answer, write ANSWER: NOT FOUND and SOURCE: none.'
];
const CONTRACT_TOOL = 'If a tool you have can fetch the answer, ask for it first.';
export const contract = asks => CONTRACT.concat(asks ? [CONTRACT_TOOL] : []).join('\n');
const JUDGE = (q, where, quote, answer) => 'Question: ' + q + '\n\nAnswer given: ' + answer + '\n\nThe answer quotes these words: "' + quote + '"\nThey come from: ' + where +
  '\n\nDo the quoted words, together with where they come from, support the main point of the answer? Reply YES or NO only.';

/* reads: the three passages closest in meaning to the question (the Lecture 13 search) */
const QV = await vectors();
async function vectors() {
  const f = new URL('qvec.json', here);
  let have = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  const miss = QUESTIONS.filter(q => !have[q.q]);
  if (miss.length) {
    const dir = new URL('../lecture-13/', here), inp = P(new URL('qin.json', here)), out = P(new URL('qout.json', here));
    writeFileSync(inp, JSON.stringify(miss.map(q => q.q)));
    execFileSync('node', ['embed.mjs', inp, out], { cwd: P(dir), stdio: ['ignore', 'ignore', 'inherit'] });
    JSON.parse(readFileSync(out, 'utf8')).forEach((v, i) => { have[miss[i].q] = v.map(x => Math.round(x * 1e5) / 1e5); });
    writeFileSync(f, JSON.stringify(have));
  }
  return have;
}
export function nearest(q, k) {
  const v = QV[q];
  return PILE.chunks.map(c => ({ c, s: c.v.reduce((a, x, d) => a + x * v[d], 0) })).sort((a, b) => b.s - a.s).slice(0, k)
    .map(h => ({ id: h.c.id, lecture: h.c.l, title: h.c.title, text: h.c.text, score: Math.round(h.s * 1000) / 1000 }));
}

/* asks: the Lecture 11 tool, with the card that ships as the bench's default */
const SRC = sheet.source('', '');
const CARD = sheet.tool(SRC);
const TOOL = { type: 'function', function: { name: CARD.name, description: CARD.description, parameters: CARD.inputSchema } };

/* checks: two by rule (plain code), one by judgment (a second, separate call to the model) */
const norm = s => String(s).toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
export function parse(reply) {
  const g = re => { const m = re.exec(reply || ''); return m ? m[1].trim() : ''; };
  return {
    answer: g(/ANSWER:\s*([\s\S]*?)(?=\n\s*SOURCE:|$)/i),
    source: g(/SOURCE:\s*([^\n]*)/i).replace(/^[\[\s]+|[\]\s.]+$/g, ''),
    quote: g(/QUOTE:\s*([\s\S]*)$/i).replace(/^["“'\s]+|["”'\s]+$/g, '')
  };
}
function ruleCheck(p, sources) {
  if (!p.answer || !p.source) return 'The reply is not in the agreed shape (ANSWER, SOURCE, QUOTE).';
  if (/^not found\b/i.test(p.answer)) return '';
  if (/^none$/i.test(p.source)) return 'The answer names no source.';
  const src = sources[p.source.toLowerCase()];
  if (!src) return 'SOURCE says [' + p.source + '], which was never sent to you.';
  if (!p.quote) return 'There is no QUOTE.';
  /* a quote may skip words with "..." or give two quoted pieces: every piece must be in the source */
  const pieces = norm(p.quote).split(/\s*(?:\.\.\.|…|["”]\s*(?:and|,|;)\s*["“])\s*/).map(x => x.replace(/^["“\s]+|["”\s]+$/g, '')).filter(x => x.length > 2);
  const text = norm(src);
  if (!pieces.length || !pieces.every(x => text.includes(x))) return 'The QUOTE is not in [' + p.source + '] word for word.';
  return '';
}

async function call(sent) {
  for (let tries = 0; ; tries++) {
    const res = await fetch(GROQ, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(sent) });
    let data = null; try { data = await res.json(); } catch (e) { /* handled below */ }
    if (res.status === 429 && tries < 8) { const w = Math.ceil(+res.headers.get('retry-after') || 8); process.stderr.write(' [wait ' + w + 's]'); await new Promise(r => setTimeout(r, w * 1000 + 400)); continue; }
    if (res.status === 400 && data && data.error && data.error.code === 'tool_use_failed') return { raw: { role: 'assistant', content: '', failed: String(data.error.failed_generation || data.error.message) }, usage: null };
    if (res.status !== 200 || !data || !data.choices) { if (tries < 3) { await new Promise(r => setTimeout(r, 3000)); continue; } throw new Error('Groq ' + res.status + ' ' + JSON.stringify(data && data.error)); }
    const m = data.choices[0].message || {};
    return { raw: { role: 'assistant', content: m.content || '', tool_calls: m.tool_calls }, usage: data.usage || null };
  }
}

/* ---------- the harness: one question in, a record of everything that crossed out ---------- */
export async function harness(question, sw) {
  const ev = [], sources = {}, where = {}, usage = { in: 0, out: 0, calls: 0 };
  const count = u => { usage.calls++; if (u) { usage.in += u.prompt_tokens || 0; usage.out += u.completion_tokens || 0; } };
  const parts = [];
  if (sw.reads) {
    const hits = nearest(question, K);
    ev.push({ k: 'search', hits: hits.map(h => ({ id: h.id, lecture: h.lecture, title: h.title, score: h.score })) });
    hits.forEach(h => { sources[h.id.toLowerCase()] = h.text; where[h.id.toLowerCase()] = 'our course notes, Lecture ' + h.lecture + ', section "' + h.title + '"'; });
    parts.push('Passages from our course notes:\n\n' + hits.map(h => '[' + h.id + '] Lecture ' + h.lecture + ', "' + h.title + '"\n' + h.text).join('\n\n'));
  }
  if (sw.remembers) { sources.note = NOTE; where.note = 'a note the server saved from an earlier conversation with this learner'; ev.push({ k: 'memory', note: NOTE }); parts.push('Saved note from an earlier conversation with this learner:\n[note] ' + NOTE); }
  const bare = !parts.length && !sw.checks;
  parts.push(bare ? question : 'Question: ' + question);
  if (sw.checks) parts.push(contract(sw.asks));
  const messages = [{ role: 'user', content: parts.join('\n\n') }];

  /* one answer from the model, running the tool for it if it asks */
  async function answer() {
    for (let n = 0; n < ROUNDS; n++) {
      const sent = { model: MODEL, messages: messages.slice() };
      if (sw.asks) sent.tools = [TOOL];
      ev.push({ k: 'req', body: n === 0 && messages.length === 1 ? sent : { model: MODEL, messages: [messages[messages.length - 1]], more: messages.length - 1, tools: sent.tools ? ['get_lecture'] : undefined } });
      const r = await call(sent); count(r.usage);
      const c = (r.raw.tool_calls || [])[0];
      if (r.raw.failed) { ev.push({ k: 'res', text: '', failed: r.raw.failed }); return ''; }
      if (!c) { ev.push({ k: 'res', text: r.raw.content }); messages.push({ role: 'assistant', content: r.raw.content }); return r.raw.content; }
      let args = c.function.arguments; try { args = JSON.parse(args); } catch (e) { /* as written */ }
      ev.push({ k: 'ask', name: c.function.name, args });
      messages.push({ role: 'assistant', content: r.raw.content || null, tool_calls: [{ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } }] });
      let result;
      if (c.function.name !== TOOL.function.name) result = { error: 'No tool called ' + c.function.name + '.' };
      else { const out = await sheet.run(SRC, args); result = out.result; }
      const text = JSON.stringify(result);
      sources.sheet = (sources.sheet ? sources.sheet + '\n' : '') + text;
      where.sheet = 'the curriculum sheet, the row returned for ' + c.function.name + '(' + JSON.stringify(args) + ')';
      ev.push({ k: 'tool', result });
      messages.push({ role: 'tool', tool_call_id: c.id, content: text });
    }
    ev.push({ k: 'note', text: 'Stopped after ' + ROUNDS + ' rounds. The code decides when the loop ends.' });
    return '';
  }

  let reply = await answer();
  if (!sw.checks) return { ev, usage, sent: reply, held: false };

  for (let attempt = 0; attempt < 2; attempt++) {
    const p = parse(reply);
    let fail = ruleCheck(p, sources), by = 'rule';
    if (!fail && /^not found\b/i.test(p.answer)) { ev.push({ k: 'check', by: 'rule', ok: true, text: 'The model said NOT FOUND. Nothing is sent as an answer.' }); return { ev, usage, sent: '', held: true, why: 'notfound' }; }
    if (!fail) {
      ev.push({ k: 'check', by: 'rule', ok: true, text: 'Shape is right, [' + p.source + '] was sent, and the quote is in it word for word.' });
      const jsent = { model: MODEL, messages: [{ role: 'user', content: JUDGE(question, where[p.source.toLowerCase()], p.quote, p.answer) }] };
      ev.push({ k: 'req', body: jsent, judge: true });
      const j = await call(jsent); count(j.usage);
      ev.push({ k: 'res', text: j.raw.content, judge: true });
      const yes = /^\W*yes\b/i.test(j.raw.content || '');
      ev.push({ k: 'check', by: 'judgment', ok: yes, text: yes ? 'A second call read the quote and said YES, it supports the answer.' : 'A second call read the quote and said NO, it does not support the answer.' });
      if (yes) return { ev, usage, sent: p.answer, held: false, source: p.source, quote: p.quote };
      fail = 'A second reader said the quoted words do not support that answer.'; by = 'judgment';
    } else ev.push({ k: 'check', by: 'rule', ok: false, text: fail });
    if (attempt === 1) break;
    const back = 'Check failed: ' + fail + ' Answer again in the same shape, or write ANSWER: NOT FOUND and SOURCE: none.';
    ev.push({ k: 'back', text: back, by });
    messages.push({ role: 'user', content: back });
    reply = await answer();
  }
  ev.push({ k: 'note', text: 'Two tries, both failed a check. Stopped: nothing is sent, the question goes to a person.' });
  return { ev, usage, sent: '', held: true, why: 'failed' };
}

/* ---------- marking: visible rules, never a model ---------- */
const NOT_THERE = /\bnot (in|covered|mentioned|shown|part of|included)\b|\bno lecture\b|\bnone of the (passages|lectures|notes)\b|\b(do|does)(n't| not) (mention|cover|show|include|appear|contain|say|address)\b|\bno (information|mention)\b|\bnot found\b/i;
export function mark(q, r) {
  if (q.id === 'X') return r.held || (NOT_THERE.test(r.sent) && !/\b(it is|it's|that is|that's)\s+lecture\s*\d/i.test(r.sent)) ? 'right' : 'wrong';
  if (r.held) return 'held';
  return new RegExp(q.right, 'i').test(r.sent.replace(/[*_`]/g, '')) ? 'right' : 'wrong';
}

/* ---------- run ---------- */
const SW = ['reads', 'asks', 'remembers', 'checks'];
const bits = s => Object.fromEntries(SW.map((k, i) => [k, s[i] === '1']));
const ALL = Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, '0'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

function build() {
  const runs = {};
  for (const s of ALL) for (const q of QUESTIONS) { const c = cache[s + '|' + q.id + '|0']; if (c) (runs[s] = runs[s] || {})[q.id] = Object.assign({ mark: mark(q, c) }, c); }
  const out = {
    recorded: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }), model: MODEL, switches: SW, note: NOTE, contract: contract(true),
    tool: TOOL, questions: QUESTIONS.map(q => ({ id: q.id, q: q.q, needs: q.needs, want: q.want })), runs
  };
  writeFileSync(OUT, JSON.stringify(out));
  const line = s => QUESTIONS.map(q => ({ right: '✓', wrong: '✗', held: '·' })[(runs[s] || {})[q.id] ? runs[s][q.id].mark : ''] || '?').join(' ');
  console.log('      ' + QUESTIONS.map(q => q.id).join(' ') + '   right wrong held  tokens');
  for (const s of ALL) { const m = QUESTIONS.map(q => (runs[s] || {})[q.id]).filter(Boolean); const n = k => m.filter(x => x.mark === k).length;
    console.log(s + '  ' + line(s) + '     ' + n('right') + '     ' + n('wrong') + '    ' + n('held') + '   ' + m.reduce((a, x) => a + x.usage.in + x.usage.out, 0)); }
  console.log('wrote', P(OUT), Math.round(JSON.stringify(out).length / 1024) + ' KB');
}

const [, , a1, a2] = process.argv;
if (a1 === 'build') build();
else if (a1 && a2) {
  if (!key) { console.error('No key'); process.exit(1); }
  const q = QUESTIONS.find(x => x.id === a2), r = await harness(q.q, bits(a1));
  for (const e of r.ev) console.log('\n--', e.k, e.judge ? '(judge)' : '', '\n' + (e.k === 'req' ? e.body.messages.map(m => m.content).join('\n') : JSON.stringify(e, null, 1)).slice(0, 2500));
  console.log('\n== sent:', JSON.stringify(r.sent), 'held:', r.held, 'mark:', mark(q, r), JSON.stringify(r.usage));
} else {
  if (!key) { console.error('No key'); process.exit(1); }
  const only = a1 ? [a1] : ALL;
  for (const s of only) for (const q of QUESTIONS) for (let n = 0; n < RUNS; n++) {
    const id = s + '|' + q.id + '|' + n;
    if (cache[id]) continue;
    process.stderr.write(id);
    try { const r = await harness(q.q, bits(s)); cache[id] = r; writeFileSync(CACHE, JSON.stringify(cache)); process.stderr.write(' ' + mark(q, r) + '\n'); }
    catch (e) { process.stderr.write(' ERROR ' + e.message + '\n'); }
    await new Promise(r => setTimeout(r, 600));
  }
  build();
}
