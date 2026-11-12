/* The server behind the Lecture 11 tool bench.

     POST /api/toolcall  {op:'chat', messages, tools}  ->  {message:{content, tool_calls:[{id, name, arguments}]}, model, ms}
     POST /api/toolcall  {op:'run',  src, args}        ->  {url, ok, result}        the sheet tool, run by the server
     POST /api/toolcall  {op:'peek', link}             ->  {src, columns, rows}     checks a learner's own sheet can be read

     POST /api/toolcall  {op:'key'}                    ->  {ok:true}                checks the learner's Groq key (lists models, costs nothing)

   chat is one round with the model, nothing more: the bench shows every message, so the loop lives in the page.
   The model is fixed here. There is no hidden instruction and no changed setting: the request is the one the page
   shows on the wire, sent with the GroqCloud playground's defaults, so a learner can repeat any run there. Every learner brings their own Groq key (header x-groq-key).
   It is used for that one request and never stored or logged; there is no shared key, so no shared limit.
   Logs counts only, never the questions. No dependencies, like aarav.mjs. */
import { source, tool, run, load, csvUrl, isCurriculum, SheetError } from './_sheet.mjs';

const GROQ = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = process.env.GROQ_MODELS_URL || 'https://api.groq.com/openai/v1/models';
const KEY_RE = /^gsk_[A-Za-z0-9]{20,}$/;
const ownKey = request => { const k = (request.headers.get('x-groq-key') || '').trim(); return KEY_RE.test(k) ? k : ''; };
const NEED = { error: 'need_key', message: 'Paste your Groq key first.' };
const MODEL = 'openai/gpt-oss-120b';
const MAX = { messages: 8, content: 6000, tools: 2, desc: 1200, schema: 2000 };

const HEAD = {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-groq-key'
};
const reply = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({}, HEAD, extra || {}) });

/* ---------- what the page may send to the model ---------- */
class Bad extends Error {}
const str = (v, n, what) => { if (typeof v !== 'string' || v.length > n) throw new Bad(what + ' is missing or too long.'); return v; };
function cleanMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX.messages) throw new Bad('Send 1 to ' + MAX.messages + ' messages.');
  return list.map(m => {
    if (!m || typeof m !== 'object') throw new Bad('A message is not an object.');
    if (m.role === 'user') return { role: 'user', content: str(m.content, MAX.content, 'The question') };
    if (m.role === 'tool') return { role: 'tool', tool_call_id: str(m.tool_call_id, 80, 'tool_call_id'), content: str(m.content, MAX.content, 'The tool result') };
    if (m.role === 'assistant') {
      const out = { role: 'assistant', content: typeof m.content === 'string' ? m.content.slice(0, MAX.content) : null };
      if (Array.isArray(m.tool_calls) && m.tool_calls.length) out.tool_calls = m.tool_calls.slice(0, 3).map(c => ({
        id: str(c.id, 80, 'A tool call id'), type: 'function',
        function: { name: str(c.name, 64, 'A tool name'), arguments: str(typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments || {}), 1000, 'The arguments') }
      }));
      return out;
    }
    throw new Bad('Unknown role: ' + m.role);
  });
}
function cleanTools(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX.tools) throw new Bad('Send at most ' + MAX.tools + ' tools.');
  return list.map(t => {
    if (!t || !/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(t.name || '')) throw new Bad('A tool name must be letters, digits and underscores, starting with a letter.');
    const parameters = t.parameters && typeof t.parameters === 'object' ? t.parameters : { type: 'object', properties: {} };
    if (JSON.stringify(parameters).length > MAX.schema) throw new Bad('The tool inputs are too long.');
    return { type: 'function', function: { name: t.name, description: str(t.description || '', MAX.desc, 'The tool description'), parameters } };
  });
}

