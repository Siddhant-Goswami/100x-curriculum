/* Counts for the "Before Lecture 11" checklist (c8/module-2/checklist) and its stats page.

     POST /api/checklist  {list, id, type:'state', ticked:[item...]}   this browser's whole set of ticks
     POST /api/checklist  {list, id, type:'click', item}               a link on the checklist was opened
     POST /api/checklist  {list, id, type:'forget'}                     drop this id from every count (test runs)
     GET  /api/checklist?list=l11                                     counts for the stats page

   Learners are anonymous: id is a random string the page keeps in localStorage. Nothing typed is sent.
   Storage is the Upstash Redis the delegation framework already uses (KV_REST_API_*). Each POST is one command.
   If POSTHOG_PERSONAL_API_KEY is set (scope: query read), GET also returns PostHog page visitors for each linked page. */

/* Each item: the PostHog pages that count as "opened it". A trailing * means every page under that path. */
const L9 = '/c8/module-2/lecture-09-llms-from-first-principles', L10 = '/c8/module-2/lecture-10-tool-calling-and-mcp', FP = '/c8/module-2/first-principles';
const LISTS = {
  l11: {
    since: '2026-10-29',
    items: {
      l9notes: [L9 + '/notes'],
      wei: [],
      l10notes: [L10 + '/notes'],
      oh: [L10 + '/office-hour'],
      ps1ns: [L9 + '/practice-set'],
      ps1sheet: [L9 + '/practice-set'],
      ps1test: [L9 + '/practice-set'],
      ps1share: [L9 + '/practice-set'],
      ps2ex: [L9 + '/office-hour'],
      ps2score: ['/c8/module-2/practice-set-2-write-the-eval'],
      ps2share: ['/c8/module-2/practice-set-2-write-the-eval'],
      fp1: [FP + '/01-sand-to-screen*', FP + '/02-how-a-machine-remembers*', FP + '/03-can-you-trust-a-machine*'],
      fp4: [FP + '/04-what-is-learning*'],
      fp5: [FP + '/05-attention-and-transformers*', FP + '/06-what-hardware-powers-llms*'],
      fp7: [FP + '/07-guesser-to-assistant*', FP + '/08-what-llms-learn-from-now*']
    }
  }
};
const CHECKLIST_PATH = '/c8/module-2/checklist';

const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PH_KEY = process.env.POSTHOG_PERSONAL_API_KEY || '';
const PH_PROJECT = process.env.POSTHOG_PROJECT_ID || '281751';

const HEAD = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: HEAD });

async function redis(cmd) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch(R_URL, { method: 'POST', signal: ctl.signal, headers: { authorization: 'Bearer ' + R_TOKEN }, body: JSON.stringify(cmd) });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d.result;
  } finally { clearTimeout(timer); }
}

/* KEYS: opened set, done hash (id -> how many ticked), seen hash (id -> ms), then one set per item.
   ARGV: id, now, then '1' or '0' per item in the same order. */
const STATE = `
local id = ARGV[1]
redis.call('SADD', KEYS[1], id)
redis.call('HSET', KEYS[3], id, ARGV[2])
local n = 0
for i = 4, #KEYS do
  if ARGV[i - 1] == '1' then redis.call('SADD', KEYS[i], id); n = n + 1 else redis.call('SREM', KEYS[i], id) end
end
redis.call('HSET', KEYS[2], id, n)
return n`;
/* KEYS: opened set, done hash, seen hash, then the tick set and the click set of every item.
   Returns {opened, done values, seen values, tick and click counts...}. */
const READ = `
local out = {redis.call('SCARD', KEYS[1]), redis.call('HVALS', KEYS[2]), redis.call('HVALS', KEYS[3])}
for i = 4, #KEYS do out[#out + 1] = redis.call('SCARD', KEYS[i]) end
return out`;

/* KEYS: opened set, done hash, seen hash, then every tick and click set. ARGV: id. */
const FORGET = `
redis.call('SREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('HDEL', KEYS[3], ARGV[1])
for i = 4, #KEYS do redis.call('SREM', KEYS[i], ARGV[1]) end
return 1`;

const k = (list, part) => 'ck:' + list + ':' + part;

/* a soft per-instance limit against noise */
const hits = new Map();
function tooFast(ip) {
  const now = Date.now(), t = (hits.get(ip) || []).filter(x => now - x < 60000);
  t.push(now); hits.set(ip, t);
  if (hits.size > 5000) hits.clear();
  return t.length > 90;
}

