/* Writing Evals from First Principles: the session page. Plan: _plan/writing-evals/PLAN.md
   One screen, one thing to do. The headline is the instruction; Continue appears only once the thing is done.
   Six segments as in the 90-minute run of show. State lives in localStorage (c8store, key we.v1).
   Room mode (?room=code, or typed on the first screen) posts to an Apps Script web app and reads it once per screen; without it,
   the recorded room in data/cohort.json stands in. Expert labels are sealed behind /api/evals-labels.
   The judge runs on the student's own Groq key from the browser; the recorded first-draft run stands in without one. */
(function () {
  'use strict';
  /* Apps Script /exec URL for room mode: deploy _plan/writing-evals/apps-script.gs and paste it here. Empty = solo only. */
  var ROOM_URL = '';
  /* a dry run can point at another sheet without a deploy: localStorage we.roomUrl */
  try { ROOM_URL = localStorage.getItem('we.roomUrl') || ROOM_URL; } catch (e) {}
  var LABELS_URL = '/api/evals-labels';
  var DATA = '/c8/writing-evals/data/';
  var JUDGE_MODEL = 'openai/gpt-oss-20b';
  var KEY = 'we.v1';
  var SEGS = [['The hook', '0:00'], ['The instrument', '0:10'], ['Blind grading', '0:22'], ['Three layers', '0:40'], ['Judge the judge', '0:55'], ['GDPval and close', '1:15']];
  var IND_ORDER = ['support', 'legal', 'health', 'mfg', 'fin'];
  var IND_NAMES = { support: 'Support', legal: 'Legal', health: 'Healthcare', mfg: 'Manufacturing', fin: 'Finance' };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var store = window.c8store || { get: function (k, d) { return d; }, set: function () {} };
  var track = function (name, props) { try { window.posthog && window.posthog.capture(name, props || {}); } catch (e) {} };

  var S = store.get(KEY, null) || {};
  if (!S.cid) S.cid = Math.random().toString(36).slice(2, 10);
  S.i = S.i || 0; S.max = S.max || 0; S.t = S.t || {}; S.a = S.a || {}; S.grades = S.grades || {}; S.sort = S.sort || {};
  S.runs = S.runs || {}; S.labels = S.labels || {}; S.checks = S.checks || {}; S.ticket = S.ticket || {};
  var qs = new URLSearchParams(location.search);
  if (qs.get('room')) S.pendingRoom = qs.get('room').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
  function save() { store.set(KEY, S); }

  /* ---------- data ---------- */
  var cache = {};
  function get(path) { return cache[path] || (cache[path] = fetch(DATA + path).then(function (r) { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); })); }
  function ind() { return S.industry ? get('industries/' + S.industry + '.json') : Promise.reject(new Error('no industry')); }

  /* ---------- room ---------- */
  var room = {
    on: function () { return !!(S.room && ROOM_URL); },
    post: function (kind, payload) {
      if (!room.on()) return;
      fetch(ROOM_URL, { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ room: S.room, cid: S.cid, kind: kind, payload: payload }) }).catch(function () {});
    },
    pull: function (kind) {
      return fetch(ROOM_URL + '?room=' + encodeURIComponent(S.room) + '&kind=' + kind).then(function (r) { return r.json(); }).then(function (j) {
        var by = {}; (j.rows || []).forEach(function (r) { by[r.cid] = r; });
        return Object.keys(by).map(function (k) { return by[k]; });
      });
    }
  };
  var timers = [];
  function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function stopAll() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }

  /* ---------- small pieces ---------- */
  function h(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function reveal(html) { return h('<div class="reveal">' + html + '</div>'); }
  function field(id, label, value, ph, rows) {
    return '<div class="field"><label class="lab" for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '" data-nolabel>' + esc(value || '') + '</textarea></div>';
  }
  function pct(x) { return Math.round(x) + '%'; }
  function within1(a, b, dims) {
    var n = 0, ok = 0;
    Object.keys(a).forEach(function (id) {
      if (!b[id]) return;
      dims.forEach(function (d) { if (a[id][d] == null || b[id][d] == null) return; n++; if (Math.abs(a[id][d] - b[id][d]) <= 1) ok++; });
    });
    return n ? 100 * ok / n : 0;
  }
  function splitAB(labels) { var A = {}, B = {}; Object.keys(labels.items).forEach(function (id) { A[id] = labels.items[id].a; B[id] = labels.items[id].b; }); return { A: A, B: B }; }
  function roomAgreement(sheets, n) {
    var tot = 0, cnt = 0;
    for (var j = 0; j < n; j++) {
      var col = sheets.map(function (s) { return s[j]; }).filter(function (x) { return x; }), pairs = 0, ok = 0;
      for (var a = 0; a < col.length; a++) for (var b = a + 1; b < col.length; b++) { pairs++; if (Math.abs(col[a] - col[b]) <= 1) ok++; }
      if (pairs) { tot += ok / pairs; cnt++; }
    }
    return cnt ? 100 * tot / cnt : 0;
  }
  function refHTML(it, I) {
    var r = it.reference, out = '<p class="kick">' + esc(r.title) + '</p>';
    if (r.kind === 'table') out += '<table class="acct">' + r.rows.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</table>';
    if (r.kind === 'list') out += '<ul style="margin:6px 0;padding-left:18px;font-size:14px">' + r.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (r.kind === 'grid') out += '<div class="tbl-wrap"><table class="ind" style="min-width:640px"><tr>' + r.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr>' + r.rows.map(function (row) { return '<tr>' + row.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
    if (r.kind === 'note') out += '<p style="font-size:14.5px">' + esc(r.text) + '</p>';
    if (r.note) out += '<p class="note">' + esc(r.note) + '</p>';
    return out;
  }
  function refText(it, I) {
    var r = it.reference, t = r.title + '\n';
    if (r.kind === 'table') t += r.rows.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n');
    if (r.kind === 'list') t += r.items.join('\n');
    if (r.kind === 'grid') t += [r.head].concat(r.rows).map(function (x) { return x.join(' | '); }).join('\n');
    if (r.kind === 'note') t += r.text;
    if (r.note) t += '\n' + r.note;
    if (I.policy) t += '\n\nBilling policy\n' + I.policy.map(function (p, k) { return (k + 1) + '. ' + p; }).join('\n');
    return t;
  }
  function itemHTML(it, I) {
    return '<div class="itemview"><div class="case"><div class="card"><p class="kick">Input</p><p style="font-size:14.5px">' + esc(it.input) + '</p><div style="margin-top:12px">' + refHTML(it, I) + '</div></div>' +
      '<div class="card reply"><p class="kick">Output ' + esc(it.id) + '</p><pre style="margin:0;background:none;border:0;padding:0;font:14px/1.6 var(--sans);white-space:pre-wrap">' + esc(it.output) + '</pre></div></div></div>';
  }

  /* ---------- the board: four parts, drawn as on a whiteboard ---------- */
  var PARTS = [
    { k: 'decision', t: 'Decision', s: 'what we do differently when the number moves' },
    { k: 'population', t: 'Population of inputs', s: 'sampled from the world you care about, not the convenient one' },
    { k: 'good', t: 'Definition of good', s: 'written down before you see any outputs' },
    { k: 'grader', t: 'Grader', s: 'with an error rate you have measured' }];
  function board(n, opts) {
    opts = opts || {};
    var el = h('<div class="board" role="img" aria-label="The four parts of an eval"></div>');
    PARTS.forEach(function (p, k) {
      var on = k < n, notes = opts.notes && opts.notes[p.k];
      el.appendChild(h('<div class="bx' + (on ? ' on' : '') + (opts.now === k ? ' now' : '') + '"><svg aria-hidden="true"><rect x="2" y="2" rx="10" ry="10" class="' + (opts.now === k ? 'draw' : '') + '"/></svg>' +
        '<span class="n">' + (k + 1) + '</span><b class="t">' + (on ? esc(p.t) : '?') + '</b>' + (on ? '<span class="s">' + esc(p.s) + '</span>' : '') +
        (notes ? '<span class="g">' + esc(notes) + '</span>' : '') + '</div>'));
    });
    return el;
  }

  /* ---------- the judge ---------- */
  function judgePrompt(I, anchors) {
    var sys = 'You grade one output for this task: ' + I.task + '. Use only the rubric below. Score each dimension from 1 to 5.\n' +
      'Reply with JSON only, no other text: {"scores": {' + I.dims.map(function (d) { return '"' + d.key + '": n'; }).join(', ') + '}, "quote": "the few words of the output that most lowered a score"}\n\nRUBRIC\n' +
      I.dims.map(function (d) { var a = anchors[d.key] || {}; return d.name + ' (' + d.key + ')\n  1 = ' + (a[1] || '') + '\n  5 = ' + (a[5] || ''); }).join('\n');
    return { sys: sys, user: function (it) { return 'TASK INPUT\n' + it.input + '\n\nREFERENCE\n' + refText(it, I) + '\n\nOUTPUT TO GRADE\n' + it.output; } };
  }
  function parseVerdict(text, dims) {
    var m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
    try {
      var j = JSON.parse(m[0]), sc = {}, ok = true;
      dims.forEach(function (d) { var v = Math.round(Number(j.scores && j.scores[d])); if (!(v >= 1 && v <= 5)) ok = false; sc[d] = v; });
      return ok ? { scores: sc, quote: String(j.quote || '').slice(0, 160) } : null;
    } catch (e) { return null; }
  }
  function groqOnce(key, sys, user, dims, tries) {
    tries = tries || 0;
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: JUDGE_MODEL, temperature: 0, max_tokens: 900, reasoning_effort: 'low', messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 429 && tries < 5) {
          var wait = (parseFloat(r.headers.get('retry-after')) || 4) * 1000;
          return new Promise(function (res) { setTimeout(res, wait); }).then(function () { return groqOnce(key, sys, user, dims, tries + 1); });
        }
        if (!r.ok) { var e = new Error((j.error && j.error.message) || r.statusText); e.status = r.status; throw e; }
        var v = parseVerdict(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, dims);
        if (!v && tries < 2) return groqOnce(key, sys, user, dims, tries + 1);
        return v;
      });
    });
  }
  function getKey() { try { return sessionStorage.getItem('we.groq') || ''; } catch (e) { return ''; } }
  function setKey(k) { try { sessionStorage.setItem('we.groq', k); } catch (e) {} }
  /* runs the judge over every item; onRow(id, verdict) as rows land; resolves with the run */
  function runJudge(I, anchors, mode, onRow, onMsg) {
    var dims = I.dims.map(function (d) { return d.key; });
    var run = { mode: mode, model: mode === 'live' ? JUDGE_MODEL : 'recorded first-draft run (' + I.judge_model + ')', anchors: JSON.parse(JSON.stringify(anchors)), scores: {}, quotes: {}, at: Date.now() };
    if (mode === 'recorded') {
      return new Promise(function (res) {
        var k = 0;
        (function step() {
          var it = I.items[k]; if (!it) return res(run);
          var c = I.canned[it.id]; run.scores[it.id] = c.scores; run.quotes[it.id] = c.quote; onRow(it.id, c);
          k++; setTimeout(step, 70);
        })();
      });
    }
    var key = getKey(), P = judgePrompt(I, anchors), queue = I.items.slice(), done = 0, failed = 0, fatal = null;
    function worker() {
      var it = queue.shift(); if (!it || fatal) return Promise.resolve();
      return groqOnce(key, P.sys, P.user(it), dims).then(function (v) {
        if (v) { run.scores[it.id] = v.scores; run.quotes[it.id] = v.quote; onRow(it.id, v); } else failed++;
      }, function (e) { if (e.status === 401 || e.status === 403) fatal = e; else failed++; }).then(function () {
        done++; onMsg('Judged ' + done + ' of ' + I.items.length + (failed ? ' (' + failed + ' unreadable)' : '') + ' with ' + JUDGE_MODEL + '…'); return worker();
      });
    }
    return Promise.all([worker(), worker(), worker()]).then(function () {
      if (fatal) throw fatal;
      run.failed = failed; return run;
    });
  }

  /* ---------- hard constraints as code ---------- */
  var GENERIC = {
    contains: { name: 'Output contains…', arg: 'text', src: function (a) { return 'return output.toLowerCase().includes(' + JSON.stringify(String(a).toLowerCase()) + ');'; } },
    not_contains: { name: 'Output does not contain…', arg: 'text', src: function (a) { return 'return !output.toLowerCase().includes(' + JSON.stringify(String(a).toLowerCase()) + ');'; } },
    regex: { name: 'Output matches pattern…', arg: 'pattern', src: function (a) { return 'return new RegExp(' + JSON.stringify(String(a)) + ', "i").test(output);'; } },
    max_words: { name: 'Output is at most N words', arg: 'N', src: function (a) { return 'return output.trim().split(/\\s+/).length <= ' + (parseInt(a, 10) || 0) + ';'; } }
  };
  function checkSrc(I, c) {
    if (!c || !c.type || c.type === 'none') return null;
    if (c.type.indexOf('ck:') === 0) { var ck = I.checkers.filter(function (x) { return x.id === c.type.slice(3); })[0]; return ck ? ck.src : null; }
    var g = GENERIC[c.type]; return g && String(c.arg || '').trim() ? g.src(c.arg) : null;
  }
  function runChecks(I) {
    var cfg = S.checks[S.industry] || [], fns = cfg.map(function (c) { var src = checkSrc(I, c); try { return src ? new Function('output', 'context', src) : null; } catch (e) { return 'err'; } });
    var res = {};
    I.items.forEach(function (it) { res[it.id] = fns.map(function (f) { if (!f) return null; if (f === 'err') return false; try { return !!f(it.output, { vars: it.vars }); } catch (e) { return false; } }); });
    return res;
  }
  function vetoOf(I, id) {
    var r = (S.hardRun || {})[id]; if (!r) return null;
    var k = r.indexOf(false); return k < 0 ? null : (S.rubric.hard[k] || 'a hard constraint');
  }

  /* ---------- Promptfoo export ---------- */
  function q(s) { return JSON.stringify(String(s)); }
  function block(s, pad) { var p = ' '.repeat(pad); return '|\n' + String(s).replace(/\s+$/, '').split('\n').map(function (l) { return p + l; }).join('\n'); }
  function buildConfig(I, anchors) {
    var cfg = S.checks[S.industry] || [], lines = [];
    lines.push('# Writing Evals from First Principles (100xEngineers C8): ' + I.name + '. Exported ' + new Date().toISOString().slice(0, 10) + '.');
    lines.push('# Items are recorded outputs, so the provider is echo: it returns {{output}} unchanged and the assertions grade it.');
    lines.push('# Run:  export GROQ_API_KEY=...   then   npx promptfoo@latest eval -o results.json   then   python3 agreement.py');
    lines.push('description: ' + q('Writing Evals: ' + I.task));
    lines.push('prompts:\n  - "{{output}}"');
    lines.push('providers:\n  - echo');
    lines.push('defaultTest:\n  options:\n    provider: groq:' + JUDGE_MODEL);
    lines.push('tests:');
    I.items.forEach(function (it) {
      lines.push('  - description: ' + q(it.id));
      lines.push('    vars:');
      lines.push('      id: ' + q(it.id));
      lines.push('      input: ' + q(it.input));
      lines.push('      reference: ' + q(refText(it, I)));
      lines.push('      output: ' + q(it.output));
      Object.keys(it.vars).forEach(function (k) { lines.push('      ' + k + ': ' + JSON.stringify(it.vars[k])); });
      lines.push('    assert:');
      cfg.forEach(function (c, k) {
        var src = checkSrc(I, c); if (!src) return;
        lines.push('      - type: javascript');
        lines.push('        metric: ' + q('hard: ' + (S.rubric.hard[k] || 'rule ' + (k + 1)).slice(0, 60)));
        lines.push('        value: ' + block('// returns true when the rule holds; Promptfoo runs multi-line values as a function body\n' + src, 10));
      });
      I.dims.forEach(function (d) {
        var a = anchors[d.key] || {};
        lines.push('      - type: llm-rubric');
        lines.push('        metric: ' + d.key);
        lines.push('        value: ' + block('Grade only ' + d.name + ' for this task: ' + I.task + '.\n1 = ' + (a[1] || '') + '\n5 = ' + (a[5] || '') +
          '\nTask input: {{input}}\nReference: {{reference}}\nDecide points from 1 to 5. Set score to (points - 1) / 4, and pass to true when points is 3 or more.', 10));
      });
    });
    return lines.join('\n') + '\n';
  }
  var AGREEMENT_PY = [
    '"""Expert-vs-expert and judge-vs-expert agreement for a Writing Evals export.',
    '   python3 agreement.py [results.json]   (results.json from: npx promptfoo@latest eval -o results.json)',
    '   Agreement = share of (item, dimension) cells where two raters are within one point on 1 to 5."""',
    'import json, sys',
    'labels = json.load(open("expert_labels.json"))',
    'res = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "results.json"))',
    'rows = res.get("results", {}).get("results", []) if isinstance(res.get("results"), dict) else res.get("results", [])',
    'dims, judge = labels["dims"], {}',
    'for r in rows:',
    '    v = r.get("vars") or (r.get("testCase") or {}).get("vars") or {}',
    '    for c in ((r.get("gradingResult") or {}).get("componentResults") or []):',
    '        m = (c.get("assertion") or {}).get("metric")',
    '        if m in dims: judge.setdefault(v.get("id"), {})[m] = 1 + round(4 * float(c.get("score") or 0))',
    'def agree(a, b):',
    '    cells = [(i, d) for i in a if i in b for d in dims if d in a[i] and d in b[i]]',
    '    return 100 * sum(abs(a[i][d] - b[i][d]) <= 1 for i, d in cells) / max(1, len(cells))',
    'A = {i: x["a"] for i, x in labels["items"].items()}; B = {i: x["b"] for i, x in labels["items"].items()}',
    'ee = agree(A, B); je = (agree(judge, A) + agree(judge, B)) / 2',
    'print(f"expert vs expert {ee:.0f}%   judge vs experts {je:.0f}%   items judged {len(judge)}")',
    'print("ready for regression decisions" if je >= ee else "not ready: the judge agrees with experts less often than experts agree with each other")', ''].join('\n');
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = function () { res(window.JSZip); }; s.onerror = rej; document.head.appendChild(s); });
  }
  function exportZip(btn) {
    btn.disabled = true;
    Promise.all([ind(), loadZip()]).then(function (x) {
      var I = x[0], Z = new x[1](), anchors = (S.rubric2 && S.rubric2.anchors) || S.rubric.anchors, L = S.labels[S.industry];
      Z.file('promptfooconfig.yaml', buildConfig(I, anchors));
      if (L) { Z.file('expert_labels.json', JSON.stringify(L, null, 1)); Z.file('agreement.py', AGREEMENT_PY); }
      Z.file('README.md', '# ' + I.name + ': ' + I.task + '\n\nExported from Writing Evals from First Principles (100xEngineers, Cohort 8).\n\n' +
        '- Decision: ' + I.decision + '\n- Hard constraints run as `javascript` assertions and veto.\n- Quality dimensions run as `llm-rubric` assertions on `' + JUDGE_MODEL + '` via Groq.\n' +
        (L ? '- `expert_labels.json` holds the two expert passes; `agreement.py` prints both agreement numbers.\n' : '- Unlock the expert labels on the page to include them.\n') +
        '\n```\nexport GROQ_API_KEY=...\nnpx promptfoo@latest eval -o results.json\n' + (L ? 'python3 agreement.py\n' : '') + '```\n');
      return Z.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'writing-evals-' + S.industry + '.zip'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); track('we_export', { industry: S.industry });
    }).catch(function () { alertMsg(btn, 'Could not build the zip. Check your connection and try again.'); }).then(function () { btn.disabled = false; });
  }
  function alertMsg(near, text) { var m = near.parentNode.querySelector('.msg') || near.parentNode.appendChild(h('<p class="msg err"></p>')); m.textContent = text; m.classList.add('err'); }

  /* ---------- industry table (segment 4) ---------- */
  var TABLE = {
    cols: [['task', 'Industry and task', ''], ['decision', 'Decision it serves', 'hl'], ['hard', 'Hard constraints (code, vetoes)', 'hl-det'], ['quality', 'Quality dimensions (judge)', 'hl-prob'], ['pref', 'Preference baseline (human, pairwise)', 'hl-hum'], ['trap', 'Trap to warn about', 'hl']],
    notes: { task: 'Pick any column header.', decision: 'Different on every row, and it decides everything to its right.', hard: 'Always code, always run first, always veto. Only the rules change.', quality: 'Always a rubric a domain expert wrote, applied by a judge. Only the dimensions change.', pref: 'Always blind and pairwise, against a competent human\'s version, by people.', trap: 'Each trap is the place an unmeasured judge goes wrong for that industry.' },
    rows: [
      { task: 'Legal: motion to dismiss from a complaint', decision: 'Can associates edit rather than rewrite?', hard: 'Real citations only, correct caption, page limit', quality: 'Issue spotting, standard of review, argument order', pref: "An associate's first draft", trap: 'Judge rewards confident prose over correct law' },
      { task: 'Healthcare: nursing care plan from an admission note', decision: 'Regression gate for a documentation product', hard: 'No contraindicated intervention against allergies and medicines, no fabricated vitals', quality: 'Prioritisation, measurable goals, intervention specificity', pref: "A charge nurse's plan", trap: 'Thorough but unprioritised plans score well with naive judges' },
      { task: 'Manufacturing: supplier quote comparison', decision: 'Pick between two prompt strategies', hard: 'Totals recomputed, spec non-compliance flagged, units converted', quality: 'Landed-cost reasoning, risk flags, clarity of recommendation', pref: "A purchasing agent's spreadsheet", trap: 'The deliverable is a spreadsheet; the grader must open the file' },
      { task: 'Finance: memo on an earnings release', decision: 'External capability reporting', hard: 'Every number traceable to the filing, no forecasts stated as fact', quality: 'Thesis clarity, what actually changed, handling of uncertainty', pref: "An analyst's memo", trap: 'Contamination: use post-cutoff quarters and rotate' },
      { task: 'Support: billing dispute resolution', decision: 'Ship gate for a support agent', hard: 'No out-of-policy refund, no other customer\'s data, correct escalation', quality: 'Resolution, empathy, brevity', pref: "A senior agent's reply", trap: 'Multi-turn: simulate the customer and grade the whole conversation' }]
  };
  var PILES = {
    hard: { cls: 'det', name: 'Hard constraints', who: 'Binary. Code checks them first, and a fail vetoes everything else.' },
    quality: { cls: 'prob', name: 'Quality dimensions', who: 'Better or worse on a scale. A judge applies a written rubric.' },
    preference: { cls: 'hum', name: 'Preference', who: 'Would an expert pick this over the best human version? Blind and pairwise, by people.' }
  };

  /* =====================================================================================
     The screens
     ===================================================================================== */
  var SCREENS = [];
  function scr(o) { SCREENS.push(o); }

  scr({ id: 'start', seg: -1, kick: 'Cohort 8 · First week of November', h: 'Writing evals from first principles', wide: true,
    sub: '90 minutes, six parts. You will write the decision an eval serves, grade blind and disagree with the room, write a rubric in three layers, and test a judge against expert labels.',
    render: function (st) {
      st.appendChild(h('<ol class="outcomes"><li>Say what decision an eval serves, and reject one that serves none.</li><li>Name the inputs it has to be tested on.</li><li>Write a rubric in three layers: code, judge, human.</li><li>Measure a judge against experts, and read that number against how often experts agree.</li><li>Place GDPval and Promptfoo on the same map.</li></ol>'));
      var pend = S.pendingRoom || S.room || '';
      var c = h('<div class="start"><div class="card"><h3>In the room</h3><p>Your instructor shows a room code. Your answers join the room\'s, anonymously.</p>' +
        '<div class="row"><input type="text" id="rc" placeholder="room code" value="' + esc(pend) + '" style="max-width:200px" autocomplete="off" autocapitalize="off"><button class="btn go" id="join">Join</button></div><p class="msg" id="rmsg"></p></div>' +
        '<div class="card"><h3>On your own</h3><p>A recorded room of forty people stands in for the live one, so the disagreements still show up.</p><button class="btn" id="solo">Work alone</button></div></div>');
      st.appendChild(c);
      if (S.mode) st.appendChild(reveal('<p>' + (S.mode === 'room' ? 'You are in room <b>' + esc(S.room) + '</b>.' : 'You are working alone.') + ' Continue when you are ready.</p>'));
      $('#join', c).onclick = function () {
        var code = $('#rc', c).value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
        if (!ROOM_URL) { $('#rmsg', c).textContent = 'Room mode is not switched on for this session yet. Work alone; the recorded room stands in.'; return; }
        if (code.length < 3) { $('#rmsg', c).textContent = 'Type the code on the instructor\'s screen.'; return; }
        S.room = code; S.mode = 'room'; delete S.pendingRoom; save(); track('we_mode', { mode: 'room' }); go(S.i + 1);
      };
      $('#solo', c).onclick = function () { S.mode = 'solo'; S.room = ''; save(); track('we_mode', { mode: 'solo' }); go(S.i + 1); };
    },
    ready: function () { return !!S.mode; }, hint: 'Join the room or work alone.' });

  /* ---------- 1 the hook ---------- */
  scr({ id: 'hook', seg: 0, kick: 'Three minutes', h: 'Your VP says: "Evaluate our chatbot. You have a week. Go." What is the first thing you do?',
    render: function (st) {
      st.appendChild(h(field('f-move', 'The first thing you would do', S.a.move, 'One line')));
      var b = h('<button class="btn go">Submit</button>'); st.appendChild(b);
      var list = h('<ul class="room" aria-live="polite"></ul>'), n = h('<p class="room-n"></p>');
      function show() {
        st.appendChild(h('<p class="note" style="margin-top:20px">' + (room.on() ? 'The room so far:' : 'What a room of forty said first:') + '</p>'));
        st.appendChild(list); st.appendChild(n);
        if (room.on()) (function () { room.pull('move').then(function (rows) { list.innerHTML = rows.map(function (r) { return '<li' + (r.cid === S.cid ? ' class="me"' : '') + ' data-nolabel>' + esc(r.payload.text) + '</li>'; }).join(''); n.textContent = rows.length + ' answers'; }).catch(function () {}); })();
        else get('cohort.json').then(function (C) {
          list.innerHTML = '<li class="me" data-nolabel>' + esc(S.a.move) + '</li>';
          C.moves.forEach(function (m, k) { later(500 * (k + 1), function () { list.appendChild(h('<li>' + esc(m) + '</li>')); }); });
        });
        st.appendChild(h('<p class="note">Nobody is wrong yet.</p>'));
      }
      b.onclick = function () {
        var v = $('#f-move').value.trim(); if (!v) return $('#f-move').focus();
        S.a.move = v; save(); room.post('move', { text: v }); b.disabled = true; $('#f-move').disabled = true; show(); refresh();
      };
      if (S.a.move) { b.disabled = true; $('#f-move').disabled = true; show(); }
    },
    ready: function () { return !!S.a.move; }, hint: 'Write one line and submit.' });

  scr({ id: 'sixty', seg: 0, kick: 'One question', h: 'When you hand the VP a number, what will she do differently if it is 60 instead of 80?',
    render: function (st) {
      st.appendChild(h(field('f-60', 'What changes between 60 and 80', S.a.sixty, 'Leave it empty if you cannot say')));
      var b = h('<button class="btn">I have my answer</button>'); st.appendChild(b);
      function show() {
        if ($('.reveal', st)) return;
        S.a.sixtySeen = true; save();
        st.appendChild(reveal('<p>Most rooms leave this box empty, or write "it depends". That is the lesson.</p><p><b>An eval with no decision attached is theatre.</b> If no action changes when the score moves 20 points, do not build it.</p>'));
        refresh();
      }
      b.onclick = function () { S.a.sixty = $('#f-60').value.trim(); save(); show(); };
      if (S.a.sixtySeen) show();
    },
    ready: function () { return !!S.a.sixtySeen; }, hint: 'Answer, or tap the button with the box empty.' });

  scr({ id: 'part1', seg: 0, kick: 'Part one of four', h: 'Every eval starts with the decision it feeds.',
    render: function (st) {
      st.appendChild(board(1, { now: 0 }));
      st.appendChild(h('<p>Ship or hold. Prompt A or prompt B. Block the merge or let it through. Report progress or say nothing. Ask it of every eval you are shown: <b>what would we do differently if this score were 20 points lower?</b></p>'));
    }, ready: function () { return true; } });

  /* ---------- 2 derive the instrument ---------- */
  function deriveScreen(o) {
    scr({ id: o.id, seg: 1, kick: o.kick, h: o.h,
      render: function (st) {
        st.appendChild(h(field('f-' + o.id, 'Your answer', S.a[o.id], o.ph)));
        var b = h('<button class="btn go">Submit</button>'); st.appendChild(b);
        var out = h('<div></div>'); st.appendChild(out);
        function show() {
          b.disabled = true; $('#f-' + o.id).disabled = true; out.innerHTML = '';
          var list = h('<ul class="room"></ul>'); out.appendChild(h('<p class="note" style="margin-top:18px">' + (room.on() ? 'The room said:' : 'A room of forty said:') + '</p>')); out.appendChild(list);
          if (room.on()) (function () { room.pull('q').then(function (rows) { list.innerHTML = rows.filter(function (r) { return r.payload.step === o.id; }).slice(-14).map(function (r) { return '<li data-nolabel>' + esc(r.payload.text) + '</li>'; }).join(''); }).catch(function () {}); })();
          else get('cohort.json').then(function (C) { list.innerHTML = '<li class="me" data-nolabel>' + esc(S.a[o.id]) + '</li>' + C.phrases[o.cohort].map(function (p) { return '<li>' + esc(p) + '</li>'; }).join(''); });
          out.appendChild(board(o.n, { now: o.n - 1 }));
          out.appendChild(reveal(o.reveal));
          if (o.after) o.after(out);
          refresh();
        }
        b.onclick = function () { var v = $('#f-' + o.id).value.trim(); if (!v) return $('#f-' + o.id).focus(); S.a[o.id] = v; save(); room.post('q', { step: o.id, text: v }); show(); };
        if (S.a[o.id]) show();
      },
      ready: o.ready || function () { return !!S.a[o.id]; }, hint: 'Answer before you see the room.' });
  }
  deriveScreen({ id: 'inputs', kick: 'Part two', n: 2, cohort: 'inputs', ph: 'They have to be…', h: 'To make that decision, what has to be true about the inputs you test on?',
    reveal: '<p><b>Population of inputs.</b> Realistic, yes. The part rooms rarely say: <b>sampled from the world you care about, not the one that is convenient.</b> Twenty questions you wrote on a Tuesday are the convenient world.</p>' });
  deriveScreen({ id: 'good', kick: 'Part three', n: 3, cohort: 'good', ph: 'An output is good when…', h: 'How do you know an output is good?',
    reveal: '<p><b>Definition of good.</b> And one constraint nobody volunteers: it is <b>written down before you see any outputs.</b></p>',
    after: function (out) {
      out.appendChild(h(field('f-why', 'Why before?', S.a.why, 'One line')));
      var b = h('<button class="btn">Submit</button>'); out.appendChild(b);
      var r = h('<div></div>'); out.appendChild(r);
      function show() { b.disabled = true; $('#f-why').disabled = true; r.innerHTML = ''; r.appendChild(reveal('<p>Once you have read the outputs, you write the definition the outputs already meet. That is confirmation bias, and it makes every eval pass.</p>')); refresh(); }
      b.onclick = function () { var v = $('#f-why').value.trim(); if (!v) return $('#f-why').focus(); S.a.why = v; save(); room.post('q', { step: 'why', text: v }); show(); };
      if (S.a.why) show();
    },
    ready: function () { return !!(S.a.good && S.a.why); } });
  deriveScreen({ id: 'grader', kick: 'Part four', n: 4, cohort: 'grader', ph: 'It is applied by…', h: 'Who or what applies the definition, and how do you know it applies it correctly?',
    reveal: '<p><b>Grader.</b> Most rooms say "an LLM judge". Then: <b>how wrong is your judge?</b></p><p>Nobody knows. That is the fourth part: <b>a grader with an error rate you have measured.</b></p>' });

  scr({ id: 'four', seg: 1, kick: 'The instrument', h: 'Four parts. Every eval failure traces to one of them being missing or weak.',
    render: function (st) {
      st.appendChild(board(4));
      st.appendChild(h('<p>An eval is a measurement instrument. Without a decision it is theatre. With the convenient inputs it measures the wrong world. With a definition written after the fact it measures what you hoped. With an unmeasured grader you do not know what it measures.</p><p><b>The next exercise proves it.</b></p>'));
    }, ready: function () { return true; } });

  /* ---------- 3 blind grading ---------- */
  scr({ id: 'grade', seg: 2, kick: 'Eight minutes · alone', h: 'Score each reply from 1 to 5. No rubric. Go with your judgement.',
    sub: 'Twenty replies from a support agent to customers disputing a bill. The account record is beside each one.',
    render: function (st) {
      var wrap = h('<div style="margin-top:16px"></div>'); st.appendChild(wrap);
      get('dispute20.json').then(function (D) {
        var items = D.items;
        if (S.gi == null) S.gi = 0;
        function draw() {
          var it = items[S.gi], mine = S.grades[it.id];
          wrap.innerHTML = '';
          var pg = h('<div class="pager" aria-label="Replies"></div>');
          items.forEach(function (x, k) { var b = h('<button type="button" class="' + (S.grades[x.id] ? 'done' : '') + '"' + (k === S.gi ? ' aria-current="true"' : '') + ' aria-label="Reply ' + (k + 1) + '">' + (k + 1) + '</button>'); b.onclick = function () { S.gi = k; save(); draw(); }; pg.appendChild(b); });
          wrap.appendChild(pg);
          wrap.appendChild(h('<div class="case"><div class="card"><p class="kick">Customer</p><p>' + esc(it.message) + '</p><table class="acct">' + it.account.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></div>' +
            '<div class="card reply"><p class="kick">Agent reply ' + (S.gi + 1) + ' of 20</p><p>' + esc(it.reply) + '</p></div></div>'));
          var sc = h('<div class="score5" role="group" aria-label="Score"></div>');
          [1, 2, 3, 4, 5].forEach(function (v) { var b = h('<button type="button" aria-pressed="' + (mine === v) + '">' + v + '</button>'); b.onclick = function () { pick(it.id, v); }; sc.appendChild(b); });
          sc.appendChild(h('<span class="lbl">1 bad · 5 great</span>'));
          wrap.appendChild(sc);
          var n = Object.keys(S.grades).length;
          wrap.appendChild(h('<p class="note">' + n + ' of 20 scored. Keys 1 to 5 work too.</p>'));
        }
        function pick(id, v) {
          S.grades[id] = v;
          var next = items.findIndex(function (x, k) { return k > S.gi && !S.grades[x.id]; });
          if (next < 0) next = items.findIndex(function (x) { return !S.grades[x.id]; });
          if (next >= 0) S.gi = next;
          save(); draw();
          if (Object.keys(S.grades).length === 20 && !S.gradesPosted) { S.gradesPosted = true; save(); room.post('scores', { scores: items.map(function (x) { return S.grades[x.id]; }) }); }
          refresh();
        }
        keyHandler = function (e) { if (/^[1-5]$/.test(e.key) && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) pick(items[S.gi].id, +e.key); };
        draw();
      });
    },
    ready: function () { return Object.keys(S.grades).length === 20; }, hint: 'Score all twenty.' });

  function sheetsNow(D) {
    var mine = D.items.map(function (x) { return S.grades[x.id]; });
    if (room.on()) return room.pull('scores').then(function (rows) { var s = rows.map(function (r) { return r.payload.scores; }); if (!rows.some(function (r) { return r.cid === S.cid; })) s.push(mine); return s; });
    return get('cohort.json').then(function (C) { return C.sheets.map(function (s) { return s.scores; }).concat([mine]); });
  }
  function spreadStats(sheets, n) {
    var out = [];
    for (var j = 0; j < n; j++) {
      var col = sheets.map(function (s) { return s[j]; }).filter(Boolean), c = [0, 0, 0, 0, 0, 0];
      col.forEach(function (v) { c[v]++; });
      var mean = col.reduce(function (a, b) { return a + b; }, 0) / (col.length || 1);
      var sd = Math.sqrt(col.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (col.length || 1));
      out.push({ j: j, c: c, n: col.length, min: Math.min.apply(null, col), max: Math.max.apply(null, col), sd: sd });
    }
    return out;
  }

  scr({ id: 'spread', seg: 2, kick: 'The room', h: 'Same replies. Look how far apart the scores are.',
    render: function (st) {
      var box = h('<div></div>'), pair = h('<div></div>'); st.appendChild(box); st.appendChild(pair);
      get('dispute20.json').then(function (D) {
        function draw(sheets) {
          var stats = spreadStats(sheets, 20), maxc = Math.max.apply(null, stats.map(function (s) { return Math.max.apply(null, s.c); }));
          var wide = stats.slice().sort(function (a, b) { return (b.max - b.min) - (a.max - a.min) || b.sd - a.sd; }).slice(0, 2).map(function (s) { return s.j; });
          S.wide = wide; save();
          var g = '<div class="spread" role="table" aria-label="Scores per reply"><span class="h">reply</span>' + [1, 2, 3, 4, 5].map(function (v) { return '<span class="h">' + v + '</span>'; }).join('') + '<span class="h" style="text-align:right">range</span>';
          stats.forEach(function (s) {
            var me = S.grades[D.items[s.j].id], hot = wide.indexOf(s.j) >= 0;
            g += '<span class="id' + (hot ? ' wide' : '') + '" style="' + (hot ? 'color:var(--coral-ink);font-weight:700' : '') + '">' + (s.j + 1) + '</span>';
            for (var v = 1; v <= 5; v++) { var sz = s.c[v] ? Math.round(6 + 18 * Math.sqrt(s.c[v] / maxc)) : 0; g += '<span class="c' + (me === v ? ' me' + (sz ? '' : ' empty') : '') + '" title="' + s.c[v] + ' gave ' + v + '">' + (sz || me === v ? '<i style="width:' + (sz || 8) + 'px;height:' + (sz || 8) + 'px"></i>' : '') + '</span>'; }
            g += '<span class="rng"' + (hot ? ' style="color:var(--coral-ink);font-weight:700"' : '') + '>' + s.min + ' to ' + s.max + '</span>';
          });
          box.innerHTML = g + '</div><p class="note">' + sheets.length + ' score sheets' + (room.on() ? ' in this room so far' : ', yours ringed in coral') + '. Bigger dot, more people.</p>';
          get('cohort.json').then(function (C) {
            pair.innerHTML = '<h2 style="font:500 20px var(--sans);margin:28px 0 6px">Replies ' + (wide[0] + 1) + ' and ' + (wide[1] + 1) + ' got everything from ' + stats[wide[0]].min + ' to ' + stats[wide[0]].max + '.</h2>' +
              (room.on() ? '<p>The 1 and the 5 on each: defend your score out loud. Here is how another room argued it.</p>' : '<p>Here is how the two ends of the room defended their scores.</p>');
            wide.forEach(function (j) {
              var it = D.items[j], d = C.defences[it.id];
              pair.appendChild(h('<details class="ex" style="max-width:900px;margin-top:14px"' + (j === wide[0] ? ' open' : '') + '><summary>Reply ' + (j + 1) + ': ' + esc(it.message.slice(0, 70)) + '…</summary><div class="card" style="margin-top:8px"><p>' + esc(it.reply) + '</p></div></details>'));
              pair.appendChild(h('<div class="pair"><div class="card"><b>' + d.low.score + '</b><p>' + esc(d.low.text) + '</p></div><div class="card"><b>' + d.high.score + '</b><p>' + esc(d.high.text) + '</p></div></div>'));
            });
            refresh();
          });
        }
        if (room.on()) sheetsNow(D).then(draw).catch(function () {});
        else sheetsNow(D).then(draw);
      });
    }, ready: function () { return S.wide != null; } });

  scr({ id: 'rubric-word', seg: 2, kick: 'Two words, now that you need them', h: 'Neither side was wrong. They were grading different things.',
    render: function (st) {
      get('dispute20.json').then(function (D) {
        return sheetsNow(D).then(function (sheets) {
          var a = roomAgreement(sheets, 20);
          st.appendChild(h('<div><p class="kick" style="color:var(--ink3)">Pairs of graders within one point of each other</p><div class="big">' + pct(a) + '<small>' + (room.on() ? 'this room' : 'the recorded room') + '</small></div></div>'));
          st.appendChild(h('<p>Two people picking numbers at random land within one point about half the time. One graded tone, one graded whether the refund matched the policy, one graded length. Each of you had a definition of good. None of them was written down.</p>'));
          st.appendChild(reveal('<p>The written definition is a <span class="term">rubric</span>. How often two graders give the same item the same verdict is <span class="term">inter-rater agreement</span>. You just measured it.</p>'));
        });
      });
    }, ready: function () { return true; } });

  scr({ id: 'bridge', seg: 2, kick: 'Hold this question', h: 'If two of you disagree this much, what happens when one of you is an LLM?',
    render: function (st) { st.appendChild(h('<p class="sub">You will find out in segment five, with numbers.</p>')); }, ready: function () { return true; } });

  /* ---------- 4 rubrics in three layers ---------- */
  scr({ id: 'piles', seg: 3, kick: 'What were you actually scoring?', h: 'Sort these grading reasons into three piles. You decide what the piles are.',
    sub: 'Tap a reason, then tap a pile.',
    render: function (st) {
      get('cohort.json').then(function (C) {
        var reasons = C.reasons, sel = null;
        var chips = h('<div class="chips"></div>'), piles = h('<div class="piles"></div>'), after = h('<div></div>');
        st.appendChild(chips); st.appendChild(piles); st.appendChild(after);
        function mapping() {
          var keys = ['hard', 'quality', 'preference'], perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], best = null, bs = -1;
          perms.forEach(function (p) { var s = 0; reasons.forEach(function (r, k) { if (S.sort[k] != null && keys[p[S.sort[k]]] === r.pile) s++; }); if (s > bs) { bs = s; best = p; } });
          return { name: function (pi) { return keys[best[pi]]; }, score: bs };
        }
        function draw() {
          chips.innerHTML = ''; piles.innerHTML = '';
          reasons.forEach(function (r, k) {
            if (S.sort[k] != null) return;
            var b = h('<button type="button" class="chip" aria-pressed="' + (sel === k) + '">' + esc(r.text) + '</button>');
            b.onclick = function () { sel = sel === k ? null : k; draw(); }; chips.appendChild(b);
          });
          if (!chips.children.length) chips.appendChild(h('<p class="note" style="margin:0">All sorted.</p>'));
          var M = S.sortChecked ? mapping() : null;
          [0, 1, 2].forEach(function (pi) {
            var P = M ? PILES[M.name(pi)] : null;
            var p = h('<div class="pile' + (P ? ' ' + P.cls : '') + (sel != null ? ' armed' : '') + '" role="button" tabindex="0">' + (P ? '<h3>' + P.name + '</h3><p class="who">' + P.who + '</p>' : '<h3>Pile ' + 'ABC'[pi] + '</h3>') + '</div>');
            reasons.forEach(function (r, k) {
              if (S.sort[k] !== pi) return;
              var c = h('<button type="button" class="chip' + (M && M.name(pi) !== r.pile ? ' miss' : '') + '">' + esc(r.text) + '</button>');
              c.onclick = function (e) { e.stopPropagation(); if (S.sortChecked) return; delete S.sort[k]; save(); draw(); };
              p.appendChild(c);
            });
            var drop = function () { if (sel == null || S.sortChecked) return; S.sort[sel] = pi; sel = null; save(); draw(); };
            p.onclick = drop; p.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(); } };
            piles.appendChild(p);
          });
          after.innerHTML = '';
          if (!S.sortChecked && Object.keys(S.sort).length === reasons.length) {
            var b = h('<button class="btn go" style="margin-top:16px">Name the piles</button>');
            b.onclick = function () { S.sortChecked = true; save(); draw(); refresh(); }; after.appendChild(b);
          }
          if (M) {
            var misses = reasons.filter(function (r, k) { return M.name(S.sort[k]) !== r.pile; });
            after.appendChild(reveal('<p>' + M.score + ' of ' + reasons.length + ' landed where an eval designer would put them.' + (misses.length ? ' Crossed out: ' + misses.map(function (r) { return '"' + esc(r.text) + '" belongs in ' + PILES[r.pile].name.toLowerCase(); }).join('; ') + '.' : '') + '</p>' +
              '<p>The piles are the layers of a rubric, and each layer has its own grader: <b style="color:var(--det-ink)">code</b> for what is simply unacceptable, <b style="color:var(--prob-ink)">a judge with written criteria</b> for what is better or worse, <b style="color:var(--hum-ink)">people, blind and pairwise</b> for what an expert would rather have.</p>'));
          }
        }
        draw();
      });
    }, ready: function () { return !!S.sortChecked; }, hint: 'Sort all nine, then name the piles.' });

  scr({ id: 'table', seg: 3, kick: 'Five industries', h: 'Look at the columns, not the cells.', sub: 'Tap a column header.',
    render: function (st) {
      var note = h('<p class="col-note"></p>');
      var t = '<div class="tbl-wrap"><table class="ind"><thead><tr>' + TABLE.cols.map(function (c) { return '<th data-c="' + c[0] + '"><button type="button">' + c[1] + '</button></th>'; }).join('') + '</tr></thead><tbody>' +
        TABLE.rows.map(function (r) { return '<tr>' + TABLE.cols.map(function (c) { return '<td data-c="' + c[0] + '">' + esc(r[c[0]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      var w = h('<div>' + t + '</div>'); st.appendChild(w); st.appendChild(note);
      function hl(c) {
        var col = TABLE.cols.filter(function (x) { return x[0] === c; })[0];
        $$('[data-c]', w).forEach(function (el) { el.className = el.getAttribute('data-c') === c ? col[2] : ''; });
        note.innerHTML = '<b>' + esc(col[1]) + '.</b> ' + esc(TABLE.notes[c]);
        if (c !== 'task') { S.tableSeen = true; save(); refresh(); }
      }
      $$('th button', w).forEach(function (b) { b.onclick = function () { hl(b.parentNode.getAttribute('data-c')); }; });
      if (S.tableSeen) note.innerHTML = '<p class="note">What changes down the rows is the content. What never changes is the three layers and who checks each.</p>';
    }, ready: function () { return !!S.tableSeen; }, hint: 'Tap a column header.' });

  scr({ id: 'write-rubric', seg: 3, kick: 'Your rubric, before you see an output', h: 'Pick your industry and write its rubric in three layers.',
    sub: 'In the room, take the industry your table was given. When you lock it, it is timestamped: nothing you see later can shape it.',
    render: function (st) {
      var locked = !!(S.rubric && S.rubric.locked);
      var pk = h('<div class="pick" role="group" aria-label="Industry"></div>');
      IND_ORDER.forEach(function (k) {
        var b = h('<button type="button" aria-pressed="' + (S.industry === k) + '"' + (locked && S.industry !== k ? ' disabled' : '') + '>' + IND_NAMES[k] + (k === 'support' ? ' <span style="opacity:.6;font-size:12px">(easiest)</span>' : '') + '</button>');
        b.onclick = function () { if (locked) return; S.industry = k; save(); go(S.i); }; pk.appendChild(b);
      });
      st.appendChild(pk);
      if (!S.industry) return;
      var form = h('<div><p class="note">Loading…</p></div>'); st.appendChild(form);
      ind().then(function (I) {
        var R = S.rubric && S.rubric.industry === S.industry ? S.rubric : { industry: S.industry, hard: ['', '', ''], anchors: {} };
        I.dims.forEach(function (d) { R.anchors[d.key] = R.anchors[d.key] || { 1: '', 5: '' }; });
        var dis = locked ? ' disabled' : '';
        form.innerHTML = '<p class="job"><b>The job.</b> ' + esc(I.job) + '</p>' +
          '<div class="layer det"><h3>Hard constraints</h3><p class="who">Yes or no. Code checks them first; a fail vetoes the item. Write two to four.</p>' +
          R.hard.map(function (x, k) { return '<div class="field" style="margin-bottom:8px"><input type="text" data-h="' + k + '" value="' + esc(x) + '" placeholder="Rule ' + (k + 1) + ': the output never…"' + dis + ' data-nolabel></div>'; }).join('') +
          (locked ? '' : '<button type="button" class="btn sm quiet" id="addh">Add a rule</button>') + '</div>' +
          '<div class="layer prob"><h3>Quality dimensions</h3><p class="who">A judge scores each from 1 to 5. The task\'s experts chose the dimensions; you write what a 1 and a 5 look like.</p>' +
          '<details class="ex"><summary>See an example from a different task</summary><p style="margin:8px 0 0">Summarising a meeting, dimension "Decisions captured". 1 = Misses a decision that was made, or invents one. 5 = Every decision and its owner, in the order they were made, nothing added.</p></details>' +
          I.dims.map(function (d) { return '<div class="dim"><div class="dn">' + esc(d.name) + '<small>' + esc(d.hint) + '</small></div><input type="text" data-d="' + d.key + '" data-s="1" value="' + esc(R.anchors[d.key][1]) + '" placeholder="A 1 looks like…"' + dis + ' data-nolabel><input type="text" data-d="' + d.key + '" data-s="5" value="' + esc(R.anchors[d.key][5]) + '" placeholder="A 5 looks like…"' + dis + ' data-nolabel></div>'; }).join('') + '</div>' +
          '<div class="layer hum"><h3>Preference</h3><p class="who">People compare blind, pairwise. You will not run this layer today; the homework does.</p><p style="margin:0">Baseline: ' + esc(I.preference) + '. The question: would an expert rather have the model\'s version or this one?</p></div>' +
          (locked ? '<p class="locked">Locked ' + new Date(R.locked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.</p>' : '<button class="btn go" id="lock">Lock the rubric</button><p class="msg" id="lmsg"></p>');
        function collect() {
          R.hard = $$('[data-h]', form).map(function (i) { return i.value.trim(); });
          $$('[data-d]', form).forEach(function (i) { R.anchors[i.dataset.d][i.dataset.s] = i.value.trim(); });
          S.rubric = R; save();
        }
        $$('input', form).forEach(function (i) { i.addEventListener('input', collect); });
        if (!locked) {
          $('#addh', form).onclick = function () { collect(); if (R.hard.length < 5) { R.hard.push(''); S.rubric = R; save(); go(S.i); } };
          $('#lock', form).onclick = function () {
            collect();
            var hard = R.hard.filter(Boolean), miss = I.dims.filter(function (d) { return !R.anchors[d.key][1] || !R.anchors[d.key][5]; });
            if (hard.length < 2) return ($('#lmsg', form).textContent = 'Write at least two hard constraints.');
            if (miss.length) return ($('#lmsg', form).textContent = 'Write a 1 and a 5 for ' + miss.map(function (d) { return d.name; }).join(', ') + '.');
            R.hard = hard; R.locked = Date.now(); S.rubric = R; S.checks[S.industry] = hard.map(function () { return { type: '' }; }); save(); track('we_rubric_locked', { industry: S.industry }); go(S.i);
          };
        }
        refresh();
      });
    }, ready: function () { return !!(S.rubric && S.rubric.locked); }, hint: 'Write it, then lock it.' });

  /* ---------- 5 build and calibrate a judge ---------- */
  scr({ id: 'checks', seg: 4, kick: 'Step 1 of 4 · five minutes', h: 'Turn each hard constraint into a check a program runs.',
    sub: 'Thirty items for your industry. Pick a check for each rule, then run them all. A rule code cannot check goes to a human, not to the judge.',
    render: function (st) {
      ind().then(function (I) {
        var cfg = S.checks[S.industry] = S.checks[S.industry] || S.rubric.hard.map(function () { return { type: '' }; });
        if (I.policy) st.appendChild(h('<details class="ex"><summary>The billing policy every item follows</summary><ol style="margin:8px 0 0;padding-left:20px">' + I.policy.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol></details>'));
        var box = h('<div class="checks"></div>'); st.appendChild(box);
        S.rubric.hard.forEach(function (rule, k) {
          var c = cfg[k] = cfg[k] || { type: '' };
          var opts = '<option value="">Pick a check…</option><optgroup label="Provided for ' + esc(I.name) + '">' + I.checkers.map(function (x) { return '<option value="ck:' + x.id + '"' + (c.type === 'ck:' + x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</optgroup>' +
            '<optgroup label="Build your own">' + Object.keys(GENERIC).map(function (g) { return '<option value="' + g + '"' + (c.type === g ? ' selected' : '') + '>' + GENERIC[g].name + '</option>'; }).join('') + '</optgroup><option value="none"' + (c.type === 'none' ? ' selected' : '') + '>Code cannot check this</option>';
          var row = h('<div class="ck"><div class="rule" data-nolabel>' + esc(rule) + '</div><select aria-label="Check for rule ' + (k + 1) + '">' + opts + '</select><input type="text" placeholder="value" value="' + esc(c.arg || '') + '"' + (GENERIC[c.type] ? '' : ' hidden') + '></div>');
          var sel = $('select', row), inp = $('input', row), src = h('<details class="src" style="grid-column:1/-1"><summary>The code</summary><pre class="code"></pre><p class="note"></p></details>');
          row.appendChild(src);
          function upd() {
            c.type = sel.value; c.arg = inp.value; inp.hidden = !GENERIC[c.type]; if (GENERIC[c.type]) inp.placeholder = GENERIC[c.type].arg;
            var s = checkSrc(I, c), ck = I.checkers.filter(function (x) { return 'ck:' + x.id === c.type; })[0];
            src.hidden = !s; $('pre', src).textContent = s ? '(output, context) => {\n  ' + s.split('\n').join('\n  ') + '\n}' : ''; $('.note', src).textContent = ck ? 'Reads ' + ck.reads + '.' : (s ? 'Reads output.' : '');
            S.hardRun = null; save(); refresh();
          }
          sel.onchange = upd; inp.oninput = upd; upd();
          box.appendChild(row);
        });
        var run = h('<div class="row" style="margin-top:16px"><button class="btn go">Run the checks on 30 items</button></div>'); st.appendChild(run);
        var out = h('<div></div>'); st.appendChild(out);
        function show() {
          var res = S.hardRun, fails = I.items.filter(function (it) { return res[it.id].indexOf(false) >= 0; }).length, used = cfg.filter(function (c) { return checkSrc(I, c); }).length;
          var t = '<p style="margin-top:18px"><b>' + fails + ' of 30</b> items fail at least one check' + (used < cfg.length ? '. ' + (cfg.length - used) + ' rule' + (cfg.length - used > 1 ? 's go' : ' goes') + ' to a human.' : '.') + ' A failed item scores 0 whatever the judge says.</p>';
          t += '<div style="overflow-x:auto"><table class="grid30"><thead><tr><th>Item</th>' + S.rubric.hard.map(function (r, k) { return '<th title="' + esc(r) + '">Rule ' + (k + 1) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            I.items.map(function (it) { return '<tr><td class="id"><button class="id" data-v="' + it.id + '">' + it.id + '</button></td>' + res[it.id].map(function (v) { return '<td><span class="pf ' + (v === null ? 'na' : v ? 'p' : 'f') + '">' + (v === null ? 'human' : v ? 'pass' : 'fail') + '</span></td>'; }).join('') + '</tr><tr hidden data-r="' + it.id + '"><td colspan="' + (cfg.length + 1) + '"></td></tr>'; }).join('') + '</tbody></table></div>';
          out.innerHTML = t;
          $$('button.id', out).forEach(function (b) { b.onclick = function () { var r = $('[data-r="' + b.dataset.v + '"]', out); r.hidden = !r.hidden; if (!r.hidden && !r.firstChild.innerHTML) r.firstChild.innerHTML = itemHTML(I.items.filter(function (x) { return x.id === b.dataset.v; })[0], I); }; });
        }
        $('button', run).onclick = function () {
          if (!cfg.some(function (c) { return checkSrc(I, c); })) { out.innerHTML = '<p class="msg err">Pick a check for at least one rule.</p>'; return; }
          S.hardRun = runChecks(I); save(); show(); refresh(); track('we_checks_run', { industry: S.industry });
        };
        if (S.hardRun) show();
      });
    }, ready: function () { return !!S.hardRun; }, hint: 'Pick checks, then run them.' });

  function judgeTable(I, run, opts) {
    var t = '<table class="grid30"><thead><tr><th>Item</th>' + I.dims.map(function (d) { return '<th>' + esc(d.name) + '</th>'; }).join('') + '<th>Why, in its words</th></tr></thead><tbody>';
    I.items.forEach(function (it) {
      var sc = run.scores[it.id], v = vetoOf(I, it.id);
      t += '<tr data-row="' + it.id + '"><td class="id"><button class="id" data-v="' + it.id + '">' + it.id + '</button></td>' + I.dims.map(function (d) { return '<td>' + (sc ? (v ? '<span class="sc veto" title="Judge said ' + sc[d.key] + '; vetoed by: ' + esc(v) + '">0</span>' : '<span class="sc">' + sc[d.key] + '</span>') : '<span class="pf na">…</span>') + '</td>'; }).join('') +
        '<td class="quote">' + (sc ? (v ? '<span style="color:var(--det-ink);font-style:normal">Vetoed: ' + esc(v) + '</span>' : esc(run.quotes[it.id] || '')) : '') + '</td></tr><tr hidden data-r="' + it.id + '"><td colspan="' + (I.dims.length + 2) + '"></td></tr>';
    });
    var el = h('<div style="overflow-x:auto">' + t + '</tbody></table></div>');
    $$('button.id', el).forEach(function (b) { b.onclick = function () { var r = $('[data-r="' + b.dataset.v + '"]', el); r.hidden = !r.hidden; if (!r.hidden && !r.firstChild.innerHTML) r.firstChild.innerHTML = itemHTML(I.items.filter(function (x) { return x.id === b.dataset.v; })[0], I); }; });
    return el;
  }
  function judgeRunner(st, I, anchors, slot, onDone) {
    var P = judgePrompt(I, anchors);
    st.appendChild(h('<details class="ex" style="max-width:1000px"><summary>The prompt your rubric became</summary><pre class="code">' + esc(P.sys + '\n\n--- then, for each item ---\n' + P.user(I.items[0])) + '</pre></details>'));
    var keyrow = h('<div class="keyrow"><input type="password" placeholder="Your Groq API key (gsk_…)" value="' + esc(getKey()) + '" autocomplete="off" aria-label="Groq API key"><button class="btn go">Run with my key</button><button class="btn">Use the recorded run</button></div>');
    st.appendChild(keyrow);
    st.appendChild(h('<p class="note">Your key stays in this tab and goes only to Groq. Model pinned: ' + JUDGE_MODEL + '. The recorded run is a first-draft judge on this set; it does not read your rubric.</p>'));
    var msg = h('<p class="msg" aria-live="polite"></p>'), tbl = h('<div></div>'); st.appendChild(msg); st.appendChild(tbl);
    function start(mode) {
      $$('button', keyrow).forEach(function (b) { b.disabled = true; });
      var run = { scores: {}, quotes: {} }, view = judgeTable(I, run); tbl.innerHTML = ''; tbl.appendChild(view);
      var redraw = function () { var nv = judgeTable(I, run); tbl.replaceChild(nv, tbl.firstChild); };
      msg.textContent = mode === 'live' ? 'Judging with ' + JUDGE_MODEL + '…' : 'Replaying the recorded run…'; msg.classList.remove('err');
      runJudge(I, anchors, mode, function (id, v) { run.scores[id] = v.scores; run.quotes[id] = v.quote; redraw(); }, function (t) { msg.textContent = t; }).then(function (r) {
        S.runs[slot] = r; save(); track('we_judge_run', { industry: S.industry, mode: mode, slot: slot });
        var n = Object.keys(r.scores).length;
        msg.textContent = n + ' of 30 judged' + (mode === 'live' ? ' by ' + JUDGE_MODEL : ' (recorded run)') + (n < 30 ? '. Unreadable answers are left out of agreement.' : '.');
        onDone(r);
      }, function (e) {
        msg.textContent = e.status === 401 ? 'Groq refused the key. Check it, or use the recorded run.' : 'The run stopped: ' + e.message; msg.classList.add('err');
        $$('button', keyrow).forEach(function (b) { b.disabled = false; });
      });
    }
    var bs = $$('button', keyrow);
    bs[0].onclick = function () { var k = $('input', keyrow).value.trim(); if (!/^gsk_/.test(k)) { msg.textContent = 'A Groq key starts with gsk_. No key? Use the recorded run.'; msg.classList.add('err'); return; } setKey(k); start('live'); };
    bs[1].onclick = function () { start('recorded'); };
    if (S.runs[slot]) { tbl.appendChild(judgeTable(I, S.runs[slot])); msg.textContent = 'Last run: ' + S.runs[slot].model + '. Run again to replace it.'; }
  }

  scr({ id: 'judge', seg: 4, kick: 'Step 2 of 4 · seven minutes', h: 'Your rubric becomes the judge. Run it on the thirty items.',
    render: function (st) {
      ind().then(function (I) {
        if (S.runs.v1 && S.runs.v1.industry !== S.industry) delete S.runs.v1;
        judgeRunner(st, I, S.rubric.anchors, 'v1', function (r) { r.industry = S.industry; S.runs.v1 = r; save(); refresh(); });
      });
    }, ready: function () { return !!(S.runs.v1 && Object.keys(S.runs.v1.scores).length >= 20); }, hint: 'Run the judge.' });

  function scoreOf(I, run) { var J = {}; Object.keys(run.scores).forEach(function (id) { J[id] = run.scores[id]; }); return J; }
  function computeAgreement(I, L, run) {
    var dims = L.dims, ab = splitAB(L), J = scoreOf(I, run);
    return { ee: within1(ab.A, ab.B, dims), je: (within1(J, ab.A, dims) + within1(J, ab.B, dims)) / 2 };
  }
  scr({ id: 'unlock', seg: 4, kick: 'Step 3 of 4 · five minutes', h: 'Now unlock the expert labels.',
    sub: 'Two experts scored the same thirty items on the same dimensions, independently. First: how often do they agree with each other? Then: how often does your judge agree with them?',
    render: function (st) {
      ind().then(function (I) {
        var b = h('<button class="btn go">Unlock the expert labels</button>'), msg = h('<p class="msg"></p>'), out = h('<div></div>');
        st.appendChild(b); st.appendChild(msg); st.appendChild(out);
        function show(L, fresh) {
          b.hidden = true;
          var A = computeAgreement(I, L, S.runs.v1); S.ee = A.ee; S.je = A.je; save();
          out.innerHTML = '<div class="duo"><div><div class="k">Expert vs expert</div><div class="v hum">' + pct(A.ee) + '</div></div><div><div class="k">Your judge vs experts</div><div class="v prob">' + pct(A.je) + '</div></div><div class="gap">' + (Math.round(A.je) < Math.round(A.ee) ? (Math.round(A.ee) - Math.round(A.je)) + ' points below the experts' : 'level with the experts') + '</div></div>' +
            '<p class="note">Agreement: the share of item-and-dimension cells where two raters are within one point. ' + (S.runs.v1.mode === 'recorded' ? 'Judge: the recorded first-draft run.' : 'Judge: ' + JUDGE_MODEL + ' with your rubric.') + '</p>';
          var dims = L.dims, ab = splitAB(L), J = scoreOf(I, S.runs.v1), grid = '';
          dims.forEach(function (d, di) {
            grid += '<p class="kick" style="color:var(--ink3);margin:16px 0 0">' + esc(I.dims[di].name) + '</p><div class="cal">';
            I.items.forEach(function (it) {
              var a = ab.A[it.id][d], bb = ab.B[it.id][d], j = J[it.id] && J[it.id][d], k = j == null ? '' : (Math.abs(j - a) <= 1) + (Math.abs(j - bb) <= 1);
              grid += '<i class="' + (k === '' ? '' : k === 2 ? 'ok' : k === 1 ? 'half' : 'off') + (Math.abs(a - bb) > 1 ? ' x' : '') + '" title="' + it.id + ': experts ' + a + ' and ' + bb + ', judge ' + (j == null ? 'none' : j) + '"></i>';
            });
            grid += '</div>';
          });
          var vet = { caught: 0, missed: 0, alarm: 0 };
          I.items.forEach(function (it) { var mine = !!vetoOf(I, it.id), theirs = Object.keys(L.items[it.id].hard).some(function (k) { return !L.items[it.id].hard[k]; }); if (mine && theirs) vet.caught++; else if (theirs) vet.missed++; else if (mine) vet.alarm++; });
          var rest = h('<div>' + grid + '<div class="legend"><span style="--sw:var(--prob-soft);--bd:var(--prob)">judge within one of both experts</span><span style="--sw:var(--card);--bd:var(--prob)">within one of one</span><span style="--sw:var(--coral)">neither</span><span style="--sw:var(--bg2);--bd:var(--hum)">experts themselves disagree</span></div>' +
            '<h2 style="font:500 19px var(--sans);margin:28px 0 4px">Your hard constraints against the experts\'</h2><div class="confuse"><div><b>' + vet.caught + '</b><span>caught</span></div><div><b>' + vet.missed + '</b><span>missed</span></div><div><b>' + vet.alarm + '</b><span>false alarms</span></div></div>' +
            '<p class="note">The experts marked every item that breaks a rule of the task, whatever rules you wrote.</p></div>');
          out.appendChild(rest);
          S.unlockSeen = true; save(); if (fresh) refresh();
        }
        b.onclick = function () {
          b.disabled = true; msg.textContent = 'Sending your judge\'s scores…';
          var results = I.items.filter(function (it) { return S.runs.v1.scores[it.id]; }).map(function (it) { return { id: it.id, scores: S.runs.v1.scores[it.id] }; });
          fetch(LABELS_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ industry: S.industry, results: results }) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.statusText); return j; }); })
            .then(function (j) {
              S.labels[S.industry] = { version: j.version, dims: j.dims, items: j.labels }; msg.textContent = ''; save(); track('we_labels_unlock', { industry: S.industry });
              show(S.labels[S.industry], true);
              room.post('agree', { industry: S.industry, ee: Math.round(S.ee), je: Math.round(S.je), mode: S.runs.v1.mode });
            })
            .catch(function (e) { b.disabled = false; msg.textContent = 'Could not reach the labels: ' + e.message; msg.classList.add('err'); });
        };
        if (S.labels[S.industry]) show(S.labels[S.industry], false);
      });
    }, ready: function () { return !!(S.labels[S.industry] && S.unlockSeen); }, hint: 'Unlock, then look before you speak.' });

  scr({ id: 'verdict', seg: 4, kick: 'Step 4 of 4', h: 'Is this judge ready for regression decisions? One sentence.',
    render: function (st) {
      st.appendChild(h('<div class="duo"><div><div class="k">Expert vs expert</div><div class="v hum" style="font-size:44px">' + pct(S.ee || 0) + '</div></div><div><div class="k">Your judge vs experts</div><div class="v prob" style="font-size:44px">' + pct(S.je || 0) + '</div></div></div>'));
      st.appendChild(h(field('f-verdict', 'Your verdict', S.a.verdict, 'Ready or not, and why')));
      var b = h('<button class="btn go">Submit</button>'); st.appendChild(b);
      function show() {
        b.disabled = true; $('#f-verdict').disabled = true;
        st.appendChild(reveal('<p>The rule: <b>if the judge agrees with experts less often than experts agree with each other, it is not ready.</b> Experts are the ceiling. A judge ' + (Math.round(S.ee || 0) - Math.round(S.je || 0)) + ' points under it will pass regressions an expert would catch, and fail fixes an expert would accept.</p>'));
        refresh();
      }
      b.onclick = function () { var v = $('#f-verdict').value.trim(); if (v.length < 8) return $('#f-verdict').focus(); S.a.verdict = v; save(); show(); };
      if (S.a.verdict) show();
    }, ready: function () { return !!S.a.verdict; }, hint: 'Write your verdict.' });

  scr({ id: 'debrief', seg: 4, kick: 'Debrief', h: 'The fix is almost always the wording, not a bigger model.',
    render: function (st) {
      get('rubric-edit.json').then(function (E) {
        var names = { resolution: 'Resolution', empathy: 'Empathy', brevity: 'Brevity' };
        var col = function (k, cls) { return '<div class="card ' + cls + '"><h3>' + (k === 'before' ? 'Before' : 'After') + '<b>' + E.agreement[k] + '%</b></h3><dl>' + Object.keys(E[k]).map(function (d) { return '<dt>' + names[d] + '</dt><dd>1 = ' + esc(E[k][d][1]) + '</dd><dd>5 = ' + esc(E[k][d][5]) + '</dd>'; }).join('') + '</dl></div>'; };
        st.appendChild(h('<p class="sub" style="margin-bottom:12px">One edit on the support set. Same model, same items, same output format. Experts agree ' + E.agreement.experts + '% with each other.</p>'));
        st.appendChild(h('<div class="diff">' + col('before', '') + col('after', 'after') + '</div>'));
        st.appendChild(h('<p class="note">' + esc(E.note) + '</p>'));
        var more = h('<details class="ex" style="margin-top:24px;max-width:1000px"' + (S.runs.v2 ? ' open' : '') + '><summary>If there is time: edit your own rubric and run it again</summary><div class="re"></div></details>');
        st.appendChild(more);
        ind().then(function (I) {
          var box = $('.re', more), A2 = (S.rubric2 && S.rubric2.anchors) || JSON.parse(JSON.stringify(S.rubric.anchors));
          box.appendChild(h('<p class="note">Your first run stays on the record at ' + pct(S.je || 0) + '. Edit the anchors; nothing else changes.</p>'));
          I.dims.forEach(function (d) {
            var row = h('<div class="dim"><div class="dn">' + esc(d.name) + '</div><input type="text" data-s="1" value="' + esc(A2[d.key][1]) + '" data-nolabel><input type="text" data-s="5" value="' + esc(A2[d.key][5]) + '" data-nolabel></div>');
            $$('input', row).forEach(function (i) { i.oninput = function () { A2[d.key][i.dataset.s] = i.value; S.rubric2 = { anchors: A2 }; save(); }; });
            box.appendChild(row);
          });
          var res = h('<div></div>');
          judgeRunner(box, I, A2, 'v2', function (r) {
            var L = S.labels[S.industry]; if (!L) return;
            var a = computeAgreement(I, L, r); S.je2 = a.je; save();
            res.innerHTML = ''; res.appendChild(reveal('<p>First rubric <b>' + pct(S.je) + '</b>. Edited rubric <b>' + pct(a.je) + '</b>' + (r.mode === 'recorded' ? ', but the recorded run cannot read an edit: add a key to see yours move.' : '. Experts: ' + pct(S.ee) + '.') + '</p>'));
          });
          box.appendChild(res);
        });
      });
    }, ready: function () { return true; } });

  /* ---------- 6 GDPval, the lab's plan, close ---------- */
  scr({ id: 'gdpval', seg: 5, kick: 'Now, and only now', h: 'GDPval, laid on your four parts.',
    render: function (st) {
      st.appendChild(board(4, { notes: {
        decision: 'How close are models to experts on real, paid work?',
        population: 'Tasks from the top-wage occupations in the industries that contribute most to US GDP, written by professionals averaging 14 years of experience, with reference files and non-text deliverables.',
        good: 'Expert rubrics per occupation; each task reviewed in about five expert passes.',
        grader: 'Blind expert pairwise against a human deliverable. The automated grader predicts experts; it does not replace them.' } }));
      st.appendChild(h('<p style="margin-top:18px"><b>Which of the four parts did they invest most in?</b></p>'));
      var ch = h('<div class="choices"></div>'); st.appendChild(ch);
      var out = h('<div></div>'); st.appendChild(out);
      PARTS.forEach(function (p) {
        var b = h('<button type="button">' + esc(p.t) + '</button>');
        b.onclick = function () { S.a.gdp = p.k; save(); draw(); refresh(); };
        ch.appendChild(b);
      });
      function draw() {
        $$('button', ch).forEach(function (b, k) { b.className = PARTS[k].k === 'population' ? 'right' : (PARTS[k].k === S.a.gdp ? 'wrong' : ''); b.disabled = true; });
        out.innerHTML = ''; out.appendChild(reveal('<p><b>The population.</b> The task set is the eval; the grading rubric is secondary. Realism is a sampling problem, not a prompt-writing problem.</p><p>Read it yourself: <a href="https://openai.com/index/gdpval/" target="_blank" rel="noopener">GDPval: measuring the performance of our models on real-world tasks</a>.</p>'));
      }
      if (S.a.gdp) draw();
    }, ready: function () { return !!S.a.gdp; }, hint: 'Pick one.' });

  scr({ id: 'six-weeks', seg: 5, kick: 'The plan inside a lab', h: 'Six weeks from a decision to a frozen eval.',
    render: function (st) {
      var tag = '<span class="pf-tag">Promptfoo</span>';
      st.appendChild(h('<ol class="weeks">' + [
        ['Weeks 1 to 2', '<b>Scope and sample.</b> Write the decision. Recruit five to ten practitioners per occupation. Collect 30 to 50 tasks each, with reference files. At least three expert review passes per task.'],
        ['Week 3', '<b>Rubric and gold.</b> Experts write hard constraints and quality dimensions, and a human baseline deliverable for every task. Split 70% development, 30% sealed.'],
        ['Week 4', '<b>Build graders.</b> Hard constraints in code, the rubric as a judge, custom checks for anything that has to open a spreadsheet or PDF. Config in version control, next to the code.' + tag],
        ['Week 5', '<b>Calibrate.</b> Two experts grade 60 items independently. Run the judge on the same 60. Fix the wording until judge-vs-expert reaches expert-vs-expert. Both numbers go in the README; they are part of the eval.'],
        ['Week 6', '<b>Baseline and freeze.</b> Run on the development set, read the worst 20 failures by hand, fix rubric and task bugs, run the sealed set once, freeze.'],
        ['Ongoing', '<b>Run, rotate, retire.</b> CI runs the development set on every prompt or model change; the sealed set on release candidates only. Each quarter, re-sample 20% of tasks, re-check calibration, retire saturated tasks.' + tag]
      ].map(function (w) { return '<li><span class="w">' + w[0] + '</span><span>' + w[1] + '</span></li>'; }).join('') + '</ol>'));
      st.appendChild(h('<p>Promptfoo is the execution layer, not the eval: tests, providers and assertions in a versioned file that runs in CI. The design is everything you did today. Headline number: pairwise win-or-tie rate against the human baseline, with the hard-constraint failure rate beside it.</p><p class="note">Further reading: <a href="https://developers.openai.com/cookbook/examples/evaluation/moving-from-openai-evals-to-promptfoo" target="_blank" rel="noopener">Moving from OpenAI Evals to Promptfoo</a>.</p>'));
    }, ready: function () { return true; } });

  scr({ id: 'ticket', seg: 5, kick: 'Five minutes · silent', h: 'Your exit ticket: one eval for something you are actually building.',
    render: function (st) {
      var T = S.ticket, done = !!T.at;
      var f = h('<div style="margin-top:16px">' +
        '<div class="field"><label class="lab" for="t-f">The feature</label><input type="text" id="t-f" value="' + esc(T.feature) + '" placeholder="What you are building" data-nolabel></div>' +
        field('t-d', '1. Decision: what will you do differently when the number moves?', T.decision, 'If it drops below …, we …', 2) +
        field('t-p', '2. Population of inputs: where do they come from, and what are the strata?', T.population, 'From …, stratified by …', 2) +
        field('t-g', '3. Definition of good: hard constraints, quality dimensions, preference baseline', T.good, 'Never … · scored on … · against …', 3) +
        field('t-r', '4. Grader: who applies each layer, and how will you measure its error rate?', T.grader, 'Code for …, a judge for …, checked against …', 2) +
        '<div class="field" style="font-size:15px"><label style="display:block;margin-bottom:6px"><input type="checkbox" id="t-c1"' + (T.c1 ? ' checked' : '') + '> My decision changes if the score moves 20 points.</label><label style="display:block"><input type="checkbox" id="t-c2"' + (T.c2 ? ' checked' : '') + '> My definition of good can be written before I see a single output.</label></div>' +
        '<button class="btn go" id="t-go">Hand it in</button><p class="msg" id="t-msg"></p></div>');
      st.appendChild(f);
      var ids = { feature: 't-f', decision: 't-d', population: 't-p', good: 't-g', grader: 't-r' };
      if (done) { $$('input,textarea,button', f).forEach(function (x) { x.disabled = true; }); $('#t-msg', f).textContent = 'Handed in.'; }
      $('#t-go', f).onclick = function () {
        Object.keys(ids).forEach(function (k) { T[k] = $('#' + ids[k], f).value.trim(); }); T.c1 = $('#t-c1', f).checked; T.c2 = $('#t-c2', f).checked;
        if (!T.decision || !T.population || !T.good || !T.grader) { $('#t-msg', f).textContent = 'Fill in all four parts.'; return; }
        T.at = Date.now(); S.ticket = T; save(); room.post('ticket', T); track('we_ticket', { room: room.on() });
        $$('input,textarea,button', f).forEach(function (x) { x.disabled = true; }); $('#t-msg', f).textContent = room.on() ? 'Handed in to the room.' : 'Saved. It is on your keep-this page next.'; refresh();
      };
    }, ready: function () { return !!S.ticket.at; }, hint: 'Fill in four parts and hand it in.' });

  scr({ id: 'keep', seg: 5, kick: 'Keep this', h: 'What you built in ninety minutes.',
    render: function (st) {
      var R = S.rubric || {}, T = S.ticket || {};
      var k = h('<div class="keep">' +
        '<section><h3>The instrument</h3><p>Decision · population of inputs · definition of good, written first · grader with a measured error rate.</p></section>' +
        '<section><h3>Your rubric · ' + esc(IND_NAMES[S.industry] || '') + '</h3><ul>' + (R.hard || []).map(function (x) { return '<li><b style="color:var(--det-ink)">Code:</b> <span data-nolabel>' + esc(x) + '</span></li>'; }).join('') +
        Object.keys(R.anchors || {}).map(function (d) { return '<li><b style="color:var(--prob-ink)">Judge, ' + esc(d) + ':</b> <span data-nolabel>1 = ' + esc(R.anchors[d][1]) + '; 5 = ' + esc(R.anchors[d][5]) + '</span></li>'; }).join('') + '</ul></section>' +
        '<section><h3>Your judge</h3><p>Experts agree with each other ' + pct(S.ee || 0) + '. Your judge agrees with them ' + pct(S.je || 0) + (S.je2 ? ', and ' + pct(S.je2) + ' after your edit' : '') + '.</p><p data-nolabel>Verdict: ' + esc(S.a.verdict || '') + '</p></section>' +
        '<section><h3>Exit ticket · <span data-nolabel>' + esc(T.feature || '') + '</span></h3><ul data-nolabel><li>Decision: ' + esc(T.decision || '') + '</li><li>Population: ' + esc(T.population || '') + '</li><li>Definition of good: ' + esc(T.good || '') + '</li><li>Grader: ' + esc(T.grader || '') + '</li></ul></section>' +
        '<section class="noprint"><div class="row"><button class="btn go" id="k-zip">Download the Promptfoo project</button><button class="btn" id="k-print">Print this page</button><a class="btn quiet" href="/c8/writing-evals/homework">The homework</a></div><p class="msg"></p>' +
        '<p class="note">The zip holds your checks as code, your rubric as a judge, the 30 items' + (S.labels[S.industry] ? ', the expert labels and a script that prints both agreement numbers' : '') + '. It is where the homework starts.</p>' +
        '<p class="note" style="margin-top:20px"><button class="btn sm quiet" id="k-reset">Start over on this device</button></p></section></div>');
      st.appendChild(k);
      $('#k-zip', k).onclick = function () { exportZip(this); };
      $('#k-print', k).onclick = function () { window.print(); };
      var arm = false;
      $('#k-reset', k).onclick = function () {
        if (!arm) { arm = true; this.textContent = 'Tap again to erase everything you wrote here'; return; }
        try { localStorage.removeItem(KEY); } catch (e) {} location.href = location.pathname;
      };
    }, ready: function () { return false; } });

  /* =====================================================================================
     Shell
     ===================================================================================== */
  var keyHandler = null;
  function segFill() {
    var counts = SEGS.map(function () { return 0; }), seen = SEGS.map(function () { return 0; });
    SCREENS.forEach(function (s, k) { if (s.seg < 0) return; counts[s.seg]++; if (k < S.i || (k === S.i && s.ready())) seen[s.seg]++; });
    $$('#segs a').forEach(function (a, k) { a.querySelector('i').style.setProperty('--f', (100 * seen[k] / counts[k]) + '%'); a.toggleAttribute('aria-current', SCREENS[S.i].seg === k); });
  }
  function refresh() {
    var sc = SCREENS[S.i], ok = sc.ready();
    $('#next').hidden = !ok || S.i === SCREENS.length - 1;
    $('#hint').textContent = ok ? '' : (sc.hint || '');
    if (ok && S.i + 1 > S.max) { S.max = S.i + 1; save(); }
    segFill();
  }
  function go(i) {
    stopAll(); keyHandler = null;
    i = Math.max(0, Math.min(SCREENS.length - 1, i)); S.i = i; if (i > S.max) S.max = i; save();
    var sc = SCREENS[i], main = $('#screen');
    main.innerHTML = '<p class="kick">' + esc(sc.kick || '') + '</p><h1' + (sc.wide ? ' class="wide"' : '') + ' tabindex="-1">' + esc(sc.h) + '</h1>' + (sc.sub ? '<p class="sub">' + esc(sc.sub) + '</p>' : '') + '<div class="stage"></div>';
    sc.render($('.stage', main));
    $('#back').hidden = i === 0;
    $('#where').textContent = sc.seg >= 0 ? (sc.seg + 1) + ' · ' + SEGS[sc.seg][0] + (S.mode === 'room' && S.room ? ' · room ' + S.room : '') : '';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + sc.id);
    refresh(); window.scrollTo(0, 0); $('h1', main).focus({ preventScroll: true });
    track('we_screen', { screen: sc.id, seg: sc.seg + 1 });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.C8Kit) window.C8Kit.wbDefs();
    var segs = $('#segs');
    SEGS.forEach(function (s, k) {
      var a = h('<a href="#"><i></i><span><em>' + s[1] + '</em><b>' + s[0] + '</b></span></a>');
      a.onclick = function (e) { e.preventDefault(); var first = SCREENS.findIndex(function (x) { return x.seg === k; }); if (first <= S.max) go(first); };
      segs.appendChild(a);
    });
    $('#next').onclick = function () { go(S.i + 1); };
    $('#back').onclick = function () { go(S.i - 1); };
    document.addEventListener('keydown', function (e) { if (keyHandler) keyHandler(e); });
    var want = SCREENS.findIndex(function (x) { return '#' + x.id === location.hash; });
    go(want >= 0 && want <= S.max ? want : S.i);
  });
})();
