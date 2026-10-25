/* Token Meter: six calculators, then the user's own history.
   Every price comes from prices.json. The big number on each module carries a basis tag (docs, calc, est).
   Files the user loads are read in this tab and never sent anywhere. The only network calls are prices.json,
   today's USD to INR rate from open.er-api.com, JSZip from cdnjs when a zip is dropped, PostHog events (names and small numbers only, never content), and
   the visitor's own Anthropic key, straight to api.anthropic.com, when they press "Count exactly".
   Teaching model: two colours everywhere. Grey is old history Claude stores and re-reads (cache write + cache read);
   coral is the new words (your message + Claude's answer). The four-way split lives under "Show the maths". */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const BASIS = { docs: 'Anthropic', calc: 'Computed', bench: 'Vendor benchmark', est: 'Estimate' };
  const WHY = { docs: 'Straight from Anthropic: its pricing page or docs', calc: 'Computed from Anthropic\'s prices', bench: 'A vendor benchmark', est: 'An estimate, not a count' };
  const tag = b => `<em class="bs" data-b="${b}" title="${WHY[b]}">${BASIS[b]}</em>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(n).toLocaleString('en-US');
  /* prices are in USD; INR multiplies by today's rate. Named usd because every caller (and import.js) already uses it */
  let money = 'USD', inr = 0;
  const usd = v => {
    const x = money === 'INR' ? v * inr : v;
    return (money === 'INR' ? '₹' : '$') + (x >= 100 ? Math.round(x).toLocaleString(money === 'INR' ? 'en-IN' : 'en-US') : x >= 0.1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : x.toFixed(4));
  };
  const pct = v => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + '%';
  const est = s => Math.ceil(s.length / 3.5); /* estimator; check against 20 endpoint counts before launch */
  const WORD = 4 / 3; /* tokens per English word */
  const KEYS = ['read', 'write', 'output', 'input'];
  const KLABEL = { read: 'Cache read: re-reading history', write: 'Cache write: storing new turns', output: "Output: Claude's answers", input: 'New input: your messages' };
  const OLD = t => t.read + t.write, NEW = t => t.input + t.output;
  function track(name, props) { try { window.posthog && window.posthog.capture(name, props || {}); } catch (e) {} }
  const cue = (good, text) => `<span class="cue${good ? ' good' : ''}">${text}</span>`;

  let PR, model = 'sonnet';
  /* Haiku 5.5 charges more for prompts over 100K tokens; the prompt length includes cache reads and writes */
  function price(key, prompt) {
    const m = PR.models[key];
    return m.long_prompt && prompt > m.long_prompt.over_tokens ? Object.assign({ name: m.name }, m.long_prompt) : m;
  }
  const done = new Set(), opened = new Set();
  function completed(mod) { if (!done.has(mod)) { done.add(mod); track('module_completed', { module: mod }); markSteps(); } }

  /* ---------- the chat cost model shared by modules 1, 2 and the Claude app import ---------- */
  /* The cache breakpoint sits before the newest message. Turn n reads everything cached up to two turns back,
     writes the last exchange (your previous message and Claude's answer), pays input on the new message and output on the answer.
     Turn 1 writes the starting context (system prompt, tools, files). A gap longer than the cache lifetime, or a model or tool change,
     throws the cache away: that turn writes the whole history again. turns: [{u, r, out, gap}] in tokens and minutes. */
  function simulate(turns, ctx, key = model, ttl = Infinity, split = 0) {
    const tot = { read: 0, write: 0, output: 0, input: 0 }, per = [];
    let cached = 0, pending = ctx, breaks = 0, breakExtra = 0;
    turns.forEach((t, n) => {
      if (split && n && n % split === 0) { cached = 0; pending = ctx + 2000; } /* fresh chat seeded with a summary */
      const broken = n > 0 && (t.brk || t.gap > ttl) && cached > 0;
      const read = broken ? 0 : cached, write = broken ? cached + pending : pending;
      const p = price(key, read + write + t.u);
      const c = { read: read * p.cache_read / 1e6, write: write * p.cache_write / 1e6, input: t.u * p.input / 1e6, output: t.out * p.output / 1e6 };
      if (broken) { breaks++; breakExtra += cached * (p.cache_write - p.cache_read) / 1e6; }
      KEYS.forEach(k => { tot[k] += c[k]; });
      per.push(c);
      cached += pending; pending = t.u + t.r;
    });
    tot.total = KEYS.reduce((a, k) => a + tot[k], 0);
    return { tot, per, breaks, breakExtra };
  }
  function chatCost({ turns, words, ctx, shrink = 0, key = model }) {
    const u = words * WORD, r = u * (1 - shrink);
    return simulate(Array.from({ length: turns }, () => ({ u, r, out: r, gap: 0 })), ctx, key);
  }

  function stackHTML(tot) {
    return KEYS.map(k => `<i class="k-${k}" style="flex-grow:${tot[k] / tot.total || 0}" title="${KLABEL[k]}"></i>`).join('');
  }
  function legendHTML(tot) {
    return KEYS.map(k => `<div><s class="k-${k}"></s><span><b>${usd(tot[k])} · ${pct(100 * tot[k] / tot.total)}</b>${KLABEL[k]}</span></div>`).join('');
  }
  /* a stack of chat bubbles: the starting context block, then one pair (you, Claude) per turn. hot = the newest pair in coral */
  function pairsHTML(n, hot, cw, h) {
    return Array.from({ length: n }, (_, i) => `<div class="pair${hot && i === n - 1 ? ' hot' : ''}" style="--h:${h}px;--cw:${cw}%"><i class="u"></i><i class="c"></i></div>`).join('');
  }
  const ctxLabel = v => v >= 200000 ? 'A whole document or codebase' : v >= 100000 ? 'Files or a Project' : "Claude's own setup";

  /* ---------- 1. Where the money goes ---------- */
  const m1 = { turns: $('#m1-turns'), words: $('#m1-words'), ctx: $('#m1-ctx') };
  const chatOpts = extra => Object.assign({ turns: +m1.turns.value, words: +m1.words.value, ctx: +m1.ctx.value }, extra);
  /* One thing on screen at a time. Stages: setup (controls and play), play (the chat alone, one message at a time),
     cost (the chat shrinks to a thumbnail beside the per-message columns), total (the sum line appears). */
  let m1shown = null, m1timer = 0; /* while playing, how many turns are on screen */
  const m1sec = $('#m1');
  function m1stage(s) {
    m1sec.dataset.stage = s;
    $('#m1-more').textContent = s === 'cost' ? "What's the total?" : 'What did each message cost?';
    $('#m1-chip-t').textContent = `${m1.turns.value} messages · ${m1.words.value} words each · ${ctxLabel(+m1.ctx.value).toLowerCase()} before`;
    if (s !== 'setup') setTimeout(renderM1, 420); /* the stack re-fits its rows once the height transition is done */
  }
  function renderM1() {
    const N = +m1.turns.value, shown = m1shown == null ? N : m1shown, stage = m1sec.dataset.stage;
    $('#m1-turns-o').textContent = N;
    $('#m1-words-o').textContent = m1.words.value;
    const full = chatCost(chatOpts()), { tot, per } = shown === N ? full : chatCost(chatOpts({ turns: shown }));
    /* the stack: context block on top, then every turn so far; the newest pair is coral. Rows are fitted into the rows box */
    const rowsEl = $('#m1-stack .rows'), rowsH = rowsEl ? rowsEl.clientHeight : 230;
    const rowH = Math.max(1, Math.min(22, Math.floor((rowsH / shown - 3) / 2)));
    $('#m1-stack').innerHTML = `<div class="ctx${shown === 1 ? ' hot' : ''}"><span>Before you typed: ${ctxLabel(+m1.ctx.value)}</span><span>${num(+m1.ctx.value / 1000)}K tokens</span></div>` +
      `<div class="rows">${pairsHTML(shown, true, 72, rowH)}</div>` +
      `<div class="lab"><span class="old">read again: <em>${shown > 1 ? (shown - 1) + ' old message' + (shown > 2 ? 's' : '') + ' + setup' : 'the setup'}</em></span><span class="new"><b>message ${shown}</b></span></div>`;
    const last = per[per.length - 1];
    $('#m1-live').textContent = stage === 'play'
      ? `Message ${shown} of ${N}: before answering, Claude reads ${shown > 1 ? `the setup and all ${shown - 1} earlier message${shown > 2 ? 's' : ''}` : 'the whole setup'} again. This message cost ${usd(OLD(last) + NEW(last))}.`
      : `${N} messages. The grey is what Claude read again.`;
    /* one column per turn, two colours. Turn 1 writes the whole starting context, so it is clipped at the top */
    const sum = t => OLD(t) + NEW(t), max = Math.max(...per.slice(1).map(sum), per.length === 1 ? sum(per[0]) : 0);
    $('#m1-cols').innerHTML = per.map((t, i) => { const f = Math.min(1, max / sum(t)); return `<span title="Message ${i + 1}: ${usd(sum(t))}"${f < 1 ? ' class="clip"' : ''}><i class="k-old" style="height:${(200 * f * OLD(t) / max).toFixed(2)}px"></i><i class="k-new" style="height:${(200 * f * NEW(t) / max).toFixed(2)}px"></i></span>`; }).join('');
    const old = 100 * OLD(tot) / tot.total;
    $('#m1-head').innerHTML = `<span class="n">${pct(old)}</span>of what you paid for this ${shown}-message chat (<b>${usd(tot.total)}</b>) went on Claude storing and re-reading <b>old messages</b>. Your new words were the other ${pct(100 - old)} ${tag('calc')}`;
    $('#m1-legend').innerHTML = legendHTML(tot);
  }
  function playM1() {
    clearInterval(m1timer);
    const N = +m1.turns.value, step = Math.max(120, Math.min(600, 4000 / N));
    m1shown = 1; m1sec.classList.remove('played'); m1stage('play'); renderM1(); completed(1);
    m1timer = setInterval(() => {
      m1shown++;
      if (m1shown >= N) { clearInterval(m1timer); m1shown = null; m1sec.classList.add('played'); }
      renderM1();
    }, step);
  }
  $('#m1-play').onclick = playM1;
  $('#m1-replay').onclick = playM1;
  $('#m1-more').onclick = () => { clearInterval(m1timer); m1shown = null; m1stage(m1sec.dataset.stage === 'cost' ? 'total' : 'cost'); renderM1(); };
  $('#m1-change').onclick = () => { clearInterval(m1timer); m1shown = null; m1stage('setup'); renderM1(); };

  /* ---------- 2. The Caveman myth ---------- */
  const m2s = $('#m2-shrink');
  function renderM2() {
    const s = +m2s.value / 100, N = +m1.turns.value;
    $('#m2-shrink-o').textContent = m2s.value + '%';
    const a = chatCost(chatOpts()).tot, b = chatCost(chatOpts({ shrink: s })).tot;
    $('#m2-chat').textContent = `The chat from module 1: ${N} messages, ${m1.words.value} words each, ${num(+m1.ctx.value / 1000)}K tokens before you typed.`;
    const rowH = Math.max(3, Math.min(10, Math.floor(180 / N)));
    const side = (t, label, cw) => `<div class="side"><h3>${label}</h3><div class="mini"><div class="ctx">Before you typed: ${num(+m1.ctx.value / 1000)}K tokens</div>${pairsHTML(N, false, cw, rowH)}</div><div class="tot">${usd(t.total)}<small>the bill</small></div><div class="meter"><i style="width:${(100 * t.total / a.total).toFixed(1)}%"></i></div></div>`;
    $('#m2-duo').innerHTML = side(a, 'Normal answers', 72) + side(b, `Answers ${m2s.value}% shorter`, Math.max(6, 72 * (1 - s)));
    const drop = 100 * (1 - b.total / a.total);
    $('#m2-head').innerHTML = `${cue(true, 'Saved')}<span class="n good">${pct(drop)}</span><p>is all the bill drops when every answer is <b>${m2s.value}% shorter</b>. The grey pile, the part Claude re-reads, barely changed ${tag('calc')}</p>`;
  }

  /* ---------- 3. Screenshot tax ---------- */
  const cv = $('#m3-canvas'), cx = cv.getContext('2d'), m3scale = $('#m3-scale');
  const m3 = { img: null, W: 0, H: 0, crop: null, drag: null, sample: false, shownT: 0, tween: 0 };
  const CAP = 2576, TILE = 28;
  function effSize() {
    const c = m3.crop, s = +m3scale.value / 100;
    let w = Math.max(1, Math.round(c.w * s)), h = Math.max(1, Math.round(c.h * s));
    const long = Math.max(w, h);
    if (long > CAP) { w = Math.round(w * CAP / long); h = Math.round(h * CAP / long); }
    return { w, h };
  }
  const imgTokens = (w, h) => {
    const long = Math.max(w, h); if (long > CAP) { w = Math.round(w * CAP / long); h = Math.round(h * CAP / long); }
    return Math.ceil(w / TILE) * Math.ceil(h / TILE);
  };
  function sampleImage() {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
    const g = c.getContext('2d');
    g.fillStyle = '#F4F4F2'; g.fillRect(0, 0, 1920, 1080);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 1920, 64); g.fillRect(0, 64, 300, 1016);
    g.fillStyle = '#E2E2DE'; g.fillRect(0, 64, 1920, 2); g.fillRect(300, 64, 2, 1016);
    g.fillStyle = '#FE6242'; g.fillRect(24, 20, 24, 24);
    g.fillStyle = '#1E1E1E'; g.font = '600 22px sans-serif'; g.fillText('Revenue dashboard', 60, 40);
    for (let i = 0; i < 9; i++) { g.fillStyle = i === 1 ? '#FFE1DB' : '#F4F4F2'; g.fillRect(16, 96 + i * 52, 268, 40); g.fillStyle = '#5C5C5C'; g.font = '18px sans-serif'; g.fillText(['Overview', 'Revenue', 'Customers', 'Invoices', 'Plans', 'Reports', 'Team', 'Settings', 'Help'][i], 32, 122 + i * 52); }
    [['MRR', '$48,210'], ['Customers', '1,284'], ['Churn', '2.1%'], ['ARPU', '$37.50']].forEach((k, i) => {
      const x = 340 + i * 392; g.fillStyle = '#FFFFFF'; g.fillRect(x, 100, 368, 150); g.fillStyle = '#8C8C8C'; g.font = '18px sans-serif'; g.fillText(k[0], x + 24, 140); g.fillStyle = '#1E1E1E'; g.font = '600 44px sans-serif'; g.fillText(k[1], x + 24, 205);
    });
    g.fillStyle = '#FFFFFF'; g.fillRect(340, 280, 1540, 420);
    g.strokeStyle = '#FE6242'; g.lineWidth = 4; g.beginPath();
    for (let i = 0; i <= 24; i++) { const x = 380 + i * 60, y = 640 - (Math.sin(i / 3) * 80 + i * 12); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = '#FFFFFF'; g.fillRect(340, 730, 1540, 320);
    for (let r = 0; r < 6; r++) { g.fillStyle = r ? '#5C5C5C' : '#1E1E1E'; g.font = (r ? '' : '600 ') + '18px sans-serif'; ['Customer', 'Plan', 'Seats', 'MRR', 'Status'].forEach((h, j) => g.fillText(r ? ['Acme Ltd', 'Pro', '12', '$1,140', 'Active'][j] : h, 372 + j * 300, 780 + r * 48)); }
    return c.toDataURL('image/png');
  }
  function loadImage(src, isSample) {
    const im = new Image();
    im.onload = () => {
      m3.img = im; m3.W = im.naturalWidth; m3.H = im.naturalHeight; m3.sample = isSample;
      m3.crop = { x: 0, y: 0, w: m3.W, h: m3.H }; m3scale.value = 100;
      $('#m3-exact-o').textContent = '';
      renderM3();
    };
    im.src = src;
  }
  function renderM3() {
    if (!m3.img) return;
    const box = cv.parentElement.clientWidth - 16 || 600;
    const d = Math.min(1, box / m3.W), cw = Math.round(m3.W * d), ch = Math.round(m3.H * d), dpr = window.devicePixelRatio || 1;
    cv.width = cw * dpr; cv.height = ch * dpr; cv.style.aspectRatio = cw + ' / ' + ch;
    cx.setTransform(dpr * d, 0, 0, dpr * d, 0, 0);
    cx.drawImage(m3.img, 0, 0);
    const c = m3.crop, { w, h } = effSize(), cell = c.w / w * TILE; /* one 28 px tile, in source pixels */
    cx.fillStyle = 'rgba(30,30,30,.55)';
    cx.fillRect(0, 0, m3.W, c.y); cx.fillRect(0, c.y + c.h, m3.W, m3.H - c.y - c.h);
    cx.fillRect(0, c.y, c.x, c.h); cx.fillRect(c.x + c.w, c.y, m3.W - c.x - c.w, c.h);
    cx.strokeStyle = 'rgba(254,98,66,.55)'; cx.lineWidth = 1 / d; cx.beginPath();
    if (cell * d >= 2) {
      for (let x = c.x + cell; x < c.x + c.w; x += cell) { cx.moveTo(x, c.y); cx.lineTo(x, c.y + c.h); }
      for (let y = c.y + cell; y < c.y + c.h; y += cell) { cx.moveTo(c.x, y); cx.lineTo(c.x + c.w, y); }
    }
    cx.stroke();
    cx.strokeStyle = '#FE6242'; cx.lineWidth = 2 / d; cx.strokeRect(c.x, c.y, c.w, c.h);
    cx.fillStyle = '#FE6242';
    const hs = 10 / d;
    [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]].forEach(([x, y]) => cx.fillRect(x - hs / 2, y - hs / 2, hs, hs));
    m3.d = d;
    $('#m3-scale-o').textContent = m3scale.value + '%';
    const t = imgTokens(w, h), full = imgTokens(m3.W, m3.H), p = PR.models[model];
    const isFull = t === full;
    const sentence = `<p><b>${Math.ceil(w / TILE)} × ${Math.ceil(h / TILE)}</b> squares for a ${num(w)} × ${num(h)} px image` +
      (isFull ? '' : `, <b>down from ${num(full)}</b> for the full one: ${pct(100 * (1 - t / full))} fewer`) +
      `. ${usd(t * p.input / 1e6)} to send once, then it rides along in every later message ${tag('calc')}</p>`;
    $('#m3-head').innerHTML = `${cue(!isFull, isFull ? 'Squares Claude charges for' : 'Squares after your crop')}<span class="n${isFull ? '' : ' good'}" id="m3-n">${num(m3.shownT || t)}</span>${sentence}`;
    tweenM3(t);
  }
  /* the big number counts up or down to the new tile count rather than jumping */
  function tweenM3(target) {
    cancelAnimationFrame(m3.tween);
    const from = m3.shownT || 0, t0 = performance.now(), dur = 450;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      m3.shownT = Math.round(from + (target - from) * e);
      const el = $('#m3-n'); if (el) el.textContent = num(m3.shownT);
      if (k < 1) m3.tween = requestAnimationFrame(step);
    };
    m3.tween = requestAnimationFrame(step);
  }
  function canvasPt(e) {
    const r = cv.getBoundingClientRect(), k = m3.W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  }
  cv.addEventListener('pointerdown', e => {
    if (!m3.img) return;
    const p = canvasPt(e), c = m3.crop, near = 22 * p.k;
    const corners = { nw: [c.x, c.y], ne: [c.x + c.w, c.y], sw: [c.x, c.y + c.h], se: [c.x + c.w, c.y + c.h] };
    let mode = null;
    for (const k in corners) if (Math.hypot(p.x - corners[k][0], p.y - corners[k][1]) < near) { mode = k; break; }
    if (!mode && p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) mode = 'move';
    if (!mode) { mode = 'se'; m3.crop = { x: p.x, y: p.y, w: 1, h: 1 }; }
    m3.drag = { mode, p0: p, c0: Object.assign({}, m3.crop) };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!m3.drag) return;
    const p = canvasPt(e), { mode, p0, c0 } = m3.drag, dx = p.x - p0.x, dy = p.y - p0.y, W = m3.W, H = m3.H;
    let x1 = c0.x, y1 = c0.y, x2 = c0.x + c0.w, y2 = c0.y + c0.h;
    if (mode === 'move') { const mx = Math.max(-x1, Math.min(W - x2, dx)), my = Math.max(-y1, Math.min(H - y2, dy)); x1 += mx; x2 += mx; y1 += my; y2 += my; }
    else { if (mode[1] === 'w') x1 += dx; else x2 += dx; if (mode[0] === 'n') y1 += dy; else y2 += dy; }
    x1 = Math.max(0, Math.min(W, x1)); x2 = Math.max(0, Math.min(W, x2)); y1 = Math.max(0, Math.min(H, y1)); y2 = Math.max(0, Math.min(H, y2));
    m3.crop = { x: Math.round(Math.min(x1, x2)), y: Math.round(Math.min(y1, y2)), w: Math.max(8, Math.round(Math.abs(x2 - x1))), h: Math.max(8, Math.round(Math.abs(y2 - y1))) };
    renderM3();
  });
  cv.addEventListener('pointerup', () => { if (m3.drag) { m3.drag = null; completed(3); } });
  m3scale.addEventListener('input', () => { renderM3(); completed(3); });
  $('#m3-sample').onclick = () => loadImage(sampleImage(), true);
  $('#m3-reset').onclick = () => { if (m3.img) { m3.crop = { x: 0, y: 0, w: m3.W, h: m3.H }; m3scale.value = 100; renderM3(); } };
  $('#m3-crop800').onclick = () => {
    if (!m3.img) return;
    const w = Math.min(800, m3.W), h = Math.min(450, m3.H);
    m3.crop = { x: Math.round((m3.W - w) / 2), y: Math.round((m3.H - h) / 2), w, h }; m3scale.value = 100; renderM3(); completed(3);
  };
  function takeFile(f) {
    if (!f || !/^image\//.test(f.type)) return;
    const url = URL.createObjectURL(f); loadImage(url, false); completed(3);
  }
  $('#m3-file').addEventListener('change', e => takeFile(e.target.files[0]));
  dropTarget($('#m3-drop'), files => takeFile(files[0]));
  document.addEventListener('paste', e => {
    if (location.hash !== '#m3') return;
    const it = Array.from(e.clipboardData && e.clipboardData.items || []).find(i => /^image\//.test(i.type));
    if (it) takeFile(it.getAsFile());
  });
  $('#m3-exact').onclick = withKey($('#m3-exact'), async () => {
    if (!m3.img) return;
    const { w, h } = effSize(), c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(m3.img, m3.crop.x, m3.crop.y, m3.crop.w, m3.crop.h, 0, 0, w, h);
    let data = c.toDataURL('image/png');
    if (data.length > 4e6) data = c.toDataURL('image/jpeg', 0.85);
    const media_type = data.slice(5, data.indexOf(';'));
    const out = $('#m3-exact-o'); out.textContent = 'Counting…';
    const r = await exact([{ type: 'image', source: { type: 'base64', media_type, data: data.slice(data.indexOf(',') + 1) } }]);
    out.innerHTML = r.error ? esc(r.error) : `Claude counts ${num(r.tokens)} tokens ${tag('docs')}`;
    if (!r.error) track('exact_count_used', { module: 3 });
  });
  /* Exact counts use the visitor's own Anthropic API key. The browser calls Anthropic directly with the official SDK
     (loaded only on first use); the key and the content never touch our server. The key lives in this tab's memory,
     or in sessionStorage if they tick "Keep for this tab", and is gone when the tab closes.
     countTokens is free. Counts use Sonnet 5.5: the 4.7+ tokenizer gives about 30% more tokens than older models.
     The message wrapper adds a few tokens; the count of '.' (one token) is subtracted so the number is the content alone. */
  const COUNT_MODEL = 'claude-sonnet-5-5', SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
  let apiKey = '', client = null, base = null, pendingCount = null;
  try { apiKey = sessionStorage.getItem('tm:key') || ''; } catch (e) {}
  const keybox = $('#keybox');
  function askKey(where, run) {
    pendingCount = run;
    where.closest('details.exact').after(keybox);
    keybox.hidden = false; $('#key-in').focus();
  }
  keybox.addEventListener('submit', e => {
    e.preventDefault();
    const k = $('#key-in').value.trim();
    if (!/^sk-ant-/.test(k)) { $('#key-err').textContent = 'That doesn\'t look like an Anthropic API key. It starts with sk-ant-.'; return; }
    apiKey = k; client = null; base = null; $('#key-in').value = ''; $('#key-err').textContent = '';
    try { $('#key-keep').checked ? sessionStorage.setItem('tm:key', k) : sessionStorage.removeItem('tm:key'); } catch (e) {}
    keybox.hidden = true;
    if (pendingCount) { const r = pendingCount; pendingCount = null; r(); }
  });
  $('#key-cancel').onclick = () => { keybox.hidden = true; pendingCount = null; };
  function forgetKey() { apiKey = ''; client = null; base = null; try { sessionStorage.removeItem('tm:key'); } catch (e) {} }
  async function exact(content) {
    try {
      if (!client) { const { default: Anthropic } = await import(SDK); client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true }); client.E = Anthropic; }
      const count = c => client.messages.countTokens({ model: COUNT_MODEL, messages: [{ role: 'user', content: c }] }).then(r => r.input_tokens);
      if (base == null) base = await count('.') - 1;
      return { tokens: Math.max(0, await count(content) - base) };
    } catch (e) {
      const E = client && client.E;
      if (E && e instanceof E.AuthenticationError) { forgetKey(); return { error: 'Anthropic rejected that key. Press Count exactly to enter it again.' }; }
      if (E && e instanceof E.PermissionDeniedError) return { error: "That key can't use Sonnet 5.5." };
      if (E && e instanceof E.RateLimitError) return { error: 'Your key hit its rate limit. Try again in a minute.' };
      if (E && e instanceof E.BadRequestError) return { error: 'Claude could not read that input.' };
      return { error: 'Counting failed. The estimate still works.' };
    }
  }
  /* run now if a key is set, else ask for one first */
  function withKey(btn, run) { return () => apiKey ? run() : askKey(btn, run); }

  /* ---------- 4. Format tax ---------- */
  const SAMPLES = {
    json: () => JSON.stringify(Array.from({ length: 5 }, (_, i) => ({
      id: 1001 + i, name: ['Asha Rao', 'Vikram Shah', 'Neha Iyer', 'Rohan Das', 'Priya Nair'][i],
      email: 'user' + (i + 1) + '@example.com', plan: ['starter', 'pro', 'team', 'pro', 'starter'][i], seats: (i % 7) + 1,
      mrr: [19, 49, 199, 49, 19][i] * ((i % 7) + 1), status: i % 4 ? 'active' : 'past_due', created_at: '2026-0' + (i + 1) + '-1' + i + 'T10:00:00Z'
    })), null, 2),
    html: () => `<div class="pricing-wrapper" style="padding:40px 0">\n  <div class="container mx-auto">\n    <h2 class="text-3xl font-bold text-center mb-8">Simple pricing</h2>\n` +
      [['Starter', '$19', ['1 seat', '5 projects', 'Email support']], ['Pro', '$49', ['5 seats', 'Unlimited projects', 'Priority support']], ['Team', '$199', ['25 seats', 'SSO', 'Dedicated manager']]].map(([n, p, f]) =>
        `    <div class="card rounded-xl shadow-md p-6 border border-gray-200" data-plan="${n.toLowerCase()}">\n      <h3 class="text-xl font-semibold">${n}</h3>\n      <p class="price text-4xl font-extrabold"><span class="currency">$</span>${p.slice(1)}<span class="period text-sm">/month</span></p>\n      <ul class="features list-none space-y-2">\n${f.map(x => `        <li class="feature-item flex items-center"><svg class="w-4 h-4 mr-2" viewBox="0 0 20 20"><path d="M5 10l3 3 7-7"/></svg>${x}</li>`).join('\n')}\n      </ul>\n      <a href="/signup?plan=${n.toLowerCase()}" class="btn btn-primary w-full mt-4">Choose ${n}</a>\n    </div>`).join('\n') +
      `\n  </div>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());</script>\n</div>`,
    text: () => ['On Tue, 20 Oct 2026 at 10:14, Asha Rao <asha@example.com> wrote:', '>', '>   Hi team,', '>', '>   Can we move the launch to Friday?     The   deck needs   one more pass.', '>', '>   Thanks,', '>   Asha', '>', '> --', '> Asha Rao | Head of Growth | Example Inc.', '> This email and any attachments are confidential. If you are not the intended recipient, please delete it.', '', '', 'On Tue, 20 Oct 2026 at 11:02, Vikram Shah <vikram@example.com> wrote:', '>', '>   Friday works.     I will send the   final numbers by Thursday   evening.', '>', '> --', '> Vikram Shah | Finance | Example Inc.', '> This email and any attachments are confidential. If you are not the intended recipient, please delete it.'].join('\n')
  };
  const m4in = $('#m4-in'), m4out = $('#m4-out'), m4to = $('#m4-to'), m4inHL = $('#m4-in-hl'), m4outHL = $('#m4-out-hl');
  let m4kind = '';
  /* the characters that are not words: brackets, quotes, separators, tag punctuation, indentation and runs of spaces */
  const NOISE = /([{}\[\]"'<>\/=;:,|\\`#*]+|^[ \t]+|[ \t]{2,}|^>+)/gm;
  function noise(s) { let n = 0; s.replace(NOISE, m => { n += m.length; return m; }); return n; }
  function highlight(pre, s) {
    pre.innerHTML = esc(s).replace(/(&quot;|&#39;|&lt;|&gt;|&amp;|[{}\[\]\/=;:,|\\`#*]+|^[ \t]+|[ \t]{2,})/gm, m => `<mark>${m}</mark>`).replace(/<\/mark><mark>/g, '') + '\n';
  }
  function detect(s) {
    const t = s.trim();
    if (/^[\[{]/.test(t)) { try { return { kind: 'json', data: JSON.parse(t) }; } catch (e) {} }
    if (/<[a-z][\s\S]*>/i.test(t)) return { kind: 'html' };
    return { kind: 'text' };
  }
  function rowsOf(d) {
    if (Array.isArray(d) && d.length && d.every(r => r && typeof r === 'object' && !Array.isArray(r))) return d;
    if (d && typeof d === 'object' && !Array.isArray(d)) for (const k in d) { const r = rowsOf(d[k]); if (r) return r; }
    return null;
  }
  const cell = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  function toCSV(rows) {
    const cols = [...new Set(rows.flatMap(Object.keys))];
    const q = v => { const s = cell(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
  }
  function toMDTable(rows) {
    const cols = [...new Set(rows.flatMap(Object.keys))], q = v => cell(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|', ...rows.map(r => '| ' + cols.map(c => q(r[c])).join(' | ') + ' |')].join('\n');
  }
  function toPlain(d, pad = '') {
    if (d == null || typeof d !== 'object') return String(d);
    return Object.entries(d).map(([k, v]) => v && typeof v === 'object' ? `${pad}${Array.isArray(d) ? '-' : k + ':'}\n${toPlain(v, pad + '  ')}` : `${pad}${Array.isArray(d) ? '-' : k + ':'} ${v}`).join('\n');
  }
  function htmlTo(s, md) {
    const doc = new DOMParser().parseFromString(s, 'text/html');
    doc.querySelectorAll('script,style,noscript,svg,template,iframe').forEach(n => n.remove());
    const BLOCK = /^(P|DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|UL|OL|TABLE|TR|BLOCKQUOTE|PRE|FORM)$/;
    function walk(n) {
      if (n.nodeType === 3) return n.textContent.replace(/\s+/g, ' ');
      if (n.nodeType !== 1) return '';
      const t = n.tagName, inner = () => Array.from(n.childNodes).map(walk).join('');
      if (/^H[1-6]$/.test(t)) return '\n\n' + (md ? '#'.repeat(+t[1]) + ' ' : '') + inner().trim() + '\n\n';
      if (t === 'LI') return '\n' + (md ? '- ' : '') + inner().trim();
      if (t === 'BR') return '\n';
      if (md && (t === 'STRONG' || t === 'B')) return '**' + inner().trim() + '**';
      if (md && t === 'A' && n.getAttribute('href')) return '[' + inner().trim() + '](' + n.getAttribute('href') + ')';
      if (md && t === 'IMG') return n.alt ? '![' + n.alt + ']' : '';
      if (t === 'TD' || t === 'TH') return (md ? ' | ' : '\t') + inner().trim();
      if (t === 'TR') return '\n' + inner().trim() + (md ? ' |' : '');
      return BLOCK.test(t) ? '\n\n' + inner().trim() + '\n\n' : inner();
    }
    return walk(doc.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
  }
  function cleanText(s) {
    return s.split('\n').map(l => l.replace(/^(>\s*)+/, '').replace(/\s+/g, ' ').trim())
      .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
      .filter((l, i, a) => !/^This email and any attachments are confidential/.test(l) || a.indexOf(l) === i)
      .join('\n').trim();
  }
  const FORMATS = { json: [['csv', 'CSV'], ['md', 'Markdown table'], ['plain', 'Plain text']], jsonx: [['plain', 'Plain text']], html: [['md', 'Markdown'], ['plain', 'Plain text']], text: [['plain', 'Tidy plain text']] };
  function renderM4(fromUser) {
    const s = m4in.value, d = detect(s);
    let kind = d.kind, rows = null;
    if (kind === 'json') { rows = rowsOf(d.data); if (!rows) kind = 'jsonx'; }
    if (kind !== m4kind) {
      m4kind = kind;
      m4to.innerHTML = FORMATS[kind].map(([v, l]) => `<option value="${v}">To ${l}</option>`).join('');
    }
    const to = m4to.value;
    let out = '';
    if (!s.trim()) out = '';
    else if (kind === 'json') out = to === 'csv' ? toCSV(rows) : to === 'md' ? toMDTable(rows) : toPlain(d.data);
    else if (kind === 'jsonx') out = toPlain(d.data);
    else if (kind === 'html') out = htmlTo(s, to === 'md');
    else out = cleanText(s);
    m4out.value = out;
    highlight(m4inHL, s); highlight(m4outHL, out);
    const a = est(s), b = est(out), label = FORMATS[kind].find(f => f[0] === to)[1];
    const na = s.length ? Math.round(100 * noise(s) / s.length) : 0, nb = out.length ? Math.round(100 * noise(out) / out.length) : 0;
    $('#m4-to-h').textContent = label;
    $('#m4-a-t').innerHTML = `${num(a)} tokens <small>· ${na}% marks</small>`;
    $('#m4-b-t').innerHTML = `${num(b)} tokens <small>· ${nb}% marks</small>`;
    $('#m4-exact-o').textContent = '';
    const drop = a ? 100 * (1 - b / a) : 0, from = { json: 'JSON', jsonx: 'JSON', html: 'HTML', text: 'raw text' }[kind];
    $('#m4-head').innerHTML = a ? `${cue(drop > 0, drop > 0 ? 'Saved' : 'No change')}<span class="n${drop > 0 ? ' good' : ''}">${pct(Math.max(0, drop))}</span><p>fewer tokens as <b>${esc(label)}</b> than as ${from}: ${num(a)} down to ${num(b)}. The marks were ${na}% of the original and are ${nb}% now. Claude reads this again on every later message ${tag('est')}</p>` : '<p>Paste something, or pick a sample.</p>';
    if (fromUser) completed(4);
  }
  $('#m4-sample').onchange = e => { if (e.target.value) { m4in.value = SAMPLES[e.target.value](); renderM4(true); } else { m4in.value = ''; renderM4(true); m4in.focus(); } };
  m4in.addEventListener('input', () => { $('#m4-sample').value = ''; renderM4(true); });
  m4to.onchange = () => renderM4(true);
  [[m4in, m4inHL], [m4out, m4outHL]].forEach(([ta, pre]) => ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; }));
  $('#m4-exact').onclick = withKey($('#m4-exact'), async () => {
    if (!m4in.value.trim()) return;
    const o = $('#m4-exact-o'); o.textContent = 'Counting…';
    const a = await exact(m4in.value), b = a.error || !m4out.value.trim() ? { tokens: 0 } : await exact(m4out.value);
    if (a.error || b.error) { o.textContent = a.error || b.error; return; }
    o.innerHTML = `Claude counts ${num(a.tokens)} → ${num(b.tokens)}, ${pct(100 * (1 - b.tokens / a.tokens))} fewer ${tag('docs')}`;
    track('exact_count_used', { module: 4 });
  });

  /* ---------- 5. Restart fee (a cache break) ---------- */
  const M5 = { start: 100000, grow: 600, turns: 10 };
  let m5 = [];
  const EV = { model: 'Switched model', tool: 'Added a tool', wait: 'Came back the next day' };
  function m5cost(n, broken) { const p = PR.models[model], hist = M5.start + (n - 1) * M5.grow; return hist * (broken ? p.cache_write : p.cache_read) / 1e6; }
  function stepM5(ev) {
    if (m5.length >= M5.turns) return;
    m5.push({ ev: ev || null }); renderM5();
    if (ev) completed(5);
  }
  function renderM5() {
    const W = 640, H = 200, L = 44, B = 28, n = M5.turns, p = PR.models[model];
    const pts = m5.map((t, i) => m5cost(i + 1, !!t.ev));
    const top = Math.max(m5cost(M5.turns, true), 0.01) * 1.1;
    const X = i => L + (W - L - 10) * i / (n - 1), Y = v => H - B - (H - B - 10) * v / top;
    const base = Array.from({ length: n }, (_, i) => `${X(i)},${Y(m5cost(i + 1, false))}`).join(' ');
    const ticks = [m5cost(1, false), m5cost(1, true)].map((v, i) => `<text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="${i ? '#C8391F' : '#8C8C8C'}" font-family="JetBrains Mono,monospace">${usd(v)}</text><line x1="${L}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="${i ? '#FFA48F' : '#E4E4E4'}" stroke-dasharray="${i ? '3 3' : ''}"/>`).join('');
    const xl = Array.from({ length: n }, (_, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#8C8C8C" font-family="JetBrains Mono,monospace">${i + 1}</text>`).join('');
    const line = pts.length > 1 ? `<polyline points="${pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linejoin="round"/>` : '';
    const dots = pts.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${m5[i].ev ? 6 : 4}" fill="${m5[i].ev ? '#FE6242' : '#1E1E1E'}"><title>Message ${i + 1}: ${usd(v)}${m5[i].ev ? ' · ' + EV[m5[i].ev] : ''}</title></circle>`).join('');
    $('#m5-line').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cost per message">${ticks}${xl}<polyline points="${base}" fill="none" stroke="#D4D4D4" stroke-width="2" stroke-dasharray="4 4"/>${line}${dots}</svg><p class="cap">What each message costs. Dashed grey: the usual price. Dashed coral: the restart price.</p>`;
    /* the shop: a ticket for the saved order, one stamp per message, and what the last message cost */
    const last = m5[m5.length - 1], i = m5.length, torn = !!(last && last.ev), normal = m5cost(1, false), broke = m5cost(1, true);
    const lastCost = i ? m5cost(i, torn) : 0;
    $('#m5-shop').innerHTML = `<div class="ticket${torn ? ' torn' : ''}"><p class="t">${torn ? 'Torn up: ' + EV[last.ev].toLowerCase() : 'Your usual order, kept ready'}</p><ul><li>Model: ${p.name}</li><li>Tools: the usual set</li><li>The chat so far: ${num((M5.start + Math.max(0, i - 1) * M5.grow) / 1000)}K tokens</li></ul></div>` +
      `<div class="stamps">${Array.from({ length: n }, (_, k) => `<span class="${k < i ? (m5[k].ev ? 'brk' : 'ok') : ''}">${k < i ? (m5[k].ev ? '✕' : '✓') : k + 1}</span>`).join('')}</div>` +
      (i ? `<div class="now"><span>Message ${i}: ${torn ? 'had to <b>rebuild the whole order</b>' : 'served from the saved order'}</span><b class="${torn ? 'brk' : ''}">${usd(lastCost)}</b><div class="bar"><i class="${torn ? 'brk' : ''}" style="width:${(100 * lastCost / broke).toFixed(1)}%"></i></div></div>` : '');
    const breaks = m5.filter(t => t.ev).length, extra = m5.reduce((a, t, k) => a + (t.ev ? m5cost(k + 1, true) - m5cost(k + 1, false) : 0), 0);
    $('#m5-turn').textContent = m5.length >= M5.turns ? 'All 10 messages sent. Start over to try other moves.' : `Message ${m5.length + 1} of 10 next. Each button sends one message.`;
    $$('#m5 [data-ev], #m5-next').forEach(b => { b.disabled = m5.length >= M5.turns; });
    $('#m5-head').innerHTML = `${cue(false, 'The restart fee')}<span class="n">${Math.round(broke / normal)}×</span><p>a message after a restart costs <b>${usd(broke)}</b> against ${usd(normal)} for a normal one on ${p.name} ${tag('calc')}${breaks ? `. Your ${breaks} restart${breaks > 1 ? 's' : ''} added <b>${usd(extra)}</b>` : ''}</p>`;
  }
  $('#m5-next').onclick = () => stepM5(null);
  $$('#m5 [data-ev]').forEach(b => { b.onclick = () => stepM5(b.dataset.ev); });
  $('#m5-reset').onclick = () => { m5 = [{ ev: null }, { ev: null }, { ev: null }]; renderM5(); };
  m5 = [{ ev: null }, { ev: null }, { ev: null }]; /* three normal messages first, so the baseline is on screen before anyone presses anything */

  /* ---------- 6. Pick the model ---------- */
  /* token profiles per task: estimates of a typical run */
  const TASKS = {
    search: { label: 'Search files', in: 40000, out: 1500, what: 'read 40K tokens of files, write 1.5K' },
    log: { label: 'Summarise a log', in: 60000, out: 800, what: 'read a 60K-token log, write 800' },
    plan: { label: 'Plan a feature', in: 25000, out: 4000, what: 'read 25K tokens of context, write a 4K plan' }
  };
  let m6task = 'search', m6n = 1;
  $('#m6-task').innerHTML = Object.entries(TASKS).map(([k, t]) => `<button type="button" role="radio" data-t="${k}" aria-checked="${k === m6task}">${t.label}</button>`).join('');
  $$('#m6-task button').forEach(b => { b.onclick = () => { m6task = b.dataset.t; $$('#m6-task button').forEach(x => x.setAttribute('aria-checked', x === b)); renderM6(); completed(6); }; });
  $$('#m6-times button').forEach(b => { b.onclick = () => { m6n = +b.dataset.n; $$('#m6-times button').forEach(x => x.setAttribute('aria-checked', x === b)); renderM6(); completed(6); }; });
  function renderM6() {
    const t = TASKS[m6task], rows = ['haiku', 'sonnet', 'opus'].map(k => {
      const p = price(k, t.in), i = t.in * p.input / 1e6 * m6n, o = t.out * p.output / 1e6 * m6n;
      return { k, name: PR.models[k].name, i, o, tot: i + o, rate: p.input };
    });
    const max = rows[2].tot, times = m6n > 1 ? `, ${num(m6n)} times` : '';
    $('#m6-scale').innerHTML = `<div class="track">${rows.map((r, i) => `<div class="dot${i === 0 ? ' cheap' : i === 2 ? ' dear' : ''}" style="left:${Math.max(1.5, 100 * r.tot / max).toFixed(1)}%"><b>${usd(r.tot)}</b><small>${r.name}</small></div>`).join('')}</div><div class="ends"><span>Cheapest</span><span>Same job${times}</span><span>Dearest</span></div>`;
    $('#m6-cards').innerHTML = rows.map(r => `<div class="mcard${r.k === 'haiku' ? ' cheap' : ''}"><h3>${r.name}</h3><div class="tot">${usd(r.tot)}</div><div class="meter"><i style="width:${(100 * r.tot / max).toFixed(1)}%"></i></div><dl><dt>Reading</dt><dd>${usd(r.i)}</dd><dt>Writing</dt><dd>${usd(r.o)}</dd><dt>Price per M in</dt><dd>${usd(r.rate)}</dd></dl></div>`).join('');
    const ratio = Math.round(rows[2].tot / rows[0].tot);
    $('#m6-head').innerHTML = `${cue(true, 'Saved by picking the small model')}<span class="n good">${ratio}×</span><p>cheaper on Haiku than on Opus for "${t.label.toLowerCase()}"${times}: <b>${usd(rows[0].tot)}</b> against ${usd(rows[2].tot)} ${tag('calc')}</p>`;
    $('#m6-how').innerHTML = `Job profile: ${t.what} (estimate). Cost = tokens × each model's price from Anthropic's pricing page.`;
  }

  /* ---------- shared: drop targets ---------- */
  function dropTarget(el, fn) {
    ['dragenter', 'dragover'].forEach(t => el.addEventListener(t, e => { e.preventDefault(); el.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => el.addEventListener(t, e => { e.preventDefault(); el.classList.remove('over'); }));
    el.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files; if (f && f.length) fn(f); });
  }

  /* ---------- your sessions (import.js adds the readers) ---------- */
  window.TM = { PR: () => PR, model: () => model, price, chatCost, simulate, imgTokens, est, WORD, KEYS, stackHTML, legendHTML, tag, esc, num, usd, pct, track, dropTarget, cue };

  $('#cta').onclick = () => track('cta_clicked', { module: cur });

  /* ---------- routing: one module per screen ---------- */
  const ORDER = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'you'];
  let cur = 'm1';
  function markSteps() {
    $$('#steps a').forEach(a => { const id = a.getAttribute('href').slice(1); a.classList.toggle('on', id === cur); a.classList.toggle('done', done.has(id === 'you' ? 'you' : +id.slice(1))); });
  }
  function route() {
    const id = ORDER.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'm1';
    cur = id;
    ORDER.forEach(o => { $('#' + o).hidden = o !== id; });
    const i = ORDER.indexOf(id);
    $('#prev').href = '#' + ORDER[Math.max(0, i - 1)]; $('#prev').style.visibility = i ? '' : 'hidden';
    $('#next').href = '#' + ORDER[Math.min(ORDER.length - 1, i + 1)]; $('#next').style.visibility = i < ORDER.length - 1 ? '' : 'hidden';
    markSteps();
    const on = $('#steps a.on'); on && on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if (id === 'm3') { if (!m3.img) loadImage(sampleImage(), true); else renderM3(); }
    const mod = id === 'you' ? 'you' : +id.slice(1);
    if (!opened.has(mod)) { opened.add(mod); track('module_opened', { module: mod }); }
    window.scrollTo(0, 0);
  }

  function renderAll() { renderM1(); renderM2(); renderM3(); renderM4(); renderM5(); renderM6(); window.TM.rerender && window.TM.rerender(); }
  [m1.turns, m1.words, m1.ctx].forEach(el => el.addEventListener('input', () => { clearInterval(m1timer); m1shown = null; renderM1(); renderM2(); completed(1); }));
  m2s.addEventListener('input', () => { renderM2(); completed(2); });
  $('#model').onchange = e => { model = e.target.value; renderAll(); };
  function setMoney(m) {
    money = m === 'INR' && inr ? 'INR' : 'USD';
    $$('#money button').forEach(b => b.setAttribute('aria-checked', b.dataset.c === money));
    $('#fx').hidden = money !== 'INR';
    try { localStorage.setItem('tm:money', money); } catch (e) {}
  }
  $$('#money button').forEach(b => { b.onclick = () => { setMoney(b.dataset.c); renderAll(); track('currency_changed', { currency: money }); }; });
  /* today's rate; prices.json carries a fallback so INR still works offline */
  function loadRate(fallback) {
    const show = (r, d) => { inr = r; $('#fx').textContent = `$1 = ₹${r.toFixed(2)}, rate of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`; };
    show(fallback.rate, new Date(fallback.checked));
    return fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(j => { if (j.rates && j.rates.INR) show(j.rates.INR, new Date(j.time_last_update_unix * 1000)); }).catch(() => {});
  }
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderM3, 120); });

  fetch('/token-meter/prices.json').then(r => r.json()).then(p => {
    PR = p;
    $$('em.bs:empty').forEach(e => { e.textContent = BASIS[e.dataset.b]; e.title = WHY[e.dataset.b]; });
    $('#checked').textContent = new Date(p.checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    m4in.value = SAMPLES.json();
    let saved = 'USD'; try { saved = localStorage.getItem('tm:money') || 'USD'; } catch (e) {}
    loadRate(p.usd_inr).then(() => { if (money === 'INR') renderAll(); });
    setMoney(saved);
    renderAll();
    window.addEventListener('hashchange', route);
    route();
    const s = document.createElement('script'); s.src = '/token-meter/import.js'; document.body.appendChild(s);
  });
})();
