/* Aarav's Diagnosis Service: the real machine behind Round Three (Lecture 4, API as the second interface).
   Public address: https://100x-curriculum.vercel.app/aarav (rewritten here by vercel.json).
   Contract: c8/module-2/lecture-04-the-second-interface/_plan/aarav-api-contract.md
   It checks the parts in the order students learn them: address, action, key, package.
   No database on purpose: nothing created survives, which is the Lecture 6 hook. */

const SECRET = process.env.AARAV_SECRET || 'c8-module2-lecture04-aarav-teaching-machine';
const MAX_WORKFLOW = 4000;
const RATE = { limit: 20, windowMs: 60000 };
const hits = new Map(); /* per warm instance only; best effort */

const DOORS = {
  '/': { methods: ['GET'], key: false, desc: 'This list of doors' },
  '/keys': { methods: ['POST'], key: false, desc: 'Create a key. Package: {"name": "your name"}' },
  '/diagnoses': { methods: ['POST', 'GET'], key: true, desc: 'Create a diagnosis (POST, package {"workflow": "..."}) or read past ones (GET)' },
  '/diagnoses/:id': { methods: ['GET', 'PUT', 'PATCH', 'DELETE'], key: true, desc: 'One diagnosis' },
  '/workflows': { methods: ['POST', 'GET'], key: true, desc: 'Create a workflow (POST, package {"workflow": "..."}) or read past ones (GET)' },
  '/workflows/:id': { methods: ['GET', 'PUT', 'PATCH', 'DELETE'], key: true, desc: 'One workflow' },
  '/broken': { methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], key: false, desc: 'Always fails with 500, for practice' }
};
const CRUD = { GET: 'Read', POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete' };
const DOOR_LIST = '/aarav/diagnoses /aarav/workflows /aarav/keys';

const NO_MEMORY = 'This machine has no database yet, so nothing you created was kept. Where should it live? That is Lecture 6.';

/* ---------- helpers ---------- */
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-expose-headers': 'retry-after, allow, location',
    'access-control-max-age': '600'
  };
}
function reply(status, body, extra) {
  return new Response(JSON.stringify(Object.assign({ status }, body), null, 2), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors(), extra || {})
  });
}
function fail(status, part, message, hint, sent, extra) {
  return reply(status, { error: { part, message, hint }, you_sent: sent }, extra);
}
async function sha(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomId(n) {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(n));
  return [...r].map(x => a[x % a.length]).join('');
}
async function makeKey() { const r = randomId(8); return 'aarav_' + r + '_' + (await sha(SECRET + ':' + r)).slice(0, 6); }
async function keyValid(k) {
  const m = /^aarav_([a-z0-9]{8})_([0-9a-f]{6})$/.exec(k || '');
  return !!m && (await sha(SECRET + ':' + m[1])).slice(0, 6) === m[2];
}
function mask(k) { return k.length > 12 ? k.slice(0, 10) + '…' : k.slice(0, 4) + '…'; }
function rateHit(k) {
  const now = Date.now(), arr = (hits.get(k) || []).filter(t => now - t < RATE.windowMs);
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE.limit ? Math.ceil((RATE.windowMs - (now - arr[0])) / 1000) : 0;
}
function route(path) {
  if (DOORS[path]) return path;
  const m = /^\/(diagnoses|workflows)\/[^/]+$/.exec(path);
  return m ? '/' + m[1] + '/:id' : null;
}

