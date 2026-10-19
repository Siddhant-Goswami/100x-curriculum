/* Scores api/verify.mjs against the hand-labelled gold set (plan section 6).
   Run from the repo root:  TYPESAFE_API_KEY=... node c8/delegation-framework/_plan/eval_verify.mjs [--checks-only] [--limit N]
   Without the key (Vercel keeps it sensitive), score the deployed endpoint instead, paced under its rate limit:
                            node c8/delegation-framework/_plan/eval_verify.mjs --via https://100x-curriculum.vercel.app
   --via saves Jev's signals per task to eval_sigs.json; --replay re-scores them with the current thresholds, no calls.
   Jev's raw answers are cached in eval_cache.json by request, so re-running after a threshold change costs nothing;
   changing the criteria text changes the request and calls Jev again. Each run appends to eval_log.md.
   Ship bar: macro-F1 >= 0.80, human recall >= 0.90, unsure rate < 25%; checks: is_clear separates at >= 0.85. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sortQuestions, checkQuestions, classify, judge, judgeCheck, judgeSig, jev } from '../../../api/verify.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CACHE = path.join(HERE, 'eval_cache.json'), LOG = path.join(HERE, 'eval_log.md');
const MODEL = 'jev-1.13.0', BUCKETS = ['det', 'prob', 'hum'], LONG = { deterministic: 'det', probabilistic: 'prob', human: 'hum' };
const args = process.argv.slice(2), limit = +(args[args.indexOf('--limit') + 1] || 0) || Infinity;

const via = args.includes('--via') ? args[args.indexOf('--via') + 1].replace(/\/$/, '') : null;
const replay = args.includes('--replay'), SIGS = path.join(HERE, 'eval_sigs.json');
const key = process.env.TYPESAFE_API_KEY;
if (!key && !via && !replay) { console.error('Set TYPESAFE_API_KEY (Vercel stores it as sensitive, so `vercel env pull` leaves it empty).'); process.exit(1); }

function csv(file) {
  const s = fs.readFileSync(path.join(HERE, file), 'utf8'), rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x)) rows.push(row); row = []; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
async function ask(state, questions) {
  const id = crypto.createHash('sha256').update(JSON.stringify([MODEL, state, questions])).digest('hex').slice(0, 24);
  if (!cache[id]) cache[id] = (await jev(state, questions, key)).answers;
  return cache[id];
}
async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}
/* --via: 12 per call, one call every 40 s, so at most 15 land in the same 10 minutes */
let last = 0;
async function remote(q, body) {
  const wait = last + 40000 - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
  const d = await (await fetch(via + '/api/verify' + q, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  if (d.fallback || d.error) throw new Error('endpoint: ' + JSON.stringify(d));
  return d;
}
async function viaChunks(items, size, fn) { const out = []; for (let i = 0; i < items.length; i += size) { out.push(...await fn(items.slice(i, i + size))); process.stderr.write('.'); } return out; }
const pct = x => (100 * x).toFixed(1) + '%';

function report(rows) {
  const m = {}; BUCKETS.forEach(a => { m[a] = {}; BUCKETS.forEach(b => { m[a][b] = 0; }); });
  rows.forEach(r => { m[r.gold][r.got]++; });
  const f1 = BUCKETS.map(b => {
    const tp = m[b][b], fp = BUCKETS.reduce((s, a) => s + (a !== b ? m[a][b] : 0), 0), fn = BUCKETS.reduce((s, a) => s + (a !== b ? m[b][a] : 0), 0);
    const p = tp / (tp + fp || 1), r = tp / (tp + fn || 1);
    return { b, p, r, f1: p + r ? 2 * p * r / (p + r) : 0 };
  });
  return {
    n: rows.length,
    acc: rows.filter(r => r.gold === r.got).length / (rows.length || 1),
    macroF1: f1.reduce((s, x) => s + x.f1, 0) / 3,
    humRecall: f1[2].r,
    disagree: rows.filter(r => !r.agree).length / (rows.length || 1),
    unsure: rows.filter(r => r.unsure).length / (rows.length || 1),
    split: rows.filter(r => r.split).length / (rows.length || 1),
    f1, m
  };
}
function table(R) {
  return '| gold \\ got | det | prob | hum |\n|---|---|---|---|\n' + BUCKETS.map(a => '| ' + a + ' | ' + BUCKETS.map(b => R.m[a][b]).join(' | ') + ' |').join('\n');
}

const toSave = {}, toSaveChecks = {};
const savedChecks = replay && fs.existsSync(SIGS) ? JSON.parse(fs.readFileSync(SIGS, 'utf8')).checks || {} : {};
const lines = ['', '## Run ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + MODEL + (via ? ' · via ' + via : replay ? ' · replay of eval_sigs.json' : ''), ''];

if (!args.includes('--checks-only')) {
  const gold = csv('gold.csv').slice(0, limit);
  const qs = sortQuestions();
  const saved = replay ? JSON.parse(fs.readFileSync(SIGS, 'utf8')).sigs : {};
  const row = (g, c) => ({ id: g.id, gold: LONG[g.bucket], got: c.bucket, agree: c.sig.agree, unsure: c.ask.some(k => k !== 'split'), split: c.ask.includes('split'), asks: c.ask, region: g.profile || g.region, lang: g.lang, task: g.task });
  const rows = replay ? gold.filter(g => saved[g.id]).map(g => row(g, Object.assign(judge(saved[g.id]), { sig: saved[g.id] })))
  : via ? await viaChunks(gold, 12, async gs => {
    const d = await remote('', { job: 'mixed', tasks: gs.map(g => ({ task: g.task, how_often: g.how_often })) });
    d.tasks.forEach((c, i) => { toSave[gs[i].id] = c.sig; });
    return d.tasks.map((c, i) => row(gs[i], c));
  }) : await pool(gold, 8, async g => {
    const a = await ask({ job: g.job, task: g.task, how_often: g.how_often.replace('_', ' a ') }, qs);
    const c = classify(a);
    return { id: g.id, gold: LONG[g.bucket], got: c.bucket, agree: c.sig.agree, unsure: c.ask.some(k => k !== 'split'), split: c.ask.includes('split'), asks: c.ask, region: g.region, lang: g.lang, task: g.task };
  });
  const R = report(rows), bar = R.macroF1 >= 0.8 && R.humRecall >= 0.9 && R.unsure < 0.25;
  lines.push('**Sort, ' + R.n + ' tasks.** Accuracy ' + pct(R.acc) + ' · macro-F1 ' + R.macroF1.toFixed(3) + ' · human recall ' + pct(R.humRecall) +
    ' · a/b disagree ' + pct(R.disagree) + ' · unsure ' + pct(R.unsure) + ' · split asked ' + pct(R.split) + ' · ship bar ' + (bar ? 'MET' : 'not met'), '');
  lines.push(R.f1.map(x => '- ' + x.b + ': precision ' + pct(x.p) + ', recall ' + pct(x.r) + ', F1 ' + x.f1.toFixed(3)).join('\n'), '', table(R), '');
  [...new Set(rows.map(r => r.region))].map(v => ['region', v]).forEach(([k, v]) => {
    const S = report(rows.filter(r => r[k] === v));
    lines.push('- ' + v + ' (' + S.n + '): accuracy ' + pct(S.acc) + ', macro-F1 ' + S.macroF1.toFixed(3) + ', human recall ' + pct(S.humRecall) + ', unsure ' + pct(S.unsure));
  });
  const asked = {}; rows.forEach(r => r.asks.forEach(k => { asked[k] = (asked[k] || 0) + 1; }));
  lines.push('', '- questions asked: ' + Object.entries(asked).map(([k, n]) => k + ' ' + n).join(', '));
  const miss = rows.filter(r => r.gold !== r.got);
  lines.push('', '<details><summary>' + miss.length + ' misses</summary>', '', miss.map(r => '- ' + r.id + ' ' + r.gold + ' → ' + r.got + (r.unsure ? ' (asked)' : '') + ': ' + r.task).join('\n'), '', '</details>', '');
}

if (fs.existsSync(path.join(HERE, 'checks.csv')) && (!replay || Object.keys(savedChecks).length)) {
  const checks = csv('checks.csv').slice(0, limit), qs = checkQuestions();
  const bucketOf = c => (c.kind.endsWith('rule') ? 'det' : 'prob');
  const fromSig = (c, n) => ({ c, clear: n.is_clear >= 0.6, rule: n.is_rule >= 0.6, verified: judgeSig(bucketOf(c), n).verified });
  const rows = replay ? checks.filter(c => savedChecks[c.id]).map(c => fromSig(c, savedChecks[c.id]))
  : via ? await viaChunks(checks, 12, async cs => {
    const d = await remote('?step=check', { items: cs.map(c => ({ task: c.task, check: c.check, bucket: bucketOf(c) })) });
    d.items.forEach((j, i) => { toSaveChecks[cs[i].id] = j.sig; });
    return d.items.map((j, i) => fromSig(cs[i], j.sig));
  }) : await pool(checks, 8, async c => {
    const a = await ask({ task: c.task, check: c.check }, qs);
    const j = judgeCheck(c.kind.endsWith('rule') ? 'det' : 'prob', a);
    return { c, clear: a.is_clear.noul >= 0.6, rule: a.is_rule.noul >= 0.6, verified: j.verified };
  });
  const acc = (f, e) => rows.filter(r => r[f] === (r.c[e] === '1')).length / rows.length;
  const ver = rows.filter(r => r.verified === r.c.kind.startsWith('good')).length / rows.length;
  lines.push('**Checks, ' + rows.length + '.** is_clear separates ' + pct(acc('clear', 'expect_clear')) + ' (bar 85%: ' + (acc('clear', 'expect_clear') >= 0.85 ? 'MET' : 'not met') +
    ') · is_rule ' + pct(acc('rule', 'expect_rule')) + ' · verified = good ' + pct(ver), '');
  ['good_rule', 'vague_rule', 'good_rubric', 'vague_rubric'].forEach(k => {
    const s = rows.filter(r => r.c.kind === k);
    lines.push('- ' + k + ': verified ' + s.filter(r => r.verified).length + ' of ' + s.length);
  });
  lines.push('');
}

if (via) fs.writeFileSync(SIGS, JSON.stringify({ model: MODEL, at: new Date().toISOString(), sigs: toSave, checks: toSaveChecks }));
else if (!replay) fs.writeFileSync(CACHE, JSON.stringify(cache));
if (!fs.existsSync(LOG)) fs.writeFileSync(LOG, '# Eval log: api/verify.mjs against the gold set\n\nOne entry per run of eval_verify.mjs. Tune only the criteria text and the thresholds.\n');
if (!replay) fs.appendFileSync(LOG, lines.join('\n'));
console.log(lines.join('\n'));
