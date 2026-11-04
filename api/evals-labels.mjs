/* Writing Evals from First Principles: the sealed expert labels. Page: /c8/writing-evals, plan: _plan/writing-evals/PLAN.md
     POST /api/evals-labels  {industry, results:[{id, scores:{dim:n}}]}  ->  {version, dims, labels:{id:{a, b, hard}}}
   The labels are only returned once a judge has scored at least 20 of the industry's 30 items, so a student
   meets them after running a judge, never before. Friction, not security. Logs the industry only.
   Labels are generated into _writing-evals-labels.mjs by _plan/writing-evals/build_data.py. No dependencies, like aarav.mjs. */
import { LABELS } from './_writing-evals-labels.mjs';

const RATE = { limit: 20, windowMs: 10 * 60000 };
const hits = new Map(); /* per warm instance only; best effort */

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function limited(request) {
  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim(), now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  list.push(now); hits.set(ip, list);
  return list.length > RATE.limit;
}

export async function handle(request) {
  if (request.method !== 'POST') return reply(405, { error: 'POST your judge results to unlock the labels.' });
  if (limited(request)) return reply(429, { error: 'Too many unlocks from here. Wait a few minutes.' });
  let body;
  try { body = await request.json(); } catch { return reply(400, { error: 'Send JSON: {industry, results}.' }); }
  const set = LABELS[body && body.industry];
  if (!set) return reply(400, { error: 'Unknown industry.' });
  const results = Array.isArray(body.results) ? body.results : [];
  const scored = results.filter(r => r && set.items[r.id] && r.scores && set.dims.every(d => Number.isInteger(r.scores[d]) && r.scores[d] >= 1 && r.scores[d] <= 5));
  if (new Set(scored.map(r => r.id)).size < 20) return reply(400, { error: 'Run your judge first: the labels unlock once it has scored at least 20 of the 30 items.' });
  console.log(JSON.stringify({ at: 'evals-labels', industry: body.industry, scored: scored.length }));
  return reply(200, { version: set.version, dims: set.dims, labels: set.items });
}
export const POST = handle, GET = handle;
