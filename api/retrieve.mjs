/* The server behind the Lecture 13 Retrieval Bench. On the bench it is the box called Server; the pile it searches
   (api/_pile.mjs, built by _plan/lecture-13/build_pile.py) is the box called Pile.

     POST /api/retrieve {op:'key'}                       -> {ok}                    checks the learner's Groq key (lists models, costs nothing)
     POST /api/retrieve {op:'lecture', number}           -> {result}                the Lecture 11 lookup: one lecture's notes by number
     POST /api/retrieve {op:'words', words, k}           -> {hits, total}           keyword search: passages containing these exact words
     POST /api/retrieve {op:'nearest', v, k}             -> {hits}                  search by meaning: passages whose 384 numbers are closest
     POST /api/retrieve {op:'chat', request}             -> {sent, raw, usage, ...} one round with the LLM, exactly as sent
     POST /api/retrieve {op:'loop', question}            -> {events, answer, ...}   the LLM with search_notes as a tool, the server running it

   Same fidelity rules as /api/toolcall (Lecture 11), which this file copies rather than changes so the live Tool Bench is untouched:
   - The body sent to Groq is exactly the page's request: no hidden instruction, no setting, no token limit added.
   - Every search returns exactly what the server's search code returned; the page shows it on the wire.
   Every learner brings their own Groq key (header x-groq-key), used for that request only, never stored or logged. */
import { PILE } from './_pile.mjs';

const GROQ = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = process.env.GROQ_MODELS_URL || 'https://api.groq.com/openai/v1/models';
const MODEL = 'openai/gpt-oss-120b';
const KEY_RE = /^gsk_[A-Za-z0-9]{20,}$/;
const ownKey = request => { const k = (request.headers.get('x-groq-key') || '').trim(); return KEY_RE.test(k) ? k : ''; };
const NEED = { error: 'need_key', message: 'Paste your Groq key first.' };
/* content is high because station 3 pastes whole lectures (all twelve are about 125,000 characters) */
const MAX = { messages: 12, content: 140000, tools: 1, desc: 1200, schema: 2000, rounds: 6, k: 10 };

const HEAD = {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-groq-key'
};
const reply = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({}, HEAD, extra || {}) });
class Bad extends Error {}
class Stop extends Error { constructor(status, body) { super(body.message); this.status = status; this.body = body; } }
const str = (v, n, what) => { if (typeof v !== 'string' || v.length > n) throw new Bad(what + ' is missing or too long.'); return v; };

