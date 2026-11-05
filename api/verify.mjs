/* Delegation framework: sorts a learner's own tasks into three buckets by how the work can be checked.
   Page: /c8/delegation-framework. Plan: c8/delegation-framework/_plan/custom_tasks_plan.md
     POST /api/verify             {job, tasks:[{task, how_often}]}  ->  {tasks:[{bucket, p, reason, ask, undo, sig}], model}
     POST /api/verify?step=check  {task, check, bucket}             ->  {bucket, verified, note, model}
                                  or {items:[{task, check, bucket}]} ->  {items:[{bucket, verified, note}], model}
   Jev answers narrow questions; every threshold and sum lives here in code (jaggedness notes 1, 2, 8).
     GET  /api/verify?step=me     ->  {signed_in, client_id}
     POST /api/verify?step=login  {credential}  (Google ID token)  ->  sets the df_s cookie
     POST /api/verify?step=logout
   Jev costs money, so sorting needs a Google sign-in, and every Jev call is counted per person, per IP and for the
   whole site in Upstash Redis (free plan). Same task again = cached, free. Plan: c8/delegation-framework/_plan/rate_limit_plan.md
   On a bad key, a 5xx, a timeout, a limit or Redis being down the page gets {fallback:true} and asks the learner instead.
   Logs the model version and buckets only, never task text. No dependencies, like aarav.mjs. */

const API = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0'; /* pinned: thresholds are tuned against this version */
const TIMEOUT = 8000;
const LIMIT = { tasks: 12, task: 200, check: 400, job: 80 };
const RATE = { limit: 20, windowMs: 10 * 60000 }; /* per warm instance, before Redis, so floods cost no Redis commands */
const OFTEN = ['daily', 'few_week', 'weekly', 'monthly', 'quarterly'];
const hits = new Map(); /* per warm instance only; best effort */

/* ---------- the rubric: section 2 of the plan, word for word ---------- */
export const CRITERIA = {
  deterministic: 'A finished version can be checked by a fixed rule with one right answer: totals match, a format or field is present, a file exists, a test passes, a value is inside a limit. A program could run the check without any opinion.',
  probabilistic: 'There are several acceptable versions, so checking needs judgement, but that judgement can be written as specific criteria, like a rubric or checklist, that two careful reviewers would apply and agree on. The output can be reviewed as text, data or a file soon after it is made.',
  human: "The quality can't be written as criteria two reviewers would agree on, or the result shows up only much later, or the task happens live with people, by hand in the physical world, or needs a person's authority or signature."
};
const B = { deterministic: 'det', probabilistic: 'prob', human: 'hum' };
const ORDER_A = ['deterministic', 'probabilistic', 'human'];
const ORDER_B = ['human', 'probabilistic', 'deterministic'];

function pick(keys) { const o = {}; keys.forEach(k => { o[k] = CRITERIA[k] }); return o; }
export function sortQuestions() {
  const ask = 'How can a finished version of `task` be checked?';
  return {
    bucket_a: { type: 'choice', instructions: ask, criteria: pick(ORDER_A) },
    bucket_b: { type: 'choice', instructions: ask, criteria: pick(ORDER_B) },
    rule: { type: 'noul', instructions: 'Could a program check a finished `task` with a fixed pass/fail rule?',
      criteria: { true: 'A fixed rule with one right answer, such as totals match, a field is present, a file exists, a value is inside a limit', false: 'Checking it needs an opinion or judgement' } },
    criteria: { type: 'noul', instructions: 'Could the person write down criteria for a good `task` that two reviewers would apply the same way?',
      criteria: { true: 'Specific criteria, like a rubric or checklist, that two careful reviewers would agree on', false: 'Good and bad depend on taste, relationships or results that show up much later' } },
    live: { type: 'noul', instructions: "Does `task` happen live with people, by hand in the physical world, or need the person's signature or authority?" },
    reach: { type: 'noul', instructions: 'Are the inputs `task` needs available on a computer, as files, data, email or apps?',
      criteria: { true: 'An AI agent with access to the person\'s computer accounts could open what the task needs', false: 'The inputs exist only in a physical place, in a live conversation, or in someone\'s head' } },
    undo: { type: 'noul', instructions: "If `task` were done wrong, could the mistake be caught and undone before it reaches a client, money or another person's numbers?" },
    specific: { type: 'noul', instructions: 'Is `task` one specific, repeatable task?',
      criteria: { true: 'One task with a clear output, such as "send the weekly sales summary to the regional head"', false: 'A broad area of work, such as "reporting" or "operations"' } }
  };
}
export function checkQuestions() {
  return {
    is_rule: { type: 'noul', instructions: 'Is `check` a fixed rule a program could apply with a pass or fail result?' },
    is_clear: { type: 'noul', instructions: 'Is `check` specific enough that two careful reviewers would reach the same verdict on the same output?' },
    fits: { type: 'noul', instructions: 'Does `check` test whether `task` was done well, rather than something unrelated?' }
  };
}

