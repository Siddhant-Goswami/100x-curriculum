/* RAG Lab (Lecture 14, code track). Nine levels, one small Python function each, run in the page by lab-worker.js.
   Every number shown comes from the worker (INFO), computed on the 183 passages: nothing here is typed in by hand
   except the three facts marked REAL RUN below, which were measured on the live LLM on 21 Nov 2026.
   State: localStorage c8.l14.lab. The Groq key (level 7 only) lives in sessionStorage c8.l11.key, shared with the benches. */
(function () {
'use strict';
var BASE = '/c8/module-2/lecture-14-building-rag-apps/assets/', V = '?v=1';
var API = '/api/retrieve', MODEL = 'openai/gpt-oss-120b', KEYS = 'c8.l11.key', STORE = 'c8.l14.lab';
var FREE_TPM = 8000;
/* the bench's own rule for "it says the notes do not cover it" (bench.js RULES.Q4), unchanged */
var NOTIN = /(passages|notes|context)[^.]{0,50}\b(do not|don['’]t|does not|doesn['’]t|did not|didn['’]t|not)\s+(contain|include|mention|cover|say|describe|provide|address|state|specify|discuss|show|explain|teach)|\bnone of (the|these|our) (passages|notes|lectures)\b[^.]{0,40}\b(mention|cover|show|explain|describe|address|discuss|teach)|\bno lecture\b|\b(not|n['’]t)\s+(in|part of|covered (in|by)|mentioned in)\s+(the|our|my|your|these)\s+(notes|passages)|\bno (information|mention|details?|lecture)\b[^.]{0,40}\b(in|from|within)\s+(the|our|these)\s+(notes|passages)/i;

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var num = function (n) { return Number(n).toLocaleString('en-US'); };

/* ---------- state ---------- */
var S = { at: 0, done: {}, code: {}, guess: {}, runs: {}, hint: {}, stars: {}, pick: null, filter: null, live: null, wrong: 0, cases: {} };
try { var saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved && typeof saved === 'object') for (var k in S) if (saved[k] != null) S[k] = saved[k]; } catch (e) { /* start fresh */ }
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* memory only */ } }
var groqKey = ''; try { groqKey = sessionStorage.getItem(KEYS) || ''; } catch (e) { /* asked when needed */ }

var INFO = null;                      // from the worker: board, totals, questions
var rk = function (m, q) { return INFO.board[m][q]; };
var found = function (m) { return Object.keys(INFO.board[m]).filter(function (q) { return INFO.board[m][q] <= 3; }).length; };
var qtext = function (id) { return INFO.questions.filter(function (q) { return q.id === id; })[0].q; };

