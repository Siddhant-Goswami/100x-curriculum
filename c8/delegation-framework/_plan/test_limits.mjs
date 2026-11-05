/* Limits + sign-in test. Needs a local Redis: redis-server --port 6399 --save "" --daemonize yes
   Run: node c8/delegation-framework/_plan/test_limits.mjs $PWD/api/verify.mjs   (fakes Google and Jev; FLUSHALLs port 6399) */
import net from 'node:net';
import { generateKeyPairSync, createSign } from 'node:crypto';
process.env.GOOGLE_CLIENT_ID = 'cid'; process.env.SESSION_SECRET = 'sekret'; process.env.TYPESAFE_API_KEY = 'k';
process.env.KV_REST_API_URL = 'http://upstash.test'; process.env.KV_REST_API_TOKEN = 't'; process.env.EVAL_KEY = 'ek';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256' });
function token(o) {
  const b = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const h = b({ alg: 'RS256', kid: 'k1' }), p = b(Object.assign({ aud: 'cid', iss: 'https://accounts.google.com', exp: Date.now() / 1000 + 600, email_verified: true, sub: '123', email: 'learner@gmail.com' }, o));
  return h + '.' + p + '.' + createSign('RSA-SHA256').update(h + '.' + p).sign(privateKey).toString('base64url');
}
function resp(cmd) { return new Promise((ok, no) => { const s = net.connect(6399); let buf = '';
  s.write('*' + cmd.length + '\r\n' + cmd.map(a => { a = String(a); return '$' + Buffer.byteLength(a) + '\r\n' + a + '\r\n'; }).join(''));
  s.on('data', d => { buf += d; try { const [v, rest] = parse(buf); if (rest === '') { s.end(); ok(v); } } catch (e) { } }); s.on('error', no); }); }
function parse(b) { const t = b[0], i = b.indexOf('\r\n'); if (i < 0) throw 0; const line = b.slice(1, i); let rest = b.slice(i + 2);
  if (t === '+') return [line, rest]; if (t === '-') return [{ error: line }, rest]; if (t === ':') return [+line, rest];
  if (t === '$') { const n = +line; if (n < 0) return [null, rest]; if (Buffer.byteLength(rest) < n + 2) throw 0; return [rest.slice(0, n), rest.slice(n + 2)]; }
  if (t === '*') { const n = +line; if (n < 0) return [null, rest]; const out = []; for (let k = 0; k < n; k++) { const [v, r] = parse(rest); out.push(v); rest = r; } return [out, rest]; } throw 0; }
let jevCalls = 0, redisCmds = 0, jevFail = false;
const noul = v => ({ noul: v });
globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.includes('googleapis')) return new Response(JSON.stringify({ keys: [jwk] }));
  if (url.includes('upstash.test')) { redisCmds++; const v = await resp(JSON.parse(opt.body)); return new Response(JSON.stringify(v && v.error ? v : { result: v })); }
  if (url.includes('typesafe')) { jevCalls++; if (jevFail) return new Response('x', { status: 500 });
    const pr = { probabilities: { deterministic: .7, probabilistic: .2, human: .1 }, choice: 'deterministic' };
    return new Response(JSON.stringify({ model: 'jev', answers: { bucket_a: pr, bucket_b: pr, rule: noul(.9), criteria: noul(.8), live: noul(.1), reach: noul(.9), undo: noul(.7), specific: noul(.9), is_rule: noul(.9), is_clear: noul(.9), fits: noul(.9) } })); }
  throw new Error('unexpected ' + url);
};
const { handle } = await import(process.argv[2]);
const H = 'https://site.test';
async function call(q, body, { cookie, origin = H, method = 'POST', ip = '1.1.1.1', evalKey } = {}) {
  const h = { host: 'site.test', 'x-forwarded-for': ip, 'content-type': 'application/json' };
  if (cookie) h.cookie = cookie; if (origin) h.origin = origin; if (evalKey) h['x-eval-key'] = evalKey;
  const r = await handle(new Request(H + '/api/verify' + q, { method, headers: h, body: method === 'POST' ? JSON.stringify(body) : undefined }));
  return { status: r.status, body: await r.json().catch(() => null), setCookie: r.headers.get('set-cookie') };
}
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const tasks = n => ({ job: 'analyst', tasks: Array.from({ length: n }, (_, i) => ({ task: 'task ' + i + ' ' + Math.random(), how_often: 'weekly' })) });

