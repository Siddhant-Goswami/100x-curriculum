/* Harness Bench (Lecture 16). One screen: ten questions, and the boxes around the model.
   Nothing on this page calls a model. runs.json holds a recorded run on the real model for every question under
   every combination of the four switches (see _plan/lecture-16/record.mjs). The page only replays them.
   Every number in the copy is counted from runs.json, so a new recording never leaves the words wrong. */
(function () {
  'use strict';
  var BASE = '/c8/module-2/lecture-16-deriving-harness-engineering/';
  var SW = ['reads', 'asks', 'remembers', 'checks'];
  var PART = {
    reads: { name: 'Reads', box: 'Search the notes', sub: 'the 3 closest passages go in', from: 'Lecture 13' },
    asks: { name: 'Asks', box: 'The sheet tool', sub: 'get_lecture(number), run by the server', from: 'Lecture 11' },
    remembers: { name: 'Remembers', box: 'A saved note', sub: 'one line kept from Monday', from: 'Lecture 6' },
    checks: { name: 'Checks', box: 'Checks', sub: 'a rule, then a second reader', from: 'Lecture 1' }
  };
  var STEPS = [
    { seg: 'Bare', on: [], h1: 'Ask the bare model ten questions',
      ctx: 'Nothing is switched on. The model gets each question and nothing else, the way the Groq playground sends it.' },
    { seg: 'Reads', on: ['reads'], h1: 'Give it something to read',
      ctx: 'Before each question, the server searches our notes by meaning and puts the three closest passages in the message. That was <a href="/c8/module-2/lecture-13-retrieval-augmented-generation/notes">Lecture 13</a>.' },
    { seg: 'Asks', on: ['reads', 'asks'], h1: 'Let it ask for what it needs',
      ctx: 'The model also gets the tool card for the curriculum sheet. If it asks for a lecture, the server runs the lookup and sends the row back. That was <a href="/c8/module-2/lecture-11-tool-calling-and-mcp/notes">Lecture 11</a>.' },
    { seg: 'Remembers', on: ['reads', 'asks', 'remembers'], h1: 'Let the system remember',
      ctx: 'On Monday this learner said "I am stuck on Lecture 6." The model has no Monday. The server kept that one line and now sends it with every question.' },
    { seg: 'Checks', on: ['reads', 'asks', 'remembers', 'checks'], h1: 'Check every answer before it leaves',
      ctx: 'The answer must name its source and quote it. Code checks the quote is really there. Then a second, separate call reads the quote and says yes or no. One retry. After that the question goes to a person.' },
    { seg: 'The record', on: ['reads', 'asks', 'remembers', 'checks'], h1: 'Open a question and read what crossed', record: true,
      ctx: 'Every message is kept. Tap any question to see what the server sent, what the model said, and which check passed or failed.' },
    { seg: 'Switch one off', on: ['reads', 'asks', 'remembers', 'checks'], h1: 'Switch one part off and watch the score', free: true,
      ctx: 'The switches are yours now. A part earns its place only if the score drops when it is off.' }
  ];
  var KEY = 'c8.l16.bench';
  var D = null, S = load();
  var $ = function (id) { return document.getElementById(id); };
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch (e) { /* fresh */ } return { v: 1, step: 0, ran: {}, guess: {}, sw: null }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cfg(on) { return SW.map(function (k) { return on.indexOf(k) >= 0 ? '1' : '0'; }).join(''); }
  function onOf(c) { return SW.filter(function (k, i) { return c[i] === '1'; }); }
  function count(c) {
    var r = D.runs[c] || {}, o = { right: 0, wrong: 0, held: 0, tokens: 0, calls: 0, n: 0 };
    D.questions.forEach(function (q) { var x = r[q.id]; if (!x) return; o.n++; o[x.mark]++; o.tokens += x.usage.in + x.usage.out; o.calls += x.usage.calls; });
    o.full = o.n === D.questions.length;
    return o;
  }
  var open = null, showing = null, timer = null;

  /* which configuration is on screen */
  function current() {
    var st = STEPS[S.step];
    if (st.free) return S.sw || cfg(st.on);
    return cfg(st.on);
  }
  function ranHere() { var st = STEPS[S.step]; return st.free || st.record || !!S.ran[S.step]; }

  /* ---------- the bar ---------- */
  function bar() {
    $('segs').innerHTML = STEPS.map(function (s, i) {
      return '<a href="#' + (i + 1) + '" data-s="' + i + '" class="reach' + (i === S.step ? ' on' : (S.ran[i] ? ' done' : '')) + '"><i></i><span>' + esc(s.seg) + '</span></a>';
    }).join('');
    $('where').textContent = 'Step ' + (S.step + 1) + ' of ' + STEPS.length;
  }

  /* ---------- the boxes around the model ---------- */
  function graph() {
    var c = current(), st = STEPS[S.step], free = !!st.free;
    var newest = st.on.length && !free && !st.record ? st.on[st.on.length - 1] : '';
    function part(k) {
      var on = c[SW.indexOf(k)] === '1', p = PART[k];
      return '<' + (free ? 'button type="button"' : 'div') + ' class="gn part ' + k + (on ? ' on' : ' off') + (k === newest ? ' new' : '') + '" data-k="' + k + '"' + (free ? ' aria-pressed="' + on + '"' : '') + '>' +
        '<span class="sw" aria-hidden="true"><i></i></span><b>' + p.box + '</b><span>' + (on ? p.sub : 'off') + '</span></' + (free ? 'button' : 'div') + '>';
    }
    $('graph').innerHTML =
      '<p class="g-title">Around the model</p>' +
      '<div class="gn you"><b>You</b><span>ask a question</span></div><i class="ar"></i>' +
      '<div class="g-server"><p>Server <small>follows rules</small></p>' + part('reads') + part('remembers') + '</div><i class="ar"></i>' +
      '<div class="g-pair"><div class="gn model"><b>LLM</b><span>predicts</span></div><i class="ar2"></i>' + part('asks') + '</div><i class="ar"></i>' +
      part('checks') + '<i class="ar"></i>' +
      '<div class="gn you"><b>You</b><span>' + (c[3] === '1' ? 'get an answer, or it goes to a person' : 'get whatever the model said') + '</span></div>';
    var n = count(c), ready = ranHere() || free;
    $('cost').innerHTML = ready ? '<p><b>' + n.calls + '</b> calls to the model</p><p><b>' + n.tokens.toLocaleString('en-IN') + '</b> tokens for the ten questions</p>' : '';
  }

  /* ---------- the questions ---------- */
  var WORD = { right: 'Right', wrong: 'Not right', held: 'Held back' };
  function list(reveal) {
    var c = current(), r = D.runs[c] || {}, ready = ranHere();
    $('qlist').innerHTML = D.questions.map(function (q, i) {
      var x = r[q.id], shown = ready && x && (reveal == null || i < reveal), m = shown ? x.mark : '';
      return '<li class="q ' + m + (open === q.id && shown ? ' open' : '') + '" data-q="' + q.id + '">' +
        '<button type="button" class="q-row"' + (shown ? '' : ' disabled') + ' aria-expanded="' + (open === q.id && shown) + '">' +
        '<span class="q-id">' + q.id + '</span><span class="q-text" data-nolabel>' + esc(q.q) + '</span>' +
        '<span class="q-mark">' + (m ? WORD[m] : '') + '</span></button>' +
        (open === q.id && shown ? record(q, x) : '') + '</li>';
    }).join('');
    var n = count(c);
    $('tally').innerHTML = ready && reveal == null ? '<b class="right">' + n.right + ' right</b><b class="wrong">' + n.wrong + ' not right</b>' + (c[3] === '1' ? '<b class="held">' + n.held + ' held back</b>' : '') : '';
    $('recnote').textContent = 'Recorded on ' + D.recorded + ' with ' + D.model + ' on Groq, one run for each question under each setting. A new run can differ.';
    showing = c;
  }

  /* one question's record: everything that crossed, in order */
  function record(q, x) {
    var h = '<div class="rec" data-nolabel><p class="rec-want">The right answer: <b>' + esc(q.want) + '</b></p>';
    x.ev.forEach(function (e) {
      if (e.k === 'search') h += row('server', 'Server searched the notes', '<ul>' + e.hits.map(function (t) { return '<li><code>' + esc(t.id) + '</code> Lecture ' + t.lecture + ', ' + esc(t.title) + '</li>'; }).join('') + '</ul>');
      else if (e.k === 'memory') h += row('server', 'Server added the saved note', '<p>' + esc(e.note) + '</p>');
      else if (e.k === 'req') h += row('server', e.judge ? 'Server sent the quote to a second reader' : (e.body.more ? 'Server sent it back to the LLM' : 'Server sent this to the LLM'), fold(e.body.messages.map(function (m) { return m.content; }).join('\n\n'), e.body.more ? 'the new message' : 'the whole message'));
      else if (e.k === 'res') h += row('model', e.judge ? 'The second reader said' : 'The LLM said', e.failed ? '<p class="bad">It wrote a tool call the server could not read.</p>' : long(e.text));
      else if (e.k === 'ask') h += row('model', 'The LLM asked for', '<p><code>' + esc(e.name) + '(' + esc(JSON.stringify(e.args)) + ')</code></p>');
      else if (e.k === 'tool') h += row('server', 'Server ran it on the sheet', fold(JSON.stringify(e.result, null, 1), 'the row'));
      else if (e.k === 'check') h += row(e.by === 'rule' ? 'server' : 'model', (e.by === 'rule' ? 'Check by rule: ' : 'Check by judgment: ') + (e.ok ? 'passed' : 'failed'), '<p class="' + (e.ok ? 'ok' : 'bad') + '">' + esc(e.text) + '</p>');
      else if (e.k === 'back') h += row('server', 'Server sent the failure back', '<p>' + esc(e.text) + '</p>');
      else if (e.k === 'note') h += row('server', 'Server stopped', '<p>' + esc(e.text) + '</p>');
    });
    h += row('you', x.held ? 'Nothing was sent to you' : (x.sent ? 'Sent to you' : 'Nothing came back'), x.held ? '<p>The question goes to a person.</p>' : (x.sent ? long(x.sent) : '<p>The loop ended without an answer.</p>'));
    return h + '</div>';
  }
  function row(who, title, body) { return '<div class="rw ' + who + '"><p class="rw-t">' + esc(title) + '</p>' + body + '</div>'; }
  function long(t) { t = String(t || ''); return t.length > 420 ? '<p class="say">' + esc(t.slice(0, 380)) + '…</p>' + fold(t, 'all ' + t.split(/\s+/).length + ' words') : '<p class="say">' + esc(t) + '</p>'; }
  function fold(t, what) { return '<details><summary>Show ' + what + '</summary><pre>' + esc(t) + '</pre></details>'; }

  /* ---------- the panel: the one thing to do now ---------- */
  function panel() {
    var st = STEPS[S.step], c = current(), n = count(c), h = '';
    var prev = S.step > 0 ? cfg(STEPS[S.step - 1].on) : null;
    if (st.free) return freePanel();
    if (st.record) {
      var worst = D.questions.filter(function (q) { return D.runs[c][q.id].mark !== 'right'; });
      h = '<p class="q">' + (worst.length ? 'With everything on, ' + worst.length + ' of ten ' + (worst.length === 1 ? 'is' : 'are') + ' still not right: ' + worst.map(function (q) { return q.id; }).join(', ') + '. Open one and find the line where it went wrong.'
        : 'With everything on, all ten are right. Open any question and follow one answer from the question to the check.') + '</p>' +
        '<p class="lab">Ask of every line: is it a rule, the model, or a person?</p>' +
        '<div class="row"><button class="btn go" id="next">Continue</button></div>';
      $('panel').innerHTML = h; return;
    }
    if (!S.ran[S.step]) {
      if (S.step > 0 && S.guess[S.step] == null) {
        var was = count(prev);
        h = '<p class="q">It was ' + was.right + ' right of ten. How many will be right now?</p><div class="chips nums">' +
          Array.from({ length: 11 }, function (_, i) { return '<button type="button" data-g="' + i + '">' + i + '</button>'; }).join('') + '</div>';
      } else {
        h = (S.step > 0 ? '<p class="lab">You guessed ' + S.guess[S.step] + '.</p>' : '') +
          '<div class="row"><button class="btn go" id="run">Run the ten questions</button></div>';
      }
    } else {
      h = '<p class="q">' + n.right + ' of ten right. ' + (c[3] === '1'
        ? n.wrong + ' not right and sent anyway, ' + n.held + ' held back for a person.'
        : (n.wrong ? 'The other ' + n.wrong + ' went to the learner anyway.' : '')) + '</p>';
      if (S.step > 0) {
        var g = S.guess[S.step];
        if (g != null) h += '<p class="lab">You guessed ' + g + '. ' + (g === n.right ? 'Right.' : 'It was ' + n.right + '.') + '</p>';
        h += changes(prev, c);
        var before = count(prev);
        if (c[3] === '1' && n.right < before.right) h += '<p class="lab">The checks cost ' + (before.right - n.right) + ' right ' + (before.right - n.right === 1 ? 'answer' : 'answers') + ' here and caught nothing, because nothing else failed. Step 7 shows what they are for.</p>';
      } else h += '<p class="lab">Same model for every step from here. Only what is around it changes.</p>';
      h += '<div class="row"><button class="btn go" id="next">Continue</button></div>';
    }
    $('panel').innerHTML = h;
  }
  /* what moved between two settings, in letters */
  function changes(a, b) {
    var up = [], down = [], held = [];
    D.questions.forEach(function (q) {
      var x = D.runs[a][q.id].mark, y = D.runs[b][q.id].mark;
      if (x === y) return;
      if (y === 'right') up.push(q.id); else if (y === 'held') held.push(q.id); else down.push(q.id);
    });
    var bits = [];
    if (up.length) bits.push('<b class="right">Now right: ' + up.join(', ') + '</b>');
    if (held.length) bits.push('<b class="held">Now held back: ' + held.join(', ') + '</b>');
    if (down.length) bits.push('<b class="wrong">No longer right: ' + down.join(', ') + '</b>');
    return '<p class="moved">' + (bits.join(' ') || 'No question changed.') + '</p>';
  }
  function freePanel() {
    var full = '1111', nf = count(full), c = current(), n = count(c);
    var rows = SW.map(function (k, i) {
      var off = full.slice(0, i) + '0' + full.slice(i + 1), m = count(off);
      if (!m.full) return '<tr><th>' + PART[k].box + '</th><td colspan="3">not recorded yet</td></tr>';
      return '<tr><th>' + PART[k].box + '</th><td>' + m.right + '</td><td>' + m.wrong + '</td><td>' + (m.tokens - nf.tokens > 0 ? '+' : '') + (m.tokens - nf.tokens).toLocaleString('en-IN') + '</td></tr>';
    }).join('');
    $('panel').innerHTML =
      (!n.full ? '<p class="q">This combination was not recorded. Switch one box back.</p>' : '<p class="q">Now: ' + n.right + ' right, ' + n.wrong + ' not right and sent' + (c[3] === '1' ? ', ' + n.held + ' held back' : '') + '.</p>') +
      '<p class="lab">Tap a box on the right to switch it. Try the saved note off, then the checks off as well, and open question H each time.</p>' +
      '<table class="earn"><thead><tr><th>With this one off</th><th>Right</th><th>Not right, sent</th><th>Tokens</th></tr></thead><tbody>' +
      '<tr class="all"><th>Everything on</th><td>' + nf.right + '</td><td>' + nf.wrong + '</td><td>' + nf.tokens.toLocaleString('en-IN') + '</td></tr>' + rows + '</tbody></table>' +
      '<div class="named"><p class="lab">Its name</p><p class="big">The harness</p><p>The model was the same in every run. Everything you switched on and off sits around it: what it reads, what it can ask for, what the system remembers, what checks the answer, and the record of what crossed. Arranging those parts is harness engineering.</p></div>' +
      '<div class="row"><a class="btn go" href="' + BASE + 'card">Fill your harness card</a><button class="btn ghost" id="again">Start again</button></div>';
  }

  /* ---------- drawing and moving ---------- */
  function draw(reveal) {
    var st = STEPS[S.step];
    $('ins').textContent = st.h1;
    $('ins').className = ranHere() && !st.free && !st.record ? '' : 'do';
    $('ctx').innerHTML = st.ctx;
    bar(); graph(); list(reveal); if (reveal == null) panel();
  }
  function go(i) { clearInterval(timer); S.step = Math.max(0, Math.min(STEPS.length - 1, i)); open = null; if (STEPS[S.step].free && !S.sw) S.sw = '1111'; save(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); $('ins').focus({ preventScroll: true }); }
  function run() {
    S.ran[S.step] = true; save();
    var i = 0, still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('panel').innerHTML = '<p class="lab">Running…</p>';
    if (still) { draw(); return; }
    draw(0);
    timer = setInterval(function () { i++; list(i); if (i >= D.questions.length) { clearInterval(timer); draw(); } }, 170);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-g],#run,#next,#again,.q-row,.segs a,.gn.part');
    if (!t) return;
    if (t.matches('[data-g]')) { S.guess[S.step] = +t.dataset.g; save(); panel(); }
    else if (t.id === 'run') run();
    else if (t.id === 'next') go(S.step + 1);
    else if (t.id === 'again') { S = { v: 1, step: 0, ran: {}, guess: {}, sw: null }; save(); go(0); }
    else if (t.matches('.segs a')) { e.preventDefault(); go(+t.dataset.s); }
    else if (t.matches('.q-row')) { var id = t.parentNode.dataset.q; open = open === id ? null : id; list(); }
    else if (t.matches('button.gn.part')) { var c = current().split(''), k = SW.indexOf(t.dataset.k); c[k] = c[k] === '1' ? '0' : '1'; S.sw = c.join(''); save(); draw(); }
  });

  fetch(BASE + 'assets/runs.json?v=3').then(function (r) { return r.json(); }).then(function (d) {
    D = d;
    var h = parseInt(location.hash.slice(1), 10);
    if (h >= 1 && h <= STEPS.length) S.step = h - 1;
    if (STEPS[S.step].free && !S.sw) S.sw = '1111';
    draw();
  }).catch(function () { $('ins').textContent = 'The recorded runs did not load. Refresh the page.'; });
})();