/* ---------- the pile: two searches, both plain code ---------- */
const norm = s => String(s).toLowerCase().replace(/[‘’`]/g, "'").replace(/[‐-―-]/g, ' ').replace(/\s+/g, ' ');
const TEXT = PILE.chunks.map(c => norm(c.text));
const lectureOf = c => ({ id: c.id, lecture: c.l, section: c.title });

/* keyword search: the passages that contain the exact words, most mentions first (like Ctrl+F across every passage) */
export function words(q, k) {
  const w = norm(q).trim();
  if (!w) return { hits: [], total: 0 };
  const re = new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const found = [];
  TEXT.forEach((t, i) => { const n = (t.match(re) || []).length; if (n) found.push({ i, n }); });
  found.sort((a, b) => b.n - a.n || a.i - b.i);
  return { total: found.length, lectures: new Set(found.map(f => PILE.chunks[f.i].l)).size, hits: found.slice(0, k).map(f => Object.assign(lectureOf(PILE.chunks[f.i]), { mentions: f.n, text: PILE.chunks[f.i].text })) };
}
/* search by meaning: score every passage by how close its 384 numbers are to the question's (cosine; both are length 1) */
export function nearest(v, k) {
  const scored = PILE.chunks.map((c, i) => { let s = 0; for (let d = 0; d < v.length; d++) s += v[d] * c.v[d]; return { i, s }; });
  scored.sort((a, b) => b.s - a.s);
  return { hits: scored.slice(0, k).map(x => Object.assign(lectureOf(PILE.chunks[x.i]), { score: Math.round(x.s * 1000) / 1000, text: PILE.chunks[x.i].text })) };
}
function vector(v) {
  if (!Array.isArray(v) || v.length !== 384 || !v.every(x => typeof x === 'number' && isFinite(x))) throw new Bad('Send the question as 384 numbers.');
  return v;
}
const kOf = k => Math.max(1, Math.min(MAX.k, parseInt(k, 10) || 3));

/* the tool the LLM gets in station 6 */
export const SEARCH_TOOL = {
  type: 'function', function: {
    name: 'search_notes',
    description: 'Searches the 100xEngineers Cohort 8 lecture notes (Lectures 1 to 12) for passages that contain the exact words you give. Returns up to 3 passages, each with its lecture number. Use 1 to 3 words exactly as they would appear in the notes. If nothing comes back, try other words.',
    parameters: { type: 'object', properties: { words: { type: 'string', description: 'The exact words to look for, 1 to 3 words.' } }, required: ['words'] }
  }
};

/* ---------- checking what the page asks the server to send ---------- */
function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX.messages) throw new Bad('Send 1 to ' + MAX.messages + ' messages.');
  return list.map(m => {
    if (!m || typeof m !== 'object') throw new Bad('A message is not an object.');
    if (m.role === 'user') return { role: 'user', content: str(m.content, MAX.content, 'The message') };
    if (m.role === 'tool') return { role: 'tool', tool_call_id: str(m.tool_call_id, 80, 'tool_call_id'), content: str(m.content, MAX.content, 'The tool result') };
    if (m.role === 'assistant') {
      const out = { role: 'assistant', content: typeof m.content === 'string' ? m.content.slice(0, MAX.content) : null };
      if (Array.isArray(m.tool_calls) && m.tool_calls.length) out.tool_calls = m.tool_calls.slice(0, 3).map(c => ({
        id: str(c && c.id, 80, 'A tool call id'), type: 'function',
        function: { name: str(c.function && c.function.name, 64, 'A tool name'), arguments: str(c.function && c.function.arguments, 1000, 'The arguments') }
      }));
      return out;
    }
    throw new Bad('Unknown role: ' + m.role);
  });
}
function cleanTool(t) {
  if (!t || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(t.name || '')) throw new Bad('A tool name must be letters, digits and underscores, starting with a letter.');
  const parameters = t.parameters && typeof t.parameters === 'object' ? t.parameters : { type: 'object', properties: {} };
  if (JSON.stringify(parameters).length > MAX.schema) throw new Bad('The tool inputs are too long.');
  return { type: 'function', function: { name: t.name, description: str(t.description || '', MAX.desc, 'The tool description'), parameters } };
}
function cleanRequest(r) {
  if (!r || r.model !== MODEL) throw new Bad('This bench runs ' + MODEL + ' only.');
  const out = { model: MODEL, messages: cleanMessages(r.messages) };
  if (r.tools != null) {
    if (!Array.isArray(r.tools) || r.tools.length > MAX.tools) throw new Bad('Send at most ' + MAX.tools + ' tool.');
    if (r.tools.length) out.tools = r.tools.map(t => cleanTool(t && t.function));
  }
  return out;
}

/* ---------- one round with the LLM: send exactly `sent`, return exactly what came back ---------- */
function waitWords(wait) {
  if (wait <= 90) return 'Your key hit its limit for this minute. Try again in ' + wait + ' seconds.';
  const m = Math.round(wait / 60);
  return 'Your key hit its limit for today. It frees up in about ' + (m < 90 ? m + ' minutes' : Math.round(m / 60) + ' hours') + '.';
}
async function round(key, sent) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000), t0 = Date.now();
  let res, data = null;
  try {
    res = await fetch(GROQ, { method: 'POST', signal: ctl.signal, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(sent) });
    try { data = await res.json(); } catch (e) { /* not JSON: handled by status below */ }
  } catch (e) { throw new Stop(504, { error: 'model_down', message: 'The LLM did not answer in time. Try again.' }); }
  finally { clearTimeout(timer); }
  const ms = Date.now() - t0, err = data && data.error;
  console.log(JSON.stringify({ op: 'round', status: res.status, ms, tools: (sent.tools || []).length }));
  if (res.status === 401) throw new Stop(401, { error: 'need_key', message: 'Groq did not accept that key.' });
  /* too big for the key's per-minute allowance: Groq refuses before the LLM reads anything. Station 3 shows this refusal. */
  if (res.status === 413 || (err && /request too large/i.test(err.message || ''))) {
    return { raw: { error: err || { message: 'Request too large' } }, status: res.status, refused: true, usage: null, call: null, failed: '', ms };
  }
  if (res.status === 429) { const wait = Math.ceil(+res.headers.get('retry-after') || 10); throw new Stop(429, { error: 'slow_down', message: waitWords(wait), wait }); }
  if (res.status === 400 && err && err.code === 'tool_use_failed') return { raw: { error: err }, status: 400, call: null, usage: null, failed: String(err.failed_generation || err.message || ''), ms };
  if (res.status !== 200 || !data || !data.choices) throw new Stop(502, { error: 'model_down', message: 'The LLM returned an error. Try again.' });
  const raw = data.choices[0].message || {}, c = (raw.tool_calls || [])[0];
  let call = null;
  if (c) { let args = c.function && c.function.arguments; try { args = JSON.parse(args); } catch (x) { /* as written */ } call = { id: c.id, name: c.function && c.function.name, arguments: args }; }
  return { raw, status: 200, call, usage: data.usage || null, failed: '', ms };
}

/* ---------- the loop: the LLM asks for searches, the server runs them, up to MAX.rounds rounds ---------- */
async function loop(key, body) {
  const question = str(body.question, 400, 'The question').trim();
  if (!question) throw new Bad('Type a question first.');
  const events = [], messages = [{ role: 'user', content: question }], usage = [];
  let searches = 0;
  try {
    for (let n = 0; n < MAX.rounds; n++) {
      const sent = { model: MODEL, messages: messages.slice(), tools: [SEARCH_TOOL] };
      events.push({ kind: 'model_req', body: sent });
      let r;
      for (let tries = 0; ; tries++) {
        try { r = await round(key, sent); break; }
        catch (e) {
          /* every round re-sends the whole conversation, so a free key's per-minute allowance can run out mid-loop.
             A short wait is shown on the wire and the same request is sent again; a long one ends the loop. */
          if (!(e instanceof Stop) || e.status !== 429 || e.body.wait > 15 || tries >= 2) throw e;
          events.push({ kind: 'model_res', body: { error: 'rate limit (HTTP 429): retry in ' + e.body.wait + ' s' }, call: null, failed: '', usage: null, limited: true });
          events.push({ kind: 'note', text: 'Your key hit its tokens-per-minute limit. The server waited ' + e.body.wait + ' s and sent the same request again.' });
          await new Promise(res => setTimeout(res, e.body.wait * 1000 + 300));
          events.push({ kind: 'model_req', body: sent, again: true });
        }
      }
      events.push({ kind: 'model_res', call: r.call, failed: r.failed, usage: r.usage, body: r.raw });
      if (r.usage) usage.push(r.usage);
      if (r.failed || r.refused) return { events, searches, usage, failed: true, answer: '' };
      if (!r.call) return { events, searches, usage, failed: false, answer: r.raw.content || '' };
      messages.push({ role: 'assistant', content: r.raw.content || null, tool_calls: r.raw.tool_calls.slice(0, 1).map(c => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } })) });
      let result;
      if (r.call.name !== 'search_notes') {
        result = { error: 'No tool called ' + r.call.name + '.' };
        events.push({ kind: 'note', text: 'The LLM asked for a tool the server does not have, so the server answered with an error.' });
      } else {
        const w = r.call.arguments && typeof r.call.arguments === 'object' ? String(r.call.arguments.words || '') : '';
        const found = words(w.slice(0, 80), 3);
        searches++;
        events.push({ kind: 'search', args: { words: w, k: 3 } });
        events.push({ kind: 'found', body: found });
        result = found.hits.length ? found.hits.map(h => ({ lecture: h.lecture, section: h.section, text: h.text })) : { found: 0, message: 'No passage contains those exact words.' };
      }
      messages.push({ role: 'tool', tool_call_id: r.call.id, content: JSON.stringify(result) });
    }
    events.push({ kind: 'note', text: 'Stopped after ' + MAX.rounds + ' rounds. The server decides when the loop ends.' });
    return { events, searches, usage, failed: false, answer: '' };
  } catch (e) {
    if (e instanceof Stop) { e.body.events = events; throw e; }
    throw e;
  }
}

export async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEAD });
  if (request.method !== 'POST') return reply(405, { error: 'post_only', message: 'Send a POST.' }, { allow: 'POST, OPTIONS' });
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return reply(400, { error: 'bad_request', message: 'The body is not JSON.' }); }
  try {
    const op = body && body.op;
    if (op === 'words') return reply(200, words(str(body.words, 80, 'The search words'), kOf(body.k || MAX.k)));
    if (op === 'nearest') return reply(200, nearest(vector(body.v), kOf(body.k)));
    if (op === 'lecture') {
      const n = parseInt(body.number, 10), l = PILE.lectures.find(x => x.n === n);
      return reply(200, { result: l ? { lecture: n, title: l.title, notes: l.text } : { error: 'There are notes for Lectures 1 to 12 only.' } });
    }
    if (op === 'key') {
      const key = ownKey(request);
      if (!key) return reply(401, { error: 'need_key', message: 'A Groq key starts with gsk_. Copy the whole key.' });
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
      let st;
      try { st = (await fetch(MODELS, { signal: ctl.signal, headers: { authorization: 'Bearer ' + key } })).status; }
      catch (x) { return reply(504, { error: 'model_down', message: 'Groq did not answer. Try again.' }); }
      finally { clearTimeout(timer); }
      if (st === 401 || st === 403) return reply(401, { error: 'need_key', message: 'Groq did not accept that key. Copy it again from console.groq.com/keys.' });
      return st === 200 ? reply(200, { ok: true }) : reply(502, { error: 'model_down', message: 'Groq returned an error. Try again.' });
    }
    if (op === 'chat' || op === 'loop') {
      const key = ownKey(request);
      if (!key) return reply(401, NEED);
      if (op === 'chat') { const sent = cleanRequest(body.request); const r = await round(key, sent); return reply(200, Object.assign({ sent }, r)); }
      return reply(200, await loop(key, body));
    }
    return reply(400, { error: 'bad_request', message: 'Unknown op.' });
  } catch (e) {
    if (e instanceof Bad) return reply(400, { error: 'bad_request', message: e.message });
    if (e instanceof Stop) return reply(e.status, e.body, e.body.wait ? { 'retry-after': String(e.body.wait) } : undefined);
    console.error('retrieve', e && e.message);
    return reply(500, { error: 'server', message: 'The server failed. Try again.' });
  }
}

export const POST = handle, OPTIONS = handle, GET = handle;