let r = await call('', tasks(2)); ok(r.status === 401 && r.body.signin, 'signed out -> 401 signin');
r = await call('', tasks(2), { origin: 'https://evil.test' }); ok(r.status === 403, 'other origin -> 403');
r = await call('?step=me', null, { method: 'GET' }); ok(r.body.client_id === 'cid' && !r.body.signed_in, 'me: signed out, client id');
r = await call('?step=login', { credential: token({ aud: 'other' }) }); ok(r.status === 401, 'wrong audience rejected');
r = await call('?step=login', { credential: token({ email_verified: false }) }); ok(r.status === 401, 'unverified email rejected');
r = await call('?step=login', { credential: token({}).slice(0, -4) + 'AAAA' }); ok(r.status === 401, 'bad signature rejected');
r = await call('?step=login', { credential: token({}) }); const ck = r.setCookie.split(';')[0]; ok(r.status === 200 && /HttpOnly/.test(r.setCookie), 'login sets cookie');
ok(redisCmds === 0, 'sign-in and rejections cost 0 Redis commands');
r = await call('?step=me', null, { method: 'GET', cookie: ck }); ok(r.body.signed_in && r.body.email === 'learner@gmail.com', 'me: signed in, shows email');
const parts = ck.split('.'); parts[2] = Buffer.from('boss@gmail.com').toString('base64url');
r = await call('?step=me', null, { method: 'GET', cookie: parts.join('.') }); ok(!r.body.signed_in, 'swapped email in cookie -> signed out');
r = await call('', tasks(1), { cookie: ck.replace(/.$/, 'x') }); ok(r.status === 401, 'forged cookie -> 401');

const t5 = tasks(5); let before = jevCalls, rc = redisCmds;
r = await call('', t5, { cookie: ck }); ok(r.body.tasks.length === 5 && r.body.tasks.every(t => t.bucket === 'det') && jevCalls - before === 5, 'sorts 5 tasks with 5 Jev calls');
ok(redisCmds - rc === 2 && r.body.left === 55, '2 Redis commands, 55 left (got ' + (redisCmds - rc) + ', ' + r.body.left + ')');
before = jevCalls; r = await call('', t5, { cookie: ck }); ok(jevCalls === before && r.body.left === 55 && r.body.tasks[0].bucket === 'det', 'same tasks again: cached, free');
r = await call('', t5, { cookie: ck }); r = await call('', t5, { cookie: ck }); r = await call('', t5, { cookie: ck }); ok(r.status === 429, 'burst: 5th request in a minute -> 429');
await resp(['DEL', ...(await resp(['KEYS', 'df:b:*']))]);
await resp(['SET', (await resp(['KEYS', 'df:d:*']))[0], 57]);
before = jevCalls; r = await call('', tasks(5), { cookie: ck });
ok(r.body.tasks.filter(t => t.fallback).length === 2 && jevCalls - before === 3 && r.body.limited === 'limit' && r.body.left === 0, 'daily limit: 3 sorted, 2 by hand');
await resp(['DEL', ...(await resp(['KEYS', 'df:b:*']))]);
before = jevCalls; r = await call('', tasks(2), { cookie: ck }); ok(r.body.fallback && r.body.limited && jevCalls === before, 'at limit: whole request by hand, no Jev');
await resp(['FLUSHALL']);
jevFail = true; r = await call('', tasks(3), { cookie: ck }); jevFail = false;
const d = await resp(['GET', (await resp(['KEYS', 'df:d:*']))[0]]); ok(r.body.fallback && +d === 0, 'Jev down: fallback and quota refunded (used ' + d + ')');
r = await call('?step=check', { items: [{ task: 'a', check: 'totals match', bucket: 'det' }, { task: 'b', check: 'x', bucket: 'prob' }] }, { cookie: ck });
ok(r.body.items.length === 2 && r.body.items[0].verified, 'check step works');
await resp(['SET', (await resp(['KEYS', 'df:g:*']))[0], 1500]);
before = jevCalls; r = await call('', tasks(2), { cookie: ck, ip: '2.2.2.2' }); ok(r.body.fallback && jevCalls === before, 'site daily cap: by hand, no Jev');
await resp(['FLUSHALL']); await resp(['SET', 'df:ops:' + new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), 15000]);
r = await call('', tasks(2), { cookie: ck, ip: '3.3.3.3' }); rc = redisCmds; r = await call('', tasks(2), { cookie: ck, ip: '3.3.3.3' });
ok(r.body.fallback && redisCmds === rc, 'Redis command ceiling: site closes, later requests skip Redis');
