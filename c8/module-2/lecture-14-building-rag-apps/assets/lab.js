/* RAG Lab (Lecture 14, code track). Nine levels. ONE THING PER SCREEN:
     guess  ->  code (change one marked line)  ->  result (one finding)  ->  say (one interview question, aloud)
   The headline is the instruction (h1.do, coral dot) or the finding (plain h1). Continue is added only when the
   screen's one action is done. No rail, no table, no points (Evals Lab UI rules).
   Python runs in lab-worker.js. Every number shown comes from the worker (INFO), computed on the 183 passages,
   except the facts marked REAL RUN, measured on the live LLM on 21 Nov 2026.
   State: localStorage c8.l14.lab2. The Groq key (level 7 only) lives in sessionStorage c8.l11.key, shared with the benches. */
(function () {
'use strict';
var BASE = '/c8/module-2/lecture-14-building-rag-apps/assets/', V = '?v=4';
var API = '/api/retrieve', MODEL = 'openai/gpt-oss-120b', KEYS = 'c8.l11.key', STORE = 'c8.l14.lab2';
var FREE_TPM = 8000;
/* the bench's own rule for "it says the notes do not cover it" (bench.js RULES.Q4), unchanged */
var NOTIN = /(passages|notes|context)[^.]{0,50}\b(do not|don['’]t|does not|doesn['’]t|did not|didn['’]t|not)\s+(contain|include|mention|cover|say|describe|provide|address|state|specify|discuss|show|explain|teach)|\bnone of (the|these|our) (passages|notes|lectures)\b[^.]{0,40}\b(mention|cover|show|explain|describe|address|discuss|teach)|\bno lecture\b|\b(not|n['’]t)\s+(in|part of|covered (in|by)|mentioned in)\s+(the|our|my|your|these)\s+(notes|passages)|\bno (information|mention|details?|lecture)\b[^.]{0,40}\b(in|from|within)\s+(the|our|these)\s+(notes|passages)/i;

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var num = function (n) { return Number(n).toLocaleString('en-US'); };
var txt = function (v, a) { return typeof v === 'function' ? v(a) : v; };

/* ---------- state ---------- */
var BLANK = function () { return { started: false, lv: 0, beat: 0, done: {}, code: {}, built: false, guess: {}, runs: {}, hint: {}, stars: {}, said: {}, pick: null, filter: null, live: null, answers: null, cases: {}, wrong: 0 }; };
var S = BLANK();
try { var saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved && typeof saved === 'object') for (var k in S) if (saved[k] != null) S[k] = saved[k]; } catch (e) { /* start fresh */ }
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* memory only */ } }
var groqKey = ''; try { groqKey = sessionStorage.getItem(KEYS) || ''; } catch (e) { /* asked when needed */ }

var INFO = null;
var GOLD = 'ABCDEFGHIJ'.split('');
var rk = function (m, q) { return INFO.board[m][q]; };
var found = function (m) { return GOLD.filter(function (q) { return INFO.board[m][q] <= 3; }).length; };
var qtext = function (id) { return INFO.questions.filter(function (q) { return q.id === id; })[0].q; };
function lowestReal() { var best = null; GOLD.forEach(function (id) { if (!best || INFO.top[id] < best.top) best = { id: id, top: INFO.top[id] }; }); return best; }
var METHOD = { shared: 'Shared words', rare: 'Rare words', meaning: 'Meaning', merged: 'Merged', pick: 'Yours' };

