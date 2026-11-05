/* Practice set 2: Write the eval for one task. A self-paced, three-part cut of c8/writing-evals. Brief: c8/module-2/practice-set-2-write-the-eval.
   One screen, one thing to do. The headline is the instruction; Continue appears once the thing is done.
   Solo only, no keys, no clock. State lives in localStorage (c8store, key l09oh.v1).
   data.json is cut from the Writing Evals data by _plan/l09-office-hour/build_data.py. */
(function () {
  'use strict';
  var BASE = '/c8/module-2/lecture-09-llms-from-first-principles/';
  var KEY = 'l09oh.v1';
  var SEGS = ['Why rubrics', 'The four parts', 'Write yours'];
  var PILES = [
    { key: 'hard', name: 'Hard line', who: 'a rule · a script checks · pass or fail', cls: 'det' },
    { key: 'quality', name: 'Quality', who: 'a judge scores 1 to 5 against written ends', cls: 'prob' },
    { key: 'preference', name: 'Preference', who: 'taste · leave it out', cls: 'hum' }
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var store = window.c8store || { get: function (k, d) { return d; }, set: function () {} };
  var track = function (name, props) { try { window.posthog && window.posthog.capture(name, props || {}); } catch (e) {} };

  var S = store.get(KEY, null) || {};
  S.i = S.i || 0; S.max = S.max || 0; S.g = S.g || {}; S.sort = S.sort || {}; S.pick = S.pick || {};
  S.row = S.row || {}; S.dec = S.dec || {}; S.hard = S.hard || ['']; S.dims = S.dims || [{}]; S.grader = S.grader || {};
  S.agree = S.agree || { a: [], b: [] };
  function save() { store.set(KEY, S); }

  var dataP = null;
  function data() { return dataP || (dataP = fetch(BASE + 'office-hour/data.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })); }

  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
  function filled(s) { return !!(s && String(s).trim()); }
  /* a text box that saves as you type */
  function box(label, obj, key, ph, rows) {
    var id = 'f' + Math.random().toString(36).slice(2, 8);
    var tag = rows ? '<textarea id="' + id + '" rows="' + rows + '"' : '<input type="text" id="' + id + '"';
    var el = h('<div class="field"><label class="lab" for="' + id + '">' + esc(label) + '</label>' + tag + ' placeholder="' + esc(ph || '') + '" data-nolabel>' + (rows ? esc(obj[key] || '') + '</textarea>' : '') + '</div>');
    var inp = el.querySelector(rows ? 'textarea' : 'input');
    if (!rows) inp.value = obj[key] || '';
    inp.oninput = function () { obj[key] = inp.value; save(); refresh(); };
    return el;
  }
  function choice(label, obj, key, opts, after) {
    var el = h('<div class="field"><p class="lab">' + esc(label) + '</p><div class="row"></div></div>');
    opts.forEach(function (o) {
      var b = h('<button type="button" class="btn sm" aria-pressed="' + (obj[key] === o) + '">' + esc(o) + '</button>');
      b.onclick = function () { obj[key] = o; save(); $$('button', el).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); if (after) after(); refresh(); };
      $('.row', el).appendChild(b);
    });
    return el;
  }
  function reveal(html) { return h('<div class="reveal">' + html + '</div>'); }

  var SCREENS = [];
  function scr(o) { SCREENS.push(o); }
  var keyHandler = null;

  /* ---------- start ---------- */
  scr({ id: 'start', seg: -1, kick: 'Practice set 2 · On your own', h: 'Write the eval for one task on your sheet.', wide: true,
    sub: 'About thirty minutes, three parts. Do it once you have tested one task on the model (Practice set 1, section 04), with that sheet open.',
    render: function (st) {
      st.appendChild(h('<ol class="outcomes"><li>See why one reply can earn a 1 and a 5 when nobody writes down what good means.</li><li>Match the four parts of an eval to the columns you already filled.</li><li>Write the eval for the row you tested, and paste it into your sheet.</li></ol>'));
      var b = h('<button class="btn go">Start</button>'); st.appendChild(b);
      b.onclick = function () { S.started = true; save(); go(1); };
    }, ready: function () { return !!S.started; } });

  /* ---------- 1 why rubrics ---------- */
  scr({ id: 'grade', seg: 0, kick: 'By feel', h: 'Score these five replies from 1 to 5. No rubric. Use your judgement.',
    sub: 'A support agent answering customers who dispute a bill. The account record is beside each reply.',
    render: function (st) {
      var wrap = h('<div style="margin-top:16px"></div>'); st.appendChild(wrap);
      data().then(function (D) {
        var items = D.items; if (S.gi == null) S.gi = 0;
        function draw() {
          var it = items[S.gi], mine = S.g[it.id];
          wrap.innerHTML = '';
          var pg = h('<div class="pager" aria-label="Replies"></div>');
          items.forEach(function (x, k) { var b = h('<button type="button" class="' + (S.g[x.id] ? 'done' : '') + '"' + (k === S.gi ? ' aria-current="true"' : '') + ' aria-label="Reply ' + (k + 1) + '">' + (k + 1) + '</button>'); b.onclick = function () { S.gi = k; save(); draw(); }; pg.appendChild(b); });
          wrap.appendChild(pg);
          wrap.appendChild(h('<div class="case"><div class="card"><p class="kick">Customer</p><p>' + esc(it.message) + '</p><table class="acct">' + it.account.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></div>' +
            '<div class="card reply"><p class="kick">Agent reply ' + (S.gi + 1) + ' of 5</p><p>' + esc(it.reply) + '</p></div></div>'));
          var sc = h('<div class="score5" role="group" aria-label="Score"></div>');
          [1, 2, 3, 4, 5].forEach(function (v) { var b = h('<button type="button" aria-pressed="' + (mine === v) + '">' + v + '</button>'); b.onclick = function () { pick(it.id, v); }; sc.appendChild(b); });
          sc.appendChild(h('<span class="lbl">1 bad · 5 great</span>'));
          wrap.appendChild(sc);
          wrap.appendChild(h('<p class="note">' + Object.keys(S.g).length + ' of 5 scored. Keys 1 to 5 work too.</p>'));
        }
        function pick(id, v) {
          S.g[id] = v;
          var next = items.findIndex(function (x, k) { return k > S.gi && !S.g[x.id]; });
          if (next < 0) next = items.findIndex(function (x) { return !S.g[x.id]; });
          if (next >= 0) S.gi = next;
          save(); draw(); refresh();
        }
        keyHandler = function (e) { if (/^[1-5]$/.test(e.key) && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) pick(items[S.gi].id, +e.key); };
        draw();
      });
    }, ready: function () { return Object.keys(S.g).length === 5; }, hint: 'Score all five.' });

  scr({ id: 'spread', seg: 0, kick: 'Two scores', h: 'Two people scored reply 1. One gave it a 5, the other a 1.',
    render: function (st) {
      data().then(function (D) {
        var lo = D.defence.low, hi = D.defence.high, me = S.g[D.items[0].id];
        st.appendChild(h('<div class="case"><div class="card"><p class="kick">Scored ' + hi.score + '</p><p>"' + esc(hi.text) + '"</p></div><div class="card"><p class="kick">Scored ' + lo.score + '</p><p>"' + esc(lo.text) + '"</p></div></div>'));
        st.appendChild(h('<p class="note">You gave it a ' + me + '.</p>'));
        st.appendChild(reveal('<p><b>Neither of them was careless. Each scored against a different idea of good, and neither wrote it down.</b> You scored all five the same way: by feel.</p>'));
      });
    }, ready: function () { return true; } });

  scr({ id: 'policy', seg: 0, kick: 'Guess first', h: 'Here is the policy. Which replies break it? Tap them.',
    render: function (st) {
      data().then(function (D) {
        st.appendChild(h('<ol class="outcomes" style="font-size:14px">' + D.policy.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>'));
        var grid = h('<div></div>'), out = h('<div></div>'); st.appendChild(grid); st.appendChild(out);
        function draw() {
          grid.innerHTML = '';
          D.items.forEach(function (it, k) {
            var cls = S.policyChecked ? (it.breaks ? (S.pick[it.id] ? ' right' : ' wrong') : (S.pick[it.id] ? ' wrong' : '')) : '';
            var b = h('<button type="button" class="card' + cls + '" aria-pressed="' + !!S.pick[it.id] + '" style="display:block;width:100%;text-align:left;margin:0 0 8px;max-width:860px;cursor:pointer' + (S.pick[it.id] && !S.policyChecked ? ';border-color:var(--coral)' : '') + '">' +
              '<p class="kick">Reply ' + (k + 1) + ' · ' + esc(it.account[2][1]) + '</p><p style="margin:0">' + esc(it.reply) + '</p>' +
              (S.policyChecked && it.breaks ? '<p class="note" style="margin:8px 0 0;color:var(--det-ink)"><b>Breaks the policy.</b> ' + esc(it.breaks) + '</p>' : '') + '</button>');
            b.onclick = function () { if (S.policyChecked) return; S.pick[it.id] = !S.pick[it.id]; save(); draw(); };
            grid.appendChild(b);
          });
          out.innerHTML = '';
          if (!S.policyChecked) {
            var c = h('<button class="btn go">Check</button>'); out.appendChild(c);
            c.onclick = function () { S.policyChecked = true; save(); track('oh_policy', { right: D.items.every(function (x) { return !!x.breaks === !!S.pick[x.id]; }) }); draw(); refresh(); };
          } else {
            var r1 = D.items[0];
            out.appendChild(reveal('<p>Replies 1 and 4 break it. ' + (S.g[r1.id] >= 4 ? 'You gave reply 1 a ' + S.g[r1.id] + ': it sounds kind.' : 'Reply 1 sounds kind, which is what makes it easy to pass.') + ' Reply 5 sounds cold and follows every rule.</p><p><b>A reply that breaks a rule fails, however warm it is.</b> That is a hard line. A script can check it, and nothing else in the reply makes up for it.</p>'));
          }
        }
        draw();
      });
    }, ready: function () { return !!S.policyChecked; }, hint: 'Tap the ones you think break it, then Check.' });

  /* ---------- 2 the four parts ---------- */
  scr({ id: 'four', seg: 1, kick: 'The instrument', h: 'An eval has four parts. Your sheet already covers most of them.', wide: true,
    render: function (st) {
      var L = function (n, sec, t) { return '<a href="/c8/module-2/' + n + '/notes#s' + sec + '">' + t + '</a>'; };
      var L1 = 'lecture-01-orientation', L3 = 'lecture-03-building-ui', L9 = 'lecture-09-llms-from-first-principles', L10 = 'lecture-10-tool-calling-and-mcp';
      var rows = [
        ['Decision', 'What you do differently when the score is high or low. No decision, no eval.', 'Moves my North Star? and Bucket', 'The threshold in the loop: verifier, threshold, improve, re-score, stop. ' + L(L1, '08', 'Lecture 1')],
        ['Population', 'Real inputs, the kind the task actually gets, hard ones included.', 'Data (past input and output pairs)', 'Your golden pairs: 10 to 20 from real users. ' + L(L3, '05', 'Lecture 3') + ', ' + L(L10, '06', 'Lecture 10')],
        ['Definition of good', 'Written down before you look at any output.', 'Success criteria', 'The written verifier a stranger can use without you. ' + L(L1, '08', 'Lecture 1')],
        ['Grader', 'Who or what scores it, and how often it is wrong.', 'Verifier', 'Rule or judgment: a script for the rule, a judge for the rest. ' + L(L9, '07', 'Lecture 9')]
      ];
      st.appendChild(h('<div class="tbl-wrap"><table class="ind map"><thead><tr><th>Part</th><th>What it means</th><th>On your sheet</th><th>Where you met it</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') + '</tbody></table></div>'));
      st.appendChild(reveal('<p>The one your sheet does not have yet: <b>how often the grader is wrong.</b> You measure that last.</p>'));
    }, ready: function () { return true; } });

  scr({ id: 'layers', seg: 1, kick: 'Three layers', h: 'Sort these reasons for a score into three piles.',
    sub: 'Tap a reason, then tap a pile.',
    render: function (st) {
      data().then(function (D) {
        var R = D.reasons, sel = null;
        var chips = h('<div class="chips"></div>'), piles = h('<div class="piles"></div>'), after = h('<div></div>');
        st.appendChild(chips); st.appendChild(piles); st.appendChild(after);
        function draw() {
          chips.innerHTML = ''; piles.innerHTML = ''; after.innerHTML = '';
          R.forEach(function (r, k) {
            if (S.sort[k] != null) return;
            var b = h('<button type="button" class="chip" aria-pressed="' + (sel === k) + '">' + esc(r.text) + '</button>');
            b.onclick = function () { sel = sel === k ? null : k; draw(); }; chips.appendChild(b);
          });
          if (!chips.children.length) chips.appendChild(h('<p class="note" style="margin:0">All sorted.</p>'));
          PILES.forEach(function (P) {
            var p = h('<div class="pile ' + P.cls + (sel != null ? ' armed' : '') + '" role="button" tabindex="0"><h3>' + P.name + '</h3><p class="who">' + P.who + '</p></div>');
            R.forEach(function (r, k) {
              if (S.sort[k] !== P.key) return;
              var c = h('<button type="button" class="chip' + (S.sortChecked && r.pile !== P.key ? ' miss' : '') + '">' + esc(r.text) + '</button>');
              c.onclick = function (e) { e.stopPropagation(); if (S.sortChecked) return; delete S.sort[k]; save(); draw(); };
              p.appendChild(c);
            });
            var drop = function () { if (sel == null || S.sortChecked) return; S.sort[sel] = P.key; sel = null; save(); draw(); };
            p.onclick = drop; p.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(); } };
            piles.appendChild(p);
          });
          if (Object.keys(S.sort).length === R.length && !S.sortChecked) {
            var b = h('<button class="btn go" style="margin-top:16px">Check</button>'); after.appendChild(b);
            b.onclick = function () { S.sortChecked = true; save(); draw(); refresh(); };
          }
          if (S.sortChecked) {
            var miss = R.filter(function (r, k) { return S.sort[k] !== r.pile; }).length;
            after.appendChild(reveal('<p>' + (miss ? miss + ' landed in another pile; they are marked.' : 'All six in the right pile.') + '</p><p><b>Hard lines</b> veto: any fail is a fail. <b>Quality</b> gets a 1 and a 5 written out, so two people score it the same way. <b>Preference</b> stays out of the eval: it is most of why two scorers disagree.</p>'));
          }
        }
        draw();
      });
    }, ready: function () { return !!S.sortChecked; }, hint: 'Sort all six, then Check.' });

  /* GDPval task bd72994f (Retail Trade, First-Line Supervisors of Retail Sales Workers), huggingface.co/datasets/openai/gdpval.
     The prompt and the 19 rubric lines are paraphrased, not quoted. */
  var GDPVAL_TASK = 'https://huggingface.co/datasets/openai/gdpval';
  scr({ id: 'example', seg: 1, kick: 'A real task · GDPval', h: 'A real task from GDPval, turned into an eval.', wide: true,
    sub: 'GDPval is OpenAI\'s set of real work tasks, each written and graded by a professional with years in the job. This one is from retail.',
    render: function (st) {
      st.appendChild(h('<div class="tbl-wrap"><table class="ind map"><tbody>' + [
        ['Role', 'Senior client advisor at a luxury clothing boutique'],
        ['The task', 'New staff don\'t know how to invite clients in. Pick one brand\'s 2025 resort collection, put 4 to 6 outfits ("looks") on slides, and write an email or text template staff can reuse to invite clients to book an appointment.'],
        ['How GDPval grades it', 'A rubric of 19 yes-or-no lines worth 29 points, written by the professional before any model ran. Experts also compare the model\'s work blind against a professional\'s.']
      ].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table></div>'));
      st.appendChild(h('<div style="margin-top:20px">' +
        '<div class="layer"><h3>Decision</h3><p style="margin:0">If 8 of 10 AI-drafted invites pass, the manager gives new staff the AI draft to start from. If not, the senior advisor keeps writing them.</p></div>' +
        '<div class="layer"><h3>Population</h3><p style="margin:0">Ten real briefs: different brands, seasons and clients, including a client who only takes texts.</p></div>' +
        '<div class="layer det"><h3>Hard lines</h3><p class="who">a script or a checklist · most of the 19 lines are like this</p><p style="margin:0">Greets with a [First Name] placeholder. Asks the client to book, schedule or reserve. Gives a way to do it: reply with a time, or a number to call. Ends with the advisor\'s name and a contact. An email has a subject line. A text says how to opt out.</p></div>' +
        '<div class="layer prob"><h3>Quality: the looks</h3><p class="who">a judge scores 1 to 5</p><p style="margin:0">1 = items that don\'t belong together, or the same outfit three times. 5 = every look is one outfit that hangs together, and each is clearly different from the rest.</p></div>' +
        '<div class="layer hum"><h3>Grader, checked</h3><p style="margin:0">Two senior advisors score the same ten with this rubric. Within one point on 8 of 10 or more, and one of them, or an LLM judge with this rubric, can score the rest.</p></div></div>'));
      st.appendChild(h('<p class="note">Source: <a href="' + GDPVAL_TASK + '" target="_blank" rel="noopener">GDPval on Hugging Face, task bd72994f</a>. The task and rubric are summarised here; the decision, population and grader check are ours.</p>'));
    }, ready: function () { return true; } });

  /* ---------- 3 write yours ---------- */
  scr({ id: 'row', seg: 2, kick: 'Your sheet', h: 'Copy the row you tested.',
    sub: 'The task you ran bare and with context in Practice set 1, section 04. Copy its columns from your sheet.',
    render: function (st) {
      var R = S.row, msg = h('<p class="note"></p>');
      function tell() {
        msg.textContent = R.type === 'Unverifiable' ? 'With no verifier, there is nothing to write an eval against. Use a row you bucketed Automate or Augment.' :
          R.data === 'None' ? 'No past examples yet. You will write down where ten will come from on the next screen.' : '';
        msg.style.color = R.type === 'Unverifiable' ? 'var(--coral-ink)' : '';
      }
      st.appendChild(box('Atomic task', R, 'task', 'e.g. Write the client invite for the new collection'));
      st.appendChild(box('Success criteria', R, 'criteria', 'What must be true for it to count as done', 2));
      st.appendChild(box('Verifier', R, 'verifier', 'A rule, or a judge · a signal · a time', 2));
      st.appendChild(choice('Verification type', R, 'type', ['Rule', 'Judgment', 'Unverifiable'], tell));
      st.appendChild(choice('Data: past input and output pairs', R, 'data', ['None', 'Under 10', '10 to 100', 'Over 100'], tell));
      st.appendChild(msg); tell();
    }, ready: function () { var R = S.row; return filled(R.task) && filled(R.criteria) && filled(R.verifier) && !!R.data && (R.type === 'Rule' || R.type === 'Judgment'); },
    hint: 'Fill the row. Verification type must be Rule or Judgment.' });

  scr({ id: 'decide', seg: 2, kick: 'Decision and population', h: 'What will you do with the result, and what will you test it on?',
    render: function (st) {
      st.appendChild(box('Decision: what changes when it passes or fails', S.dec, 'decision', 'If 8 of 10 pass, I … If not, I …', 3));
      st.appendChild(box('Population: ten real past inputs, from where?', S.dec, 'population', 'e.g. the last ten requests from my inbox, including the two that went wrong', 3));
      st.appendChild(h('<p class="note">Real inputs, not ones you invent. The hard cases are the ones that matter.</p>'));
    }, ready: function () { return filled(S.dec.decision) && filled(S.dec.population); }, hint: 'Write both.' });

  scr({ id: 'hard', seg: 2, kick: 'Layer one', h: 'Write the hard lines: rules a script could check.',
    sub: 'Pass or fail. Any fail fails the whole output, however good the rest is.',
    render: function (st) {
      if (S.row.type === 'Rule' && !S.hard.some(filled)) { S.hard = [S.row.verifier || '']; save(); }
      var wrap = h('<div class="lines"></div>'), ctl = h('<div class="row" style="margin-top:6px"></div>'); st.appendChild(wrap); st.appendChild(ctl);
      if (S.row.type === 'Rule') st.appendChild(h('<p class="note">Your verifier is a rule, so it is your first hard line.</p>'));
      function draw() {
        wrap.innerHTML = '';
        S.hard.forEach(function (v, k) {
          var ln = h('<div class="ln"><span class="note" style="margin:0;white-space:nowrap">Pass when</span><input type="text" data-nolabel placeholder="' + (k ? 'Another rule' : 'e.g. every number matches the source export') + '"></div>');
          var inp = $('input', ln); inp.value = v || ''; inp.oninput = function () { S.hard[k] = inp.value; save(); refresh(); };
          wrap.appendChild(ln);
        });
        ctl.innerHTML = '';
        if (S.hard.length < 4) { var a = h('<button class="btn sm quiet" type="button">Add a rule</button>'); a.onclick = function () { S.hard.push(''); save(); draw(); }; ctl.appendChild(a); }
        if (S.row.type === 'Judgment') {
          var c = h('<label class="note" style="margin:0"><input type="checkbox"' + (S.noHard ? ' checked' : '') + '> No rule fits this task</label>');
          $('input', c).onchange = function () { S.noHard = this.checked; save(); refresh(); }; ctl.appendChild(c);
        }
      }
      draw();
    }, ready: function () { return S.hard.some(filled) || (S.row.type === 'Judgment' && !!S.noHard); }, hint: 'Write at least one rule.' });

  scr({ id: 'quality', seg: 2, kick: 'Layer two', h: 'For each thing your judge looks at, write what a 1 and a 5 look like.',
    sub: 'One to three things. Write both ends before you look at any output.',
    render: function (st) {
      var wrap = h('<div></div>'), ctl = h('<div class="row"></div>'); st.appendChild(wrap); st.appendChild(ctl);
      function draw() {
        wrap.innerHTML = '';
        S.dims.forEach(function (d, k) {
          var L = h('<div class="layer prob"><h3>Quality ' + (k + 1) + '</h3></div>');
          L.appendChild(box('What the judge looks at', d, 'name', 'e.g. The looks'));
          L.appendChild(box('A 1 looks like', d, 'one', 'e.g. items that don\'t belong together', 2));
          L.appendChild(box('A 5 looks like', d, 'five', 'e.g. every look is one outfit, each clearly different', 2));
          wrap.appendChild(L);
        });
        ctl.innerHTML = '';
        if (S.dims.length < 3) { var a = h('<button class="btn sm quiet" type="button">Add another</button>'); a.onclick = function () { S.dims.push({}); save(); draw(); }; ctl.appendChild(a); }
        if (S.row.type === 'Rule') {
          var c = h('<label class="note" style="margin:0"><input type="checkbox"' + (S.noQual ? ' checked' : '') + '> The rules cover it; no judgement needed</label>');
          $('input', c).onchange = function () { S.noQual = this.checked; save(); refresh(); }; ctl.appendChild(c);
        }
      }
      draw();
    }, ready: function () { return S.dims.some(dimDone) || (S.row.type === 'Rule' && !!S.noQual); }, hint: 'Fill a name, a 1 and a 5 for at least one.' });
  function dimDone(d) { return filled(d.name) && filled(d.one) && filled(d.five); }
  function needQual() { return S.dims.some(dimDone); }
  function needHard() { return S.hard.some(filled); }

  scr({ id: 'grader', seg: 2, kick: 'The grader', h: 'Who grades each layer, and how will you know they are right?',
    render: function (st) {
      if (needQual() && !filled(S.grader.qual) && S.row.type === 'Judgment') { S.grader.qual = (S.row.verifier || '').split('·')[0].trim(); save(); }
      if (needHard()) st.appendChild(box('Hard lines are checked by', S.grader, 'hard', 'A script, a formula, or a checklist you tick'));
      if (needQual()) st.appendChild(box('Quality is scored by', S.grader, 'qual', 'Your judge: manager, client, or you with this rubric'));
      if (needQual()) {
        st.appendChild(h('<div class="reveal"><p><b>Measure the grader before you trust it.</b> Score ten past outputs yourself with your rubric. Ask your judge to score the same ten. Count how often you are within one point. Aim for 8 of 10.</p><p class="note">Do it this week. Type the scores here when you have them, or leave it blank for now.</p></div>'));
        var A = S.agree, g = h('<div class="agree"></div>'), res = h('<p class="note"></p>');
        function calc() {
          var n = 0, ok = 0;
          for (var k = 0; k < 10; k++) { var a = +A.a[k], b = +A.b[k]; if (a >= 1 && a <= 5 && b >= 1 && b <= 5) { n++; if (Math.abs(a - b) <= 1) ok++; } }
          A.n = n; A.ok = ok; save();
          res.textContent = n ? ok + ' of ' + n + ' within one point · ' + Math.round(100 * ok / n) + '%' + (n >= 10 ? (ok >= 8 ? '. Good enough to trust.' : '. Below 8 of 10: sharpen your 1 and 5, then score again.') : '') : '';
          $$('.mk', g).forEach(function (m, k) { var a = +A.a[k], b = +A.b[k]; m.textContent = a && b ? (Math.abs(a - b) <= 1 ? '✓' : '✗') : ''; m.className = 'mk ' + (a && b ? (Math.abs(a - b) <= 1 ? 'ok' : 'no') : ''); });
        }
        [['a', 'You'], ['b', 'Your judge']].forEach(function (r) {
          g.appendChild(h('<span>' + r[1] + '</span>'));
          for (var k = 0; k < 10; k++) (function (k) {
            var i = h('<input type="text" inputmode="numeric" maxlength="1" aria-label="' + r[1] + ', output ' + (k + 1) + '">'); i.value = A[r[0]][k] || '';
            i.oninput = function () { i.value = i.value.replace(/[^1-5]/g, ''); A[r[0]][k] = i.value; calc(); };
            g.appendChild(i);
          })(k);
        });
        g.appendChild(h('<span></span>')); for (var k = 0; k < 10; k++) g.appendChild(h('<span class="mk"></span>'));
        st.appendChild(g); st.appendChild(res); calc();
      }
    }, ready: function () { return (!needHard() || filled(S.grader.hard)) && (!needQual() || filled(S.grader.qual)); }, hint: 'Name who grades each layer.' });

  function asText() {
    var R = S.row, L = [];
    L.push('EVAL: ' + (R.task || ''));
    L.push('From my sheet: ' + (R.type || '') + ' · data ' + (R.data || '') + ' · verifier: ' + (R.verifier || ''));
    L.push('');
    L.push('Decision: ' + (S.dec.decision || ''));
    L.push('Population: ' + (S.dec.population || ''));
    L.push('Definition of good (success criteria): ' + (R.criteria || ''));
    var hard = S.hard.filter(filled);
    if (hard.length) { L.push('Hard lines, checked by ' + (S.grader.hard || '') + ':'); hard.forEach(function (x) { L.push('  - Pass when ' + x.trim()); }); }
    var dims = S.dims.filter(dimDone);
    if (dims.length) { L.push('Quality, scored 1 to 5 by ' + (S.grader.qual || '') + ':'); dims.forEach(function (d) { L.push('  - ' + d.name.trim() + ': 1 = ' + d.one.trim() + '; 5 = ' + d.five.trim()); }); }
    L.push('Grader check: ' + (S.agree.n ? S.agree.ok + ' of ' + S.agree.n + ' within one point' : 'not run yet (score 10 with your judge)'));
    return L.join('\n');
  }

  scr({ id: 'keep', seg: 2, kick: 'Keep this', h: 'Your eval.',
    render: function (st) {
      track('oh_done', { type: S.row.type, hard: S.hard.filter(filled).length, dims: S.dims.filter(dimDone).length });
      var k = h('<div class="keep"><pre class="copy" data-nolabel></pre>' +
        '<div class="row noprint"><button class="btn go" id="k-copy">Copy as text</button><button class="btn" id="k-print">Print</button><span class="msg" id="k-msg"></span></div>' +
        '<section><h3>Next</h3><ol class="outcomes" style="margin:0">' + [
          ['Paste this eval into your sheet.', 'Copy as text, then paste it into a new tab named Eval, in the same sheet as Practice set 1.', '/c8/module-2/practice-set-2-write-the-eval/#s05', 'Practice set 2, what to submit'],
          ['Re-score your tested row with this rubric.', 'In Practice set 1, section 04, you scored it out of 10 by feel, like the five replies at the start. Check the hard lines first, then score each quality from 1 to 5.', '/c8/module-2/lecture-10-tool-calling-and-mcp/notes#s06', 'Lecture 10, section 06'],
          ['Grow your one golden pair into ten.', 'Real inputs with the output you would accept, the hard ones included. That is your population.', '/c8/module-2/lecture-03-building-ui/notes#s05', 'Lecture 3, section 05'],
          ['Run the stranger test on your rubric.', 'Hand it to someone outside your field with three outputs. If they cannot score without asking you, sharpen your 1 and 5. Don\'t ask an LLM to write it.', '/c8/module-2/lecture-01-orientation/notes#s09', 'Lecture 1, section 09'],
          ['Check your grader against your judge.', 'Both score the same ten. Aim for within one point on 8 of 10.', null, null],
          ['Put the hard lines on the deterministic side.', 'A formula or a few lines of code, not a sentence in a prompt. The check you can\'t afford to get wrong shouldn\'t be a prediction.', '/c8/module-2/lecture-10-tool-calling-and-mcp/notes#s13', 'Lecture 10, section 13'],
          ['Keep the eval for the build.', 'Next we build the bridge that brings the missing context to the model. Your eval is how you will know it worked: verifier, threshold, improve, re-score, stop.', '/c8/module-2/lecture-01-orientation/notes#s08', 'Lecture 1, section 08']
        ].map(function (x) { return '<li><b>' + x[0] + '</b> ' + x[1] + (x[2] ? ' <a href="' + x[2] + '">' + x[3] + '</a>' : '') + '</li>'; }).join('') + '</ol></section>' +
        '<section class="noprint"><button class="btn sm quiet" id="k-reset">Start over on this device</button></section></div>');
      $('pre', k).textContent = asText();
      st.appendChild(k);
      $('#k-copy', k).onclick = function () {
        var t = asText(), m = $('#k-msg', k);
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { m.textContent = 'Copied.'; }, function () { m.textContent = 'Select the text above and copy it.'; });
      };
      $('#k-print', k).onclick = function () { window.print(); };
      var arm = false;
      $('#k-reset', k).onclick = function () {
        if (!arm) { arm = true; this.textContent = 'Tap again to erase everything you wrote here'; return; }
        try { localStorage.removeItem(KEY); } catch (e) {} location.href = location.pathname;
      };
    }, ready: function () { return false; } });

  /* ---------- shell ---------- */
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
    keyHandler = null;
    i = Math.max(0, Math.min(SCREENS.length - 1, i)); S.i = i; if (i > S.max) S.max = i; save();
    var sc = SCREENS[i], main = $('#screen');
    main.innerHTML = '<p class="kick">' + esc(sc.kick || '') + '</p><h1' + (sc.wide ? ' class="wide"' : '') + ' tabindex="-1">' + esc(sc.h) + '</h1>' + (sc.sub ? '<p class="sub">' + esc(sc.sub) + '</p>' : '') + '<div class="stage"></div>';
    sc.render($('.stage', main));
    $('#back').hidden = i === 0;
    $('#where').textContent = sc.seg >= 0 ? (sc.seg + 1) + ' · ' + SEGS[sc.seg] : '';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + sc.id);
    refresh(); window.scrollTo(0, 0); $('h1', main).focus({ preventScroll: true });
    track('oh_screen', { screen: sc.id, seg: sc.seg + 1 });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.C8Kit) window.C8Kit.wbDefs();
    var segs = $('#segs');
    SEGS.forEach(function (s, k) {
      var a = h('<a href="#"><i></i><span><em>' + (k + 1) + '</em><b>' + s + '</b></span></a>');
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