/* ---------- combining the answers: all code, no model ---------- */
/* Thresholds, tuned on _plan/gold.csv (see _plan/eval_log.md). The page's decide() uses the same numbers. */
export const T = { live: 0.5, reach: 0.2, rule: 0.3, criteria: 0.4, fence: 0, top: 0.6, specific: 0.3, isRule: 0.7, isClear: 0.45, fits: 0.6 };
function argmax(p) { return Object.keys(p).reduce((a, b) => (p[b] > p[a] ? b : a)); }
const REASON = {
  rule: 'a rule can check it', criteria: 'you can write the criteria', hum: "the quality can't be written as criteria",
  live: 'happens live, by hand or under your signature', reach: "the agent can't reach the inputs",
  norule: 'no fixed rule checks it, so it needs judgement', nocriteria: "the criteria aren't clear enough to write down"
};
/* The page runs the same decide() after the learner answers; a 0 or 1 there is a person's answer and outranks Jev. */
export function decide(s) {
  let b = argmax(s.p), why = b === 'det' ? 'rule' : b === 'prob' ? 'criteria' : 'hum';
  if (s.live > T.live) return { bucket: 'hum', why: 'live' };
  if (s.reach < T.reach) return { bucket: 'hum', why: 'reach' };
  if (s.rule === 1) return { bucket: 'det', why: 'rule' };
  if (s.criteria === 1 && b === 'hum') { b = 'prob'; why = 'criteria'; }
  if (b === 'det' && s.rule < T.rule) { b = 'prob'; why = 'norule'; }
  if (b === 'prob' && s.criteria < T.criteria) { b = 'hum'; why = 'nocriteria'; }
  return { bucket: b, why };
}
/* At most one question per task: split a vague task first; otherwise only a question whose answer would change the bucket:
   a guardrail sitting on the fence, or, when the two orderings disagree or the top bucket is weak, rule or criteria. */
export function judge(sig) {
  const d = decide(sig), shaky = !sig.agree || sig.p[argmax(sig.p)] < T.top;
  const flips = k => decide(Object.assign({}, sig, { [k]: 1 })).bucket !== decide(Object.assign({}, sig, { [k]: 0 })).bucket;
  const fence = k => Math.abs(sig[k] - 0.5) <= T.fence;
  if (sig.specific < T.specific) return { bucket: d.bucket, p: +sig.p[d.bucket].toFixed(3), reason: REASON[d.why], ask: ['split'] };
  const ask = ['live', 'reach', 'rule', 'criteria']
    .filter(k => flips(k) && (fence(k) || (shaky && (k === 'rule' || k === 'criteria'))))
    .sort((a, b) => Math.abs(sig[a] - 0.5) - Math.abs(sig[b] - 0.5)).slice(0, 1);
  return { bucket: d.bucket, p: +sig.p[d.bucket].toFixed(3), reason: REASON[d.why], ask };
}
export function signals(ans) {
  const pa = ans.bucket_a.probabilities, pb = ans.bucket_b.probabilities, p = {};
  ORDER_A.forEach(k => { p[B[k]] = ((pa[k] || 0) + (pb[k] || 0)) / 2; });
  const n = k => ans[k].noul;
  return round({ p, rule: n('rule'), criteria: n('criteria'), live: n('live'), reach: n('reach'), specific: n('specific'),
    agree: ans.bucket_a.choice === ans.bucket_b.choice });
}
export function classify(ans) {
  const sig = signals(ans);
  return Object.assign(judge(sig), { undo: +ans.undo.noul.toFixed(3), sig });
}
/* A violet task is never promoted to amber by its criteria: a rubric that looks rule-like still needs judgement,
   and promotion would let a judgement task run Autonomous. */
