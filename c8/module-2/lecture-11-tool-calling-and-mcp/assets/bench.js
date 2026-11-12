/* Tool Bench: Lecture 11. One bench, one wire, five steps.
   The bench: You talk only to the Server (/api/toolcall). The Server talks to the Model (GPT-OSS on Groq) and to the
   Sheet (the curriculum sheet, or the learner's own; from step 5, the sheet's own MCP server at /api/mcp).
   The wire's promise is "every message that crossed", so:
   - every hop shows the exact JSON that crossed (the server returns what it sent and what came back);
   - things that are not messages (the server reusing its copy of the sheet, picking a row) show as dashed notes;
   - where the page leaves hops out (step 3 shows only server <-> model), the wire says so.
   State: localStorage c8.l11.bench. The learner's own Groq key lives in sessionStorage c8.l11.key (gone when the tab
   closes), rides to /api/toolcall in a header, and is never stored or logged there. */
(function () {
'use strict';

var API = '/api/toolcall', MCP = location.origin + '/api/mcp', KEY = 'c8.l11.bench', KEYS = 'c8.l11.key';
var CUR = '1Kg6T-dJWaYx_JCPiRk3u0nBuAQcsCVRDPj1NFKP4WzM', CUR_LINK = 'https://docs.google.com/spreadsheets/d/' + CUR;
var MODEL = 'openai/gpt-oss-120b';
var NAMES = ['', 'Ask', 'Carry it by hand', 'Write the card', 'Switch the server on', 'Move the card'];
var NODE = { you: 'You', model: 'Model', server: 'Server', sheet: 'Sheet' };
var LANE = { 'server-you': ['server-you', 'btt', 'ttb'], 'you-server': ['server-you', 'ttb', 'btt'], 'model-server': ['model-server', 'rtl'], 'server-model': ['model-server', 'ltr'], 'server-sheet': ['server-sheet', 'rtl'], 'sheet-server': ['server-sheet', 'ltr'] };
var Q1 = 'When is Lecture 12 of 100xEngineers Cohort 8, and what is it about?';
var GOOD = { name: 'get_lecture', when: 'Returns one lecture of the 100xEngineers Cohort 8 curriculum: its date, title, type and tools. Use it when someone asks about a specific lecture by number. Not for general questions.', needs: 'The lecture number, 1 to 19.' };
var TESTS = [Q1, 'Which tools do we use in the seventh class?', 'What is an API?', 'Is session ten a combined one or separate?', 'In lecture 3 of Harvard CS50, which language is taught?'];
var CARD_MAX = { when: 400, needs: 200 };

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
/* for titles only: the exact text is always in the message underneath */
var plain = function (s) { return String(s == null ? '' : s).replace(/^[ \t]*\|?[ \t:|-]*-{3,}[ \t:|-]*$/gm, '').replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, '').replace(/[ \t]*\|[ \t]*/g, ' · ').replace(/\n{2,}/g, '\n').replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, '$1$2').replace(/^#+\s*/gm, '').trim(); };
var pretty = function (v) { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); };

/* ---------- state ---------- */
function blankTests(own) { return own ? [0, 1, 2, 3, 4].map(function () { return { q: '', exp: '', num: '' }; }) : TESTS.map(function (q) { return { q: q, exp: '', num: '' }; }); }
function fresh() { return { v: 2, step: 1, max: 1, done: {}, card: { name: 'tool_1', when: '', needs: '' }, tests: blankTests(false), runs: 0, src: null, own: null }; }
var S = fresh();
try {
  var raw = JSON.parse(localStorage.getItem(KEY));
  if (raw && raw.v === 2) S = Object.assign(fresh(), raw);
  else if (raw && raw.v === 1) { S.done = raw.done || {}; S.max = raw.max || 1; S.step = raw.step || 1; S.card = raw.card || S.card; }   /* test 4 changed: marks start again */
} catch (e) { /* storage blocked: the bench still works */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
var T = {};            /* what happened in the current visit to a step; not saved */
var LOG = [];          /* the wire as text, for the download */
var groqKey = '';
try { groqKey = sessionStorage.getItem(KEYS) || ''; } catch (e) { /* blocked: asked again */ }

/* Every visit to a step gets a number. Work started in an earlier visit stops quietly instead of drawing on this one. */
var VISIT = 0, STALE = new Error('stale');
function fresher(v) { if (v !== VISIT) throw STALE; }

/* ---------- talking to the server ---------- */
function post(url, body) {
  var v = VISIT, h = { 'content-type': 'application/json' };
  if (groqKey && url === API) h['x-groq-key'] = groqKey;
  return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) {
    return r.text().then(function (t) {
      fresher(v);
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* not JSON */ }
      if (!r.ok) { var er = new Error((d && d.message) || (d && d.error && d.error.message) || 'The server did not answer. Try again.'); er.code = d && typeof d.error === 'string' ? d.error : ''; er.data = d; throw er; }
      return d;
    });
  }, function (e) { if (e === STALE) throw e; fresher(v); throw new Error('No connection. Check your internet and try again.'); });
}
/* what the page sends the server, as it crossed (the key travels in a header and is not shown) */
function asSent(body) { return { headers: { 'x-groq-key': 'gsk_… your key, not shown here' }, body: body }; }
function request(messages, tools) {
  var r = { model: MODEL, messages: messages };
  if (tools && tools.length) r.tools = tools.map(function (t) { return { type: 'function', function: t }; });
  return r;
}
function chatBody(messages, tools) { return { op: 'chat', request: request(messages, tools) }; }
function mcpUrl() {
  var p = new URLSearchParams();
  if (S.src) { p.set('sheet', S.src.sheet); if (S.src.gid) p.set('gid', S.src.gid); }
  p.set('name', S.card.name); p.set('when', S.card.when); p.set('needs', S.card.needs);
  return MCP + '?' + p.toString();
}
var argName = function () { return S.src ? 'search' : 'number'; };
function toolOf(card) {
  var p = {}; p[argName()] = { type: S.src ? 'string' : 'integer', description: card.needs || '' };
  return { name: card.name, description: card.when || '', parameters: { type: 'object', properties: p, required: [argName()] } };
}
function assistantMsg(raw) {   /* the model's tool call, passed back the way the server sends it */
  return { role: 'assistant', content: raw.content || null, tool_calls: (raw.tool_calls || []).slice(0, 1).map(function (c) { return { id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments } }; }) };
}