/* PostHog: people who opened each item's pages since the list began, and in the last 24 hours. One scan, cached two minutes. */
let phCache = { at: 0, list: '', rows: null, error: '' };
const q = p => "'" + p.replace(/[^a-z0-9/_.-]/gi, '') + "'";
function cond(pages) {
  return pages.map(p => p.endsWith('*') ? '(path = ' + q(p.slice(0, -1)) + ' OR startsWith(path, ' + q(p.slice(0, -1) + '/') + '))' : 'path = ' + q(p)).join(' OR ');
}
async function posthogPages(list) {
  if (!PH_KEY) return { rows: null, error: 'no-key' };
  if (phCache.list === list && Date.now() - phCache.at < 120000) return phCache;
  const L = LISTS[list];
  const named = Object.entries(L.items).filter(([, pages]) => pages.length).concat([['_checklist', [CHECKLIST_PATH]]]);
  const cols = named.map(([id, pages]) =>
    'uniqIf(person_id, ' + cond(pages) + ') AS ' + id + ', uniqIf(person_id, (' + cond(pages) + ') AND timestamp >= now() - INTERVAL 1 DAY) AS ' + id + '__day').join(',\n  ');
  const sql = 'SELECT\n  ' + cols + '\nFROM (SELECT person_id, timestamp, replaceRegexpOne(properties.$pathname, \'/$\', \'\') AS path FROM events' +
    " WHERE event = '$pageview' AND timestamp >= toDateTime('" + L.since + " 00:00:00') AND properties.site = 'curriculum'" +
    " AND startsWith(properties.$pathname, '/c8/module-2/'))";
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch('https://us.posthog.com/api/projects/' + PH_PROJECT + '/query/', {
      method: 'POST', signal: ctl.signal,
      headers: { authorization: 'Bearer ' + PH_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql }, name: 'checklist stats' })
    }).finally(() => clearTimeout(timer));
    const d = await r.json();
    if (!r.ok) throw new Error((d && (d.detail || d.error)) || 'PostHog ' + r.status);
    const row = (d.results && d.results[0]) || [], rows = {};
    named.forEach(([id], n) => { rows[id] = { people: row[2 * n] || 0, day: row[2 * n + 1] || 0 }; });
    phCache = { at: Date.now(), list, rows, error: '' };
    return phCache;
  } catch (e) {
    return { rows: null, error: String(e.message || e).slice(0, 200) };
  }
}

export async function handle(request) {
  if (!R_URL || !R_TOKEN) return json(503, { error: 'Storage is not configured.' });
  const url = new URL(request.url);
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';

  if (request.method === 'GET') {
    const list = url.searchParams.get('list') || 'l11', L = LISTS[list];
    if (!L) return json(404, { error: 'Unknown list.' });
    const ids = Object.keys(L.items);
    const keys = [k(list, 'opened'), k(list, 'done'), k(list, 'seen')];
    ids.forEach(i => keys.push(k(list, 't:' + i)));
    ids.forEach(i => keys.push(k(list, 'c:' + i)));
    const [r, ph] = await Promise.all([redis(['EVAL', READ, String(keys.length), ...keys]), posthogPages(list)]);
    const done = (r[1] || []).map(Number), seen = (r[2] || []).map(Number), now = Date.now();
    const items = {};
    ids.forEach((id, n) => { items[id] = { ticked: r[3 + n], clicked: r[3 + ids.length + n] }; });
    return json(200, {
      list, total: ids.length, opened: r[0], items, done,
      active: { hour: seen.filter(t => now - t < 3600e3).length, day: seen.filter(t => now - t < 86400e3).length },
      pages: ph.rows, posthog: ph.rows ? 'ok' : ph.error, at: now
    });
  }

  if (request.method !== 'POST') return json(405, { error: 'GET or POST.' });
  if (tooFast(ip)) return json(429, { error: 'Too many.' });
  let b;
  try { b = await request.json(); } catch { return json(400, { error: 'JSON body expected.' }); }
  const L = b && LISTS[b.list];
  if (!L || typeof b.id !== 'string' || !/^[a-z0-9]{6,40}$/i.test(b.id)) return json(400, { error: 'Bad list or id.' });
  const ids = Object.keys(L.items);

  if (b.type === 'click') {
    if (!ids.includes(b.item)) return json(400, { error: 'Unknown item.' });
    await redis(['SADD', k(b.list, 'c:' + b.item), b.id]);
    return json(200, { ok: true });
  }
  if (b.type === 'state') {
    const on = new Set(Array.isArray(b.ticked) ? b.ticked : []);
    const keys = [k(b.list, 'opened'), k(b.list, 'done'), k(b.list, 'seen'), ...ids.map(i => k(b.list, 't:' + i))];
    const n = await redis(['EVAL', STATE, String(keys.length), ...keys, b.id, String(Date.now()), ...ids.map(i => on.has(i) ? '1' : '0')]);
    return json(200, { ok: true, done: n });
  }
  if (b.type === 'forget') { /* drops this id from every count: for test runs */
    const keys = [k(b.list, 'opened'), k(b.list, 'done'), k(b.list, 'seen'), ...ids.map(i => k(b.list, 't:' + i)), ...ids.map(i => k(b.list, 'c:' + i))];
    await redis(['EVAL', FORGET, String(keys.length), ...keys, b.id]);
    return json(200, { ok: true });
  }
  return json(400, { error: 'Unknown type.' });
}

export const GET = handle, POST = handle;
