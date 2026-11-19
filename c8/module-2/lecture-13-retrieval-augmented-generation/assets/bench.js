/* Retrieval Bench: Lecture 13. Started as a copy of the Lecture 11 Tool Bench (one bench, one wire, only the instruction
   changes) with three new parts: the scoreboard, the pile view (Text, Map, Prompt) and the meter.
   The bench: You talk only to the Server (/api/retrieve). The Server searches the Pile it holds (the twelve notes pages
   cut into passages, api/_pile.mjs) and talks to the Model (GPT-OSS on Groq).
   The wire's promise is "every message that crossed":
   - every hop to the server or the model shows the exact JSON that crossed;
   - a search is the server's own code running over the pile it holds: the wire shows what went in and what came out;
   - things that are not messages (your browser turning a question into numbers) show as dashed notes.
   The scoreboard marks answers with plain rules, shown under each question. Nothing is marked by a model.
   State: localStorage c8.l13.bench. The Groq key lives in sessionStorage c8.l11.key (shared with the Tool Bench in the
   same tab), rides to /api/retrieve in a header, and is never stored or logged there. */
(function () {
'use strict';

var API = '/api/retrieve', KEY = 'c8.l13.bench', KEYS = 'c8.l11.key', BASE = '/c8/module-2/lecture-13-retrieval-augmented-generation/';
var MODEL = 'openai/gpt-oss-120b', EMBED = 'Xenova/gte-small', TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
var NAMES = ['', 'Ask', 'By number', 'Paste it all', 'By its words', 'By its meaning', 'Search twice'];
var N = 6;
var NODE = { you: 'You', model: 'Model', server: 'Server', pile: 'Pile' };
var LANE = { 'server-you': ['server-you', 'btt', 'ttb'], 'you-server': ['server-you', 'ttb', 'btt'], 'model-server': ['model-server', 'rtl'], 'server-model': ['model-server', 'ltr'], 'server-pile': ['server-pile', 'rtl'], 'pile-server': ['server-pile', 'ltr'] };
var FREE_TPM = 8000;   /* what Groq's own refusal said for a free key on 20 Nov 2026: "Limit 8000" */
/* the five questions; each is marked by a rule anyone can check, never by a model */
var RULES = {
  Q1: { kind: 'a lecture number', pass: 'it says databases', test: function (a) { return /databas/i.test(a); } },
  Q2: { kind: 'exact words', pass: 'it says Lecture 1', test: function (a) { return /\blecture\s*(1|one)\b/i.test(a); } },
  Q3: { kind: 'only a meaning', pass: 'it points to Lecture 10', test: function (a) { return /\blecture\s*10\b/i.test(a); } },
  Q4: { kind: 'nothing: it is not in the notes', pass: 'it says the notes do not cover it', test: function (a) {
    return /(passages|notes|context)[^.]{0,50}\b(do not|don['’]t|does not|doesn['’]t|did not|didn['’]t|not)\s+(contain|include|mention|cover|say|describe|provide|address|state|specify|discuss)|\b(not|n['’]t)\s+(in|part of|covered (in|by)|mentioned in)\s+(the|our|my|your|these)\s+(notes|passages)|\bno (information|mention|details?|refund policy)\b[^.]{0,40}\b(in|from|within)\s+(the|our|these)\s+(notes|passages)/i.test(a); } },
  Q5: { kind: 'a path: two searches', pass: 'it says a million dollars (or 7.5 crore)', test: function (a) { return /million|7\.5\s*crore/i.test(a); } }
};
var ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
var LOOKUP = { name: 'get_lecture', description: 'Returns the notes of one lecture of the 100xEngineers Cohort 8 course, by its number. Use it when someone asks about a specific lecture by number.', parameters: { type: 'object', properties: { number: { type: 'integer', description: 'The lecture number, 1 to 12.' } }, required: ['number'] } };
var HONEST = ' If the passages do not answer it, say it is not in the notes.';

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var plain = function (s) { return String(s == null ? '' : s).replace(/^[ \t]*\|?[ \t:|-]*-{3,}[ \t:|-]*$/gm, '').replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, '').replace(/[ \t]*\|[ \t]*/g, ' · ').replace(/\n{2,}/g, '\n').replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, '$1$2').replace(/^#+\s*/gm, '').replace(/【[^】]*】/g, '').trim(); };
var pretty = function (v) { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); };
var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
var money = function (x) { return x >= 1 ? '$' + x.toFixed(2) : x >= 0.01 ? '$' + x.toFixed(3) : '$' + x.toFixed(5); };
function clip(s, n) { s = plain(s).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* ---------- state ---------- */
function fresh() { return { v: 1, step: 1, max: 1, done: {}, score: {}, answers: {}, guess: {}, price: { in: 0.15, out: 0.60 }, k: 3, honest: false }; }
var S = fresh();
try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw && raw.v === 1) S = Object.assign(fresh(), raw); } catch (e) { /* storage blocked: still works */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
var T = {};          /* what happened in this visit to a station; not saved */
var LOG = [];
var groqKey = '';
try { groqKey = sessionStorage.getItem(KEYS) || ''; } catch (e) { /* asked again */ }
var VISIT = 0, STALE = new Error('stale');
function fresher(v) { if (v !== VISIT) throw STALE; }

/* the pile as the page draws it (text, map x/y, tokens); the server holds the same passages with their numbers */
var P = null, BY = {};
var pileReady = fetch(BASE + 'assets/pile.json').then(function (r) { return r.json(); }).then(function (d) {
  P = d; d.chunks.forEach(function (c, i) { c.i = i; BY[c.id] = c; });
  d.Q = {}; d.questions.forEach(function (q) { d.Q[q.id] = q; });
});

/* ---------- talking to the server ---------- */
function post(body) {
  var v = VISIT, h = { 'content-type': 'application/json' };
  if (groqKey) h['x-groq-key'] = groqKey;
  return fetch(API, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) {
    return r.text().then(function (t) {
      fresher(v);
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* not JSON */ }
      if (!r.ok) { var er = new Error((d && d.message) || 'The server did not answer. Try again.'); er.code = d && typeof d.error === 'string' ? d.error : ''; er.data = d; throw er; }
      return d;
    });
  }, function (e) { if (e === STALE) throw e; fresher(v); throw new Error('No connection. Check your internet and try again.'); });
}
function asSent(body) { return { headers: { 'x-groq-key': 'gsk_… your key, not shown here' }, body: body }; }
function chatBody(messages, tools) {
  var r = { model: MODEL, messages: messages };
  if (tools && tools.length) r.tools = tools.map(function (t) { return { type: 'function', function: t }; });
  return { op: 'chat', request: r };
}

