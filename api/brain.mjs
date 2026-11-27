/* The 100x brain's address. A small MCP server, in the style of /api/mcp (Lecture 11): stateless, streamable HTTP,
   JSON answers only (no SSE), no dependencies.

     POST /api/brain      three read-only tools over the 100x brain (github.com/Siddhant-Goswami/100x-brain)

       read_index()                 the index: one line per page. Read first.
       open_page(path, section?)    one page: a short wiki page, or a source under raw/. A long page lists its sections.
       search(words)                places that share the most words with the question, rare words counting more.

   The pages are packed into api/_brain.mjs by tools/pack.py in the brain's repo, so the address serves exactly what
   was approved there. Nothing is written and nothing about the caller is kept. A search that finds nothing is
   written to the server log as the words and the date, with no name: that is the feed for the brain's gaps.md. */
import { BRAIN } from './_brain.mjs';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const HEAD = {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-max-age': '600'
};
const json = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: HEAD });
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id: id == null ? null : id, error: { code, message } });

const LONG = 900;        /* words: a page longer than this opens as a list of its sections */
const HITS = 5, SNIP = 45;
const count = s => (s.match(/\S+/g) || []).length;
const tokens = s => (s.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) || []);

/* ---------- the pages, indexed once per instance ---------- */
const PAGES = new Map(BRAIN.pages.map(p => [p.path, p]));
const INDEX = PAGES.get('index.md');
const DOCS = [];          /* one per section: the unit search ranks */
for (const p of BRAIN.pages) {
  if (p.path === 'index.md') continue;
  for (const s of p.sections) {
    const tok = tokens(p.title + ' ' + s.h + ' ' + s.text);
    if (tok.length < 4) continue;
    const tf = new Map(); for (const t of tok) tf.set(t, (tf.get(t) || 0) + 1);
    DOCS.push({ p, s, tf, len: tok.length });
  }
}
const DF = new Map();
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) || 0) + 1);
const AVG = DOCS.reduce((a, d) => a + d.len, 0) / (DOCS.length || 1);
const STOP = new Set('a an and are as at be by did do does for from had has have how i in is it its me my of on or our that the this to was we were what when where which who why with you your'.split(' '));

function search(words) {
  const q = [...new Set(tokens(words))].filter(t => !STOP.has(t) && DF.has(t));
  if (!q.length) return [];
  const scored = [];
  for (const d of DOCS) {
    let s = 0;
    for (const t of q) {
      const f = d.tf.get(t); if (!f) continue;
      const idf = Math.log(1 + (DOCS.length - DF.get(t) + 0.5) / (DF.get(t) + 0.5));
      s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.len / AVG));
    }
    if (s > 0) scored.push({ d, s: d.p.path.startsWith('wiki/') ? s * 1.15 : s });   /* a written page edges out its own source */
  }
  scored.sort((a, b) => b.s - a.s);
  const out = [], perPage = new Map();
  for (const h of scored) {
    const n = perPage.get(h.d.p.path) || 0; if (n >= 2) continue;
    perPage.set(h.d.p.path, n + 1);
    out.push({ path: h.d.p.path, page: h.d.p.title, section: h.d.s.h || '(top of page)', open: h.d.s.a ? h.d.s.a : undefined, words_near_the_match: snippet(h.d.s.text, q) });
    if (out.length >= HITS) break;
  }
  return out;
}
function snippet(text, q) {
  const flat = text.replace(/\]\([^)]*\)/g, ']').replace(/\s+/g, ' ').trim(), w = flat.split(' ');
  let at = w.findIndex(x => q.some(t => x.toLowerCase().includes(t))); if (at < 0) at = 0;
  const from = Math.max(0, at - 12);
  return (from ? '… ' : '') + w.slice(from, from + SNIP).join(' ') + (from + SNIP < w.length ? ' …' : '');
}

const render = (p, list) => list.map(s => (s.h ? '## ' + s.h + '\n\n' : '') + s.text).join('\n\n').trim();
function openPage(path, section) {
  const key = String(path || '').trim().replace(/^\.?\//, '').replace(/#.*$/, ''), frag = (String(path || '').split('#')[1] || '').trim();
  const p = PAGES.get(key) || PAGES.get(key + '.md');
  if (!p) {
    const near = [...PAGES.keys()].filter(k => k.includes(key.split('/').pop().replace(/\.md$/, ''))).slice(0, 5);
    return { ok: false, text: 'No page at "' + path + '". Paths come from read_index or search, such as wiki/lectures/lecture-14.md.' + (near.length ? ' Did you mean: ' + near.join(', ') + '?' : '') };
  }
  const want = String(section || frag || '').trim().toLowerCase();
  const head = 'Page: ' + p.path + '\n' + (p.meta ? p.meta + '\n' : '') + '\n';
  if (want) {
    const norm = x => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), w = norm(want);
    const s = p.sections.find(x => x.a === want) || p.sections.find(x => norm(x.h) === w) || p.sections.find(x => x.h && norm(x.h).includes(w));
    if (!s) return { ok: false, text: head + 'No section "' + section + '" on this page. Its sections: ' + p.sections.filter(x => x.h).map(x => x.h).join(' | ') };
    return { ok: true, text: head + render(p, [s]) };
  }
  const total = p.sections.reduce((a, s) => a + count(s.text), 0);
  if (total <= LONG) return { ok: true, text: head + render(p, p.sections) };
  const top = p.sections[0] && !p.sections[0].h ? p.sections[0].text + '\n\n' : '';
  return { ok: true, text: head + top.slice(0, 1500) + 'This page is long (' + total + ' words). Its sections are listed below. Call open_page again with the same path and one of them as `section`.\n\n' +
    p.sections.filter(s => s.h).map(s => '- ' + s.h + ' (' + count(s.text) + ' words)').join('\n') };
}