/* ---------- the bench and the wire ---------- */
function flash(from, to) {
  var l = LANE[from + '-' + to];
  if (l) {
    var lane = $('.lane[data-l="' + l[0] + '"]');
    lane.classList.remove('ltr', 'rtl', 'ttb', 'btt'); void lane.offsetWidth; lane.classList.add(l[1]);
  }
  [from, to].forEach(function (n) { var el = $('.node[data-n=' + n + ']'); if (!el) return; el.classList.add('lit'); setTimeout(function () { el.classList.remove('lit'); }, 800); });
}
function scrollWire(li) { var box = li.closest('.wirebox'); if (box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight; }
function hop(from, to, title, body, o) {
  o = o || {};
  var v = VISIT;
  var li = document.createElement('li'); li.className = 'w' + (o.stop ? ' stop' : '') + (o.compact ? ' c' : '');
  li.innerHTML = '<span class="rt"><b class="n-' + from + '">' + NODE[from] + '</b><i>→</i><b class="n-' + to + '">' + NODE[to] + '</b></span>' +
    '<span class="tt">' + esc(title) + '</span>' +
    (body != null ? '<details' + (o.open ? ' open' : '') + '><summary>The message, exactly</summary><pre>' + esc(pretty(body)) + '</pre></details>' : '');
  $('#wire').appendChild(li); $('#empty').hidden = true; scrollWire(li);
  flash(from, to);
  LOG.push(NODE[from] + ' -> ' + NODE[to] + ' | ' + title + (body != null ? '\n' + pretty(body).replace(/^/gm, '    ') : ''));
  return sleep(o.fast ? 120 : 600).then(function () { fresher(v); });
}
function note(who, html, text) {   /* not a message: something a box did on its own */
  var li = document.createElement('li'); li.className = 'w n';
  li.innerHTML = '<span class="tt"><b>' + NODE[who] + '</b> ' + html + '</span>';
  $('#wire').appendChild(li); $('#empty').hidden = true; scrollWire(li);
  LOG.push('(' + NODE[who] + ') ' + text);
  return sleep(250);
}
function clearWire() { $('#wire').innerHTML = ''; $('#empty').hidden = false; LOG = []; }
function wnote(text) { var n = $('#wnote'); n.textContent = text || ''; n.hidden = !text; }

function callText(c) { return c.name + '(' + (c.arguments && typeof c.arguments === 'object' ? Object.keys(c.arguments).map(function (k) { return k + ': ' + JSON.stringify(c.arguments[k]); }).join(', ') : String(c.arguments)) + ')'; }
function clip(s, n) { s = plain(s).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
var FAILED = 'A tool call Groq could not read (the model wrote it badly)';
function resTitle(r) { return r.failed ? FAILED : r.call ? 'A request: ' + callText(r.call) : 'An answer: ' + clip(r.raw.content || '(empty)', 160); }
function reqTitle(sent) {
  var last = sent.messages[sent.messages.length - 1];
  if (last.role === 'tool') return 'The conversation so far + the result';
  return '“' + clip(last.content, 90) + '”' + (sent.tools ? ' + the card' : '');
}
var RPC = {
  initialize: ['initialize: hello, which protocol version?', function (b) { return 'Hello back: protocol ' + (b && b.result ? b.result.protocolVersion : '?') + ', it has tools'; }],
  'notifications/initialized': ['initialized: ready (no reply expected)', function (b, st) { return st + ' Accepted, nothing in the body'; }],
  'tools/list': ['tools/list: what can you do?', function (b) { var t = b && b.result && b.result.tools; return t && t.length ? 'One tool: ' + t[0].name : 'No tools'; }],
  'tools/call': [null, function (b) { return b && b.result && b.result.isError ? 'An error the model can read' : 'The result'; }]
};
/* plays back what the server did, hop by hop */
function play(events, o) {
  o = o || {};
  return events.reduce(function (p, e) {
    return p.then(function () {
      if (e.note) {
        if (e.kind === 'cache') return note('server', 'used its copy of the sheet from ' + e.age + ' s ago, so nothing crossed to the sheet.', 'used its copy of the sheet from ' + e.age + ' s ago');
        return note('server', esc(e.text), e.text);
      }
      if (e.kind === 'model_req') return hop('server', 'model', reqTitle(e.body), e.body, o);
      if (e.kind === 'model_res') return hop('model', 'server', resTitle({ raw: e.body, call: e.call, failed: e.failed }), e.body, { open: !!e.call && !o.compact, compact: o.compact, fast: o.fast });
      if (e.kind === 'fetch') return hop('server', 'sheet', 'GET the whole sheet as CSV', e.body, o);
      if (e.kind === 'csv') return hop('sheet', 'server', 'The whole sheet: ' + e.lines + ' lines of CSV, ' + Math.round(e.bytes / 1024) + ' KB', e.body, o);
      if (e.kind === 'rpc') return hop('server', 'sheet', e.method === 'tools/call' ? 'tools/call: run ' + callText({ name: e.body.params.name, arguments: e.body.params.arguments }) : RPC[e.method][0], e.body, { open: e.method !== 'notifications/initialized' && !o.compact });
      if (e.kind === 'rpc_res') return hop('sheet', 'server', RPC[e.method][1](e.body, e.status), e.body, { open: e.method === 'tools/list' || e.method === 'tools/call' });
      return Promise.resolve();
    });
  }, Promise.resolve());
}

function waitOn(n) { $$('.node').forEach(function (el) { el.classList.toggle('wait', el.getAttribute('data-n') === n); }); }
function cardAt(where, name) {
  $$('.slot').forEach(function (s) { s.innerHTML = s.getAttribute('data-slot') === where ? '<span class="cardchip" title="The tool card">card: ' + esc(name) + '</span>' : ''; });
}
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
function finish(n) { S.done[n] = true; S.max = Math.max(S.max, Math.min(5, n + 1)); save(); paintBar(); }

/* Runs fn while the button shows it is working. A rejected key opens the key screen; anything else is said in one line. */
function act(btn, fn) {
  if (btn.disabled) return;
  say(''); btn.disabled = true; btn.classList.add('busy');
  var v = VISIT, n0 = $('#wire').children.length, l0 = LOG.length;
  Promise.resolve().then(fn).catch(function (e) {
    if (e === STALE || v !== VISIT) return;
    if (e.code === 'need_key') {          /* the press never happened: take its messages off the wire */
      while ($('#wire').children.length > n0) $('#wire').lastChild.remove();
      LOG.length = l0; $('#empty').hidden = n0 > 0;
      keyBox(e.message);
    } else say(e.message || 'Something went wrong. Try again.');
  }).then(function () { btn.disabled = false; btn.classList.remove('busy'); });
}
/* errors that come back with the hops made before them (a rate limit mid-loop): show those hops, then the error */
function withEvents(e) { return e && e.data && e.data.events && e.data.events.length ? play(e.data.events).then(function () { throw e; }) : Promise.reject(e); }

/* The key screen: before any step until a key works, and again if Groq rejects it mid-step (the step's progress is kept). */
function keyGate(n, message) {
  cardAt('', ''); waitOn(''); forward(''); after(''); wnote('');
  ins('Paste your Groq key.', true);
  ctx(message ? esc(message) : 'The free key you made in <a href="/c8/module-2/lecture-04-the-second-interface/playgrounds/request-builder" target="_blank" rel="noopener">Lecture 4</a>. Deleted it since? Make a new one in a minute: <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>, then Create API Key.');
  panel('<label class="lab" for="gk">Your Groq key</label>' +
    '<div class="ask"><input id="gk" type="password" placeholder="gsk_..." autocomplete="off" spellcheck="false"><button class="btn act" id="gkok">Use my key</button></div>' +
    '<p class="url">Every message to the model on this bench runs on your key. It stays in this tab until you close it, and rides to Groq through our server in a header. The server does not store or log it.</p>');
  var use = function () {
    var v = $('#gk').value.trim();
    if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) return say('A Groq key starts with gsk_. Copy the whole key.');
    act($('#gkok'), function () {
      groqKey = v;
      return post(API, { op: 'key' }).then(function () {
        try { sessionStorage.setItem(KEYS, v); } catch (e) { /* kept in memory only */ }
        ctx(''); VIEW[n]();
      }, function (e) { groqKey = ''; throw new Error(e.message); });
    });
  };
  $('#gkok').onclick = use; $('#gk').onkeydown = function (e) { if (e.key === 'Enter') use(); };
  setTimeout(function () { $('#gk').focus(); }, 50);
}
function keyBox(message) {
  groqKey = ''; try { sessionStorage.removeItem(KEYS); } catch (e) { /* ignore */ }
  keyGate(S.step, message);
}
function cardView(c) {
  return '<div class="cardview"><span class="lab">The tool card</span><dl><dt>Name</dt><dd><code>' + esc(c.name) + '</code></dd><dt>Use it when</dt><dd>' + esc(c.when) + '</dd><dt>It needs</dt><dd>' + esc(c.needs) + '</dd></dl></div>';
}

/* one round, by hand: you -> server -> model -> server, and the answer back to you unless the model asked for a tool */
function ask(messages, tools, youTitle) {
  var body = chatBody(messages, tools);
  return (youTitle ? hop('you', 'server', youTitle, asSent(body)) : Promise.resolve())
    .then(function () { return post(API, body); })
    .then(function (d) {
      return hop('server', 'model', reqTitle(d.sent), d.sent)
        .then(function () { return hop('model', 'server', resTitle(d), d.raw, { open: !!d.call || !!d.failed, stop: !!d.call }); })
        .then(function () { return d; });
    });
}

/* ---------- step 1: ask ---------- */
function step1() {
  cardAt('', ''); wnote('');
  var t = T[1] || (T[1] = {});
  if (!t.answer) {
    ins('Ask the model about Lecture 12.', true);
    ctx('The model was trained before this course existed. Watch the wire.');
    panel('<p class="q">“' + esc(Q1) + '”</p><div class="row"><button class="btn act" id="a">Ask the model</button></div>');
    $('#a').onclick = function () { act(this, function () {
      return ask([{ role: 'user', content: Q1 }], null, Q1).then(function (d) {
        t.answer = d.failed ? '(the model wrote something Groq could not read)' : plain(d.raw.content) || '(no answer)';
        return hop('server', 'you', clip(t.answer, 160));
      }).then(step1);
    }); };
    return;
  }
  var head = '<p class="q">“' + esc(Q1) + '”</p><p class="ans">' + esc(t.answer) + '</p>';
  if (!t.judged) {
    ins('Check it against the sheet yourself.', true);
    ctx('Same model and settings as the GroqCloud playground, with nothing added. Ask it there and you get the same kind of answer.');
    panel(head + '<div class="check"><ol><li><a href="' + CUR_LINK + '" target="_blank" rel="noopener">Open the curriculum sheet</a> in a new tab.</li><li>Find the row that starts <b>12.</b> Its date is in the first column.</li></ol>' +
      '<div class="row"><button class="btn" data-j="right">It got it right</button><button class="btn" data-j="wrong">Wrong, or it didn’t know</button></div></div>');
    $$('[data-j]').forEach(function (b) { b.onclick = function () { t.judged = b.getAttribute('data-j'); finish(1); step1(); }; });
    return;
  }
  ins('Nothing reached the sheet.', false);
  ctx('');
  panel(head);
  after('<p>' + (t.judged === 'right' ? 'If it matched, it guessed: ' : '') + 'count the messages on the wire. Four crossed: you to the server, the server to the model, and back. <b>None went to the sheet.</b> Ask again and you may get the other kind of answer: it says it does not know, or it makes something up.</p>');
  forward('Continue');
}

/* ---------- step 2: carry it by hand ---------- */
function step2() {
  cardAt('server', GOOD.name); wnote('');
  var t = T[2] || (T[2] = { p: 0 });
  var tool = { name: GOOD.name, description: GOOD.when, parameters: { type: 'object', properties: { number: { type: 'integer', description: GOOD.needs } }, required: ['number'] } };
  waitOn(t.p === 1 ? 'server' : '');
  if (t.p === 0) {
    ins('Ask again, this time with a tool card.', true);
    ctx('The card tells the model one thing: there is a tool, and what it is for. The server sends it to the model along with your question.');
    panel('<p class="q">“' + esc(Q1) + '”</p>' + cardView(GOOD) + '<div class="row"><button class="btn act" id="a">Ask again, with the card</button></div>');
    $('#a').onclick = function () { act(this, function () {
      t.base = [{ role: 'user', content: Q1 }];
      return ask(t.base, [tool], Q1 + ' (the server adds the card)').then(function (d) {
        if (d.failed) { say('The model tried to ask for the tool but wrote it in a way Groq could not read. It predicts, so that can happen. Ask again.'); return; }
        if (!d.call) return hop('server', 'you', clip(d.raw.content, 160)).then(function () { say('This time it answered without asking for the tool. It predicts, so that can happen. Ask again.'); });
        t.call = d.call; t.raw = d.raw; t.p = 1; step2();
      });
    }); };
    return;
  }
  var n = t.call.arguments && t.call.arguments.number;
  if (t.p === 1) {
    ins('The request is waiting at the server. Run it.', true);
    ctx('The model did not answer. It wrote a request and stopped. Nothing happens until someone runs it, and today that someone is you.');
    panel('<p class="lab">The model asked for</p><p class="q"><code>' + esc(callText(t.call)) + '</code></p><div class="row"><button class="btn act" id="f">Fetch lecture ' + esc(n) + ' from the sheet</button></div>');
    $('#f').onclick = function () { act(this, function () {
      return post(API, { op: 'run', args: t.call.arguments }).then(function (d) {
        t.result = d.result;
        return play(d.events);
      }).then(function () { t.p = 2; step2(); });
    }); };
    return;
  }
  if (t.p === 2) {
    waitOn('');
    ins('Hand the row back to the model.', true);
    ctx('The server has the row. The model still has nothing.');
    panel('<p class="truth">' + esc(t.result.Date || '') + ' · ' + esc(t.result['Lecture title'] || t.result.error || '') + '</p><div class="row"><button class="btn act" id="h">Hand it back</button></div>');
    $('#h').onclick = function () { act(this, function () {
      var msgs = t.base.concat([assistantMsg(t.raw), { role: 'tool', tool_call_id: t.call.id, content: JSON.stringify(t.result) }]);   /* built fresh each press */
      return ask(msgs, [tool]).then(function (d) {
        if (d.failed || d.call) { say('The model asked for the tool again instead of answering. In step 4 the server handles that on its own. Press again.'); return; }
        t.answer = plain(d.raw.content) || '(no answer)';
        return hop('server', 'you', clip(t.answer, 160)).then(function () { t.p = 3; finish(2); step2(); });
      });
    }); };
    return;
  }
  ins('You just completed a tool call.', false);
  ctx('');
  panel('<p class="q">“' + esc(Q1) + '”</p><p class="ans">' + esc(t.answer) + '</p>');
  after('<p class="big">The model touched the sheet zero times.</p><p>Read the wire top to bottom. The model wrote a request. <b>You</b> had the server fetch the sheet and hand the row back. The model turned the row into a sentence. This is the reverse call from Lecture 10: the model asks, the server acts.</p>');
  forward('Continue');
}

/* ---------- step 3: write the card against tests ---------- */
function expected(x) { return x.exp === 'none' ? 'answer itself' : x.exp === 'call' ? 'call the tool' + (S.src ? '' : ' with ' + (x.num || '?')) : ''; }
function sig() { return JSON.stringify([S.card, S.tests]); }
function step3() {
  cardAt('server', S.card.name);
  wnote('Each test is one question your page sends through the server. To keep this short, the wire shows only what the server sends the model and what comes back.');
  var t = T[3] || (T[3] = { res: [] }), own = !!S.src;
  var allPass = t.total && t.score === t.total && t.sig === sig();
  if (allPass) { ins('All ' + t.total + ' pass. Your words did that.', false); ctx(''); }
  else {
    ins(own ? 'Write five questions, mark what should happen, then write the card.' : 'First mark what should happen. Then write the card until all five pass.', true);
    ctx(own ? 'The tool searches <b>' + esc(S.own.label) + '</b> (' + S.own.rows + ' rows) for the words the model sends. Write three questions it should be used for and two it should not.'
      : S.card.when.trim() ? 'The model reads only the card. Change one thing, then run again.'
      : 'The model reads only the card. This one is empty, so the model has no idea what <code>' + esc(S.card.name) + '</code> does. You decide what a pass is before you run anything.');
  }
  panel('<div class="tests">' + S.tests.map(function (x, i) {
      var r = t.res[i];
      return '<div class="t' + (r ? (r.ok ? ' pass' : ' fail') : '') + (r && t.sig !== sig() ? ' stale' : '') + '" data-i="' + i + '">' +
        '<p class="tq">' + (own ? '<input value="' + esc(x.q) + '" maxlength="200" placeholder="' + (i < 3 ? 'A question your sheet can answer' : 'A question the tool should not be used for') + '" aria-label="Question ' + (i + 1) + '">' : '“' + esc(x.q) + '”') + '</p>' +
        '<div class="texp"><span class="seg"><button data-e="call" aria-pressed="' + (x.exp === 'call') + '">Call the tool</button><button data-e="none" aria-pressed="' + (x.exp === 'none') + '">Answer itself</button></span>' +
        (own ? '' : '<label class="num"' + (x.exp === 'call' ? '' : ' hidden') + '>with lecture <input inputmode="numeric" maxlength="2" value="' + esc(x.num) + '"></label>') + '</div>' +
        '<p class="tres">' + (r ? esc(r.text) : '') + '</p></div>';
    }).join('') + '</div>' +
    '<div class="cardform"><span class="lab">Your tool card</span>' +
    '<label>Name<input class="mono" id="cn" value="' + esc(S.card.name) + '" maxlength="48" spellcheck="false"></label>' +
    '<label>Use it when<textarea id="cw" maxlength="' + CARD_MAX.when + '" placeholder="What it returns. When to use it. When not to.">' + esc(S.card.when) + '</textarea></label>' +
    '<label>It needs<input id="cd" value="' + esc(S.card.needs) + '" maxlength="' + CARD_MAX.needs + '" placeholder="' + (own ? 'What the search words should be.' : 'What the number is.') + '"></label></div>' +
    '<div class="row"><button class="btn act" id="run">Run the tests</button><span class="tscore" id="score">' + (t.total ? t.score + ' of ' + t.total + ' pass' + (t.sig !== sig() ? ' (before your last change)' : '') : '') + '</span></div>');

  var changed = function () { save(); $$('.t').forEach(function (el) { if ($('.tres', el).textContent) el.classList.add('stale'); }); if (t.total) $('#score').textContent = t.score + ' of ' + t.total + ' pass (before your last change)'; };
  $('#cn').oninput = function () { S.card.name = this.value.trim(); changed(); cardAt('server', S.card.name); };
  $('#cw').oninput = function () { S.card.when = this.value; changed(); };
  $('#cd').oninput = function () { S.card.needs = this.value; changed(); };
  $$('.t').forEach(function (el) {
    var x = S.tests[+el.getAttribute('data-i')];
    $$('.seg button', el).forEach(function (b) { b.onclick = function () {
      x.exp = b.getAttribute('data-e'); changed();
      $$('.seg button', el).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      var num = $('.num', el); if (num) { num.hidden = x.exp !== 'call'; if (!num.hidden) $('input', num).focus(); }
    }; });
    var ni = $('.num input', el); if (ni) ni.oninput = function () { x.num = this.value.replace(/\D/g, ''); changed(); };
    var qi = $('.tq input', el); if (qi) qi.oninput = function () { x.q = this.value; changed(); };
  });
  function draw(i) {   /* one test's result, as soon as it lands */
    var el = $('.t[data-i="' + i + '"]'), r = t.res[i]; if (!el || !r) return;
    el.classList.remove('pass', 'fail', 'stale'); el.classList.add(r.ok ? 'pass' : 'fail'); $('.tres', el).textContent = r.text;
  }
  $('#run').onclick = function () {
    var list = S.tests.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.q.trim(); });
    if (own && list.length < 3) return say('Write at least three questions first.');
    if (list.some(function (o) { return !o.x.exp || (!own && o.x.exp === 'call' && !o.x.num); })) return say('Mark what should happen for every question first' + (own ? '.' : ', and the lecture number where it should call.'));
    if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(S.card.name)) return say('The name must be letters, digits and underscores, starting with a letter. No spaces.');
    if (t.sig === sig() && t.done === list.length) return say('Nothing changed since the last run, so it would cost your key for nothing. Change one thing in the card first.');
    var btn = this, s0 = sig(), tool = toolOf(S.card), ran = 0;
    act(btn, function () {
      clearWire(); t.res = []; t.sig = s0; t.done = 0;
      $$('.t').forEach(function (el) { el.classList.remove('pass', 'fail', 'stale'); $('.tres', el).textContent = ''; });
      $('#score').textContent = 'Running 1 of ' + list.length + '…';
      return list.reduce(function (p, o, k) {
        return p.then(function () {
          $('#score').textContent = 'Running ' + (k + 1) + ' of ' + list.length + '…';
          return post(API, chatBody([{ role: 'user', content: o.x.q }], [tool])).then(function (d) {
            var c = d.call, ok;
            if (d.failed) ok = false;
            else if (o.x.exp === 'none') ok = !c;
            else ok = !!c && (own || Number(c.arguments && c.arguments.number) === Number(o.x.num));
            t.res[o.i] = { ok: ok, text: (ok ? '✓ ' : '✗ ') + (d.failed ? 'It tried to call the tool, but wrote the call so badly Groq could not read it' : c ? 'It called ' + callText(c) : 'It answered itself') + (ok ? '' : '. You expected: ' + expected(o.x)) };
            ran++; t.done = ran; draw(o.i);
            return hop('server', 'model', 'Test ' + (k + 1) + ': ' + reqTitle(d.sent), d.sent, { compact: true, fast: true })
              .then(function () { return hop('model', 'server', resTitle(d), d.raw, { compact: true, fast: true }); });
          });
        });
      }, Promise.resolve()).then(function () {
        t.total = list.length; t.score = list.filter(function (o) { return t.res[o.i].ok; }).length; S.runs++;
        if (t.score === t.total) finish(3); else save();
        step3();
      }, function (e) {
        if (e === STALE) throw e;
        if (ran) { t.total = ran; t.score = list.slice(0, ran).filter(function (o) { return t.res[o.i] && t.res[o.i].ok; }).length; t.sig = ''; }
        $('#score').textContent = ran ? ran + ' of ' + list.length + ' ran, ' + t.score + ' passed' : '';
        throw e;
      });
    });
  };
  if (S.done[3]) {
    after(allPass ? '<p>Same model, same questions. The only thing that changed was your card. A tool description is an interface written in English, and the tests are how you know it works.</p>' : '');
    forward('Continue');
  } else if (t.total && S.runs >= 2) {
    after('<p><b>Stuck?</b> Say what the tool returns, when to use it, and when not to (is it for any course, or only ours?). Then say exactly what the input is. Change one thing and run again.</p>' +
      (S.runs >= 4 ? '<div class="row"><button class="btn ghost" id="skip">Carry on with ' + t.score + ' of ' + t.total + '</button></div>' : ''));
    forward('');
    if ($('#skip')) $('#skip').onclick = function () { finish(3); go(4); };
  } else { after(''); forward(''); }
}