export function judgeSig(bucket, n) {
  const ok = (v, t) => v >= t;
  if (bucket === 'det') {
    if (ok(n.is_rule, T.isRule) && ok(n.fits, T.fits)) return { bucket: 'det', verified: true, note: 'A program could run this check.' };
    const v = ok(n.is_clear, T.isClear) && ok(n.fits, T.fits);
    return { bucket: 'prob', verified: v, note: v ? 'No program could run this, but a judge could apply it the same way every time, so it counts as criteria.' : 'This check needs judgement; write it as criteria.' };
  }
  if (ok(n.is_clear, T.isClear) && ok(n.fits, T.fits)) return { bucket: 'prob', verified: true, note: 'Verified judgement: an LLM judge can apply these criteria.' };
  return { bucket: 'prob', verified: false, note: !ok(n.fits, T.fits) ? "This doesn't test the task itself. What would a good one have?" : 'Make the criteria specific: what exactly would you look for?' };
}
export function judgeCheck(bucket, ans) {
  const n = round({ is_rule: ans.is_rule.noul, is_clear: ans.is_clear.noul, fits: ans.fits.noul });
  return Object.assign(judgeSig(bucket, n), { sig: n });
}
function round(o) { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v))); }

/* ---------- calling Jev ---------- */
class Down extends Error {}
export async function jev(state, questions, key) {
  for (let tries = 0; tries < 2; tries++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    let res;
    try {
      res = await fetch(API, { method: 'POST', signal: ctl.signal,
        headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, state, questions }) });
    } catch (e) { throw new Down('timeout'); } finally { clearTimeout(timer); }
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status === 529) && !tries) {
      const wait = Math.min(3, +res.headers.get('retry-after') || 1);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Down('status ' + res.status); /* the body is never passed on */
  }
  throw new Down('rate');
}

/* ---------- sign-in: Google's button on the page, then our own signed cookie ---------- */
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const SECRET = process.env.SESSION_SECRET || '';
const EVAL_KEY = process.env.EVAL_KEY || ''; /* lets _plan/eval_verify.mjs --via call without a browser */
const SESSION_S = 14 * 86400;
const enc = new TextEncoder();
const unb64u = s => Buffer.from(s, 'base64url');
async function sha(s) { return Buffer.from(await crypto.subtle.digest('SHA-256', enc.encode(s))).toString('hex'); }
async function hmac(s) {
  const k = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Buffer.from(await crypto.subtle.sign('HMAC', k, enc.encode(s))).toString('base64url');
}
let certs = { at: 0, keys: [] };
async function googleKeys() {
  if (certs.keys.length && Date.now() - certs.at < 3600e3) return certs.keys;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  certs = { at: Date.now(), keys: (await r.json()).keys || [] };
  return certs.keys;
}
/* Checks Google's ID token ourselves: RS256 signature, audience, issuer, expiry, verified email. */
export async function verifyGoogle(token) {
  try {
    const [h, p, s] = String(token || '').split('.');
    const head = JSON.parse(unb64u(h)), body = JSON.parse(unb64u(p));
    const jwk = head.alg === 'RS256' && (await googleKeys()).find(k => k.kid === head.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(h + '.' + p)))) return null;
    if (body.aud !== GOOGLE_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(body.iss)) return null;
    if (body.exp * 1000 < Date.now() || !body.email_verified) return null;
    return body;
  } catch (e) { return null; }
}
/* df_s = uid.expiry.email.hmac. uid is a hash of Google's user id; the email rides only in the learner's own cookie
   so the page can say who is signed in. Nothing about the person is stored on our side. */
