/* Pulls site analytics from the private Blob store into one file: _plan/analytics/events.jsonl.
     node _plan/analytics/pull.mjs            add batches not pulled yet
     node _plan/analytics/pull.mjs --summary  also print views, visitors and top pages
   Needs BLOB_READ_WRITE_TOKEN: read from the environment or from .env.local (vercel env pull).
   Batches already in the file are skipped (each line carries its batch name as "b"), so it is safe to rerun.
   The batches stay in the store; events.jsonl is gitignored and never deployed. */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), OUT = join(HERE, 'events.jsonl');
let token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token && existsSync(join(ROOT, '.env.local'))) {
  const m = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m);
  if (m) token = m[1];
}
if (!token) { console.error('No BLOB_READ_WRITE_TOKEN. Run: vercel env pull .env.local'); process.exit(1); }
const auth = { authorization: 'Bearer ' + token };

const have = new Set();
if (existsSync(OUT)) readFileSync(OUT, 'utf8').split('\n').forEach(l => { const m = l.match(/"b":"([^"]+)"/); if (m) have.add(m[1]); });

let cursor, blobs = [];
do {
  const q = new URLSearchParams({ prefix: 'events/', limit: '1000' });
  if (cursor) q.set('cursor', cursor);
  const r = await fetch('https://vercel.com/api/blob/?' + q, { headers: { ...auth, 'x-api-version': '13' } });
  if (!r.ok) { console.error('List failed:', r.status, await r.text()); process.exit(1); }
  const d = await r.json();
  blobs = blobs.concat(d.blobs);
  cursor = d.hasMore ? d.cursor : null;
} while (cursor);

const todo = blobs.filter(b => !have.has(b.pathname)).sort((a, b) => a.pathname < b.pathname ? -1 : 1);
let added = 0;
for (let i = 0; i < todo.length; i += 20) {
  const texts = await Promise.all(todo.slice(i, i + 20).map(b => fetch(b.url, { headers: auth }).then(r => r.ok ? r.text() : '')));
  const lines = [];
  texts.forEach((t, j) => t.split('\n').filter(Boolean).forEach(l => {
    try { lines.push(JSON.stringify(Object.assign(JSON.parse(l), { b: todo[i + j].pathname }))); } catch (e) {}
  }));
  if (lines.length) appendFileSync(OUT, lines.join('\n') + '\n');
  added += lines.length;
}
console.log(`${todo.length} new batches, ${added} events added, ${blobs.length} batches in the store. File: ${OUT}`);

if (process.argv.includes('--summary') && existsSync(OUT)) {
  const ev = readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const views = ev.filter(e => e.e === 'view'), pages = {};
  views.forEach(e => { pages[e.p] = (pages[e.p] || 0) + 1; });
  console.log(`\n${ev.length} events, ${views.length} views, ${new Set(ev.map(e => e.v)).size} visitors, ${new Set(ev.map(e => e.s)).size} sessions`);
  Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([p, n]) => console.log(String(n).padStart(6), p));
}
