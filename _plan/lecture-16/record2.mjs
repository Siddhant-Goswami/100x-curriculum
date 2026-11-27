// One recorder for Lectures 15 and 16. It asks the 100x brain's questions under every combination of four switches
// and keeps everything that crossed. The Harness Bench (Lecture 16) replays all sixteen settings. The Lecture 15
// score table (the LLM alone, search, the brain) is three of those settings, so both days show the same runs.
//
//   node _plan/lecture-16/record2.mjs                 record every cell not recorded yet, then build
//   node _plan/lecture-16/record2.mjs 0110            one setting (switch order: reads asks remembers checks)
//   node _plan/lecture-16/record2.mjs 0110 S1         one cell, printed, not kept
//   node _plan/lecture-16/record2.mjs build           write the bench's files from the cache, calling nothing
//
// Env: GROQ_API_KEY (or .env.local), BRAIN_REPO (default ../100x-brain), RUNS (3), CONC (cells at once, 1),
//      TODAY (the date line the system is given; default: today in India).
// Same rules as every bench: model openai/gpt-oss-120b on Groq, no system prompt, no settings.
// The brain's tools are run by the same code that serves /api/brain (imported here, so recording adds nothing to
// the live address's log).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

const root = new URL('../../', import.meta.url), here = new URL('./', import.meta.url);
const P = u => fileURLToPath(u);
const CLAUDE = process.env.BACKEND === 'claude', CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'haiku', BRAIN_MCP = process.env.BRAIN_MCP || 'http://127.0.0.1:8792/api/brain';
let MODEL = CLAUDE ? 'claude ' + CLAUDE_MODEL + ' (test run through Claude Code)' : 'openai/gpt-oss-120b';
const GROQ = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const RUNS = +(process.env.RUNS || 3), CONC = +(process.env.CONC || 1), ROUNDS = 8;
const BRAIN_REPO = new URL((process.env.BRAIN_REPO || '../100x-brain').replace(/\/?$/, '/'), root);
const OUT = new URL('c8/module-2/lecture-16-deriving-harness-engineering/assets/runs/', root);
const CACHE = new URL(CLAUDE ? 'cache2-claude-' + CLAUDE_MODEL + '/' : 'cache2/', here);
mkdirSync(P(CACHE), { recursive: true });