/* ---------- the levels ---------- */
var LEVELS = [
  { id: 'count', seg: 'Count',
    h1: 'Add up the tokens before you send anything.',
    ctx: 'Our twelve notes pages are cut into 183 passages. Each passage knows its size in tokens. Finish the function, then press Run.',
    guess: { q: 'You paste all 183 passages with one question, on a free Groq key. What comes back?', opts: ['The right answer', 'A wrong answer', 'A refusal'], right: 2 },
    starter: 'def total_tokens(passages):\n    total = 0\n    # your code: go through the passages and add each one\'s size.\n    # the size of one passage p is p["tokens"]\n    return total\n',
    hint: 'for p in passages:\n    total = total + p["tokens"]',
    happened: function () { return '<b>' + num(INFO.tokens) + ' tokens.</b> A free Groq key takes ' + num(FREE_TPM) + ' a minute, so the request is refused before the LLM reads a word. On the Retrieval Bench the refusal read: <i>Limit 8000, Requested 31131</i>. From here on, a question carries a few passages, not all 183.'; },
    name: 'The most you let one question send is its <b>token budget</b>.',
    iq: 'Context windows hold a million tokens now. Why build RAG?',
    ia: function () { return 'The window is not the limit I hit first. My notes are ' + num(INFO.tokens) + ' tokens and fit in any window, but every question would pay for all of them, and my key allows ' + num(FREE_TPM) + ' a minute. So I send the few passages that matter.'; } },

  { id: 'shared', seg: 'Shared words', col: 'shared',
    h1: 'Score a passage by the words it shares with the question.',
    ctx: 'Your score decides the order: all 183 passages are sorted by it, best first. The scoreboard shows the place of the right passage for ten questions. Top 3 counts as found.',
    starter: 'def score(question, passage):\n    q = set(words(question))           # the different words in the question\n    p = set(words(passage["text"]))    # the different words in the passage\n    # your code: how many of the question\'s words are also in the passage?\n    return 0\n',
    hint: 'q & p is the set of words that are in both.\nlen(q & p) counts them.',
    happened: function () { return '<b>Found ' + found('shared') + ' of 10.</b> Question B sits at place ' + rk('shared', 'B') + ' and D at place ' + rk('shared', 'D') + '. Every shared word counts the same, so "what" and "the" weigh as much as "forgets".'; },
    name: 'Ten questions whose right passage you already know are a <b>golden set</b>. "Found in the top 3" is <b>recall@3</b>.',
    iq: 'How do you know your retrieval works?',
    ia: function () { return 'I keep a small set of questions where I know which passage holds the answer. After every change I count how often that passage lands in the top 3. Counting shared words found ' + found('shared') + ' of 10. That number is where I started.'; } },

  { id: 'rare', seg: 'Rare words', col: 'rare',
    h1: 'Make rare words count more.',
    ctx: function () { return '"lecture" is in ' + INFO.seen.lecture + ' of the 183 passages. "law" is in ' + INFO.seen.law + '. Change one line so that a word seen in few passages adds more: <code>math.log(N / seen_in(w))</code> in place of 1.'; },
    guess: { q: function () { return 'Shared words found ' + found('shared') + ' of 10. With rare words counting more, how many?'; }, opts: ['6', '8', '10'], right: 0 },
    starter: 'def score(question, passage):\n    q = set(words(question))\n    p = set(words(passage["text"]))\n    total = 0\n    for w in q & p:\n        # seen_in(w) is how many passages contain w. N is the number of passages.\n        total += 1          # change this line\n    return total\n',
    hint: 'total += math.log(N / seen_in(w))\nA word that is in every passage adds log(1), which is 0.',
    happened: function () { return '<b>Found ' + found('rare') + ' of 10.</b> A, F and J moved up. But B ("' + esc(qtext('B')) + '") is at place ' + rk('rare', 'B') + ' and D at place ' + rk('rare', 'D') + '. The notes say "hallucinate". No way of counting words can know that means the same.'; },
    name: 'This is the core of <b>BM25</b>, the keyword search inside most search boxes. BM25 adds one more adjustment, for long passages.',
    iq: 'When is keyword search the right choice?',
    ia: function () { return 'When the question carries the exact word: a name, a code, an error message. It needs no model, and I can explain every score. On my questions it put "policy and enforcement" at place ' + rk('rare', 'E') + '. It fails when people use other words: "making things up" was at place ' + rk('rare', 'B') + '.'; } },

  { id: 'meaning', seg: 'Meaning', col: 'meaning',
    h1: 'Measure how close two meanings are.',
    ctx: 'Every passage comes with 384 numbers that stand for its meaning, made by a small model. Each question got its 384 numbers the same way. Texts that mean similar things get similar numbers. Multiply the two lists pair by pair and add it all up.',
    guess: { q: function () { return 'Question F ("' + qtext('F') + '") is at place ' + rk('rare', 'F') + ' by its words. By its meaning it will be:'; }, opts: ['Still at place 1', 'In the top 3', 'Outside the top 3'], right: 2 },
    starter: 'def closeness(a, b):\n    # a and b are two lists of numbers, the same length.\n    total = 0\n    # your code: zip(a, b) gives the pairs. For each pair x, y add x * y.\n    return total\n',
    hint: 'for x, y in zip(a, b):\n    total += x * y',
    happened: function () { return '<b>Found ' + found('meaning') + ' of 10.</b> B jumps from place ' + rk('rare', 'B') + ' to ' + rk('meaning', 'B') + ', and D from ' + rk('rare', 'D') + ' to ' + rk('meaning', 'D') + '. But F drops from place ' + rk('rare', 'F') + ' to ' + rk('meaning', 'F') + ', and J from ' + rk('rare', 'J') + ' to ' + rk('meaning', 'J') + '. Neither search wins every question.'; },
    name: 'The 384 numbers are an <b>embedding</b>. What you wrote is the <b>dot product</b>. These numbers are scaled to length 1, so it equals <b>cosine similarity</b>. A <b>vector database</b> does this same sort, made fast.',
    iq: 'Do you need a vector database?',
    ia: function () { return 'Not yet. 183 passages times 384 numbers times 4 bytes is ' + Math.round(INFO.bytes / 1000) + ' KB, and a plain sort is instant. At 100 million passages that is about 154 GB, and then I need an index that skips most of them.'; } },

  { id: 'merge', seg: 'Merge', col: 'merged',
    h1: 'Merge the two lists into one ranking.',
    ctx: 'For each question you have the passages ranked by rare words, and ranked by meaning. Give every passage <code>1 / (60 + place)</code> points from each list, then sort by the total. Places, not scores: a word score and a closeness are not on the same scale.',
    guess: { q: function () { return 'Words found ' + found('rare') + '. Meaning found ' + found('meaning') + '. Merged, how many of 10?'; }, opts: ['10', '9', '7'], right: 2 },
    starter: 'def fuse(by_words, by_meaning):\n    # each list holds passage ids, best first.\n    points = {}\n    for ranked in (by_words, by_meaning):\n        for place, pid in enumerate(ranked, start=1):\n            points[pid] = points.get(pid, 0) + 0      # change the last 0\n    return sorted(points, key=points.get, reverse=True)\n',
    hint: 'points[pid] = points.get(pid, 0) + 1 / (60 + place)',
    happened: function () { return '<b>Found ' + found('merged') + ' of 10</b>, fewer than meaning alone. F and J came back. But B is at place ' + rk('meaning', 'B') + ' by meaning and ' + rk('rare', 'B') + ' by words, so the merge puts it at ' + rk('merged', 'B') + '. D and H fell out the same way.'; },
    name: 'This is <b>reciprocal rank fusion</b> (RRF). Using both searches together is <b>hybrid search</b>.',
    iq: 'Is hybrid search always better?',
    ia: function () { return 'It is the usual default, and I still measure. On my ten questions keyword found ' + found('rare') + ', meaning ' + found('meaning') + ' and the merge ' + found('merged') + ' in the top 3. The merge helped the exact-word questions and hurt the ones asked in other words.'; } },

  { id: 'pick', seg: 'Your call', col: 'pick',
    h1: 'Choose what to send. Find at least 9 of 10.',
    ctx: 'For each question you get both lists, best first. Return the ids to send to the LLM. Every passage you send costs tokens, and no question may send more than 2,000.',
    starter: 'def pick(by_words, by_meaning):\n    # each list holds passage ids, best first.\n    # by_meaning[:3] is its first three. Two lists join with +\n    return by_meaning[:3]\n',
    hint: 'Try: return by_words[:1] + by_meaning[:3]\nThen change the two numbers and watch found and tokens.',
    happened: function () {
      var p = S.pick || {};
      return '<b>Found ' + p.n + ' of 10, sending about ' + num(p.avg) + ' tokens a question.</b> Three passages by meaning found ' + found('meaning') + ' at about ' + num(INFO.meaningTokens) + '. ' +
        (p.n === 10 ? 'All ten. Can you keep ten and send fewer tokens? Change it and run again.' : 'One is still missing. Go on, or change the numbers and run again.') +
        ' More passages find more answers and cost more tokens. Choosing that trade is the job.';
    },
    name: 'How many passages you keep is <b>top-k</b>. Real systems retrieve wide, 50 to 100, then a slower, more careful model reorders them and keeps 5 to 10. That second step is a <b>reranker</b>.',
    iq: 'How do you choose top-k?',
    ia: function () { var p = S.pick || {}; return 'I measure found against tokens. Three passages by meaning found ' + found('meaning') + ' of 10 at about ' + num(INFO.meaningTokens) + ' tokens. My choice found ' + p.n + ' of 10 at about ' + num(p.avg) + '. I stop adding passages when found stops rising.'; } },

  { id: 'prompt', seg: 'Not there', live: true,
    h1: 'Write the prompt that admits when the answer is not there.',
    /* REAL RUN, 21 Nov 2026, GPT-OSS-120B: plain instruction "Answer the question using these passages from our lecture notes."
       answered "Lecture 8" in 2 of 3 runs; with "If they do not answer it, say it is not in the notes." it refused 3 of 3. */
    ctx: function () { return '"' + esc(qtext('X')) + '" No passage covers it, and the search still returns its three nearest. With a plain instruction, the LLM answered "Lecture 8" in 2 of 3 runs.'; },
    guess: { q: function () { return 'The nearest passage to the App Store question has closeness ' + INFO.top.X.toFixed(3) + '. Can a cut-off on closeness refuse it without refusing a real question?'; }, opts: ['Yes', 'No'], right: 1 },
    starter: 'def build_prompt(question, passages):\n    text = ""\n    for p in passages:\n        text += "[" + p["id"] + "] " + p["text"] + "\\n\\n"\n    # your code: add an instruction and the question to text.\n    # Say what to do when the passages do not answer it,\n    # and ask for the [id] of the passage it used.\n    return text\n',
    hint: 'text += "Answer only from these passages. If they do not answer it, say it is not in the notes. Name the [id] you used.\\n\\nQuestion: " + question',
    happened: function () {
      var lo = lowestReal();
      return 'A cut-off cannot do it: the App Store question scores ' + INFO.top.X.toFixed(3) + ', and question ' + lo.id + ', which has an answer, scores ' + lo.top.toFixed(3) + '. ' +
        (S.live === 'pass' ? '<b>Your instruction did:</b> the LLM said it is not in the notes, and named its passage for question B.' : 'One line in the instruction does. You skipped the live run, so yours is not tested on the LLM yet.');
    },
    name: 'Answering only from the passages is <b>grounding</b>. Naming the passage is a <b>citation</b>. Saying it is not there is <b>abstaining</b>.',
    iq: 'How do you stop it answering when the documents do not cover the question?',
    ia: function () { var lo = lowestReal(); return 'A closeness cut-off did not work: my question with no answer scored ' + INFO.top.X.toFixed(3) + ', above a real one at ' + lo.top.toFixed(3) + '. So the instruction gives the LLM a way out, every answer names its passage id, and I keep questions with no answer in my test set.'; } },

  { id: 'filter', seg: 'Filter',
    h1: 'Filter before you search.',
    ctx: function () { return 'A no-code learner asks: "' + esc(qtext('G')) + '" Lectures 3, 5 and 12 are code-track notes, and they must not get them. Finish <code>can_see</code>.'; },
    guess: { q: 'Search first, then remove what they may not see from the top 3. How many passages are left?', opts: ['3', '1', '0'], right: 2 },
    starter: 'def can_see(passage, track):\n    # track is "code" or "no-code".\n    # CODE_ONLY is [3, 5, 12]: the lectures only the code track may see.\n    # the lecture of a passage is passage["lecture"]\n    return True\n',
    hint: 'return track == "code" or passage["lecture"] not in CODE_ONLY',
    happened: function (r) {
      var x = (r && r.extra && r.extra.top) ? r.extra : S.filter || {};
      var ids = function (l) { var seen = []; (l || []).forEach(function (p) { if (seen.indexOf(p.lecture) < 0) seen.push(p.lecture); }); return (seen.length > 1 ? 'Lectures ' : 'Lecture ') + seen.join(', '); };
      return '<b>Search first, filter after: ' + x.after + ' of 3 left.</b> The top three were all from ' + ids(x.top) + '. <b>Filter first, then search: 3 passages</b> they may see, from ' + ids(x.before) + '. The answer is not in those, so the honest line from the last level does its work. And if you only told the LLM "do not reveal Lecture 5", the Lecture 5 text would still be in the request.';
    },
    name: 'A label on a passage (lecture, track, owner) is <b>metadata</b>. Filtering on it before the search is <b>pre-filtering</b>.',
    iq: 'Why not retrieve everything and tell the model to obey the access rules?',
    ia: function () { return 'The model is not a lock. Text in the prompt can be quoted back. Permission is checked in retrieval, before the search, so the prompt only ever holds what this user may see.'; } },

  { id: 'stage', seg: 'The stage', quiz: true,
    h1: 'Three answers went wrong. Name the stage that failed.',
    ctx: 'Every failure belongs to one place. Find the place before you change anything.',
    cases: function () { return [
      { q: qtext('B'), facts: 'Keyword search. The right passage was at place ' + rk('rare', 'B') + '. The LLM answered from three passages about other things.', right: 0, why: 'The right passage never reached the LLM. Fix the search, not the prompt.' },
      { q: qtext('X'), facts: 'Search by meaning. Nothing in the notes covers it. The LLM answered: "Lecture 8".', right: 1, why: 'There was nothing to find. The prompt let it answer anyway.' },
      { q: 'What is Lecture 6 about?', facts: 'Search by meaning. The top three passages are from Lectures 4, 8 and 9.', right: 2, why: 'The question carries a number. That is get_lecture(6), the tool from Practice set 3.' }
    ]; },
    opts: ['Retrieval', 'Generation', 'Not a search'],
    happened: function () { return '<b>Never found: retrieval.</b> Found, or nothing to find, and still answered wrong: generation. A number, a count, a total: not a search at all, but a lookup or a query.'; },
    name: 'Checking the search and the answer separately is <b>stage-wise evaluation</b>.',
    iq: 'Recall is 90% but the answers are bad. Where do you look?',
    ia: function () { return 'Not at the search: the right passage is arriving. I look at what happens after it: how many passages I send, their order, and whether the prompt lets the LLM answer from outside them.'; } }
];
var END = LEVELS.length;
function lowestReal() { var best = null; 'ABCDEFGHIJ'.split('').forEach(function (id) { if (!best || INFO.top[id] < best.top) best = { id: id, top: INFO.top[id] }; }); return best; }
var txt = function (v, a) { return typeof v === 'function' ? v(a) : v; };

