/* RAG Lab (Lecture 14, code track). Nine levels. ONE THING PER SCREEN:
     guess  ->  code (change one marked line)  ->  result (one finding)  ->  say (one interview question, aloud)
   Level 4 opens with the embedding screen (type a sentence, see its 384 numbers, run the model on your laptop).
   Every function goes into one file, rag.py (assets/rag-file.js): the code screen shows it whole and downloads it,
   and a Run is that file, run, with its checks and a few output lines.
   The headline is the instruction (h1.do, coral dot) or the finding (plain h1). Continue is added only when the
   screen's one action is done. No rail, no table, no points (Evals Lab UI rules).
   Python runs in lab-worker.js. Every number shown comes from the worker (INFO), computed on the 183 passages,
   except the facts marked REAL RUN, measured on the live LLM on 21 Nov 2026.
   State: localStorage c8.l14.lab2. The Groq key (level 7 only) lives in sessionStorage c8.l11.key, shared with the benches. */
(function () {
'use strict';
var BASE = '/c8/module-2/lecture-14-building-rag-apps/assets/', V = '?v=5';
var API = '/api/retrieve', MODEL = 'openai/gpt-oss-120b', KEYS = 'c8.l11.key', STORE = 'c8.l14.lab3';
var CODE_DIR = '/c8/module-2/lecture-14-building-rag-apps/code/';
var GH = 'https://github.com/Siddhant-Goswami/C8-RAG/tree/main/module3_build_the_search';
var HF = 'https://huggingface.co/thenlper/gte-small';
var TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6', EMBED = 'Xenova/gte-small';   /* the bench's model, in the browser */
var RF = window.RAGFILE, PART = {}; RF.PARTS.forEach(function (p) { PART[p.id] = p; });
var FREE_TPM = 8000;
/* the bench's own rule for "it says the notes do not cover it" (bench.js RULES.Q4), unchanged */
var NOTIN = /(passages|notes|context)[^.]{0,50}\b(do not|don['’]t|does not|doesn['’]t|did not|didn['’]t|not)\s+(contain|include|mention|cover|say|describe|provide|address|state|specify|discuss|show|explain|teach)|\bnone of (the|these|our) (passages|notes|lectures)\b[^.]{0,40}\b(mention|cover|show|explain|describe|address|discuss|teach)|\bno lecture\b|\b(not|n['’]t)\s+(in|part of|covered (in|by)|mentioned in)\s+(the|our|my|your|these)\s+(notes|passages)|\bno (information|mention|details?|lecture)\b[^.]{0,40}\b(in|from|within)\s+(the|our|these)\s+(notes|passages)/i;

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var num = function (n) { return Number(n).toLocaleString('en-US'); };
var txt = function (v, a) { return typeof v === 'function' ? v(a) : v; };

/* ---------- state ---------- */
var BLANK = function () { return { started: false, lv: 0, beat: 0, done: {}, code: {}, passed: {}, out: {}, embedded: false, built: false, guess: {}, runs: {}, hint: {}, stars: {}, said: {}, pick: null, filter: null, live: null, answers: null, cases: {}, wrong: 0 }; };
var S = BLANK();
try { var saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved && typeof saved === 'object') for (var k in S) if (saved[k] != null) S[k] = saved[k]; } catch (e) { /* start fresh */ }
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* memory only */ } }
var groqKey = ''; try { groqKey = sessionStorage.getItem(KEYS) || ''; } catch (e) { /* asked when needed */ }

var INFO = null;
var GOLD = 'ABCDEFGHIJ'.split('');
var rk = function (m, q) { return INFO.board[m][q]; };
var found = function (m) { return GOLD.filter(function (q) { return INFO.board[m][q] <= 3; }).length; };
var qobj = function (id) { return INFO.questions.filter(function (q) { return q.id === id; })[0]; };
var qtext = function (id) { return qobj(id).q; };
var DATA = null, PBY = {};          /* the passages, parsed in the page too: titles, texts and numbers for the pictures */
var qcard = function (id, text) { return '<div class="qcard"><span class="ql">' + id + '</span><p>' + esc(text || qtext(id)) + '</p></div>'; };
function lowestReal() { var best = null; GOLD.forEach(function (id) { if (!best || INFO.top[id] < best.top) best = { id: id, top: INFO.top[id] }; }); return best; }
var METHOD = { shared: 'Shared words', rare: 'Rare words', meaning: 'Meaning', merged: 'Merged', pick: 'Yours' };