/* ---------- the deterministic diagnosis: rules, not a model ---------- */
const TOOLS = [['jira', 'Jira'], ['slack', 'Slack'], ['excel', 'Excel'], ['google sheet', 'Google Sheets'], ['spreadsheet', 'a spreadsheet'], ['sheet', 'Google Sheets'], ['gmail', 'Gmail'], ['outlook', 'Outlook'], ['email', 'email'], ['notion', 'Notion'], ['whatsapp', 'WhatsApp'], ['tally', 'Tally'], ['salesforce', 'Salesforce'], ['hubspot', 'HubSpot'], ['crm', 'the CRM'], ['dashboard', 'a dashboard'], ['zoom', 'Zoom'], ['calendar', 'the calendar'], ['google doc', 'Google Docs'], ['powerpoint', 'PowerPoint'], ['slides', 'slides'], ['pdf', 'PDFs'], ['github', 'GitHub'], ['trello', 'Trello'], ['asana', 'Asana']];
const ARTIFACTS = [['status report', 'status report'], ['report', 'report'], ['summary', 'summary'], ['invoice', 'invoice'], ['newsletter', 'newsletter'], ['proposal', 'proposal'], ['update', 'update'], ['minutes', 'meeting notes'], ['notes', 'notes'], ['email', 'email'], ['reply', 'reply'], ['post', 'post'], ['deck', 'deck']];

function diagnose(text) {
  const t = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  /* Aarav's Friday, word for word as read aloud in Round Three */
  if (/jira/.test(t) && /ticket/.test(t) && /status report/.test(t) && /slack/.test(t)) {
    return {
      repeated_pattern: 'A weekly status report.',
      bottleneck: 'Reading every ticket to find what changed.',
      first_ai_step: 'Draft the report from a Jira export; Aarav edits and posts it.',
      time: timeLine(t, 'weekly')
    };
  }
  const tools = TOOLS.map(([k, name]) => [t.indexOf(k), name]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0])
    .map(x => x[1]).filter((n, i, a) => a.indexOf(n) === i);
  const freq = /\b(daily|every day|each day|every morning|every evening)\b/.test(t) ? 'daily'
    : /\b(weekly|every week|each week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/.test(t) ? 'weekly'
    : /\b(monthly|every month|each month|month end|month-end)\b/.test(t) ? 'monthly' : 'repeated';
  const art = (ARTIFACTS.find(([k]) => t.includes(k)) || [null, 'task'])[1];
  const bottleneck = /\b(read|go through|check|review|scan)/.test(t) ? 'Reading ' + (tools[0] ? 'everything in ' + tools[0] : 'every source') + ' to find what changed.'
    : /\b(copy|paste|re-?type|enter|fill)/.test(t) ? 'Copying the same data between ' + (tools.length > 1 ? tools.slice(0, 2).join(' and ') : 'tools') + ' by hand.'
    : /\b(write|draft|prepare|compose)/.test(t) ? 'Writing the same ' + art + ' from scratch each time.'
    : 'Doing the same steps by hand each time.';
  const src = tools[0] ? 'an export of ' + tools[0] : 'the source data';
  const dest = tools.length > 1 ? tools[tools.length - 1] : null;
  return {
    repeated_pattern: 'A ' + freq + ' ' + art + '.',
    bottleneck,
    first_ai_step: 'Draft the ' + art + ' from ' + src + '; a person checks it before it goes ' + (dest ? 'into ' + dest : 'out') + '.',
    time: timeLine(t, freq)
  };
}
function timeLine(t, freq) {
  const m = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/.exec(t);
  if (!m) return 'Not stated. Write down how long it takes; the verifier needs a number.';
  const mins = Math.round(parseFloat(m[1]) * (/^h/.test(m[2]) ? 60 : 1));
  const perYear = { daily: 250, weekly: 50, monthly: 12 }[freq];
  return perYear ? 'About ' + mins + ' minutes each time, about ' + Math.round(mins * perYear / 60) + ' hours a year.' : 'About ' + mins + ' minutes each time.';
}