async function session(request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)df_s=([a-f0-9]+)\.(\d+)\.([\w-]*)\.([\w-]+)/);
  if (!m || !SECRET || +m[2] * 1000 < Date.now()) return null;
  if ((await hmac(m[1] + '.' + m[2] + '.' + m[3])) !== m[4]) return null;
  return { uid: m[1], email: Buffer.from(m[3], 'base64url').toString() };
}
const cookie = (v, age) => 'df_s=' + v + '; Path=/api/verify; Max-Age=' + age + '; HttpOnly; Secure; SameSite=Lax';

/* ---------- limits: Upstash Redis over REST, free plan ----------
   Free plan: 500K commands a month. A request costs at most 2 commands (one script to check and take, one to cache),
   and the script stops the site at OPS a day (15,000 x 31 = 465K), so the month can't run past the free plan.
   Limits count Jev calls (one per task), because that is what costs money. Cache hits are free. */
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIM = { ops: 15000, burst: 4, day: 60, all: 300, ip: 120, site: +process.env.JEV_DAILY_CAP || 1500 };
const CACHE_S = 30 * 86400;
let closedDay = ''; /* once the site cap is hit, this instance stops asking Redis until tomorrow */
async function redis(cmd) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch(R_URL, { method: 'POST', signal: ctl.signal, headers: { authorization: 'Bearer ' + R_TOKEN }, body: JSON.stringify(cmd) });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d.result;
  } finally { clearTimeout(timer); }
}
/* KEYS: ops, burst, user day, user total, ip hour, site day, then cache keys. ARGV: the caps in the same order.
   Returns {-1} site closed, {-2, wait} too fast, else {room, left today, cached values ('' = miss)...}. */
const TAKE = `
local ops = redis.call('INCRBY', KEYS[1], 2)
if ops <= 2 then redis.call('EXPIRE', KEYS[1], 90000) end
if ops > tonumber(ARGV[1]) then return {-1} end
local b = redis.call('INCR', KEYS[2])
if b == 1 then redis.call('EXPIRE', KEYS[2], 60) end
if b > tonumber(ARGV[2]) then return {-2, redis.call('TTL', KEYS[2])} end
local out, miss = {0, 0}, 0
for i = 7, #KEYS do local v = redis.call('GET', KEYS[i]); out[#out + 1] = v or ''; if not v then miss = miss + 1 end end
local room = miss
for i = 3, 6 do local left = tonumber(ARGV[i]) - tonumber(redis.call('GET', KEYS[i]) or '0'); if left < room then room = left end end
if room < 0 then room = 0 end
local ttl = {0, 0, 90000, 0, 3600, 90000}
if room > 0 then for i = 3, 6 do if redis.call('INCRBY', KEYS[i], room) == room and ttl[i] > 0 then redis.call('EXPIRE', KEYS[i], ttl[i]) end end end
out[1] = room
out[2] = tonumber(ARGV[3]) - tonumber(redis.call('GET', KEYS[3]) or '0')
return out`;
/* KEYS: user day, user total, ip hour, site day, then cache keys. ARGV: refund, cache seconds, values. */
const PUT = `
local r = tonumber(ARGV[1])
if r > 0 then for i = 1, 4 do redis.call('DECRBY', KEYS[i], r) end end
for i = 5, #KEYS do redis.call('SET', KEYS[i], ARGV[i - 2], 'EX', ARGV[2]) end
return 1`;
const istDay = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