/* ---------- the loop, run by the server: steps 4 and 5 ---------- */
function runLoop(question, tool, via) {
  var body = { op: 'loop', via: via, question: question, tool: tool, src: S.src || undefined, mcp: via === 'mcp' ? mcpUrl() : undefined };
  return hop('you', 'server', '“' + clip(question, 90) + '”', asSent(body))
    .then(function () { return post(API, body).catch(withEvents); })
    .then(function (d) {
      return play(d.events).then(function () {
        if (d.failed) return d;
        return hop('server', 'you', d.answer ? clip(d.answer, 160) : '(no answer)').then(function () { return d; });
      });
    });
}
function askBox(chips) {
  return '<div class="ask"><input id="q" maxlength="300" placeholder="Ask a question" aria-label="Your question"><button class="btn act" id="ask">Ask</button></div>' +
    (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<button type="button">' + esc(c) + '</button>'; }).join('') + '</div>' : '');
}
function bindAsk(run) {
  var q = $('#q'), b = $('#ask');
  var fire = function () { var v = q.value.trim(); if (!v) return say('Type a question first.'); act(b, function () { return run(v); }); };
  b.onclick = fire; q.onkeydown = function (e) { if (e.key === 'Enter') fire(); };
  $$('.chips button').forEach(function (c) { c.onclick = function () { q.value = c.textContent; fire(); }; });
}
function outcome(d, t) {
  if (d.failed) return say('The model asked for the tool but wrote the request so badly Groq could not read it. That happens; ask again.');
  if (d.used) return;
  say(t.ran ? 'No tool call this time: the model answered from what it already knows, or from the card itself.' : 'No tool call: the model answered without the sheet. Ask something only the sheet knows.');
}
function download() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['Tool Bench log, ' + new Date().toString() + '\nCard: ' + JSON.stringify(S.card) + '\n\n' + LOG.join('\n\n') + '\n'], { type: 'text/plain' }));
  a.download = 'tool-bench-log.txt'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

