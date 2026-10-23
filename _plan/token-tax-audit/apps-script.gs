// Token Tax Audit: receives one submission from token-tax-audit/index.html and appends it as a row.
// Paste into the sheet's Extensions > Apps Script, then Deploy > New deployment > Web app,
// Execute as: Me, Who has access: Anyone. Put the /exec URL into SHEET_URL in the page.
const SHEET_ID = '1K6MboBX3wHUO-RHF8pezNXYldU7y0n4sk1781VprVFg';
const HEADERS = ['timestamp', 'email', 'track', 'plan', 'top_tax', 'scores', 'homework', 'before', 'after', 'note',
                 'where', 'feeds', 'conns', 'switch', 'model', 'limit', 'source', 'utm'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    // Columns added later (source, utm) get their header the first time a row needs them.
    else if (sheet.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    const data = JSON.parse(e.postData.contents);
    // A leading quote stops typed text such as "=IMPORTXML(...)" running as a formula.
    const clean = v => { const s = String(v == null ? '' : v).slice(0, 500); return /^[=+\-@]/.test(s) ? "'" + s : s; };
    sheet.appendRow(HEADERS.map(h => h === 'timestamp' ? new Date() : clean(data[h])));
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

// Run once from the editor to check access and write the header row.
function setup() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
}