/* ---------- the bench and the wire ---------- */
function flash(from, to) {
  var l = LANE[from + '-' + to];
  if (l) { var lane = $('.lane[data-l="' + l[0] + '"]'); lane.classList.remove('ltr', 'rtl', 'ttb', 'btt'); void lane.offsetWidth; lane.classList.add(l[1]); }
  [from, to].forEach(function (n) { var el = $('.node[data-n=' + n + ']'); if (!el) return; el.classList.add('lit'); setTimeout(function () { el.classList.remove('lit'); }, 800); });
}
function scrollWire() { var box = $('.wirebox'); if (box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight; }
function hop(from, to, title, body, o) {
  o = o || {};
  var v = VISIT;
  var li = document.createElement('li'); li.className = 'w' + (o.stop ? ' stop' : '') + (o.compact ? ' c' : '');
  li.innerHTML = '<span class="rt"><b class="n-' + from + '">' + NODE[from] + '</b><i>→</i><b class="n-' + to + '">' + NODE[to] + '</b></span>' +
    '<span class="tt">' + esc(title) + '</span>' +
    (body != null ? '<details' + (o.open ? ' open' : '') + '><summary>The message, exactly</summary><pre>' + esc(pretty(body)) + '</pre></details>' : '');
  $('#wire').appendChild(li); $('#empty').hidden = true; scrollWire();
  flash(from, to);
  LOG.push(NODE[from] + ' -> ' + NODE[to] + ' | ' + title + (body != null ? '\n' + pretty(body).replace(/^/gm, '    ') : ''));
  return sleep(o.fast ? 120 : 550).then(function () { fresher(v); });
}
function note(who, text) {
  var li = document.createElement('li'); li.className = 'w n';
  li.innerHTML = '<span class="tt"><b>' + NODE[who] + '</b> ' + esc(text) + '</span>';
  $('#wire').appendChild(li); $('#empty').hidden = true; scrollWire();
  LOG.push('(' + NODE[who] + ') ' + text);
  return sleep(250);
}
function clearWire() { $('#wire').innerHTML = ''; $('#empty').hidden = false; LOG = []; }
function wnote(text) { var n = $('#wnote'); n.textContent = text || ''; n.hidden = !text; }
function waitOn(n) { $$('.node').forEach(function (el) { el.classList.toggle('wait', el.getAttribute('data-n') === n); }); }
function ins(text, todo) { var h = $('#ins'); h.textContent = text; h.className = todo ? 'do' : ''; }
function ctx(html) { $('#ctx').innerHTML = html || ''; }
function panel(html) { $('#panel').innerHTML = html; }
function after(html) { $('#after').innerHTML = html || ''; }
function say(text) { $('#msg').textContent = text || ''; }
function forward(label) {
  var f = $('#fwd'); f.innerHTML = '';
  if (!label) return;
  var b = document.createElement('button'); b.className = 'btn go'; b.textContent = label;
  b.onclick = function () { go(S.step + 1); };
  f.appendChild(b);
}
function finish(n) { S.done[n] = true; S.max = Math.max(S.max, Math.min(N, n + 1)); save(); paintBar(); }

function act(btn, fn) {
  if (btn.disabled) return;
  say(''); btn.disabled = true; btn.classList.add('busy');
  var v = VISIT, n0 = $('#wire').children.length, l0 = LOG.length;
  Promise.resolve().then(fn).catch(function (e) {
    if (e === STALE || v !== VISIT) return;
    if (e.code === 'need_key') {
      while ($('#wire').children.length > n0) $('#wire').lastChild.remove();
      LOG.length = l0; $('#empty').hidden = n0 > 0;
      keyBox(e.message);
    } else say(e.message || 'Something went wrong. Try again.');
  }).then(function () { btn.disabled = false; btn.classList.remove('busy'); });
}

/* the key screen, as on the Tool Bench */
function keyGate(n, message) {
  waitOn(''); forward(''); after(''); wnote('');
  ins('Paste your Groq key.', true);
  ctx(message ? esc(message) : 'The free key you used on the <a href="/c8/module-2/lecture-11-tool-calling-and-mcp/bench" target="_blank" rel="noopener">Tool Bench</a>. Deleted it since? Make a new one in a minute: <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>, then Create API Key.');
  panel('<label class="lab" for="gk">Your Groq key</label>' +
    '<div class="ask"><input id="gk" type="password" placeholder="gsk_..." autocomplete="off" spellcheck="false"><button class="btn act" id="gkok">Use my key</button></div>' +
    '<p class="url">Every message to the model on this bench runs on your key. It stays in this tab until you close it, and rides to Groq through our server in a header. The server does not store or log it.</p>');
  var use = function () {
    var v = $('#gk').value.trim();
    if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) return say('A Groq key starts with gsk_. Copy the whole key.');
    act($('#gkok'), function () {
      groqKey = v;
      return post({ op: 'key' }).then(function () {
        try { sessionStorage.setItem(KEYS, v); } catch (e) { /* memory only */ }
        ctx(''); VIEW[n]();
      }, function (e) { groqKey = ''; throw new Error(e.message); });
    });
  };
  $('#gkok').onclick = use; $('#gk').onkeydown = function (e) { if (e.key === 'Enter') use(); };
  setTimeout(function () { $('#gk').focus(); }, 50);
}
function keyBox(message) { groqKey = ''; try { sessionStorage.removeItem(KEYS); } catch (e) { /* ignore */ } keyGate(S.step, message); }

/* ---------- the scoreboard ---------- */
function mark(id, answer) {
  var ok = RULES[id].test(plain(answer));
  S.score[id] = ok; S.answers[id] = clip(answer, 400); save(); paintScore(id);
  return ok;
}
function paintScore(flashId) {
  if (!P) return;
  var n = ORDER.filter(function (id) { return S.score[id] === true; }).length;
  $('#score').innerHTML = '<div class="sh"><b>' + n + ' of 5</b><span>Five questions about our course. Each is marked by a rule, shown under it.</span></div><ol class="qs">' + ORDER.map(function (id) {
    var s = S.score[id], q = P.Q[id];
    return '<li class="qq' + (s === true ? ' ok' : s === false ? ' no' : '') + (id === flashId ? ' fl' : '') + '" data-q="' + id + '"><button type="button" aria-expanded="false"><b>' + id + '</b><span>' + esc(q.q.length > 64 ? q.q.slice(0, 62) + '…' : q.q) + '</span><i>' + (s === true ? 'pass' : s === false ? 'fail' : '') + '</i></button>' +
      '<div class="qd" hidden><p>' + esc(q.q) + '</p><p class="rule">Hands you: ' + esc(RULES[id].kind) + '. Passes when ' + esc(RULES[id].pass) + '.</p>' + (S.answers[id] ? '<p class="last">Last answer: ' + esc(S.answers[id]) + '</p>' : '') + '</div></li>';
  }).join('') + '</ol>';
  $$('.qq > button').forEach(function (b) { b.onclick = function () { var d = b.nextElementSibling, open = d.hidden; $$('.qd').forEach(function (x) { x.hidden = true; }); $$('.qq > button').forEach(function (x) { x.setAttribute('aria-expanded', 'false'); }); d.hidden = !open; b.setAttribute('aria-expanded', String(open)); }; });
}

/* ---------- the meter: what the model was sent, and what it cost at the price you typed ---------- */
var RUN = null;
function meterStart() { RUN = { rounds: 0, inT: 0, outT: 0 }; paintMeter(); }
function meterAdd(u) { if (!RUN) meterStart(); if (u) { RUN.rounds++; RUN.inT += u.prompt_tokens || 0; RUN.outT += u.completion_tokens || 0; } paintMeter(); }
function paintMeter(planned) {
  var m = $('#meter'), whole = P ? P.lectures.reduce(function (s, l) { return s + l.tok; }, 0) : 30000;
  if (planned) {   /* station 3, before sending: an estimate from the pile's own token counts */
    var pct = Math.min(100, 100 * planned / whole);
    m.innerHTML = '<div class="mbar"><i style="width:' + pct + '%" class="est"></i><em style="left:' + Math.min(100, 100 * FREE_TPM / whole) + '%" title="A free key: 8,000 tokens a minute"></em></div>' +
      '<p><b>About ' + fmt(planned) + ' tokens</b> to send, before your question. The whole pile is about ' + fmt(whole) + '. The mark is a free key’s 8,000 a minute.</p>';
    return;
  }
  if (RUN && RUN.refused) { m.innerHTML = '<div class="mbar"><i class="est" style="width:100%"></i><em style="left:' + Math.min(100, 100 * FREE_TPM / whole) + '%"></em></div><p><b>Refused: ' + fmt(RUN.refused) + ' tokens asked for</b>, 8,000 a minute allowed on a free key. The model read nothing and nothing was billed.</p>'; return; }
  if (!RUN || !RUN.rounds) { m.innerHTML = '<div class="mbar"></div><p>Nothing sent to the model yet. The whole pile is about ' + fmt(whole) + ' tokens.</p>'; return; }
  var cost = RUN.inT * S.price.in / 1e6 + RUN.outT * S.price.out / 1e6;
  m.innerHTML = '<div class="mbar"><i style="width:' + Math.min(100, 100 * RUN.inT / whole) + '%"></i></div>' +
    '<p><b>' + fmt(RUN.inT) + ' tokens in</b>, ' + fmt(RUN.outT) + ' out' + (RUN.rounds > 1 ? ', over ' + RUN.rounds + ' rounds' : '') + ' · ' + money(cost) + ' at $' + S.price.in.toFixed(2) + ' and $' + S.price.out.toFixed(2) + ' per million · the bar is the share of the whole pile (' + fmt(whole) + ')</p>';
}