/* ---------- step 4: switch the server on ---------- */
function step4() {
  cardAt('server', S.card.name); wnote('');
  var t = T[4] || (T[4] = { on: false }), own = !!S.src;
  var sw = '<div class="row"><span class="lab">Server</span><span class="seg"><button data-on="0" aria-pressed="' + !t.on + '">By hand</button><button data-on="1" aria-pressed="' + t.on + '">On</button></span></div>';
  if (!t.on) {
    ins('Switch the server on.', true);
    ctx('In step 2 you pressed a button for every move. Switched on, the server makes the same moves itself, as many rounds as it takes, up to three.');
    panel(sw);
  } else {
    ins(t.ran ? 'The server carried it. Nobody stood in between.' : 'Ask anything about ' + (own ? 'your sheet.' : 'a lecture.'), !t.ran);
    ctx(t.ran ? (own ? 'Ask again, or carry on.' : 'Ask again. Try a lecture that does not exist.') : 'It uses the card you wrote. You send one message; watch what the server does with it.');
    panel(sw + askBox(own ? [] : ['What do we build in Lecture 8?', 'What is Lecture 40 about?', 'What is an API?']) +
      (t.ran ? '<div class="row"><button class="btn" id="dl">Download the log</button></div>' : ''));
    bindAsk(function (q) {
      clearWire(); say('');
      return runLoop(q, toolOf(S.card), 'code').then(function (d) { if (d.used && !d.failed) { t.ran = true; finish(4); } step4(); outcome(d, t); });
    });
    if ($('#dl')) $('#dl').onclick = download;
  }
  $$('.seg button', $('#panel')).forEach(function (b) { b.onclick = function () { t.on = b.getAttribute('data-on') === '1'; step4(); }; });
  if (t.ran) {
    after('<p>The log is the proof: the call, the arguments, the result and the answer. Purple wrote the request and the sentence. Orange did everything in between, the same way every time.</p>' + (own ? '' : pyLoop()));
    forward('Continue');
  } else { after(''); forward(S.done[4] ? 'Continue' : ''); }
}