/* ---------- the levels: every string is one short thing ---------- */
var LEVELS = [
  { id: 'count', seg: 'Count',
    guess: { q: 'You paste all 183 passages of our notes with one question. What comes back?', opts: ['The right answer', 'A wrong answer', 'A refusal'], right: 2 },
    h1: 'Add up the tokens of every passage.',
    ctx: 'Write your code where the marked line is. Then press Run.',
    starter: 'def total_tokens(passages):\n    total = 0\n    # your code here. The size of one passage p is p["tokens"]\n    return total\n',
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
    starter: 'def score(question, passage):\n    q = set(words(question))           # the words in the question\n    p = set(words(passage["text"]))    # the words in the passage\n    return 0       # change this: how many words are in both?\n',
    hint: 'q & p is the set of words that are in both.\nreturn len(q & p)',
    res: function () { return 'Found ' + found('shared') + ' of 10.'; },
    note: 'Ten questions, and we know the right passage for each. Green: it landed in the top 3. Every word counts the same here, so "the" weighs as much as "forgets".',
    name: 'Ten questions with known answers are a <b>golden set</b>. "Found in the top 3" is <b>recall@3</b>.',
    iq: 'How do you know your retrieval works?',
    asked: [{ at: 'Google', q: 'Evaluate retrieval precision and recall separately from generation quality.', s: 'gg' }, { at: 'Meta', via: 'PracHub', q: 'How would you measure whether adding retrieval improved an LLM product?', s: 'ss' }],
    ia: function () { return 'I keep a small set of questions where I know which passage holds the answer. After every change I count how often that passage lands in the top 3. Counting shared words found ' + found('shared') + ' of 10. That number is where I started.'; } },

  { id: 'rare', seg: 'Rare words', rows: ['shared', 'rare'],
    guess: { q: function () { return 'Shared words found ' + found('shared') + ' of 10. If rare words count more, how many?'; }, opts: ['6', '8', '10'], right: 0 },
    h1: 'Make rare words count more.',
    ctx: function () { return '"lecture" is in ' + INFO.seen.lecture + ' passages. "law" is in ' + INFO.seen.law + '. On the marked line, replace the 1 with <code>math.log(N / seen_in(w))</code>.'; },
    starter: 'def score(question, passage):\n    q = set(words(question))\n    p = set(words(passage["text"]))\n    total = 0\n    for w in q & p:\n        total += 1          # change this line\n    return total\n',
    hint: 'total += math.log(N / seen_in(w))\nseen_in(w) is how many passages contain w. N is the number of passages.',
    res: function () { return 'Found ' + found('rare') + ' of 10.'; },
    note: function () { return 'B is still at place ' + rk('rare', 'B') + '. The question says "making things up". The notes say "hallucinate". Counting words cannot know those mean the same.'; },
    name: 'This is the core of <b>BM25</b>, the keyword search inside most search boxes.',
    iq: 'When is keyword search the right choice?',
    asked: [{ at: 'Microsoft, Perplexity, Glean', q: 'How do you choose between a sparse retriever (BM25) and a dense retriever? When do you need both?', s: 'gh' }],
    ia: function () { return 'When the question carries the exact word: a name, a code, an error message. It needs no model, and I can explain every score. It fails when people use other words: "making things up" was at place ' + rk('rare', 'B') + '.'; } },

  { id: 'meaning', seg: 'Meaning', rows: ['rare', 'meaning'],
    guess: { q: function () { return '"' + qtext('F') + '" is at place ' + rk('rare', 'F') + ' by its words. By its meaning it will be:'; }, opts: ['Still at place 1', 'In the top 3', 'Outside the top 3'], right: 2 },
    h1: 'Measure how close two meanings are.',
    ctx: 'Every text comes with 384 numbers for its meaning. Multiply the two lists pair by pair and add it up.',
    starter: 'def closeness(a, b):\n    total = 0\n    # your code here: for each pair x, y in zip(a, b), add x * y\n    return total\n',
    hint: 'for x, y in zip(a, b):\n    total += x * y',
    res: function () { return 'Found ' + found('meaning') + ' of 10.'; },
    note: 'B and D are found now. F and J, which words found, are lost. Neither search wins every question.',
    name: 'The 384 numbers are an <b>embedding</b>. What you wrote is <b>cosine similarity</b>. A <b>vector database</b> does this same sort, made fast.',
    iq: 'Do you need a vector database?',
    asked: [{ at: 'Cohere', q: 'An enterprise wants semantic search over ~100M documents but is balking at vector-index cost. Walk me through embedding compression options and the maths.', s: 'gh' }],
    ia: function () { return 'Not yet. 183 passages times 384 numbers times 4 bytes is ' + Math.round(INFO.bytes / 1000) + ' KB, and a plain sort is instant. At 100 million passages that is about 154 GB, and then I need an index that skips most of them.'; } },

  { id: 'merge', seg: 'Merge', rows: ['meaning', 'merged'],
    guess: { q: function () { return 'Words found ' + found('rare') + '. Meaning found ' + found('meaning') + '. Merge both lists: how many of 10?'; }, opts: ['10', '9', '7'], right: 2 },
    h1: 'Merge the two lists into one.',
    ctx: 'A passage gets <code>1 / (60 + place)</code> points from each list. On the marked line, change the last 0.',
    starter: 'def fuse(by_words, by_meaning):\n    points = {}\n    for ranked in (by_words, by_meaning):\n        for place, pid in enumerate(ranked, start=1):\n            points[pid] = points.get(pid, 0) + 0   # change the last 0\n    return sorted(points, key=points.get, reverse=True)\n',
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
    starter: 'def pick(by_words, by_meaning):\n    return by_meaning[:3]       # change this. Two lists join with +\n',
    hint: 'return by_words[:1] + by_meaning[:3]\nThen change the two numbers and run again.',
    res: function () { return 'Found ' + S.pick.n + ' of 10, at about ' + num(S.pick.avg) + ' tokens.'; },
    note: function () { return 'Meaning alone found ' + found('meaning') + ' at about ' + num(INFO.meaningTokens) + ' tokens. You paid more tokens to find more.'; },
    again: 'Try for a better trade',
    name: 'How many passages you keep is <b>top-k</b>. Real systems fetch 50 to 100, then a slower model reorders them and keeps 5 to 10: a <b>reranker</b>.',
    iq: 'How do you choose top-k?',
    asked: [{ at: 'Cohere', q: 'You have an embedding model and a reranker. Why sell both? Design the two-stage retrieval pipeline and tell me when the reranker earns its latency.', s: 'gh' }, { at: 'Amazon', via: 'PracHub', q: 'What is a reranker model, and where does it sit in the RAG stack?', s: 'ss' }],
    ia: function () { return 'I measure found against tokens. Three passages by meaning found ' + found('meaning') + ' of 10 at about ' + num(INFO.meaningTokens) + ' tokens. My choice found ' + S.pick.n + ' of 10 at about ' + num(S.pick.avg) + '. I stop adding passages when found stops rising.'; } },

  { id: 'prompt', seg: 'Not there', live: true,
    guess: { q: function () { return 'Nothing in our notes covers the App Store. Its nearest passage has closeness ' + INFO.top.X.toFixed(3) + '. Can a closeness cut-off refuse it, without refusing a real question?'; }, opts: ['Yes', 'No'], right: 1 },
    h1: 'Write a prompt that admits when the answer is not there.',
    /* REAL RUN, 21 Nov 2026, GPT-OSS-120B: with "Answer the question using these passages from our lecture notes." it answered
       "Lecture 8" in 2 of 3 runs; with "If they do not answer it, say it is not in the notes." it refused 3 of 3. */
    ctx: 'With a plain instruction, the LLM answered "Lecture 8" in 2 of 3 runs. Add your instruction and the question on the marked line.',
    starter: 'def build_prompt(question, passages):\n    text = ""\n    for p in passages:\n        text += "[" + p["id"] + "] " + p["text"] + "\\n\\n"\n    text += ""      # change this: your instruction, then the question\n    return text\n',
    hint: 'text += "Answer only from these passages. If they do not answer it, say it is not in the notes. Name the [id] you used.\\n\\nQuestion: " + question',
    res: function () { return S.live === 'pass' ? 'It said: not in the notes.' : 'Not tested on the LLM yet.'; },
    note: function () { var lo = lowestReal(); return 'A cut-off cannot do this. The App Store question scores ' + INFO.top.X.toFixed(3) + '. Question ' + lo.id + ', which has an answer, scores ' + lo.top.toFixed(3) + '. One line in the instruction does.'; },
    name: 'Answering only from the passages is <b>grounding</b>. Naming the passage is a <b>citation</b>. Saying it is not there is <b>abstaining</b>.',
    iq: 'How do you stop it answering when the documents do not cover the question?',
    asked: [{ at: 'Microsoft', via: 'Glassdoor, 2026', q: 'What are hallucinations, and how do you avoid them?', s: 'ss' }, { at: 'Anthropic, OpenAI, Cursor', q: 'How do you detect and measure hallucinations in a production RAG system?', s: 'gh' }],
    ia: function () { var lo = lowestReal(); return 'A closeness cut-off did not work: my question with no answer scored ' + INFO.top.X.toFixed(3) + ', above a real one at ' + lo.top.toFixed(3) + '. So the instruction gives the LLM a way out, every answer names its passage id, and I keep questions with no answer in my test set.'; } },

  { id: 'filter', seg: 'Filter',
    guess: { q: 'A no-code learner must not get code-track notes. You search first, then remove the code-track passages from the top 3. How many are left?', opts: ['3', '1', '0'], right: 2 },
    h1: 'Let a learner see only what their track may see.',
    ctx: 'Lectures 3, 5 and 12 are code-track notes. Change the marked line.',
    starter: 'def can_see(passage, track):\n    # track is "code" or "no-code".  CODE_ONLY is [3, 5, 12].\n    return True     # change this. Use passage["lecture"]\n',
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
function beats(L) {
  if (L.quiz) return ['case0', 'case1', 'case2', 'say'];
  return (L.guess ? ['guess'] : []).concat(['code'], L.live ? ['live'] : [], ['result', 'say']);
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
  if (b === 'guess') return guess(L);
  if (b === 'code') return code(L);
  if (b === 'live') return live(L);
  if (b === 'result') return result(L);
  if (b === 'say') return say(L);
  return oneCase(L, +b.slice(4));
}

function intro() {
  head('Build the search behind RAG, one line at a time.', false, 'Nine short levels. Every level goes the same way:');
  $('#back').hidden = true;
  $('#stage').innerHTML = '<ol class="brief"><li><b>Guess</b> what will happen.</li><li><b>Change one marked line</b> of Python and press Run.</li><li><b>See</b> how many of ten questions your search finds.</li><li><b>Say</b> one interview answer aloud.</li></ol>' +
    '<p class="small">Python runs in this page. Nothing to install.</p>';
  $('#fwd').innerHTML = '<button class="btn primary big" id="start" type="button"' + (ready ? '' : ' disabled') + '>' + (ready ? (S.done.count || S.guess.count ? 'Carry on' : 'Start') : 'Getting Python ready') + '</button>';
  $('#start').onclick = function () { S.started = true; save(); go(S.lv, S.beat); };
}

function guess(L) {
  var g = L.guess, mine = S.guess[L.id];
  head(txt(g.q), !mine, mine ? '' : 'Guess first. You find out after you write the code.');
  $('#stage').innerHTML = '<div class="opts">' + g.opts.map(function (o, i) {
    return '<button type="button" class="opt' + (mine && mine.i === i ? ' sel' : '') + '" data-i="' + i + '"' + (mine ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd>' + esc(o) + '</button>';
  }).join('') + '</div>';
  $$('.opt').forEach(function (b) { b.onclick = function () { S.guess[L.id] = { i: +b.dataset.i, right: +b.dataset.i === g.right }; save(); next(); }; });
  if (mine) forward();
}

var cm = null;
function codeOk(L) { return L.live ? S.built : !!S.done[L.id]; }
function code(L) {
  head(L.h1, !codeOk(L), txt(L.ctx));
  $('#stage').innerHTML = '<div class="cmwrap" id="cmwrap"></div>' +
    '<div class="runrow"><button class="btn primary" id="run" type="button">Run</button><button class="btn quiet" id="hintb" type="button">' + (S.hint[L.id] ? 'Show the hint' : 'Stuck? Show a hint (costs a star)') + '</button></div>' +
    '<pre class="hint" id="hint" hidden></pre><div class="out" id="out" aria-live="polite"></div>';
  cm = CodeMirror($('#cmwrap'), {
    value: S.code[L.id] != null ? S.code[L.id] : L.starter, mode: 'python', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, viewportMargin: Infinity, lineWrapping: true,
    extraKeys: { Tab: function (c) { c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'); }, 'Shift-Tab': function (c) { c.indentSelection('subtract'); }, 'Ctrl-Enter': doRun, 'Cmd-Enter': doRun }
  });
  markLine();
  cm.on('change', function () { S.code[L.id] = cm.getValue(); save(); });
  $('#run').onclick = doRun;
  $('#hintb').onclick = function () {
    S.hint[L.id] = true; save();
    var h = $('#hint'); h.hidden = false;
    h.innerHTML = esc(L.hint) + '\n<a href="#" id="reset">Start this code again</a>';
    $('#reset').onclick = function (e) { e.preventDefault(); cm.setValue(L.starter); markLine(); cm.focus(); };
    this.hidden = true;
  };
  if (codeOk(L)) { $('#out').innerHTML = '<p class="pass">It works.</p>'; forward(); }
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
  runPy(L.id, cm.getValue()).then(function (r) { showRun(L, r); }, function (e) { $('#out').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; })
    .then(function () { var x = $('#run'); if (x) { x.disabled = false; x.textContent = 'Run'; } });
}
/* after a run: one line. Either it works, or the first thing that is wrong. */
function showRun(L, r) {
  var pass = !r.error && r.tests.length && r.tests.every(function (t) { return t.ok; });
  var printed = r.out ? '<div class="printed"><b>Printed</b><pre>' + esc(r.out) + '</pre></div>' : '';
  $('#fwd').innerHTML = '';
  if (!pass) {
    if (L.live) { S.built = false; save(); }
    var bad = r.tests.filter(function (t) { return !t.ok; })[0];
    $('#out').innerHTML = (r.error ? '<p class="err"><b>Python stopped.</b> ' + esc(r.error) + '</p>'
      : '<p class="err"><b>Not yet.</b> ' + esc(bad.name) + '.' + (bad.note ? ' <span>' + esc(bad.note) + '</span>' : '') + '</p>') + printed;
    return;
  }
  if (L.id === 'pick') {            // keep the best passing run: most found, then fewest tokens
    var p = r.extra, old = S.pick;
    if (!old || p.n > old.n || (p.n === old.n && p.avg <= old.avg)) S.pick = p;
  }
  if (L.id === 'filter') S.filter = r.extra;
  if (L.live) { S.built = true; lastPrompts = r.extra.prompts; } else finishLevel(L);
  save(); paintBar(); $('#ins').className = '';
  $('#out').innerHTML = '<p class="pass">It works.</p>' + printed;
  forward();
}

/* level 7: the two prompts go to the LLM, on the learner's own key */
var lastPrompts = null;
function live(L) {
  var done = S.live === 'pass';
  head(done ? 'The LLM got your prompt.' : 'Send your prompt to the LLM.', !done, done ? '' : 'Twice: once with the App Store question, once with a question the notes do answer.');
  if (!lastPrompts && !done) {      // the page was reloaded: build the prompts again from the saved code
    $('#stage').innerHTML = '<p class="small">Getting your prompt ready.</p>';
    runPy(L.id, S.code[L.id] || L.starter).then(function (r) { if (r.extra && r.extra.prompts && r.extra.prompts.X && r.extra.prompts.B) { lastPrompts = r.extra.prompts; live(L); } else go(S.lv, S.beat - 1); }, function () { go(S.lv, S.beat - 1); });
    return;
  }
  var html = '';
  if (!done) {
    if (!groqKey) html += '<label class="keyl">Your Groq key, the same one as on the bench<input id="key" type="password" autocomplete="off" spellcheck="false" placeholder="gsk_..."></label>';
    html += '<div class="runrow"><button class="btn primary" id="send" type="button">Send</button><button class="btn quiet" id="skip" type="button">No key right now: skip this</button></div>';
  }
  $('#stage').innerHTML = html + '<div id="answers" aria-live="polite"></div>';
  if (S.answers) paintAnswers(S.answers);
  if (done || S.live === 'skipped') forward();
  if (done) return;
  $('#skip').onclick = function () { S.live = 'skipped'; finishLevel(L); save(); next(); };
  $('#send').onclick = function () {
    var b = this, k = $('#key');
    if (k) { var v = k.value.trim(); if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) { $('#answers').innerHTML = '<p class="err">A Groq key starts with gsk_. Copy the whole key.</p>'; return; } groqKey = v; }
    b.disabled = true; b.textContent = 'Sending';
    var jobs = [['X', qtext('X'), 'Passes when it says the notes do not cover it.', function (a) { return NOTIN.test(a); }],
                ['B', qtext('B'), 'Passes when it names passage [L10.s03.1] or [L10.s04.1].', function (a) { return /L10\.s0[34]\.1/.test(a); }]];
    var results = [];
    var one = function (i) {
      if (i >= jobs.length) return Promise.resolve();
      var j = jobs[i], pr = lastPrompts[j[0]].prompt;
      return post({ op: 'chat', request: { model: MODEL, messages: [{ role: 'user', content: pr }] } }).then(function (d) {
        var a = d.refused ? '' : (d.raw && d.raw.content) || '';
        results.push({ q: j[1], rule: j[2], prompt: pr.slice(0, 6000), answer: (a || 'Groq refused the request: it was too large for the key.').slice(0, 900), ok: !!a && j[3](a) });
        return one(i + 1);
      });
    };
    one(0).then(function () {
      try { sessionStorage.setItem(KEYS, groqKey); } catch (e) { /* this tab only */ }
      S.answers = results;
      if (results.every(function (x) { return x.ok; })) { S.live = 'pass'; finishLevel(L); save(); paintBar(); return live(L); }
      save(); paintAnswers(results);
      $('#answers').insertAdjacentHTML('beforeend', '<p class="note"><a href="#" id="fix">Go back and change your instruction</a>, then send again.</p>');
      $('#fix').onclick = function (e) { e.preventDefault(); go(S.lv, S.beat - 1); };
    }, function (e) {
      if (e.code === 'need_key') { groqKey = ''; try { sessionStorage.removeItem(KEYS); } catch (x) { /* ignore */ } live(L); }
      $('#answers').innerHTML = '<p class="err">' + esc(e.message) + '</p>';
    }).then(function () { var s = $('#send'); if (s) { s.disabled = false; s.textContent = 'Send'; } });
  };
}
function paintAnswers(list) {
  $('#answers').innerHTML = list.map(function (x) {
    return '<div class="ans ' + (x.ok ? 'ok' : 'no') + '"><p class="at">' + esc(x.q) + '</p><p class="aa">' + esc(x.answer) + '</p><p class="rule"><b>' + (x.ok ? 'Pass.' : 'Fail.') + '</b> ' + esc(x.rule) + '</p>' +
      '<details><summary>The prompt you sent, exactly</summary><pre>' + esc(x.prompt) + '</pre></details></div>';
  }).join('');
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
      $('#tq').innerHTML = '<b>' + q + '</b> ' + esc(qtext(q)) + (m === 'pick' ? '' : ' <span>Right passage at place ' + rk(m, q) + ' by ' + METHOD[m].toLowerCase() + '.</span>');
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
  return '<div class="asked"><p class="ak">Asked in AI engineer interviews at</p>' +
    list.map(function (a) { return '<p class="aq"><b>' + esc(a.at) + '</b>' + (a.via ? ' <span>(' + esc(a.via) + ')</span>' : '') + '<q>' + esc(a.q) + '</q></p>'; }).join('') +
    '<p class="as">Reported by candidates. Source: ' + used.map(function (k) { return '<a href="' + SRC[k].u + '" target="_blank" rel="noopener">' + esc(SRC[k].t) + '</a>'; }).join(', ') + '</p></div>';
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
    '<div class="runrow"><button class="btn primary" id="copy" type="button">Copy it</button><button class="btn quiet" id="over" type="button">Start again from level 1</button></div>';
  $('#copy').onclick = function () {
    var b = this, done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy it'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines.join('\n')).then(done, function () { b.textContent = 'Select the text and copy it'; });
    else b.textContent = 'Select the text and copy it';
  };
  $('#over').onclick = function () { S = BLANK(); lastPrompts = null; save(); render(); window.scrollTo(0, 0); };
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
  onReady.push(function () {
    if (S.lv > END || (S.lv < END && !reach(S.lv)) || (S.lv === END && !S.done[LEVELS[END - 1].id])) { S.lv = 0; S.beat = 0; }
    if (S.lv < END && S.beat >= beats(LEVELS[S.lv]).length) S.beat = 0;
    render();
  });
  boot();
}).catch(loadFail);
})();
