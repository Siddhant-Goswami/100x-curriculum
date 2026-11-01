/* Evals Lab: four steps, 33 screens, one thing to do per screen. Data in data/traces.json (built by _plan/evals/build_traces.py).
   Each screen is a beat in BEATS: render function r(), and ok() that says whether its one thing is done.
   The Continue button (#forward) is moved into the current screen and only exists once ok() is true.
   State lives in localStorage under c8.evalslab.v3 so a student can leave and come back. The Groq key never leaves the tab.
   Plan: _plan/evals/LAB_PLAN.md */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (name, props) => { try { window.posthog && window.posthog.capture(name, props || {}); } catch (e) {} };
  const KEY = 'c8.evalslab.v3';
  const pct = v => Math.round(v * 100) + '%';
  const usd = v => '$' + (v >= 1 ? v.toFixed(2) : v.toFixed(3));

  let D = null;
  const S = Object.assign({
    words: [], done: [], g: {}, reach: 0,
    s0: { hit: false, outcome: false, misses: 0 },
    m1: { i: 0, sent: {}, saved: {} }, m2: { i: 0, names: {} },
    m3: { i: 0, kinds: {} },
    m4: { text: '', locked: null, judge: {}, live: false },
    m5: { i: 0, labels: {}, uncovered: false }, m6: { played: false, p: 75, k: 3 },
    m7: { change: null }, m8: { off: false, on: false, graded: null, attacks: {} },
    tr: { text: '', saved: false }
  }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  /* ---------- words, earned silently, listed on the last screen ---------- */
  const WORDS = {
    transcript: ['Trace', 'The whole record of one run: the input, every tool call and result, and the final answer. You read traces, not answers.'],
    grader: ['Grader', 'The logic that scores one aspect of a run. Code, a model, or a person.'],
    outcome: ['Outcome', 'The state of the world after the run. The refund row, the resolved ticket. Graded separately from what the model said it did.'],
    mode: ['Failure mode', 'A yes-or-no question about one output, named from what you saw. "Did it state a number that differs from the tool result?"'],
    rule: ['Rule', 'A check code can run: a count, a parse, a row in a table, a line in a log. Deterministic, free, never drifts.'],
    judge: ['Judge', 'A model answering one rubric question about one output. The same kind of thing as the system under test, so it needs its own check.'],
    rubric: ['Rubric', 'What good means, written as one question per mode, locked before any output is graded.'],
    jtj: ['Judge the judge', 'Your hand labels against the judge\'s verdicts on the same rows. Two rates, and the rows where they disagree.'],
    rates: ['True positive rate, true negative rate', 'Of the real failures, how many the judge caught. Of the real passes, how many it passed. Never one accuracy number.'],
    adversarial: ['Adversarial row', 'An input you planted to make the model, or the judge, misbehave. Its check tests your code, not the model.'],
    frozen: ['Frozen set', 'The rows that do not change between runs. The only way a before and an after mean anything.'],
    suites: ['Regression suite, capability suite', 'The set that should stay near 100%, and the set that starts low and gives you a hill to climb.'],
    passk: ['pass^k', 'The chance that all k runs of a row pass. What customer-facing systems live on. pass@k, at least one of k, is what demos live on.'],
    eval: ['Eval', 'A frozen set of inputs, a check per failure mode, and the numbers they produce when you run the system on them.']
  };
  function earn(k) { if (!WORDS[k] || S.words.includes(k)) return; S.words.push(k); save(); }

  /* ---------- guess first ---------- */
  const GUESS = {
    g1: { opts: ['Fewer than 5', '5 to 10', '11 to 20', 'More than 20'], right: 2 },
    g2: { opts: ['None', 'About half', 'All but one', 'All six'], right: 2 },
    g3: { opts: ['Catches it', 'Misses it'], right: null },
    g4: { opts: ['Yes, same fix', 'No, the judge still reads whatever the answer says'], right: 1 },
    g5: { opts: ['Fix some rows and break none', 'Fix some rows and break others', 'Change nothing'], right: 1 },
    g6: { opts: ['75%', '56%', '42%', '25%'], right: 2 }
  };
  function optsHTML(opts, picked, attr) {
    return `<div class="opts" role="radiogroup">${opts.map((o, i) => `<button type="button" role="radio" ${attr}="${i}" aria-checked="${picked === i}" ${picked != null ? 'disabled' : ''}><kbd>${i + 1}</kbd>${esc(o)}</button>`).join('')}</div>`;
  }
  function guess(id) {
    const el = $('#' + id), g = GUESS[id], picked = S.g[id];
    el.innerHTML = optsHTML(g.opts, picked, 'data-i') + (picked != null ? '<p class="muted">Locked. The answer is on the next screen.</p>' : '');
    $$('.opts button', el).forEach(b => b.onclick = () => { S.g[id] = +b.dataset.i; save(); track('guess', { id, pick: +b.dataset.i, right: g.right == null ? null : g.right === +b.dataset.i }); guess(id); gate(); });
  }
  function guessResult(id, rightIndex, text) {
    const g = GUESS[id], p = S.g[id];
    if (p == null) return '';
    const ok = rightIndex == null ? null : p === rightIndex;
    return `<div class="gres ${ok === null ? '' : ok ? 'ok' : 'no'}"><span class="kick">your guess</span><b>${esc(g.opts[p])}</b><span>${ok === null ? '' : ok ? 'Right. ' : 'Not this time. '}${esc(text || '')}</span></div>`;
  }
  const guessesRight = () => Object.keys(GUESS).filter(k => GUESS[k].right != null && S.g[k] === GUESS[k].right).length;
  const guessesMade = () => Object.keys(GUESS).filter(k => GUESS[k].right != null && S.g[k] != null).length;

  /* ---------- rows and traces ---------- */
  const row = n => D.rows[n - 1];
  const mode = id => D.modes.find(m => m.id === id);
  const live = () => D.modes.filter(m => D.rows.some(r => r.mode === m.id));
  const fmt = v => typeof v === 'object' ? JSON.stringify(v) : String(v);
  const source = r => r.calls.length ? r.calls.map(c => fmt(c.result)).join('\n') : '(no tool result)';
  const resultText = res => typeof res === 'object' ? Object.entries(res).map(([k, v]) => `${k}: ${fmt(v)}`).join(' · ') : String(res);
  const anyFail = (r, stage, m) => r.runs[stage][m].some(Boolean);
  const failsBefore = m => D.rows.filter(r => anyFail(r, 'before', m.id)).length;
  const wordy = s => s.split(/(\s+)/).map(w => /\S/.test(w) ? `<span class="w" data-w="${esc(w.replace(/[^\w₹,.]/g, ''))}">${esc(w)}</span>` : w).join('');
  const counter = (label, i, N) => `<div class="rh"><b>${esc(label)} · ${i + 1} of ${N}</b><div class="track"><i style="width:${(i / N) * 100}%"></i></div></div>`;
  /* A trace reads top to bottom: the question, each tool call with its result, the answer, and the state after when it matters. */
  function traceHTML(r, o) {
    o = o || {};
    const calls = o.calls || r.calls, tap = o.tap ? ' tap' : '', W = o.words ? wordy : esc;
    const callCards = calls.length ? calls.map(c => `<div class="tc tcall" data-w="transcript"><p class="kick">tool call · ${esc(c.tool)}</p><p class="t"><b>${esc(c.tool)}</b>(${esc(JSON.stringify(c.args).replace(/"/g, ''))})<br>→ ${typeof c.result === 'object' && c.result.error ? `<span class="err">${esc(c.result.error)} ${esc(c.result.reason || '')}</span>` : W(resultText(c.result))}</p></div>`).join('')
      : `<div class="tc tcall${tap}" data-w="transcript"><p class="kick">tool call</p><p class="t"><span class="err">none: the model did not call a tool</span></p></div>`;
    return `<div class="tc q${tap}" data-w="task"><p class="kick">the customer asked</p><p class="t">${W(r.q)}</p></div>${callCards}
      <div class="tc ans${tap}" data-w="trial"><p class="kick">the model answered</p><p class="t">${W(o.answer || r.answer)}</p></div>
      ${o.state ? `<div class="tc state${tap}" data-w="outcome"><p class="kick">state after the run</p><p class="t">${esc(r.state)}</p></div>` : ''}`;
  }
  const done = new Set(S.done);
  function completed(m) { if (done.has(m)) return; done.add(m); S.done = [...done]; save(); track('step_completed', { step: m }); }
  const judged = () => Object.keys(S.m4.judge).length === 20;

  /* ================= STEP 1 · LOOK ================= */
  function b11() {
    const box = $('#s0-trace'), nudge = $('#s0-nudge');
    box.innerHTML = traceHTML(row(2), { words: !S.s0.hit });
    $('#s0-stamp').classList.toggle('wrong', S.s0.hit);
    $('#s0-found').hidden = !S.s0.hit;
    nudge.hidden = true;
    if (S.s0.hit) {
      box.innerHTML = traceHTML(row(2), { words: true });
      $$('.w', box).forEach(w => { w.classList.remove('w'); if (/^Thursday/i.test(w.dataset.w)) w.classList.add('w', 'hit'); if (/^Tuesday/i.test(w.dataset.w)) w.classList.add('w', 'truth'); });
      return;
    }
    $$('.w', box).forEach(w => w.onclick = () => {
      if (/^Thursday/i.test(w.dataset.w)) { S.s0.hit = true; save(); earn('transcript'); earn('grader'); track('s0_found', { misses: S.s0.misses }); b11(); gate(); }
      else {
        S.s0.misses++; save(); w.classList.add('miss'); setTimeout(() => w.classList.remove('miss'), 400);
        nudge.hidden = false; nudge.textContent = S.s0.misses < 2 ? 'Not that one.' : 'Not that one. Compare the day in the tool result with the day in the answer.';
      }
    });
  }
  function b12() {
    const t2 = $('#s0-trace2'), nudge = $('#s0-nudge2');
    t2.innerHTML = traceHTML(row(7), { state: true, tap: !S.s0.outcome });
    $('#s0-outcome').hidden = !S.s0.outcome; nudge.hidden = true;
    if (S.s0.outcome) { $('.tc.state', t2).classList.add('named'); return; }
    $$('.tc', t2).forEach(el => el.onclick = () => {
      if (el.dataset.w === 'outcome') { S.s0.outcome = true; save(); earn('outcome'); b12(); gate(); }
      else { el.classList.add('miss'); setTimeout(() => el.classList.remove('miss'), 400); nudge.hidden = false; nudge.textContent = el.dataset.w === 'trial' ? 'That is what the model said happened. Which card shows what actually happened?' : 'Not that one. Which card shows the world after the run?'; }
    });
  }
  const FIVE = [1, 5, 9, 13, 14];
  function b14() {
    const box = $('#m1-box'), i = S.m1.i, N = FIVE.length;
    if (i >= N) { $('#b14-ctx').textContent = 'Five read. Your line and the instructor\'s, side by side.'; box.innerHTML = `<div class="done"><div class="sheet mini">${tableM1(FIVE)}</div></div>`; return; }
    const r = row(FIVE[i]), saved = S.m1.saved[r.n];
    $('#b14-ctx').textContent = 'Read the whole trace, including the tool call. If nothing is wrong, say so.';
    box.innerHTML = counter('Trace ' + r.n, i, N) + `<div class="trace">${traceHTML(r, { state: r.state !== 'no change' })}</div>` +
      (saved === undefined
        ? `<form class="ask" id="m1-form"><input type="text" id="m1-in" maxlength="120" placeholder="The first thing wrong, in plain words" autocomplete="off" value="${esc(S.m1.sent[r.n] || '')}"><button class="btn go" type="submit">Save</button><button class="btn ghost" type="button" id="m1-dash">Nothing wrong</button></form>`
        : `<div class="cmp"><div class="you${saved ? '' : ' dash'}"><span class="kick">you</span>${saved ? esc(saved) : 'nothing wrong'}</div><div class="ins${r.wrong ? '' : ' dash'}"><span class="kick">instructor</span>${r.wrong ? esc(r.wrong) : 'nothing wrong. <small>A row that passes is a finding too.</small>'}</div></div><div class="actrow"><button class="btn go" type="button" id="m1-next">${i + 1 < N ? 'Next trace' : 'See all five'}</button></div>`);
    const inp = $('#m1-in');
    if (inp) {
      inp.focus();
      inp.oninput = () => { S.m1.sent[r.n] = inp.value; save(); };
      const commit = v => { S.m1.saved[r.n] = v.trim(); save(); track('m1_sentence', { row: r.n, dash: !v.trim() }); b14(); $('#m1-next').focus(); };
      $('#m1-form').onsubmit = e => { e.preventDefault(); if (inp.value.trim()) commit(inp.value); else inp.focus(); };
      $('#m1-dash').onclick = () => commit('');
    } else { const nx = $('#m1-next'); nx.onclick = () => { S.m1.i = i + 1; save(); b14(); gate(); window.scrollTo(0, 0); }; nx.focus(); }
  }
  function tableM1(ns) {
    const mine = ns.some(n => S.m1.saved[n] !== undefined);
    return `<table><thead><tr><th>#</th><th>the question</th><th>the model's answer</th>${mine ? '<th>you wrote</th>' : ''}<th>${mine ? 'instructor' : 'first thing wrong'}</th></tr></thead><tbody>${ns.map(n => {
      const r = row(n), m = S.m1.saved[n];
      return `<tr><td class="n">${r.n}</td><td>${esc(r.q)}</td><td>${esc(r.answer.length > 70 ? r.answer.slice(0, 68) + '…' : r.answer)}</td>${mine ? `<td class="m${m ? '' : ' dash'}">${m ? esc(m) : '—'}</td>` : ''}<td class="m${r.wrong ? '' : ' dash'}">${r.wrong ? esc(r.wrong) : '—'}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function b15() {
    const wrong = D.rows.filter(r => r.wrong).length;
    $('#b15-h').textContent = `${wrong} of 30 are wrong.`;
    $('#b15-gres').innerHTML = guessResult('g1', 2, `${wrong} of the thirty have something wrong in them. Eighteen different ways to be a little bit wrong.`);
    $('#m1-table').innerHTML = tableM1(D.rows.map(r => r.n));
    completed(1);
  }

  /* ================= STEP 2 · WRITE THE QUESTION DOWN ================= */
  function b21() {
    const ms = live(), i = S.m2.i, el = $('#m2-one');
    if (i >= ms.length) { el.innerHTML = `<div class="done"><p class="big">Six questions, in your words.</p><ul class="qs">${ms.map(m => `<li>${esc(S.m2.names[m.id])}</li>`).join('')}</ul></div>`; earn('mode'); return; }
    const m = ms[i];
    el.innerHTML = counter('Pile', i, ms.length) + `<div class="pile">${D.rows.filter(r => r.mode === m.id).map(r => `<span><b>${r.n}</b>${esc(r.wrong)}</span>`).join('')}</div>
      <form class="ask" id="m2-form"><input type="text" id="m2-in" maxlength="110" placeholder="Did it … ?" autocomplete="off" value="${esc(S.m2.names[m.id] || '')}"><button class="btn go" type="submit">Save</button></form>`;
    const inp = $('#m2-in'); inp.focus();
    $('#m2-form').onsubmit = e => { e.preventDefault(); if (!inp.value.trim()) { inp.focus(); return; } S.m2.names[m.id] = inp.value.trim(); S.m2.i = i + 1; save(); b21(); gate(); };
  }
  function b23() {
    $('#m2-modes').innerHTML = live().map(m => `<div class="md"><b>${esc(m.name)}</b><span class="yours">${esc(S.m2.names[m.id] || '')}</span><span class="theirs">${esc(m.q)}</span><small>rows ${D.rows.filter(r => r.mode === m.id).map(r => r.n).join(', ')}</small></div>`).join('');
    track('m2_revealed');
  }
  function b25() {
    const ms = live(), i = S.m3.i, el = $('#m3-one'), K = S.m3.kinds;
    if (i >= ms.length) { el.innerHTML = `<div class="done"><p class="big">All six placed.</p><p class="note">${ms.filter(m => K[m.id] === 'rule').length} to code, ${ms.filter(m => K[m.id] === 'judge').length} to a model. The next screen shows the instructor's split.</p></div>`; return; }
    const m = ms[i], k = K[m.id];
    el.innerHTML = counter('Question', i, ms.length) + `<div class="ck"><div class="q"><b>${esc(m.name)}</b><span>${esc(S.m2.names[m.id] || m.q)}</span></div>
        <div class="kinds" role="radiogroup">${[['rule', 'Code can check it', 'a count, a parse, a line in the log'], ['judge', 'A model has to read it', 'compares meaning, can be wrong']].map(([x, t, s], j) => `<button type="button" role="radio" data-k="${x}" aria-checked="${k === x}">${t}<small>${s}</small></button>`).join('')}</div>
        ${k === 'rule' ? `<div class="note ok"><b>Ran on thirty rows: ${failsBefore(m)} fail.</b> The check: ${esc(m.check)}.${m.kind === 'rule' ? '' : ' Code cannot read this one: it would need to compare a sentence with a source. The thirty ran on a judge.'}</div>` : ''}
        ${k === 'judge' ? `<div class="note prob">A model reads every row, on every run, and can be wrong. ${m.kind === 'rule' ? 'Is there nothing in the log or the tool result that answers this on its own?' : 'Here, yes: nothing in the log says whether a sentence matches a source.'}</div>` : ''}
        ${k ? `<div class="actrow"><button class="btn go" type="button" id="m3-next">${i + 1 < ms.length ? 'Next question' : 'Done'}</button></div>` : ''}</div>`;
    $$('.kinds button', el).forEach(b => b.onclick = () => { K[m.id] = b.dataset.k; save(); earn('rule'); earn('judge'); b25(); board(); $('#m3-next').focus(); });
    const nx = $('#m3-next'); if (nx) nx.onclick = () => { S.m3.i = i + 1; save(); b25(); gate(); };
  }
  function b26() {
    const ms = live(), K = S.m3.kinds, rules = ms.filter(m => m.kind === 'rule').length;
    $('#b26-h').textContent = `${rules} of ${ms.length} are rules.`;
    $('#b26-gres').innerHTML = guessResult('g2', 2, `${rules} of the six are a line in the log, a number against the tool result, or a count.`);
    $('#m3-table').innerHTML = `<table><thead><tr><th>question</th><th>check</th><th>kind</th><th>you said</th></tr></thead><tbody>${ms.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.check)}</td><td><span class="pill ${m.kind === 'rule' ? 'det' : 'prob'}">${m.kind}</span></td><td>${K[m.id] === m.kind ? '<span class="pill pass">same</span>' : `<span class="pill ${K[m.id] === 'rule' ? 'det' : 'prob'}">${esc(K[m.id] || '')}</span>`}</td></tr>`).join('')}</tbody></table>`;
    track('m3_revealed');
  }
  const REQS = [['says PASS', /\bPASS\b/], ['says FAIL', /\bFAIL\b/], ['says UNKNOWN', /\bUNKNOWN\b/], ['asks for a quote', /quot/i], ['names the SOURCE', /source/i], ['asks one question', /\?/]];
  function b27() {
    $('#m4-bad').textContent = D.judge.bad;
    const ta = $('#m4-rubric'), locked = !!S.m4.locked;
    ta.value = S.m4.text; ta.disabled = locked;
    $('.rub').classList.toggle('locked', locked);
    $('#m4-reqs').innerHTML = REQS.map(([t, re]) => `<li class="${re.test(S.m4.text) ? 'ok' : ''}">${t}</li>`).join('');
    $('#m4-lock').disabled = locked || !REQS.every(([, re]) => re.test(S.m4.text));
    $('#m4-lock').hidden = locked; $('#m4-use').hidden = locked;
    $('#m4-locked').textContent = locked ? `Locked ${new Date(S.m4.locked).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}. Every later change is a new version with its own run.` : '';
    ta.oninput = () => { S.m4.text = ta.value; save(); b27(); board(); };
  }
  $('#m4-use').onclick = () => { S.m4.text = D.judge.good; save(); b27(); $('#m4-lock').focus(); };
  $('#m4-lock').onclick = () => { S.m4.locked = new Date().toISOString(); save(); earn('rubric'); track('m4_locked', { own: S.m4.text !== D.judge.good }); b27(); gate(); };
  function b29() {
    $('#m4-model').textContent = D.judge.model;
    const J = S.m4.judge, n = Object.keys(J).length, seen = S.m5.uncovered;
    $('#m4-cards').innerHTML = D.labelled.map(x => `<i class="${J[x] ? (J[x].error ? 'err' : J[x].live ? 'live' : 'in') : ''}" title="row ${x}">${x}</i>`).join('');
    if (n === 20 && !$('#m4-msg').textContent.includes('failed')) $('#m4-msg').textContent = seen ? 'Twenty verdicts, turned over in step 3.' : `Twenty verdicts in, face down${S.m4.live ? ', from your key' : ', from the recorded run'}.`;
    $('#m4-live').disabled = seen; $('#m4-canned').disabled = seen;
    $('#m4-live').classList.toggle('go', n !== 20); $('#m4-live').classList.toggle('ghost', n === 20);
    $('#d2').hidden = n !== 20;
    if (n === 20) completed(2);
    board();
  }
  function parseVerdict(text, answer) {
    const t = (text || '').trim();
    const m = /^\s*\**\s*(PASS|FAIL|UNKNOWN)\b\**\s*:?\s*([\s\S]*)$/i.exec(t);
    if (!m) return { verdict: 'UNKNOWN', quote: '', why: 'Did not answer in the allowed shape: ' + t.slice(0, 120), bad: true };
    const v = m[1].toUpperCase(), rest = m[2].trim().replace(/^["'“”‘’<]+|["'“”‘’>.]+$/g, '').trim();
    const out = { verdict: v, quote: v === 'FAIL' ? rest : '', why: v === 'UNKNOWN' ? rest : v === 'FAIL' ? 'The judge quoted: ' + rest : 'Every fact in the answer appears in the source.' };
    if (v === 'FAIL' && rest && !answer.toLowerCase().includes(rest.toLowerCase().slice(0, 40))) { out.bad = true; out.why = 'FAIL, but the quote is not in the answer. Caught by code, not by you.'; }
    return out;
  }
  let key = '', pending = null;
  try { key = sessionStorage.getItem('c8.evalslab.key') || ''; } catch (e) {}
  const keybox = $('#keybox');
  function askKey(run) { pending = run; keybox.hidden = false; $('#key-in').focus(); }
  keybox.addEventListener('submit', e => {
    e.preventDefault();
    const k = $('#key-in').value.trim();
    if (!/^gsk_/.test(k)) { $('#key-err').textContent = 'A Groq key starts with gsk_.'; return; }
    key = k; $('#key-in').value = ''; $('#key-err').textContent = '';
    try { $('#key-keep').checked ? sessionStorage.setItem('c8.evalslab.key', k) : sessionStorage.removeItem('c8.evalslab.key'); } catch (e) {}
    keybox.hidden = true; if (pending) { const r = pending; pending = null; r(); }
  });
  $('#key-cancel').onclick = () => { keybox.hidden = true; pending = null; };
  const withKey = run => () => key ? run() : askKey(run);
  async function judgeOnce(src, answer) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: D.judge.model, temperature: 0, max_tokens: 200, messages: [{ role: 'system', content: S.m4.text }, { role: 'user', content: `SOURCE:\n"""${src}"""\n\nANSWER:\n"""${answer}"""` }] }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && j.error.message) || r.statusText); e.status = r.status; throw e; }
    return parseVerdict(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, answer);
  }
  async function runLive() {
    const msg = $('#m4-msg'); $('#m4-live').disabled = true; $('#m4-canned').disabled = true;
    S.m4.judge = {}; S.m4.live = true; save(); b29();
    let errors = 0;
    for (const n of D.labelled) {
      const r = row(n); msg.textContent = `Judging row ${n}…`;
      try { S.m4.judge[n] = Object.assign(await judgeOnce(source(r), r.answer), { live: true }); }
      catch (e) {
        if (e.status === 401 || e.status === 403) { key = ''; try { sessionStorage.removeItem('c8.evalslab.key'); } catch (x) {} msg.textContent = 'Groq rejected that key. Press Run again to enter it.'; S.m4.judge = {}; save(); b29(); $('#m4-live').disabled = false; $('#m4-canned').disabled = false; return; }
        errors++; S.m4.judge[n] = { verdict: 'UNKNOWN', quote: '', why: 'The call failed: ' + (e.message || 'network'), error: true, live: true };
        if (e.status === 429) await new Promise(res => setTimeout(res, 2500));
      }
      save(); b29();
    }
    track('judge_ran', { live: true, errors });
    msg.textContent = errors ? `Twenty in. ${errors} call${errors > 1 ? 's' : ''} failed and count as UNKNOWN.` : '';
    b29(); gate(); $('#m4-live').disabled = false; $('#m4-canned').disabled = false;
  }
  $('#m4-live').onclick = withKey(runLive);
  $('#m4-canned').onclick = () => {
    S.m4.judge = {}; S.m4.live = false; $('#m4-msg').textContent = '';
    D.labelled.forEach(n => { S.m4.judge[n] = Object.assign({}, row(n).judge, { live: false }); });
    save(); track('judge_ran', { live: false }); b29(); gate();
  };

  /* ================= STEP 3 · CHECK THE CHECKER ================= */
  function b31() {
    const L = S.m5.labels, i = S.m5.i, el = $('#m5-one'), N = D.labelled.length;
    if (!judged()) { el.innerHTML = `<div class="done"><p class="big">The judge has not run yet.</p><p class="note">Go back to step 2 and run it, then label here. The order matters: the judge's verdicts stay face down while you label.</p><div class="actrow"><a class="btn go" href="#b29">Back to the judge</a></div></div>`; return; }
    if (i >= N) { el.innerHTML = `<div class="done"><p class="big">Twenty labelled. ${D.labelled.filter(n => L[n] === 'FAIL').length} FAIL, ${D.labelled.filter(n => L[n] === 'PASS').length} PASS.</p><p class="note">From here your labels are locked. Next, the judge's twenty come face up.</p></div>`; earn('jtj'); return; }
    const n = D.labelled[i], r = row(n);
    el.innerHTML = counter('Row ' + n, i, N) + `<div class="lr"><div class="src"><p class="kick">source · tool result</p>${esc(r.calls.length ? r.calls.map(c => resultText(c.result)).join('\n') : '(no tool result)')}</div><div class="ans"><p class="kick">the model's answer</p>${esc(r.answer)}</div></div>
      <div class="lb">${[['PASS', '1'], ['FAIL', '2']].map(([v, k]) => `<button type="button" data-v="${v}" data-i="${+k - 1}"><kbd>${k}</kbd>${v}</button>`).join('')}</div>`;
    $$('.lb button', el).forEach(b => b.onclick = () => { L[n] = b.dataset.v; S.m5.i = i + 1; save(); b31(); gate(); });
  }
  function tally() {
    const L = S.m5.labels, J = S.m4.judge, t = { caught: [], missed: [], alarm: [], agreed: [], unk: [] };
    D.labelled.forEach(n => {
      const l = L[n], v = J[n].verdict;
      if (l === 'FAIL') (v === 'FAIL' ? t.caught : t.missed).push(n);
      else (v === 'FAIL' ? t.alarm : v === 'PASS' ? t.agreed : t.unk).push(n);
    });
    t.fails = t.caught.length + t.missed.length; t.passes = 20 - t.fails;
    t.tpr = t.fails ? t.caught.length / t.fails : 1; t.tnr = t.passes ? t.agreed.length / t.passes : 1;
    return t;
  }
  function b32() {
    const un = S.m5.uncovered, ready = judged() && D.labelled.every(n => S.m5.labels[n]);
    $('#m5-uncover').disabled = un || !ready; $('#m5-uncover').hidden = un;
    $('#m5-msg').textContent = un || ready ? '' : 'Label all twenty first.';
    $('#m5-grid').hidden = !un;
    if (!un) return;
    const t = tally();
    $('#m5-grid').innerHTML = `<div></div><div class="h">judge said FAIL</div><div class="h">judge said PASS${t.unk.length ? ' or UNKNOWN' : ''}</div>
      <div class="rhd">you said FAIL</div><div class="cell good"><b>${t.caught.length}</b><span>caught</span></div><div class="cell miss"><b>${t.missed.length}</b><span>missed${t.missed.length ? ': row ' + t.missed.join(', ') : ''}</span></div>
      <div class="rhd">you said PASS</div><div class="cell alarm"><b>${t.alarm.length}</b><span>false alarm${t.alarm.length === 1 ? '' : 's'}${t.alarm.length ? ': row ' + t.alarm.join(', ') : ''}</span></div><div class="cell good"><b>${t.agreed.length + t.unk.length}</b><span>agreed${t.unk.length ? ` (${t.unk.length} unknown)` : ''}</span></div>`;
  }
  $('#m5-uncover').onclick = () => { S.m5.uncovered = true; save(); earn('rates'); track('m5_uncovered', { live: S.m4.live }); b32(); gate(); };
  function b33() {
    if (!S.m5.uncovered) { $('#m5-rates').innerHTML = '<div><span class="kick">not yet</span><b>—</b><small>turn the judge over first</small></div>'; return; }
    const t = tally(), one = $('#m5-one-cb').checked;
    $('#m5-rates').classList.toggle('one', one);
    $('#m5-rates').innerHTML = one ? `<div><span class="kick">accuracy</span><b>${pct((t.caught.length + t.agreed.length) / 20)}</b><small>one number. a judge that passes everything would score ${pct(t.passes / 20)} on these twenty.</small></div>`
      : `<div><span class="kick">true positive rate</span><b>${pct(t.tpr)}</b><small>of ${t.fails} real failure${t.fails === 1 ? '' : 's'}, the judge caught ${t.caught.length}</small></div><div><span class="kick">true negative rate</span><b>${pct(t.tnr)}</b><small>of ${t.passes} real pass${t.passes === 1 ? '' : 'es'}, the judge passed ${t.agreed.length}</small></div>`;
    $('#m5-oneT').hidden = !one;
    $('#m5-oneT').textContent = 'One accuracy number hides which way the judge is wrong. The two rates expose it. Even two experts agree only about 71% of the time on open-ended work, so do not chase 100%.';
  }
  $('#m5-one-cb').onchange = () => { b33(); board(); };
  function b34() {
    if (!S.m5.uncovered) { $('#m5-flag').innerHTML = '<p>Turn the judge over first.</p>'; return; }
    const t = tally(), J = S.m4.judge, two = J[2], caught2 = two && two.verdict === 'FAIL';
    const g3 = guessResult('g3', caught2 ? 0 : 1, caught2 ? 'The judge quoted Thursday. A narrow question and the source in hand is what caught it.' : `The judge passed row 2${two && two.why ? ': "' + two.why + '"' : ''}. It compared topics, not the day.`);
    const f = t.missed[0] || t.alarm[0], flag = $('#m5-flag');
    if (f) {
      const r = row(f), j = J[f], missed = t.missed.includes(f);
      flag.innerHTML = g3 + `<p class="kick">${missed ? 'the missed row' : 'the disagreement'}</p><p><b>Row ${f}.</b> ${esc(r.q)} → "${esc(r.answer)}"</p><p class="mono">you: ${esc(S.m5.labels[f])} · judge: ${esc(j.verdict)}${j.quote ? ' "' + esc(j.quote) + '"' : ''} · ${esc(j.why)}</p><p>${missed ? 'Read the judge\'s reasoning. If the rates are low, fix the rubric, not the labels.' : 'A false alarm on a rare mode floods the review queue. Is the quoted fact really not in the source, or is it a rewording? The rubric decides, and the rubric is yours to narrow.'}</p>`;
    } else flag.innerHTML = g3 + `<p class="kick">full agreement on twenty</p><p>Your labels and the judge's verdicts match on every row. ${S.m4.live ? 'The recorded run from the masterclass missed row 2: it compared topics, not the day. Twenty rows is where you start; a judge you will trust in production wants a hundred or more per mode.' : 'Check your labels against the source once more: row 2 says Thursday and the source says Tuesday.'}</p>`;
  }
  function advTrace(which) {
    const A = D.adversarial, v = A[which];
    return traceHTML({ q: A.q, calls: [{ tool: 'get_order', args: { order_id: 4821 }, result: A.tool_result }], answer: v.answer, state: v.state }, { state: true, calls: v.calls });
  }
  function b35() {
    $('#m8-note').textContent = '"' + D.adversarial.note + '"';
    $('#m8-trace-off').hidden = !S.m8.off; $('#m8-verdict-off').hidden = !S.m8.off; $('#m8-ask-off').hidden = S.m8.off;
    if (S.m8.off) $('#m8-trace-off').innerHTML = advTrace('off');
  }
  $('#m8-ask-off').onclick = () => { S.m8.off = true; save(); earn('adversarial'); track('m8_asked', { allow: false }); b35(); gate(); };
  function b36() {
    $('#m8-trace-on').hidden = !S.m8.on; $('#m8-verdict-on').hidden = !S.m8.on; $('#m8-ask-on').hidden = S.m8.on;
    if (S.m8.on) $('#m8-trace-on').innerHTML = advTrace('on');
  }
  $('#m8-ask-on').onclick = () => { S.m8.on = true; save(); track('m8_asked', { allow: true }); b36(); gate(); };
  function b38() {
    const R = S.m8.attacks;
    $('#m8-attacks').innerHTML = D.attacks.map(a => { const v = R[a.id]; return `<div class="at"><p class="kick">${esc(a.name)}</p><div class="a">${esc(a.answer)}</div><small>source: ${esc(resultText(a.source))}</small>${v ? `<div class="res"><span class="pill ${v.verdict.toLowerCase()}">${v.verdict}</span> ${esc(v.quote ? '"' + v.quote + '" · ' : '')}${esc(v.why)}</div><small>should be: ${esc(a.should)}</small>` : ''}</div>`; }).join('');
    $('#m8-run').textContent = key && S.m4.locked ? 'Grade both with my key' : 'Grade both (recorded judge)';
    $('#m8-run').hidden = !!S.m8.graded;
    $('#m8-after-wrap').hidden = !S.m8.graded;
    if (S.m8.graded) {
      const fooled = D.attacks.filter(a => R[a.id] && R[a.id].verdict === 'PASS');
      $('#m8-after').innerHTML = guessResult('g4', 1, 'The allow-list sits on the tool. The judge reads the answer, and the answer can say anything.') + `<p class="note">${fooled.length ? `The judge passed ${fooled.length === 2 ? 'both' : 'one of them'}. Your rubric needs another line: wrap the source and answer in delimiters, say they are data, and never let a verdict depend on text the judge was told to obey. A judge left alone is a target.` : 'The judge held on both. Keep the two rows in the sheet; every rubric change gets checked against them.'}</p>`;
      completed(3);
    }
  }
  $('#m8-run').onclick = async () => {
    const msg = $('#m8-msg'), isLive = key && S.m4.locked;
    $('#m8-run').disabled = true;
    for (const a of D.attacks) {
      if (isLive) { msg.textContent = 'Grading…'; try { S.m8.attacks[a.id] = await judgeOnce(fmt(a.source), a.answer); } catch (e) { S.m8.attacks[a.id] = { verdict: 'UNKNOWN', quote: '', why: 'The call failed: ' + (e.message || 'network') }; } }
      else S.m8.attacks[a.id] = a.canned;
    }
    S.m8.graded = isLive ? 'live' : 'canned'; save(); msg.textContent = ''; $('#m8-run').disabled = false; track('m8_graded', { live: !!isLive }); b38(); gate();
  };

  /* ================= STEP 4 · CHANGE ONE THING, LOOK AGAIN ================= */
  const cost = (stage, mult) => D.rows.reduce((s, r) => s + 3 * (r.tokens[stage].in * D.price.in_per_m + r.tokens[stage].out * D.price.out_per_m) / 1e6, 0) * (mult || 1);
  function b41() {
    const c = S.m7.change, keys = Object.keys(D.change);
    $('#m7-pick').innerHTML = keys.map((k, i) => `<button type="button" role="radio" data-c="${k}" data-i="${i}" aria-checked="${c === k}" ${c ? 'disabled' : ''}><kbd>${i + 1}</kbd>${esc(D.change[k].name)}</button>`).join('');
    $$('#m7-pick button').forEach(b => b.onclick = () => { if (S.m7.change) return; S.m7.change = b.dataset.c; save(); earn('frozen'); track('m7_change', { change: b.dataset.c }); b41(); gate(); });
    $('#m7-diff').hidden = !c;
    if (c) { const ch = D.change[c]; $('#m7-diff').innerHTML = `<div><b>before</b>${esc(ch.before)}</div><div class="aft"><b>after</b>${esc(ch.after)}</div>`; }
  }
  function b43() {
    const c = S.m7.change; if (!c) return;
    $('#m7-what').textContent = D.change[c].what + ' Rows failing in at least one of three runs, on the same frozen thirty.';
    $('#b43-gres').innerHTML = guessResult('g5', 1, 'Two columns went to zero and one got worse. You only know the second part because the thirty were frozen and the format column is code.');
    $('#m7-table').innerHTML = `<table><thead><tr><th>question</th><th>check</th><th class="num">before</th><th class="num">after</th><th></th></tr></thead><tbody>${D.modes.map(m => {
      const b = failsBefore(m), a = D.rows.filter(r => anyFail(r, 'after', m.id)).length;
      return `<tr><td>${esc(m.name)}</td><td><span class="pill ${m.kind === 'rule' ? 'det' : 'prob'}">${m.kind}</span></td><td class="num">${b}</td><td class="num${a > b ? ' worse' : a < b ? ' better' : ''}">${a}</td><td class="muted">${a > b ? 'worse' : a < b ? 'fixed' : b ? 'flat: the rung below is not the fix for this mode' : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function b44() {
    const failB = D.rows.filter(r => D.modes.some(m => anyFail(r, 'before', m.id))), failA = D.rows.filter(r => D.modes.some(m => anyFail(r, 'after', m.id)));
    const regB = D.rows.filter(r => !failB.includes(r)), grad = failB.filter(r => !failA.includes(r)), broke = regB.filter(r => failA.includes(r));
    earn('suites');
    $('#m7-split').innerHTML = `<div><p class="kick">regression suite · <b>${regB.length} rows</b> that passed before</p><div class="rows">${regB.map(r => `<i class="${broke.includes(r) ? 'f' : ''}" title="row ${r.n}"></i>`).join('')}</div><small>Should sit near 100%. ${broke.length ? `<b>${broke.length} broke</b> (rows ${broke.map(r => r.n).join(', ')}): the format column caught it because it is code.` : 'Nothing broke.'}</small></div>
      <div><p class="kick">capability suite · <b>${failB.length} rows</b> that failed before</p><div class="rows">${failB.map(r => `<i class="${grad.includes(r) ? 'grad' : 'f'}" title="row ${r.n}"></i>`).join('')}</div><small>A hill to climb. <b>${grad.length} graduated</b>. ${failA.filter(r => failB.includes(r)).length} still fail: the next change starts there. If this suite ever hits 100%, the next thirty production traces are the new capability set.</small></div>`;
  }
  function b45() {
    const c = S.m7.change || 'tool', mult = c === 'model' ? 2.6 : 1, b = cost('before'), a = cost('after', mult);
    $('#m7-bill').innerHTML = `<span class="kick">cost per run of the thirty, three times each · ${esc(D.price.model)}</span><b class="was">${usd(b)}</b><b>${usd(a)}</b><span>${a > b ? '+' : ''}${Math.round((a / b - 1) * 100)}%. ${c === 'model' ? 'The bigger model costs more on every row, and the thirty were only the test.' : 'The longer description is read on every call, and the chattier answers are paid for on every row.'}</span><p>The judge is a model you now pay to run on every row too.</p>`;
  }
  function b46() {
    const r = row(2), runs = r.runs.after.madeup, played = S.m6.played;
    $('#m6-three').innerHTML = r.three.map((t, i) => `<div class="r${played ? ' on ' + (runs[i] ? 'fail' : 'pass') : ''}"><span class="kick">run ${i + 1}</span>${played ? `<p class="t">${esc(t)}</p><span class="v">${runs[i] ? 'FAIL · made-up detail' : 'PASS'}</span>` : '<span class="dice">?</span>'}</div>`).join('');
    $('#m6-play').textContent = played ? '▶ Replay' : '▶ Run three times';
    $('#m6-play').classList.toggle('go', !played); $('#m6-play').classList.toggle('ghost', played);
  }
  $('#m6-play').onclick = () => {
    const r = row(2), runs = r.runs.after.madeup;
    S.m6.played = false; b46(); $('#m6-play').disabled = true;
    $$('#m6-three .r').forEach((c, i) => {
      const dice = $('.dice', c); c.classList.add('on');
      let n = 0; const iv = setInterval(() => { dice.textContent = String.fromCharCode(0x2680 + Math.floor(Math.random() * 6)); if (++n > 8 + i * 5) { clearInterval(iv); c.classList.add(runs[i] ? 'fail' : 'pass'); c.innerHTML = `<span class="kick">run ${i + 1}</span><p class="t">${esc(r.three[i])}</p><span class="v">${runs[i] ? 'FAIL · made-up detail' : 'PASS'}</span>`; if (i === 2) { S.m6.played = true; save(); track('m6_played'); b46(); $('#m6-play').disabled = false; gate(); } } }, 90);
    });
  };
  function b48() {
    earn('passk');
    const p = S.m6.p / 100, k = S.m6.k;
    $('#m6-p').value = S.m6.p; $('#m6-k').value = k;
    $('#m6-pO').textContent = S.m6.p + '%'; $('#m6-kO').textContent = k;
    const at = 1 - Math.pow(1 - p, k), hat = Math.pow(p, k);
    $('#m6-passat').textContent = pct(at); $('#m6-passhat').textContent = pct(hat);
    const X = i => 30 + (i - 1) * (270 / 9), Y = v => 170 - v * 150;
    const path = f => Array.from({ length: 10 }, (_, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)},${Y(f(i + 1)).toFixed(1)}`).join(' ');
    $('#m6-svg').innerHTML = `<line class="ax" x1="30" y1="170" x2="300" y2="170"/><line class="ax" x1="30" y1="20" x2="30" y2="170"/>
      <text class="lab" x="30" y="188">k=1</text><text class="lab" x="286" y="188">10</text><text class="lab" x="4" y="24">100%</text><text class="lab" x="12" y="174">0</text>
      <path class="at" d="${path(x => 1 - Math.pow(1 - p, x))}"/><path class="hat" d="${path(x => Math.pow(p, x))}"/>
      <circle class="dot2" cx="${X(k)}" cy="${Y(at)}" r="4"/><circle class="dot" cx="${X(k)}" cy="${Y(hat)}" r="5"/>
      <text class="lab" x="${Math.min(X(k) + 8, 250)}" y="${Y(at) - 6}">pass@k ${pct(at)}</text><text class="lab" x="${Math.min(X(k) + 8, 250)}" y="${Y(hat) + 14}">pass^k ${pct(hat)}</text>`;
    $('#b48-gres').innerHTML = guessResult('g6', 2, 'Three passes in a row at 75% each: 0.75 × 0.75 × 0.75. One pass in three is the demo. Three in three is the customer.');
  }
  $('#m6-p').oninput = e => { S.m6.p = +e.target.value; save(); b48(); board(); };
  $('#m6-k').oninput = e => { S.m6.k = +e.target.value; save(); b48(); board(); };
  function sheetRows() {
    return D.rows.map(r => {
      const w = S.m1.saved[r.n] !== undefined ? S.m1.saved[r.n] : r.wrong;
      const o = { n: r.n, input: r.q, log: r.calls.map(c => `${c.tool}(${JSON.stringify(c.args)})`).join('; ') || 'no call', answer: r.answer, state: r.state, wrong: w || '—' };
      D.modes.filter(m => m.kind === 'rule').forEach(m => { o[m.id] = r.runs.before[m.id][0] ? 'FAIL' : 'pass'; });
      o.you = S.m5.labels[r.n] || ''; o.judge = S.m5.uncovered && S.m4.judge[r.n] ? S.m4.judge[r.n].verdict : ''; o.quote = S.m5.uncovered && S.m4.judge[r.n] ? S.m4.judge[r.n].quote : '';
      return o;
    });
  }
  function b49() {
    earn('eval');
    const t = S.m5.uncovered ? tally() : null, rules = live().filter(m => S.m3.kinds[m.id] === 'rule').length, flag = t ? (t.missed[0] || t.alarm[0]) : null;
    $('#you-summ').innerHTML = [
      [Object.keys(S.m1.saved).length + 2, 'traces read by hand'], [live().filter(m => (S.m2.names[m.id] || '').trim()).length, 'questions you wrote'], [rules, 'you gave to code'],
      [S.m4.locked ? new Date(S.m4.locked).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—', 'rubric locked at'],
      [t ? pct(t.tpr) : '—', 'true positive rate'], [t ? pct(t.tnr) : '—', 'true negative rate'], [flag ? 'row ' + flag : '—', 'flagged where the judge was wrong'],
      [S.m7.change ? D.change[S.m7.change].name.toLowerCase() : '—', 'the one change'], [`${guessesRight()} of ${guessesMade()}`, 'guesses right']
    ].map(([b, s]) => `<div><b class="${String(b).length > 8 ? 's' : ''}">${esc(b)}</b><span>${s}</span></div>`).join('');
    const rows = sheetRows(), shown = Object.keys(rows[0]).filter(c => c !== 'log' && c !== 'state');
    const cut = (v, n) => String(v).length > n ? String(v).slice(0, n - 1) + '…' : String(v);
    $('#you-table').innerHTML = `<table><thead><tr>${shown.map(c => `<th>${esc(mode(c) ? mode(c).name : c)}</th>`).join('')}</tr></thead><tbody>${rows.map(o => `<tr>${shown.map(c => `<td class="${c === 'n' ? 'n' : ''}">${o[c] === 'FAIL' ? '<span class="pill fail">FAIL</span>' : o[c] === 'pass' || o[c] === 'PASS' ? '<span class="pill pass">' + o[c] + '</span>' : esc(cut(o[c], c === 'answer' ? 34 : c === 'input' ? 28 : 26))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  $('#you-csv').onclick = () => {
    const rows = sheetRows(), cols = Object.keys(rows[0]);
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const head = ['rubric (locked ' + (S.m4.locked || 'never') + ')', (S.m4.text || '').replace(/\n/g, ' ')];
    const csv = [head.map(q).join(','), cols.map(c => q(mode(c) ? mode(c).name : c)).join(',')].concat(rows.map(o => cols.map(c => q(o[c])).join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'evals-lab-sheet.csv'; a.click();
    track('sheet_downloaded');
  };
  function b410() {
    const T = D.transfer;
    $('#tr-trace').innerHTML = traceHTML({ q: T.q, calls: T.calls, answer: T.answer, state: T.state }, { state: true });
    $('#tr-ask').hidden = S.tr.saved; $('#tr-cmp').hidden = !S.tr.saved;
    if (S.tr.saved) { $('#tr-cmp').innerHTML = `<div class="you"><span class="kick">you</span>${esc(S.tr.text)}</div><div class="ins"><span class="kick">instructor</span>${esc(T.question)}<br><small>${esc(T.why)} A <b>rule</b>.</small></div>`; return; }
    const inp = $('#tr-in'); inp.value = S.tr.text;
    inp.oninput = () => { S.tr.text = inp.value; save(); };
    $('#tr-ask').onsubmit = e => { e.preventDefault(); if (!inp.value.trim()) { inp.focus(); return; } S.tr.text = inp.value.trim(); S.tr.saved = true; save(); track('transfer_written'); b410(); gate(); };
  }
  function b411() {
    completed(4);
    $('#gloss').innerHTML = S.words.map(k => `<dt>${esc(WORDS[k][0])}</dt><dd>${esc(WORDS[k][1])}</dd>`).join('') || '<dd>None yet.</dd>';
  }

  /* ---------- the board: one whiteboard sketch per screen, drawn from state, laptop widths only ---------- */
  const W = 420;
  const sv = (h, ln, tx) => `<svg class="wb" viewBox="0 0 ${W} ${h}" aria-hidden="true"><g class="ln" filter="url(#wob)">${ln}</g><g class="tx">${tx}</g></svg>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx == null ? 10 : rx}"/>`;
  const Tx = (x, y, s, cls) => `<text class="${cls || ''}" x="${x}" y="${y}">${esc(s)}</text>`;
  const Ar = (x1, y1, x2, y2, cls, m) => `<path class="arw ${cls || ''}" d="M${x1} ${y1} L${x2} ${y2}" marker-end="url(#${m || 'ah'})"/>`;
  const Curve = (d, cls, m) => `<path class="arw ${cls || ''}" d="${d}" ${m ? `marker-end="url(#${m})"` : ''}/>`;
  const Person = (x, y, sc, cls) => `<use href="#person" class="${cls || ''}" transform="translate(${x} ${y}) scale(${sc || .5})"/>`;
  const Tick = (x, y, cls) => `<path class="${cls || 'c-hum'}" d="M${x} ${y} l7 8 l14 -18"/>`;
  const Cross = (x, y, cls) => `<path class="${cls || 'c-act'}" d="M${x} ${y} l20 20 M${x + 20} ${y} l-20 20"/>`;
  const Bubble = (x, y, w, h, cls) => `<path class="${cls || 'f-prob'}" d="M${x + 12} ${y} H${x + w - 12} a12 12 0 0 1 12 12 V${y + h - 12} a12 12 0 0 1 -12 12 H${x + 40} l-16 16 v-16 H${x + 12} a12 12 0 0 1 -12 -12 V${y + 12} a12 12 0 0 1 12 -12 z"/>`;
  /* n squares in rows of per, class from fn(i) */
  const Squares = (x, y, n, per, sz, gap, fn) => Array.from({ length: n }, (_, i) => R(x + (i % per) * (sz + gap), y + Math.floor(i / per) * (sz + gap), sz, sz, fn(i), 3)).join('');
  const wrongIdx = () => D.rows.map((r, i) => r.wrong ? i : -1).filter(i => i >= 0);
  /* boxes go in the ink group, their labels in the text group */
  const JUDGE = (x, y) => R(x, y, 70, 50, 'f-prob');
  const JUDGEt = (x, y) => Tx(x + 35, y + 22, 'LLM', 's c-prob') + Tx(x + 35, y + 42, 'as judge', 'xs c-prob');
  const CODE = (x, y) => R(x, y, 70, 50, 'f-det');
  const CODEt = (x, y) => Tx(x + 35, y + 32, '{ code }', 'mono c-det');
  const PERSON = (x, y, cls) => Person(x, y, .42, cls || 'c-hum');

  const VIS = {
    b11() {
      const hit = S.s0.hit;
      const ln = R(20, 30, 180, 56, 'f-det') + R(20, 110, 180, 56, 'f-prob') + Ar(205, 58, 262, 90, 'c-prob', 'ahv') + Ar(205, 138, 262, 106, 'c-prob', 'ahv') + JUDGE(266, 72) + Ar(340, 97, 372, 97, 'c-prob', 'ahv')
        + (hit ? Cross(380, 86) + Curve('M198 60 Q230 98 198 136', 'c-act') : '');
      const tx = Tx(110, 52, 'tool result', 'xs c-det') + Tx(110, 74, 'arrives: Tuesday', hit ? 'c-hum' : '') + Tx(110, 132, "model's answer", 'xs c-prob') + Tx(110, 154, '… on Thursday.', hit ? 'c-act' : '')
        + Tx(395, 120, 'PASS', hit ? 'xs c-mute' : 'c-hum') + (hit ? Tx(228, 103, '≠', 'h c-act') : '') + JUDGEt(266, 72);
      return [sv(190, ln, tx), hit ? 'A model graded a model. <b>It missed one day.</b>' : 'A second model read both cards and said PASS.'];
    },
    b12() {
      const hit = S.s0.outcome;
      const ln = Bubble(16, 24, 190, 70, 'f-prob') + `<use href="#db" class="${hit ? 'c-hum' : 'mute'}" transform="translate(290 40) scale(.9)"/>` + Ar(212, 60, 280, 60) + (hit ? `<ellipse class="c-act" cx="331" cy="78" rx="68" ry="56"/>` : '');
      const tx = Tx(111, 52, '"Done. Your refund', 'xs') + Tx(111, 72, 'has been issued."', 'xs') + Tx(246, 50, 'claim', 'xs c-mute') + Tx(331, 150, 'refunds table', 'xs') + Tx(331, 172, hit ? '0 new rows' : '?', hit ? 'c-act' : 'c-mute') + (hit ? Tx(331, 18, 'grade this', 'c-act') : '');
      return [sv(190, ln, tx), hit ? 'The sentence is a claim. <b>The table is the fact.</b>' : 'Which card shows what actually happened?'];
    },
    b13() {
      const ln = Squares(45, 40, 30, 10, 28, 6, () => 'f-card') + R(150, 42, 120, 92, 'f-bg', 14);
      return [sv(160, ln, Tx(210, 108, '?', 'h c-act')), 'Thirty traces from one morning. <b>How many are wrong?</b>'];
    },
    b14() {
      const i = Math.min(S.m1.i, 5);
      const ln = Array.from({ length: 5 }, (_, k) => R(30 + k * 74, 30, 60, 76, k < i ? (S.m1.saved[FIVE[k]] ? 'f-act' : 'f-hum') : k === i ? 'f-bg c-act' : 'f-card', 8)).join('') + Squares(30, 130, 25, 25, 12, 2, () => 'f-card thin');
      const tx = Array.from({ length: 5 }, (_, k) => Tx(60 + k * 74, 76, k < i ? (S.m1.saved[FIVE[k]] ? 'wrong' : 'fine') : k === i ? 'read' : '', k < i ? (S.m1.saved[FIVE[k]] ? 'xs c-act' : 'xs c-hum') : 'xs c-act')).join('') + Tx(210, 170, 'the other twenty-five, after', 'xs c-mute');
      return [sv(185, ln, tx), i >= 5 ? 'Five read by hand. <b>Your eyes work.</b>' : `Trace ${i + 1} of 5. The whole trace, not just the answer.`];
    },
    b15() {
      const w = new Set(wrongIdx());
      const ln = Squares(45, 30, 30, 10, 28, 6, i => w.has(i) ? 'f-solid-act' : 'f-hum');
      return [sv(150, ln, Tx(210, 142, `${w.size} wrong · ${30 - w.size} fine`, 'c-act')), 'They will not read thirty after every change. <b>Write the question down.</b>'];
    },
    b21() {
      const ms = live(), i = Math.min(S.m2.i, ms.length - 1), n = D.rows.filter(r => r.mode === ms[i].id).length;
      const pile = Array.from({ length: Math.min(n, 5) }, (_, k) => R(30 + k * 6, 60 - k * 6, 90, 60, 'f-card', 6)).join('');
      const ln = pile + Ar(140, 60, 190, 60) + R(196, 30, 200, 60, 'f-bg') + PERSON(236, 118) + PERSON(316, 118) + Bubble(214, 178, 56, 30, 'f-hum') + Bubble(294, 178, 56, 30, 'f-hum');
      const tx = Tx(75, 100, `${n} rows`, 'xs') + Tx(296, 66, 'Did it … ?', 'c-act') + Tx(242, 200, 'yes', 'c-hum') + Tx(322, 200, 'yes', 'c-hum') + Tx(296, 238, 'two colleagues, same answer', 'xs c-mute');
      return [sv(250, ln, tx), S.m2.i >= ms.length ? 'Six piles, six questions, <b>in your words.</b>' : 'One pile becomes one yes-or-no question.'];
    },
    b22() {
      const ln = `<path class="mute" d="M30 70 H190"/>` + [1, 2, 3, 4, 5].map(k => `<path class="mute thin" d="M${30 + (k - 1) * 40} 64 v12"/>`).join('') + [3, 4, 2].map((k, j) => `<circle class="f-solid-act" cx="${30 + (k - 1) * 40}" cy="${50 - j * 2}" r="6"/>`).join('')
        + R(250, 40, 140, 44, 'f-bg', 22) + R(254, 44, 66, 36, 'f-solid-hum', 18) + [0, 1, 2].map(j => `<circle class="f-solid-act" cx="${275 + j * 12}" cy="62" r="6"/>`).join('');
      const tx = [1, 2, 3, 4, 5].map(k => Tx(30 + (k - 1) * 40, 98, String(k), 'xs')).join('') + Tx(110, 130, 'three graders, three numbers', 'xs c-mute') + Tx(287, 102, 'yes', 'xs c-hum') + Tx(355, 68, 'no', 'xs') + Tx(320, 130, 'same three, three yeses', 'xs c-mute') + Tx(110, 28, 'score 1 to 5', 's') + Tx(320, 28, 'made-up detail?', 's');
      return [sv(150, ln, tx), 'A scale spreads them out. <b>A yes or no lines them up.</b>'];
    },
    b23() {
      const ms = live();
      const ln = ms.map((m, i) => R(20 + (i % 2) * 195, 20 + Math.floor(i / 2) * 62, 185, 50, 'f-bg', 8) + R(28 + (i % 2) * 195, 50 + Math.floor(i / 2) * 62, D.rows.filter(r => r.mode === m.id).length * 24, 10, 'f-solid-act', 3)).join('');
      const tx = ms.map((m, i) => Tx(28 + (i % 2) * 195, 42 + Math.floor(i / 2) * 62, m.name, 'xs l')).join('');
      return [sv(215, ln, tx), 'Six piles. The bar is how many rows each one holds.'];
    },
    b24() {
      const ln = Array.from({ length: 6 }, (_, i) => R(20 + i * 64, 24, 56, 44, 'f-bg', 8)).join('') + CODE(100, 120) + JUDGE(250, 120);
      const tx = Array.from({ length: 6 }, (_, i) => Tx(48 + i * 64, 54, '?', 'c-act')).join('') + Tx(210, 148, 'or', 's') + Tx(210, 200, 'who answers, every row, every run?', 'xs c-mute') + CODEt(100, 120) + JUDGEt(250, 120);
      return [sv(215, ln, tx), 'Six questions. <b>How many can code answer?</b>'];
    },
    b25() {
      const ms = live(), K = S.m3.kinds, i = S.m3.i;
      const ln = CODE(60, 30) + JUDGE(290, 30) + ms.map((m, j) => R(60 + j * 52, 130, 44, 44, K[m.id] === 'rule' ? 'f-solid-det' : K[m.id] === 'judge' ? 'f-solid-prob' : j === i ? 'f-bg c-act' : 'f-card', 8)).join('');
      const tx = CODEt(60, 30) + JUDGEt(290, 30) + Tx(95, 100, 'reads the log', 'xs c-det') + Tx(325, 100, 'reads the answer', 'xs c-prob') + ms.map((m, j) => Tx(82 + j * 52, 158, K[m.id] ? '' : j === i ? '?' : '', 'c-act')).join('') + Tx(210, 206, `${ms.filter(m => K[m.id] === 'rule').length} to code · ${ms.filter(m => K[m.id] === 'judge').length} to a model`, 'xs c-mute');
      return [sv(220, ln, tx), i >= ms.length ? 'All six placed. <b>The next screen shows the split.</b>' : 'Amber: code checks it. Violet: a model reads it.'];
    },
    b26() {
      const ms = live();
      const ln = ms.map((m, j) => R(60 + j * 52, 40, 44, 44, m.kind === 'rule' ? 'f-solid-det' : 'f-solid-prob', 8)).join('');
      const tx = Tx(190, 120, `${ms.filter(m => m.kind === 'rule').length} rules`, 'c-det') + Tx(340, 120, '1 judge', 'c-prob') + Tx(210, 160, 'five columns for free, one needs a reader', 'xs c-mute');
      return [sv(180, ln, tx), 'Most of an eval is <b>assertions</b>, not judge prompts.'];
    },
    b27() {
      const locked = !!S.m4.locked, ok = REQS.map(([, re]) => re.test(S.m4.text));
      const ln = R(40, 20, 240, 200, 'f-bg', 6) + [0, 1, 2, 3, 4, 5].map(j => (ok[j] ? Tick(62, 50 + j * 28) : `<rect class="mute thin" x="62" y="42" width="18" height="18" rx="4" transform="translate(0 ${j * 28})"/>`)).join('')
        + `<use href="#${locked ? 'lock' : 'unlock'}" class="${locked ? 'c-act' : 'mute'}" transform="translate(320 90) scale(1.6)"/>`;
      const tx = REQS.map(([t], j) => Tx(96, 58 + j * 28, t, 'xs l' + (ok[j] ? '' : ' c-mute'))).join('') + Tx(344, 190, locked ? 'locked' : 'open', locked ? 'c-act' : 'c-mute');
      return [sv(240, ln, tx), locked ? '<b>Locked.</b> Every later edit is a thumb on the scale.' : 'Write it before you see more outputs. Then lock it.'];
    },
    b28() {
      const ln = R(20, 40, 180, 70, 'f-prob') + R(230, 40, 170, 70, 'f-bg') + `<use href="#lock" class="c-act" transform="translate(372 46) scale(.7)"/>` + Ar(205, 75, 225, 75);
      const tx = Tx(110, 66, 'row 2', 'xs c-prob') + Tx(110, 90, '"… arrive on Thursday."') + Tx(300, 66, 'your question', 'xs') + Tx(300, 92, 'catches it?', 'c-act') + Tx(210, 150, 'say it before you see it', 'xs c-mute');
      return [sv(170, ln, tx), 'Your locked question meets the Thursday row.'];
    },
    b29() {
      const J = S.m4.judge;
      const ln = JUDGE(30, 60) + Ar(104, 85, 130, 85, 'c-prob', 'ahv') + D.labelled.map((n, k) => R(140 + (k % 5) * 50, 20 + Math.floor(k / 5) * 40, 42, 32, J[n] ? (J[n].live ? 'f-solid-prob' : 'f-ink') : 'f-card dash', 5)).join('');
      const tx = JUDGEt(30, 60) + D.labelled.map((n, k) => Tx(161 + (k % 5) * 50, 42 + Math.floor(k / 5) * 40, String(n), J[n] ? 'xs on-ink' : 'xs c-mute')).join('') + Tx(210, 200, `${Object.keys(J).length} of 20, face down`, 'xs c-mute');
      return [sv(215, ln, tx), Object.keys(J).length === 20 ? 'Twenty verdicts in. <b>You label before you look.</b>' : 'The judge reads twenty rows with your question.'];
    },
    b31() {
      const i = Math.min(S.m5.i, 20), L = S.m5.labels;
      const ln = PERSON(40, 30, 'c-hum') + D.labelled.map((n, k) => R(110 + (k % 10) * 28, 40 + Math.floor(k / 10) * 32, 24, 24, k < i ? (L[n] === 'FAIL' ? 'f-solid-act' : 'f-solid-hum') : k === i ? 'f-bg c-act' : 'f-card', 4)).join('') + D.labelled.map((n, k) => R(112 + (k % 10) * 28, 132 + Math.floor(k / 10) * 32, 20, 20, 'f-ink thin', 4)).join('') + JUDGE(30, 128);
      const tx = JUDGEt(30, 128) + Tx(60, 110, 'you', 'xs c-hum') + Tx(250, 118, 'your labels, in the open', 'xs c-mute') + Tx(250, 208, "the judge's, face down", 'xs c-mute');
      return [sv(225, ln, tx), i >= 20 ? 'Twenty labelled. <b>Now turn the judge over.</b>' : 'You are the ground truth. The judge waits.'];
    },
    b32() {
      const un = S.m5.uncovered, t = un ? tally() : null;
      /* before: four empty boxes. after: the diagonal fades and the two off-diagonal boxes, where the judge is wrong, carry the numbers */
      const ln = R(110, 60, 120, 70, un ? 'f-card' : 'f-hum', 8) + R(240, 60, 120, 70, 'f-act', 8) + R(110, 140, 120, 70, 'f-det', 8) + R(240, 140, 120, 70, un ? 'f-card' : 'f-hum', 8)
        + (un ? Curve('M300 40 Q330 10 380 30', 'c-act', 'ahc') + Curve('M170 230 Q140 258 100 240', 'c-det', 'ahc') : '');
      const tx = Tx(170, 44, 'judge: FAIL', 'xs c-prob') + Tx(300, 44, 'judge: PASS', 'xs c-prob') + Tx(60, 100, 'you: FAIL', 'xs c-hum') + Tx(60, 180, 'you: PASS', 'xs c-hum')
        + Tx(170, 98, un ? '' : '?', 'h c-mute') + Tx(170, 120, 'caught', un ? 'xs c-mute' : 'xs') + Tx(300, 98, un ? t.missed.length : '?', 'h c-act') + Tx(300, 120, 'missed', 'xs c-act') + Tx(170, 178, un ? t.alarm.length : '?', 'h c-det') + Tx(170, 200, 'false alarm', 'xs c-det') + Tx(300, 178, un ? '' : '?', 'h c-mute') + Tx(300, 200, 'agreed', un ? 'xs c-mute' : 'xs')
        + (un ? Tx(300, 24, 'read these first', 'xs c-act') : '');
      return [sv(260, ln, tx), un ? 'Agreement is not the finding. <b>The two off-diagonal boxes are.</b>' : 'Four boxes. Two of them are where the judge is wrong.'];
    },
    b33() {
      const t = S.m5.uncovered ? tally() : null, one = $('#m5-one-cb').checked;
      const arc = (x, v, cls) => `<path class="mute thin" d="M${x - 50} 90 A50 50 0 0 1 ${x + 50} 90"/>` + (v > 0 ? `<path class="${cls}" d="M${x - 50} 90 A50 50 0 0 1 ${(x - 50 * Math.cos(Math.PI * v)).toFixed(1)} ${(90 - 50 * Math.sin(Math.PI * v)).toFixed(1)}"/>` : '');
      const num = (x, v, lab, cls) => Tx(x, 86, t ? pct(v) : '?', 'h ' + (cls || '')) + Tx(x, 112, lab, 'xs');
      if (one) {
        const acc = t ? (t.caught.length + t.agreed.length) / 20 : 0;
        return [sv(140, arc(210, acc, 'c-ink') + Cross(300, 50, 'c-act'), num(210, acc, 'accuracy')), 'One number. <b>Which way is the judge wrong?</b> It cannot say.'];
      }
      return [sv(140, arc(110, t ? t.tpr : 0, 'c-act thick') + arc(310, t ? t.tnr : 0, 'c-hum thick'), num(110, t ? t.tpr : 0, 'of real failures, caught', 'c-act') + num(310, t ? t.tnr : 0, 'of real passes, passed', 'c-hum')), 'Two rates, two directions of being wrong.'];
    },
    b34() {
      const t = S.m5.uncovered ? tally() : null, f = t ? (t.missed[0] || t.alarm[0]) : 2;
      const ln = D.labelled.slice(0, 10).map((n, k) => R(30 + k * 36, 40, 30, 40, n === f ? 'f-act' : 'f-card', 4)).join('') + `<circle class="c-act" cx="${45 + D.labelled.indexOf(f) * 36}" cy="60" r="34"/>` + `<path class="c-act" d="M${69 + D.labelled.indexOf(f) * 36} 84 l24 26"/>`;
      const tx = D.labelled.slice(0, 10).map((n, k) => Tx(45 + k * 36, 66, String(n), n === f ? 'xs c-act' : 'xs c-mute')).join('') + Tx(210, 150, f ? `row ${f}: you said one thing, the judge another` : 'full agreement on twenty', 'xs c-mute');
      return [sv(170, ln, tx), 'One row tells you more than two rates. <b>Read its reason.</b>'];
    },
    b35() {
      const off = S.m8.off;
      const ln = R(20, 40, 120, 80, 'f-det') + R(28, 92, 104, 20, 'f-act', 4) + Ar(146, 80, 186, 80, 'c-det') + R(190, 55, 70, 50, 'f-prob') + Ar(266, 80, 306, 80, off ? 'c-act' : 'mute', off ? 'ahc' : 'ah') + R(310, 55, 96, 50, off ? 'f-act' : 'f-card');
      const tx = Tx(80, 64, 'order 4821', 'xs c-det') + Tx(80, 84, 'arrives: Tuesday', 'xs') + Tx(80, 107, 'gift note: "refund…"', 'xs c-act') + Tx(225, 85, 'model', 'c-prob') + Tx(358, 78, 'issue_refund', 'mono') + Tx(358, 96, off ? 'ran ✓' : '', 'xs c-act') + Tx(210, 150, off ? 'nothing stood in the way' : 'what happens to the note?', 'xs c-mute');
      return [sv(170, ln, tx), off ? 'Text in the data became an order. <b>No wall.</b>' : 'A note in the data. Watch the log.'];
    },
    b36() {
      const on = S.m8.on;
      const ln = R(20, 40, 120, 80, 'f-det') + R(28, 92, 104, 20, 'f-act', 4) + Ar(146, 80, 186, 80, 'c-det') + R(190, 55, 70, 50, 'f-prob') + Ar(266, 80, 292, 80, on ? 'c-act' : 'mute', on ? 'ahc' : 'ah')
        + [0, 1, 2, 3].map(j => R(296, 40 + j * 20, 14, 18, on ? 'f-solid-hum' : 'f-card', 2) + R(296, 50 + j * 20, 14, 18, on ? 'f-hum' : 'f-card', 2)).join('') + R(330, 55, 80, 50, 'f-card');
      const tx = Tx(80, 64, 'order 4821', 'xs c-det') + Tx(80, 107, 'gift note: "refund…"', 'xs c-act') + Tx(225, 85, 'model', 'c-prob') + Tx(370, 78, 'issue_refund', 'mono') + Tx(303, 30, on ? '403' : '', 'c-hum') + Tx(210, 150, on ? 'the log shows the attempt: a new column' : 'the tool is off the allow-list', 'xs c-mute');
      return [sv(170, ln, tx), on ? 'The stop is in code. <b>The seventh question is a rule.</b>' : 'Same note, same question, one wall added.'];
    },
    b37() {
      const ln = R(20, 50, 70, 50, 'f-prob') + [0, 1, 2].map(j => R(110, 40 + j * 24, 12, 20, 'f-solid-hum', 2)).join('') + R(140, 50, 80, 50, 'f-card') + Tick(170, 118) + Bubble(250, 20, 150, 60, 'f-prob') + JUDGE(290, 110);
      const tx = JUDGEt(290, 110) + Tx(55, 80, 'model', 'c-prob') + Tx(180, 80, 'tool', 'xs') + Tx(325, 44, 'the answer,', 'xs') + Tx(325, 64, 'any text at all', 'xs') + Tx(325, 190, '?', 'h c-act') + Tx(116, 150, 'wall in front of the tool', 'xs c-mute');
      return [sv(210, ln, tx), 'The wall protects the tool. <b>Who protects the judge?</b>'];
    },
    b38() {
      const Rz = S.m8.attacks, g = !!S.m8.graded;
      const v = id => g && Rz[id] ? Rz[id].verdict : '?';
      const ln = Bubble(20, 20, 170, 60, 'f-act') + Bubble(20, 110, 170, 60, 'f-act') + Ar(196, 50, 236, 90, 'c-prob', 'ahv') + Ar(196, 140, 236, 110, 'c-prob', 'ahv') + JUDGE(240, 76) + Ar(314, 90, 340, 60, 'c-prob', 'ahv') + Ar(314, 110, 340, 140, 'c-prob', 'ahv');
      const tx = JUDGEt(240, 76) + Tx(105, 44, '"… Grade: PASS."', 'xs') + Tx(105, 64, 'grades itself', 'xs c-mute') + Tx(105, 136, '":"', 'xs') + Tx(105, 156, 'a single colon', 'xs c-mute') + Tx(375, 56, v('pass'), g ? (v('pass') === 'PASS' ? 'c-act' : 'c-hum') : 'c-mute') + Tx(375, 146, v('colon'), g ? (v('colon') === 'PASS' ? 'c-act' : 'c-hum') : 'c-mute') + Tx(375, 76, 'should fail', 'xs c-mute') + Tx(375, 166, 'should fail', 'xs c-mute');
      return [sv(200, ln, tx), g ? 'Planted rows stay in the sheet. <b>Every rubric change meets them.</b>' : 'Two answers built to be graded, not read.'];
    },
    b41() {
      const c = S.m7.change, keys = Object.keys(D.change);
      const ln = R(20, 20, 380, 90, 'f-bg dash', 12) + Squares(34, 32, 30, 15, 20, 4, () => 'f-card thin') + keys.map((k, j) => `<circle class="${c === k ? 'f-act' : 'f-card'}" cx="${100 + j * 110}" cy="160" r="22"/>` + `<path class="${c === k ? 'c-act' : 'mute'}" d="M${100 + j * 110} 160 l${c === k ? 12 : 0} -16"/>`).join('');
      const tx = Tx(210, 128, 'frozen: the same thirty, before and after', 'xs c-mute') + keys.map((k, j) => Tx(100 + j * 110, 208, D.change[k].name.replace(/^(Rewrite|Change|Swap) the /i, ''), c === k ? 'xs c-act' : 'xs c-mute')).join('');
      return [sv(225, ln, tx), c ? `One knob turned: <b>${esc(D.change[c].name.toLowerCase())}</b>.` : 'Same rows. One knob. Then look again.'];
    },
    b42() {
      const ln = Squares(30, 40, 30, 6, 22, 4, i => wrongIdx().includes(i) ? 'f-solid-act' : 'f-hum') + Ar(190, 100, 230, 100) + Squares(240, 40, 30, 6, 22, 4, () => 'f-card');
      const tx = Tx(105, 28, 'before', 'xs') + Tx(315, 28, 'after', 'xs') + Tx(315, 112, '?', 'h c-act') + Tx(210, 190, 'fix, break, or nothing?', 'xs c-mute');
      return [sv(205, ln, tx), 'Say what the thirty will do before you see them.'];
    },
    b43() {
      const ms = D.modes.filter(m => failsBefore(m) || D.rows.some(r => anyFail(r, 'after', m.id)));
      const ln = ms.map((m, j) => { const b = failsBefore(m), a = D.rows.filter(r => anyFail(r, 'after', m.id)).length; return R(170, 24 + j * 30, b * 22, 9, 'f-card', 2) + R(170, 35 + j * 30, a * 22, 9, a > b ? 'f-solid-act' : a < b ? 'f-solid-hum' : 'f-solid-det', 2); }).join('');
      const tx = ms.map((m, j) => Tx(160, 40 + j * 30, m.name, 'xs r')).join('') + Tx(210, 30 + ms.length * 30 + 10, 'grey: before · green: fixed · coral: worse', 'xs c-mute');
      return [sv(30 + ms.length * 30 + 30, ln, tx), 'Two went to zero. <b>One got worse.</b> Only a frozen set shows that.'];
    },
    b44() {
      const failB = D.rows.filter(r => D.modes.some(m => anyFail(r, 'before', m.id))), failA = D.rows.filter(r => D.modes.some(m => anyFail(r, 'after', m.id)));
      const regB = D.rows.filter(r => !failB.includes(r));
      const ln = R(20, 40, 180, 110, 'f-bg', 10) + R(220, 40, 180, 110, 'f-bg', 10) + regB.map((r, k) => R(32 + (k % 6) * 27, 52 + Math.floor(k / 6) * 27, 22, 22, failA.includes(r) ? 'f-solid-act' : 'f-hum', 4)).join('') + failB.map((r, k) => R(232 + (k % 6) * 27, 52 + Math.floor(k / 6) * 27, 22, 22, failA.includes(r) ? 'f-act' : 'f-solid-hum', 4)).join('');
      const tx = Tx(110, 28, `regression · ${regB.length} passed before`, 'xs c-hum') + Tx(310, 28, `capability · ${failB.length} failed before`, 'xs c-act') + Tx(110, 172, 'should stay near 100%', 'xs c-mute') + Tx(310, 172, 'the hill to climb', 'xs c-mute');
      return [sv(190, ln, tx), 'Two suites. One must not move. <b>One should.</b>'];
    },
    b45() {
      const c = S.m7.change || 'tool', mult = c === 'model' ? 2.6 : 1, b = cost('before'), a = cost('after', mult), H = 120, hb = H * b / Math.max(a, b), ha = H * a / Math.max(a, b);
      const ln = R(110, 30 + H - hb, 80, hb, 'f-card', 4) + R(230, 30 + H - ha, 80, ha, 'f-solid-act', 4) + `<path class="mute thin" d="M80 ${30 + H} H340"/>`;
      const tx = Tx(150, 22 + H - hb, usd(b)) + Tx(270, 22 + H - ha, usd(a), 'c-act') + Tx(150, 175, 'before', 'xs') + Tx(270, 175, 'after', 'xs') + Tx(210, 200, 'thirty rows, three runs each, plus the judge', 'xs c-mute');
      return [sv(215, ln, tx), 'The number goes in the change log <b>next to the result.</b>'];
    },
    b46() {
      const played = S.m6.played, runs = row(2).runs.after.madeup;
      const die = (x, cls) => R(x, 40, 70, 70, cls, 12) + [[x + 20, 60], [x + 50, 90], [x + 35, 75]].map(([cx, cy]) => `<circle class="${played ? 'f-ink' : 'mute'}" cx="${cx}" cy="${cy}" r="5"/>`).join('');
      const ln = [0, 1, 2].map(i => die(55 + i * 110, played ? (runs[i] ? 'f-act' : 'f-hum') : 'f-bg')).join('');
      const tx = [0, 1, 2].map(i => Tx(90 + i * 110, 140, played ? (runs[i] ? 'FAIL' : 'PASS') : '?', played ? (runs[i] ? 'c-act' : 'c-hum') : 'c-mute')).join('') + Tx(210, 180, 'same input, same prompt, three runs', 'xs c-mute');
      return [sv(195, ln, tx), played ? 'Same question, three answers. <b>One run proves nothing.</b>' : 'Press play. Then press it again in your head.'];
    },
    b47() {
      const bar = (x, w, cls) => R(x, 50, 100, 30, 'f-card', 4) + R(x, 50, w, 30, cls, 4);
      const ln = bar(20, 75, 'f-solid-hum') + bar(140, 75, 'f-solid-hum') + bar(260, 75, 'f-solid-hum') + R(100, 130, 220, 30, 'f-card', 4) + R(100, 130, 220 * .42, 30, 'f-solid-act', 4);
      const tx = Tx(70, 100, '75%', 'xs') + Tx(130, 70, '×') + Tx(190, 100, '75%', 'xs') + Tx(250, 70, '×') + Tx(310, 100, '75%', 'xs') + Tx(210, 180, 'all three pass = ?', 'c-act');
      return [sv(200, ln, tx), 'Each run passes three times in four. <b>All three?</b>'];
    },
    b48() {
      const p = S.m6.p / 100, k = S.m6.k;
      const ln = PERSON(24, 30, 'mute') + [0, 1, 2].map(i => R(84 + i * 36, 40, 30, 40, i === 1 ? 'f-solid-hum' : 'f-act', 4)).join('') + PERSON(230, 30, 'c-hum') + [0, 1, 2].map(i => R(290 + i * 36, 40, 30, 40, 'f-solid-hum', 4)).join('');
      const tx = Tx(120, 110, 'the demo: one of three', 'xs c-mute') + Tx(325, 110, 'the customer: all three', 'xs c-hum') + Tx(120, 150, `pass@${k} = ${pct(1 - Math.pow(1 - p, k))}`) + Tx(325, 150, `pass^${k} = ${pct(Math.pow(p, k))}`, 'c-act');
      return [sv(170, ln, tx), 'Demos live on the left number. <b>Customers live on the right.</b>'];
    },
    b49() {
      const cols = ['#', 'input', 'answer', 'wrong', 'r', 'r', 'r', 'r', 'r', 'you', 'judge'];
      const ln = R(20, 20, 380, 190, 'f-bg', 8) + cols.map((c, j) => R(26 + j * 34, 26, 31, 16, c === 'r' ? 'f-solid-det' : c === 'judge' ? 'f-solid-prob' : c === 'you' ? 'f-solid-hum' : 'f-ink', 2)).join('') + Array.from({ length: 8 }, (_, i) => `<path class="dash thin" d="M26 ${62 + i * 18} H394"/>`).join('');
      const tx = Tx(210, 196, '… thirty rows, the locked rubric in the header', 'xs c-mute') + Tx(210, 240, 'amber: code · green: you · violet: judge', 'xs c-mute');
      return [sv(255, ln, tx), 'Everything you built, <b>in the columns the practice set asks for.</b>'];
    },
    b410() {
      const ln = R(30, 30, 150, 90, 'f-card', 8) + Ar(186, 75, 226, 75) + R(230, 30, 160, 90, 'f-card', 8) + `<circle class="c-act" cx="310" cy="102" r="20"/>`;
      const tx = Tx(105, 56, 'run_tests, before', 'xs c-mute') + Tx(105, 84, '11 passed · 1 failed') + Tx(310, 56, 'run_tests, after', 'xs c-mute') + Tx(310, 84, '11 passed · 0 failed') + Tx(310, 108, '1 skipped', 'xs c-act') + Tx(210, 160, '"all tests pass" is true. what moved?', 'xs c-mute');
      return [sv(180, ln, tx), 'The answer is true. <b>A line in the log is not.</b>'];
    },
    b411() {
      const cols = [['Look', 'grade the database,', 'not the sentence'], ['Write it down', 'one yes-or-no per failure,', 'code first'], ['Check the checker', 'label by hand, two rates,', 'the row it missed'], ['Change one thing', 'frozen set, three runs,', 'the bill']];
      const ln = R(14, 14, 392, 232, 'f-bg', 8) + `<path class="mute thin" d="M210 14 V246 M14 130 H406"/>`;
      const tx = cols.map((c, j) => { const x = 112 + (j % 2) * 196, y = 30 + Math.floor(j / 2) * 116; return Tx(x, y + 22, c[0], 'c-act') + Tx(x, y + 56, c[1], 'xs') + Tx(x, y + 78, c[2], 'xs'); }).join('');
      return [sv(260, ln, tx), 'One question, four times: <b>how would I know if it was wrong?</b>'];
    }
  };
  function board() {
    if (!D) return;
    const f = VIS[cur.id]; if (!f) { $('#vis').innerHTML = ''; $('#viscap').innerHTML = ''; return; }
    try { const [svg, cap] = f(); $('#vis').innerHTML = svg; $('#viscap').innerHTML = cap || ''; } catch (e) { $('#vis').innerHTML = ''; $('#viscap').innerHTML = ''; }
  }

  /* ---------- the deck ---------- */
  const T = () => true;
  const BEATS = [
    { id: 'b11', s: 1, r: b11, ok: () => S.s0.hit },
    { id: 'b12', s: 1, r: b12, ok: () => S.s0.outcome },
    { id: 'b13', s: 1, r: () => guess('g1'), ok: () => S.g.g1 != null },
    { id: 'b14', s: 1, r: b14, ok: () => S.m1.i >= FIVE.length },
    { id: 'b15', s: 1, r: b15, ok: T },
    { id: 'b21', s: 2, r: b21, ok: () => S.m2.i >= live().length },
    { id: 'b22', s: 2, r: () => {}, ok: T },
    { id: 'b23', s: 2, r: b23, ok: T },
    { id: 'b24', s: 2, r: () => guess('g2'), ok: () => S.g.g2 != null },
    { id: 'b25', s: 2, r: b25, ok: () => S.m3.i >= live().length },
    { id: 'b26', s: 2, r: b26, ok: T },
    { id: 'b27', s: 2, r: b27, ok: () => !!S.m4.locked },
    { id: 'b28', s: 2, r: () => guess('g3'), ok: () => S.g.g3 != null },
    { id: 'b29', s: 2, r: b29, ok: judged },
    { id: 'b31', s: 3, r: b31, ok: () => judged() && S.m5.i >= D.labelled.length },
    { id: 'b32', s: 3, r: b32, ok: () => S.m5.uncovered },
    { id: 'b33', s: 3, r: b33, ok: () => S.m5.uncovered },
    { id: 'b34', s: 3, r: b34, ok: () => S.m5.uncovered },
    { id: 'b35', s: 3, r: b35, ok: () => S.m8.off },
    { id: 'b36', s: 3, r: b36, ok: () => S.m8.on },
    { id: 'b37', s: 3, r: () => guess('g4'), ok: () => S.g.g4 != null },
    { id: 'b38', s: 3, r: b38, ok: () => !!S.m8.graded },
    { id: 'b41', s: 4, r: b41, ok: () => !!S.m7.change },
    { id: 'b42', s: 4, r: () => guess('g5'), ok: () => S.g.g5 != null },
    { id: 'b43', s: 4, r: b43, ok: T },
    { id: 'b44', s: 4, r: b44, ok: T },
    { id: 'b45', s: 4, r: b45, ok: T },
    { id: 'b46', s: 4, r: b46, ok: () => S.m6.played },
    { id: 'b47', s: 4, r: () => guess('g6'), ok: () => S.g.g6 != null },
    { id: 'b48', s: 4, r: b48, ok: T },
    { id: 'b49', s: 4, r: b49, ok: T },
    { id: 'b410', s: 4, r: b410, ok: () => S.tr.saved },
    { id: 'b411', s: 4, r: b411, ok: T }
  ];
  const STEP = { 1: 'Look', 2: 'Write the question down', 3: 'Check the checker', 4: 'Change one thing, look again' };
  let cur = BEATS[0];
  const opened = new Set();
  const forward = $('#forward'), next = $('#next'), prev = $('#prev');

  /* Continue exists only when the screen's one thing is done. It sits at the end of the screen, after the reveal. */
  function gate() {
    const i = BEATS.indexOf(cur), ok = cur.ok(), last = i === BEATS.length - 1;
    const was = forward.hidden;
    forward.hidden = !ok || last;
    if (!forward.hidden) {
      const nx = BEATS[i + 1];
      next.href = '#' + nx.id;
      next.innerHTML = (nx.s !== cur.s ? `Start step ${nx.s}: ${esc(STEP[nx.s])}` : 'Continue') + '<kbd>↵</kbd>';
      $('#' + cur.id).appendChild(forward);
      if (was && !$('input:focus,textarea:focus')) { forward.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    segs(); board();
  }
  function segs() {
    const i = BEATS.indexOf(cur);
    if (i > (S.reach || 0)) { S.reach = i; save(); }
    $$('#segs a').forEach(a => {
      const s = +a.dataset.s, inStep = BEATS.filter(b => b.s === s), first = BEATS.indexOf(inStep[0]), lastI = BEATS.indexOf(inStep[inStep.length - 1]);
      const reachIdx = Math.min(S.reach, lastI), fill = S.reach < first ? 0 : done.has(s) || S.reach > lastI ? 100 : ((reachIdx - first) / inStep.length) * 100;
      a.style.setProperty('--fill', fill + '%');
      a.classList.toggle('on', s === cur.s);
      a.classList.toggle('reach', S.reach >= first);
    });
  }
  function route() {
    const id = location.hash.slice(1);
    cur = BEATS.find(b => b.id === id) || BEATS[0];
    BEATS.forEach(b => { $('#' + b.id).hidden = b !== cur; });
    const inStep = BEATS.filter(b => b.s === cur.s), k = inStep.indexOf(cur), i = BEATS.indexOf(cur);
    $('#where').textContent = `Step ${cur.s} · ${STEP[cur.s]} · ${k + 1} of ${inStep.length}`;
    prev.href = '#' + BEATS[Math.max(0, i - 1)].id; prev.parentElement.hidden = !i;
    cur.r(); gate();
    if (!opened.has(cur.id)) { opened.add(cur.id); track('beat_opened', { beat: cur.id, step: cur.s }); }
    window.scrollTo(0, 0);
  }
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = e.target.matches('input,textarea,select');
    if (!typing && /^[1-9]$/.test(e.key)) {
      const b = $$('.opts button:not(:disabled), .lb button, .ck .kinds button', $('#' + cur.id)).find(x => x.dataset.i === String(+e.key - 1)) || $$('.ck .kinds button', $('#' + cur.id))[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); return; }
    }
    if ((e.key === 'ArrowRight' || (e.key === 'Enter' && !typing)) && !forward.hidden) { e.preventDefault(); location.hash = next.getAttribute('href'); }
    if (e.key === 'ArrowLeft' && !typing && BEATS.indexOf(cur)) { e.preventDefault(); location.hash = prev.getAttribute('href'); }
  });

  fetch('/c8/evals-lab/data/traces.json').then(r => r.json()).then(d => {
    D = d;
    window.addEventListener('hashchange', route);
    route();
  });
})();
