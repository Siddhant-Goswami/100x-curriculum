/* The server behind the Lecture 11 Tool Bench. On the bench it is the box called Server.

     POST /api/toolcall  {op:'key'}                           -> {ok}            checks the learner's Groq key (lists models, costs nothing)
     POST /api/toolcall  {op:'chat', request}                 -> {sent, raw, call, failed, ms}       one round with the model
     POST /api/toolcall  {op:'run', src, args}                -> {ok, result, events}                 the sheet tool, by hand
     POST /api/toolcall  {op:'loop', question, tool, via, src, mcp} -> {events, used, failed, answer} the whole loop, no human
     POST /api/toolcall  {op:'mcplist', mcp}                  -> {events, tool}  initialize + initialized + tools/list
     POST /api/toolcall  {op:'peek', link}                    -> {src, title, first, columns, rows, example, tab}

   Fidelity rules, because the page promises to show every message that crosses:
   - The body sent to Groq is exactly the page's request, rebuilt only to check it: no instruction, no setting, no
     token limit added. Groq's playground defaults apply, so a learner can repeat any run there.
   - Every hop the server makes comes back as an event carrying the exact JSON it sent or received.
     Things that are not messages (the sheet served from the server's copy, picking a row) come back as notes.
   Every learner brings their own Groq key (header x-groq-key). It is used for that request only and never stored or
   logged. Logs counts only, never the questions. No dependencies, like aarav.mjs. */
import { source, tool as sheetTool, run, load, isCurriculum, SheetError } from './_sheet.mjs';

const GROQ = process.env.GROQ_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MODELS = process.env.GROQ_MODELS_URL || 'https://api.groq.com/openai/v1/models';
const MODEL = 'openai/gpt-oss-120b';
const KEY_RE = /^gsk_[A-Za-z0-9]{20,}$/;
const ownKey = request => { const k = (request.headers.get('x-groq-key') || '').trim(); return KEY_RE.test(k) ? k : ''; };
const NEED = { error: 'need_key', message: 'Paste your Groq key first.' };
const MAX = { messages: 10, content: 6000, tools: 2, desc: 1200, schema: 2000, rounds: 3 };

const HEAD = {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-groq-key'
};
const reply = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({}, HEAD, extra || {}) });

/* ---------- checking what the page asks the server to send ---------- */
class Bad extends Error {}
class Stop extends Error { constructor(status, body) { super(body.message); this.status = status; this.body = body; } }
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
    if (!Array.isArray(r.tools) || r.tools.length > MAX.tools) throw new Bad('Send at most ' + MAX.tools + ' tools.');
    if (r.tools.length) out.tools = r.tools.map(t => cleanTool(t && t.function));
  }
  return out;
}

/* ---------- one round with the model: send exactly `sent`, return exactly what came back ---------- */
function waitWords(wait) {
  if (wait <= 90) return 'Your key hit its limit for this minute. Try again in ' + wait + ' seconds.';
  const m = Math.round(wait / 60);
  return 'Your key hit its limit for today. It frees up in about ' + (m < 90 ? m + ' minutes' : Math.round(m / 60) + ' hours') + '.';
}
async function round(key, sent) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000), t0 = Date.now();
  let res, data = null;
  try {
    res = await fetch(GROQ, { method: 'POST', signal: ctl.signal, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(sent) });
    try { data = await res.json(); } catch (e) { /* not JSON: handled by status below */ }
  } catch (e) { throw new Stop(504, { error: 'model_down', message: 'The model did not answer in time. Try again.' }); }
  finally { clearTimeout(timer); }
  const ms = Date.now() - t0, err = data && data.error;
  console.log(JSON.stringify({ op: 'round', status: res.status, ms, tools: (sent.tools || []).length }));
  if (res.status === 401) throw new Stop(401, { error: 'need_key', message: 'Groq did not accept that key.' });
  if (res.status === 429) { const wait = Math.ceil(+res.headers.get('retry-after') || 10); throw new Stop(429, { error: 'slow_down', message: waitWords(wait), wait }); }
  /* Groq refuses a tool call it cannot parse; that refusal is what came back, so it is shown as is */
  if (res.status === 400 && err && err.code === 'tool_use_failed') return { raw: { error: err }, call: null, failed: String(err.failed_generation || err.message || ''), ms };
  if (res.status !== 200 || !data || !data.choices) throw new Stop(502, { error: 'model_down', message: 'The model returned an error. Try again.' });
  const raw = data.choices[0].message || {}, c = (raw.tool_calls || [])[0];
  let call = null;
  if (c) { let args = c.function && c.function.arguments; try { args = JSON.parse(args); } catch (x) { /* as written */ } call = { id: c.id, name: c.function && c.function.name, arguments: args }; }
  return { raw, call, failed: '', ms };
}

/* ---------- the sheet, by the server's own code ---------- */
function sheetEvents(out) {
  const m = out.meta, ev = [];
  if (m.cached) ev.push({ note: 'server', kind: 'cache', age: m.age });
  else {
    ev.push({ from: 'server', to: 'sheet', kind: 'fetch', body: 'GET ' + m.url });
    ev.push({ from: 'sheet', to: 'server', kind: 'csv', lines: m.lines, bytes: m.bytes, body: m.head + '\n… ' + Math.max(0, m.lines - 4) + ' more lines' });
  }
  ev.push({ note: 'server', kind: 'pick', text: out.pick });
  return ev;
}