/* ---------- the levels: every string is one short thing ---------- */
var LEVELS = [
  { id: 'count', seg: 'Count',
    guess: { h: 'You paste all 183 passages of our notes with one question. What comes back?', opts: ['The right answer', 'A wrong answer', 'A refusal'], right: 2 },
    h1: 'Add up the tokens of every passage.',
    ctx: 'Write your code where the marked line is. Then press Run.',

    hint: 'for p in passages:\n    total = total + p["tokens"]',
    res: function () { return num(INFO.tokens) + ' tokens. Refused.'; },
    vis: function () { var pct = Math.round(100 * FREE_TPM / INFO.tokens); return '<div class="meter" role="img" aria-label="' + num(INFO.tokens) + ' tokens against a limit of ' + num(FREE_TPM) + '"><div class="mbar"><i style="width:' + pct + '%"></i></div><p><b>' + num(FREE_TPM) + '</b> a minute is all a free Groq key takes. The notes are <b>' + num(INFO.tokens) + '</b>.</p></div>'; },
    note: 'So a question can carry a few passages, never all 183.',
    name: 'The most one question may send is its <b>token budget</b>.',
    iq: 'Context windows hold a million tokens now. Why build RAG?',
    asked: [{ at: 'Cursor', q: 'Long context windows keep getting cheaper. Why not drop retrieval and stuff the whole repo into context for every request?', s: 'gh' }, { at: 'Moonshot AI (Kimi)', q: 'For a long-context assistant, when is a 1M-token context window the right tool, and when should you use retrieval instead?', s: 'gh' }],
    ia: function () { return 'The window is not the limit I hit first. My notes are ' + num(INFO.tokens) + ' tokens and fit in any window, but every question would pay for all of them, and my key allows ' + num(FREE_TPM) + ' a minute. So I send the few passages that matter.'; } },

  { id: 'shared', seg: 'Shared words', rows: ['shared'],
    h1: 'Score a passage by the words it shares with the question.',
    ctx: 'The three best-scoring passages go to the LLM. Change the marked line.',

    hint: 'q & p is the set of words that are in both.\nreturn len(q & p)',
    res: function () { return 'Found ' + found('shared') + ' of 10.'; },
    note: 'Ten questions, and we know the right passage for each. Green: it landed in the top 3. Every word counts the same here, so "the" weighs as much as "forgets".',
    name: 'Ten questions with known answers are a <b>golden set</b>. "Found in the top 3" is <b>recall@3</b>.',
    iq: 'How do you know your retrieval works?',
    asked: [{ at: 'Google', q: 'Evaluate retrieval precision and recall separately from generation quality.', s: 'gg' }, { at: 'Meta', via: 'PracHub', q: 'How would you measure whether adding retrieval improved an LLM product?', s: 'ss' }],
    ia: function () { return 'I keep a small set of questions where I know which passage holds the answer. After every change I count how often that passage lands in the top 3. Counting shared words found ' + found('shared') + ' of 10. That number is where I started.'; } },

  { id: 'rare', seg: 'Rare words', rows: ['shared', 'rare'],
    guess: { h: 'If rare words count more, how many of the 10 will it find?', ctx: function () { return 'Counting shared words found ' + found('shared') + ' of 10.'; }, opts: ['6', '8', '10'], right: 0 },
    h1: 'Make rare words count more.',
    ctx: function () { return '"lecture" is in ' + INFO.seen.lecture + ' passages. "law" is in ' + INFO.seen.law + '. On the marked line, replace the 1 with <code>math.log(N / seen_in(w))</code>.'; },

    hint: 'total += math.log(N / seen_in(w))\nseen_in(w) is how many passages contain w. N is the number of passages.',
    res: function () { return 'Found ' + found('rare') + ' of 10.'; },
    note: function () { return 'B is still at place ' + rk('rare', 'B') + '. The question says "making things up". The notes say "hallucinate". Counting words cannot know those mean the same.'; },
    name: 'This is the core of <b>BM25</b>, the keyword search inside most search boxes.',
    iq: 'When is keyword search the right choice?',
    asked: [{ at: 'Microsoft, Perplexity, Glean', q: 'How do you choose between a sparse retriever (BM25) and a dense retriever? When do you need both?', s: 'gh' }],
    ia: function () { return 'When the question carries the exact word: a name, a code, an error message. It needs no model, and I can explain every score. It fails when people use other words: "making things up" was at place ' + rk('rare', 'B') + '.'; } },

  { id: 'meaning', seg: 'Meaning', rows: ['rare', 'meaning'], embed: true,
    guess: { h: 'Search by meaning: where will this question land?', about: 'F', ctx: function () { return 'By its words it is at place ' + rk('rare', 'F') + '.'; }, opts: ['Still at place 1', 'In the top 3', 'Outside the top 3'], right: 2 },
    h1: 'Measure how close two meanings are.',
    ctx: 'Two texts, two lists of 384 numbers. Multiply them pair by pair, then add up all 384 products.',
    pre: function () { return pairs(); },
    hint: 'for x, y in zip(a, b):\n    total += x * y',
    res: function () { return 'Found ' + found('meaning') + ' of 10.'; },
    note: 'B and D are found now. F and J, which words found, are lost. Neither search wins every question.',
    name: 'What you wrote is <b>cosine similarity</b>: the closeness of two embeddings. A <b>vector database</b> does this same sort over millions of passages, made fast.',
    iq: 'Do you need a vector database?',
    asked: [{ at: 'Cohere', q: 'An enterprise wants semantic search over ~100M documents but is balking at vector-index cost. Walk me through embedding compression options and the maths.', s: 'gh' }],
    ia: function () { return 'Not yet. 183 passages times 384 numbers times 4 bytes is ' + Math.round(INFO.bytes / 1000) + ' KB, and a plain sort is instant. At 100 million passages that is about 154 GB, and then I need an index that skips most of them.'; } },

  { id: 'merge', seg: 'Merge', rows: ['meaning', 'merged'],
    guess: { h: 'Merge both lists into one. How many of the 10 will it find?', ctx: function () { return 'Rare words found ' + found('rare') + '. Meaning found ' + found('meaning') + '.'; }, opts: ['10', '9', '7'], right: 2 },
    h1: 'Merge the two lists into one.',
    ctx: 'A passage gets <code>1 / (60 + place)</code> points from each list. On the marked line, change the last 0.',

    hint: 'points[pid] = points.get(pid, 0) + 1 / (60 + place)',
    res: function () { return 'Found ' + found('merged') + ' of 10. Worse than meaning alone.'; },
    note: function () { return 'B is at place ' + rk('meaning', 'B') + ' by meaning and ' + rk('rare', 'B') + ' by words. Merged, it lands at ' + rk('merged', 'B') + '.'; },
    name: 'This is <b>reciprocal rank fusion</b> (RRF). Using both searches is <b>hybrid search</b>.',
    iq: 'Is hybrid search always better?',
    asked: [{ at: 'Glean', via: 'techinterview.org, 2026', q: 'Compare BM25 and dense retrieval. When does each win, and why is neither sufficient alone?', s: 'ss' }, { at: 'Google', q: 'Compare dense and sparse retrieval; build and tune a hybrid system for low latency.', s: 'gg' }],
    ia: function () { return 'It is the usual default, and I still measure. On my ten questions keyword found ' + found('rare') + ', meaning ' + found('meaning') + ' and the merge ' + found('merged') + ' in the top 3. The merge helped the exact-word questions and hurt the ones asked in other words.'; } },

  { id: 'pick', seg: 'Your call', rows: ['meaning', 'pick'],
    h1: 'Choose what to send. Find at least 9 of 10.',
    ctx: 'You get both lists, best first. More passages find more answers and cost more tokens. Change the marked line.',

    hint: 'return by_words[:1] + by_meaning[:3]\nThen change the two numbers and run again.',
    res: function () { return 'Found ' + S.pick.n + ' of 10, at about ' + num(S.pick.avg) + ' tokens.'; },
    note: function () { return 'Meaning alone found ' + found('meaning') + ' at about ' + num(INFO.meaningTokens) + ' tokens. You paid more tokens to find more.'; },
    again: 'Try for a better trade',
    name: 'How many passages you keep is <b>top-k</b>. Real systems fetch 50 to 100, then a slower model reorders them and keeps 5 to 10: a <b>reranker</b>.',
    iq: 'How do you choose top-k?',
    asked: [{ at: 'Cohere', q: 'You have an embedding model and a reranker. Why sell both? Design the two-stage retrieval pipeline and tell me when the reranker earns its latency.', s: 'gh' }, { at: 'Amazon', via: 'PracHub', q: 'What is a reranker model, and where does it sit in the RAG stack?', s: 'ss' }],
    ia: function () { return 'I measure found against tokens. Three passages by meaning found ' + found('meaning') + ' of 10 at about ' + num(INFO.meaningTokens) + ' tokens. My choice found ' + S.pick.n + ' of 10 at about ' + num(S.pick.avg) + '. I stop adding passages when found stops rising.'; } },

  { id: 'prompt', seg: 'Not there', live: true,
    guess: { h: 'Can a closeness cut-off refuse this question, without refusing a real one?', about: 'X', ctx: function () { return 'Nothing in our notes covers the App Store. Its nearest passage still has closeness ' + INFO.top.X.toFixed(3) + '.'; }, opts: ['Yes', 'No'], right: 1 },
    h1: 'Write a prompt that admits when the answer is not there.',
    /* REAL RUN, 21 Nov 2026, GPT-OSS-120B: with "Answer the question using these passages from our lecture notes." it answered
       "Lecture 8" in 2 of 3 runs; with "If they do not answer it, say it is not in the notes." it refused 3 of 3. */
    ctx: 'With a plain instruction, the LLM answered "Lecture 8" in 2 of 3 runs. Add your instruction and the question on the marked line.',

    hint: 'text += "Answer only from these passages. If they do not answer it, say it is not in the notes. Name the [id] you used.\\n\\nQuestion: " + question',
    res: function () { return S.live === 'pass' ? 'It said: not in the notes.' : 'Not tested on the LLM yet.'; },
    note: function () { var lo = lowestReal(); return 'A cut-off cannot do this. The App Store question scores ' + INFO.top.X.toFixed(3) + '. Question ' + lo.id + ', which has an answer, scores ' + lo.top.toFixed(3) + '. One line in the instruction does.'; },
    name: 'Answering only from the passages is <b>grounding</b>. Naming the passage is a <b>citation</b>. Saying it is not there is <b>abstaining</b>.',
    iq: 'How do you stop it answering when the documents do not cover the question?',
    asked: [{ at: 'Microsoft', via: 'Glassdoor, 2026', q: 'What are hallucinations, and how do you avoid them?', s: 'ss' }, { at: 'Anthropic, OpenAI, Cursor', q: 'How do you detect and measure hallucinations in a production RAG system?', s: 'gh' }],
    ia: function () { var lo = lowestReal(); return 'A closeness cut-off did not work: my question with no answer scored ' + INFO.top.X.toFixed(3) + ', above a real one at ' + lo.top.toFixed(3) + '. So the instruction gives the LLM a way out, every answer names its passage id, and I keep questions with no answer in my test set.'; } },

  { id: 'filter', seg: 'Filter',
    guess: { h: 'Search first, then remove the code-track passages from the top 3. How many are left?', about: 'G', ctx: 'A no-code learner asks this. They must not get code-track notes.', opts: ['3', '1', '0'], right: 2 },
    h1: 'Let a learner see only what their track may see.',
    ctx: 'Lectures 3, 5 and 12 are code-track notes. Change the marked line.',

    hint: 'return track == "code" or passage["lecture"] not in CODE_ONLY',
    res: function () { return 'Search, then filter: ' + S.filter.after + ' of 3 left.'; },
    vis: function () {
      var x = S.filter, row = function (label, list, cut) { return '<div class="frow"><span>' + label + '</span><div>' + list.map(function (p) { return '<i class="' + (cut ? 'cut' : 'ok') + '">Lecture ' + p.lecture + '</i>'; }).join('') + '</div></div>'; };
      return '<div class="fvis">' + row('Search, then filter', x.top, true) + row('Filter, then search', x.before, false) + '</div>';
    },
    note: 'Filter first. And telling the LLM "do not reveal Lecture 5" is not a filter: the text is still in the request.',
    name: 'A label on a passage is <b>metadata</b>. Filtering on it before the search is <b>pre-filtering</b>.',
    iq: 'Why not retrieve everything and tell the model to obey the access rules?',
    asked: [{ at: 'OpenAI', via: 'PracHub', q: 'Why is it wrong to retrieve globally and tell the generator to obey access rules?', s: 'ss' }, { at: 'Microsoft, Databricks, Glean, Palantir', q: 'Design permission-aware retrieval: users must never see content they can\'t access in the source system.', s: 'gh' }],
    ia: function () { return 'The model is not a lock. Text in the prompt can be quoted back. Permission is checked in retrieval, before the search, so the prompt only ever holds what this user may see.'; } },

  { id: 'stage', seg: 'Which part failed', quiz: true,
    cases: function () { return [
      { q: qtext('B'), facts: 'Keyword search. The right passage was at place ' + rk('rare', 'B') + ', so the LLM never saw it.', right: 0, why: 'The right passage never reached the LLM. Fix the search, not the prompt.' },
      { q: qtext('X'), facts: 'Nothing in the notes covers it. The LLM answered: "Lecture 8".', right: 1, why: 'There was nothing to find. The prompt let it answer anyway.' },
      { q: 'What is Lecture 6 about?', facts: 'Search by meaning returned passages from Lectures 4, 8 and 9.', right: 2, why: 'The question carries a number. That is get_lecture(6), the tool from Practice set 3.' }
    ]; },
    opts: ['The search', 'The answer', 'It is not a search'],
    iq: 'Recall is 90% but the answers are bad. Where do you look?',
    asked: [{ at: 'Cohere', q: 'A customer 10x\'d their indexed documents and reports answer quality "got noticeably worse." Drive the investigation.', s: 'gh' }, { at: 'Databricks', via: 'Dataford', q: 'Tell me about a time a RAG system lost customer trust. How did you diagnose and fix it?', s: 'ss' }],
    ia: function () { return 'Not at the search: the right passage is arriving. I look at what happens after it: how many passages I send, their order, and whether the prompt lets the LLM answer from outside them.'; } }
];
var END = LEVELS.length;
LEVELS.forEach(function (L) { if (PART[L.id]) L.starter = PART[L.id].starter; });
function beats(L) {
  if (L.quiz) return ['case0', 'case1', 'case2', 'say'];
  return (L.embed ? ['embed'] : []).concat(L.guess ? ['guess'] : [], ['code'], L.live ? ['live'] : [], ['result', 'say']);
}