const TOOLS = [
  { name: 'read_index', title: 'Read the index',
    description: 'Read this first. The index of the 100x brain: one line for every page about the 100xEngineers Cohort 8 course (each lecture, each idea, how-tos, the schedule, due dates). Then open the pages you need with open_page.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'open_page', title: 'Open a page',
    description: 'Open one page of the 100x brain by its path, taken from the index or from search, such as wiki/lectures/lecture-14.md. Pages under wiki/ are short and every line names its source. Paths under raw/ are the original course pages; open one to check a line or to get more detail. A long page comes back as a list of its sections: call again with `section`.',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'The page path, such as wiki/threads/schedule.md or raw/lectures/lecture-14-notes.md' }, section: { type: 'string', description: 'Optional. One section heading of that page, such as "04 Make rare words count more"' } }, required: ['path'], additionalProperties: false } },
  { name: 'search', title: 'Search the pages',
    description: 'Find places in the 100x brain by words, for when the index does not point to a page. Use the few most specific words of the question (a name, a term, a number), not a whole sentence. Returns up to 5 places with the page path, the section and the words near the match. Open the page before you answer.',
    inputSchema: { type: 'object', properties: { words: { type: 'string', description: 'A few specific words, such as "free tier requests per minute"' } }, required: ['words'], additionalProperties: false } }
];
const INSTRUCTIONS = 'The 100x brain: what 100xEngineers Cohort 8 has been taught, as pages a person approved. Read the index first, open the pages you need, and answer only from pages you opened, naming the page. For dates and titles the schedule page wins. If the pages do not hold the answer, say "not known". This brain knows the course, not the person asking.';

function call(name, args) {
  args = args && typeof args === 'object' ? args : {};
  if (name === 'read_index') return { ok: true, text: render(INDEX, INDEX.sections) + '\n\n(Packed ' + BRAIN.built + ', ' + (BRAIN.pages.length - 1) + ' pages.)' };
  if (name === 'open_page') {
    if (typeof args.path !== 'string' || !args.path.trim() || args.path.length > 300) return { ok: false, text: 'open_page needs `path`, such as wiki/lectures/lecture-14.md.' };
    return openPage(args.path, typeof args.section === 'string' ? args.section.slice(0, 200) : '');
  }
  if (name === 'search') {
    const words = typeof args.words === 'string' ? args.words.slice(0, 300) : '';
    if (!words.trim()) return { ok: false, text: 'search needs `words`.' };
    const hits = search(words);
    if (!hits.length) { console.log('brain-gap', JSON.stringify({ date: new Date().toISOString().slice(0, 10), words })); return { ok: true, text: 'Nothing in the brain shares those words. Try fewer or different words, or read the index. If it is still not there, the answer is "not known".' }; }
    return { ok: true, text: JSON.stringify(hits, null, 1) };
  }
  return null;
}

const seen = new Map();
function tooFast(ip) {
  const now = Date.now(), t = (seen.get(ip) || []).filter(x => now - x < 60000);
  t.push(now); seen.set(ip, t);
  if (seen.size > 2000) seen.clear();
  return t.length > 240;
}

function answer(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Not a JSON-RPC 2.0 request.');
  const { id, method, params } = msg;
  if (id === undefined) return null;
  if (method === 'initialize') {
    const asked = params && params.protocolVersion;
    return ok(id, { protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {} },
      serverInfo: { name: '100x-brain', title: 'The 100x brain', version: '1.0.0' }, instructions: INSTRUCTIONS });
  }
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS.map(t => Object.assign({}, t, { annotations: { readOnlyHint: true } })) });
  if (method === 'tools/call') {
    const out = call(params && params.name, params && params.arguments);
    if (!out) return err(id, -32602, 'Unknown tool: ' + (params && params.name) + '. This server has three: read_index, open_page, search.');
    return ok(id, { content: [{ type: 'text', text: out.text }], isError: !out.ok });
  }
  return err(id, -32601, 'Method not found: ' + method);
}

export async function handle(request) {
  if (request.method === 'OPTIONS') return json(204, null);
  if (request.method !== 'POST') return new Response(JSON.stringify(err(null, -32000, 'This is the 100x brain\'s address. It answers POST only: give this address to a chat app as a connector.')), { status: 405, headers: Object.assign({ allow: 'POST, OPTIONS' }, HEAD) });
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  if (tooFast(ip)) return json(429, err(null, -32000, 'Too many requests. Wait a minute.'));
  let body;
  try { body = JSON.parse(await request.text()); } catch (e) { return json(400, err(null, -32700, 'The body is not JSON.')); }
  try {
    if (Array.isArray(body)) {
      if (!body.length || body.length > 10) return json(400, err(null, -32600, 'Send 1 to 10 messages.'));
      const out = body.map(answer).filter(Boolean);
      return out.length ? json(200, out) : json(202, null);
    }
    const out = answer(body);
    return out ? json(200, out) : json(202, null);
  } catch (e) {
    console.error('brain', e && e.message);
    return json(500, err(body && body.id, -32603, 'The server failed. Try again.'));
  }
}

export const GET = handle, POST = handle, OPTIONS = handle, DELETE = handle;
