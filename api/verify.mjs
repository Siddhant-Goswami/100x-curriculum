/* Delegation framework: sorts a learner's own tasks into three buckets by how the work can be checked.
   Page: /c8/delegation-framework. Plan: c8/delegation-framework/_plan/custom_tasks_plan.md
     POST /api/verify             {job, tasks:[{task, how_often}]}  ->  {tasks:[{bucket, p, reason, ask, undo, sig}], model}
     POST /api/verify?step=check  {task, check, bucket}             ->  {bucket, verified, note, model}
                                  or {items:[{task, check, bucket}]} ->  {items:[{bucket, verified, note}], model}
   Jev answers narrow questions; every threshold and sum lives here in code (jaggedness notes 1, 2, 8).
   On a bad key, a 5xx or a timeout the page gets {fallback:true} and asks the learner instead.
   Logs the model version and buckets only, never task text. No dependencies, like aarav.mjs. */

const API = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0'; /* pinned: thresholds are tuned against this version */
const TIMEOUT = 8000;
const LIMIT = { tasks: 12, task: 200, check: 400, job: 80 };
const RATE = { limit: 20, windowMs: 10 * 60000 };
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
export const T = { live: 0.5, reach: 0.2, rule: 0.3, criteria: 0.4, fence: 0, top: 0.6, specific: 0.3 };
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
export function judgeCheck(bucket, ans) {
  const r = ans.is_rule.noul, c = ans.is_clear.noul, f = ans.fits.noul, ok = v => v >= 0.6;
  if (bucket === 'det') {
    if (ok(r) && ok(f)) return { bucket: 'det', verified: true, note: 'A program could run this check.' };
    return { bucket: 'prob', verified: ok(c) && ok(f), note: 'This check needs judgement; write it as criteria.' };
  }
  if (ok(r) && ok(f)) return { bucket: 'det', verified: true, note: 'This is a fixed rule, so a program can run it.' };
  if (ok(c) && ok(f)) return { bucket: 'prob', verified: true, note: 'Verified judgement: an LLM judge can apply these criteria.' };
  return { bucket: 'prob', verified: false, note: !ok(f) ? "This doesn't test the task itself. What would a good one have?" : 'Make the criteria specific: what exactly would you look for?' };
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

/* ---------- the endpoint ---------- */
function headers() {
  return { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: headers() });
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function rateHit(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE.limit ? Math.ceil((RATE.windowMs - (now - arr[0])) / 1000) : 0;
}

export async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers() });
  if (request.method !== 'POST') return reply(405, { error: 'POST only.' });
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  const wait = rateHit(ip);
  if (wait) return reply(429, { error: 'Too many sorts. Try again in ' + Math.ceil(wait / 60) + ' min.', retry_after: wait });

  let body;
  try { body = await request.json(); } catch (e) { return reply(400, { error: 'Send JSON.' }); }
  const key = process.env.TYPESAFE_API_KEY, step = new URL(request.url).searchParams.get('step');

  if (step === 'check') {
    /* one check {task, check, bucket}, or several as {items:[...]} so a whole week costs one call */
    const many = Array.isArray(body.items), items = (many ? body.items : [body]).slice(0, LIMIT.tasks)
      .map(c => ({ task: clean(c && c.task, LIMIT.task), check: clean(c && c.check, LIMIT.check), bucket: c && c.bucket === 'det' ? 'det' : 'prob' }));
    if (!items.length || items.some(c => !c.task || !c.check)) return reply(400, { error: 'Send {task, check, bucket} or {items:[{task, check, bucket}]}.' });
    if (!key) return reply(200, { fallback: true });
    try {
      const qs = checkQuestions(), rs = await Promise.all(items.map(c => jev({ task: c.task, check: c.check }, qs, key)));
      const out = rs.map((r, i) => judgeCheck(items[i].bucket, r.answers)), model = rs[0].model;
      console.log(JSON.stringify({ step: 'check', model, moves: out.map((o, i) => items[i].bucket + '>' + o.bucket + (o.verified ? '+' : '-')) }));
      return reply(200, many ? { items: out, model } : Object.assign(out[0], { model }));
    } catch (e) { console.log(JSON.stringify({ step: 'check', fallback: e.message })); return reply(200, { fallback: true }); }
  }

  const job = clean(body.job, LIMIT.job);
  const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, LIMIT.tasks)
    .map(t => ({ task: clean(t && t.task, LIMIT.task), how_often: OFTEN.includes(t && t.how_often) ? t.how_often : 'weekly' }))
    .filter(t => t.task);
  if (!tasks.length) return reply(400, { error: 'Send {job, tasks:[{task, how_often}]} with at least one task.' });
  if (!key) return reply(200, { fallback: true });
  try {
    const qs = sortQuestions();
    const rs = await Promise.all(tasks.map(t => jev({ job, task: t.task, how_often: t.how_often.replace('_', ' a ') }, qs, key)));
    const out = rs.map(r => classify(r.answers)), model = rs[0].model;
    console.log(JSON.stringify({ step: 'sort', model, buckets: out.map(o => o.bucket), unsure: out.filter(o => o.ask.length).length }));
    return reply(200, { tasks: out, model });
  } catch (e) { console.log(JSON.stringify({ step: 'sort', fallback: e.message })); return reply(200, { fallback: true }); }
}

export const POST = handle, OPTIONS = handle, GET = handle;