/* ---------- the worker ---------- */
var worker = null, ready = false, dataText = '', waiting = null, runId = 0, onReady = [];
function loadFail() { $('#ins').textContent = 'Python did not load.'; $('#ins').className = ''; $('#ctx').textContent = 'Check your connection and reload the page.'; $('#stage').innerHTML = ''; $('#fwd').innerHTML = ''; }
function boot() {
  ready = false;
  worker = new Worker(BASE + 'lab-worker.js' + V);
  worker.onmessage = function (ev) {
    var m = ev.data;
    if (m.type === 'ready') { INFO = m.info; ready = true; onReady.splice(0).forEach(function (f) { f(); }); }
    else if (waiting && m.id === waiting.id) { var w = waiting; waiting = null; clearTimeout(w.timer); m.type === 'result' ? w.ok(m.result) : w.no(new Error(m.message || 'Python stopped.')); }
    else if (m.type === 'fail' && !ready) loadFail();
  };
  worker.onerror = function () { if (!ready) loadFail(); };
  worker.postMessage({ type: 'init', data: dataText });
}
function runPy(level, code) {
  return new Promise(function (ok, no) {
    var id = ++runId;
    waiting = { id: id, ok: ok, no: no, timer: setTimeout(function () {
      waiting = null; worker.terminate(); boot();
      no(new Error('Your code ran for more than 10 seconds, so it was stopped. Look for a loop that never ends.'));
    }, 10000) };
    worker.postMessage({ type: 'run', id: id, level: level, code: code, given: givenParts(level) });
  });
}

/* the functions of the levels before this one, as they were when they passed: the rest of rag.py */
function givenParts(id) {
  var out = [];
  RF.PARTS.some(function (p) { if (p.id === id) return true; if (S.passed[p.id] != null) out.push([p.id, S.passed[p.id]]); return false; });
  return out;
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

/* ---------- moving ---------- */
function reach(i) { return i === 0 || !!S.done[LEVELS[i - 1].id]; }
function go(lv, beat) { S.lv = lv; S.beat = beat || 0; save(); render(); window.scrollTo(0, 0); var h = $('#ins'); if (h) h.focus({ preventScroll: true }); }
function next() { var n = beats(LEVELS[S.lv]).length; if (S.beat + 1 < n) go(S.lv, S.beat + 1); else go(S.lv + 1, 0); }
function back() {
  if (S.lv >= END) return go(END - 1, beats(LEVELS[END - 1]).length - 1);
  if (S.beat > 0) return go(S.lv, S.beat - 1);
  if (S.lv > 0) return go(S.lv - 1, beats(LEVELS[S.lv - 1]).length - 1);
  S.started = false; save(); render();
}
function forward(label) {
  $('#fwd').innerHTML = '<button class="btn primary big" id="next" type="button">' + (label || 'Continue') + '</button>';
  $('#next').onclick = next;
}
function starsText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
function totalStars() { return LEVELS.reduce(function (s, L) { return s + (S.stars[L.id] || 0); }, 0); }
function finishLevel(L) {
  if (S.done[L.id]) return;
  S.done[L.id] = true;
  S.stars[L.id] = L.quiz ? Math.max(1, 3 - (S.wrong || 0)) : 1 + (S.hint[L.id] ? 0 : 1) + ((S.runs[L.id] || 1) <= 3 ? 1 : 0);
  save();
}

/* ---------- the bar ---------- */
function paintBar() {
  var intro = !S.started, L = LEVELS[S.lv];
  $('#where').textContent = intro ? '' : S.lv >= END ? 'Done · ' + totalStars() + ' of ' + END * 3 + ' stars' : 'Level ' + (S.lv + 1) + ' of ' + END + ' · ' + L.seg;
  $('#segs').innerHTML = LEVELS.map(function (x, i) {
    return '<a href="#" data-i="' + i + '" title="' + esc(x.seg) + '" aria-label="Level ' + (i + 1) + ': ' + esc(x.seg) + '" class="' + (!intro && i === S.lv ? 'on ' : '') + (S.done[x.id] ? 'done ' : '') + (!intro && reach(i) ? 'reach' : '') + '"><i></i></a>';
  }).join('');
  $$('#segs a').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var i = +a.dataset.i; if (S.started && reach(i)) go(i, 0); }; });
  $('#back').hidden = intro;
}
function head(h1, isDo, ctx) {
  var h = $('#ins'); h.textContent = h1; h.className = isDo ? 'do' : '';
  $('#ctx').innerHTML = ctx || '';
  $('#stage').innerHTML = ''; $('#fwd').innerHTML = '';
}

/* ---------- screens ---------- */
function render() {
  if (!INFO) return intro();                 // Python is still loading: the brief is what there is to read
  paintBar();
  if (!S.started) return intro();
  if (S.lv >= END) return theEnd();
  var L = LEVELS[S.lv], b = beats(L)[S.beat];
  if (b === 'embed') return embedScreen(L);
  if (b === 'guess') return guess(L);
  if (b === 'code') return code(L);
  if (b === 'live') return live(L);
  if (b === 'result') return result(L);
  if (b === 'say') return say(L);
  return oneCase(L, +b.slice(4));
}

/* the brief: one visual page. The flow (question, your search, top 3, LLM), then the ten questions on the pile:
   pick a letter, see the passage that must reach the LLM, with the answer line marked. Then the four screens and the nine levels.
   The ten questions repeat _plan/lecture-14/questions.json (A and B are the Retrieval Bench's Q2 and Q3).
   It draws from lab-data.json as soon as that arrives, before Python is ready. Classes avoid docs.css names (.steps, .tw, .rt). */
var L13 = '/c8/module-2/lecture-13-retrieval-augmented-generation/';
var LECT = [null,
  ['Orientation and State of AI 2026', 'lecture-01-orientation/notes'], ['What is an interface', 'lecture-02-what-is-an-interface/notes'],
  ['Building UI', 'lecture-03-building-ui/notes'], ['API as the second interface', 'lecture-04-the-second-interface/post-lecture/notes'],
  ['Building APIs and backend', 'lecture-05-building-apis/notes'], ['Databases and domain modelling', 'lecture-06-databases-and-domain-modelling/notes'],
  ['Connect backend to database', 'lecture-07-connect-backend-to-the-database/notes'], ['End to end MVP', 'lecture-08-end-to-end-mvp/notes'],
  ['LLMs from first principles', 'lecture-09-llms-from-first-principles/notes'], ['Tool calling and MCP', 'lecture-10-tool-calling-and-mcp/notes'],
  ['Tool calling and MCP (practical)', 'lecture-11-tool-calling-and-mcp/notes'], ['Building with tool calling and MCP', 'lecture-12-building-with-tool-calling-and-mcp/notes']];