/* ---------- the sheet's own MCP server, over HTTP ---------- */
function mcpTarget(u) {
  let url;
  try { url = new URL(String(u || '')); } catch (e) { throw new Bad('That is not an MCP address from this bench.'); }
  const host = url.hostname, local = host === 'localhost' || host === '127.0.0.1';
  const ours = host === '100x-curriculum.vercel.app' || /^100x-curriculum-[a-z0-9-]+-100x-engineers\.vercel\.app$/.test(host);
  if (!(ours || local) || url.pathname !== '/api/mcp' || (!local && url.protocol !== 'https:')) throw new Bad('That is not an MCP address from this bench.');
  return url.toString();
}
async function mcp(url, msg, events) {
  events.push({ from: 'server', to: 'sheet', kind: 'rpc', method: msg.method, body: msg });
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  let res, text;
  try {
    res = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify(msg) });
    text = await res.text();
  } catch (e) { throw new Stop(502, { error: 'mcp_down', message: 'The sheet’s server did not answer. Try again.', events }); }
  finally { clearTimeout(timer); }
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  events.push({ from: 'sheet', to: 'server', kind: 'rpc_res', method: msg.method, status: res.status, body });
  if (body && body.error) throw new Stop(502, { error: 'mcp_error', message: body.error.message, events });
  return body;
}
async function handshake(url, events) {
  await mcp(url, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: '100x-tool-bench', version: '1.0.0' } } }, events);
  await mcp(url, { jsonrpc: '2.0', method: 'notifications/initialized' }, events);
  const list = await mcp(url, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, events);
  const t = list && list.result && list.result.tools && list.result.tools[0];
  if (!t) throw new Stop(502, { error: 'mcp_error', message: 'The sheet’s server listed no tools.', events });
  return t;
}

/* ---------- the loop: the server carries every message, no human in between ---------- */
async function loop(key, body) {
  const events = [], via = body.via === 'mcp' ? 'mcp' : 'code';
  const tool = cleanTool(body.tool);
  const question = str(body.question, 300, 'The question').trim();
  if (!question) throw new Bad('Type a question first.');
  const src = via === 'code' ? source(body.src && body.src.sheet, body.src && body.src.gid) : null;
  const url = via === 'mcp' ? mcpTarget(body.mcp) : null;
  const messages = [{ role: 'user', content: question }];
  let used = false;
  try {
    for (let n = 0; n < MAX.rounds; n++) {
      const sent = { model: MODEL, messages: messages.slice(), tools: [tool] };
      events.push({ from: 'server', to: 'model', kind: 'model_req', body: sent });
      const r = await round(key, sent);
      events.push({ from: 'model', to: 'server', kind: 'model_res', call: r.call, failed: r.failed, body: r.raw });
      if (r.failed) return { events, used, failed: true, answer: '' };
      if (!r.call) return { events, used, failed: false, answer: r.raw.content || '' };
      used = true;
      messages.push({ role: 'assistant', content: r.raw.content || null, tool_calls: r.raw.tool_calls.slice(0, 1).map(c => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } })) });
      let result;
      if (r.call.name !== tool.function.name) {
        result = { error: 'No tool called ' + r.call.name + '.' };
        events.push({ note: 'server', kind: 'refuse', text: 'The model asked for a tool the server does not have, so the server answered with an error.' });
      } else if (via === 'mcp') {
        const res = await mcp(url, { jsonrpc: '2.0', id: 3 + n, method: 'tools/call', params: { name: r.call.name, arguments: r.call.arguments } }, events);
        result = res && res.result ? res.result.content.map(c => c.text).join('\n') : { error: 'No result.' };
      } else {
        const out = await run(src, r.call.arguments);
        events.push.apply(events, sheetEvents(out));
        result = out.result;
      }
      messages.push({ role: 'tool', tool_call_id: r.call.id, content: (typeof result === 'string' ? result : JSON.stringify(result)).slice(0, 5800) });
    }
    events.push({ note: 'server', kind: 'stop', text: 'Stopped after ' + MAX.rounds + ' rounds. The server decides when the loop ends.' });
    return { events, used, failed: false, answer: '' };
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
    if (op === 'run') {
      const src = source(body.src && body.src.sheet, body.src && body.src.gid);
      const out = await run(src, body.args);
      return reply(200, { ok: out.ok, result: out.result, events: sheetEvents(out) });
    }
    if (op === 'mcplist') {
      const events = [];
      try { return reply(200, { events, tool: await handshake(mcpTarget(body.mcp), events) }); }
      catch (e) { if (e instanceof Stop) e.body.events = events; throw e; }
    }
    if (op === 'peek') {
      if (!String(body.link || '').trim()) return reply(400, { error: 'bad_request', message: 'Paste your sheet link first.' });
      const src = source(body.link), table = await load(src), first = (table.rows[0] || []).find(Boolean) || '';
      return reply(200, {
        src, curriculum: isCurriculum(src), title: table.title.slice(0, 120), first: first.slice(0, 160),
        columns: table.columns.slice(0, 12), rows: table.rows.length, input: Object.keys(sheetTool(src).inputSchema.properties)[0],
        tab: src.gid ? 'chosen' : 'first', example: /example/i.test(table.title + ' ' + first)
      });
    }
    return reply(400, { error: 'bad_request', message: 'Unknown op.' });
  } catch (e) {
    if (e instanceof Bad) return reply(400, { error: 'bad_request', message: e.message });
    if (e instanceof Stop) return reply(e.status, e.body, e.body.wait ? { 'retry-after': String(e.body.wait) } : undefined);
    if (e instanceof SheetError) return reply(e.status, { error: 'sheet', message: e.message });
    console.error('toolcall', e && e.message);
    return reply(500, { error: 'server', message: 'The server failed. Try again.' });
  }
}

export const POST = handle, OPTIONS = handle, GET = handle;