class Stop extends Error { constructor(status, body) { super(body.error || 'stop'); this.status = status; this.body = body; } }
/* Runs call(i) for every item not in the cache, as far as the limits allow. Returns the values (null = sort by hand). */
async function metered(uid, ip, cks, call) {
  const day = istDay();
  if (closedDay === day) return { vals: cks.map(() => null), limited: 'site', left: 0, cached: 0 };
  const K = ['df:ops:' + day, 'df:b:' + uid, 'df:d:' + day + ':' + uid, 'df:a:' + uid, 'df:i:' + ip + ':' + Math.floor(Date.now() / 3600e3), 'df:g:' + day];
  const caps = uid === 'eval' ? [LIM.ops, 60, 1e6, 1e9, 1e6, LIM.site] : [LIM.ops, LIM.burst, LIM.day, LIM.all, LIM.ip, LIM.site];
  const r = await redis(['EVAL', TAKE, String(K.length + cks.length), ...K, ...cks, ...caps.map(String)]);
  if (r[0] === -1) { closedDay = day; return { vals: cks.map(() => null), limited: 'site', left: 0, cached: 0 }; }
  if (r[0] === -2) throw new Stop(429, { error: 'Too many at once. Try again in a minute.', retry_after: r[1] });
  let room = r[0];
  const vals = cks.map((k, i) => (r[2 + i] ? JSON.parse(r[2 + i]) : null)), cached = vals.filter(Boolean).length;
  const run = vals.map((v, i) => (v ? -1 : i)).filter(i => i >= 0), todo = run.slice(0, room);
  const got = await Promise.allSettled(todo.map(i => call(i)));
  const fresh = [], put = [];
  got.forEach((g, n) => { if (g.status === 'fulfilled') { vals[todo[n]] = g.value; put.push(cks[todo[n]]); fresh.push(JSON.stringify(g.value)); } });
  const refund = got.length - put.length;
  if (refund || put.length) await redis(['EVAL', PUT, String(4 + put.length), ...K.slice(2), ...put, String(refund), String(CACHE_S), ...fresh]).catch(() => {});
  const down = got.find(g => g.status === 'rejected');
  return { vals, limited: run.length > todo.length ? 'limit' : '', down: down && down.reason.message, left: Math.max(0, r[1] + refund), cached };
}

/* ---------- the endpoint ---------- */
function headers(extra) {
  return Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra);
}
const reply = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: headers(extra) });
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function rateHit(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE.limit ? Math.ceil((RATE.windowMs - (now - arr[0])) / 1000) : 0;
}
/* Only this site's pages may call it. Scripts can fake Origin, so the sign-in is the real gate; this stops other sites. */
function sameSite(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { return new URL(o).host === request.headers.get('host'); } catch (e) { return false; }
}