var noteUrl = function (p) { return '/c8/module-2/' + LECT[p.lecture][1] + '#' + p.id.split('.')[1]; };
/* each question, the passages that hold its answer (gold) and, per passage, the exact words that answer it (a string or a list) */
var TEN = [
  { id: 'A', q: 'Which lecture teaches Verifier’s Law?', bench: 'Q2', gold: ['L1.s05.1', 'L1.s14.1'], mark: ["The Verifier's Law: if you cannot write the verifier, you cannot build the system, and you cannot claim the capability.", "The Verifier's Law"] },
  { id: 'B', q: 'Why is the model making things up?', bench: 'Q3', gold: ['L10.s03.1', 'L10.s04.1'], mark: ["it isn't trained to say no; output is mandatory, so it fills gaps", 'Hallucination = missing context + a trained habit of never saying no.'] },
  { id: 'C', q: 'What does the reply code 405 mean?', gold: ['L4.s02.2'], mark: ['405 This door takes CREATE, READ · An UPDATE or DELETE sent to the diagnosis door'] },
  { id: 'D', q: 'My app forgets what the user told it yesterday. Why?', gold: ['L6.s04.1'], mark: ['Every request starts from nothing.'] },
  { id: 'E', q: 'What is the difference between policy and enforcement?', gold: ['L7.s07.2'], mark: ['"Wear a helmet on a two-wheeler" is policy. The traffic police on the road is enforcement.'] },
  { id: 'F', q: 'What goes wrong when two people save at the same moment?', gold: ['L8.s06.1'], mark: ['Both read, both write, one plan is lost. A race condition.'] },
  { id: 'G', q: 'How many requests per minute does Groq’s free tier allow?', gold: ['L5.s09.1'], mark: ['30 requests per minute'] },
  { id: 'H', q: 'Where should the secret for the LLM live so that a user cannot steal it?', gold: ['L7.s01.1', 'L7.s05.1', 'L7.s09.1'], mark: ['the key sits in an environment variable there', "If the key is in Aarav's browser, Aarav can take it, share it, and spend your credits.", 'The key lives on the machine that spends the money.'] },
  { id: 'I', q: 'Who are the host, the client and the server?', gold: ['L11.s12.1'], mark: [['Host · The AI app Priya uses: Claude Desktop, Antigravity, or one you built · Holds the model and runs the conversation', 'Client · A piece inside the host, one per server · Asks the server which tools it has, carries each request, brings back the result', 'Server · The program next to the data · Offers the tools, validates, calls the Sheets API, returns the rows']] },
  { id: 'J', q: 'What does CRUD stand for?', gold: ['L4.s04.1'], mark: ['Create, Read, Update, Delete, or CRUD'] },
  { id: 'X', q: 'Which lecture shows how to put our app on the App Store?', gold: [], mark: [] }
];
var PASS = null, BYID = {}, GOLDOF = {};
TEN.forEach(function (t) { t.gold.forEach(function (g) { GOLDOF[g] = t.id; }); });
var BRIEF = { q: 'A', gi: 0, open: null };   /* the picked question, which of its passages, or a passage opened by a tap */
function markText(text, marks) {
  var t = esc(text);
  (marks || []).forEach(function (m) { var e = esc(m), i = t.indexOf(e); if (i >= 0) t = t.slice(0, i) + '<mark>' + e + '</mark>' + t.slice(i + e.length); });
  return t.replace(/\n/g, '<br>');
}
function drawTen() {
  var box = $('#tenbox'); if (!box) return;
  var Q = TEN.filter(function (t) { return t.id === BRIEF.q; })[0];
  var pickTiles = '<div class="qpk" role="tablist" aria-label="The ten questions">' + TEN.map(function (t) {
    return '<button type="button" role="tab" class="tile' + (t.id === 'X' ? ' nx' : '') + (t.id === BRIEF.q ? ' on' : '') + '" data-q="' + t.id + '" aria-selected="' + (t.id === BRIEF.q) + '" aria-label="Question ' + t.id + '">' + t.id + '</button>';
  }).join('') + '</div>';
  var qline = '<div class="qbig"><span class="tile ' + (Q.gold.length ? 'ok' : 'nx') + '">' + Q.id + '</span><p>' + esc(Q.q) +
    (Q.bench ? ' <a class="qb" href="' + L13 + 'bench">Bench ' + Q.bench + '</a>' : '') + '</p></div>';
  if (!PASS) { box.innerHTML = pickTiles + qline + '<p class="small">Getting the notes ready.</p>'; bindTen(box); return; }
  var openId = BRIEF.open || Q.gold[BRIEF.gi] || null;
  var strips = '<div class="strips" aria-label="The 183 passages, one row per lecture">' + LECT.slice(1).map(function (l, i) {
    var n = i + 1;
    return '<div class="strip"><a class="ln" href="/c8/module-2/' + l[1] + '" target="_blank" rel="noopener" title="Lecture ' + n + ': ' + esc(l[0]) + '">L' + n + '</a><div class="blocks">' +
      PASS.filter(function (p) { return p.lecture === n; }).map(function (p) {
        var g = GOLDOF[p.id], cls = 'blk' + (g ? (g === Q.id ? ' gq' : ' ga') : '') + (p.id === openId ? ' pick' : '');
        return '<button type="button" class="' + cls + '" style="flex-grow:' + p.tokens + '" data-id="' + p.id + '" title="Lecture ' + n + ' · ' + esc(p.title) + (g ? ' · answers ' + g : '') + '">' + (g ? '<i>' + g + '</i>' : '') + '</button>';
      }).join('') + '</div></div>';
  }).join('') + '</div>' +
    '<p class="legend">' + (Q.gold.length ? '<span><i class="lg gq"></i>answers ' + Q.id + '</span>' : '') + '<span><i class="lg ga"></i>answers another question</span><span><i class="lg"></i>one passage, sized by its tokens</span></p>';
  var card;
  if (!openId) {
    card = '<div class="pcard none"><p class="ph"><b>No passage answers this.</b></p><p class="ptx">Nothing in Lectures 1 to 12 covers the App Store. Here, the right reply is “it is not in the notes”. You make the LLM say that in level 7.</p></div>';
  } else {
    var p = BYID[openId], g = GOLDOF[openId], mine = g === Q.id && !BRIEF.open;
    var tq = g ? TEN.filter(function (t) { return t.id === g; })[0] : null;
    var marks = tq ? [].concat(tq.mark[tq.gold.indexOf(openId)]) : [];
    var multi = mine && Q.gold.length > 1 ? '<div class="gsw" role="group" aria-label="Passages that answer ' + Q.id + '">' + Q.gold.map(function (id, i) {
      return '<button type="button" data-gi="' + i + '" class="' + (i === BRIEF.gi ? 'on' : '') + '">' + (i + 1) + '. ' + esc(BYID[id].title) + '</button>';
    }).join('') + '<span>' + (Q.gold.length > 2 ? 'Any one' : 'Either one') + ' in the top 3 counts.</span></div>' : '';
    card = multi + '<div class="pcard' + (g ? ' gold' : '') + '"><p class="ph">' +
      (g ? '<span class="tag">Answers ' + g + '</span>' : '<span class="tag plain">Not an answer</span>') +
      '<b>Lecture ' + p.lecture + '</b> · ' + esc(p.title) + ' · ' + p.tokens + ' tokens <a href="' + noteUrl(p) + '" target="_blank" rel="noopener">Open in the notes</a></p>' +
      '<p class="ptx">' + markText(p.text, marks) + '</p>' +
      (g ? '<p class="pnote"><mark>Marked</mark> the words that answer ' + g + '. This whole passage is what your search must send.</p>' : '<p class="pnote">' + (BRIEF.open ? '<a href="#" id="backq">Back to ' + Q.id + (Q.gold.length ? '’s passage' : '') + '</a>' : '') + '</p>') + '</div>';
  }
  box.innerHTML = pickTiles + qline + strips + card;
  bindTen(box);
}
function bindTen(box) {
  $$('.qpk .tile', box).forEach(function (b) { b.onclick = function () { BRIEF = { q: b.dataset.q, gi: 0, open: null }; drawTen(); }; });
  $$('.blk', box).forEach(function (b) {
    b.onclick = function () {
      var id = b.dataset.id, g = GOLDOF[id];
      if (g) { var t = TEN.filter(function (x) { return x.id === g; })[0]; BRIEF = { q: g, gi: t.gold.indexOf(id), open: null }; }
      else BRIEF.open = id;
      drawTen();
    };
  });
  $$('.gsw button', box).forEach(function (b) { b.onclick = function () { BRIEF.gi = +b.dataset.gi; BRIEF.open = null; drawTen(); }; });
  var bq = $('#backq', box); if (bq) bq.onclick = function (e) { e.preventDefault(); BRIEF.open = null; drawTen(); };
}
function intro() {
  head('Build the search behind RAG.', false,
    'An LLM can only answer from what you send it. You write the Python that picks the 3 passages of our notes it gets.');
  $('#back').hidden = true;
  var flow = '<div class="flow" role="img" aria-label="A question goes to your search, which picks the best 3 of 183 passages. Those 3 go to the LLM, which answers from them.">' +
    '<div class="fn"><span class="fk">Question</span><b>“Why is the model making things up?”</b></div><i class="fa" aria-hidden="true"></i>' +
    '<div class="fn you"><span class="fk">Your search</span><b>Ranks all 183 passages</b><em>you write this</em></div><i class="fa" aria-hidden="true"></i>' +
    '<div class="fn"><span class="fk">Best 3</span><div class="slots"><s></s><s class="ok">L10</s><s></s></div></div><i class="fa" aria-hidden="true"></i>' +
    '<div class="fn llm"><span class="fk">LLM</span><b>Answers from those 3</b></div></div>' +
    '<p class="fcap">The right passage made the best 3, so this question scores. Ten questions: a score out of 10.</p>';
  var mini = function (tag, h, line, art) { return '<li><div class="art">' + art + '</div><h3><span>' + tag + '</span>' + h + '</h3><p>' + line + '</p></li>'; };
  var tenTiles = function (on) { return '<div class="mt">' + 'ABCDEFGHIJ'.split('').map(function (q) { return '<i' + (on.indexOf(q) >= 0 ? ' class="ok"' : '') + '></i>'; }).join('') + '</div>'; };
  var screens = '<ol class="scr4">' +
    mini('1', 'Guess', 'Before any code.', '<div class="mo"><i>Right</i><i class="sel">Wrong</i><i>Refused</i></div>') +
    mini('2', 'Change one line', 'Python runs in this page. Each function joins one file, rag.py, yours to download.', '<div class="mc"><i></i><i class="yl"></i><i class="sh"></i></div>') +
    mini('3', 'See the score', 'Green: the right passage made your best 3.', tenTiles('AEFGI')) +
    mini('4', 'Say it aloud', 'A real interview question. Then compare with ours.', '<div class="mq">“How do you know your retrieval works?”<span>Asked at Google, Meta</span></div>') +
    '</ol>';
  var route = '<ol class="route">' + LEVELS.map(function (L, i) { return '<li><b>' + (i + 1) + '</b>' + esc(L.seg) + '</li>'; }).join('') +
    '<li class="fin">Your two-minute answer</li></ol>';
  $('#stage').innerHTML =
    '<section class="bs">' + flow + '</section>' +
    '<section class="bs"><h2 class="bh">Ten questions. We know where each answer is.</h2>' +
      '<p>Pick a letter. Each block is one passage of Lectures 1 to 12. Tap any block to read it.</p>' +
      '<div class="tenbox" id="tenbox"></div></section>' +
    '<section class="bs"><h2 class="bh">Every level is four screens</h2>' + screens + '</section>' +
    '<section class="bs"><h2 class="bh">Nine levels, then your interview answer</h2>' + route +
      '<p>At the end, “Walk me through your RAG project”, filled in with your own numbers.</p></section>' +
    '<p class="small">Level 7 sends one prompt to the LLM with your Groq key, the one from the Tool Bench. Stars: it works, no hint, 3 runs or fewer. Progress saves in this browser.</p>';
  drawTen();
  $('#fwd').innerHTML = '<button class="btn primary big" id="start" type="button"' + (ready ? '' : ' disabled') + '>' + (ready ? (S.done.count || S.guess.count ? 'Carry on' : 'Start level 1') : 'Getting Python ready') + '</button>';
  $('#start').onclick = function () { S.started = true; save(); go(S.lv, S.beat); };
}