let key = process.env.GROQ_API_KEY || '';
for (const f of [new URL('.env.local', root), new URL('../100x-level-1/100x-curriculum/.env.local', root)]) {
  if (!key && existsSync(f)) { const m = /^GROQ_API_KEY=(.+)$/m.exec(readFileSync(f, 'utf8')); if (m) key = m[1].trim().replace(/^["']|["']$/g, ''); }
}

/* ---------- what the questions are, and what is true ---------- */
const TODAY = process.env.TODAY || new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(',', '');
const BASE = JSON.parse(readFileSync(new URL('eval/questions.json', BRAIN_REPO), 'utf8'));
const PASSAGES = JSON.parse(readFileSync(new URL('eval/passages.json', BRAIN_REPO), 'utf8'));
const BRAIN_COMMIT = execFileSync('git', ['-C', P(BRAIN_REPO), 'rev-parse', '--short', 'HEAD']).toString().trim();

/* the learner whose system this is: three small files, the shape of the my-brain template */
export const FILES = {
  'me.md': '# Me\n\n## My North Star\n\nBy May 2027, I am an automation consultant with three paying clients.\n\n## Right now\n\n- My track in Cohort 8: no-code',
  'told.md': '# Things I told it\n\n- 2026-11-23 · I am stuck on Lecture 6. (told by me)',
  'now.md': '# Now\n\nToday is ' + TODAY + '.\n\n- This week\'s one job for my brain: keep me up to date on the course, for my North Star.'
};
/* On the bench the system belongs to one learner, so three questions about that learner have answers.
   In the shared 100x brain (the Lecture 15 table) the right answer to the same questions is "not known". */
/* "Lectures 3, 10 and 11" names Lecture 10 as surely as "Lecture 10" does: the brain's own patterns miss the list form */
const L = n => '\\blectures?\\b[^.\\n]{0,40}\\b0?' + n + '\\b(?!\\d)';
const LISTS = { S2: ['golden pair', 'golden set', L(10), L(14)], S4: [L(9), L(10), L(11)] };
const MINE = {
  H: { want: 'Lecture 6', right: ['\\blecture\\s+#?0?(6|six)\\b(?![\\d-])'], wrongIf: '', group: 'about me' },
  N: { want: 'By May 2027, an automation consultant with three paying clients', right: ['automation consultant|three paying clients'], wrongIf: '', group: 'about me' },
};
const EXTRA = [{ id: 'I', group: 'about me', q: 'What date was the lecture I said I was stuck on?', want: 'Sat 10 Oct 2026',
  right: ['\\b10(st|nd|rd|th)?\\s*(of\\s*)?oct|oct\\w*\\s*10\\b'], wrongIf: '', shared: { want: 'Not known: this brain knows the course, not you', right: 'NOT_KNOWN', wrongIf: '\\boct' } }];
export const QUESTIONS = BASE.map(q => LISTS[q.id] ? Object.assign({}, q, { right: LISTS[q.id] }) : q).map(q => MINE[q.id] ? Object.assign({}, q, MINE[q.id], { shared: { want: q.want, right: q.right, wrongIf: q.wrongIf } }) : q).concat(EXTRA);

/* ---------- the parts ---------- */
const SHORT = 'Answer in a few short sentences.';
const CONTRACT = asks => [
  'Reply in exactly this shape:',
  'ANSWER: a few short sentences',
  'SOURCE: the one thing you used, in square brackets: a passage like [P2], a file like [told.md], or a page path like [wiki/lectures/lecture-14.md]',
  'QUOTE: the exact words copied from that source that hold the answer. If the answer needs several lines, copy each one, with ... between them',
  'If nothing you were given holds the answer, write ANSWER: NOT KNOWN and SOURCE: none.'
].concat(asks ? ['If a tool you have can fetch the answer, ask for it first.'] : []).join('\n');
const JUDGE = (q, where, quote, answer) => 'Question: ' + q + '\n\nAnswer given: ' + answer + '\n\nThe answer quotes these words: "' + quote + '"\nThey come from: ' + where +
  '\n\nDo the quoted words, together with where they come from, support the main point of the answer? Reply YES or NO only.';

/* asks: the brain's three tools, run by the code behind /api/brain */
const brainRoute = await import(new URL('api/brain.mjs', root));
let rpcId = 0;
async function brain(method, params) {
  const r = await brainRoute.handle(new Request('http://localhost/api/brain', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'x-forwarded-for': 'recorder-' + (rpcId % 50) },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params: params || {} }) }));
  const out = JSON.parse(await r.text());
  if (out.error) throw new Error('brain: ' + JSON.stringify(out.error));
  return out.result;
}
const quiet = console.log; console.log = () => {};   /* the route logs empty searches for the live gaps feed; not ours */
const INIT = await brain('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'bench-recorder', version: '2' } });
const TOOLS = (await brain('tools/list')).tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
const BRAIN_RULES = INIT.instructions;

/* checks */
const plain = s => String(s).replace(/\]\([^)]*\)/g, ']').replace(/[*_`\[\]]/g, '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
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
  if (/^not known\b/i.test(p.answer)) return '';
  if (/^none$/i.test(p.source)) return 'The answer names no source.';
  const k = Object.keys(sources).find(x => x.toLowerCase() === p.source.toLowerCase().replace(/#.*$/, ''));
  if (!k) return 'SOURCE says [' + p.source + '], which was never given to you.';
  if (!p.quote) return 'There is no QUOTE.';
  const pieces = plain(p.quote).split(/\s*(?:\.\.\.|…|"\s*(?:and|,|;)\s*")\s*/).map(x => x.replace(/^["\s]+|["\s]+$/g, '')).filter(x => x.length > 2);
  const text = plain(sources[k]);
  if (!pieces.length || !pieces.every(x => text.includes(x))) return 'The QUOTE is not in [' + k + '] word for word.';
  return '';
}

async function call(sent) {
  for (let tries = 0; ; tries++) {
    let res, data = null;
    try { res = await fetch(GROQ, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(sent) }); try { data = await res.json(); } catch (e) { /* below */ } }
    catch (e) { if (tries < 6) { await new Promise(r => setTimeout(r, 3000)); continue; } throw e; }
    if (res.status === 429 && tries < 40) { const w = Math.min(90, Math.ceil(+res.headers.get('retry-after') || 8)); await new Promise(r => setTimeout(r, w * 1000 + 400)); continue; }
    if (res.status === 413 || (data && data.error && /too large/i.test(data.error.message || ''))) return { raw: { content: '', refused: (data.error && data.error.message) || 'Request too large' }, usage: null };
    if (res.status === 400 && data && data.error && data.error.code === 'tool_use_failed') return { raw: { content: '', failed: String(data.error.failed_generation || data.error.message) }, usage: null };
    if (res.status !== 200 || !data || !data.choices) { if (tries < 4) { await new Promise(r => setTimeout(r, 3000)); continue; } throw new Error('Groq ' + res.status + ' ' + JSON.stringify(data && data.error)); }
    const m = data.choices[0].message || {};
    return { raw: { content: m.content || '', tool_calls: m.tool_calls }, usage: data.usage || null };
  }
}

/* ---------- a second backend, for testing the idea without Groq: Claude through the local Claude Code CLI ----------
   Claude Code runs the tool loop itself and reaches the brain over MCP at BRAIN_MCP (run _plan/serve.py on that port).
   It is not a bare model: Claude Code adds a short system text of its own. Good enough to test the bench, not to teach from. */
const CWD = CLAUDE ? mkdtempSync(tmpdir() + '/bench-') : '';
const MCP_CFG = JSON.stringify({ mcpServers: { brain: { type: 'http', url: BRAIN_MCP } } });
function claudeTurn(prompt, tools, resume) {
  const args = ['-p', prompt, '--model', CLAUDE_MODEL, '--system-prompt', '', '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--disable-slash-commands', '--output-format', 'stream-json', '--verbose'];
  if (tools) args.push('--mcp-config', MCP_CFG, '--allowedTools', 'mcp__brain__read_index,mcp__brain__open_page,mcp__brain__search');
  if (resume) args.push('--resume', resume);
  return new Promise((resolve, reject) => {
    execFile('claude', args, { cwd: CWD, maxBuffer: 1 << 28, timeout: 300000 }, (err, stdout) => {
      const out = { text: '', steps: [], usage: { in: 0, out: 0, calls: 0 }, session: '' }, names = {};
      for (const line of String(stdout || '').split('\n')) {
        let d; try { d = JSON.parse(line); } catch (e) { continue; }
        if (d.type === 'system' && d.subtype === 'init') { out.session = d.session_id; if (d.model) MODEL = d.model + ' (test run through Claude Code)'; }
        else if (d.type === 'assistant') for (const b of d.message.content || []) {
          if (b.type === 'text' && b.text.trim()) out.steps.push({ k: 'say', text: b.text });
          if (b.type === 'tool_use') { names[b.id] = { name: b.name.replace(/^mcp__brain__/, ''), args: b.input || {} }; out.steps.push({ k: 'ask', name: names[b.id].name, args: names[b.id].args }); }
        }
        else if (d.type === 'user') for (const b of (d.message && Array.isArray(d.message.content) ? d.message.content : [])) {
          if (b.type === 'tool_result') { const c = b.content; out.steps.push({ k: 'tool', of: names[b.tool_use_id], text: Array.isArray(c) ? c.map(x => x.text || '').join('\n') : String(c || '') }); }
        }
        else if (d.type === 'result') { out.text = d.result || ''; const u = d.usage || {}; out.usage = { in: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), out: u.output_tokens || 0, calls: d.num_turns || 1 }; }
      }
      if (!out.session && err) return reject(new Error('claude: ' + String(err.message).slice(0, 200)));
      resolve(out);
    });
  });
}

/* ---------- the harness: one question in, everything that crossed out ---------- */
export async function harness(q, sw) {
  const ev = [], sources = {}, where = {}, usage = { in: 0, out: 0, calls: 0 };
  const count = u => { usage.calls++; if (u) { usage.in += u.prompt_tokens || 0; usage.out += u.completion_tokens || 0; } };
  const parts = [];
  if (sw.remembers) {
    ev.push({ k: 'memory', files: Object.keys(FILES) });
    for (const f in FILES) { sources[f] = FILES[f]; where[f] = 'the learner\'s own file ' + f + ', kept from earlier and read first on every call'; }
    parts.push('Files this person keeps, read first on every call:\n\n' + Object.keys(FILES).map(f => '[' + f + ']\n' + FILES[f]).join('\n\n'));
  }
  if (sw.reads) {
    const hits = PASSAGES.top3[q.id] || [];
    ev.push({ k: 'search', hits: hits.map((h, i) => ({ id: 'P' + (i + 1), at: h.id, score: h.score })) });
    hits.forEach((h, i) => { sources['P' + (i + 1)] = h.text; where['P' + (i + 1)] = 'the course pages, ' + h.id; });
    parts.push('Passages found by search in the 100xEngineers Cohort 8 course pages:\n\n' + hits.map((h, i) => '[P' + (i + 1) + '] ' + h.id + '\n' + h.text).join('\n\n'));
  }
  if (sw.asks) parts.push('You have tools to look things up. ' + BRAIN_RULES);
  const bare = !parts.length && !sw.checks;
  parts.push(bare ? q.q : 'Question: ' + q.q + '\n\n' + SHORT);
  if (sw.checks) parts.push(CONTRACT(sw.asks));
  const messages = [{ role: 'user', content: parts.join('\n\n') }];

  let session = '';
  const noteTool = (name, args, text) => {
    const id = name === 'read_index' ? 'index.md' : name === 'open_page' ? String(args && args.path || '').replace(/^\.?\//, '').replace(/#.*$/, '') : 'search';
    sources[id] = (sources[id] ? sources[id] + '\n' : '') + text;
    where[id] = id === 'search' ? 'a search of the 100x brain' : 'the 100x brain, page ' + id + (args && args.section ? ', section "' + args.section + '"' : '');
    ev.push({ k: 'tool', id, text });
  };
  async function answer() {
    if (CLAUDE) {
      const last = messages[messages.length - 1];
      ev.push({ k: 'req', text: last.content, role: 'user', first: messages.length === 1, tools: sw.asks ? TOOLS.map(t => t.function.name) : undefined });
      const r = await claudeTurn(last.content, sw.asks, session); session = r.session;
      usage.calls += r.usage.calls; usage.in += r.usage.in; usage.out += r.usage.out;
      for (const st of r.steps) { if (st.k === 'ask') ev.push({ k: 'ask', name: st.name, args: st.args }); else if (st.k === 'tool' && st.of) noteTool(st.of.name, st.of.args, st.text); }
      ev.push({ k: 'res', text: r.text }); messages.push({ role: 'assistant', content: r.text });
      return r.text;
    }
    for (let n = 0; n < ROUNDS; n++) {
      const sent = { model: MODEL, messages: messages.slice() };
      if (sw.asks) sent.tools = TOOLS;
      ev.push({ k: 'req', text: messages[messages.length - 1].content, role: messages[messages.length - 1].role, first: messages.length === 1, tools: sw.asks ? TOOLS.map(t => t.function.name) : undefined });
      const r = await call(sent); count(r.usage);
      if (r.raw.refused) { ev.push({ k: 'res', text: '', refused: r.raw.refused }); return ''; }
      if (r.raw.failed) { ev.push({ k: 'res', text: '', failed: r.raw.failed }); return ''; }
      const calls = (r.raw.tool_calls || []).slice(0, 3);
      if (!calls.length) { ev.push({ k: 'res', text: r.raw.content }); messages.push({ role: 'assistant', content: r.raw.content }); return r.raw.content; }
      messages.push({ role: 'assistant', content: r.raw.content || '', tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } })) });
      for (const c of calls) {
        let args = c.function.arguments; try { args = JSON.parse(args || '{}'); } catch (e) { /* as written */ }
        ev.push({ k: 'ask', name: c.function.name, args });
        let text;
        try { const res = await brain('tools/call', { name: c.function.name, arguments: args && typeof args === 'object' ? args : {} }); text = (res.content || []).map(x => x.text || '').join('\n'); }
        catch (e) { text = 'Error: ' + e.message; }
        const id = c.function.name === 'read_index' ? 'index.md' : c.function.name === 'open_page' ? String(args && args.path || '').replace(/^\.?\//, '').replace(/#.*$/, '') : 'search';
        sources[id] = (sources[id] ? sources[id] + '\n' : '') + text;
        where[id] = id === 'search' ? 'a search of the 100x brain' : 'the 100x brain, page ' + id + (args && args.section ? ', section "' + args.section + '"' : '');
        ev.push({ k: 'tool', id, text });
        messages.push({ role: 'tool', tool_call_id: c.id, content: text });
      }
    }
    ev.push({ k: 'note', text: 'Stopped after ' + ROUNDS + ' rounds. The code decides when the loop ends.' });
    return '';
  }

  let reply = await answer();
  if (!sw.checks) return { ev, usage, sent: reply, held: false };
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = parse(reply);
    let fail = ruleCheck(p, sources), by = 'rule';
    if (!fail && /^not known\b/i.test(p.answer)) { ev.push({ k: 'check', by: 'rule', ok: true, text: 'The LLM said NOT KNOWN. Nothing is sent as an answer.' }); return { ev, usage, sent: '', held: true, why: 'notknown' }; }
    if (!fail) {
      const src = Object.keys(sources).find(x => x.toLowerCase() === p.source.toLowerCase().replace(/#.*$/, ''));
      ev.push({ k: 'check', by: 'rule', ok: true, text: 'The shape is right, [' + src + '] was really given, and the quote is in it word for word.' });
      const jsent = { model: MODEL, messages: [{ role: 'user', content: JUDGE(q.q, where[src], p.quote, p.answer) }] };
      ev.push({ k: 'req', text: jsent.messages[0].content, judge: true });
      let j;
      if (CLAUDE) { const r = await claudeTurn(jsent.messages[0].content, false, ''); usage.calls += r.usage.calls; usage.in += r.usage.in; usage.out += r.usage.out; j = { raw: { content: r.text } }; }
      else { j = await call(jsent); count(j.usage); }
      ev.push({ k: 'res', text: j.raw.content, judge: true });
      const yes = /^\W*yes\b/i.test(j.raw.content || '');
      ev.push({ k: 'check', by: 'judgment', ok: yes, text: yes ? 'A second call read the quote and said YES, it supports the answer.' : 'A second call read the quote and said NO, it does not support the answer.' });
      if (yes) return { ev, usage, sent: p.answer, held: false, source: src, quote: p.quote };
      fail = 'A second reader said the quoted words do not support that answer.'; by = 'judgment';
    } else ev.push({ k: 'check', by: 'rule', ok: false, text: fail });
    if (attempt === 1) break;
    const back = 'Check failed: ' + fail + ' Answer again in the same shape, or write ANSWER: NOT KNOWN and SOURCE: none.';
    ev.push({ k: 'back', text: back, by });
    messages.push({ role: 'user', content: back });
    reply = await answer();
  }
  ev.push({ k: 'note', text: 'Two tries, both failed a check. Stopped: nothing is sent, and the question goes to a person.' });
  return { ev, usage, sent: '', held: true, why: 'failed' };
}

/* ---------- marking: the brain's own rules (eval/score.py), plus one more outcome ---------- */
const NOT_KNOWN = new RegExp("not known|not (in|part of|covered in|mentioned in|found in) (the|our|this|any|my)|no (record|information|mention|lecture|way)|" +
  "(do|does|did)(n't| not) (know|have|hold|say|mention|cover|show|contain|include|teach)|(can|could)(not|n't| not) (find|tell|answer|know|see)|" +
  "(isn't|is not|aren't|are not) (covered|in|mentioned|known|part)|not found|don't know|none of the", 'i');
const ASKS_BACK = /not sure which|could you (please )?(let me know|tell me|share|clarify|provide|remind)|which (course|class|program|programme|syllabus)|can you (tell|share|clarify)/i;
const rightBy = (rule, a) => {
  if (rule.wrongIf && new RegExp(rule.wrongIf, 'i').test(a)) return false;
  if (rule.right === 'NOT_KNOWN') return NOT_KNOWN.test(a);
  return rule.right.every(p => new RegExp(p, 'i').test(a));
};
/* bench: right, wrong (an answer went out and it was not right), or none (it said it did not know, asked back, or was held) */
/* an answer that opens by saying it does not know is that, whatever page names follow */
const leadsNotKnown = a => NOT_KNOWN.test((/^[\s\S]{15,}?[.!?](\s|$)/.exec(a) || [a])[0].slice(0, 200));
export function mark(q, r) {
  const a = (r.sent || '').replace(/[*_`]/g, '');
  if (q.right === 'NOT_KNOWN') return r.held || leadsNotKnown(a) || rightBy(q, a) ? 'right' : 'wrong';
  if (r.held) return 'none';
  if (rightBy(q, a)) return 'right';
  return !a.trim() || NOT_KNOWN.test(a) || ASKS_BACK.test(a) ? 'none' : 'wrong';
}
/* the shared brain's own mark (Lecture 15 table): questions about the person must come back "not known" */
export const markShared = (q, r) => { const a = (r.sent || '').replace(/[*_`]/g, ''), rule = q.shared || q; return rule.right === 'NOT_KNOWN' ? leadsNotKnown(a) || rightBy(rule, a) : rightBy(rule, a); };
const majority = marks => { const n = k => marks.filter(x => x === k).length; return n('right') * 2 > marks.length ? 'right' : n('wrong') >= n('none') ? 'wrong' : 'none'; };

/* ---------- run ---------- */
const SW = ['reads', 'asks', 'remembers', 'checks'];
const bits = s => Object.fromEntries(SW.map((k, i) => [k, s[i] === '1']));
const ALL = Array.from({ length: 16 }, (_, i) => i.toString(2).padStart(4, '0'));
const ORDER = ['0000', '1000', '0100', '0110', '1110', '1111', '0111', '1011', '1101', '1100', '1010', '0010', '0001', '1001', '0101', '0011'];
const cellFile = (s, id, n) => new URL(s + '-' + id + '-' + n + '.json', CACHE);
const load = (s, id, n) => { const f = cellFile(s, id, n); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };

function build() {
  mkdirSync(P(OUT), { recursive: true });
  const summary = { recorded: TODAY, model: MODEL, brain: BRAIN_COMMIT, runs: RUNS, switches: SW, files: FILES, tools: TOOLS.map(t => ({ name: t.function.name, description: t.function.description })),
    questions: QUESTIONS.map(q => ({ id: q.id, group: q.group, q: q.q, want: q.want })), cells: {} };
  const shared = {};
  for (const s of ALL) {
    const texts = {}, keep = t => { if (typeof t !== 'string' || t.length < 400) return t; const h = createHash('sha1').update(t).digest('hex').slice(0, 10); texts[h] = t; return { $t: h }; };
    const cells = {}; let full = true;
    for (const q of QUESTIONS) {
      const runs = []; for (let n = 0; n < RUNS; n++) { const r = load(s, q.id, n); if (r) runs.push(r); }
      if (runs.length < RUNS) { full = false; continue; }
      const marks = runs.map(r => mark(q, r)), m = majority(marks), show = Math.max(0, marks.indexOf(m)), r = runs[show];
      cells[q.id] = { mark: m, marks, shown: show, held: r.held, sent: keep(r.sent), ev: r.ev.map(e => Object.assign({}, e, e.text != null ? { text: keep(e.text) } : {})) };
      (summary.cells[s] = summary.cells[s] || {})[q.id] = { mark: m, n: marks.filter(x => x === m).length, tokens: Math.round(runs.reduce((a, x) => a + x.usage.in + x.usage.out, 0) / runs.length), calls: Math.round(runs.reduce((a, x) => a + x.usage.calls, 0) / runs.length * 10) / 10 };
      (shared[s] = shared[s] || {})[q.id] = runs.filter(x => markShared(q, x)).length * 2 > runs.length;
    }
    if (Object.keys(cells).length) writeFileSync(new URL(s + '.json', OUT), JSON.stringify({ setting: s, cells, texts }));
    if (!full && summary.cells[s]) summary.cells[s].$partial = true;
  }
  writeFileSync(new URL('index.json', OUT), JSON.stringify(summary));
  /* the Lecture 15 table: three of the sixteen settings, marked the shared brain's way */
  const L15 = { '0000': 'The LLM alone', '1000': 'Search: top 3 passages', '0100': 'The brain: index, pages, search' };
  writeFileSync(new URL('lecture-15-table.json', here), JSON.stringify({ recorded: TODAY, model: MODEL, runs: RUNS, ways: L15, right: Object.fromEntries(Object.keys(L15).map(s => [s, shared[s] || {}])) }, null, 1));
  const sym = { right: '✓', wrong: '✗', none: '·' };
  quiet('      ' + QUESTIONS.map(q => q.id.padEnd(2)).join(' ') + '   right wrong none  tokens');
  for (const s of ALL) { const c = summary.cells[s] || {}, m = QUESTIONS.map(q => c[q.id]); const n = k => m.filter(x => x && x.mark === k).length;
    quiet(s + '  ' + m.map(x => (x ? sym[x.mark] : '?').padEnd(2)).join(' ') + '    ' + String(n('right')).padStart(2) + '    ' + String(n('wrong')).padStart(2) + '   ' + String(n('none')).padStart(2) + '   ' + m.reduce((a, x) => a + (x ? x.tokens : 0), 0)); }
  quiet('shared-brain marks (Lecture 15 table): ' + Object.keys(L15).map(s => L15[s] + ' ' + Object.values(shared[s] || {}).filter(Boolean).length + '/' + Object.keys(shared[s] || {}).length).join(' · '));
}

const [, , a1, a2] = process.argv;
if (a1 === 'build') build();
else if (a1 && a2) {
  if (!key && !CLAUDE) { console.error('No key'); process.exit(1); }
  const q = QUESTIONS.find(x => x.id === a2), r = await harness(q, bits(a1));
  for (const e of r.ev) quiet('\n-- ' + e.k + (e.judge ? ' (second reader)' : '') + '\n' + (e.text != null ? String(e.text) : JSON.stringify(e)).slice(0, 1800));
  quiet('\n== sent: ' + JSON.stringify(r.sent) + ' held: ' + r.held + ' mark: ' + mark(q, r) + ' ' + JSON.stringify(r.usage));
} else {
  if (!key && !CLAUDE) { console.error('No key'); process.exit(1); }
  const todo = [];
  for (const s of (a1 ? [a1] : ORDER)) for (const q of QUESTIONS) for (let n = 0; n < RUNS; n++) if (!load(s, q.id, n)) todo.push([s, q, n]);
  quiet(todo.length + ' cells to record, ' + CONC + ' at a time');
  let done = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const job = todo.shift(); if (!job) return;
      const [s, q, n] = job;
      try { const r = await harness(q, bits(s)); writeFileSync(cellFile(s, q.id, n), JSON.stringify(r)); process.stderr.write((++done) + ' ' + s + ' ' + q.id + ' ' + n + ' ' + mark(q, r) + '\n'); }
      catch (e) { process.stderr.write('ERROR ' + s + ' ' + q.id + ' ' + n + ' ' + e.message + '\n'); }
    }
  }));
  build();
}