/* ---------- the pile view ---------- */
var VIEWSTATE = { tab: 'text', lit: {}, words: '', pick: null, q: null, near: [], prompt: '', parts: null };
function tab(name) {
  VIEWSTATE.tab = name;
  $$('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name)); });
  drawPile();
}
$$('.tabs button').forEach(function (b) { b.onclick = function () { tab(b.getAttribute('data-tab')); }; });
function light(hits, words) {   /* hits: [{id, mentions|score}] */
  VIEWSTATE.lit = {}; (hits || []).forEach(function (h, i) { VIEWSTATE.lit[h.id] = { rank: i + 1, n: h.mentions, s: h.score }; });
  VIEWSTATE.words = words || '';
}
function mark_words(text, w) {
  var t = esc(text);
  if (!w) return t;
  var re = new RegExp('(' + esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]").replace(/[-\s]+/g, '[-\\s]+') + ')', 'gi');
  return t.replace(re, '<mark>$1</mark>');
}
function passageBox(c) {
  if (!c) return '';
  return '<div class="pbox"><p class="pt"><b>Lecture ' + c.l + '</b> · ' + esc(c.title) + ' · ' + c.tok + ' tokens <a href="' + esc(c.url) + '" target="_blank" rel="noopener">open in the notes</a></p><p class="ptx">' + mark_words(c.text, VIEWSTATE.words).replace(/\n/g, '<br>') + '</p></div>';
}
function drawPile() {
  if (!P) return pileReady.then(drawPile);
  var b = $('#tabbody'), V = VIEWSTATE;
  if (V.tab === 'text') {
    var nLit = Object.keys(V.lit).length, lects = {};
    Object.keys(V.lit).forEach(function (id) { lects[BY[id].l] = 1; });
    b.innerHTML = '<p class="pmeta">' + (nLit ? '<b>' + nLit + ' passage' + (nLit === 1 ? '' : 's') + ' lit</b>, in ' + Object.keys(lects).length + ' lecture' + (Object.keys(lects).length === 1 ? '' : 's') + (V.words ? ' for “' + esc(V.words) + '”' : '') + '. Tap one to read it.'
        : 'Twelve notes pages, cut into ' + P.chunks.length + ' passages of up to ' + P.words + ' words. Each block is one passage.') + '</p>' +
      '<div class="strips">' + P.lectures.map(function (l) {
        return '<div class="strip"><a class="ln" href="' + esc(l.url) + '" target="_blank" rel="noopener" title="' + esc(l.title) + '">L' + l.n + '</a><div class="blocks">' +
          P.chunks.filter(function (c) { return c.l === l.n; }).map(function (c) {
            var h = V.lit[c.id];
            return '<button type="button" class="blk' + (h ? ' lit' : '') + (V.pick === c.id ? ' pick' : '') + '" style="flex-grow:' + c.tok + '" data-id="' + c.id + '" title="Lecture ' + c.l + ' · ' + esc(c.title) + '">' + (h && h.n > 1 ? '<i>' + h.n + '</i>' : '') + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>' + passageBox(BY[V.pick]) + '<p class="pfoot">Pile built ' + esc(P.built) + ' from the notes pages.</p>';
    $$('.blk', b).forEach(function (el) { el.onclick = function () { V.pick = el.getAttribute('data-id'); drawPile(); }; });
    return;
  }
  if (V.tab === 'map') { drawMap(b); return; }
  /* prompt */
  if (!V.prompt) { b.innerHTML = '<p class="pmeta">Nothing sent to the model yet. When something is, the exact text it read shows here.</p>'; return; }
  b.innerHTML = '<p class="pmeta">The exact text the model was sent last' + (V.promptTok ? ', <b>' + fmt(V.promptTok) + ' tokens</b> by Groq’s count' : '') + '. <span class="key"><i class="kp"></i>from the pile</span></p><pre class="prompt">' + promptHtml(V) + '</pre>';
}
function promptHtml(V) {
  if (!V.parts) return esc(V.prompt);
  return V.parts.map(function (p) { return p.pile ? '<span class="frompile">' + esc(p.t) + '</span>' : esc(p.t); }).join('');
}
function setPrompt(parts, tok) { VIEWSTATE.parts = parts; VIEWSTATE.prompt = parts.map(function (p) { return p.t; }).join(''); VIEWSTATE.promptTok = tok || 0; if (VIEWSTATE.tab === 'prompt') drawPile(); }

/* the map: each passage at the two coordinates the script computed from its 384 numbers (PCA) */
function drawMap(b) {
  var V = VIEWSTATE, xs = P.chunks.map(function (c) { return c.x; }), ys = P.chunks.map(function (c) { return c.y; });
  var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
  if (V.q) { x0 = Math.min(x0, V.q.x); x1 = Math.max(x1, V.q.x); y0 = Math.min(y0, V.q.y); y1 = Math.max(y1, V.q.y); }
  /* one scale for both axes, so a distance on the picture means the same across and down */
  var W = 600, pad = 18, sc = (W - 2 * pad) / (x1 - x0), H = Math.round(Math.max(240, (y1 - y0) * sc + 2 * pad)), oy = (H - (y1 - y0) * sc) / 2;
  var X = function (x) { return pad + (x - x0) * sc; }, Y = function (y) { return oy + (y - y0) * sc; };
  var cen = P.lectures.map(function (l) { var cs = P.chunks.filter(function (c) { return c.l === l.n; }); return { n: l.n, x: cs.reduce(function (s, c) { return s + c.x; }, 0) / cs.length, y: cs.reduce(function (s, c) { return s + c.y; }, 0) / cs.length }; });
  var lines = V.q ? V.near.map(function (h) { var c = BY[h.id]; return '<line x1="' + X(V.q.x).toFixed(1) + '" y1="' + Y(V.q.y).toFixed(1) + '" x2="' + X(c.x).toFixed(1) + '" y2="' + Y(c.y).toFixed(1) + '"/>'; }).join('') : '';
  b.innerHTML = '<p class="pmeta">' + (V.q ? '<b>“' + esc(clip(V.q.text, 70)) + '”</b> placed on the map. The lines go to the ' + V.near.length + ' nearest passages.' : 'Each dot is one passage. Passages with close meanings sit close together.') + '</p>' +
    '<svg class="map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="A map of the ' + P.chunks.length + ' passages">' +
    '<g class="cl">' + cen.map(function (c) { return '<text x="' + X(c.x).toFixed(1) + '" y="' + (Y(c.y) - 8).toFixed(1) + '">L' + c.n + '</text>'; }).join('') + '</g>' +
    '<g class="nl">' + lines + '</g>' +
    '<g class="dots">' + P.chunks.map(function (c) {
      var h = V.lit[c.id];
      return '<circle data-id="' + c.id + '" cx="' + X(c.x).toFixed(1) + '" cy="' + Y(c.y).toFixed(1) + '" r="' + (h ? 6 : 4) + '" class="' + (h ? 'lit' : '') + (V.pick === c.id ? ' pick' : '') + '"><title>Lecture ' + c.l + ' · ' + esc(c.title) + '</title></circle>';
    }).join('') + '</g>' +
    (V.q ? '<g class="qd"><circle cx="' + X(V.q.x).toFixed(1) + '" cy="' + Y(V.q.y).toFixed(1) + '" r="8"/><text x="' + (X(V.q.x) + 12).toFixed(1) + '" y="' + (Y(V.q.y) + 4).toFixed(1) + '">your question</text></g>' : '') +
    '</svg>' +
    (V.q ? '<ol class="near">' + V.near.map(function (h) { var c = BY[h.id]; return '<li><button type="button" data-id="' + c.id + '"><b>' + h.score.toFixed(2) + '</b> Lecture ' + c.l + ' · ' + esc(c.title) + '</button></li>'; }).join('') + '</ol>' : '') +
    passageBox(BY[V.pick]) +
    '<p class="pfoot">A flat picture of ' + P.dims + ' numbers per passage. It keeps about ' + Math.round(P.pca.kept * 100) + '% of how they differ, so two dots that look close can be far apart. The lines and the scores (1 is identical) are measured in all ' + P.dims + ' numbers.</p>';
  $$('circle[data-id], .near button', b).forEach(function (el) { el.onclick = function () { V.pick = el.getAttribute('data-id'); drawPile(); }; });
}

/* ---------- turning a question into numbers ---------- */
var embedder = null;
function questionVector(text) {
  var q = P.questions.filter(function (x) { return x.q === text; })[0];
  if (q) return Promise.resolve({ v: q.v, pre: true });
  if (!embedder) {
    say('Loading the small model into your browser (about 34 MB, once). The five scoreboard questions did not need it.');
    embedder = import(TF).then(function (t) { return t.pipeline('feature-extraction', EMBED, { dtype: 'q8' }); });
    embedder.catch(function () { embedder = null; });
  }
  return embedder.then(function (e) { return e([text], { pooling: 'mean', normalize: true }); }).then(function (out) {
    say(''); return { v: Array.from(out.data).map(function (x) { return Math.round(x * 1e5) / 1e5; }), pre: false };
  }, function () { throw new Error('The small model could not load in this browser. The five scoreboard questions still work.'); });
}
function project(v) {
  var m = P.pca.mean, c = P.pca.comps, x = 0, y = 0;
  for (var d = 0; d < v.length; d++) { x += (v[d] - m[d]) * c[0][d]; y += (v[d] - m[d]) * c[1][d]; }
  return { x: x, y: y };
}

/* ---------- the moves every station is made of ---------- */
function searchWords(words, k) {
  var body = { op: 'words', words: words, k: k || 10 };
  return hop('you', 'server', 'Find “' + clip(words, 60) + '”', body, { fast: true })
    .then(function () { return post(body); })
    .then(function (d) {
      return hop('server', 'pile', 'Keyword search: every passage that contains “' + clip(words, 50) + '”', { search: 'words', words: words, k: body.k }, { fast: true })
        .then(function () { return hop('pile', 'server', d.total ? d.total + ' passage' + (d.total === 1 ? '' : 's') + (d.total > d.hits.length ? ', the ' + d.hits.length + ' with most mentions sent back' : '') : 'No passage contains those words', d, { stop: !d.total }); })
        .then(function () { return hop('server', 'you', d.total ? 'The ' + d.hits.length + ' passages, with their lectures' : 'Nothing found', null, { fast: true }); })
        .then(function () { return d; });
    });
}
function searchMeaning(text, k) {
  var vec;
  return questionVector(text).then(function (r) {
    vec = r.v;
    return note('you', r.pre ? 'Your browser used the 384 numbers shipped with this scoreboard question (the same small model made them).' : 'Your browser turned the question into 384 numbers with a small model (' + EMBED + '). No message: it ran on your machine.');
  }).then(function () {
    var body = { op: 'nearest', v: vec, k: k };
    var shown = { op: 'nearest', v: '[' + vec.slice(0, 4).join(', ') + ', … 380 more numbers]', k: k };
    return hop('you', 'server', 'Find the ' + k + ' passages nearest these 384 numbers', shown, { fast: true })
      .then(function () { return post(body); })
      .then(function (d) {
        return hop('server', 'pile', 'Search by meaning: score all ' + P.chunks.length + ' passages against the question’s numbers', { search: 'nearest', v: '(the same 384 numbers)', k: k }, { fast: true })
          .then(function () { return hop('pile', 'server', 'The ' + d.hits.length + ' closest: ' + d.hits.map(function (h) { return 'L' + h.lecture + ' (' + h.score.toFixed(2) + ')'; }).join(', '), d); })
          .then(function () { return hop('server', 'you', 'The ' + d.hits.length + ' passages, with their scores', null, { fast: true }); })
          .then(function () { var p = project(vec); VIEWSTATE.q = { text: text, x: p.x, y: p.y }; VIEWSTATE.near = d.hits; return d; });
      });
  });
}
/* the prompt with passages in it: every word of it is on the wire and in the Prompt tab */
function withPassages(q, hits, honest) {
  var parts = [{ t: 'Answer the question using these passages from our course notes.' + (honest ? HONEST : '') + '\n\n' }];
  hits.forEach(function (h, i) { parts.push({ t: '[' + (i + 1) + '] Lecture ' + h.lecture + ', "' + h.section + '"\n' + h.text + '\n\n', pile: true }); });
  parts.push({ t: 'Question: ' + q });
  return parts;
}
/* one round: you -> server -> model -> server -> you */
function ask(content, opts) {
  opts = opts || {};
  var msgs = opts.messages || [{ role: 'user', content: content }], body = chatBody(msgs, opts.tools);
  return (opts.quiet ? Promise.resolve() : hop('you', 'server', opts.title || '“' + clip(content, 90) + '”', asSent(body), { fast: opts.fast, compact: opts.compact }))
    .then(function () { return post(body); })
    .then(function (d) {
      meterAdd(d.usage);
      var last = msgs[msgs.length - 1];
      return hop('server', 'model', opts.reqTitle || (last.role === 'tool' ? 'The conversation so far + the result' : '“' + clip(last.content, 80) + '”' + (opts.tools ? ' + the card' : '')), d.sent, { compact: opts.compact, fast: opts.fast })
        .then(function () {
          if (d.refused) return hop('model', 'server', 'Refused before the model read a word: ' + clip((d.raw.error && d.raw.error.message) || 'too large', 140), d.raw, { stop: true, open: true });
          return hop('model', 'server', d.failed ? 'A tool call Groq could not read' : d.call ? 'A request: ' + d.call.name + '(' + JSON.stringify(d.call.arguments) + ')' : 'An answer: ' + clip(d.raw.content || '(empty)', 150), d.raw, { compact: opts.compact, fast: opts.fast, stop: !!d.call, open: !!d.call });
        })
        .then(function () { return d; });
    });
}
function answerOf(d) { return d.refused ? '' : d.failed ? '(the model wrote something Groq could not read)' : plain(d.raw.content) || '(no answer)'; }
function guessBox(id, prompt, options) {
  var g = S.guess[id];
  return '<div class="guess"><p class="lab">' + esc(prompt) + ' <span>One tap, not scored.</span></p><div class="seg">' + options.map(function (o, i) {
    return '<button type="button" data-g="' + i + '" aria-pressed="' + (g === i) + '">' + esc(o) + '</button>';
  }).join('') + '</div></div>';
}
function bindGuess(id, redraw) { $$('.guess .seg button').forEach(function (b) { b.onclick = function () { S.guess[id] = +b.getAttribute('data-g'); save(); redraw(); }; }); }
function guessed(id, options) { return S.guess[id] != null ? 'You guessed: ' + options[S.guess[id]] + '. ' : ''; }
function answerBox(q, a, ok, hits) {
  return '<p class="q">“' + esc(q) + '”</p><p class="ans' + (ok === true ? ' pass' : ok === false ? ' fail' : '') + '">' + esc(clip(a, 700)) + '</p>' +
    (hits && hits.length ? '<p class="rcpt"><span class="lab">Its sources: tap one to check it</span>' + hits.map(function (h, i) { return '<button type="button" data-id="' + h.id + '">[' + (i + 1) + '] L' + h.lecture + ' · ' + esc(clip(h.section, 40)) + '</button>'; }).join('') + '</p>' : '');
}
function bindReceipts() { $$('.rcpt button').forEach(function (b) { b.onclick = function () { VIEWSTATE.pick = b.getAttribute('data-id'); tab('text'); $('#pileview').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }; }); }
function verdict(id, ok) { return '<p class="vd ' + (ok ? 'pass' : 'fail') + '">' + id + (ok ? ' passes' : ' fails') + ': the rule wants ' + esc(RULES[id].pass) + '.</p>'; }

/* ---------- station 1: ask with nothing attached ---------- */
var G1 = ['0', '1 or 2', '3 or 4', 'All 5'];
function st1() {
  var t = T[1] || (T[1] = {});
  tab('text'); light([]); wnote('Five questions, one after another. To keep it short the wire shows each round compactly; open any message to see it exactly.');
  if (!t.ran) {
    ins('Ask the model five questions about our course.', true);
    ctx('Nothing from our notes is attached. Before you run it: how many will it get right?');
    panel(guessBox(1, 'How many of the five will pass?', G1) + '<div class="row"><button class="btn act" id="a"' + (S.guess[1] == null ? ' disabled' : '') + '>Ask all five</button></div>');
    bindGuess(1, st1);
    $('#a').onclick = function () { act(this, function () {
      clearWire(); meterStart(); t.res = [];
      return ORDER.reduce(function (p, id) {
        return p.then(function () {
          var q = P.Q[id].q;
          return ask(q, { compact: true, fast: true, title: id + ': “' + clip(q, 80) + '”' }).then(function (d) {
            var a = answerOf(d), ok = mark(id, a); t.res.push({ id: id, a: a, ok: ok });
            setPrompt([{ t: q }], d.usage && d.usage.prompt_tokens);
            return hop('server', 'you', id + ': ' + clip(a, 120), null, { compact: true, fast: true });
          });
        });
      }, Promise.resolve()).then(function () { t.ran = true; finish(1); st1(); });
    }); };
    return;
  }
  var n = t.res.filter(function (r) { return r.ok; }).length;
  ins(n + ' of 5. Nothing crossed to the pile.', false);
  ctx(guessed(1, G1) + 'Open the scoreboard questions above to read each answer against its rule.');
  panel('<ol class="five">' + t.res.map(function (r) { return '<li class="' + (r.ok ? 'pass' : 'fail') + '"><b>' + r.id + '</b> ' + esc(clip(r.a, 150)) + '</li>'; }).join('') + '</ol>');
  after('<p>Count the arrows on the wire: you, the server, the model, and back. <b>None went to the pile.</b> The model could only use what it learned before this course existed. Where it answered, it sounded just as sure when it was wrong.</p>');
  forward('Continue');
}

/* ---------- station 2: hand it the lecture number ---------- */
function st2() {
  var t = T[2] || (T[2] = {}), q = P.Q.Q1.q;
  tab('prompt'); light([]); wnote('');
  if (!t.answer) {
    ins('Hand it the lecture number.', true);
    ctx('The Lecture 11 move: give the model a card for a lookup. Q1 names its lecture, so the number is the key.');
    panel('<p class="q">“' + esc(q) + '”</p><div class="cardview"><span class="lab">The tool card</span><dl><dt>Name</dt><dd><code>' + LOOKUP.name + '</code></dd><dt>Use it when</dt><dd>' + esc(LOOKUP.description) + '</dd><dt>It needs</dt><dd>' + esc(LOOKUP.parameters.properties.number.description) + '</dd></dl></div>' +
      '<div class="row"><button class="btn act" id="a">Ask Q1 with the card</button></div>');
    $('#a').onclick = function () { act(this, function () {
      clearWire(); meterStart();
      var msgs = [{ role: 'user', content: q }];
      return ask(q, { tools: [LOOKUP] }).then(function (d) {
        if (d.failed || !d.call) { var a = answerOf(d); return hop('server', 'you', clip(a, 140)).then(function () { say('It answered without asking for the lecture. It predicts, so that can happen. Ask again.'); }); }
        var num = d.call.arguments && d.call.arguments.number; t.num = num; var body = { op: 'lecture', number: num };
        return hop('server', 'pile', 'get_lecture(' + JSON.stringify(num) + '): fetch lecture ' + num + '’s notes', { lookup: 'lecture', number: num })
          .then(function () { return post(body); })
          .then(function (r) {
            var res = r.result, tok = res.notes ? BY && P.lectures.filter(function (l) { return l.n === res.lecture; })[0].tok : 0;
            return hop('pile', 'server', res.notes ? 'Lecture ' + res.lecture + '’s notes: about ' + fmt(tok) + ' tokens' : res.error, { result: res.notes ? { lecture: res.lecture, title: res.title, notes: res.notes.slice(0, 600) + ' … (' + fmt(res.notes.length) + ' characters in all)' } : res })
              .then(function () {
                var m2 = msgs.concat([{ role: 'assistant', content: d.raw.content || null, tool_calls: d.raw.tool_calls.slice(0, 1).map(function (c) { return { id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } }; }) },
                  { role: 'tool', tool_call_id: d.call.id, content: JSON.stringify(res) }]);
                setPrompt([{ t: q + '\n\n(the model asked for lecture ' + num + ', and the server handed back:)\n' }, { t: JSON.stringify(res).slice(0, 4000) + (JSON.stringify(res).length > 4000 ? ' …' : ''), pile: true }]);
                return ask(null, { messages: m2, tools: [LOOKUP], quiet: true });
              });
          }).then(function (d2) {
            t.answer = answerOf(d2); t.ok = mark('Q1', t.answer);
            VIEWSTATE.promptTok = d2.usage && d2.usage.prompt_tokens; drawPile();
            return hop('server', 'you', clip(t.answer, 150)).then(function () { finish(2); st2(); });
          });
      });
    }); };
    return;
  }
  ins(t.ok ? 'Q1 passes. One hop to the pile and back.' : 'One hop to the pile and back.', false);
  ctx('');
  panel(answerBox(q, t.answer, t.ok) + verdict('Q1', t.ok));
  after('<p>The model asked for lecture ' + esc(t.num) + ', the server fetched those notes, the model read them. <b>The question carried its own key.</b> Q2 to Q5 name no lecture: “Which lecture teaches Verifier’s Law?” has no number to look up.</p>');
  forward('Continue');
}

/* ---------- station 3: paste one lecture, then all twelve ---------- */
var G3 = ['Yes, all twelve fit', 'No, something stops it'];
function st3() {
  var t = T[3] || (T[3] = { n: 1 }), q = P.Q.Q2.q;
  tab('prompt'); light([]); wnote('');
  var tok = P.lectures.slice(0, t.n).reduce(function (s, l) { return s + l.tok; }, 0);
  ins(t.sent ? (t.refused ? 'Refused. It fits the model, not your key.' : 'Sent. Now drag it to twelve.') : 'Paste one lecture, then all twelve.', !t.refused);
  ctx(t.refused ? '' : 'No searching: paste the notes in front of Q2 and let the model read them all. Drag to choose how many lectures go in.');
  panel('<p class="q">“' + esc(q) + '”</p>' +
    '<label class="slide"><span>Lectures pasted: <b id="nl">' + t.n + '</b> (1 to ' + t.n + ')</span><input type="range" id="sl" min="1" max="12" value="' + t.n + '"></label>' +
    '<div class="price"><span class="lab">Price per million tokens</span><label>in $<input id="pin" inputmode="decimal" value="' + S.price.in + '"></label><label>out $<input id="pout" inputmode="decimal" value="' + S.price.out + '"></label><a href="https://groq.com/pricing" target="_blank" rel="noopener">today’s price</a></div>' +
    '<p class="bill" id="bill"></p>' +
    (t.n === 12 && S.guess[3] == null ? guessBox(3, 'Will all twelve go through on a free key?', G3) : '') +
    '<div class="row"><button class="btn act" id="a"' + (t.n === 12 && S.guess[3] == null ? ' disabled' : '') + '>Send Q2 with ' + t.n + ' lecture' + (t.n > 1 ? 's' : '') + '</button></div>');
  var bill = function () {
    var tk = P.lectures.slice(0, t.n).reduce(function (s, l) { return s + l.tok; }, 0) + 30, one = tk * S.price.in / 1e6;
    $('#bill').innerHTML = 'About <b>' + fmt(tk) + ' tokens</b> in, every time this question is asked. One question: ' + money(one) + '. A thousand a day for 30 days: <b>' + money(one * 30000) + '</b>, before a word of the answer.';
    if (!t.sent) paintMeter(tk);
  };
  bill();
  if (t.n === 12) bindGuess(3, st3);
  $('#sl').oninput = function () { t.n = +this.value; $('#nl').textContent = t.n; $('#a').textContent = 'Send Q2 with ' + t.n + ' lecture' + (t.n > 1 ? 's' : ''); bill(); };
  $('#sl').onchange = function () { if (t.n === 12 && S.guess[3] == null) st3(); };
  var price = function () { var a = parseFloat($('#pin').value), b = parseFloat($('#pout').value); if (isFinite(a) && a >= 0) S.price.in = a; if (isFinite(b) && b >= 0) S.price.out = b; save(); bill(); };
  $('#pin').oninput = price; $('#pout').oninput = price;
  $('#a').onclick = function () { act(this, function () {
    clearWire(); meterStart();
    var parts = [];
    P.lectures.slice(0, t.n).forEach(function (l) { parts.push({ t: 'Lecture ' + l.n + ': ' + l.title + '\n' + l.text + '\n\n', pile: true }); });
    parts.push({ t: 'Question: ' + q });
    var content = parts.map(function (p) { return p.t; }).join('');
    setPrompt(parts, 0);
    return ask(content, { title: t.n + ' lecture' + (t.n > 1 ? 's' : '') + ' of notes + Q2 (' + fmt(content.length) + ' characters)', reqTitle: t.n + ' lecture' + (t.n > 1 ? 's' : '') + ' of notes + Q2' }).then(function (d) {
      t.sent = true;
      if (d.refused) { var m = /Requested (\d+)/.exec((d.raw.error && d.raw.error.message) || ''); RUN.refused = m ? +m[1] : 1; paintMeter(); t.refused = true; return hop('server', 'you', 'Refused: too large for your key').then(function () { finish(3); st3(); }); }
      VIEWSTATE.promptTok = d.usage && d.usage.prompt_tokens; drawPile();
      t.answer = answerOf(d); t.ok = mark('Q2', t.answer);
      return hop('server', 'you', clip(t.answer, 140)).then(function () { if (t.n >= 3) finish(3); st3(); });
    });
  }); };
  if (t.refused) {
    after('<p>Read Groq’s refusal on the wire: <b>' + (RUN && RUN.refused > 1 ? fmt(RUN.refused) : 'about 31,000') + ' tokens asked for, ' + fmt(FREE_TPM) + ' a minute allowed</b>. The model itself can read about 131,000, so it fits. But every question re-sends all of it, and pays for all of it, to use two paragraphs. And when it answers, nothing says which paragraph it used.</p><p class="big">Send only the passages that matter.</p>');
    forward('Continue');
  } else if (t.sent) {
    after(t.answer ? '<p>' + (t.ok ? 'It found it, ' : 'It read ') + 'with ' + fmt(RUN ? RUN.inT : 0) + ' tokens in. Look at the meter, then drag to 12 and send again.</p>' : '');
    forward(S.done[3] ? 'Continue' : '');
  } else { after(''); forward(S.done[3] ? 'Continue' : ''); }
}

/* ---------- station 4: find it by its words ---------- */
var G4 = ['None', '1 to 5', '6 or more'];
function st4() {
  var t = T[4] || (T[4] = { p: 0 }), q2 = P.Q.Q2.q, q3 = P.Q.Q3.q;
  tab('text'); wnote('The pile lives with the server. A search is the server’s own code running over it, so the wire shows what went in and what came out.');
  if (t.p === 0) {
    ins('Find Q2 by its words.', true);
    ctx('Like Ctrl+F across every passage: type words from the question and watch which passages light up.');
    panel('<p class="q">“' + esc(q2) + '”</p><div class="ask"><input id="w" maxlength="60" placeholder="Words to find" value="' + esc(t.w || '') + '"><button class="btn act" id="f">Find</button></div><div class="chips"><button type="button">Verifier</button><button type="button">Verifier’s Law</button></div>' +
      (t.hits ? '<div class="row"><button class="btn act" id="h"' + (t.hits.length ? '' : ' disabled') + '>Hand the top ' + Math.min(3, t.hits.length) + ' to the model with Q2</button></div>' : ''));
    var find = function () { var w = $('#w').value.trim(); if (!w) return say('Type a word first.'); t.w = w; act($('#f'), function () {
      clearWire();
      return searchWords(w, 10).then(function (d) { t.hits = d.hits; t.total = d.total; light(d.hits, w); VIEWSTATE.pick = d.hits[0] && d.hits[0].id; drawPile(); st4(); });
    }); };
    $('#f').onclick = find; $('#w').onkeydown = function (e) { if (e.key === 'Enter') find(); };
    $$('.chips button').forEach(function (c) { c.onclick = function () { $('#w').value = c.textContent; find(); }; });
    if ($('#h')) $('#h').onclick = function () { act(this, function () {
      var top = t.hits.slice(0, 3), parts = withPassages(q2, top, true), content = parts.map(function (p) { return p.t; }).join('');
      meterStart(); setPrompt(parts, 0);
      return ask(content, { title: 'Q2 + the top ' + top.length + ' passages for “' + t.w + '”' }).then(function (d) {
        VIEWSTATE.promptTok = d.usage && d.usage.prompt_tokens; drawPile();
        t.a2 = answerOf(d); t.ok2 = mark('Q2', t.a2); t.used = top;
        return hop('server', 'you', clip(t.a2, 140)).then(function () { t.p = 1; st4(); });
      });
    }); };
    if (t.hits) after('<p>' + (t.total ? '<b>' + t.total + ' passages</b> contain “' + esc(t.w) + '”, in lectures ' + uniq(t.hits.map(function (h) { return h.lecture; })).join(', ') + (t.total > t.hits.length ? ' and more' : '') + '. Which ones do you hand over? The ones with most mentions go first.' : 'No passage contains those exact words. Try fewer words.') + '</p>');
    return;
  }
  if (t.p === 1) {
    ins(t.ok2 ? 'Q2 passes. Now try Q3 the same way.' : 'Now try Q3 the same way.', true);
    ctx('');
    panel(answerBox(q2, t.a2, t.ok2, t.used) + verdict('Q2', t.ok2) + '<hr><p class="q">“' + esc(q3) + '”</p>' + guessBox(4, 'How many passages contain “making things up”?', G4) +
      '<div class="row"><button class="btn act" id="f3"' + (S.guess[4] == null ? ' disabled' : '') + '>Find “making things up”</button></div>');
    bindReceipts(); bindGuess(4, st4);
    $('#f3').onclick = function () { act(this, function () {
      clearWire();
      return searchWords('making things up', 10).then(function (d) { light(d.hits, 'making things up'); VIEWSTATE.pick = null; drawPile(); t.p = 2; S.score.Q3 = S.score.Q3 === true ? true : false; save(); paintScore('Q3'); finish(4); st4(); });
    }); };
    return;
  }
  ins('Zero passages. Q3 stays red.', false);
  ctx(guessed(4, G4));
  panel('<p class="q">“' + esc(q3) + '”</p><p class="none">No passage contains “making things up”.</p>');
  after('<p>Lecture 10 has a whole section on exactly this. It calls it <b>hallucination</b>, a word the question never used. Search by words is exact, fast and blind to meaning. Done well, with an index built ahead of time, it is called <b>keyword search</b>.</p>');
  forward('Continue');
}
function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

/* ---------- station 5: find it by its meaning ---------- */
var G5 = ['“It’s not in the notes”', 'A refund policy'];
function st5() {
  var t = T[5] || (T[5] = { p: 0 }), q3 = P.Q.Q3.q, q4 = P.Q.Q4.q;
  tab('map'); wnote('The question becomes 384 numbers in your browser. The server scores every passage against them and sends back the closest.');
  var kRow = '<label class="slide"><span>Passages to hand over: <b id="kv">' + S.k + '</b></span><input type="range" id="k" min="1" max="10" value="' + S.k + '"></label>';
  var bindK = function () { $('#k').oninput = function () { S.k = +this.value; $('#kv').textContent = S.k; save(); }; };
  if (t.p === 0) {
    ins('Drop Q3 on the map.', true);
    ctx('Every passage already sits on the map by its meaning. Place the question the same way and see what is near it.');
    panel('<p class="q">“' + esc(q3) + '”</p>' + kRow + '<div class="row"><button class="btn act" id="a">Place Q3 and find the nearest</button></div>');
    bindK();
    $('#a').onclick = function () { act(this, function () {
      clearWire();
      return searchMeaning(q3, S.k).then(function (d) { t.h3 = d.hits; light(d.hits, ''); VIEWSTATE.pick = d.hits[0].id; drawPile(); t.p = 1; st5(); });
    }); };
    return;
  }
  if (t.p === 1) {
    ins('Hand them to the model.', true);
    ctx('Top hit: Lecture ' + t.h3[0].lecture + ', “' + esc(t.h3[0].section) + '”. It never says “making things up”.');
    panel('<p class="q">“' + esc(q3) + '”</p><ol class="hitlist">' + t.h3.map(function (h) { return '<li><b>' + h.score.toFixed(2) + '</b> Lecture ' + h.lecture + ' · ' + esc(h.section) + '</li>'; }).join('') + '</ol><div class="row"><button class="btn act" id="h">Hand these ' + t.h3.length + ' to the model with Q3</button></div>');
    $('#h').onclick = function () { act(this, function () {
      var parts = withPassages(q3, t.h3, true), content = parts.map(function (p) { return p.t; }).join('');
      meterStart(); setPrompt(parts, 0);
      return ask(content, { title: 'Q3 + the ' + t.h3.length + ' nearest passages' }).then(function (d) {
        VIEWSTATE.promptTok = d.usage && d.usage.prompt_tokens;
        t.a3 = answerOf(d); t.ok3 = mark('Q3', t.a3);
        return hop('server', 'you', clip(t.a3, 140)).then(function () { t.p = 2; st5(); });
      });
    }); };
    return;
  }
  if (t.p === 2) {
    ins('Now drop Q4 on the map.', true);
    ctx('The refund policy for this cohort is not in our notes. Something will still be nearest.');
    panel(answerBox(q3, t.a3, t.ok3, t.h3) + verdict('Q3', t.ok3) + '<hr><p class="q">“' + esc(q4) + '”</p>' + kRow + '<div class="row"><button class="btn act" id="a">Place Q4 and find the nearest</button></div>');
    bindReceipts(); bindK();
    $('#a').onclick = function () { act(this, function () {
      clearWire();
      return searchMeaning(q4, S.k).then(function (d) { t.h4 = d.hits; light(d.hits, ''); VIEWSTATE.pick = d.hits[0].id; drawPile(); t.p = 3; st5(); });
    }); };
    return;
  }
  if (t.p === 3) {
    ins('Hand them over. What will it say?', true);
    ctx('Nearest: Lecture ' + t.h4[0].lecture + ', “' + esc(t.h4[0].section) + '”, scored ' + t.h4[0].score.toFixed(2) + '. Nearest is not the same as relevant: the map has no edge.');
    panel('<p class="q">“' + esc(q4) + '”</p>' + honestSwitch() + guessBox(5, 'What will the model say?', G5) + '<div class="row"><button class="btn act" id="h"' + (S.guess[5] == null ? ' disabled' : '') + '>Hand the ' + t.h4.length + ' passages to the model with Q4</button></div>');
    bindGuess(5, st5); bindHonest(st5);
    $('#h').onclick = function () { act(this, function () { return runQ4(t); }); };
    return;
  }
  /* p 4: the Q4 answer is in; the switch can flip it */
  var ok = t.ok4;
  ins(ok ? 'Q4 passes. The right answer was a refusal.' : 'A confident answer, from the wrong passage.', !ok);
  ctx(ok ? '' : guessed(5, G5) + 'Tap its source to check it. Then turn the switch on and send again.');
  panel(answerBox(q4, t.a4, ok, t.h4) + verdict('Q4', ok) + honestSwitch() + '<div class="row"><button class="btn act" id="h">Send Q4 again</button></div>');
  bindReceipts(); bindHonest(st5);
  $('#h').onclick = function () { act(this, function () { return runQ4(t); }); };
  if (ok && S.score.Q3) {
    finish(5);
    after('<div class="named"><span class="lab">What this is called</span><p class="big">The 384 numbers are an embedding.</p><p>Search by meaning compares embeddings. Find the passages, put them in the prompt, let the model write: that is <b>retrieval-augmented generation</b>. Two ways it fails: it found the wrong thing (Q4 before the switch), or it wrote the wrong thing from the right passage. The receipt tells you which.</p></div>' + ownQuestion());
    bindOwn();
    forward('Continue');
  } else { after(ok ? '' : ''); forward(''); }
}
function honestSwitch() {
  return '<div class="row sw"><span class="lab">The prompt may say “' + esc(HONEST.trim()) + '”</span><span class="seg"><button data-h="0" aria-pressed="' + !S.honest + '">Off</button><button data-h="1" aria-pressed="' + S.honest + '">On</button></span></div>';
}
function bindHonest(redraw) { $$('.sw .seg button').forEach(function (b) { b.onclick = function () { S.honest = b.getAttribute('data-h') === '1'; save(); redraw(); }; }); }
function runQ4(t) {
  var q4 = P.Q.Q4.q, parts = withPassages(q4, t.h4, S.honest), content = parts.map(function (p) { return p.t; }).join('');
  clearWire(); meterStart(); setPrompt(parts, 0);
  return ask(content, { title: 'Q4 + the ' + t.h4.length + ' nearest passages' + (S.honest ? ', switch on' : '') }).then(function (d) {
    VIEWSTATE.promptTok = d.usage && d.usage.prompt_tokens;
    t.a4 = answerOf(d); t.ok4 = mark('Q4', t.a4);
    return hop('server', 'you', clip(t.a4, 140)).then(function () { t.p = 4; st5(); });
  });
}
function ownQuestion() {
  return '<div class="own"><h2>Ask your own</h2><p>Type any question. Your browser loads the same small model the script used, places the question on the map, and the server finds the nearest passages. Nothing is sent to the model.</p><div class="ask"><input id="oq" maxlength="200" placeholder="A question about our course"><button class="btn act" id="og">Place it</button></div></div>';
}
function bindOwn() {
  var fire = function () { var v = $('#oq').value.trim(); if (!v) return say('Type a question first.'); act($('#og'), function () {
    clearWire();
    return searchMeaning(v, S.k).then(function (d) { light(d.hits, ''); VIEWSTATE.pick = d.hits[0].id; tab('map'); });
  }); };
  $('#og').onclick = fire; $('#oq').onkeydown = function (e) { if (e.key === 'Enter') fire(); };
}

/* ---------- station 6: let the model search, as many times as it needs ---------- */
var G6 = ['Once', 'Twice', 'Three times or more'];
function st6() {
  var t = T[6] || (T[6] = {}), q5 = P.Q.Q5.q;
  tab('prompt'); wnote('The server runs the loop: every search the model asks for, and every round with the model, up to four rounds.');
  var card = '<div class="cardview"><span class="lab">The tool card the server sends</span><dl><dt>Name</dt><dd><code>search_notes</code></dd><dt>Use it when</dt><dd>Searches the 100xEngineers Cohort 8 lecture notes (Lectures 1 to 12) for passages that contain the exact words you give. Returns up to 3 passages, each with its lecture number. Use 1 to 3 words exactly as they would appear in the notes. If nothing comes back, try other words.</dd><dt>It needs</dt><dd>The exact words to look for, 1 to 3 words.</dd></dl></div>';
  if (!t.answer) {
    ins('Let the model search for Q5 itself.', true);
    ctx('The answer is in Lecture 1, but the question only names Lecture 9. One search cannot reach it: the second search depends on what the first one finds.');
    panel('<p class="q">“' + esc(q5) + '”</p>' + card + guessBox(6, 'How many searches will the model ask for?', G6) + '<div class="row"><button class="btn act" id="a"' + (S.guess[6] == null ? ' disabled' : '') + '>Ask Q5, search card attached</button></div>');
    bindGuess(6, st6);
    $('#a').onclick = function () { act(this, function () {
      clearWire(); meterStart(); light([]);
      var body = { op: 'loop', question: q5 };
      return hop('you', 'server', '“' + clip(q5, 90) + '”', asSent(body))
        .then(function () { return post(body).catch(function (e) { return e.data && e.data.events ? playLoop(e.data.events).then(function () { throw e; }) : Promise.reject(e); }); })
        .then(function (d) {
          return playLoop(d.events).then(function () {
            t.answer = d.failed ? '(the model wrote something Groq could not read)' : plain(d.answer) || '(no answer)'; t.searches = d.searches; t.ok = mark('Q5', t.answer);
            return hop('server', 'you', clip(t.answer, 150));
          }).then(function () { if (t.ok) finish(6); st6(); });
        });
    }); };
    return;
  }
  var all = ORDER.every(function (id) { return S.score[id] === true; });
  ins(t.ok ? (all ? 'Five out of five.' : 'Q5 passes.') : 'Q5 did not pass this time.', !t.ok);
  ctx(guessed(6, G6) + 'It searched ' + t.searches + ' time' + (t.searches === 1 ? '' : 's') + '. Read the searches on the wire: the second one uses a word the first one found.');
  panel(answerBox(q5, t.answer, t.ok, VIEWSTATE.used6) + verdict('Q5', t.ok) + '<div class="row"><button class="btn" id="again">Ask again</button><button class="btn" id="dl">Download the log</button></div>');
  bindReceipts();
  $('#again').onclick = function () { T[6] = {}; clearWire(); st6(); };
  $('#dl').onclick = download;
  after(t.ok ? '<p>The meter counts every round: each one re-sends the whole conversation so far, passages included. <b>A path costs more than a lookup.</b> Use it when the question is a path.</p>' +
    (all ? '' : '<p>Some scoreboard questions are still red. Go back to their station to turn them green.</p>') : '<p>It predicts, so a search can go another way. Ask again and read the searches it chose.</p>');
  forward('');
}
function playLoop(events) {
  var used = [];
  return events.reduce(function (p, e) {
    return p.then(function () {
      if (e.kind === 'note') return note('server', e.text);
      if (e.kind === 'model_req') {
        var last = e.body.messages[e.body.messages.length - 1];
        setPrompt(e.body.messages.map(function (m) { return m.role === 'tool' ? { t: '\n[search result]\n' + m.content + '\n', pile: true } : m.role === 'user' ? { t: m.content + '\n' } : { t: '\n[the model asked: ' + (m.tool_calls ? m.tool_calls.map(function (c) { return c.function.name + ' ' + c.function.arguments; }).join(', ') : '') + ']\n' }; }), 0);
        return hop('server', 'model', e.again ? 'The same request, sent again' : last.role === 'tool' ? 'The conversation so far + the search result + the card' : '“' + clip(last.content, 80) + '” + the card', e.body, { fast: true });
      }
      if (e.kind === 'model_res') {
        if (e.usage) { meterAdd(e.usage); VIEWSTATE.promptTok = e.usage.prompt_tokens; }
        if (e.limited) return hop('model', 'server', 'Not now: your key’s per-minute limit', e.body, { stop: true });
        return hop('model', 'server', e.failed ? 'A tool call Groq could not read' : e.call ? 'A request: search_notes(' + JSON.stringify(e.call.arguments && e.call.arguments.words) + ')' : 'An answer: ' + clip(e.body.content || '(empty)', 150), e.body, { stop: !!e.call, open: !!e.call });
      }
      if (e.kind === 'search') return hop('server', 'pile', 'Keyword search: “' + clip(e.args.words, 50) + '”', e.args, { fast: true });
      if (e.kind === 'found') {
        e.body.hits.forEach(function (h) { if (!used.some(function (u) { return u.id === h.id; })) used.push(h); });
        light(used, ''); VIEWSTATE.used6 = used;
        return hop('pile', 'server', e.body.total ? e.body.total + ' passage' + (e.body.total === 1 ? '' : 's') + ', top ' + e.body.hits.length + ': ' + e.body.hits.map(function (h) { return 'L' + h.lecture; }).join(', ') : 'Nothing found', e.body);
      }
      return Promise.resolve();
    });
  }, Promise.resolve()).then(function () { drawPile(); });
}
function download() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['Retrieval Bench log, ' + new Date().toString() + '\nScoreboard: ' + JSON.stringify(S.score) + '\n\n' + LOG.join('\n\n') + '\n'], { type: 'text/plain' }));
  a.download = 'retrieval-bench-log.txt'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

/* ---------- moving between stations ---------- */
var VIEW = [null, st1, st2, st3, st4, st5, st6];
function paintBar() {
  $('#where').textContent = 'Station ' + S.step + ' of ' + N + ' · ' + NAMES[S.step];
  $$('#segs a').forEach(function (a) {
    var n = +a.getAttribute('data-s');
    a.classList.toggle('on', n === S.step); a.classList.toggle('done', !!S.done[n] && n !== S.step); a.classList.toggle('reach', n <= S.max);
  });
  $('#back').hidden = S.step === 1;
}
function go(n) {
  n = Math.max(1, Math.min(N, n));
  if (n > S.max) n = S.max;
  VISIT++;
  S.step = n; save();
  T[n] = undefined; clearWire(); waitOn(''); say(''); after(''); forward(''); wnote('');
  VIEWSTATE.q = null; VIEWSTATE.near = []; VIEWSTATE.pick = null; light([]);
  $$('.btn.busy').forEach(function (b) { b.classList.remove('busy'); b.disabled = false; });
  paintBar(); paintScore(); RUN = null; paintMeter();
  if (groqKey) VIEW[n](); else keyGate(n);
  drawPile();
  if (location.hash !== '#' + n) history.replaceState(null, '', '#' + n);
  window.scrollTo(0, 0); $('#ins').focus({ preventScroll: true });
}
$$('#segs a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(+a.getAttribute('data-s')); }; });
$('#back').onclick = function (e) { e.preventDefault(); go(S.step - 1); };
pileReady.then(function () { go(+location.hash.slice(1) || S.step); }, function () { ins('The pile did not load. Refresh the page.', false); });
})();
