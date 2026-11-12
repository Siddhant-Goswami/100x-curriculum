/* The data source behind the Lecture 11 tool bench: one public Google Sheet, read as CSV.
   Shared by /api/toolcall (the bench's own server) and /api/mcp (the same tool, handed out over MCP).
   Read only. Only docs.google.com sheet ids are accepted, so this can't be pointed at anything else.
   The file name starts with "_" so Vercel does not serve it as a route. */

export const CURRICULUM = '1Kg6T-dJWaYx_JCPiRk3u0nBuAQcsCVRDPj1NFKP4WzM';
const ID = /^[A-Za-z0-9_-]{20,80}$/, GID = /^\d{1,12}$/;
const MAX_BYTES = 400000, MAX_CELL = 300, TTL = 60000;
const cache = new Map();

export class SheetError extends Error { constructor(status, message) { super(message); this.status = status; } }

/* A sheet link or a bare id -> {sheet, gid}. Throws on anything that is not a Google Sheet. */
export function source(sheet, gid) {
  let id = String(sheet || '').trim(), g = String(gid || '').trim();
  const m = id.match(/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (m) { const q = id.match(/[#?&]gid=(\d+)/); id = m[1]; if (q && !g) g = q[1]; }
  if (!id) return { sheet: CURRICULUM, gid: '' };
  if (!ID.test(id)) throw new SheetError(400, 'That is not a Google Sheets link. Copy it from the address bar of your sheet.');
  return { sheet: id, gid: GID.test(g) ? g : '' };
}
export const isCurriculum = src => src.sheet === CURRICULUM;
export const csvUrl = src => 'https://docs.google.com/spreadsheets/d/' + src.sheet + '/gviz/tq?tqx=out:csv&headers=0' + (src.gid ? '&gid=' + src.gid : '');

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/* -> {columns, rows, title, meta}. The header is the first row with three or more filled cells; title is the first
   cell above it, if any (a tab's own heading, such as "Aarav's week · example").
   meta says what actually crossed: fetched now, or the server's copy from age seconds ago, and the CSV's size and first lines. */
export async function load(src) {
  const key = src.sheet + '/' + src.gid, hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Object.assign({}, hit.table, { meta: Object.assign({}, hit.meta, { cached: true, age: Math.round((Date.now() - hit.at) / 1000) }) });
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  let res, text;
  try {
    res = await fetch(csvUrl(src), { signal: ctl.signal, redirect: 'follow' });
    text = await res.text();
  } catch (e) { throw new SheetError(502, 'Google Sheets did not answer. Try again.'); }
  finally { clearTimeout(timer); }
  if (res.status === 404) throw new SheetError(404, 'No sheet at that link.');
  if (!res.ok || !/text\/csv/.test(res.headers.get('content-type') || ''))
    throw new SheetError(403, 'The server cannot read this sheet. In the sheet: Share, General access, "Anyone with the link", Viewer.');
  if (text.length > MAX_BYTES) throw new SheetError(413, 'This sheet is too big for the bench. Use a tab with under 500 rows.');
  const all = parseCSV(text).map(r => r.map(c => c.replace(/\s+/g, ' ').trim()));
  const h = all.findIndex(r => r.filter(Boolean).length >= 3);
  if (h < 0) throw new SheetError(422, 'This sheet needs a header row with at least three columns.');
  const columns = all[h].map((c, i) => c || (i === 0 && isCurriculum(src) ? 'Date' : 'Column ' + (i + 1)));
  const rows = all.slice(h + 1).filter(r => r.some(Boolean));
  const above = all.slice(0, h).map(r => r.find(Boolean)).filter(Boolean);
  const table = { columns, rows, title: above[0] || '' };
  const meta = { url: csvUrl(src), bytes: text.length, lines: all.length, head: text.split('\n').slice(0, 4).join('\n').slice(0, 700) };
  cache.set(key, { at: Date.now(), table, meta });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return Object.assign({}, table, { meta: Object.assign({}, meta, { cached: false, age: 0 }) });
}

function record(table, row, keep) {
  const o = {};
  table.columns.forEach((c, i) => { if (row[i] && (!keep || keep.includes(c))) o[c] = row[i].length > MAX_CELL ? row[i].slice(0, MAX_CELL) + '…' : row[i]; });
  return o;
}

/* The tool's shape. The curriculum sheet is looked up by lecture number; any other sheet is searched by words.
   The card (name, when, needs) is the learner's own wording; the defaults are a card that works. */
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,47}$/;
export const CARD_MAX = { when: 400, needs: 200 };
export function tool(src, card) {
  const cur = isCurriculum(src), c = card || {};
  /* learner-written text: capped, and links removed, so an address on this domain can't carry anything long or clickable */
  const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link removed]').replace(/\s+/g, ' ').trim().slice(0, n);
  const name = NAME.test(c.name || '') ? c.name : (cur ? 'get_lecture' : 'find_rows');
  const when = c.when != null ? clip(c.when, CARD_MAX.when) : cur
    ? 'Returns one lecture of the 100xEngineers Cohort 8 curriculum: its date, title, type and tools. Use it when someone asks about a specific lecture by number. Not for general questions.'
    : 'Returns the rows of the sheet that contain the search words. Use it when the question is about what is written in the sheet.';
  const needs = c.needs != null ? clip(c.needs, CARD_MAX.needs) : cur ? 'The lecture number, 1 to 19.' : 'One or two words to look for in the sheet.';
  const arg = cur ? 'number' : 'search';
  return {
    name, description: when,
    inputSchema: { type: 'object', properties: { [arg]: { type: cur ? 'integer' : 'string', description: needs } }, required: [arg] }
  };
}

/* Runs the tool. Never throws for a bad argument: it answers the way a server should, with an error the model can read.
   -> {ok, result, meta, pick}: pick says, in words, what the server did with the sheet. */
const STOP = new Set('a an and are as at be by can do does for from has have how i in is it its me my of on or our so that the their this to was we what when where which who why will with you your'.split(' '));
export async function run(src, args) {
  const table = await load(src), a = args && typeof args === 'object' ? args : {}, meta = table.meta;
  if (isCurriculum(src)) {
    const n = Number(a.number);
    if (!Number.isInteger(n)) return { ok: false, meta, pick: 'No lecture number in the request.', result: { error: 'The input "number" must be a whole number, the lecture number.' } };
    const row = table.rows.find(r => new RegExp('^' + n + '\\.\\s').test(r[1] || ''));
    if (!row) return { ok: false, meta, pick: 'No row for lecture ' + n + '.', result: { error: 'There is no lecture ' + n + '. Lectures run from 1 to 19.' } };
    return { ok: true, meta, pick: 'Picked the row for lecture ' + n + ', five of its columns.', result: Object.assign({ lecture: n }, record(table, row, ['Date', 'Lecture title', 'Type', 'Tools', 'Students can'])) };
  }
  const words = String(a.search == null ? '' : a.search).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)).slice(0, 6);
  if (!words.length) return { ok: false, meta, pick: 'No search words in the request.', result: { error: 'The input "search" must be one or two words to look for.' } };
  const scored = table.rows.map(r => { const t = r.join(' ').toLowerCase(); return [words.filter(w => t.includes(w)).length, r]; })
    .filter(x => x[0]).sort((x, y) => y[0] - x[0]);
  if (!scored.length) return { ok: false, meta, pick: 'No row contains ' + words.join(', ') + '.', result: { error: 'No row contains "' + words.join(' ') + '".', columns: table.columns } };
  return { ok: true, meta, pick: 'Searched ' + table.rows.length + ' rows for ' + words.join(', ') + ': ' + scored.length + ' matched, sent the top ' + Math.min(5, scored.length) + '.', result: { matches: scored.length, rows: scored.slice(0, 5).map(x => record(table, x[1])) } };
}
