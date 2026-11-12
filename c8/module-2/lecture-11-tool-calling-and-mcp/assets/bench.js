/* Tool Bench: Lecture 11. One bench (You, Model, Server, Sheet), one wire, five steps.
   Everything on the wire is real: the model is GPT-OSS on Groq through /api/toolcall, the sheet is the public
   curriculum sheet (or the learner's own), and step 5 talks JSON-RPC to the real MCP server at /api/mcp.
   The loop lives here, in the page, so every hop can be shown and, in step 2, carried by hand.
   State: localStorage c8.l11.bench (step, card, tests, own sheet). Every learner brings their own Groq key: it lives in
   sessionStorage c8.l11.key (gone when the tab closes) and goes only to /api/toolcall, which passes it to Groq and never stores it. */
(function () {
'use strict';

var API = '/api/toolcall', MCP = location.origin + '/api/mcp', KEY = 'c8.l11.bench';
var CUR = '1Kg6T-dJWaYx_JCPiRk3u0nBuAQcsCVRDPj1NFKP4WzM';
var NAMES = ['', 'Ask', 'Carry it by hand', 'Write the card', 'Switch the server on', 'Move the card'];
var NODE = { you: 'You', model: 'Model', server: 'Server', sheet: 'Sheet' };
var ORDER = ['you', 'model', 'server', 'sheet'];
var Q1 = 'When is Lecture 12, and what is it about?';
var GOOD = { name: 'get_lecture', when: 'Returns one lecture of the 100xEngineers Cohort 8 curriculum: its date, title, type and tools. Use it when someone asks about a specific lecture by number. Not for general questions.', needs: 'The lecture number, 1 to 18.' };
var TESTS = [Q1, 'Which tools do we use in the seventh class?', 'What is an API?', 'Is session fourteen a combined one or separate?', 'In lecture 3 of Harvard CS50, which language is taught?'];

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var plain = function (s) { return String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, '$1$2').replace(/^#+\s*/gm, ''); };
var pretty = function (v) { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); };

/* ---------- state ---------- */
function blankTests(own) { return own ? [0, 1, 2, 3, 4].map(function () { return { q: '', exp: '', num: '' }; }) : TESTS.map(function (q) { return { q: q, exp: '', num: '' }; }); }
function fresh() { return { v: 1, step: 1, max: 1, done: {}, card: { name: 'tool_1', when: '', needs: '' }, tests: blankTests(false), runs: 0, src: null, own: null }; }
var S = fresh();
try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw && raw.v === 1) S = Object.assign(fresh(), raw); } catch (e) { /* storage blocked: the bench still works */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
var T = {};            /* what happened in the current visit to a step; not saved */
var LOG = [];          /* the wire as text, for the download */
var KEYS = 'c8.l11.key', groqKey = '';
try { groqKey = sessionStorage.getItem(KEYS) || ''; } catch (e) { /* blocked: asked again */ }

/* ---------- talking to the servers ---------- */
function post(url, body) {
  var h = { 'content-type': 'application/json' };
  if (groqKey && url === API) h['x-groq-key'] = groqKey;
  return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) {
    return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* not JSON */ }
      if (!r.ok) { var er = new Error((d && d.message) || (d && d.error && d.error.message) || 'The server did not answer. Try again.'); er.code = d && typeof d.error === 'string' ? d.error : ''; throw er; }
      return d;
    });
  }, function () { throw new Error('No connection. Check your internet and try again.'); });
}
function chat(messages, tools) { return post(API, { op: 'chat', messages: messages, tools: tools || [] }); }
function runTool(args, src) { return post(API, { op: 'run', src: src || undefined, args: args }); }
function mcpUrl() {
  var p = new URLSearchParams();
  if (S.src) { p.set('sheet', S.src.sheet); if (S.src.gid) p.set('gid', S.src.gid); }
  p.set('name', S.card.name); p.set('when', S.card.when); p.set('needs', S.card.needs);
  return MCP + '?' + p.toString();
}
var rpcId = 0;
function rpc(method, params) {
  var m = { jsonrpc: '2.0', id: ++rpcId, method: method }; if (params) m.params = params;
  return post(mcpUrl(), m).then(function (d) { if (d && d.error) throw new Error(d.error.message); return { sent: m, got: d }; });
}
var argName = function () { return S.src ? 'search' : 'number'; };
function toolOf(card) {
  var p = {}; p[argName()] = { type: S.src ? 'string' : 'integer', description: card.needs || '' };
  return { name: card.name, description: card.when || '', parameters: { type: 'object', properties: p, required: [argName()] } };
}
var sheetLink = function () { return 'https://docs.google.com/spreadsheets/d/' + (S.src ? S.src.sheet : CUR); };