/* ---------- step 5: move the card (MCP) ---------- */
function step5() {
  var t = T[5] || (T[5] = { p: 0 }), own = !!S.src;
  cardAt(t.p ? 'sheet' : 'server', S.card.name); wnote('');
  $('#sheetSub').textContent = t.p ? 'and its own server' : 'the data';
  if (t.p === 0) {
    ins('A second app wants your tool. Move the card to the sheet’s side.', true);
    ctx('Today the card and the fetch code live inside your server. A second app would need a copy of both, and so would a third. Put them where the data is, once.');
    panel(cardView(S.card) + '<div class="row"><button class="btn act" id="mv">Move the card</button></div>');
    $('#mv').onclick = function () { t.p = 1; clearWire(); step5(); };
    return;
  }
  var url = '<p class="lab">The sheet’s server now lives at</p><p class="url">' + esc(mcpUrl()) + '</p>';
  if (t.p === 1) {
    ins('Your server no longer knows the tool. Connect to the sheet’s server.', true);
    ctx('Any app can connect the same way: say hello, say it is ready, then ask what the server can do.');
    panel(url + '<div class="row"><button class="btn act" id="ls">Connect</button></div>');
    $('#ls').onclick = function () { act(this, function () {
      return post(API, { op: 'mcplist', mcp: mcpUrl() }).catch(withEvents).then(function (d) {
        t.tool = d.tool;
        return play(d.events);
      }).then(function () { t.p = 2; step5(); });
    }); };
    return;
  }
  ins(t.ran ? 'You built an MCP server.' : 'Your card came back. Now ask a question.', !t.ran);
  ctx(t.ran ? '' : 'Your server got the card from the sheet’s server, not from its own code.');
  panel(url + askBox(own ? [] : [Q1, 'What is Lecture 40 about?']));
  bindAsk(function (q) {
    clearWire(); say('');
    var tool = { name: t.tool.name, description: t.tool.description, parameters: t.tool.inputSchema };
    return runLoop(q, tool, 'mcp').then(function (d) { if (d.used && !d.failed) { t.ran = true; finish(5); } step5(); outcome(d, t); });
  });
  forward('');
  if (!t.ran) return after('');
  after('<div class="named"><span class="lab">What this is called</span><p class="big">MCP, the Model Context Protocol.</p>' +
    '<p>Every MCP app does the same few things, whatever the tool: <b>initialize</b> (hello), <b>initialized</b> (ready), <b>tools/list</b> (what can you do?), then <b>tools/call</b> (run this) whenever the model asks. The tool and its card live with the data. A second app needs only the address.</p>' +
    '<div class="urlrow"><code id="u">' + esc(mcpUrl()) + '</code><button class="btn" id="cp">Copy the address</button></div>' +
    '<div class="links"><p><b>Try it in a second app.</b> Copy the address, then open <a href="/c8/module-2/lecture-11-tool-calling-and-mcp/second-app" target="_blank" rel="noopener">the second app</a>. It has never seen your card or your sheet: paste the address and ask it a question.</p></div>' +
    '<div class="row"><button class="btn" id="dl">Download the log</button></div>' + pyClient() + (own ? '' : pyServer()) + '</div>' +
    '<div class="own"><h2>' + (own ? 'Back to the course sheet' : 'Now do it with your own sheet') + '</h2>' +
    (own ? '<p>You are on your own sheet. The address above is your own MCP server. Anyone with the address can read what the tool returns, the same as anyone with your sheet link.</p><div class="row"><button class="btn" id="back2">Use the course sheet again</button></div>'
      : '<p>Use your Practice set 1 sheet. In the sheet: Share, General access, “Anyone with the link”, Viewer. Then open the tab with <b>your</b> rows (not Aarav’s example) and copy the link from the address bar. You write five questions and a card for it, and get your own address.</p>' +
        '<div class="ask"><input id="link" placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=…" aria-label="Your sheet link"><button class="btn act" id="use">Check my sheet</button></div><div id="pv"></div>') + '</div>');
  $('#cp').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(mcpUrl()) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { var r = document.createRange(); r.selectNodeContents($('#u')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }); };
  $('#dl').onclick = download;
  if ($('#use')) $('#use').onclick = function () { var b = this; act(b, function () {
    return post(API, { op: 'peek', link: $('#link').value }).then(function (d) {
      if (d.curriculum) return say('That is the course sheet. Paste your own.');
      var label = d.title || 'the tab starting “' + clip(d.first, 40) + '”';
      $('#pv').innerHTML = '<dl class="preview' + (d.example ? ' warn' : '') + '"><dt>Tab it read</dt><dd>' + esc(d.title || (d.tab === 'first' ? 'the first tab' : 'the tab in your link')) + (d.tab === 'first' ? ' (your link has no tab number, so this is the sheet’s first tab)' : '') + '</dd>' +
        '<dt>First row</dt><dd>' + esc(d.first || '(empty)') + '</dd><dt>Size</dt><dd>' + d.rows + ' rows · ' + esc(d.columns.slice(0, 4).join(', ')) + '</dd></dl>' +
        (d.example ? '<p class="msg">This is Aarav’s example tab, not yours. Open your own tab in the sheet, copy the link again (it ends in #gid= and a number), and paste it here.</p>'
          : '<div class="row"><button class="btn act" id="ok">These are my rows</button></div>');
      if ($('#ok')) $('#ok').onclick = function () {
        S.src = d.src; S.own = { columns: d.columns, rows: d.rows, label: label }; S.card = { name: 'tool_1', when: '', needs: '' }; S.tests = blankTests(true); S.runs = 0;
        S.done[3] = S.done[4] = S.done[5] = false; S.max = 3; T = {}; save(); go(3);
      };
    });
  }); };
  if ($('#back2')) $('#back2').onclick = function () { var keep = S.done; S = fresh(); S.done = { 1: keep[1], 2: keep[2] }; S.max = 3; S.step = 3; T = {}; save(); go(3); };
}

