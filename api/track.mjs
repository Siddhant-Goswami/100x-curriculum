/* Site analytics: the page script /c8/analytics.js posts batches of events here.
     POST /api/track  {v, s, events:[{e, p, t, ...}]}  ->  204
   Each batch is written as one private file in the curriculum-analytics Blob store,
   at events/YYYY-MM-DD/<time>-<random>.jsonl, one event per line.
   _plan/analytics/pull.mjs merges them into one local file, _plan/analytics/events.jsonl.
   No IP address, no typed text: only page paths, element labels, ids and counts. No dependencies. */

const BLOB = 'https://vercel.com/api/blob/';
const NAMES = ['view', 'section', 'click', 'video', 'leave', 'custom'];
const MAX = { events: 60, bytes: 32000, str: 160 };

function str(x, n) { return typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n || MAX.str) : undefined; }
function num(x) { return typeof x === 'number' && isFinite(x) ? Math.round(x) : undefined; }
function id(x) { return typeof x === 'string' && /^[a-z0-9]{6,24}$/i.test(x) ? x : undefined; }

/* keep only known fields, so nothing a learner types can arrive here */
function event(e, base) {
  if (!e || !NAMES.includes(e.e)) return null;
  const o = Object.assign({}, base, {
    e: e.e, p: str(e.p, 200), at: num(e.t), id: str(e.id, 60), label: str(e.label), href: str(e.href, 300),
    sec: num(e.sec), scroll: num(e.scroll), name: str(e.name, 60), value: str(e.value), ref: str(e.ref, 200), w: num(e.w)
  });
  Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; });
  return o;
}

function reply(status) { return new Response(null, { status, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' } }); }

export async function handle(request) {
  if (request.method === 'OPTIONS') return reply(204);
  if (request.method !== 'POST') return reply(405);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return reply(204);
  const raw = await request.text();
  if (raw.length > MAX.bytes) return reply(413);
  let body;
  try { body = JSON.parse(raw); } catch (e) { return reply(400); }
  const h = request.headers, now = new Date();
  const base = { ts: now.toISOString(), v: id(body.v), s: id(body.s), country: h.get('x-vercel-ip-country') || undefined,
    ua: /mobile/i.test(h.get('user-agent') || '') ? 'mobile' : 'desktop' };
  const lines = (Array.isArray(body.events) ? body.events : []).slice(0, MAX.events).map(e => event(e, base)).filter(Boolean);
  if (!lines.length) return reply(204);
  const day = base.ts.slice(0, 10), name = 'events/' + day + '/' + now.getTime() + '-' + Math.random().toString(36).slice(2, 8) + '.jsonl';
  try {
    const r = await fetch(BLOB + '?' + new URLSearchParams({ pathname: name }), {
      method: 'PUT', body: lines.map(l => JSON.stringify(l)).join('\n') + '\n',
      headers: { authorization: 'Bearer ' + token, 'x-api-version': '13', 'x-vercel-blob-access': 'private',
        'x-add-random-suffix': '0', 'x-content-type': 'application/x-ndjson' }
    });
    if (!r.ok) console.log(JSON.stringify({ track: 'blob', status: r.status }));
  } catch (e) { console.log(JSON.stringify({ track: 'blob', error: e.message })); }
  return reply(204);
}

export const POST = handle, OPTIONS = handle, GET = handle;