function guess(L) {
  var g = L.guess, mine = S.guess[L.id];
  head(txt(g.h), !mine, txt(g.ctx) || (mine ? '' : 'Guess first. You find out after you write the code.'));
  $('#stage').innerHTML = (g.about ? qcard(g.about) : '') + '<div class="opts">' + g.opts.map(function (o, i) {
    return '<button type="button" class="opt' + (mine && mine.i === i ? ' sel' : '') + '" data-i="' + i + '"' + (mine ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd>' + esc(o) + '</button>';
  }).join('') + '</div>' + (g.ctx && !mine ? '<p class="small">Guess first. You find out after you write the code.</p>' : '');
  $$('.opt').forEach(function (b) { b.onclick = function () { S.guess[L.id] = { i: +b.dataset.i, right: +b.dataset.i === g.right }; save(); next(); }; });
  if (mine) forward();
}

var cm = null;
function codeOk(L) { return L.live ? S.built : !!S.done[L.id]; }
function code(L) {
  head(L.h1, !codeOk(L), txt(L.ctx));
  $('#stage').innerHTML = (L.pre ? L.pre() : '') + '<div class="cmwrap" id="cmwrap"><div class="cmhd"><span class="fname">rag.py</span><span>Level ' + PART[L.id].n + ': ' + esc(PART[L.id].title) + '</span></div></div>' +
    '<div class="runrow"><button class="btn primary" id="run" type="button">Run</button><button class="btn quiet" id="hintb" type="button">' + (S.hint[L.id] ? 'Show the hint' : 'Stuck? Show a hint (costs a star)') + '</button></div>' +
    '<pre class="hint" id="hint" hidden></pre><div class="out" id="out" aria-live="polite"></div>' + fileBar(L);
  cm = CodeMirror($('#cmwrap'), {
    value: S.code[L.id] != null ? S.code[L.id] : L.starter, mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, viewportMargin: Infinity, lineWrapping: true,
    extraKeys: { Tab: function (c) { c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'); }, 'Shift-Tab': function (c) { c.indentSelection('subtract'); }, 'Ctrl-Enter': doRun, 'Cmd-Enter': doRun }
  });
  markLine();
  cm.on('change', function () { S.code[L.id] = cm.getValue(); save(); if (!$('#fview').hidden) paintFile(L); });
  $('#run').onclick = doRun;
  $('#hintb').onclick = function () {
    S.hint[L.id] = true; save();
    var h = $('#hint'); h.hidden = false;
    h.innerHTML = esc(L.hint) + '\n<a href="#" id="reset">Start this code again</a>';
    $('#reset').onclick = function (e) { e.preventDefault(); cm.setValue(L.starter); markLine(); cm.focus(); };
    this.hidden = true;
  };
  wireFile(L);
  if (codeOk(L)) { $('#out').innerHTML = S.out[L.id] ? runView(L, S.out[L.id]) : '<p class="pass">It works.</p>'; forward(); }
}
/* the one line to look at: the first line that says "your code" or "change" */
function markLine() {
  var n = -1; cm.eachLine(function (l) { if (n < 0 && /# *(your code|change)/.test(l.text)) n = cm.getLineNumber(l); });
  if (n < 0) return;
  cm.addLineClass(n, 'background', 'yourline'); cm.addLineClass(n, 'gutter', 'yourline');
  var t = cm.getLine(n), at = t.search(/\s*#/); cm.setCursor(n, at > 0 && t.trim().charAt(0) !== '#' ? at : t.length);
}
function doRun() {
  var L = LEVELS[S.lv], b = $('#run'); if (!b || b.disabled) return;
  if (!ready) { $('#out').innerHTML = '<p class="err">Python is still starting. Try again in a moment.</p>'; return; }
  b.disabled = true; b.textContent = 'Running';
  S.runs[L.id] = (S.runs[L.id] || 0) + 1; save();
  var src = cm.getValue();
  runPy(L.id, src).then(function (r) { showRun(L, r, src); }, function (e) { $('#out').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; })
    .then(function () { var x = $('#run'); if (x) { x.disabled = false; x.textContent = 'Run'; } });
}

/* python syntax colours for read-only code (CodeMirror's runMode addon) */
function hl(src) {
  if (!CodeMirror.runMode) return esc(src);
  var html = '';
  CodeMirror.runMode(src, 'python', function (text, style) { html += style ? '<span class="cm-' + style.replace(/ +/g, ' cm-') + '">' + esc(text) + '</span>' : esc(text); });
  return html;
}

/* after a run: every check with a tick or a cross, then what the file printed */
function runView(L, r) {
  var pass = !r.error && r.tests.length && r.tests.every(function (t) { return t.ok; });
  var nOk = r.tests.filter(function (t) { return t.ok; }).length;
  var html = '<div class="run ' + (pass ? 'ok' : 'no') + '">';
  if (r.error) html += '<p class="err"><b>Python stopped.</b> ' + esc(r.error) + '</p>';
  if (r.tests.length) {
    html += '<div class="runhd"><span>Checks</span><b>' + (pass ? 'All ' + nOk + ' passed' : nOk + ' of ' + r.tests.length + ' passed') + '</b></div><ul class="chk">' +
      r.tests.map(function (t) { return '<li class="' + (t.ok ? 'ok' : 'no') + '"><i aria-hidden="true">' + (t.ok ? '✓' : '✗') + '</i><span>' + esc(t.name) + (t.note ? '<em>' + esc(t.note) + '</em>' : '') + '</span></li>'; }).join('') + '</ul>';
  }
  if (r.out) html += '<div class="runhd"><span>Your print() output</span></div><pre class="repl">' + esc(r.out) + '</pre>';
  if (pass && r.repl && r.repl.length) {
    html += '<div class="runhd"><span>Output</span><small>your function, run on our notes</small></div>';
    if (L.id === 'prompt' && r.extra && r.extra.prompts && r.extra.prompts.X) {
      var x = r.extra.prompts.X;
      html += '<pre class="repl">' + r.repl.map(function (l) { return '<span class="pr">&gt;&gt;&gt; </span>' + hl(l.in) + '\n'; }).join('') + '</pre>' + promptView(x.prompt, x.ids, qtext('X'), []);
    } else {
      html += '<pre class="repl">' + r.repl.map(function (l) { return '<span class="pr">&gt;&gt;&gt; </span>' + hl(l.in) + '\n' + (l.out ? '<span class="po">' + esc(l.out) + '</span>' : ''); }).join('') + '</pre>';
    }
  }
  return html + '</div>';
}
function showRun(L, r, src) {
  var pass = !r.error && r.tests.length && r.tests.every(function (t) { return t.ok; });
  $('#fwd').innerHTML = '';
  if (!pass) {
    if (L.live) { S.built = false; save(); }
    $('#out').innerHTML = runView(L, r);
    return;
  }
  if (L.id === 'pick') {            // keep the best passing run: most found, then fewest tokens
    var p = r.extra, old = S.pick;
    if (!old || p.n > old.n || (p.n === old.n && p.avg <= old.avg)) S.pick = p;
  }
  if (L.id === 'filter') S.filter = r.extra;
  S.passed[L.id] = src;
  S.out[L.id] = { tests: r.tests, out: r.out, error: '', repl: r.repl, extra: L.id === 'prompt' ? { prompts: r.extra.prompts } : {} };
  if (L.live) { S.built = true; lastPrompts = r.extra.prompts; } else finishLevel(L);
  save(); paintBar(); $('#ins').className = '';
  $('#out').innerHTML = runView(L, r);
  forward();
}

/* ---------- rag.py: the whole file, growing one function per level ---------- */
function codeNow(L) {
  var c = {}; RF.PARTS.forEach(function (p) { if (S.passed[p.id] != null) c[p.id] = S.passed[p.id]; });
  if (L && PART[L.id]) c[L.id] = cm ? cm.getValue() : (S.code[L.id] != null ? S.code[L.id] : L.starter);
  return c;
}
function fileBar(L) {
  var lines = RF.file(codeNow(L), L && L.id).split('\n').length;
  return '<div class="filebar"><span class="fname">rag.py</span><p>Your file so far: ' + lines + ' lines. Every level adds one function.</p>' +
    '<button class="btn" id="fsee" type="button" aria-expanded="false">See the whole file</button><button class="btn quiet" id="fdl" type="button">Download</button></div>' +
    '<div class="fview" id="fview" hidden></div>';
}
function paintFile(L) {
  var have = codeNow(L), secs = RF.sections(have, L && L.id), later = RF.PARTS.filter(function (p) { return have[p.id] == null; });
  $('#fview').innerHTML = secs.map(function (x, i) {
    if (x.kind !== 'given') return '<div class="fsec ' + x.kind + '" id="fs-' + x.id + '"><pre class="cm-s-default">' + hl(x.text) + '</pre></div>';
    var soon = i > 0 && later.length ? '<p class="flater"># Still to come: ' + later.map(function (p) { return p.fn + '()'; }).join(', ') + '</p>' : '';
    return soon + '<details class="fsec given"><summary>' + esc(x.label) + '<small>' + x.text.split('\n').length + ' lines</small></summary><pre class="cm-s-default">' + hl(x.text) + '</pre></details>';
  }).join('') +
    '<p class="fnote">On your laptop: download it and run <code>python rag.py</code>. The first run fetches the 183 passages. ' +
    'From level 7, <code>python rag.py "your question"</code> runs the whole thing. It needs <code>pip install sentence-transformers</code> and your Groq key in <code>GROQ_API_KEY</code>.</p>';
}
function download(L) {
  var blob = new Blob([RF.file(codeNow(L), null)], { type: 'text/x-python' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'rag.py'; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function wireFile(L) {
  $('#fsee').onclick = function () {
    var v = $('#fview'), open = v.hidden;
    v.hidden = !open; this.textContent = open ? 'Hide the file' : 'See the whole file'; this.setAttribute('aria-expanded', open);
    if (open) { paintFile(L); var cur = $('#fs-' + (L && L.id)); if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  };
  $('#fdl').onclick = function () { download(L); };
}

/* ---------- the prompt, taken apart: instruction, passages (the one that holds the answer marked), question ---------- */
function promptView(prompt, ids, question, gold) {
  var spans = [];
  ids.forEach(function (id) {
    var p = PBY[id], tag = '[' + id + ']', at = prompt.indexOf(tag); if (at < 0) return;
    var t = p ? prompt.indexOf(p.text, at) : -1, end = t >= 0 && t - at < 40 ? t + p.text.length : at + tag.length;
    spans.push({ a: at, b: end, kind: gold.indexOf(id) >= 0 ? 'gold' : 'psg', id: id });
  });
  var qa = prompt.lastIndexOf(question);
  if (qa >= 0 && !spans.some(function (x) { return qa >= x.a && qa < x.b; })) spans.push({ a: qa, b: qa + question.length, kind: 'q' });
  spans.sort(function (x, y) { return x.a - y.a; });
  var segs = [], pos = 0;
  spans.forEach(function (x) { if (x.a > pos) segs.push({ kind: 'ins', text: prompt.slice(pos, x.a) }); segs.push({ kind: x.kind, id: x.id, text: prompt.slice(x.a, x.b) }); pos = x.b; });
  if (pos < prompt.length) segs.push({ kind: 'ins', text: prompt.slice(pos) });
  /* a short label right before the question ("Question:") belongs to the question, not to the instruction */
  segs.forEach(function (x, i) {
    var n = segs[i + 1]; if (x.kind !== 'ins' || !n || n.kind !== 'q') return;
    var m = x.text.match(/(^|\n)([^\n]{1,24}:)\s*$/); if (m) { x.text = x.text.slice(0, m.index); n.text = m[2] + ' ' + n.text; }
  });
  segs = segs.filter(function (x) { return x.text.trim(); });
  var nIns = segs.filter(function (x) { return x.kind === 'ins'; }).length;
  var body = segs.map(function (x) {
    var p = x.id && PBY[x.id], label, text = x.text.trim();
    if (x.kind === 'ins') label = 'Your instruction';
    else if (x.kind === 'q') label = 'The question';
    else { label = 'Passage <code>' + esc(x.id) + '</code><span>Lecture ' + p.lecture + ' · ' + esc(p.title) + '</span>' + (x.kind === 'gold' ? '<b class="badge">Holds the answer</b>' : ''); text = text.slice(x.id.length + 2).trim(); }
    return '<div class="pseg ' + x.kind + '"><p class="plab">' + label + '</p><p class="ptxt' + (x.kind === 'psg' || x.kind === 'gold' ? ' clamp' : '') + '">' + esc(text) + '</p></div>';
  }).join('');
  return '<div class="pv"><div class="pvhd"><span>The prompt, exactly as sent</span><span class="plg"><i class="ins"></i>Instruction <i class="psg"></i>Passage <i class="gold"></i>Holds the answer <i class="q"></i>Question</span></div>' +
    (nIns ? '' : '<div class="pseg warn"><p class="plab">No instruction yet</p><p class="ptxt">The LLM gets the passages and the question, and nothing that tells it what to do with them.</p></div>') +
    body + '<button type="button" class="pmore">Show the passages in full</button></div>';
}
function wirePrompts() {
  $$('.pmore').forEach(function (b) { b.onclick = function () { var v = b.closest('.pv'), open = v.classList.toggle('full'); b.textContent = open ? 'Shorten the passages' : 'Show the passages in full'; }; });
}
/* the LLM's reply: plain text, **bold** kept, every [passage id] shown as a chip (green when it holds the answer) */
function replyHTML(a, gold) {
  return esc(a).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/[\[【]​?(L\d+\.[a-z0-9]+\.\d+)[\]】]/g, function (m, id) { return '<span class="cite' + (gold.indexOf(id) >= 0 ? ' gold' : '') + '">' + id + '</span>'; });
}

/* level 7: the two prompts go to the LLM, on the learner's own key */
var lastPrompts = null;
var JOBS = [
  { id: 'X', pass: 'It said the notes do not cover it.', fail: 'It did not say the notes do not cover it.', test: function (a) { return NOTIN.test(a); } },
  { id: 'B', pass: 'It named the passage that holds the answer.', fail: 'It did not name [L10.s03.1] or [L10.s04.1], the passages that hold the answer.', test: function (a) { return /L10\.s0[34]\.1/.test(a); } }
];
function live(L) {
  var done = S.live === 'pass';
  head(done ? 'The LLM read your prompt.' : 'Send your prompt to the LLM.', !done, done ? 'Both answers pass.' : 'Two questions: one the notes cannot answer, one they can. Each prompt is below, taken apart.');
  if (!lastPrompts) {      // the page was reloaded: build the prompts again from the saved code
    $('#stage').innerHTML = '<p class="small">Getting your prompt ready.</p>';
    runPy(L.id, S.passed[L.id] || S.code[L.id] || L.starter).then(function (r) { if (r.extra && r.extra.prompts && r.extra.prompts.X && r.extra.prompts.B) { lastPrompts = r.extra.prompts; live(L); } else go(S.lv, S.beat - 1); }, function () { go(S.lv, S.beat - 1); });
    return;
  }
  var html = '';
  if (!done) {
    if (!groqKey) html += '<label class="keyl">Your Groq key, the same one as on the bench<input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="gsk_..."></label>';
    html += '<div class="runrow"><button class="btn primary" id="send" type="button">Send both</button><button class="btn quiet" id="skip" type="button">No key right now: skip this</button></div><div id="sendmsg" aria-live="polite"></div>';
  }
  html += JOBS.map(function (j, n) {
    var pr = lastPrompts[j.id], q = qobj(j.id);
    return '<section class="exch"><p class="exn">Question ' + (n + 1) + ' of 2' + (j.id === 'X' ? ' · not in the notes' : ' · in the notes') + '</p>' + qcard(j.id) +
      promptView(pr.prompt, pr.ids, q.q, q.gold) + '<div class="replyslot" id="rep-' + j.id + '"></div></section>';
  }).join('');
  $('#stage').innerHTML = html;
  wirePrompts();
  if (S.answers) paintAnswers(S.answers);
  if (done || S.live === 'skipped') forward();
  if (done) return;
  $('#skip').onclick = function () { S.live = 'skipped'; finishLevel(L); save(); next(); };
  $('#send').onclick = function () {
    var b = this, k = $('#key');
    if (k) { var v = k.value.trim(); if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) { $('#sendmsg').innerHTML = '<p class="err">A Groq key starts with gsk_. Copy the whole key.</p>'; return; } groqKey = v; }
    b.disabled = true; b.textContent = 'Sending'; $('#sendmsg').innerHTML = '';
    var results = [];
    var one = function (i) {
      if (i >= JOBS.length) return Promise.resolve();
      var j = JOBS[i];
      $('#rep-' + j.id).innerHTML = '<p class="small">Waiting for the LLM.</p>';
      return post({ op: 'chat', request: { model: MODEL, messages: [{ role: 'user', content: lastPrompts[j.id].prompt }] } }).then(function (d) {
        var a = d.refused ? '' : (d.raw && d.raw.content) || '';
        results.push({ id: j.id, answer: (a || 'Groq refused the request: it was too large for the key.').slice(0, 1200), ok: !!a && j.test(a) });
        paintAnswers(results);
        return one(i + 1);
      });
    };
    one(0).then(function () {
      try { sessionStorage.setItem(KEYS, groqKey); } catch (e) { /* this tab only */ }
      S.answers = results;
      if (results.every(function (x) { return x.ok; })) { S.live = 'pass'; finishLevel(L); save(); paintBar(); return live(L); }
      save(); paintAnswers(results);
      $('#sendmsg').innerHTML = '<p class="err">Not yet. <a href="#" id="fix">Go back and change your instruction</a>, then send again.</p>';
      $('#fix').onclick = function (e) { e.preventDefault(); go(S.lv, S.beat - 1); };
    }, function (e) {
      if (e.code === 'need_key') { groqKey = ''; try { sessionStorage.removeItem(KEYS); } catch (x) { /* ignore */ } live(L); }
      $('#sendmsg').innerHTML = '<p class="err">' + esc(e.message) + '</p>';
    }).then(function () { var s = $('#send'); if (s) { s.disabled = false; s.textContent = 'Send both'; } });
  };
}
function paintAnswers(list) {
  list.forEach(function (x) {
    var j = JOBS.filter(function (y) { return y.id === x.id; })[0], slot = $('#rep-' + x.id); if (!j || !slot) return;
    slot.innerHTML = '<div class="reply ' + (x.ok ? 'ok' : 'no') + '"><div class="rhd"><span>The LLM replied</span><b class="vpill">' + (x.ok ? '✓ Pass' : '✗ Fail') + '</b></div>' +
      '<div class="rtx">' + replyHTML(x.answer, qobj(x.id).gold) + '</div><p class="rwhy">' + esc(x.ok ? j.pass : j.fail) + '</p></div>';
  });
}

/* ---------- level 4 opens here: what an embedding is, with real numbers ---------- */
var embedder = null;
var dot = function (a, b) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i] * b[i]; return t; };
var qnum = function (id) { return DATA.questions.filter(function (q) { return q.id === id; })[0].numbers; };
var TRY = ['Hide my password from the browser', 'My app forgets the user'];   /* both land on the right lecture (checked with gte-small, 21 Nov) */
/* 384 numbers as 384 thin bars: up for positive (coral), down for negative (purple) */
function barcode(v, label) {
  var mx = 0; v.forEach(function (x) { mx = Math.max(mx, Math.abs(x)); });
  var bars = v.map(function (x, i) { var h = Math.max(.6, 28 * Math.abs(x) / mx); return '<rect x="' + i + '" y="' + (x >= 0 ? 30 - h : 30) + '" width=".72" height="' + h.toFixed(2) + '" class="' + (x >= 0 ? 'up' : 'dn') + '"/>'; }).join('');
  return '<div class="bc"><p class="bcl">' + label + '</p><svg viewBox="0 0 384 60" preserveAspectRatio="none" role="img" aria-label="384 numbers drawn as bars">' + bars + '<line x1="0" x2="384" y1="30" y2="30"/></svg></div>';
}
function nums(v, n) { return '[' + v.slice(0, n).map(function (x) { return (x >= 0 ? ' ' : '') + x.toFixed(3); }).join(', ') + ', … ' + (v.length - n) + ' more]'; }
function embedScreen(L) {
  var did = S.embedded;
  head('Type a sentence. See the 384 numbers a model gives it.', !did, 'Words could not tell that "making things up" and "hallucinate" mean the same. To search by meaning, every text first becomes a list of numbers.');
  $('#stage').innerHTML =
    '<div class="pipe" aria-hidden="true"><div class="pbox"><small>Text</small><b>“Why is the model making things up?”</b></div><span class="parr">→</span>' +
      '<div class="pbox model"><small>Model</small><b>gte-small</b><span>Open source, from Hugging Face. 33 million parameters, about 70 MB. Runs on a laptop.</span></div><span class="parr">→</span>' +
      '<div class="pbox"><small>Out</small><b class="mono">[-0.037, 0.008, 0.038, …]</b><span>always 384 numbers</span></div></div>' +
    '<div class="einput"><label for="etext">Your sentence</label><div><input id="etext" type="text" maxlength="300" value="' + esc(qtext('B')) + '"><button class="btn primary" id="ego" type="button">Turn it into numbers</button></div>' +
      '<p class="try">Or try: ' + TRY.map(function (t) { return '<button type="button" class="chip">' + esc(t) + '</button>'; }).join('') + '</p></div>' +
    '<div id="eout" aria-live="polite"></div>' +
    '<details class="laptop"><summary>Run the same model on your laptop</summary>' +
      '<p>gte-small is free and open. Its page on Hugging Face: <a href="' + HF + '" target="_blank" rel="noopener">thenlper/gte-small</a>. Install one library, then four lines of Python:</p>' +
      '<pre class="sh"><span class="pr">$ </span>pip install sentence-transformers</pre>' +
      '<pre class="lcode cm-s-default">' + hl('from sentence_transformers import SentenceTransformer\n\nmodel = SentenceTransformer("thenlper/gte-small")       # downloads once, about 70 MB\nnumbers = model.encode("Why is the model making things up?", normalize_embeddings=True)\nprint(len(numbers), numbers[:8])') + '</pre>' +
      '<p>It prints <code>384</code> and the first eight numbers: <code>-0.040 0.009 0.040 -0.027 …</code>. This page runs an 8-bit copy of the same model, so the two agree to about two decimals.</p>' +
      '<p class="files">The full script: <a href="' + CODE_DIR + 'embed.py" download>download embed.py</a>. Run <code>python embed.py "any sentence"</code>.</p></details>';
  var go1 = function () {
    var text = $('#etext').value.trim(); if (!text) return;
    var b = $('#ego'); b.disabled = true;
    var done = function (v) { b.disabled = false; b.textContent = 'Turn it into numbers'; showEmbedding(L, text, v); };
    if (text === qtext('B')) return done(qnum('B'));      // the lab already has these numbers
    $('#eout').innerHTML = '<p class="small">' + (embedder ? 'Turning it into numbers.' : 'Downloading the model to this browser, once (about 30 MB). Then it runs here, with no server.') + '</p>';
    b.textContent = 'Working';
    if (!embedder) embedder = import(TF).then(function (t) { return t.pipeline('feature-extraction', EMBED, { dtype: 'q8' }); });
    embedder.then(function (f) { return f(text, { pooling: 'mean', normalize: true }); }).then(function (t) { done(Array.prototype.slice.call(t.data)); }, function () {
      embedder = null; b.disabled = false; b.textContent = 'Turn it into numbers';
      $('#eout').innerHTML = '<p class="err">The model did not load here. Try the example sentence, or run it on your laptop (below).</p>';
    });
  };
  $('#ego').onclick = go1;
  $('#etext').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go1(); } };
  $$('.try .chip').forEach(function (c) { c.onclick = function () { $('#etext').value = c.textContent; go1(); }; });
  if (did) { showEmbedding(L, qtext('B'), qnum('B')); }
}
function showEmbedding(L, text, v) {
  var near = DATA.passages.map(function (p) { return { p: p, c: dot(v, p.numbers) }; }).sort(function (a, b) { return b.c - a.c; });
  $('#eout').innerHTML = '<div class="emb">' +
    '<p class="eh"><b>' + v.length + ' numbers</b> for “' + esc(text) + '”</p>' +
    '<p class="enums">' + nums(v, 8) + '</p>' +
    barcode(v, 'Your sentence, all ' + v.length + ' numbers') +
    '<p class="enote">No single number means anything you can read. They only mean something when you compare two lists: texts that mean the same thing get similar numbers.</p>' +
    spread(near) +
    '<p class="eh"><b>The nearest passages in our notes</b>, by how close their numbers are</p><ol class="near">' +
    near.slice(0, 3).map(function (x) { return '<li><span class="cl">' + x.c.toFixed(3) + '</span><div><p class="nm"><code>' + esc(x.p.id) + '</code> Lecture ' + x.p.lecture + ' · ' + esc(x.p.title) + '</p><p class="ns">' + esc(x.p.text.slice(0, 170)) + '…</p></div></li>'; }).join('') + '</ol></div>' +
    '<p class="named">These numbers are the sentence’s <b>embedding</b>. A model that makes them is an <b>embedding model</b>. Every passage in our notes got its 384 numbers from this same model, once, before the lab began.</p>';
  if (!S.embedded) { S.embedded = true; save(); $('#ins').className = ''; }
  forward();
}
/* closeness of the sentence to all 183 passages, one tick each, on one line: the order is what counts */
function spread(near) {
  var hi = near[0].c, lo = near[near.length - 1].c, x = function (c) { return (100 * (c - lo) / (hi - lo || 1)).toFixed(2); };
  return '<div class="spread"><p class="eh"><b>Closeness to all ' + near.length + ' passages</b>, one tick each</p><div class="sp" role="img" aria-label="Closeness from ' + lo.toFixed(3) + ' to ' + hi.toFixed(3) + '">' +
    near.map(function (n, i) { return '<i class="' + (i < 3 ? 'n3' : '') + '" style="left:' + x(n.c) + '%"></i>'; }).join('') + '</div>' +
    '<div class="spx"><span>' + lo.toFixed(3) + ' farthest</span><span>nearest ' + hi.toFixed(3) + '</span></div>' +
    '<p class="enote">Even the farthest passage scores ' + lo.toFixed(3) + ': with this model, every pair of texts looks somewhat alike. So the number alone tells you little. The order does: the three green ticks are the nearest.</p></div>';
}
/* the code screen of level 4: the first numbers of question B and the passage that answers it, multiplied pair by pair */
function pairs() {
  var a = qnum('B'), b = PBY['L10.s03.1'].numbers, cols = [0, 1, 2, 3];
  var cell = function (x) { return '<td>' + x.toFixed(3) + '</td>'; };
  var row = function (label, f) { return '<tr><th>' + label + '</th>' + cols.map(function (i) { return cell(f(i)); }).join('') + '<td class="gap">…</td>' + cell(f(383)) + '</tr>'; };
  return '<div class="pairs"><div class="ptw"><table><thead><tr><th></th>' + cols.map(function (i) { return '<th>' + (i + 1) + '</th>'; }).join('') + '<th class="gap">…</th><th>384</th></tr></thead><tbody>' +
    row('Question B', function (i) { return a[i]; }) + row('Passage <code>L10.s03.1</code>', function (i) { return b[i]; }) +
    '<tr class="prod">' + '<th>Multiplied</th>' + cols.map(function (i) { return '<td>' + (a[i] * b[i]).toFixed(4) + '</td>'; }).join('') + '<td class="gap">…</td><td>' + (a[383] * b[383]).toFixed(4) + '</td></tr></tbody></table></div>' +
    '<p class="psum">Add up all 384 products and you get <b>' + dot(a, b).toFixed(3) + '</b>. Your function does exactly this.</p></div>';
}

/* the result: one finding as the headline, one picture, one line, the name */
function tiles(rows) {
  return '<div class="tiles">' + rows.map(function (m) {
    var n = m === 'pick' ? S.pick.n : found(m);
    return '<div class="trow"><span class="tl">' + METHOD[m] + '</span><div class="tt">' + GOLD.map(function (q) {
      var ok = m === 'pick' ? S.pick.found[q] : rk(m, q) <= 3;
      return '<button type="button" class="tile ' + (ok ? 'ok' : 'no') + '" data-q="' + q + '" data-m="' + m + '" aria-label="Question ' + q + (ok ? ', found' : ', not found') + '">' + q + '</button>';
    }).join('') + '</div><span class="tn">' + n + '</span></div>';
  }).join('') + '<p class="tq" id="tq">Tap a letter to see its question.</p></div>';
}
function result(L) {
  if (!S.done[L.id] || (L.id === 'pick' && !S.pick) || (L.id === 'filter' && !S.filter)) return go(S.lv, beats(L).indexOf('code'));
  head(txt(L.res), false, '');
  var g = L.guess, mine = S.guess[L.id], st = S.stars[L.id] || 0;
  var verdict = g && mine ? '<p class="verdict ' + (mine.right ? 'ok' : 'no') + '">You guessed "' + esc(g.opts[mine.i]) + '". ' + (mine.right ? 'Right.' : 'It was "' + esc(g.opts[g.right]) + '".') + '</p>' : '';
  $('#stage').innerHTML = (L.rows ? tiles(L.rows) : L.vis ? L.vis() : '') + verdict +
    '<p class="what">' + esc(txt(L.note)) + '</p><p class="named">' + L.name + '</p>' +
    '<p class="won"><span class="stars" aria-label="' + st + ' of 3 stars">' + starsText(st) + '</span>' + (L.again ? '<a href="#" id="again">' + L.again + '</a>' : '') + '</p>';
  $$('.tile').forEach(function (b) {
    b.onclick = function () {
      $$('.tile.cur').forEach(function (x) { x.classList.remove('cur'); }); b.classList.add('cur');
      var q = b.dataset.q, m = b.dataset.m;
      var g = PBY[qobj(q).gold[0]];
      $('#tq').innerHTML = '<b>' + q + '</b> ' + esc(qtext(q)) + '<span>The answer is in <code>' + esc(g.id) + '</code>, Lecture ' + g.lecture + ' · ' + esc(g.title) + '.' + (m === 'pick' ? '' : ' ' + METHOD[m] + ' put it at place ' + rk(m, q) + '.') + '</span>';
    };
  });
  if ($('#again')) $('#again').onclick = function (e) { e.preventDefault(); go(S.lv, beats(L).indexOf('code')); };
  forward();
}

/* where each interview question was reported. Wording as the source gives it; none of these lists links the original post. */
var SRC = {
  gh: { t: 'AI Engineering Interview Questions Company Wise', u: 'https://github.com/pallavi-shekhar/ai-engineering-interview-questions-company-wise' },
  ss: { t: '50 RAG Interview Questions Reported From Real Loops', u: 'https://aiengineeringinsider.substack.com/p/50-rag-interview-questions-reported' },
  gg: { t: 'Google AI, ML, RAG and Agentic-AI Interview Questions', u: 'https://aiengineeringinsider.substack.com/p/google-ai-ml-rag-and-agentic-ai-interview' }
};
var END_ASKED = [
  { at: 'Apple', via: 'Glassdoor, 2026', q: 'What are your RAG projects? What is your most challenging work in GenAI or ML?', s: 'ss' },
  { at: 'NVIDIA', via: 'Glassdoor', q: 'How would you improve the RAG system that you built before?', s: 'ss' }
];
function asked(list) {
  if (!list) return '';
  var used = [];
  list.forEach(function (a) { if (used.indexOf(a.s) < 0) used.push(a.s); });
  /* collapsed by default: the summary names the companies, a click shows their questions and the source */
  return '<details class="asked"><summary>Asked in AI engineer interviews at ' + list.map(function (a) { return '<b>' + esc(a.at) + '</b>'; }).join(', ') + '</summary>' +
    list.map(function (a) { return '<p class="aq"><b>' + esc(a.at) + '</b>' + (a.via ? ' <span>(' + esc(a.via) + ')</span>' : '') + '<q>' + esc(a.q) + '</q></p>'; }).join('') +
    '<p class="as">Reported by candidates. Source: ' + used.map(function (k) { return '<a href="' + SRC[k].u + '" target="_blank" rel="noopener">' + esc(SRC[k].t) + '</a>'; }).join(', ') + '</p></details>';
}

/* one interview question, answered aloud before the answer is shown */
function say(L) {
  var seen = S.said[L.id];
  head(L.iq, !seen, 'An interview question. Answer it aloud, with your own numbers. Then compare.');
  var show = function () { $('#stage').innerHTML = asked(L.asked) + '<p class="answer">' + esc(txt(L.ia)) + '</p>'; forward(S.lv === END - 1 ? 'See your two-minute answer' : 'Next level'); };
  if (seen) return show();
  $('#stage').innerHTML = asked(L.asked) + '<button class="btn" id="show" type="button">I said it. Show an answer</button>';
  $('#show').onclick = function () { S.said[L.id] = true; save(); $('#ins').className = ''; show(); };
}

/* level 9: three failures, one per screen */
function oneCase(L, n) {
  var c = L.cases()[n], a = S.cases[n], solved = a === c.right;
  head('Which part failed?', !solved, 'Wrong answer ' + (n + 1) + ' of 3.');
  $('#stage').innerHTML = '<div class="case"><p class="cq">' + esc(c.q) + '</p><p class="cf">' + esc(c.facts) + '</p></div><div class="opts">' +
    L.opts.map(function (o, i) { return '<button type="button" class="opt' + (a === i ? (solved ? ' right' : ' wrong') : '') + '" data-i="' + i + '"' + (solved ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd>' + esc(o) + '</button>'; }).join('') +
    '</div><p class="cw">' + (solved ? esc(c.why) : a != null ? 'Not that one. Did the right passage ever reach the LLM?' : '') + '</p>';
  $$('.opt').forEach(function (b) {
    b.onclick = function () {
      var i = +b.dataset.i; if (i !== c.right) S.wrong = (S.wrong || 0) + 1;
      S.cases[n] = i; if (n === 2 && i === c.right) finishLevel(L);
      save(); oneCase(L, n); paintBar();
    };
  });
  if (solved) forward();
}

/* the end: the two-minute answer, filled with the learner's own numbers */
function theEnd() {
  var p = S.pick || { n: found('meaning'), avg: INFO.meaningTokens }, lo = lowestReal();
  var lines = [
    'My data is ' + INFO.n + ' passages, ' + num(INFO.tokens) + ' tokens. Pasting all of it does not go through: my key takes ' + num(FREE_TPM) + ' tokens a minute.',
    'I kept ten questions whose right passage I knew, and counted how many were found in the top 3.',
    'Keyword search found ' + found('rare') + '. Search by meaning found ' + found('meaning') + '. Merging the two found ' + found('merged') + '.',
    'I chose to send what found ' + p.n + ' of 10, at about ' + num(p.avg) + ' tokens a question.',
    'A closeness cut-off could not catch a question with no answer (' + INFO.top.X.toFixed(3) + ' against a real one at ' + lo.top.toFixed(3) + '), so my prompt says when it is not in the notes and names the passage it used.',
    'Permission is a filter before the search, not an instruction to the LLM.',
    'When an answer is wrong, I first check whether the right passage was found. That tells me which part to fix.'
  ];
  head('Say it in two minutes.', true, '"Walk me through your RAG project." These are your numbers. Read it aloud once, then say it without looking.');
  $('#stage').innerHTML = asked(END_ASKED) + '<ol class="defence">' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol>' +
    '<div class="runrow"><button class="btn primary" id="copy" type="button">Copy it</button><button class="btn quiet" id="over" type="button">Start again from level 1</button></div>' +
    '<section class="bs endfile"><h2 class="bh">Your rag.py</h2><p>Every function you wrote, in one file with the given parts. It runs on your laptop.</p>' +
      '<pre class="sh"><span class="pr">$ </span>python rag.py\n<span class="pc"># the scoreboard of every search you built</span>\n<span class="pr">$ </span>pip install sentence-transformers\n<span class="pr">$ </span>export GROQ_API_KEY=gsk_...\n<span class="pr">$ </span>python rag.py "Why is the model making things up?"\n<span class="pc"># search, pick, prompt, and the LLM\u2019s answer</span></pre>' +
      '<div class="runrow"><button class="btn primary" id="fdl" type="button">Download rag.py</button><button class="btn" id="fsee" type="button">See the whole file</button>' +
      '<a class="btn quiet" href="' + CODE_DIR + 'embed.py" download>embed.py</a><a class="btn quiet" href="' + GH + '" target="_blank" rel="noopener">The repository on GitHub</a></div><div class="fview" id="fview" hidden></div></section>';
  $('#copy').onclick = function () {
    var b = this, done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy it'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines.join('\n')).then(done, function () { b.textContent = 'Select the text and copy it'; });
    else b.textContent = 'Select the text and copy it';
  };
  $('#over').onclick = function () { S = BLANK(); lastPrompts = null; save(); render(); window.scrollTo(0, 0); };
  cm = null; wireFile(null);
}

/* ---------- keys: Enter continues, digits pick an option (never while typing code or a key) ---------- */
document.addEventListener('keydown', function (e) {
  var t = e.target; if (!t || !t.tagName || t.closest('.CodeMirror') || /INPUT|TEXTAREA/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Enter' && t.tagName !== 'BUTTON' && t.tagName !== 'A') { var n = $('#next') || $('#start'); if (n && !n.disabled) { e.preventDefault(); n.click(); } }
  if (/^[1-3]$/.test(e.key)) { var o = $$('.opt:not([disabled])')[+e.key - 1]; if (o) o.click(); }
});

/* ---------- start ---------- */
$('#back').onclick = function (e) { e.preventDefault(); back(); };
render();
fetch(BASE + 'lab-data.json' + V).then(function (r) { if (!r.ok) throw new Error('data'); return r.text(); }).then(function (t) {
  dataText = t;
  DATA = JSON.parse(t); DATA.passages.forEach(function (p) { PBY[p.id] = p; });
  try { PASS = JSON.parse(t).passages; PASS.forEach(function (p) { BYID[p.id] = p; }); if (!S.started) drawTen(); } catch (e) { /* the worker reports it */ }
  onReady.push(function () {
    if (S.lv > END || (S.lv < END && !reach(S.lv)) || (S.lv === END && !S.done[LEVELS[END - 1].id])) { S.lv = 0; S.beat = 0; }
    if (S.lv < END && S.beat >= beats(LEVELS[S.lv]).length) S.beat = 0;
    render();
  });
  boot();
}).catch(loadFail);
})();