/* ---------- the same thing in Python, built from the learner's own card ---------- */
var csvUrl = 'https://docs.google.com/spreadsheets/d/' + CUR + '/gviz/tq?tqx=out:csv&headers=0';
function pyTool(withNeeds) {
  return 'def get_lecture(number' + (withNeeds ? ': Annotated[int, Field(description=' + JSON.stringify(S.card.needs) + ')]' : ': int') + ') -> dict:\n' +
  '    """The tool: plain code, no model."""\n' +
  '    for row in csv.reader(io.StringIO(requests.get(SHEET).text)):\n' +
  '        if row[1].startswith(f"{number}. "):\n' +
  '            return {"lecture": number, "Date": row[0], "Lecture title": row[1], "Type": row[2], "Tools": row[3]}\n' +
  '    return {"error": f"There is no lecture {number}. Lectures run from 1 to 19."}\n';
}
function pyLoop() {
  var card = { type: 'function', function: toolOf(S.card) };
  return '<details class="py"><summary>The same thing in Python</summary><pre>' + esc(
    '# pip install requests   ·   export GROQ_API_KEY=gsk_...\n' +
    'import csv, io, json, os, requests\n\n' +
    'SHEET = "' + csvUrl + '"\n' +
    'CARD = ' + JSON.stringify(card, null, 2) + '\n\n' + pyTool(false) + '\n' +
    'messages = [{"role": "user", "content": "' + Q1 + '"}]\n' +
    'for _ in range(3):                              # the server decides when the loop stops\n' +
    '    r = requests.post("https://api.groq.com/openai/v1/chat/completions",\n' +
    '        headers={"Authorization": "Bearer " + os.environ["GROQ_API_KEY"]},\n' +
    '        json={"model": "' + MODEL + '", "messages": messages, "tools": [CARD]}).json()\n' +
    '    msg = r["choices"][0]["message"]\n' +
    '    if not msg.get("tool_calls"):               # no request: this is the answer\n' +
    '        print("answer", msg["content"])\n' +
    '        break\n' +
    '    call = msg["tool_calls"][0]                 # the model asked; the server acts\n' +
    '    messages.append({"role": "assistant", "content": msg.get("content"), "tool_calls": [call]})\n' +
    '    args = json.loads(call["function"]["arguments"])\n' +
    '    result = get_lecture(**args)\n' +
    '    print("call  ", call["function"]["name"], args)\n' +
    '    print("result", result)\n' +
    '    messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result)})\n') + '</pre></details>';
}
function pyServer() {
  return '<details class="py"><summary>The same server in Python (FastMCP)</summary><pre>' + esc(
    '# pip install fastmcp requests   ·   python server.py\n' +
    'import csv, io, requests\n' +
    'from typing import Annotated\n' +
    'from pydantic import Field\n' +
    'from fastmcp import FastMCP\n\n' +
    'SHEET = "' + csvUrl + '"\n' +
    'mcp = FastMCP("curriculum")\n\n' +
    '@mcp.tool(name=' + JSON.stringify(S.card.name) + ', description=' + JSON.stringify(S.card.when) + ')\n' +
    pyTool(true) + '\n' +
    'if __name__ == "__main__":\n' +
    '    mcp.run()                                   # answers initialize, tools/list and tools/call\n') + '</pre></details>';
}
function pyClient() {
  var arg = S.src ? '{"search": "invoice"}' : '{"number": 12}';
  return '<details class="py"><summary>A second app in Python (FastMCP client)</summary><pre>' + esc(
    '# pip install fastmcp\n' +
    'import asyncio\n' +
    'from fastmcp import Client\n\n' +
    'ADDRESS = "' + mcpUrl() + '"\n\n' +
    'async def main():\n' +
    '    async with Client(ADDRESS) as server:        # initialize + initialized\n' +
    '        tools = await server.list_tools()        # tools/list\n' +
    '        print(tools[0].name, "-", tools[0].description)\n' +
    '        result = await server.call_tool(tools[0].name, ' + arg + ')   # tools/call\n' +
    '        print(result.content[0].text)\n\n' +
    'asyncio.run(main())\n') + '</pre></details>';
}