/* ---------- the machine ---------- */
export async function handle(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  let p = url.searchParams.get('path');
  if (p == null) p = url.pathname.replace(/^\/api\/aarav/, '').replace(/^\/aarav/, '');
  let path = ('/' + p).replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/$/, '');
  const address = '/aarav' + (path === '/' ? '' : path);
  const sent = { action: method + (CRUD[method] ? ' (' + CRUD[method] + ')' : ''), address };

  /* 1. address */
  const door = route(path);
  if (!door) return fail(404, 'address', 'Not found. Doors: ' + DOOR_LIST, 'Check the path, letter for letter. The machine does not guess.', sent);
  if (door === '/broken') return fail(500, 'server', 'Our machine broke. Not your fault.', '5xx means their machine failed. Nothing to fix on your side; try later or tell them.', sent);

  /* 2. action */
  const spec = DOORS[door];
  if (!spec.methods.includes(method)) {
    const groups = [];
    spec.methods.forEach(m => { const c = CRUD[m].toUpperCase(), g = groups.find(x => x[0] === c); g ? g[1].push(m) : groups.push([c, [m]]); });
    const parts = groups.map(g => g[0] + ' (' + g[1].join(' or ') + ')');
    const allowed = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    return fail(405, 'action', 'This door takes ' + allowed + '.', 'You sent ' + sent.action + '. Same address, different action.', sent, { allow: spec.methods.join(', ') });
  }

  if (door === '/') {
    return reply(200, {
      service: "Aarav's Diagnosis Service",
      says: 'Send me a workflow and I return a diagnosis. I check four things in order: address, action, key, package.',
      start_here: 'POST /aarav/keys with the package {"name": "your name"} to get a key.',
      doors: Object.keys(DOORS).filter(d => d !== '/').map(d => ({ address: '/aarav' + d.replace(':id', '{id}'), actions: DOORS[d].methods.map(m => m + ' (' + (CRUD[m] || m) + ')'), key_needed: DOORS[d].key, what: DOORS[d].desc })),
      you_sent: sent
    });
  }

  /* 3. key */
  if (url.searchParams.has('key') || url.searchParams.has('api_key')) {
    return fail(401, 'key', 'Keys go in a header, not the address.', 'Anyone can see an address: it is logged, shared and shown in the browser bar. Send Authorization: Bearer <your key>.', sent);
  }
  let key = null;
  if (spec.key) {
    const auth = (request.headers.get('authorization') || '').trim();
    if (!auth) return fail(401, 'key', 'Who are you? Key needed.', 'Add the header Authorization: Bearer <your key>. No key yet? POST /aarav/keys with {"name": "your name"}.', sent);
    const bm = /^bearer\s+(.+)$/i.exec(auth);
    if (!bm) return fail(401, 'key', 'Key found, but not in the agreed form.', 'Write it as: Authorization: Bearer <your key>. The word Bearer, one space, then the key.', Object.assign(sent, { key: mask(auth) + ' (no Bearer)' }));
    key = bm[1].trim();
    if (!(await keyValid(key))) return fail(401, 'key', 'Key not recognised.', 'This machine did not issue that key. Check for a missing character or a stray space, or create a new one with POST /aarav/keys.', Object.assign(sent, { key: mask(key) + ' (not valid)' }));
    sent.key = mask(key) + ' (valid)';
    const wait = rateHit(key);
    if (wait) return fail(429, 'rate', 'Too many requests. Slow down.', 'More than ' + RATE.limit + ' requests a minute on one key. Wait ' + wait + ' seconds; the retry-after header says so too.', sent, { 'retry-after': String(wait) });
  } else {
    const wait = rateHit('ip:' + (request.headers.get('x-forwarded-for') || 'anon').split(',')[0]);
    if (wait) return fail(429, 'rate', 'Too many requests. Slow down.', 'Wait ' + wait + ' seconds; the retry-after header says so too.', sent, { 'retry-after': String(wait) });
  }

  /* reads and single-item doors: nothing is stored */
  if (method === 'GET' && (door === '/diagnoses' || door === '/workflows')) {
    const name = door.slice(1);
    return reply(200, { [name]: [], note: 'Nothing to read. Read only fetches what already exists. ' + NO_MEMORY, you_sent: sent });
  }
  if (door.endsWith('/:id')) {
    return fail(404, 'address', 'Nothing at ' + address + '.', NO_MEMORY + ' A 404 here is honest: the thing you asked for does not exist.', sent);
  }

  /* 4. package (POST only from here) */
  const ctype = (request.headers.get('content-type') || '').toLowerCase();
  const raw = await request.text();
  const expect = door === '/keys' ? '{"name": "your name"}' : '{"workflow": "..."}';
  if (!raw.trim()) return fail(400, 'package', 'Empty package. Send ' + expect, 'A Create needs something to create from.', sent);
  if (!ctype.includes('application/json')) return fail(400, 'package', 'Unknown format. Say it is JSON.', 'Add the header Content-Type: application/json, so the machine knows which format to read.', Object.assign(sent, { content_type: ctype || '(none)' }));
  let pkg;
  try { pkg = JSON.parse(raw); } catch (e) {
    return fail(400, 'package', "Can't read. Send " + expect, 'The JSON is broken: ' + e.message + '. Look for a missing quote, comma or brace.', Object.assign(sent, { package_text: raw.slice(0, 300) }));
  }
  sent.package = pkg;
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return fail(400, 'package', "Can't read. Send " + expect, 'The package must be one JSON object in curly braces.', sent);

  if (door === '/keys') {
    const name = typeof pkg.name === 'string' ? pkg.name.trim() : '';
    if (!name) return fail(400, 'package', 'Which name? Send {"name": "your name"}', 'The package needs a "name" field with some text in it.', sent);
    if (name.length > 60) return fail(400, 'package', 'Name too long.', 'Keep the name under 60 characters.', sent);
    const k = await makeKey();
    return reply(201, {
      created: 'key', name, key: k,
      use_it_like_this: 'Authorization: Bearer ' + k,
      note: 'Shown once, like a real key. Keep it out of Discord, screenshots and page code. This one only opens Aarav\'s door.',
      next: 'POST /aarav/diagnoses with the package {"workflow": "..."} and this key in the Authorization header.',
      you_sent: sent
    }, { location: '/aarav/keys' });
  }

  const wf = pkg.workflow;
  if (wf === undefined) return fail(400, 'package', "Can't read. Send {\"workflow\": \"...\"}", 'No "workflow" field found. Fields you sent: ' + (Object.keys(pkg).join(', ') || 'none') + '. The name must match exactly.', sent);
  if (typeof wf !== 'string' || !wf.trim()) return fail(400, 'package', 'The workflow must be text.', 'Put the description inside quotes: {"workflow": "I open Jira, ..."}', sent);
  if (wf.length > MAX_WORKFLOW) return fail(400, 'package', 'Workflow too long.', 'Keep it under ' + MAX_WORKFLOW + ' characters.', sent);
  if (wf.trim().split(/\s+/).length < 4) return fail(400, 'package', 'Too little to diagnose.', 'Describe the steps: what you open, what you do, who gets the result, and how long it takes.', sent);

  if (door === '/workflows') {
    const id = 'wf_' + randomId(6);
    return reply(201, { created: 'workflow', id, workflow: wf, next: 'For a diagnosis, POST the same package to /aarav/diagnoses.', note: NO_MEMORY, you_sent: sent }, { location: '/aarav/workflows/' + id });
  }
  const id = 'dg_' + randomId(6);
  return reply(201, {
    created: 'diagnosis', id, workflow: wf,
    diagnosis: diagnose(wf),
    note: 'Same request, same diagnosis, every time. This machine follows rules; a model would not. ' + NO_MEMORY,
    you_sent: sent
  }, { location: '/aarav/diagnoses/' + id });
}

/* Vercel Web-handler exports: one function answers every method, so the machine (not the platform) decides 405 */
export const GET = handle, POST = handle, PUT = handle, PATCH = handle, DELETE = handle, OPTIONS = handle, HEAD = handle;
