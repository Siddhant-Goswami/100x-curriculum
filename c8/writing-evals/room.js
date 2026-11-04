/* Writing Evals projector: one panel per segment, switched with keys 1 to 6 or the arrows.
   Reads the room's anonymous answers from the same Apps Script web app the students post to (see evals.js). */
(function () {
  'use strict';
  var ROOM_URL = ''; /* same /exec URL as evals.js */
  /* a dry run can point at another sheet without a deploy: localStorage we.roomUrl */
  try { ROOM_URL = localStorage.getItem('we.roomUrl') || ROOM_URL; } catch (e) {}
  var DATA = '/c8/writing-evals/data/';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var params = new URLSearchParams(location.search), code = (params.get('room') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  var panel = 0, reveal = 0;
  var PANELS = ['The hook', 'The instrument', 'Blind grading', 'Three layers', 'Judge the judge', 'Close'];
  var PARTS = [['Decision', 'what we do differently when the number moves'], ['Population of inputs', 'sampled from the world you care about'], ['Definition of good', 'written down before you see any outputs'], ['Grader', 'with an error rate you have measured']];
  function pull(kind) {
    return fetch(ROOM_URL + '?room=' + encodeURIComponent(code) + '&kind=' + kind).then(function (r) { return r.json(); }).then(function (j) {
      var by = {}; (j.rows || []).forEach(function (r) { by[r.cid + (kind === 'q' ? r.payload.step : '')] = r; }); return Object.keys(by).map(function (k) { return by[k]; });
    });
  }
  function board(n) {
    return '<div class="board">' + PARTS.map(function (p, k) { var on = k < n; return '<div class="bx' + (on ? ' on' : '') + '"><svg aria-hidden="true"><rect x="2" y="2" rx="10" ry="10"/></svg><span class="n">' + (k + 1) + '</span><b class="t">' + (on ? p[0] : '?') + '</b>' + (on ? '<span class="s">' + p[1] + '</span>' : '') + '</div>'; }).join('') + '</div>';
  }
  function top(rows, step, n) {
    var c = {}; rows.filter(function (r) { return r.payload.step === step; }).forEach(function (r) { var t = String(r.payload.text).trim().toLowerCase(); c[t] = (c[t] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).slice(0, n);
  }
  var R = {
    0: function (m) { pull('move').then(function (rows) { m.innerHTML = '<p class="join">Open <b>100x-curriculum.vercel.app/c8/writing-evals</b> and join room <b>' + esc(code) + '</b></p><h1>"Evaluate our chatbot. You have a week. Go." The first thing you would do:</h1><ul class="room">' + rows.map(function (r) { return '<li>' + esc(r.payload.text) + '</li>'; }).join('') + '</ul><p class="room-n">' + rows.length + ' answers</p>'; }); },
    1: function (m) { pull('q').then(function (rows) {
      var col = [['inputs', 'Inputs have to be'], ['good', 'Good means'], ['grader', 'Applied by']];
      m.innerHTML = '<h1>The instrument, from your answers</h1>' + board(reveal) + '<div class="pair" style="grid-template-columns:repeat(3,1fr);max-width:1200px">' + col.map(function (c) { return '<div class="card"><p class="kick">' + c[1] + '</p><ul class="room" style="margin:0">' + top(rows, c[0], 8).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div><p class="keys">Space draws the next part of the board.</p>';
    }); },
    2: function (m) { Promise.all([pull('scores'), fetch(DATA + 'dispute20.json').then(function (r) { return r.json(); })]).then(function (x) {
      var sheets = x[0].map(function (r) { return r.payload.scores; }), n = 20, g = '<div class="spread"><span class="h">reply</span>' + [1, 2, 3, 4, 5].map(function (v) { return '<span class="h">' + v + '</span>'; }).join('') + '<span class="h" style="text-align:right">range</span>';
      var stats = []; for (var j = 0; j < n; j++) { var c = [0, 0, 0, 0, 0, 0], col = sheets.map(function (s) { return s[j]; }).filter(Boolean); col.forEach(function (v) { c[v]++; }); stats.push({ c: c, min: col.length ? Math.min.apply(null, col) : 0, max: col.length ? Math.max.apply(null, col) : 0 }); }
      var maxc = Math.max(1, Math.max.apply(null, stats.map(function (s) { return Math.max.apply(null, s.c); })));
      stats.forEach(function (s, j) { g += '<span class="id">' + (j + 1) + '</span>'; for (var v = 1; v <= 5; v++) { var z = s.c[v] ? Math.round(8 + 22 * Math.sqrt(s.c[v] / maxc)) : 0; g += '<span class="c">' + (z ? '<i style="width:' + z + 'px;height:' + z + 'px"></i>' : '') + '</span>'; } g += '<span class="rng">' + (s.max ? s.min + ' to ' + s.max : '') + '</span>'; });
      var tot = 0, cnt = 0; for (var k = 0; k < n; k++) { var col2 = sheets.map(function (s) { return s[k]; }).filter(Boolean), p = 0, ok = 0; for (var a = 0; a < col2.length; a++) for (var b = a + 1; b < col2.length; b++) { p++; if (Math.abs(col2[a] - col2[b]) <= 1) ok++; } if (p) { tot += ok / p; cnt++; } }
      m.innerHTML = '<h1>Same replies. Look how far apart the scores are.</h1><div class="duo"><div><div class="k">Score sheets in</div><div class="v">' + sheets.length + '</div></div><div><div class="k">Pairs within one point</div><div class="v">' + (cnt ? Math.round(100 * tot / cnt) + '%' : '–') + '</div></div></div>' + g + '</div><p class="keys">Pick the widest reply. Ask the 1 and the 5 to defend their score.</p>';
    }); },
    3: function (m) { m.innerHTML = '<h1>Each table takes one industry for the rest of the session.</h1><div class="tbl-groups">' + [['Table 1', 'Support', 'the easiest start'], ['Table 2', 'Legal', 'slow on citations'], ['Table 3', 'Healthcare', ''], ['Table 4', 'Manufacturing', ''], ['Table 5', 'Finance', 'slow on number tracing']].map(function (t) { return '<div><span>' + t[0] + '</span><b>' + t[1] + '</b><span>' + t[2] + '</span></div>'; }).join('') + '</div><p class="keys">Legal and finance groups five minutes behind: tell them to pick the provided checks and move to the judge.</p>'; },
    4: function (m) { pull('agree').then(function (rows) {
      var by = {}; rows.forEach(function (r) { var k = r.payload.industry; (by[k] = by[k] || []).push(r.payload); });
      var names = { support: 'Support', legal: 'Legal', health: 'Healthcare', mfg: 'Manufacturing', fin: 'Finance' };
      var avg = function (a, f) { return Math.round(a.reduce(function (s, x) { return s + x[f]; }, 0) / a.length); };
      m.innerHTML = '<h1>Your judges against the experts.</h1><table class="agree"><tr><th>Industry</th><th>Reported</th><th>Expert vs expert</th><th>Judge vs experts</th><th>Gap</th></tr>' + Object.keys(names).filter(function (k) { return by[k]; }).map(function (k) { var a = by[k]; return '<tr><td>' + names[k] + '</td><td>' + a.length + '</td><td style="color:var(--hum-ink)">' + avg(a, 'ee') + '%</td><td style="color:var(--prob-ink)">' + avg(a, 'je') + '%</td><td style="color:var(--coral-ink)">' + (avg(a, 'ee') - avg(a, 'je')) + ' points</td></tr>'; }).join('') + '</table><p class="keys">Let it land before you speak. Then: the fix is almost always the wording, not a bigger model.</p>';
    }); },
    5: function (m) { pull('ticket').then(function (rows) {
      m.innerHTML = '<h1>Exit tickets: one eval for something you are building.</h1><div class="duo"><div><div class="k">Handed in</div><div class="v">' + rows.length + '</div></div></div><p><button class="btn" id="csv">Download the tickets as CSV</button></p><p class="keys">Scan for two failures: a decision that would not change with the score, and a definition of good that needs outputs first. One-line comment to each within 48 hours.</p>';
      $('#csv').onclick = function () {
        var cols = ['feature', 'decision', 'population', 'good', 'grader', 'c1', 'c2'], q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
        var csv = ['cid,' + cols.join(',')].concat(rows.map(function (r) { return q(r.cid) + ',' + cols.map(function (c) { return q(r.payload[c]); }).join(','); })).join('\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'exit-tickets-' + code + '.csv'; a.click();
      };
    }); }
  };
  function show(k) {
    panel = (k + 6) % 6;
    [].forEach.call(document.querySelectorAll('#pbar button'), function (b, i) { b.toggleAttribute('aria-current', i === panel); });
    try { R[panel]($('#screen')); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.C8Kit) window.C8Kit.wbDefs();
    var m = $('#screen');
    if (!ROOM_URL) { m.innerHTML = '<h1>Room mode is not connected yet.</h1><p class="sub">Deploy the Apps Script in _plan/writing-evals/apps-script.gs and paste its URL into ROOM_URL in evals.js and room.js. Students can work alone meanwhile; the recorded room stands in.</p>'; return; }
    if (!code) {
      var w = ['north', 'tide', 'ember', 'quill', 'cedar', 'flint', 'orbit', 'maple'], sug = w[Math.floor(Math.random() * w.length)] + '-' + Math.floor(10 + Math.random() * 89);
      m.innerHTML = '<h1>Pick a room code for this session.</h1><div class="row"><input type="text" id="rc" value="' + sug + '" style="max-width:260px"><button class="btn go" id="go">Open the room</button></div>';
      $('#go').onclick = function () { location.search = '?room=' + encodeURIComponent($('#rc').value.toLowerCase().replace(/[^a-z0-9-]/g, '')); };
      return;
    }
    $('#code').textContent = 'room ' + code;
    PANELS.forEach(function (p, k) { var b = document.createElement('button'); b.type = 'button'; b.textContent = (k + 1) + ' ' + p; b.onclick = function () { show(k); }; $('#pbar').appendChild(b); });
    var rb = document.createElement('button'); rb.type = 'button'; rb.className = 'rf'; rb.textContent = 'Refresh (R)'; rb.onclick = function () { show(panel); }; $('#pbar').appendChild(rb);
    document.addEventListener('keydown', function (e) {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (/^[1-6]$/.test(e.key)) show(+e.key - 1);
      else if (e.key === 'ArrowRight') show(panel + 1);
      else if (e.key === 'ArrowLeft') show(panel - 1);
      else if (e.key === 'r' || e.key === 'R') show(panel);
      else if (e.key === ' ' && panel === 1) { e.preventDefault(); reveal = Math.min(4, reveal + 1); R[1](m); }
    });
    show(0);
  });
})();
