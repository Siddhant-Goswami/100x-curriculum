// Writing Evals from First Principles: room mode. Receives anonymous answers from c8/writing-evals and serves them back by room.
// Setup, once:
//   1. Create a Google Sheet. Extensions > Apps Script. Paste this file. Put the Sheet's id in SHEET_ID.
//   2. Run setup() once from the editor to grant access.
//   3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
//   4. Paste the /exec URL into ROOM_URL in c8/writing-evals/evals.js and c8/writing-evals/room.js, then redeploy the site.
// One tab per kind of answer. No names are ever sent: cid is a random id kept in the student's browser.
const SHEET_ID = 'PASTE_THE_SHEET_ID';
const KINDS = ['move', 'q', 'scores', 'agree', 'ticket'];
const HEADERS = ['timestamp', 'room', 'cid', 'payload'];

function tab(kind) {
  const book = SpreadsheetApp.openById(SHEET_ID);
  let sh = book.getSheetByName(kind);
  if (!sh) { sh = book.insertSheet(kind); sh.appendRow(HEADERS); }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (KINDS.indexOf(d.kind) < 0) return ContentService.createTextOutput('bad kind');
    const room = String(d.room || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
    if (room.length < 3) return ContentService.createTextOutput('bad room');
    // A leading quote stops typed text such as "=IMPORTXML(...)" running as a formula.
    let payload = JSON.stringify(d.payload || {}).slice(0, 4000);
    if (/^[=+\-@]/.test(payload)) payload = "'" + payload;
    tab(d.kind).appendRow([new Date(), room, String(d.cid || '').slice(0, 16), payload]);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// GET ?room=code&kind=scores  ->  {rows:[{ts, cid, payload}]}, oldest first. Only the asked room is returned.
function doGet(e) {
  const room = String(e.parameter.room || '').toLowerCase(), kind = e.parameter.kind;
  if (KINDS.indexOf(kind) < 0 || room.length < 3) return json({ rows: [] });
  const values = tab(kind).getDataRange().getValues().slice(1);
  const rows = values.filter(r => r[1] === room).map(r => {
    let p = String(r[3]); if (p[0] === "'") p = p.slice(1);
    try { return { ts: r[0], cid: r[2], payload: JSON.parse(p) }; } catch (err) { return null; }
  }).filter(Boolean);
  return json({ rows: rows });
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function setup() { KINDS.forEach(tab); }
