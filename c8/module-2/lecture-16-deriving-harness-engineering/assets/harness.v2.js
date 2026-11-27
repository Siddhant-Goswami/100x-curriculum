/* Harness Bench (Lecture 16). One screen: the questions, and the boxes around the model.
   Nothing on this page calls a model. assets/runs/ holds recorded runs on the real model for every question under
   every combination of the four switches (see _plan/lecture-16/record2.mjs). The questions are the 100x brain's own
   (github.com/Siddhant-Goswami/100x-brain, eval/), so the Lecture 15 score table is three of these settings.
   Every number in the copy is counted from the recorded runs, so a new recording never leaves the words wrong. */
(function () {
  'use strict';
  var BASE = '/c8/module-2/lecture-16-deriving-harness-engineering/', V = '?v=4';
  var L13 = '/c8/module-2/lecture-13-retrieval-augmented-generation/notes', L15 = '/c8/module-2/lecture-15-building-a-second-brain/', L6 = '/c8/module-2/lecture-06-databases-and-domain-modelling/notes';
  var SW = ['reads', 'asks', 'remembers', 'checks'];
  var PART = {
    reads: { box: 'Search the pages', sub: 'the 3 closest passages go in' },
    asks: { box: 'The 100x brain', sub: 'index, pages and search, at one address' },
    remembers: { box: 'Your own files', sub: 'me.md, told.md, now.md, read first' },
    checks: { box: 'Checks', sub: 'a rule, then a second reader' }
  };
  var STEPS = [
    { seg: 'Bare', on: [], h1: 'Ask the bare model the questions',
      ctx: 'Nothing is switched on. The model gets each question and nothing else, the way the Groq playground sends it.' },
    { seg: 'Search', on: ['reads'], h1: 'Give it something to read',
      ctx: 'Before each question, the server searches the course pages by meaning and puts the three closest passages in the message. That was <a href="' + L13 + '">Lecture 13</a>.' },
    { seg: 'The brain', on: ['reads', 'asks'], h1: 'Let it ask the brain',
      ctx: 'The model gets the <a href="' + L15 + '">100x brain</a>\'s address: read the index, open a page, search. It asks, the server runs it. Someone wrote those pages down earlier, so a hard question becomes a lookup.' },
    { seg: 'Your files', on: ['reads', 'asks', 'remembers'], h1: 'Let it remember you',
      ctx: 'The brain knows the course. It knows nothing about the person asking. Three small files of theirs now go in first: who they are, what they told it, and today\'s date. That is <a href="' + L6 + '">memory.txt</a>, grown up.' },
    { seg: 'Checks', on: ['reads', 'asks', 'remembers', 'checks'], h1: 'Check every answer before it leaves',
      ctx: 'The answer must name its source and quote it. Code checks the quote is really there. Then a second, separate call reads the quote and says yes or no. One retry. After that the question goes to a person.' },
    { seg: 'The record', on: ['reads', 'asks', 'remembers', 'checks'], h1: 'Open a question and read what crossed', record: true,
      ctx: 'Every message is kept. Tap any question to see what the server sent, what the model asked for, what it said, and which check passed or failed.' },
    { seg: 'Switch one off', on: ['reads', 'asks', 'remembers', 'checks'], h1: 'Switch one part off and watch the score', free: true,
      ctx: 'The switches are yours now. A part earns its place only if the score drops when it is off.' }
  ];
  var GROUP = { bench: 'One fact, one page', across: 'Across lectures', stale: 'Dates that have passed', 'about me': 'About the person asking', 'not known': 'Not in the course' };
  var KEY = 'c8.l16.bench', D = null, REC = {}, S = load();
  var $ = function (id) { return document.getElementById(id); };
  function fresh() { return { v: 2, step: 0, ran: {}, guess: {}, sw: null }; }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 2) return s; } catch (e) { /* fresh */ } return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cfg(on) { return SW.map(function (k) { return on.indexOf(k) >= 0 ? '1' : '0'; }).join(''); }
  function num(n) { return Math.round(n).toLocaleString('en-IN'); }
  function count(c) {
    var r = D.cells[c] || {}, o = { right: 0, wrong: 0, none: 0, tokens: 0, calls: 0, n: 0 };
    D.questions.forEach(function (q) { var x = r[q.id]; if (!x) return; o.n++; o[x.mark]++; o.tokens += x.tokens; o.calls += x.calls; });
    o.full = o.n === D.questions.length && !r.$partial;
    return o;
  }
  var open = null, timer = null, N = 0;
  function current() { var st = STEPS[S.step]; return st.free ? (S.sw || cfg(st.on)) : cfg(st.on); }
  function ranHere() { var st = STEPS[S.step]; return st.free || st.record || !!S.ran[S.step]; }
  function noneWord(c) { return c[3] === '1' ? 'held back' : 'no answer'; }

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
      '<div class="g-server"><p>Server <small>follows rules</small></p>' + part('remembers') + part('reads') + '</div><i class="ar"></i>' +
      '<div class="g-pair"><div class="gn model"><b>LLM</b><span>predicts</span></div><i class="ar2"></i>' + part('asks') + '</div><i class="ar"></i>' +
      part('checks') + '<i class="ar"></i>' +
      '<div class="gn you"><b>You</b><span>' + (c[3] === '1' ? 'get an answer, or it goes to a person' : 'get whatever the model said') + '</span></div>';
    var n = count(c);
    $('cost').innerHTML = (ranHere() && n.full) ? '<p><b>' + num(n.calls) + '</b> calls to the model</p><p><b>' + num(n.tokens) + '</b> tokens for the ' + N + ' questions</p>' : '';
  }

  /* ---------- the questions ---------- */
  function word(m, c) { return m === 'right' ? 'Right' : m === 'wrong' ? 'Wrong' : (c[3] === '1' ? 'Held back' : 'No answer'); }
  function list(reveal) {
    var c = current(), r = D.cells[c] || {}, ready = ranHere(), h = '', last = '', i = 0;
    D.questions.forEach(function (q) {
      if (q.group !== last) { h += '<li class="grp">' + esc(GROUP[q.group] || q.group) + '</li>'; last = q.group; }
      var x = r[q.id], shown = ready && x && (reveal == null || i < reveal), m = shown ? x.mark : '', isOpen = open === q.id && shown;
      h += '<li class="q ' + m + (isOpen ? ' open' : '') + '" data-q="' + q.id + '">' +
        '<button type="button" class="q-row"' + (shown ? '' : ' disabled') + ' aria-expanded="' + isOpen + '">' +
        '<span class="q-id">' + q.id + '</span><span class="q-text" data-nolabel>' + esc(q.q) + '</span>' +
        '<span class="q-mark">' + (m ? word(m, c) : '') + '</span></button>' + (isOpen ? record(q, c, x) : '') + '</li>';
      i++;
    });
    $('qlist').innerHTML = h;
    var n = count(c);
    $('tally').innerHTML = ready && reveal == null && n.n ? '<b class="right">' + n.right + ' right</b><b class="wrong">' + n.wrong + ' wrong</b><b class="held">' + n.none + ' ' + noneWord(c) + '</b>' : '';
    $('recnote').textContent = 'Recorded on ' + D.recorded + ' with ' + D.model + ' on Groq. Each question was asked ' + D.runs + ' times under each setting and takes the result most runs gave. A new run can differ.';
  }

  /* one question's record: everything that crossed, in order. The record file for a setting loads when first opened. */
  function T(rec, v) { return v && typeof v === 'object' && v.$t ? rec.texts[v.$t] : (v == null ? '' : v); }
  function record(q, c, sum) {
    var rec = REC[c];
    if (!rec) {
      if (rec !== null) { REC[c] = null; fetch(BASE + 'assets/runs/' + c + '.json' + V).then(function (r) { return r.json(); }).then(function (d) { REC[c] = d; list(); }).catch(function () { delete REC[c]; }); }
      return '<div class="rec"><p class="rec-want">Opening the record…</p></div>';
    }
    var x = rec.cells[q.id]; if (!x) return '';
    var h = '<div class="rec" data-nolabel><p class="rec-want">The right answer: <b>' + esc(q.want) + '</b>' + (D.runs > 1 ? ' · ' + word(sum.mark, c).toLowerCase() + ' in ' + sum.n + ' of ' + D.runs + ' runs. This is one of them.' : '') + '</p>';
    x.ev.forEach(function (e) {
      var t = T(rec, e.text);
      if (e.k === 'memory') h += row('server', 'Server put the person\'s own files first', '<p>' + e.files.map(function (f) { return '<code>' + esc(f) + '</code>'; }).join(' ') + '</p>');
      else if (e.k === 'search') h += row('server', 'Server searched the course pages', '<ul>' + e.hits.map(function (t) { return '<li><code>' + esc(t.id) + '</code> ' + esc(t.at) + '</li>'; }).join('') + '</ul>');
      else if (e.k === 'req') h += row('server', e.judge ? 'Server sent the quote to a second reader' : (e.first ? 'Server sent this to the LLM' : (e.role === 'tool' ? 'Server sent the result back to the LLM' : 'Server sent it back to the LLM')), e.role === 'tool' ? '' : fold(t, e.first ? 'the whole message' : 'the message'));
      else if (e.k === 'res') h += row('model', e.judge ? 'The second reader said' : 'The LLM said', e.failed ? '<p class="bad">It wrote a tool call the server could not read.</p>' : e.refused ? '<p class="bad">Groq refused the request: ' + esc(e.refused) + '</p>' : long(t));
      else if (e.k === 'ask') h += row('model', 'The LLM asked for', '<p><code>' + esc(e.name) + '(' + esc(JSON.stringify(e.args) === '{}' ? '' : JSON.stringify(e.args)) + ')</code></p>');
      else if (e.k === 'tool') h += row('server', 'Server ran it on the brain', fold(t, e.id === 'search' ? 'what search found' : e.id));
      else if (e.k === 'check') h += row(e.by === 'rule' ? 'server' : 'model', (e.by === 'rule' ? 'Check by rule: ' : 'Check by judgment: ') + (e.ok ? 'passed' : 'failed'), '<p class="' + (e.ok ? 'ok' : 'bad') + '">' + esc(t) + '</p>');
      else if (e.k === 'back') h += row('server', 'Server sent the failure back', '<p>' + esc(t) + '</p>');
      else if (e.k === 'note') h += row('server', 'Server stopped', '<p>' + esc(t) + '</p>');
    });
    var sent = T(rec, x.sent);
    h += row('you', x.held ? 'Nothing was sent to you' : (sent ? 'Sent to you' : 'Nothing came back'), x.held ? '<p>The question goes to a person.</p>' : (sent ? long(sent) : '<p>The loop ended without an answer.</p>'));
    return h + '</div>';
  }
  function row(who, title, body) { return '<div class="rw ' + who + '"><p class="rw-t">' + esc(title) + '</p>' + body + '</div>'; }
  function long(t) { t = String(t || ''); return t.length > 420 ? '<p class="say">' + esc(t.slice(0, 380)) + '…</p>' + fold(t, 'all ' + t.split(/\s+/).length + ' words') : '<p class="say">' + esc(t) + '</p>'; }
  function fold(t, what) { return '<details><summary>Show ' + esc(what) + '</summary><pre>' + esc(t) + '</pre></details>'; }

  /* ---------- the panel: the one thing to do now ---------- */
  function tallyLine(n, c) { return n.right + ' of ' + N + ' right. ' + n.wrong + ' wrong ' + (n.wrong === 1 ? 'answer' : 'answers') + ' sent, ' + n.none + ' ' + noneWord(c) + '.'; }
  function panel() {
    var st = STEPS[S.step], c = current(), n = count(c), h = '';
    var prev = S.step > 0 ? cfg(STEPS[S.step - 1].on) : null;
    if (st.free) return freePanel();
    if (st.record) {
      var worst = D.questions.filter(function (q) { return ((D.cells[c] || {})[q.id] || {}).mark !== 'right'; });
      h = '<p class="q">' + (worst.length ? 'With everything on, ' + worst.length + ' of ' + N + ' ' + (worst.length === 1 ? 'is' : 'are') + ' still not right: ' + worst.map(function (q) { return q.id; }).join(', ') + '. Open one and find the line where it went wrong.'
        : 'With everything on, all ' + N + ' are right. Open any question and follow one answer from the question to the check.') + '</p>' +
        '<p class="lab">Ask of every line: is it a rule, the model, or a person?</p>' +
        '<div class="row"><button class="btn go" id="next">Continue</button></div>';
      $('panel').innerHTML = h; return;
    }
    if (!S.ran[S.step]) {
      if (S.step > 0 && S.guess[S.step] == null) {
        h = '<p class="q">It was ' + count(prev).right + ' right of ' + N + '. How many will be right now?</p><div class="chips nums">' +
          Array.from({ length: N + 1 }, function (_, i) { return '<button type="button" data-g="' + i + '">' + i + '</button>'; }).join('') + '</div>';
      } else {
        h = (S.step > 0 ? '<p class="lab">You guessed ' + S.guess[S.step] + '.</p>' : '') +
          '<div class="row"><button class="btn go" id="run">Run the ' + N + ' questions</button></div>';
      }
    } else {
      h = '<p class="q">' + tallyLine(n, c) + '</p>';
      if (S.step > 0) {
        var g = S.guess[S.step], before = count(prev);
        if (g != null) h += '<p class="lab">You guessed ' + g + '. ' + (g === n.right ? 'Right.' : 'It was ' + n.right + '.') + '</p>';
        h += changes(prev, c);
        if (c[3] === '1' && n.right < before.right) h += '<p class="lab">The checks cost ' + (before.right - n.right) + ' right ' + (before.right - n.right === 1 ? 'answer' : 'answers') + ' here' + (before.wrong > n.wrong ? ' and stopped ' + (before.wrong - n.wrong) + ' wrong ' + (before.wrong - n.wrong === 1 ? 'one' : 'ones') + '.' : ' and stopped nothing, because nothing else failed.') + ' Step 7 shows what they are for.</p>';
      } else h += '<p class="lab">Same model for every step from here. Only what is around it changes.</p>';
      h += '<div class="row"><button class="btn go" id="next">Continue</button></div>';
    }
    $('panel').innerHTML = h;
  }
  function changes(a, b) {
    var up = [], down = [], none = [];
    D.questions.forEach(function (q) {
      var x = ((D.cells[a] || {})[q.id] || {}).mark, y = ((D.cells[b] || {})[q.id] || {}).mark;
      if (x === y) return;
      if (y === 'right') up.push(q.id); else if (y === 'none') none.push(q.id); else down.push(q.id);
    });
    var bits = [];
    if (up.length) bits.push('<b class="right">Now right: ' + up.join(', ') + '</b>');
    if (none.length) bits.push('<b class="held">Now ' + noneWord(b) + ': ' + none.join(', ') + '</b>');
    if (down.length) bits.push('<b class="wrong">Now wrong: ' + down.join(', ') + '</b>');
    return '<p class="moved">' + (bits.join(' ') || 'No question changed.') + '</p>';
  }
  function freePanel() {
    var full = '1111', nf = count(full), c = current(), n = count(c);
    var rows = SW.map(function (k, i) {
      var off = full.slice(0, i) + '0' + full.slice(i + 1), m = count(off);
      if (!m.full) return '<tr><th>' + PART[k].box + '</th><td colspan="3">not recorded yet</td></tr>';
      return '<tr><th>' + PART[k].box + '</th><td>' + m.right + '</td><td>' + m.wrong + '</td><td>' + (m.tokens - nf.tokens > 0 ? '+' : '') + num(m.tokens - nf.tokens) + '</td></tr>';
    }).join('');
    $('panel').innerHTML =
      (!n.full ? '<p class="q">This combination was not recorded. Switch one box back.</p>' : '<p class="q">Now: ' + tallyLine(n, c) + '</p>') +
      '<p class="lab">Tap a box on the right to switch it. Try your own files off, then the checks off as well, and open question H each time.</p>' +
      '<table class="earn"><thead><tr><th>With this one off</th><th>Right</th><th>Wrong, sent</th><th>Tokens</th></tr></thead><tbody>' +
      '<tr class="all"><th>Everything on</th><td>' + nf.right + '</td><td>' + nf.wrong + '</td><td>' + num(nf.tokens) + '</td></tr>' + rows + '</tbody></table>' +
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
    timer = setInterval(function () { i++; list(i); if (i >= N) { clearInterval(timer); draw(); } }, 120);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-g],#run,#next,#again,.q-row,.segs a,.gn.part');
    if (!t) return;
    if (t.matches('[data-g]')) { S.guess[S.step] = +t.dataset.g; save(); panel(); }
    else if (t.id === 'run') run();
    else if (t.id === 'next') go(S.step + 1);
    else if (t.id === 'again') { S = fresh(); save(); go(0); }
    else if (t.matches('.segs a')) { e.preventDefault(); go(+t.dataset.s); }
    else if (t.matches('.q-row')) { var id = t.parentNode.dataset.q; open = open === id ? null : id; list(); }
    else if (t.matches('button.gn.part')) { var c = current().split(''), k = SW.indexOf(t.dataset.k); c[k] = c[k] === '1' ? '0' : '1'; S.sw = c.join(''); save(); draw(); }
  });

  fetch(BASE + 'assets/runs/index.json' + V).then(function (r) { return r.json(); }).then(function (d) {
    D = d; N = d.questions.length;
    var h = parseInt(location.hash.slice(1), 10);
    if (h >= 1 && h <= STEPS.length) S.step = h - 1;
    if (STEPS[S.step].free && !S.sw) S.sw = '1111';
    draw();
  }).catch(function () { $('ins').textContent = 'The recorded runs did not load. Refresh the page.'; });
})();