/* ---------- the bench ---------- */
function flash(from, to) {
  var a = ORDER.indexOf(from), b = ORDER.indexOf(to), lo = Math.min(a, b);
  var lane = $('.lane[data-l="' + ORDER[lo] + '-' + ORDER[lo + 1] + '"]');
  if (lane) { lane.classList.remove('ltr', 'rtl'); void lane.offsetWidth; lane.classList.add(a < b ? 'ltr' : 'rtl'); }
  [from, to].forEach(function (n) { var el = $('.node[data-n=' + n + ']'); el.classList.add('lit'); setTimeout(function () { el.classList.remove('lit'); }, 800); });
}
function wire(from, to, title, body, o) {
  o = o || {};
  var li = document.createElement('li'); li.className = 'w' + (o.stop ? ' stop' : '');
  li.innerHTML = '<span class="rt"><b class="n-' + from + '">' + NODE[from] + '</b><i>→</i><b class="n-' + to + '">' + NODE[to] + '</b></span>' +
    '<span class="tt">' + esc(title) + '</span>' +
    (body != null ? '<details' + (o.open ? ' open' : '') + '><summary>The message</summary><pre>' + esc(pretty(body)) + '</pre></details>' : '');
  $('#wire').appendChild(li); $('#empty').hidden = true;
  var box = li.closest('.wirebox'); if (box.scrollHeight > box.clientHeight) box.scrollTop = box.scrollHeight;
  flash(from, to);
  LOG.push(NODE[from] + ' -> ' + NODE[to] + ' | ' + title + (body != null ? '\n' + pretty(body).replace(/^/gm, '    ') : ''));
  return sleep(o.fast ? 150 : 650);
}
function clearWire() { $('#wire').innerHTML = ''; $('#empty').hidden = false; LOG = []; }
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