/* ---------- moving between steps ---------- */
var VIEW = [null, step1, step2, step3, step4, step5];
function paintBar() {
  $('#where').textContent = 'Step ' + S.step + ' of 5 · ' + NAMES[S.step];
  $$('#segs a').forEach(function (a) {
    var n = +a.getAttribute('data-s');
    a.classList.toggle('on', n === S.step); a.classList.toggle('done', !!S.done[n] && n !== S.step); a.classList.toggle('reach', n <= S.max);
  });
  $('#back').hidden = S.step === 1;
}
function go(n) {
  n = Math.max(1, Math.min(5, n));
  if (n > S.max) n = S.max;
  VISIT++;
  S.step = n; save();
  T[n] = undefined; clearWire(); waitOn(''); say(''); after(''); forward(''); wnote('');
  $$('.btn.busy').forEach(function (b) { b.classList.remove('busy'); b.disabled = false; });
  $('#sheetName').textContent = S.src && n >= 3 ? 'Your sheet' : 'Sheet';
  $('#sheetSub').textContent = 'the data';
  paintBar(); if (groqKey) VIEW[n](); else keyGate(n);
  if (location.hash !== '#' + n) history.replaceState(null, '', '#' + n);
  window.scrollTo(0, 0); $('#ins').focus({ preventScroll: true });
}
$$('#segs a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(+a.getAttribute('data-s')); }; });
$('#back').onclick = function (e) { e.preventDefault(); go(S.step - 1); };
go(+location.hash.slice(1) || S.step);
})();
