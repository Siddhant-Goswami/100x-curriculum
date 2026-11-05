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
    sub: 'Drag each reason into a pile.',
    render: function (st) {
      data().then(function (D) {
        var R = D.reasons, sel = null;
        var chips = h('<div class="chips"></div>'), piles = h('<div class="piles"></div>'), after = h('<div></div>');
        st.appendChild(chips); st.appendChild(piles); st.appendChild(after);
        /* Drag a chip (mouse or touch) onto a pile; drop it back on the tray to unsort. Tap still works as a fallback. */
        function drag(el, k) {
          el.addEventListener('pointerdown', function (e) {
            if (S.sortChecked || (e.pointerType === 'mouse' && e.button !== 0)) return;
            var x0 = e.clientX, y0 = e.clientY, ghost = null, over = null, raf = 0, vy = 0, r0 = el.getBoundingClientRect();
            el._dragged = false;
            function target(x, y) {
              if (ghost) ghost.style.display = 'none';
              var t = document.elementFromPoint(x, y);
              if (ghost) ghost.style.display = '';
              return t && (t.closest('.pile') || t.closest('.chips'));
            }
            function scroll() { if (vy) { window.scrollBy(0, vy); raf = requestAnimationFrame(scroll); } else raf = 0; }
            function move(ev) {
              var dx = ev.clientX - x0, dy = ev.clientY - y0;
              if (!ghost) {
                if (Math.abs(dx) + Math.abs(dy) < 6) return;
                el._dragged = true; sel = null;
                ghost = el.cloneNode(true); ghost.className = 'chip ghost';
                ghost.style.width = r0.width + 'px'; document.body.appendChild(ghost);
                el.classList.add('lifted'); document.body.classList.add('dragging');
              }
              ev.preventDefault();
              ghost.style.transform = 'translate(' + (r0.left + dx) + 'px,' + (r0.top + dy) + 'px) rotate(-2deg)';
              var t = target(ev.clientX, ev.clientY);
              if (t !== over) { if (over) over.classList.remove('over'); over = t; if (over) over.classList.add('over'); }
              vy = ev.clientY < 70 ? -12 : ev.clientY > innerHeight - 90 ? 12 : 0;
              if (vy && !raf) raf = requestAnimationFrame(scroll);
            }
            function up(ev) {
              removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
              vy = 0; if (!ghost) return;
              ghost.remove(); document.body.classList.remove('dragging'); el.classList.remove('lifted');
              if (over) over.classList.remove('over');
              var t = ev.type === 'pointerup' ? target(ev.clientX, ev.clientY) : null;
              if (t && t.dataset.pile) S.sort[k] = t.dataset.pile;
              else if (t && t.classList.contains('chips')) delete S.sort[k];
              save(); draw();
              setTimeout(function () { el._dragged = false; }, 0);
            }
            addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
          });
        }
        function draw() {
          chips.innerHTML = ''; piles.innerHTML = ''; after.innerHTML = '';
          R.forEach(function (r, k) {
            if (S.sort[k] != null) return;
            var b = h('<button type="button" class="chip" aria-pressed="' + (sel === k) + '">' + esc(r.text) + '</button>');
            b.onclick = function () { if (b._dragged) return; sel = sel === k ? null : k; draw(); }; drag(b, k); chips.appendChild(b);
          });
          if (!chips.children.length) chips.appendChild(h('<p class="note" style="margin:0">All sorted.</p>'));
          PILES.forEach(function (P) {
            var p = h('<div class="pile ' + P.cls + (sel != null ? ' armed' : '') + '" data-pile="' + P.key + '" role="button" tabindex="0"><h3>' + P.name + '</h3><p class="who">' + P.who + '</p></div>');
            R.forEach(function (r, k) {
              if (S.sort[k] !== P.key) return;
              var c = h('<button type="button" class="chip' + (S.sortChecked && r.pile !== P.key ? ' miss' : '') + '">' + esc(r.text) + '</button>');
              c.onclick = function (e) { e.stopPropagation(); if (S.sortChecked || c._dragged) return; delete S.sort[k]; save(); draw(); };
              if (!S.sortChecked) drag(c, k);
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

  /* a text box with one-tap answers above it; tapping fills the box, typing edits it */
  function pickBox(label, obj, key, opts, ph) {
    var el = box(label, obj, key, ph), inp = $('input', el), row = h('<div class="row picks"></div>');
    function sync() { $$('button', row).forEach(function (x) { x.setAttribute('aria-pressed', x.textContent === obj[key]); }); }
    opts.forEach(function (o) {
      var b = h('<button type="button" class="btn sm">' + esc(o) + '</button>');
      b.onclick = function () { obj[key] = o; inp.value = o; save(); sync(); refresh(); };
      row.appendChild(b);
    });
    inp.addEventListener('input', sync);
    el.insertBefore(row, inp); sync();
    return el;
  }
  var L10 = function (sec, t) { return '<a href="/c8/module-2/lecture-10-tool-calling-and-mcp/notes#s' + sec + '">' + t + '</a>'; };
  var L9N = function (sec, t) { return '<a href="/c8/module-2/lecture-09-llms-from-first-principles/notes#s' + sec + '">' + t + '</a>'; };

  scr({ id: 'grader', seg: 2, kick: 'The grader', h: 'Who checks each layer?',
    sub: 'Tap one, or type your own.',
    render: function (st) {
      if (filled(S.row.verifier)) st.appendChild(h('<p class="note" style="margin-top:16px">Your sheet says: <i>' + esc(S.row.verifier) + '</i></p>'));
      st.appendChild(h('<details class="ex" open><summary>Example: the bill replies from part 1</summary>' +
        '<div class="layer det" style="margin-top:10px"><h3>Hard lines: a few lines of code</h3><p style="margin:0">Refund is never more than the disputed amount.</p></div>' +
        '<div class="layer prob"><h3>Quality: the team lead</h3><p style="margin:0">Says what happens next, scored 1 to 5.</p></div></details>'));
      if (needHard()) {
        var H = h('<div class="layer det"><h3>Hard lines</h3><p class="who">pass or fail · the same answer every time</p><ul class="mine">' +
          S.hard.filter(filled).map(function (x) { return '<li>Pass when ' + esc(x.trim()) + '</li>'; }).join('') + '</ul></div>');
        H.appendChild(pickBox('Checked by', S.grader, 'hard', ['A formula in my sheet', 'A few lines of code', 'A checklist I tick'], 'Or type your own'));
        H.appendChild(h('<p class="note" style="margin:0">Not an LLM. A rule needs the same answer every time. ' + L10('13', 'Lecture 10') + '</p>'));
        st.appendChild(H);
      }
      if (needQual()) {
        var Q = h('<div class="layer prob"><h3>Quality</h3><p class="who">scored 1 to 5 · needs judgment</p><ul class="mine">' +
          S.dims.filter(dimDone).map(function (d) { return '<li><b>' + esc(d.name.trim()) + '</b>: 1 = ' + esc(d.one.trim()) + '; 5 = ' + esc(d.five.trim()) + '</li>'; }).join('') + '</ul></div>');
        Q.appendChild(pickBox('Scored by', S.grader, 'qual', ['Me, with this rubric', 'My manager or lead', 'The client', 'An LLM judge with this rubric'], 'Or type your own, e.g. Priya, our senior designer'));
        Q.appendChild(h('<p class="note" style="margin:0">Whose idea of good counts? ' + L9N('07', 'Lecture 9') + '</p>'));
        st.appendChild(Q);
      }
    }, ready: function () { return (!needHard() || filled(S.grader.hard)) && (!needQual() || filled(S.grader.qual)); }, hint: 'Tap or type who checks each layer.' });

  scr({ id: 'check', seg: 2, kick: 'Check the grader', h: 'You score ten outputs. An LLM scores the same ten. Compare.',
    sub: 'Optional. Skip it if you don\'t have ten outputs yet.',
    render: function (st) {
      if (!needQual()) {
        st.appendChild(reveal('<p><b>All hard lines: nothing to compare.</b> Test your check once on an output you know fails.</p>'));
        return;
      }
      var ex = h('<div class="agree ex" aria-label="Example"></div>'), EA = [4, 2, 5, 3, 4, 1, 3, 5, 2, 4], EB = [4, 3, 3, 3, 5, 1, 4, 5, 4, 4];
      [['You', EA], ['LLM', EB]].forEach(function (r) { ex.appendChild(h('<span>' + r[0] + '</span>')); r[1].forEach(function (v) { ex.appendChild(h('<span class="v">' + v + '</span>')); }); });
      ex.appendChild(h('<span></span>')); EA.forEach(function (v, k) { var ok = Math.abs(v - EB[k]) <= 1; ex.appendChild(h('<span class="mk ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + '</span>')); });
      st.appendChild(h('<p class="lab" style="margin:20px 0 6px">Example: 8 of 10 within one point. Trust the LLM.</p>')); st.appendChild(ex);
      st.appendChild(h('<p class="lab" style="margin:24px 0 6px">Yours</p>'));
      var A = S.agree, g = h('<div class="agree"></div>'), res = h('<p class="note"></p>');
      function calc() {
        var n = 0, ok = 0;
        for (var k = 0; k < 10; k++) { var a = +A.a[k], b = +A.b[k]; if (a >= 1 && a <= 5 && b >= 1 && b <= 5) { n++; if (Math.abs(a - b) <= 1) ok++; } }
        A.n = n; A.ok = ok; save();
        res.textContent = n ? ok + ' of ' + n + ' within one point' + (n >= 10 ? (ok >= 8 ? '. Trust the LLM.' : '. Under 8: rewrite your 1 and 5, then try again.') : '') : '';
        $$('.mk', g).forEach(function (m, k) { var a = +A.a[k], b = +A.b[k]; m.textContent = a && b ? (Math.abs(a - b) <= 1 ? '✓' : '✗') : ''; m.className = 'mk ' + (a && b ? (Math.abs(a - b) <= 1 ? 'ok' : 'no') : ''); });
      }
      [['a', 'You'], ['b', 'LLM']].forEach(function (r) {
        g.appendChild(h('<span>' + r[1] + '</span>'));
        for (var k = 0; k < 10; k++) (function (k) {
          var i = h('<input type="text" inputmode="numeric" maxlength="1" aria-label="' + r[1] + ', output ' + (k + 1) + '">'); i.value = A[r[0]][k] || '';
          i.oninput = function () { i.value = i.value.replace(/[^1-5]/g, ''); A[r[0]][k] = i.value; calc(); };
          g.appendChild(i);
        })(k);
      });
      g.appendChild(h('<span></span>')); for (var k = 0; k < 10; k++) g.appendChild(h('<span class="mk"></span>'));
      st.appendChild(g); st.appendChild(res); calc();
      {
        var dims = S.dims.filter(dimDone), P = 'You are scoring one output for this task: ' + (S.row.task || '') + '.\n\nScore each line from 1 to 5, using only these ends:\n' +
          dims.map(function (d) { return '- ' + d.name.trim() + ': 1 = ' + d.one.trim() + '; 5 = ' + d.five.trim(); }).join('\n') +
          '\n\nReply with one line per item: name, score, one reason.\n\nOutput to score:\n[paste one output here]';
        var d = h('<details class="ex" style="margin-top:20px"><summary>Prompt for the LLM</summary><pre class="copy" data-nolabel></pre><div class="row"><button class="btn sm" type="button">Copy prompt</button><span class="note" style="margin:0"></span></div><p class="note">One output per new chat.</p></details>');
        $('pre', d).textContent = P;
        $('button', d).onclick = function () { var m = $('span.note', d); (navigator.clipboard ? navigator.clipboard.writeText(P) : Promise.reject()).then(function () { m.textContent = 'Copied.'; }, function () { m.textContent = 'Select the text above and copy it.'; }); };
        st.appendChild(d);
      }
    }, ready: function () { return true; } });

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

  /* ---------- the last screen: celebrate, show the eval, show the path ---------- */
  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var old = $('#confetti'); if (old) old.remove();
    var cv = document.createElement('canvas'); cv.id = 'confetti'; document.body.appendChild(cv);
    var cx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.scale(dpr, dpr);
    var cs = getComputedStyle(document.documentElement), col = ['--coral', '--det', '--prob', '--hum', '--coral'].map(function (v) { return cs.getPropertyValue(v).trim() || '#F2603C'; });
    var P = [];
    function burst(x, y, n, ang, spread, speed) {
      for (var k = 0; k < n; k++) {
        var a = ang + (Math.random() - .5) * spread, v = speed * (.55 + Math.random() * .6);
        P.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 6, h: 4 + Math.random() * 8, r: Math.random() * 6.3, vr: (Math.random() - .5) * .3, c: col[k % col.length], round: Math.random() < .3, life: 0 });
      }
    }
    burst(0, H * .9, 90, -Math.PI / 3, .9, Math.max(14, H / 45));
    burst(W, H * .9, 90, -Math.PI * 2 / 3, .9, Math.max(14, H / 45));
    setTimeout(function () { burst(W / 2, -10, 70, Math.PI / 2, 2.4, 6); }, 350);
    var t0 = performance.now();
    (function tick(t) {
      cx.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.life++; p.vy += .32; p.vx *= .985; p.vy *= .985; p.x += p.vx + Math.sin(p.life / 9) * .6; p.y += p.vy; p.r += p.vr;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
        if (p.round) { cx.beginPath(); cx.arc(0, 0, p.w / 2.4, 0, 6.3); cx.fill(); } else { cx.scale(1, Math.cos(p.life / 6)); cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        cx.restore();
      });
      P = P.filter(function (p) { return p.y < H + 40; });
      if (P.length && t - t0 < 7000) requestAnimationFrame(tick); else cv.remove();
    })(t0);
  }
  function countUp(el, to) {
    if (!(to > 0) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { el.textContent = to; return; }
    var t0 = performance.now(), d = 900;
    (function f(t) { var q = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - q, 3))); if (q < 1) requestAnimationFrame(f); })(t0);
  }
  function seal() {
    return '<svg class="badge" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" class="b-bg"/><circle cx="32" cy="32" r="30" class="b-ring"/><path d="M20 33l8 8 16-17" class="b-ck"/></svg>';
  }

  /* The eval as a workbook, laid out like a GDPval task: the task card, the rubric, ten rows to score, the grader check, and the GDPval example. */
  var XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  function loadXLSX() {
    return window.XLSX ? Promise.resolve(window.XLSX) : new Promise(function (ok, no) {
      var sc = document.createElement('script'); sc.src = XLSX_SRC; sc.onload = function () { ok(window.XLSX); }; sc.onerror = no; document.head.appendChild(sc);
    });
  }
  function judgePrompt(dims) {
    return 'You are scoring one output for this task: ' + (S.row.task || '') + '.\n\nScore each line from 1 to 5, using only these ends:\n' +
      dims.map(function (d) { return '- ' + d.name.trim() + ': 1 = ' + d.one.trim() + '; 5 = ' + d.five.trim(); }).join('\n') +
      '\n\nReply with one line per item: name, score, one reason.\n\nOutput to score:\n[paste one output here]';
  }
  function buildBook(X) {
    var hard = S.hard.filter(filled).map(function (x) { return x.trim(); }), dims = S.dims.filter(dimDone), A = S.agree;
    var col = function (n) { var s = ''; n++; while (n) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    var F = function (f) { return { t: 'n', v: 0, f: f }; }, FS = function (f) { return { t: 's', v: '', f: f }; };
    var wb = X.utils.book_new();
    function sheet(name, rows, widths) { var ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = widths.map(function (w) { return { wch: w }; }); X.utils.book_append_sheet(wb, ws, name); return ws; }

    function card(t) {
      return [
        ['EVAL', ''], ['Task', t.task], ['Role', t.role], ['Decision', t.decision], ['Population', t.population], ['Definition of good', t.criteria],
        ['Hard lines checked by', t.gh], ['Quality scored by', t.gq], ['Pass bar', 'A row passes when every hard line is Pass and the quality average is at least the number below.'], ['Quality average needed', 4],
        [''], ['Tabs', 'Rubric: every line you score. Scores: ten real inputs, scored. Grader check: you and an LLM on the same ten.'], [''], ['LLM judge prompt', t.prompt || '']
      ];
    }
    sheet('Your eval', card({ task: S.row.task || '', role: '', decision: S.dec.decision || '', population: S.dec.population || '', criteria: S.row.criteria || '',
      gh: S.grader.hard || '', gq: S.grader.qual || '', prompt: dims.length ? judgePrompt(dims) : '' }), [24, 100]);

    var rub = [['#', 'Layer', 'Criterion', 'Scored as', 'Points']], n = 0;
    hard.forEach(function (x) { rub.push([++n, 'Hard line', 'Pass when ' + x, 'Pass or Fail', 1]); });
    dims.forEach(function (d) { rub.push([++n, 'Quality', d.name.trim() + ': 1 = ' + d.one.trim() + '; 5 = ' + d.five.trim(), '1 to 5', 5]); });
    rub.push(['', '', 'Add more lines here. Hard lines veto; quality gets a written 1 and 5.', '', '']);
    rub.push(['', '', 'Total points', '', F('SUM(E2:E' + (n + 1) + ')')]);
    sheet('Rubric', rub, [4, 12, 80, 14, 8]);

    var hd = ['#', 'Input (a real past one)', 'Output to score'];
    hard.forEach(function (x, k) { hd.push('H' + (k + 1) + ': ' + x); });
    dims.forEach(function (d) { hd.push(d.name.trim() + ' (1 to 5)'); });
    var h0 = 3, q0 = h0 + hard.length, end = q0 + dims.length;
    hd.push('Hard lines all pass?', 'Quality average', 'Passes?');
    var sc = [hd];
    for (var r = 2; r <= 11; r++) {
      var row = [r - 1, '', ''];
      for (var c = h0; c < end; c++) row.push('');
      var hr = hard.length ? col(h0) + r + ':' + col(q0 - 1) + r : null, qr = dims.length ? col(q0) + r + ':' + col(end - 1) + r : null;
      row.push(hr ? FS('IF(COUNTA(' + hr + ')=0,"",IF(COUNTIF(' + hr + ',"Fail")>0,"No","Yes"))') : FS(qr ? 'IF(COUNT(' + qr + ')=0,"","Yes")' : '""'));
      row.push(qr ? F('IF(COUNT(' + qr + ')=0,"",ROUND(AVERAGE(' + qr + '),1))') : '');
      var hc = col(end) + r, qc = col(end + 1) + r;
      row.push(FS('IF(' + hc + '="","",IF(AND(' + hc + '="Yes",' + (qr ? 'OR(' + qc + '="",' + qc + '>=\'Your eval\'!B10)' : 'TRUE') + '),"Pass","Fail"))'));
      sc.push(row);
    }
    sc.push([]);
    var pc = col(end + 2);
    sc.push(['', 'Passed', FS('COUNTIF(' + pc + '2:' + pc + '11,"Pass")&" of "&COUNTA(B2:B11)')]);
    sc.push(['', 'How to fill', 'Hard lines: type Pass or Fail. Quality: type 1 to 5. The last three columns fill in.']);
    var w = [4, 40, 40]; for (var c2 = h0; c2 < end; c2++) w.push(18); w.push(16, 14, 10);
    sheet('Scores', sc, w);

    var gc = [['Output', 'You (1 to 5)', 'LLM (1 to 5)', 'Within one point?']];
    for (var k = 0; k < 10; k++) {
      var a = +A.a[k] || '', b = +A.b[k] || '', rr = k + 2;
      gc.push([k + 1, a, b, FS('IF(OR(B' + rr + '="",C' + rr + '=""),"",IF(ABS(B' + rr + '-C' + rr + ')<=1,"Yes","No"))')]);
    }
    gc.push([], ['', 'Agreed', FS('COUNTIF(D2:D11,"Yes")&" of "&COUNT(B2:B11)')], ['', 'Rule', '8 of 10 within one point: trust the LLM on the rest. Under 8: sharpen your 1 and 5.']);
    sheet('Grader check', gc, [8, 14, 14, 18]);

    var ex = card({ task: 'Pick one brand\'s 2025 resort collection, put 4 to 6 looks on slides, and write an email or text template staff can reuse to invite clients to book an appointment.',
      role: 'Senior client advisor, luxury clothing boutique (GDPval task bd72994f)',
      decision: 'If 8 of 10 AI-drafted invites pass, the manager gives new staff the AI draft to start from. If not, the senior advisor keeps writing them.',
      population: 'Ten real briefs: different brands, seasons and clients, including a client who only takes texts.',
      criteria: 'An invite a new advisor could send today, with looks that sell the collection.',
      gh: 'A checklist I tick', gq: 'Two senior advisors, then an LLM judge with this rubric' });
    ex.push([''], ['Rubric', ''], ['Hard line', 'Pass when it greets with a [First Name] placeholder'], ['Hard line', 'Pass when it asks the client to book, schedule or reserve'],
      ['Hard line', 'Pass when it gives a way to book: reply with a time, or a number to call'], ['Hard line', 'Pass when it ends with the advisor\'s name and a contact'],
      ['Hard line', 'Pass when an email has a subject line'], ['Hard line', 'Pass when a text says how to opt out'],
      ['Quality', 'The looks: 1 = items that don\'t belong together, or the same outfit three times; 5 = every look is one outfit that hangs together, each clearly different'],
      [''], ['Source', GDPVAL_TASK + ' . GDPval\'s real rubric is 19 yes-or-no lines worth 29 points; it is summarised here. The decision, population and grader check are ours.']);
    sheet('Example: GDPval', ex, [24, 100]);
    return wb;
  }
  function downloadBook(btn, msg) {
    var was = btn.textContent; btn.disabled = true; btn.textContent = 'Building…';
    loadXLSX().then(function (X) {
      var name = 'eval-' + (String(S.row.task || 'my-task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'my-task') + '.xlsx';
      X.writeFile(buildBook(X), name);
      track('oh_download', { hard: S.hard.filter(filled).length, dims: S.dims.filter(dimDone).length });
      btn.textContent = 'Downloaded ✓'; if (msg) msg.textContent = 'Open it in Google Sheets (File, Import) or Excel.';
    }, function () { btn.textContent = was; if (msg) msg.textContent = 'Could not load the sheet maker. Use Copy as text instead.'; }).then(function () { btn.disabled = false; });
  }

  scr({ id: 'keep', seg: 2, bare: true, kick: 'Done', h: 'You wrote your first eval.',
    render: function (st) {
      track('oh_done', { type: S.row.type, hard: S.hard.filter(filled).length, dims: S.dims.filter(dimDone).length });
      var hard = S.hard.filter(filled), dims = S.dims.filter(dimDone), A = S.agree, ran = A.n >= 1;
      var link = function (href, t) { return '<a href="' + href + '">' + t + '</a>'; };

      /* 1 the moment */
      var hero = h('<section class="win noprint"><button type="button" class="win-art" aria-label="Celebrate again">' + seal() + '</button><div class="win-txt">' +
        '<p class="kick">Practice set 2 · Done</p><h1 tabindex="-1">You wrote your first eval.</h1>' +
        '<p class="sub">Most people use AI and hope. You can now <b>measure</b> it: a decision, a definition of good, and a grader you can trust.</p></div></section>');
      st.appendChild(hero);
      $('.win-art', hero).onclick = confetti;

      var stats = h('<div class="stats noprint">' +
        '<div class="st det"><b data-n="' + hard.length + '">0</b><span>hard line' + (hard.length === 1 ? '' : 's') + '</span></div>' +
        '<div class="st prob"><b data-n="' + dims.length + '">0</b><span>qualit' + (dims.length === 1 ? 'y' : 'ies') + ' with a 1 and a 5</span></div>' +
        '<div class="st hum">' + (ran ? '<b><i data-n="' + A.ok + '">0</i><small>/' + A.n + '</small></b><span>scores agreed with the LLM</span>' : '<b><i data-n="4">0</i><small>/4</small></b><span>parts of an eval, written</span>') + '</div>' +
        '<div class="st"><b data-n="12">0</b><span>steps, start to finish</span></div></div>');
      st.appendChild(stats);
      $$('[data-n]', stats).forEach(function (el, k) { setTimeout(function () { countUp(el, +el.dataset.n); }, 500 + k * 120); });

      /* 2 this is real work */
      var parts = ['Decision', 'Population', 'Definition of good', 'Grader'];
      var chipsOf = function (on) { return '<ul class="pt">' + parts.map(function (p, k) { return '<li class="' + (on[k] ? 'on' : '') + '">' + p + '</li>'; }).join('') + '</ul>'; };
      st.appendChild(h('<section class="pro noprint"><h2>Same shape as the evals AI labs pay experts for.</h2>' +
        '<p class="lede">OpenAI\'s <a href="' + GDPVAL_TASK + '" target="_blank" rel="noopener">GDPval</a> is 1,320 real work tasks from 44 jobs. Each one was written and graded by a professional with about 14 years in the role. Companies now hire doctors, lawyers and analysts to write exactly this.</p>' +
        '<div class="vs"><div class="vc"><p class="vk">GDPval · task bd72994f</p><p class="vt">Client invite for a luxury boutique</p><p class="vm">19 yes-or-no lines · 29 points</p>' + chipsOf([1, 1, 1, 1]) + '</div>' +
        '<div class="eq" aria-hidden="true">=</div>' +
        '<div class="vc me"><p class="vk">Yours</p><p class="vt">' + esc(S.row.task || 'Your task') + '</p><p class="vm">' + hard.length + ' hard · ' + dims.length + ' quality</p>' +
        chipsOf([filled(S.dec.decision), filled(S.dec.population), hard.length || dims.length, filled(S.grader.hard) || filled(S.grader.qual)]) + '</div></div></section>'));

      /* 3 the eval itself */
      var row = function (cls, t, sub, body) { return '<div class="er ' + cls + '"><h4>' + t + (sub ? ' <small>' + sub + '</small>' : '') + '</h4>' + body + '</div>'; };
      var dots = '';
      for (var k = 0; k < 10; k++) { var a = +A.a[k], b = +A.b[k]; dots += '<i class="' + (a && b ? (Math.abs(a - b) <= 1 ? 'ok' : 'no') : '') + '">' + (a && b ? (Math.abs(a - b) <= 1 ? '✓' : '✗') : '') + '</i>'; }
      var card = h('<section class="ec-wrap"><div class="ec-head noprint"><h2>Your eval</h2><div class="row"><button class="btn go" id="k-dl">Download as spreadsheet</button><button class="btn" id="k-copy">Copy as text</button><button class="btn quiet" id="k-print">Print</button><span class="msg" id="k-msg" aria-live="polite"></span></div></div>' +
        '<article class="ec"><header><span class="tag">Eval</span><h3>' + esc(S.row.task || '') + '</h3><p>' + [S.row.type, S.row.data ? 'data ' + S.row.data : '', S.row.verifier ? 'verifier: ' + S.row.verifier : ''].filter(Boolean).map(esc).join(' · ') + '</p></header>' +
        row('', 'Decision', '', '<p>' + esc(S.dec.decision || '') + '</p>') +
        row('', 'Population', '', '<p>' + esc(S.dec.population || '') + '</p>') +
        (filled(S.row.criteria) ? row('', 'Definition of good', '', '<p>' + esc(S.row.criteria) + '</p>') : '') +
        (hard.length ? row('det', 'Hard lines', 'pass or fail · ' + esc(S.grader.hard || ''), '<ul class="tk">' + hard.map(function (x) { return '<li>' + esc(x.trim()) + '</li>'; }).join('') + '</ul>') : '') +
        (dims.length ? row('prob', 'Quality', '1 to 5 · ' + esc(S.grader.qual || ''), dims.map(function (d) { return '<div class="sc5"><b>' + esc(d.name.trim()) + '</b><div class="ends"><span><em>1</em>' + esc(d.one.trim()) + '</span><i></i><span><em>5</em>' + esc(d.five.trim()) + '</span></div></div>'; }).join('')) : '') +
        row('hum', 'Grader check', ran ? A.ok + ' of ' + A.n + ' within one point' : 'not run yet', ran ? '<div class="dots">' + dots + '</div>' + (A.n >= 10 ? '<p class="small">' + (A.ok >= 8 ? 'Trust the LLM on the rest.' : 'Under 8: sharpen your 1 and 5, then score again.') + '</p>' : '') : '<p class="small">You and an LLM score the same ten. 8 of 10 within one point: trust it.</p>') +
        '</article></section>');
      st.appendChild(card);
      $('#k-copy', card).onclick = function () {
        var m = $('#k-msg', card), b = this;
        (navigator.clipboard ? navigator.clipboard.writeText(asText()) : Promise.reject()).then(function () { m.textContent = 'Copied. Paste it into your sheet.'; b.textContent = 'Copied ✓'; }, function () { m.textContent = 'Select the eval above and copy it.'; });
      };
      $('#k-print', card).onclick = function () { window.print(); };
      $('#k-dl', card).onclick = function () { downloadBook(this, $('#k-msg', card)); };

      /* 4 what is left */
      st.appendChild(h('<section class="next noprint"><h2>Two things left <small>before Lecture 11, Thu 12 Nov</small></h2><div class="todo">' +
        '<div class="td dl"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg></span><div><b>Download your eval sheet.</b><p>Set up like GDPval: your rubric, ten rows to score, the grader check, and the GDPval task as an example. Fill it, then share it on the Discord.</p><div class="row" style="margin-top:10px"><button class="btn go sm" type="button">Download .xlsx</button><span class="msg" aria-live="polite" style="margin:0"></span></div></div></div>' +
        '<div class="td"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h16M7 16V9M12 16V5M17 16v-4"/></svg></span><div><b>Re-score your tested row with it.</b><p>You scored it out of 10 by feel. Score it again in the Scores tab: hard lines first, then each quality 1 to 5. ' + link('/c8/module-2/lecture-10-tool-calling-and-mcp/notes#s06', 'Lecture 10, section 06') + '</p></div></div>' +
        '</div></section>'));

      var dl2 = $('.td.dl', st); $('button', dl2).onclick = function () { downloadBook(this, $('.msg', dl2)); };

      /* 5 the path, on request */
      var path = h('<details class="path noprint"><summary><span>See how you got here</span><small>12 steps</small></summary><ol class="tl"></ol></details>');
      st.appendChild(path);
      data().then(function (D) {
        var policyRight = D.items.filter(function (x) { return !!x.breaks === !!S.pick[x.id]; }).length;
        var sortRight = D.reasons.filter(function (r, k) { return S.sort[k] === r.pile; }).length;
        var pills = D.items.map(function (x) { return '<span class="pill">' + (S.g[x.id] || '–') + '</span>'; }).join('');
        var cut = function (s, n) { s = String(s || '').trim(); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); };
        var steps = [
          [0, 'Scored five replies by feel', pills],
          [0, 'Saw two people give reply 1 a 5 and a 1', 'Scoring by feel doesn\'t agree.'],
          [0, 'Spotted the policy breaks', policyRight + ' of 5 calls right'],
          [1, 'Met the four parts of an eval', 'Decision, population, definition of good, grader.'],
          [1, 'Sorted six reasons into three layers', sortRight + ' of 6 in the right pile'],
          [1, 'Read a real GDPval task as an eval', 'Senior client advisor, luxury retail.'],
          [2, 'Brought your tested row', cut(S.row.task, 90)],
          [2, 'Wrote the decision', cut(S.dec.decision, 110)],
          [2, hard.length ? 'Wrote ' + hard.length + ' hard line' + (hard.length === 1 ? '' : 's') : 'Chose no hard lines', hard.length ? cut(hard[0], 90) : 'No rule fits this task.'],
          [2, dims.length ? 'Wrote a 1 and a 5 for ' + dims.length + ' qualit' + (dims.length === 1 ? 'y' : 'ies') : 'Let the rules cover it', dims.map(function (d) { return '<span class="pill p">' + esc(d.name.trim()) + '</span>'; }).join('')],
          [2, 'Picked who checks each layer', [S.grader.hard, S.grader.qual].filter(filled).map(esc).join(' · ')],
          [2, 'Checked the grader', ran ? A.ok + ' of ' + A.n + ' within one point' : 'Next: score ten with your judge.']
        ];
        var ol = $('ol.tl', path), last = -1;
        steps.forEach(function (s, k) {
          if (s[0] !== last) { last = s[0]; ol.appendChild(h('<li class="grp"><span>' + (s[0] + 1) + ' · ' + SEGS[s[0]] + '</span></li>')); }
          ol.appendChild(h('<li class="sp" style="--d:' + k * 45 + 'ms"><i aria-hidden="true">✓</i><div><b>' + s[1] + '</b><p>' + s[2] + '</p></div></li>'));
        });
        ol.appendChild(h('<li class="sp end" style="--d:' + steps.length * 45 + 'ms"><i aria-hidden="true">★</i><div><b>Wrote your first eval</b><p>' + link('#keep', 'Back to the top') + '</p></div></li>'));
        $('.end a', ol).onclick = function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      });

      st.appendChild(h('<details class="opt noprint"><summary>Optional, when you have time</summary><ol class="outcomes">' + [
        ['Grow your one golden pair into ten.', 'Real inputs with the output you would accept, hard ones included.', '/c8/module-2/lecture-03-building-ui/notes#s05', 'Lecture 3, section 05'],
        ['Run the stranger test.', 'Give your rubric and three outputs to someone outside your field. If they have to ask you, sharpen your 1 and 5.', '/c8/module-2/lecture-01-orientation/notes#s09', 'Lecture 1, section 09'],
        ['Put the hard lines in code.', 'A formula or a few lines of code, not a sentence in a prompt.', '/c8/module-2/lecture-10-tool-calling-and-mcp/notes#s13', 'Lecture 10, section 13'],
        ['Keep it for the build.', 'Next we bring the missing context to the model. This eval tells you it worked.', '/c8/module-2/lecture-01-orientation/notes#s08', 'Lecture 1, section 08']
      ].map(function (x) { return '<li><b>' + x[0] + '</b> ' + x[1] + ' ' + link(x[2], x[3]) + '</li>'; }).join('') + '</ol></details>'));

      var rs = h('<p class="noprint kreset"><button class="btn sm quiet" id="k-reset">Start over on this device</button></p>');
      st.appendChild(rs);
      var arm = false;
      $('#k-reset', rs).onclick = function () {
        if (!arm) { arm = true; this.textContent = 'Tap again to erase everything you wrote here'; return; }
        try { localStorage.removeItem(KEY); } catch (e) {} location.href = location.pathname;
      };
      setTimeout(confetti, 450);
    }, ready: function () { return true; } });

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
    main.innerHTML = sc.bare ? '<div class="stage"></div>' : '<p class="kick">' + esc(sc.kick || '') + '</p><h1' + (sc.wide ? ' class="wide"' : '') + ' tabindex="-1">' + esc(sc.h) + '</h1>' + (sc.sub ? '<p class="sub">' + esc(sc.sub) + '</p>' : '') + '<div class="stage"></div>';
    main.classList.toggle('bare', !!sc.bare);
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