/* Runs fn while the button shows it is working. A missing key opens the key box; anything else is said in one line. */
function act(btn, fn) {
  if (btn.disabled) return;
  say(''); btn.disabled = true; btn.classList.add('busy');
  var n0 = $('#wire').children.length, l0 = LOG.length;
  Promise.resolve().then(fn).catch(function (e) {
    if (e.code === 'need_key') {          /* the press never happened: take its messages off the wire */
      while ($('#wire').children.length > n0) $('#wire').lastChild.remove();
      LOG.length = l0; $('#empty').hidden = n0 > 0;
      keyBox(e.message);
    } else say(e.message || 'Something went wrong. Try again.');
  }).then(function () { btn.disabled = false; btn.classList.remove('busy'); });
}
/* The key screen: shown before any step until a key works, and again if Groq rejects it mid-step (the step's progress is kept). */
function keyGate(n, message) {
  cardAt('', ''); waitOn(''); forward(''); after('');
  ins('Paste your Groq key.', true);
  ctx(message ? esc(message) : 'The one you made in Lecture 5. Every message to the model on this bench runs on your key.');
  panel('<label class="lab" for="gk">Your Groq key</label>' +
    '<div class="ask"><input id="gk" type="password" placeholder="gsk_..." autocomplete="off" spellcheck="false"><button class="btn act" id="gkok">Use my key</button></div>' +
    '<p class="url">No key? <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>, then Create API Key. The key stays in this tab until you close it. It goes to Groq through our server, which does not store it.</p>');
  var use = function () {
    var v = $('#gk').value.trim();
    if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) return say('A Groq key starts with gsk_. Copy the whole key.');
    act($('#gkok'), function () {
      groqKey = v;
      return post(API, { op: 'key' }).then(function () {
        try { sessionStorage.setItem(KEYS, v); } catch (e) { /* kept in memory only */ }
        VIEW[n]();
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
function callText(c) { return c.name + '(' + (c.arguments && typeof c.arguments === 'object' ? Object.keys(c.arguments).map(function (k) { return k + ': ' + JSON.stringify(c.arguments[k]); }).join(', ') : String(c.arguments)) + ')'; }
function asMsg(m) { return { role: 'assistant', content: m.content, tool_calls: m.tool_calls }; }

/* ---------- step 1: ask ---------- */
function step1() {
  cardAt('', '');
  var t = T[1] || (T[1] = {});
  if (!t.answer) {
    ins('Ask the model about Lecture 12.', true);
    ctx('The model was trained before this course existed. Watch the wire.');
    panel('<p class="q">“' + esc(Q1) + '”</p><div class="row"><button class="btn act" id="a">Ask the model</button></div>');
    $('#a').onclick = function () { act(this, function () {
      return wire('you', 'model', Q1).then(function () { return chat([{ role: 'user', content: Q1 }]); }).then(function (d) {
        t.answer = plain(d.message.content) || '(no answer)';
        return wire('model', 'you', t.answer);
      }).then(step1);
    }); };
    return;
  }
  var head = '<p class="q">“' + esc(Q1) + '”</p><p class="ans">' + esc(t.answer) + '</p>';
  if (!t.truth) {
    ins('Now check the sheet yourself.', true);
    ctx('The real answer is one row in the curriculum sheet.');
    panel(head + '<div class="row"><button class="btn act" id="c">Check the sheet</button></div>');
    $('#c').onclick = function () { act(this, function () { return runTool({ number: 12 }).then(function (d) { t.truth = d.result; finish(1); step1(); }); }); };
    return;
  }
  ins('Nothing reached the sheet.', false);
  ctx('');
  panel(head + '<p class="truth">' + esc(t.truth.Date) + ' · ' + esc(t.truth['Lecture title']) + '<br><a href="' + sheetLink() + '" target="_blank" rel="noopener">Open the sheet</a></p>');
  after('<p>Count the messages on the wire: two, both between you and the model. Whatever it said, it said from memory. The line to the sheet never lit up.</p>');
  forward('Continue');
}

/* ---------- step 2: carry it by hand ---------- */
function step2() {
  cardAt('server', GOOD.name);
  var t = T[2] || (T[2] = { p: 0 });
  var tool = { name: GOOD.name, description: GOOD.when, parameters: { type: 'object', properties: { number: { type: 'integer', description: GOOD.needs } }, required: ['number'] } };
  waitOn(t.p === 1 ? 'server' : '');
  if (t.p === 0) {
    ins('Ask again, this time with a tool card.', true);
    ctx('The card tells the model one thing: there is a tool, and what it is for. The server sends it along with your question.');
    panel('<p class="q">“' + esc(Q1) + '”</p>' + cardView(GOOD) + '<div class="row"><button class="btn act" id="a">Ask again, with the card</button></div>');
    $('#a').onclick = function () { act(this, function () {
      t.msgs = [{ role: 'user', content: Q1 }];
      return wire('you', 'model', Q1 + '  + the card', tool).then(function () { return chat(t.msgs, [tool]); }).then(function (d) {
        var c = d.message.tool_calls[0];
        if (!c) return wire('model', 'you', plain(d.message.content) || '(no answer)').then(function () { say('This time it answered without asking for the tool. It predicts, so that can happen. Ask again.'); });
        t.call = c; t.msgs.push(asMsg({ content: d.message.content, tool_calls: [c] })); t.p = 1;
        return wire('model', 'server', 'Please run ' + callText(c), { name: c.name, arguments: c.arguments }, { open: true, stop: true }).then(step2);
      });
    }); };
    return;
  }
  var n = t.call.arguments && t.call.arguments.number;
  if (t.p === 1) {
    ins('The request is waiting. You are the server: fetch it.', true);
    ctx('The model did not answer. It wrote a request and stopped. Nothing happens until someone runs it.');
    panel('<p class="lab">The model asked for</p><p class="q"><code>' + esc(callText(t.call)) + '</code></p><div class="row"><button class="btn act" id="f">Fetch lecture ' + esc(n) + ' from the sheet</button></div>');
    $('#f').onclick = function () { act(this, function () {
      return runTool(t.call.arguments).then(function (d) {
        t.result = d.result; t.url = d.url;
        return wire('server', 'sheet', 'GET the sheet, find lecture ' + n, d.url).then(function () { return wire('sheet', 'server', d.ok ? 'One row' : 'No such row', d.result, { open: true }); });
      }).then(function () { t.p = 2; step2(); });
    }); };
    return;
  }
  if (t.p === 2) {
    ins('Hand the row back to the model.', true);
    ctx('You have the row. The model still has nothing.');
    panel('<p class="truth">' + esc(t.result.Date || '') + ' · ' + esc(t.result['Lecture title'] || t.result.error || '') + '</p><div class="row"><button class="btn act" id="h">Hand it back</button></div>');
    $('#h').onclick = function () { act(this, function () {
      t.msgs.push({ role: 'tool', tool_call_id: t.call.id, content: JSON.stringify(t.result) });
      return wire('server', 'model', 'Here is the result', t.result).then(function () { return chat(t.msgs, [tool]); }).then(function (d) {
        t.answer = plain(d.message.content) || '(no answer)';
        return wire('model', 'you', t.answer);
      }).then(function () { t.p = 3; finish(2); step2(); });
    }); };
    return;
  }
  ins('You just completed a tool call.', false);
  ctx('');
  panel('<p class="q">“' + esc(Q1) + '”</p><p class="ans">' + esc(t.answer) + '</p>');
  after('<p class="big">The model touched the sheet zero times.</p><p>Read the wire top to bottom. The model wrote a request. <b>You</b> fetched the row. The model turned the row into a sentence. This is the reverse call from Lecture 10: the model asks, the server acts.</p>');
  forward('Continue');
}

/* ---------- step 3: write the card against tests ---------- */
function expected(t) { return t.exp === 'none' ? 'answer itself' : t.exp === 'call' ? 'call the tool' + (S.src ? '' : ' with ' + (t.num || '?')) : ''; }
function step3() {
  cardAt('server', S.card.name);
  var t = T[3] || (T[3] = { res: [] }), own = !!S.src;
  var live = S.tests.filter(function (x) { return x.q.trim(); });
  if (S.done[3] && t.score === t.total && t.total) {
    ins('All ' + t.total + ' pass. Your words did that.', false);
    ctx('');
  } else {
    ins(own ? 'Write five questions, mark what should happen, then write the card.' : 'First mark what should happen. Then write the card until all five pass.', true);
    ctx(own ? 'Your sheet has ' + S.own.rows + ' rows: ' + esc(S.own.columns.slice(0, 5).join(', ')) + '. The tool searches it for the words the model sends. Write three questions it should be used for and two it should not.'
      : S.card.when.trim() ? 'The model reads only the card. Change one thing, then run again.'
      : 'The model reads only the card. This one is empty, so the model has no idea what <code>' + esc(S.card.name) + '</code> does. You decide what a pass is before you run anything.');
  }
  panel('<div class="cardform"><span class="lab">Your tool card</span>' +
    '<label>Name<input class="mono" id="cn" value="' + esc(S.card.name) + '" maxlength="48" spellcheck="false"></label>' +
    '<label>Use it when<textarea id="cw" maxlength="600" placeholder="What it returns. When to use it. When not to.">' + esc(S.card.when) + '</textarea></label>' +
    '<label>It needs<input id="cd" value="' + esc(S.card.needs) + '" maxlength="300" placeholder="' + (own ? 'What the search words should be.' : 'What the number is.') + '"></label></div>' +
    '<div class="row"><button class="btn act" id="run">Run the tests</button><span class="score" id="score">' + (t.total ? t.score + ' of ' + t.total + ' pass' : '') + '</span></div>' +
    '<div class="tests">' + S.tests.map(function (x, i) {
      var r = t.res[i];
      return '<div class="t' + (r ? (r.ok ? ' pass' : ' fail') : '') + '" data-i="' + i + '">' +
        '<p class="tq">' + (own ? '<input value="' + esc(x.q) + '" maxlength="200" placeholder="' + (i < 3 ? 'A question your sheet can answer' : 'A question the tool should not be used for') + '" aria-label="Question ' + (i + 1) + '">' : '“' + esc(x.q) + '”') + '</p>' +
        '<div class="texp"><span class="seg"><button data-e="call" aria-pressed="' + (x.exp === 'call') + '">Call the tool</button><button data-e="none" aria-pressed="' + (x.exp === 'none') + '">Answer itself</button></span>' +
        (own ? '' : '<label class="num"' + (x.exp === 'call' ? '' : ' hidden') + '>with lecture <input inputmode="numeric" maxlength="2" value="' + esc(x.num) + '"></label>') + '</div>' +
        '<p class="tres">' + (r ? esc(r.text) : '') + '</p></div>';
    }).join('') + '</div>');

  var stale = function () { $$('.t').forEach(function (el) { el.classList.add('stale'); }); };
  $('#cn').oninput = function () { S.card.name = this.value.trim(); save(); stale(); cardAt('server', S.card.name); };
  $('#cw').oninput = function () { S.card.when = this.value; save(); stale(); };
  $('#cd').oninput = function () { S.card.needs = this.value; save(); stale(); };
  $$('.t').forEach(function (el) {
    var x = S.tests[+el.getAttribute('data-i')];
    $$('.seg button', el).forEach(function (b) { b.onclick = function () {
      x.exp = b.getAttribute('data-e'); save();
      $$('.seg button', el).forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      var num = $('.num', el); if (num) { num.hidden = x.exp !== 'call'; if (!num.hidden) $('input', num).focus(); }
    }; });
    var ni = $('.num input', el); if (ni) ni.oninput = function () { x.num = this.value.replace(/\D/g, ''); save(); };
    var qi = $('.tq input', el); if (qi) qi.oninput = function () { x.q = this.value; save(); };
  });
  $('#run').onclick = function () {
    var list = S.tests.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.q.trim(); });
    if (own && list.length < 3) return say('Write at least three questions first.');
    if (list.some(function (o) { return !o.x.exp || (!own && o.x.exp === 'call' && !o.x.num); })) return say('Mark what should happen for every question first' + (own ? '.' : ', and the lecture number where it should call.'));
    if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(S.card.name)) return say('The name must be letters, digits and underscores, starting with a letter. No spaces.');
    act(this, function () {
      var tool = toolOf(S.card);
      return Promise.all(list.map(function (o) {
        return chat([{ role: 'user', content: o.x.q }], [tool]).then(function (d) {
          var c = d.message.tool_calls[0], ok, text;
          if (o.x.exp === 'none') ok = !c; else ok = !!c && (own || Number(c.arguments && c.arguments.number) === Number(o.x.num));
          text = (ok ? '✓ ' : '✗ ') + (c ? 'It called ' + callText(c) : d.failed ? 'It tried to call the tool and wrote something the server could not read' : 'It answered itself') + (ok ? '' : '. You expected: ' + expected(o.x));
          t.res[o.i] = { ok: ok, text: text };
        });
      })).then(function () {
        t.total = list.length; t.score = list.filter(function (o) { return t.res[o.i].ok; }).length; S.runs++;
        if (t.score === t.total) finish(3); else save();
        return wire('you', 'model', 'Tests: ' + t.score + ' of ' + t.total + ' pass', { card: S.card, results: list.map(function (o) { return o.x.q + '  ' + t.res[o.i].text; }) }, { fast: true });
      }).then(step3);
    });
  };
  if (S.done[3] && t.score === t.total && t.total) {
    after('<p>Same model, same questions. The only thing that changed was your card. A tool description is an interface written in English, and the tests are how you know it works.</p>');
    forward('Continue');
  } else if (t.total && S.runs >= 2) {
    after('<p><b>Stuck?</b> Say what the tool returns, when to use it, and when not to (is it for any course, or only ours?). Then say exactly what the input is. Change one thing and run again.</p>' +
      (S.runs >= 4 ? '<div class="row"><button class="btn ghost" id="skip">Carry on with ' + t.score + ' of ' + t.total + '</button></div>' : ''));
    forward('');
    if ($('#skip')) $('#skip').onclick = function () { finish(3); go(4); };
  } else { after(''); forward(S.done[3] && !t.total ? 'Continue' : ''); }
}

/* ---------- the loop, with the server on. via: 'code' (the server holds the tool) or 'mcp' (the sheet's server does) ---------- */
function loop(question, tool, via) {
  var msgs = [{ role: 'user', content: question }], used = false, round = 0;
  function next() {
    if (round++ >= 3) return wire('server', 'you', 'Stopped after three rounds. The server decides when the loop ends.').then(function () { return { used: used, answer: '' }; });
    return chat(msgs, [tool]).then(function (d) {
      var c = d.message.tool_calls[0];
      if (!c) return wire('model', 'you', plain(d.message.content) || (d.failed ? 'The model wrote a call the server could not read.' : '(no answer)')).then(function () { return { used: used, answer: d.message.content || '' }; });
      used = true;
      msgs.push(asMsg({ content: d.message.content, tool_calls: [c] }));
      return wire('model', 'server', 'Please run ' + callText(c), { name: c.name, arguments: c.arguments }, { open: true }).then(function () {
        if (via === 'mcp') {
          return rpc('tools/call', { name: c.name, arguments: c.arguments }).then(function (r) {
            var text = r.got.result.content[0].text, res; try { res = JSON.parse(text); } catch (e) { res = text; }
            return wire('server', 'sheet', 'tools/call', r.sent, { open: true }).then(function () { return wire('sheet', 'server', r.got.result.isError ? 'An error the model can read' : 'The result', res, { open: true }); }).then(function () { return res; });
          });
        }
        if (c.name !== tool.name) { var er = { error: 'No tool called ' + c.name + '.' }; return wire('server', 'model', 'The server refused', er).then(function () { return er; }); }
        return runTool(c.arguments, S.src).then(function (d2) {
          return wire('server', 'sheet', 'GET the sheet', d2.url).then(function () { return wire('sheet', 'server', d2.ok ? 'The result' : 'An error the model can read', d2.result, { open: true }); }).then(function () { return d2.result; });
        });
      }).then(function (res) {
        msgs.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(res).slice(0, 5800) });
        return wire('server', 'model', 'Here is the result').then(next);
      });
    });
  }
  return wire('you', 'model', question + '  + the card').then(next);
}
function askBox(chips, label) {
  return '<div class="ask"><input id="q" maxlength="300" placeholder="Ask a question" aria-label="Your question"><button class="btn act" id="ask">' + (label || 'Ask') + '</button></div>' +
    (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<button type="button">' + esc(c) + '</button>'; }).join('') + '</div>' : '');
}
function bindAsk(run) {
  var q = $('#q'), b = $('#ask');
  var fire = function () { var v = q.value.trim(); if (!v) return say('Type a question first.'); act(b, function () { return run(v); }); };
  b.onclick = fire; q.onkeydown = function (e) { if (e.key === 'Enter') fire(); };
  $$('.chips button').forEach(function (c) { c.onclick = function () { q.value = c.textContent; fire(); }; });
}
function download() {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['Tool Bench log, ' + new Date().toString() + '\nCard: ' + JSON.stringify(S.card) + '\n\n' + LOG.join('\n\n') + '\n'], { type: 'text/plain' }));
  a.download = 'tool-bench-log.txt'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