/* ---------- the worker ---------- */
var worker = null, ready = false, dataText = '', waiting = null, runId = 0, onReady = [];
function boot() {
  ready = false;
  worker = new Worker(BASE + 'lab-worker.js' + V);
  worker.onmessage = function (ev) {
    var m = ev.data;
    if (m.type === 'ready') { INFO = m.info; ready = true; onReady.splice(0).forEach(function (f) { f(); }); }
    else if (waiting && m.id === waiting.id) { var w = waiting; waiting = null; clearTimeout(w.timer); m.type === 'result' ? w.ok(m.result) : w.no(new Error(m.message || 'Python stopped.')); }
    else if (m.type === 'fail' && !ready) { $('#ins').textContent = 'Python did not load.'; $('#ctx').textContent = 'Check your connection and reload the page.'; }
  };
  worker.onerror = function () { if (!ready) { $('#ins').textContent = 'Python did not load.'; $('#ctx').textContent = 'Check your connection and reload the page.'; } };
  worker.postMessage({ type: 'init', data: dataText });
}
function runPy(level, code) {
  return new Promise(function (ok, no) {
    var id = ++runId;
    waiting = { id: id, ok: ok, no: no, timer: setTimeout(function () {
      waiting = null; worker.terminate(); boot();
      no(new Error('Your code ran for more than 10 seconds, so it was stopped. Look for a loop that never ends.'));
    }, 10000) };
    worker.postMessage({ type: 'run', id: id, level: level, code: code });
  });
}

