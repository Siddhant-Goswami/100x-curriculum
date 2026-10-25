#!/usr/bin/env node
/* token-meter: reads Claude Code's local logs (every .jsonl under ~/.claude/projects) and writes token-meter.json.
   Offline, read-only, no dependencies. The output holds totals and tax scores only: no prompts, code, file names or paths.
   Usage: npx token-meter [--days 30] [--out token-meter.json]
   Totals come from each response's usage field, deduplicated by request id (one response is logged as several lines).
   Tax scores, as in the Token Meter spec:
     noisy_output  tool results over 5,000 tokens (characters ÷ 3.5), priced as written once and re-read on every later request
     screenshots   image blocks, tokens from the image's own size: ceil(w ÷ 28) × ceil(h ÷ 28), long edge capped at 2,576 px
     startup       the cache write on each session's first request (CLAUDE.md, tools, MCP servers)
     cache_breaks  a cache write over 20K tokens after a model change or a pause past the cache lifetime: the extra over a cache read
     one_model     short Opus jobs (a log with at most 10 requests, none writing 300 tokens or more): what they cost over Haiku.
                   Counting every short Opus request would flag each step of an agent loop, where a switch would break the cache */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
if (args.includes('--help') || args.includes('-h')) { console.log('Usage: npx token-meter [--days 30] [--out token-meter.json]'); process.exit(0); }
const DAYS = +opt('--days', 30), OUT = opt('--out', 'token-meter.json');
const here = path.dirname(new URL(import.meta.url).pathname);
const PR = JSON.parse(fs.readFileSync(fs.existsSync(path.join(here, 'prices.json')) ? path.join(here, 'prices.json') : path.join(here, '..', 'prices.json'), 'utf8'));
const NOISY = 5000, BREAK = 20000, SHORT = 300, CAP = 2576;
const since = Date.now() - DAYS * 864e5;

const roots = (process.env.CLAUDE_CONFIG_DIR ? process.env.CLAUDE_CONFIG_DIR.split(',') : [path.join(os.homedir(), '.claude'), path.join(os.homedir(), '.config', 'claude')])
  .map(d => path.join(d.trim(), 'projects')).filter(d => fs.existsSync(d));
if (!roots.length) { console.error('No Claude Code logs found in ~/.claude/projects. Set CLAUDE_CONFIG_DIR if yours live elsewhere.'); process.exit(1); }
const files = [];
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.jsonl')) files.push(p); } }
roots.forEach(walk);