/* ---------- step 4: switch the server on ---------- */
function step4() {
  cardAt('server', S.card.name);
  var t = T[4] || (T[4] = { on: false }), own = !!S.src;
  var sw = '<div class="row"><span class="lab">Server</span><span class="seg"><button data-on="0" aria-pressed="' + !t.on + '">By hand</button><button data-on="1" aria-pressed="' + t.on + '">On</button></span></div>';
  if (!t.on) {
    ins('Switch the server on.', true);
    ctx('In step 2 you carried every message. A server does the same three moves with no human in between.');
    panel(sw);
  } else {
    ins(t.ran ? 'The server carried it. Nobody stood in between.' : 'Ask anything about ' + (own ? 'your sheet.' : 'a lecture.'), !t.ran);
    ctx(t.ran ? (own ? 'Ask again, or carry on.' : 'Ask again. Try a lecture that does not exist.') : 'It uses the card you wrote. Watch the wire fill up on its own.');
    panel(sw + askBox(own ? [] : ['What do we build in Lecture 8?', 'What is Lecture 40 about?', 'What is an API?']) +
      (t.ran ? '<div class="row"><button class="btn" id="dl">Download the log</button></div>' : ''));
    bindAsk(function (q) {
      clearWire();
      return loop(q, toolOf(S.card), 'code').then(function (r) { if (r.used) { t.ran = true; finish(4); } else say(t.ran ? 'No tool call this time: it answered from what it already knows.' : 'No tool call: it answered from what it already knows. Ask something only the sheet knows.'); step4(); });
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
  cardAt(t.p ? 'sheet' : 'server', S.card.name);
  $('#sheetSub').textContent = t.p ? 'has its own server' : 'the data';
  if (t.p === 0) {
    ins('A second app wants your tool. Move the card to the sheet’s side.', true);
    ctx('Today the card and the fetch code live inside your server. A second app would need a copy of both, and so would a third. Put them where the data is, once.');
    panel(cardView(S.card) + '<div class="row"><button class="btn act" id="mv">Move the card</button></div>');
    $('#mv').onclick = function () { t.p = 1; clearWire(); step5(); };
    return;
  }
  var url = '<p class="lab">The sheet’s server now lives at</p><p class="url">' + esc(mcpUrl()) + '</p>';
  if (t.p === 1) {
    ins('Your server no longer knows the tool. Ask the sheet’s server what it can do.', true);
    ctx('This is the one new message. Any app can send it.');
    panel(url + '<div class="row"><button class="btn act" id="ls">Ask what it can do</button></div>');
    $('#ls').onclick = function () { act(this, function () {
      return rpc('tools/list').then(function (r) {
        t.tool = r.got.result.tools[0];
        return wire('server', 'sheet', 'tools/list: what can you do?', r.sent, { open: true }).then(function () { return wire('sheet', 'server', 'One tool: ' + t.tool.name, r.got.result, { open: true }); });
      }).then(function () { t.p = 2; step5(); });
    }); };
    return;
  }
  ins(t.ran ? 'You built an MCP server.' : 'Your card came back. Now ask a question.', !t.ran);
  ctx(t.ran ? '' : 'Your server got the card from the sheet’s server, not from its own code.');
  panel(url + askBox(own ? [] : [Q1, 'What is Lecture 40 about?']));
  bindAsk(function (q) {
    var tool = { name: t.tool.name, description: t.tool.description, parameters: t.tool.inputSchema };
    return loop(q, tool, 'mcp').then(function (r) { if (r.used) { t.ran = true; finish(5); } else say(t.ran ? 'No tool call this time: it answered from what it already knows.' : 'No tool call: it answered from what it already knows. Ask something only the sheet knows.'); step5(); });
  });
  forward('');
  if (!t.ran) return after('');
  after('<div class="named"><span class="lab">What this is called</span><p class="big">MCP, the Model Context Protocol.</p>' +
    '<p>Two messages, the same for every app and every tool: <b>tools/list</b> (what can you do?) and <b>tools/call</b> (run this). The tool and its card live with the data. An app that speaks MCP needs only the address.</p>' +
    '<div class="urlrow"><code id="u">' + esc(mcpUrl()) + '</code><button class="btn" id="cp">Copy the address</button></div>' +
    '<div class="row"><button class="btn" id="dl">Download the log</button></div>' + (own ? '' : pyServer()) + '</div>' +
    '<div class="own"><h2>' + (own ? 'Back to the course sheet' : 'Now do it with your own sheet') + '</h2>' +
    (own ? '<p>You are on your own sheet. Your address above is your own MCP server.</p><div class="row"><button class="btn" id="back2">Use the course sheet again</button></div>'
      : '<p>Use your Practice set 1 sheet. In the sheet: Share, General access, “Anyone with the link”, Viewer. Then paste the link. You write five questions and a card for it, and get your own address.</p>' +
        '<div class="ask"><input id="link" placeholder="https://docs.google.com/spreadsheets/d/..." aria-label="Your sheet link"><button class="btn act" id="use">Use my sheet</button></div>') + '</div>');
  $('#cp').onclick = function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(mcpUrl()) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { var r = document.createRange(); r.selectNodeContents($('#u')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }); };
  $('#dl').onclick = download;
  if ($('#use')) $('#use').onclick = function () { var b = this; act(b, function () {
    return post(API, { op: 'peek', link: $('#link').value }).then(function (d) {
      if (d.curriculum) return say('That is the course sheet. Paste your own.');
      S.src = d.src; S.own = { columns: d.columns, rows: d.rows }; S.card = { name: 'tool_1', when: '', needs: '' }; S.tests = blankTests(true); S.runs = 0;
      S.done[3] = S.done[4] = S.done[5] = false; S.max = 3; T = {}; save(); go(3);
    });
  }); };
  if ($('#back2')) $('#back2').onclick = function () { var keep = S.done; S = fresh(); S.done = { 1: keep[1], 2: keep[2] }; S.max = 3; S.step = 3; T = {}; save(); go(3); };
}

/* ---------- the same thing in Python, built from the learner's own card ---------- */
var csvUrl = 'https://docs.google.com/spreadsheets/d/' + CUR + '/gviz/tq?tqx=out:csv&headers=0';
var PY_TOOL = 'def get_lecture(number: int) -> dict:          # the tool: plain code, no model\n' +
  '    for row in csv.reader(io.StringIO(requests.get(SHEET).text)):\n' +
  '        if row[1].startswith(f"{number}. "):\n' +
  '            return {"date": row[0], "title": row[1], "type": row[2], "tools": row[3]}\n' +
  '    return {"error": f"There is no lecture {number}."}\n';
function pyLoop() {
  var card = { type: 'function', function: toolOf(S.card) };
  return '<details class="py"><summary>The same thing in Python</summary><pre>' + esc(
    'import csv, io, json, os, requests\n\n' +
    'SHEET = "' + csvUrl + '"\n' +
    'CARD = ' + JSON.stringify(card, null, 2) + '\n\n' + PY_TOOL + '\n' +
    'messages = [{"role": "user", "content": "' + Q1 + '"}]\n' +
    'for _ in range(3):                              # the server decides when the loop stops\n' +
    '    r = requests.post("https://api.groq.com/openai/v1/chat/completions",\n' +
    '        headers={"Authorization": "Bearer " + os.environ["GROQ_API_KEY"]},\n' +
    '        json={"model": "openai/gpt-oss-120b", "messages": messages, "tools": [CARD]}).json()\n' +
    '    msg = r["choices"][0]["message"]\n' +
    '    messages.append(msg)\n' +
    '    if not msg.get("tool_calls"):               # no request: this is the answer\n' +
    '        print("answer", msg["content"])\n' +
    '        break\n' +
    '    for call in msg["tool_calls"]:              # the model asked; the server acts\n' +
    '        args = json.loads(call["function"]["arguments"])\n' +
    '        result = get_lecture(**args)\n' +
    '        print("call  ", call["function"]["name"], args)\n' +
    '        print("result", result)\n' +
    '        messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result)})\n') + '</pre></details>';
}
function pyServer() {
  return '<details class="py"><summary>The same server in Python (FastMCP)</summary><pre>' + esc(
    '# pip install fastmcp requests\n' +
    'import csv, io, requests\n' +
    'from fastmcp import FastMCP\n\n' +
    'SHEET = "' + csvUrl + '"\n' +
    'mcp = FastMCP("curriculum")\n\n' +
    '@mcp.tool(name=' + JSON.stringify(S.card.name) + ', description=' + JSON.stringify(S.card.when) + ')\n' +
    PY_TOOL + '\n' +
    'if __name__ == "__main__":\n' +
    '    mcp.run()                                   # answers tools/list and tools/call\n') + '</pre></details>';
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
  S.step = n; save();
  T[n] = undefined; clearWire(); waitOn(''); say(''); after(''); forward('');
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