/* ---------- the server (level 7 only): one message to the LLM, exactly as built ---------- */
function post(body) {
  var h = { 'content-type': 'application/json' }; if (groqKey) h['x-groq-key'] = groqKey;
  return fetch(API, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) {
    return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* not JSON */ }
      if (!r.ok) { var er = new Error((d && d.message) || 'The server did not answer. Try again.'); er.code = d && d.error; throw er; }
      return d;
    });
  }, function () { throw new Error('No connection. Check your internet and try again.'); });
}

/* ---------- points ---------- */
function points() {
  var p = 0; LEVELS.forEach(function (L) { p += (S.stars[L.id] || 0) * 30; if (S.guess[L.id] && S.guess[L.id].right) p += 10; }); return p;
}
function starsText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

/* ---------- chrome: the bar, the level strip, the scoreboard ---------- */
function reach(i) { return i === 0 || S.done[LEVELS[i - 1].id]; }
function paintChrome() {
  $('#where').textContent = (S.at < END ? 'Level ' + (S.at + 1) + ' of ' + END : 'Done') + ' · ' + points() + ' points';
  $('#segs').innerHTML = LEVELS.map(function (L, i) {
    var st = S.stars[L.id];
    return '<a href="#' + (i + 1) + '" data-i="' + i + '" class="' + (i === S.at ? 'on ' : '') + (S.done[L.id] ? 'done ' : '') + (reach(i) ? 'reach' : '') + '"><i></i><span>' + esc(L.seg) + (st ? ' <em aria-label="' + st + ' of 3 stars">' + starsText(st) + '</em>' : '') + '</span></a>';
  }).join('');
  $$('#segs a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var i = +a.dataset.i; if (reach(i)) go(i); }; });
  $('#back').hidden = S.at === 0;
  paintBoard();
}
var COLS = [['shared', 'Shared'], ['rare', 'Rare'], ['meaning', 'Meaning'], ['merged', 'Merged'], ['pick', 'Yours']];
function paintBoard() {
  if (!INFO) return;
  var cols = COLS.filter(function (c) { return c[0] === 'pick' ? S.pick : S.done[c[0] === 'merged' ? 'merge' : c[0]]; });
  var golden = INFO.questions.filter(function (q) { return 'ABCDEFGHIJ'.indexOf(q.id) >= 0; });
  var head = '<div class="sh"><b>The scoreboard</b><span>' + (cols.length ? 'The place of the right passage. Green is the top 3.' : 'Ten questions. We know which passage answers each one.') + '</span></div>';
  var rows = golden.map(function (q) {
    return '<tr><th scope="row">' + q.id + '</th><td class="q">' + esc(q.q) + '</td>' + cols.map(function (c) {
      if (c[0] === 'pick') { var ok = S.pick.found[q.id]; return '<td class="r ' + (ok ? 'ok' : 'no') + '">' + (ok ? 'yes' : 'no') + '</td>'; }
      var r = rk(c[0], q.id); return '<td class="r ' + (r <= 3 ? 'ok' : 'no') + '">' + r + '</td>';
    }).join('') + '</tr>';
  }).join('');
  var foot = cols.length ? '<tr class="sum"><th></th><td class="q">Found, of 10</td>' + cols.map(function (c) { return '<td class="r">' + (c[0] === 'pick' ? S.pick.n : found(c[0])) + '</td>'; }).join('') + '</tr>' : '';
  $('#board').innerHTML = head + '<div class="tw"><table style="--cols:' + Math.max(1, cols.length) + '"><thead><tr><th></th><th class="q">Question</th>' + cols.map(function (c) { return '<th class="r">' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + foot + '</tbody></table></div>' +
    (S.pick ? '<p class="tok">Yours sends about <b>' + num(S.pick.avg) + '</b> tokens a question (' + S.pick.count + ' passages).</p>' : '');
}

/* ---------- one level ---------- */
var cm = null;
function go(i) { S.at = i; save(); render(); window.scrollTo(0, 0); var h = $('#ins'); if (h) h.focus({ preventScroll: true }); }
function render() {
  paintChrome();
  if (S.at >= END) return renderEnd();
  var L = LEVELS[S.at], h1 = $('#ins');
  h1.textContent = L.h1; h1.className = S.done[L.id] ? '' : 'do';
  $('#ctx').innerHTML = txt(L.ctx);
  $('#given').hidden = !!L.quiz;
  var st = $('#stage'); st.innerHTML = ''; $('#fwd').innerHTML = ''; cm = null;
  if (L.quiz) return renderQuiz(L, st);
  if (L.guess) st.appendChild(guessBox(L));
  var locked = L.guess && !S.guess[L.id];
  var ed = document.createElement('div'); ed.className = 'editor' + (locked ? ' locked' : '');
  ed.innerHTML = '<div class="cmwrap" id="cmwrap"></div>' +
    '<div class="runrow"><button class="btn primary" id="run" type="button">Run</button>' +
    '<button class="btn quiet" id="hintb" type="button">' + (S.hint[L.id] ? 'Hint' : 'Show a hint (costs a star)') + '</button>' +
    '<button class="btn quiet" id="reset" type="button">Start this code again</button><span class="kbd">Ctrl or Cmd + Enter runs it</span></div>' +
    '<pre class="hint" id="hint" hidden></pre><div class="out" id="out" aria-live="polite"></div><div id="live"></div><div id="reveal"></div>';
  st.appendChild(ed);
  cm = CodeMirror($('#cmwrap'), {
    value: S.code[L.id] != null ? S.code[L.id] : L.starter, mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
    viewportMargin: Infinity, readOnly: locked ? 'nocursor' : false,
    extraKeys: { Tab: function (c) { c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'); }, 'Shift-Tab': function (c) { c.indentSelection('subtract'); }, 'Ctrl-Enter': doRun, 'Cmd-Enter': doRun }
  });
  cm.on('change', function () { S.code[L.id] = cm.getValue(); save(); });
  $('#run').onclick = doRun;
  $('#run').disabled = locked;
  $('#hintb').onclick = function () { S.hint[L.id] = true; save(); var h = $('#hint'); h.textContent = L.hint; h.hidden = false; this.textContent = 'Hint'; };
  if (S.hint[L.id]) { $('#hint').textContent = L.hint; }
  $('#reset').onclick = function () { cm.setValue(L.starter); cm.focus(); };
  if (S.done[L.id]) { if (L.live) liveBox(L, null); reveal(L, null); }
}
function guessBox(L) {
  var g = L.guess, mine = S.guess[L.id], box = document.createElement('div');
  box.className = 'guess';
  box.innerHTML = '<p class="gq"><b>Guess first.</b> ' + esc(txt(g.q)) + '</p><div class="chips">' + g.opts.map(function (o, i) {
    return '<button type="button" class="chip' + (mine && mine.i === i ? ' sel' : '') + '" data-i="' + i + '"' + (mine ? ' disabled' : '') + '>' + esc(o) + '</button>';
  }).join('') + '</div>' + (mine ? '<p class="gn">Locked in. You find out when your code passes.</p>' : '');
  $$('.chip', box).forEach(function (b) { b.onclick = function () { S.guess[L.id] = { i: +b.dataset.i, right: +b.dataset.i === g.right }; save(); render(); if (cm) cm.focus(); }; });
  return box;
}
function doRun() {
  var L = LEVELS[S.at], b = $('#run'); if (!b || b.disabled) return;
  if (!ready) { $('#out').innerHTML = '<p class="err">Python is still starting. Try again in a moment.</p>'; return; }
  b.disabled = true; b.textContent = 'Running';
  S.runs[L.id] = (S.runs[L.id] || 0) + 1; save();
  runPy(L.id, cm.getValue()).then(function (r) { showResult(L, r); }, function (e) { $('#out').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; })
    .then(function () { b.disabled = false; b.textContent = 'Run'; });
}
function showResult(L, r) {
  var pass = !r.error && r.tests.length && r.tests.every(function (t) { return t.ok; });
  var html = '';
  if (r.error) html += '<p class="err"><b>Python stopped.</b> ' + esc(r.error) + '</p>';
  if (r.tests.length) html += '<ul class="tests">' + r.tests.map(function (t) { return '<li class="' + (t.ok ? 'ok' : 'no') + '"><span>' + esc(t.name) + '</span>' + (t.note ? '<em>' + esc(t.note) + '</em>' : '') + '</li>'; }).join('') + '</ul>';
  if (r.out) html += '<div class="printed"><b>Printed</b><pre>' + esc(r.out) + '</pre></div>';
  $('#out').innerHTML = html;
  if (L.id === 'pick' && r.extra && r.extra.found) {            // the Yours column follows every valid run; the best passing run is kept
    var p = r.extra, old = S.pick;
    if (!pass && !old) { S.pick = p; paintBoard(); S.pick = null; return; }
    if (pass && (!old || !S.done.pick || p.n > old.n || (p.n === old.n && p.avg <= old.avg))) S.pick = p;
    else if (pass) $('#out').insertAdjacentHTML('beforeend', '<p class="note">This run: found ' + p.n + ' of 10 at about ' + num(p.avg) + ' tokens. Your best is kept on the scoreboard.</p>');
    save();
  }
  if (L.id === 'filter' && r.extra && r.extra.top) { S.filter = r.extra; save(); }
  if (!pass) return;
  if (L.live && S.live !== 'pass') { liveBox(L, r.extra.prompts); if (!S.done[L.id]) return; }
  finish(L, r);
}
function finish(L, r) {
  if (!S.done[L.id]) { S.done[L.id] = true; S.stars[L.id] = 1 + (S.hint[L.id] ? 0 : 1) + ((S.runs[L.id] || 1) <= 3 ? 1 : 0); }
  save(); paintChrome(); $('#ins').className = '';
  reveal(L, r);
}
function reveal(L, r) {
  var g = L.guess, mine = S.guess[L.id], line = '';
  if (g && mine) line = '<p class="verdict ' + (mine.right ? 'ok' : 'no') + '">You guessed "' + esc(g.opts[mine.i]) + '". ' + (mine.right ? 'Right.' : 'It was "' + esc(g.opts[g.right]) + '".') + '</p>';
  var st = S.stars[L.id] || 0;
  $(L.quiz ? '#qreveal' : '#reveal').innerHTML = '<div class="reveal">' +
    '<p class="won"><span class="stars" aria-label="' + st + ' of 3 stars">' + starsText(st) + '</span> Level passed.</p>' + line +
    '<p class="what">' + txt(L.happened, r) + '</p>' +
    '<p class="named"><b>Its name.</b> ' + L.name + '</p>' +
    '<details class="iv"><summary><b>In an interview:</b> ' + esc(L.iq) + '</summary><p class="say">Answer it aloud first. Then compare:</p><p>' + esc(txt(L.ia)) + '</p></details></div>';
  $('#fwd').innerHTML = '<button class="btn primary big" id="next" type="button">' + (S.at === END - 1 ? 'See your two-minute answer' : 'Continue') + '</button>';
  $('#next').onclick = function () { go(S.at + 1); };
}

/* ---------- level 7: the two prompts go to the LLM, on the learner's own key ---------- */
var lastPrompts = null;
function liveBox(L, prompts) {
  if (prompts) lastPrompts = prompts;
  var box = $('#live');
  if (S.live === 'pass' && !prompts) { box.innerHTML = ''; return; }
  if (S.done[L.id] && !lastPrompts) { box.innerHTML = '<p class="note">Press Run to send your prompt to the LLM.</p>'; return; }
  var html = '<div class="livebox"><p><b>Your prompt is built. Now send it to the LLM</b>, once for the App Store question and once for question B.</p>';
  if (!groqKey) html += '<label class="keyl">Your Groq key <input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="gsk_..."></label><p class="small">The same key as on the bench. It stays in this tab and is sent only with your own requests.</p>';
  html += '<div class="runrow"><button class="btn primary" id="send" type="button">Send both</button>' + (S.done[L.id] ? '' : '<button class="btn quiet" id="skip" type="button">No key right now: skip the live run</button>') + '</div><div id="answers" aria-live="polite"></div></div>';
  box.innerHTML = html;
  if ($('#skip')) $('#skip').onclick = function () { S.live = 'skipped'; save(); box.innerHTML = ''; finish(L, null); };
  $('#send').onclick = function () {
    var b = this, k = $('#key');
    if (k) { var v = k.value.trim(); if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) { $('#answers').innerHTML = '<p class="err">A Groq key starts with gsk_. Copy the whole key.</p>'; return; } groqKey = v; }
    b.disabled = true; b.textContent = 'Sending';
    var jobs = [['X', 'The App Store question', 'Passes when it says the notes do not cover it.', function (a) { return NOTIN.test(a); }],
                ['B', 'Question B', 'Passes when it names [L10.s03.1] or [L10.s04.1], the passages that answer it.', function (a) { return /L10\.s0[34]\.1/.test(a); }]];
    var results = [];
    var one = function (i) {
      if (i >= jobs.length) return Promise.resolve();
      var j = jobs[i], pr = lastPrompts[j[0]].prompt;
      return post({ op: 'chat', request: { model: MODEL, messages: [{ role: 'user', content: pr }] } }).then(function (d) {
        var a = d.refused ? '' : (d.raw && d.raw.content) || '';
        results.push({ j: j, prompt: pr, answer: a, ok: !!a && j[3](a), tokens: d.usage && d.usage.prompt_tokens, refused: d.refused });
        return one(i + 1);
      });
    };
    one(0).then(function () {
      try { sessionStorage.setItem(KEYS, groqKey); } catch (e) { /* this tab only */ }
      var all = results.every(function (x) { return x.ok; });
      $('#answers').innerHTML = results.map(function (x) {
        return '<div class="ans ' + (x.ok ? 'ok' : 'no') + '"><p class="at"><b>' + esc(x.j[1]) + '</b> <span>' + (x.ok ? 'pass' : 'fail') + (x.tokens ? ' · ' + num(x.tokens) + ' tokens sent' : '') + '</span></p>' +
          '<p class="aa">' + (x.refused ? 'Groq refused the request: it was too large for the key.' : esc(x.answer)) + '</p><p class="rule">' + esc(x.j[2]) + '</p>' +
          '<details><summary>The prompt you sent, exactly</summary><pre>' + esc(x.prompt) + '</pre></details></div>';
      }).join('') + (all ? '' : '<p class="note">Change your instruction in the code, press Run, then send again.</p>');
      if (all) { S.live = 'pass'; save(); $('#send').hidden = true; if ($('#skip')) $('#skip').hidden = true; finish(L, null); }
    }, function (e) {
      if (e.code === 'need_key') { groqKey = ''; try { sessionStorage.removeItem(KEYS); } catch (x) { /* ignore */ } liveBox(L, null); $('#answers').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; return; }
      $('#answers').innerHTML = '<p class="err">' + esc(e.message) + '</p>';
    }).then(function () { var s = $('#send'); if (s) { s.disabled = false; s.textContent = 'Send both'; } });
  };
}

/* ---------- level 9: three failures, name the stage ---------- */
function renderQuiz(L, st) {
  var cases = L.cases();
  st.innerHTML = '<div class="cases">' + cases.map(function (c, n) {
    var a = S.cases[n];
    return '<div class="case' + (a === c.right ? ' solved' : '') + '" data-n="' + n + '"><p class="cq">' + esc(c.q) + '</p><p class="cf">' + esc(c.facts) + '</p><div class="chips">' +
      L.opts.map(function (o, i) { return '<button type="button" class="chip' + (a === i ? (i === c.right ? ' right' : ' wrong') : '') + '" data-i="' + i + '"' + (a === c.right ? ' disabled' : '') + '>' + esc(o) + '</button>'; }).join('') +
      '</div><p class="cw">' + (a === c.right ? esc(c.why) : a != null ? 'Not that one. Was the right passage ever in front of the LLM?' : '') + '</p></div>';
  }).join('') + '</div><div id="qreveal"></div>';
  $$('.case .chip', st).forEach(function (b) {
    b.onclick = function () {
      var n = +b.closest('.case').dataset.n, i = +b.dataset.i;
      if (i !== cases[n].right) S.wrong = (S.wrong || 0) + 1;
      S.cases[n] = i; save();
      if (cases.every(function (c, m) { return S.cases[m] === c.right; }) && !S.done[L.id]) { S.done[L.id] = true; S.stars[L.id] = Math.max(1, 3 - (S.wrong || 0)); save(); }
      render();
    };
  });
  if (S.done[L.id]) reveal(L, null);
}

/* ---------- the end: the two-minute answer, filled with the learner's own numbers ---------- */
function renderEnd() {
  var p = S.pick || { n: found('meaning'), avg: INFO.meaningTokens }, lo = lowestReal();
  var lines = [
    'My data is ' + INFO.n + ' passages, ' + num(INFO.tokens) + ' tokens. Pasting all of it does not go through: my key takes ' + num(FREE_TPM) + ' tokens a minute.',
    'I kept ten questions whose right passage I knew, and counted how many were found in the top 3.',
    'Keyword search found ' + found('rare') + '. Search by meaning found ' + found('meaning') + '. Merging the two found ' + found('merged') + '.',
    'I chose to send what found ' + p.n + ' of 10, at about ' + num(p.avg) + ' tokens a question.',
    'A closeness cut-off could not catch a question with no answer (' + INFO.top.X.toFixed(3) + ' against a real one at ' + lo.top.toFixed(3) + '), so my prompt says when it is not in the notes and names the passage it used.',
    'Permission is a filter before the search, not an instruction to the LLM.',
    'When an answer is wrong, I first check whether the right passage was found. That tells me which stage to fix.'
  ];
  var total = LEVELS.reduce(function (s, L) { return s + (S.stars[L.id] || 0); }, 0);
  var h1 = $('#ins'); h1.textContent = 'You built retrieval. Now say it in two minutes.'; h1.className = '';
  $('#ctx').textContent = '"Walk me through your RAG project" is asked in almost every interview. These are your numbers. Read it aloud once, then say it without looking.';
  $('#given').hidden = true; $('#fwd').innerHTML = '';
  $('#stage').innerHTML = '<div class="card2"><ol class="defence">' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>' +
    '<div class="runrow"><button class="btn primary" id="copy" type="button">Copy it</button><span class="score">' + points() + ' points · ' + total + ' of ' + END * 3 + ' stars</span></div></div>' +
    '<p class="again"><a href="#" id="again">Start again from level 1</a></p>';
  $('#copy').onclick = function () {
    var b = this, t = lines.join('\n');
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy it'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { b.textContent = 'Select and copy the text'; });
    else b.textContent = 'Select and copy the text';
  };
  $('#again').onclick = function (e) {
    e.preventDefault();
    S = { at: 0, done: {}, code: {}, guess: {}, runs: {}, hint: {}, stars: {}, pick: null, filter: null, live: null, wrong: 0, cases: {} }; save(); render(); window.scrollTo(0, 0);
  };
}

/* ---------- start ---------- */
$('#back').onclick = function (e) { e.preventDefault(); if (S.at > 0) go(S.at - 1); };
fetch(BASE + 'lab-data.json' + V).then(function (r) { if (!r.ok) throw new Error('data'); return r.text(); }).then(function (t) {
  dataText = t; onReady.push(function () { if (S.at > END || !reach(Math.min(S.at, END - 1))) S.at = 0; render(); });
  boot();
}).catch(function () { $('#ins').textContent = 'The lab did not load.'; $('#ctx').textContent = 'Check your connection and reload the page.'; });
})();