/* ---------- one round with the model ---------- */
async function groq(key, messages, tools) {
  const body = { model: MODEL, messages, max_completion_tokens: 2000 };
  if (tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(GROQ, { method: 'POST', signal: ctl.signal, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON: handled by status below */ }
    return { status: res.status, data, retry: res.headers.get('retry-after') };
  } finally { clearTimeout(timer); }
}

async function chat(request, body) {
  const key = ownKey(request);
  if (!key) return reply(401, NEED);
  let messages, tools;
  try { messages = cleanMessages(body.messages); tools = cleanTools(body.tools); } catch (e) { if (e instanceof Bad) return reply(400, { error: 'bad_request', message: e.message }); throw e; }
  const t0 = Date.now();
  let r;
  try {
    r = await groq(key, messages, tools);
  } catch (e) { return reply(504, { error: 'model_down', message: 'The model did not answer in time. Try again.' }); }
  const ms = Date.now() - t0, e = r.data && r.data.error;
  console.log(JSON.stringify({ op: 'chat', status: r.status, ms, tools: tools.length }));
  if (r.status === 401) return reply(401, { error: 'need_key', message: 'Groq did not accept that key.' });
  if (r.status === 429) { const wait = Math.ceil(+r.retry || 10); return reply(429, { error: 'slow_down', message: 'Your key hit its limit for this minute. Try again in ' + wait + ' seconds.', wait }, { 'retry-after': String(wait) }); }
  if (r.status === 400 && e && e.code === 'tool_use_failed')
    return reply(200, { message: { content: null, tool_calls: [] }, failed: String(e.failed_generation || e.message || '').slice(0, 600), model: MODEL, ms });
  if (r.status !== 200 || !r.data || !r.data.choices) return reply(502, { error: 'model_down', message: 'The model returned an error. Try again.' });
  const m = r.data.choices[0].message || {};
  const calls = (m.tool_calls || []).map(c => {
    let args = c.function && c.function.arguments;
    try { args = JSON.parse(args); } catch (x) { /* leave the text as the model wrote it */ }
    return { id: c.id, name: c.function && c.function.name, arguments: args };
  });
  return reply(200, { message: { content: m.content || null, tool_calls: calls }, model: MODEL, ms });
}

export async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEAD });
  if (request.method !== 'POST') return reply(405, { error: 'post_only', message: 'Send a POST.' }, { allow: 'POST, OPTIONS' });
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return reply(400, { error: 'bad_request', message: 'The body is not JSON.' }); }
  try {
    if (body.op === 'chat') return await chat(request, body);
    if (body.op === 'key') {
      const key = ownKey(request);
      if (!key) return reply(401, { error: 'need_key', message: 'A Groq key starts with gsk_. Copy the whole key.' });
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
      let st;
      try { st = (await fetch(MODELS, { signal: ctl.signal, headers: { authorization: 'Bearer ' + key } })).status; }
      catch (x) { return reply(504, { error: 'model_down', message: 'Groq did not answer. Try again.' }); }
      finally { clearTimeout(timer); }
      if (st === 401 || st === 403) return reply(401, { error: 'need_key', message: 'Groq did not accept that key. Copy it again from console.groq.com, under API Keys.' });
      return st === 200 ? reply(200, { ok: true }) : reply(502, { error: 'model_down', message: 'Groq returned an error. Try again.' });
    }
    if (body.op === 'run') {
      const src = source(body.src && body.src.sheet, body.src && body.src.gid);
      const out = await run(src, body.args);
      return reply(200, { url: csvUrl(src), ok: out.ok, result: out.result });
    }
    if (body.op === 'peek') {
      const src = source(body.link);
      if (!String(body.link || '').trim()) return reply(400, { error: 'bad_request', message: 'Paste your sheet link first.' });
      const table = await load(src), def = tool(src);
      return reply(200, { src, curriculum: isCurriculum(src), columns: table.columns.slice(0, 12), rows: table.rows.length, input: Object.keys(def.inputSchema.properties)[0] });
    }
    return reply(400, { error: 'bad_request', message: 'Unknown op.' });
  } catch (e) {
    if (e instanceof SheetError) return reply(e.status, { error: 'sheet', message: e.message });
    console.error('toolcall', e && e.message);
    return reply(500, { error: 'server', message: 'The server failed. Try again.' });
  }
}

export const POST = handle, OPTIONS = handle, GET = handle;