export async function handle(request) {
  if (!sameSite(request)) return reply(403, { error: 'Not from this site.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const step = new URL(request.url).searchParams.get('step');
  if (request.method === 'GET' && step === 'me') { const me = await session(request); return reply(200, { signed_in: !!me, email: me ? me.email : null, client_id: GOOGLE_ID || null }); }
  if (request.method !== 'POST') return reply(405, { error: 'POST only.' });
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  const wait = rateHit(ip);
  if (wait) return reply(429, { error: 'Too many sorts. Try again in ' + Math.ceil(wait / 60) + ' min.', retry_after: wait });

  let body;
  try { body = await request.json(); } catch (e) { return reply(400, { error: 'Send JSON.' }); }

  if (step === 'logout') return reply(200, { ok: true }, { 'set-cookie': cookie('', 0) });
  if (step === 'login') {
    if (!GOOGLE_ID || !SECRET) return reply(503, { error: 'Sign-in is not set up yet.' });
    const g = await verifyGoogle(body.credential);
    if (!g) return reply(401, { error: 'That sign-in did not work. Try again.' });
    const uid = (await sha('google:' + g.sub)).slice(0, 24), exp = Math.floor(Date.now() / 1000) + SESSION_S;
    const v = uid + '.' + exp + '.' + Buffer.from(String(g.email || '')).toString('base64url');
    console.log(JSON.stringify({ step: 'login' }));
    return reply(200, { ok: true, email: g.email || '' }, { 'set-cookie': cookie(v + '.' + (await hmac(v)), SESSION_S) });
  }

  let uid = ((await session(request)) || {}).uid;
  if (!uid && EVAL_KEY && request.headers.get('x-eval-key') === EVAL_KEY) uid = 'eval';
  if (!uid) return reply(401, { signin: true, error: 'Sign in to sort with Jev.' });
  const key = process.env.TYPESAFE_API_KEY, off = !key || process.env.JEV_OFF === '1' || !R_URL || !R_TOKEN;

  if (step === 'check') {
    /* one check {task, check, bucket}, or several as {items:[...]} so a whole week costs one request */
    const many = Array.isArray(body.items), items = (many ? body.items : [body]).slice(0, LIMIT.tasks)
      .map(c => ({ task: clean(c && c.task, LIMIT.task), check: clean(c && c.check, LIMIT.check), bucket: c && c.bucket === 'det' ? 'det' : 'prob' }));
    if (!items.length || items.some(c => !c.task || !c.check)) return reply(400, { error: 'Send {task, check, bucket} or {items:[{task, check, bucket}]}.' });
    if (off) return reply(200, { fallback: true });
    try {
      const qs = checkQuestions();
      const cks = await Promise.all(items.map(c => sha([MODEL, 'check', c.task, c.check].join('\n')).then(h => 'df:c:' + h.slice(0, 32))));
      const m = await metered(uid, ip, cks, i => jev({ task: items[i].task, check: items[i].check }, qs, key)
        .then(r => ({ is_rule: +r.answers.is_rule.noul.toFixed(3), is_clear: +r.answers.is_clear.noul.toFixed(3), fits: +r.answers.fits.noul.toFixed(3) })));
      if (m.vals.every(v => !v)) { console.log(JSON.stringify({ step: 'check', fallback: m.limited || m.down })); return reply(200, { fallback: true, limited: m.limited, left: m.left }); }
      const out = m.vals.map((n, i) => (n ? Object.assign(judgeSig(items[i].bucket, n), { sig: n }) : { fallback: true }));
      console.log(JSON.stringify({ step: 'check', model: MODEL, cached: m.cached, limited: m.limited, left: m.left, moves: out.map((o, i) => o.fallback ? 'x' : items[i].bucket + '>' + o.bucket + (o.verified ? '+' : '-')) }));
      const extra = { model: MODEL, left: m.left, limited: m.limited };
      return reply(200, many ? Object.assign({ items: out }, extra) : Object.assign(out[0], extra));
    } catch (e) {
      if (e instanceof Stop) return reply(e.status, e.body);
      console.log(JSON.stringify({ step: 'check', fallback: e.message })); return reply(200, { fallback: true });
    }
  }

  const job = clean(body.job, LIMIT.job);
  const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, LIMIT.tasks)
    .map(t => ({ task: clean(t && t.task, LIMIT.task), how_often: OFTEN.includes(t && t.how_often) ? t.how_often : 'weekly' }))
    .filter(t => t.task);
  if (!tasks.length) return reply(400, { error: 'Send {job, tasks:[{task, how_often}]} with at least one task.' });
  if (off) return reply(200, { fallback: true });
  try {
    const qs = sortQuestions();
    /* the cache keeps Jev's signals, not the bucket, so changing T re-sorts cached tasks correctly */
    const cks = await Promise.all(tasks.map(t => sha([MODEL, 'sort', job, t.task, t.how_often].join('\n')).then(h => 'df:s:' + h.slice(0, 32))));
    const m = await metered(uid, ip, cks, i => jev({ job, task: tasks[i].task, how_often: tasks[i].how_often.replace('_', ' a ') }, qs, key)
      .then(r => ({ sig: signals(r.answers), undo: +r.answers.undo.noul.toFixed(3) })));
    if (m.vals.every(v => !v)) { console.log(JSON.stringify({ step: 'sort', fallback: m.limited || m.down })); return reply(200, { fallback: true, limited: m.limited, left: m.left }); }
    const out = m.vals.map(v => (v ? Object.assign(judge(v.sig), { undo: v.undo, sig: v.sig }) : { fallback: true }));
    console.log(JSON.stringify({ step: 'sort', model: MODEL, cached: m.cached, limited: m.limited, left: m.left, buckets: out.map(o => o.bucket || 'x'), unsure: out.filter(o => o.ask && o.ask.length).length }));
    return reply(200, { tasks: out, model: MODEL, left: m.left, limited: m.limited });
  } catch (e) {
    if (e instanceof Stop) return reply(e.status, e.body);
    console.log(JSON.stringify({ step: 'sort', fallback: e.message })); return reply(200, { fallback: true });
  }
}

export const POST = handle, OPTIONS = handle, GET = handle;