const family = m => /haiku/i.test(m) ? 'haiku' : /sonnet/i.test(m) ? 'sonnet' : /opus/i.test(m) ? 'opus' : /fable/i.test(m) ? 'fable' : null;
function price(m, prompt) { const k = family(m); if (!k) return null; const p = PR.models[k]; return p.long_prompt && prompt > p.long_prompt.over_tokens ? p.long_prompt : p; }
function cost(u, m) {
  const c5 = u.cache_creation ? u.cache_creation.ephemeral_5m_input_tokens || 0 : u.cache_creation_input_tokens || 0;
  const c1 = u.cache_creation ? u.cache_creation.ephemeral_1h_input_tokens || 0 : 0;
  const prompt = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + c5 + c1, p = price(m, prompt);
  if (!p) return null;
  return { input: (u.input_tokens || 0) * p.input / 1e6, output: (u.output_tokens || 0) * p.output / 1e6,
    cache_write: (c5 * p.cache_write + c1 * p.cache_write_1h) / 1e6, cache_read: (u.cache_read_input_tokens || 0) * p.cache_read / 1e6, p, c1 };
}
const est = s => Math.ceil(s.length / 3.5);
function imageTokens(b64) {
  let w = 0, h = 0;
  try {
    const buf = Buffer.from(b64.slice(0, 90000), 'base64');
    if (buf[0] === 0x89 && buf[1] === 0x50) { w = buf.readUInt32BE(16); h = buf.readUInt32BE(20); }
    else if (buf[0] === 0x47 && buf[1] === 0x49) { w = buf.readUInt16LE(6); h = buf.readUInt16LE(8); }
    else if (buf[0] === 0xff && buf[1] === 0xd8) {
      for (let i = 2; i < buf.length - 9;) {
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1];
        if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch (e) {}
  if (!w || !h) return 1600; /* unknown format: about 1,100 × 1,100 px */
  const long = Math.max(w, h); if (long > CAP) { w = Math.round(w * CAP / long); h = Math.round(h * CAP / long); }
  return Math.ceil(w / 28) * Math.ceil(h / 28);
}

const T = { tokens: { input: 0, output: 0, cache_write: 0, cache_read: 0 }, cost: { input: 0, output: 0, cache_write: 0, cache_read: 0 } };
const X = { noisy_output: { count: 0, tokens: 0, cost: 0 }, screenshots: { count: 0, tokens: 0, cost: 0 }, startup: { sessions: 0, tokens: 0, cost: 0 }, cache_breaks: { count: 0, tokens: 0, cost: 0 }, one_model: { count: 0, cost: 0 } };
const byModel = {}, sessions = new Set(), unpriced = new Set(), seen = new Set();
let requests = 0, unpricedReq = 0, from = null, to = null;

for (const f of files) {
  if (fs.statSync(f).mtimeMs < since) continue;
  const reqs = [], blocks = []; /* blocks: {tokens, kind, at: number of requests before it} */
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line) continue;
    let d; try { d = JSON.parse(line); } catch (e) { continue; }
    const t = d.timestamp ? Date.parse(d.timestamp) : NaN;
    if (!(t >= since)) continue;
    const m = d.message;
    if (d.type === 'assistant' && m && m.usage) {
      const id = d.requestId || m.id; if (!id || seen.has(id)) continue; seen.add(id);
      if (m.model === '<synthetic>') continue;
      reqs.push({ t, model: m.model || 'unknown', u: m.usage });
      if (d.sessionId) sessions.add(d.sessionId);
      from = from == null || t < from ? t : from; to = to == null || t > to ? t : to;
    } else if (d.type === 'user' && m && Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === 'image' && b.source && b.source.data) blocks.push({ kind: 'img', tokens: imageTokens(b.source.data), at: reqs.length });
        if (b.type === 'tool_result') {
          const inner = Array.isArray(b.content) ? b.content : [{ type: 'text', text: typeof b.content === 'string' ? b.content : '' }];
          let text = 0;
          for (const x of inner) {
            if (x.type === 'image' && x.source && x.source.data) blocks.push({ kind: 'img', tokens: imageTokens(x.source.data), at: reqs.length });
            else if (x.type === 'text' && x.text) text += est(x.text);
          }
          if (text > NOISY) blocks.push({ kind: 'noisy', tokens: text, at: reqs.length });
        }
      }
    }
  }
  if (!reqs.length) continue;
  const ttl = reqs.some(r => r.u.cache_creation && r.u.cache_creation.ephemeral_1h_input_tokens) ? PR.cache_lifetime_minutes.paid_plan : PR.cache_lifetime_minutes.api;
  reqs.forEach((r, i) => {
    requests++;
    const u = r.u, cw = (u.cache_creation_input_tokens || 0), c = cost(u, r.model);
    T.tokens.input += u.input_tokens || 0; T.tokens.output += u.output_tokens || 0; T.tokens.cache_write += cw; T.tokens.cache_read += u.cache_read_input_tokens || 0;
    const bm = byModel[r.model] = byModel[r.model] || { requests: 0, cost: 0 };
    bm.requests++;
    if (!c) { unpricedReq++; unpriced.add(r.model); bm.cost = null; return; }
    const sum = c.input + c.output + c.cache_write + c.cache_read;
    ['input', 'output', 'cache_write', 'cache_read'].forEach(k => { T.cost[k] += c[k]; });
    if (bm.cost != null) bm.cost += sum;
    const wp = c.c1 ? c.p.cache_write_1h : c.p.cache_write;
    if (i === 0) { X.startup.sessions++; X.startup.tokens += cw; X.startup.cost += cw * wp / 1e6; }
    else {
      const prev = reqs[i - 1];
      if (cw > BREAK && (prev.model !== r.model || (r.t - prev.t) / 60000 > ttl)) { X.cache_breaks.count++; X.cache_breaks.tokens += cw; X.cache_breaks.cost += cw * (wp - c.p.cache_read) / 1e6; }
    }
  });
  if (reqs.length <= 10 && reqs.every(r => family(r.model) === 'opus' && (r.u.output_tokens || 0) < SHORT)) {
    X.one_model.count++;
    reqs.forEach(r => { const c = cost(r.u, r.model), h = cost(r.u, 'haiku'), s = o => o.input + o.output + o.cache_write + o.cache_read; X.one_model.cost += s(c) - s(h); });
  }
  for (const b of blocks) {
    const next = reqs[Math.min(b.at, reqs.length - 1)], p = price(next.model, 0);
    if (!p) continue;
    const later = Math.max(0, reqs.length - b.at - 1), c = b.tokens * (p.cache_write + p.cache_read * later) / 1e6;
    const x = b.kind === 'img' ? X.screenshots : X.noisy_output; x.count++; x.tokens += b.tokens; x.cost += c;
  }
}
if (!requests) { console.error(`No Claude Code requests in the last ${DAYS} days.`); process.exit(1); }

const r2 = v => Math.round(v * 1e4) / 1e4;
T.cost.total = T.cost.input + T.cost.output + T.cost.cache_write + T.cost.cache_read;
Object.keys(T.cost).forEach(k => { T.cost[k] = r2(T.cost[k]); });
Object.values(X).forEach(x => { x.cost = r2(x.cost); });
X.startup.avg_first_write = X.startup.sessions ? Math.round(X.startup.tokens / X.startup.sessions) : 0;
Object.values(byModel).forEach(v => { if (v.cost != null) v.cost = r2(v.cost); });
const out = {
  tool: 'token-meter', version: 1, source: 'claude-code', generated: new Date().toISOString(), prices_checked: PR.checked,
  period: { days: DAYS, from: new Date(from).toISOString(), to: new Date(to).toISOString() },
  sessions: sessions.size, requests, totals: T, by_model: byModel, taxes: X,
  unpriced: { requests: unpricedReq, models: [...unpriced] }
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const top = Object.entries(X).sort((a, b) => b[1].cost - a[1].cost)[0];
console.log(`Read ${requests.toLocaleString()} requests from ${sessions.size} sessions (last ${DAYS} days).`);
console.log(`About $${T.cost.total.toFixed(2)} at API prices. Biggest tax: ${top[0].replace('_', ' ')}, $${top[1].cost.toFixed(2)}.`);
if (unpricedReq) console.log(`${unpricedReq} requests on ${[...unpriced].join(', ')} aren't in prices.json, so they have no cost.`);
console.log(`Wrote ${path.resolve(OUT)}. Drop it on the Token Meter page. It holds totals only, no prompts or code.`);
