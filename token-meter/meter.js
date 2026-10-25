/* Token Meter: six calculators, then the user's own history.
   Every price comes from prices.json. Every number on screen carries a basis tag (docs, calc, est).
   Files the user loads are read in this tab and never sent anywhere. The only network calls are prices.json,
   JSZip from cdnjs when a zip is dropped, PostHog events (names and small numbers only, never content), and
   the visitor's own Anthropic key, straight to api.anthropic.com, when they press "Count exactly". */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const BASIS = { docs: 'Anthropic', calc: 'Computed', bench: 'Vendor benchmark', est: 'Estimate' };
  const tag = b => `<em class="bs" data-b="${b}">${BASIS[b]}</em>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(n).toLocaleString('en-US');
  const usd = v => '$' + (v >= 100 ? num(v) : v >= 1 ? v.toFixed(2) : v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4));
  const pct = v => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + '%';
  const est = s => Math.ceil(s.length / 3.5); /* estimator; check against 20 endpoint counts before launch */
  const WORD = 4 / 3; /* tokens per English word */
  const KEYS = ['read', 'write', 'output', 'input'];
  const KLABEL = { read: 'Cache read: re-reading history', write: 'Cache write: storing new turns', output: "Output: Claude's answers", input: 'New input: your messages' };
  function track(name, props) { try { window.posthog && window.posthog.capture(name, props || {}); } catch (e) {} }

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
  function legendHTML(tot, b) {
    return KEYS.map(k => `<div><s class="k-${k}"></s><span><b>${usd(tot[k])} · ${pct(100 * tot[k] / tot.total)}</b>${KLABEL[k]} ${tag(b)}</span></div>`).join('');
  }

  /* ---------- 1. Where the money goes ---------- */
  const m1 = { turns: $('#m1-turns'), words: $('#m1-words'), ctx: $('#m1-ctx') };
  const chatOpts = extra => Object.assign({ turns: +m1.turns.value, words: +m1.words.value, ctx: +m1.ctx.value }, extra);
  function renderM1() {
    $('#m1-turns-o').textContent = m1.turns.value;
    $('#m1-words-o').textContent = m1.words.value;
    const { tot, per } = chatCost(chatOpts());
    $('#m1-stack').innerHTML = stackHTML(tot);
    $('#m1-legend').innerHTML = legendHTML(tot, 'calc');
    /* turn 1 writes the whole starting context, so it is scaled with the rest and clipped at the top */
    const sum = t => KEYS.reduce((a, k) => a + t[k], 0), max = Math.max(...per.slice(1).map(sum), per.length === 1 ? sum(per[0]) : 0);
    $('#m1-cols').innerHTML = per.map((t, i) => { const f = Math.min(1, max / sum(t)); return `<span title="Turn ${i + 1}: ${usd(sum(t))}"${f < 1 ? ' class="clip"' : ''}>${KEYS.map(k => `<i class="k-${k}" style="height:${(100 * f * t[k] / max).toFixed(2)}px"></i>`).join('')}</span>`; }).join('');
    const cache = 100 * (tot.read + tot.write) / tot.total;
    $('#m1-head').innerHTML = `<span class="n">${pct(cache)}</span><p>of this ${m1.turns.value}-turn chat (${usd(tot.total)}) is the cache: re-reading and storing history, not new words ${tag('calc')}</p>`;
    CARD[1] = { tax: 'Re-read tax', n: pct(cache), line: `of a ${m1.turns.value}-turn chat is Claude re-reading history`, fix: 'Start a fresh chat with a summary every 15 to 20 turns.', basis: 'Computed' };
  }

  /* ---------- 2. The Caveman myth ---------- */
  const m2s = $('#m2-shrink');
  function renderM2() {
    const s = +m2s.value / 100;
    $('#m2-shrink-o').textContent = m2s.value + '%';
    const a = chatCost(chatOpts()).tot, b = chatCost(chatOpts({ shrink: s })).tot;
    $('#m2-chat').textContent = `Chat from module 1: ${m1.turns.value} turns, ${m1.words.value} words a message, ${num(+m1.ctx.value / 1000)}K tokens to start.`;
    const bar = (t, label) => `<div class="bar"><div class="fill" style="height:${(180 * t.total / a.total).toFixed(1)}px">${KEYS.map(k => `<i class="k-${k}" style="height:${(100 * t[k] / t.total).toFixed(2)}%"></i>`).join('')}</div><p>${usd(t.total)}<small>${label}</small></p></div>`;
    $('#m2-duo').innerHTML = bar(a, 'Normal answers') + bar(b, `Answers ${m2s.value}% shorter`);
    const drop = 100 * (1 - b.total / a.total);
    $('#m2-head').innerHTML = `<span class="n">${pct(drop)}</span><p>is all the bill drops when every answer is ${m2s.value}% shorter. The re-reads stay ${tag('calc')}</p>`;
    CARD[2] = { tax: 'The Caveman myth', n: pct(drop), line: `saved by making every answer ${m2s.value}% shorter`, fix: 'Cut what Claude re-reads, not what it writes.', basis: 'Computed' };
  }

  /* ---------- 3. Screenshot tax ---------- */
  const cv = $('#m3-canvas'), cx = cv.getContext('2d'), m3scale = $('#m3-scale');
  const m3 = { img: null, W: 0, H: 0, crop: null, drag: null, sample: false };
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
    const t = imgTokens(w, h), p = PR.models[model];
    $('#m3-head').innerHTML = `<span class="n">${num(t)}</span><p>tokens: ${num(w)} × ${num(h)} px is ${Math.ceil(w / TILE)} × ${Math.ceil(h / TILE)} tiles ${tag('calc')}. ${usd(t * p.input / 1e6)} to send once on ${p.name}, then it rides along in every later turn ${tag('calc')}</p>`;
    CARD[3] = { tax: 'Screenshot tax', n: num(t), line: `tokens for one ${num(w)} × ${num(h)} screenshot`, fix: 'Crop to the part that matters before you paste.', basis: 'Computed' };
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
    where.closest('.mod').querySelector('.exact').after(keybox);
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
    json: () => JSON.stringify(Array.from({ length: 20 }, (_, i) => ({
      id: 1001 + i, name: ['Asha Rao', 'Vikram Shah', 'Neha Iyer', 'Rohan Das', 'Priya Nair'][i % 5] + ' ' + (i + 1),
      email: 'user' + (i + 1) + '@example.com', plan: ['starter', 'pro', 'team', 'pro'][i % 4], seats: (i % 7) + 1,
      mrr: [19, 49, 199, 49][i % 4] * ((i % 7) + 1), status: i % 6 ? 'active' : 'past_due', created_at: '2026-0' + ((i % 9) + 1) + '-1' + (i % 9) + 'T10:00:00Z'
    })), null, 2),
    html: () => `<div class="pricing-wrapper" style="padding:40px 0">\n  <div class="container mx-auto">\n    <h2 class="text-3xl font-bold text-center mb-8">Simple pricing</h2>\n` +
      [['Starter', '$19', ['1 seat', '5 projects', 'Email support']], ['Pro', '$49', ['5 seats', 'Unlimited projects', 'Priority support']], ['Team', '$199', ['25 seats', 'SSO', 'Dedicated manager']]].map(([n, p, f]) =>
        `    <div class="card rounded-xl shadow-md p-6 border border-gray-200" data-plan="${n.toLowerCase()}">\n      <h3 class="text-xl font-semibold">${n}</h3>\n      <p class="price text-4xl font-extrabold"><span class="currency">$</span>${p.slice(1)}<span class="period text-sm">/month</span></p>\n      <ul class="features list-none space-y-2">\n${f.map(x => `        <li class="feature-item flex items-center"><svg class="w-4 h-4 mr-2" viewBox="0 0 20 20"><path d="M5 10l3 3 7-7"/></svg>${x}</li>`).join('\n')}\n      </ul>\n      <a href="/signup?plan=${n.toLowerCase()}" class="btn btn-primary w-full mt-4">Choose ${n}</a>\n    </div>`).join('\n') +
      `\n  </div>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());</script>\n</div>`,
    text: () => ['On Tue, 20 Oct 2026 at 10:14, Asha Rao <asha@example.com> wrote:', '>', '>   Hi team,', '>', '>   Can we move the launch to Friday?     The   deck needs   one more pass.', '>', '>   Thanks,', '>   Asha', '>', '> --', '> Asha Rao | Head of Growth | Example Inc.', '> This email and any attachments are confidential. If you are not the intended recipient, please delete it.', '', '', 'On Tue, 20 Oct 2026 at 11:02, Vikram Shah <vikram@example.com> wrote:', '>', '>   Friday works.     I will send the   final numbers by Thursday   evening.', '>', '> --', '> Vikram Shah | Finance | Example Inc.', '> This email and any attachments are confidential. If you are not the intended recipient, please delete it.'].join('\n')
  };
  const m4in = $('#m4-in'), m4out = $('#m4-out'), m4to = $('#m4-to');
  let m4kind = '';
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
    const a = est(s), b = est(out), label = FORMATS[kind].find(f => f[0] === to)[1];
    $('#m4-to-h').textContent = label;
    $('#m4-a-t').innerHTML = num(a) + ' tokens ' + tag('est');
    $('#m4-b-t').innerHTML = num(b) + ' tokens ' + tag('est');
    $('#m4-exact-o').textContent = '';
    const drop = a ? 100 * (1 - b / a) : 0, from = { json: 'JSON', jsonx: 'JSON', html: 'HTML', text: 'raw text' }[kind];
    $('#m4-head').innerHTML = a ? `<span class="n${drop > 0 ? ' good' : ''}">${pct(Math.max(0, drop))}</span><p>fewer tokens as ${esc(label)} than as ${from}: ${num(a)} down to ${num(b)}. Claude reads it again on every later turn ${tag('est')}</p>` : '<p>Paste something above, or pick a sample.</p>';
    CARD[4] = { tax: 'Format tax', n: pct(Math.max(0, drop)), line: `fewer tokens as ${label} than as ${from}`, fix: 'Paste CSV or Markdown, not raw JSON or HTML.', basis: 'Estimate' };
    if (fromUser) completed(4);
  }
  $('#m4-sample').onchange = e => { if (e.target.value) { m4in.value = SAMPLES[e.target.value](); renderM4(true); } };
  m4in.addEventListener('input', () => { $('#m4-sample').value = ''; renderM4(true); });
  m4to.onchange = () => renderM4(true);
  $('#m4-exact').onclick = withKey($('#m4-exact'), async () => {
    if (!m4in.value.trim()) return;
    const o = $('#m4-exact-o'); o.textContent = 'Counting…';
    const a = await exact(m4in.value), b = a.error || !m4out.value.trim() ? { tokens: 0 } : await exact(m4out.value);
    if (a.error || b.error) { o.textContent = a.error || b.error; return; }
    o.innerHTML = `Claude counts ${num(a.tokens)} → ${num(b.tokens)}, ${pct(100 * (1 - b.tokens / a.tokens))} fewer ${tag('docs')}`;
    track('exact_count_used', { module: 4 });
  });

  /* ---------- 5. Cache breaker ---------- */
  const M5 = { start: 100000, grow: 600, turns: 10 };
  let m5 = [];
  const EV = { model: 'Switched model', tool: 'Added a tool', wait: 'Waited 61 minutes' };
  function m5cost(n, broken) { const p = PR.models[model], hist = M5.start + (n - 1) * M5.grow; return hist * (broken ? p.cache_write : p.cache_read) / 1e6; }
  function stepM5(ev) {
    if (m5.length >= M5.turns) return;
    m5.push({ ev: ev || null }); renderM5();
    if (ev) completed(5);
  }
  function renderM5() {
    const W = 640, H = 220, L = 44, B = 28, n = M5.turns;
    const pts = m5.map((t, i) => m5cost(i + 1, !!t.ev));
    const top = Math.max(m5cost(M5.turns, true), 0.01) * 1.1;
    const X = i => L + (W - L - 10) * i / (n - 1), Y = v => H - B - (H - B - 10) * v / top;
    const base = Array.from({ length: n }, (_, i) => `${X(i)},${Y(m5cost(i + 1, false))}`).join(' ');
    const ticks = [0, top / 2, top].map(v => `<text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#8C8C8C" font-family="JetBrains Mono,monospace">${usd(v)}</text><line x1="${L}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E4E4E4"/>`).join('');
    const xl = Array.from({ length: n }, (_, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#8C8C8C" font-family="JetBrains Mono,monospace">${i + 1}</text>`).join('');
    const line = pts.length > 1 ? `<polyline points="${pts.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" stroke="#FE6242" stroke-width="2.5" stroke-linejoin="round"/>` : '';
    const dots = pts.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${m5[i].ev ? 6 : 4}" fill="${m5[i].ev ? '#FE6242' : '#1E1E1E'}"><title>Turn ${i + 1}: ${usd(v)}${m5[i].ev ? ' · ' + EV[m5[i].ev] : ''}</title></circle>` + (m5[i].ev ? `<text x="${X(i)}" y="${Y(v) - 12}" text-anchor="middle" font-size="11" fill="#C8391F" font-family="DM Sans,sans-serif">${EV[m5[i].ev]}</text>` : '')).join('');
    $('#m5-line').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cost per turn">${ticks}${xl}<polyline points="${base}" fill="none" stroke="#D4D4D4" stroke-width="2" stroke-dasharray="4 4"/>${line}${dots}</svg>`;
    const p = PR.models[model], normal = m5cost(1, false), broke = m5cost(1, true);
    const breaks = m5.filter(t => t.ev).length, extra = m5.reduce((a, t, i) => a + (t.ev ? m5cost(i + 1, true) - m5cost(i + 1, false) : 0), 0);
    $('#m5-turn').textContent = m5.length >= M5.turns ? 'All 10 turns done. Restart to try other moves.' : `Turn ${m5.length + 1} of 10 next. Each button plays one turn.`;
    $$('#m5 [data-ev], #m5-next').forEach(b => { b.disabled = m5.length >= M5.turns; });
    $('#m5-head').innerHTML = `<span class="n">${usd(broke)}</span><p>for a turn after a break, against ${usd(normal)} for a normal turn on ${p.name}: ${Math.round(broke / normal)}× ${tag('calc')}${breaks ? `. Your ${breaks} break${breaks > 1 ? 's' : ''} added ${usd(extra)}` : ''}</p>`;
    CARD[5] = { tax: 'Cache breaker', n: Math.round(broke / normal) + '×', line: 'what one turn costs after the cache breaks', fix: 'Pick the model and tools first, and keep going within the hour.', basis: 'Computed' };
  }
  $('#m5-next').onclick = () => stepM5(null);
  $$('#m5 [data-ev]').forEach(b => { b.onclick = () => stepM5(b.dataset.ev); });
  $('#m5-reset').onclick = () => { m5 = []; renderM5(); };

  /* ---------- 6. Pick the model ---------- */
  /* token profiles per task: estimates of a typical run */
  const TASKS = {
    search: { label: 'Search files', in: 40000, out: 1500, what: 'read 40K tokens of files, write 1.5K' },
    log: { label: 'Summarise a log', in: 60000, out: 800, what: 'read a 60K-token log, write 800' },
    plan: { label: 'Plan a feature', in: 25000, out: 4000, what: 'read 25K tokens of context, write a 4K plan' }
  };
  let m6task = 'search';
  $('#m6-task').innerHTML = Object.entries(TASKS).map(([k, t]) => `<button type="button" role="radio" data-t="${k}" aria-checked="${k === m6task}">${t.label}</button>`).join('');
  $$('#m6-task button').forEach(b => { b.onclick = () => { m6task = b.dataset.t; $$('#m6-task button').forEach(x => x.setAttribute('aria-checked', x === b)); renderM6(); completed(6); }; });
  function renderM6() {
    const t = TASKS[m6task], rows = ['haiku', 'sonnet', 'opus'].map(k => {
      const p = price(k, t.in), i = t.in * p.input / 1e6, o = t.out * p.output / 1e6;
      return { k, name: PR.models[k].name, i, o, tot: i + o, rate: p.input };
    });
    const max = rows[2].tot;
    $('#m6-cards').innerHTML = rows.map(r => `<div class="mcard${r.k === 'haiku' ? ' cheap' : ''}"><h3>${r.name}</h3><div class="tot">${usd(r.tot)}</div><div class="meter"><i style="width:${(100 * r.tot / max).toFixed(1)}%"></i></div><dl><dt>Input</dt><dd>${usd(r.i)}</dd><dt>Output</dt><dd>${usd(r.o)}</dd><dt>Input price</dt><dd>$${r.rate}/M</dd></dl></div>`).join('');
    const ratio = Math.round(rows[2].rate / rows[0].rate);
    $('#m6-head').innerHTML = `<span class="n good">1/${ratio}</span><p>Haiku input costs 1/${ratio} of Opus input ${tag('docs')}. This job: ${usd(rows[0].tot)} on Haiku, ${usd(rows[2].tot)} on Opus ${tag('calc')}</p>`;
    $('#m6-how').innerHTML = `Job profile: ${t.what} ${tag('est')}. Cost = tokens × each model's price ${tag('docs')}.`;
    CARD[6] = { tax: 'One-model tax', n: ratio + '×', line: 'what Opus input costs over Haiku', fix: `Send simple jobs like "${t.label.toLowerCase()}" to Haiku.`, basis: 'Anthropic prices' };
  }

  /* ---------- shared: drop targets ---------- */
  function dropTarget(el, fn) {
    ['dragenter', 'dragover'].forEach(t => el.addEventListener(t, e => { e.preventDefault(); el.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => el.addEventListener(t, e => { e.preventDefault(); el.classList.remove('over'); }));
    el.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files; if (f && f.length) fn(f); });
  }

  /* ---------- your sessions (import.js adds the readers) ---------- */
  window.TM = { PR: () => PR, model: () => model, price, chatCost, simulate, imgTokens, est, WORD, KEYS, stackHTML, legendHTML, tag, esc, num, usd, pct, track, dropTarget, card: c => { CARD.you = c; } };

  /* ---------- result card ---------- */
  const CARD = {};
  const dlg = $('#card'), cc = $('#card-canvas');
  async function drawCard(c) {
    await Promise.all(['700 80px "Space Grotesk"', '700 200px "JetBrains Mono"', '500 40px "DM Sans"', '600 28px "JetBrains Mono"'].map(f => document.fonts.load(f).catch(() => {})));
    const g = cc.getContext('2d'), W = 1080, H = 1350, P = 88;
    g.fillStyle = '#1E1E1E'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FE6242'; g.fillRect(0, 0, W, 14);
    g.font = '700 30px "JetBrains Mono", monospace'; g.fillStyle = '#FFFFFF'; g.fillText('TOKEN', P, 130); g.fillStyle = '#FE6242'; g.fillText('METER', P + g.measureText('TOKEN').width, 130);
    g.font = '600 28px "JetBrains Mono", monospace'; g.fillStyle = '#8C8C8C'; g.fillText('MY BIGGEST TOKEN TAX', P, 300);
    g.font = '700 84px "Space Grotesk", sans-serif'; g.fillStyle = '#FFFFFF'; wrap(g, c.tax, P, 400, W - 2 * P, 92);
    let size = 220; g.font = `700 ${size}px "JetBrains Mono", monospace`;
    while (g.measureText(c.n).width > W - 2 * P && size > 80) { size -= 10; g.font = `700 ${size}px "JetBrains Mono", monospace`; }
    g.fillStyle = '#FE6242'; g.fillText(c.n, P - 6, 690);
    g.font = '500 42px "DM Sans", sans-serif'; g.fillStyle = '#D6D6D6'; const y = wrap(g, c.line, P, 770, W - 2 * P, 56);
    const by = Math.max(y + 60, 960);
    g.fillStyle = '#2A2A2A'; round(g, P, by, W - 2 * P, 200, 24); g.fill();
    g.font = '600 26px "JetBrains Mono", monospace'; g.fillStyle = '#7FDB4A'; g.fillText('THE FIX', P + 40, by + 62);
    g.font = '500 40px "DM Sans", sans-serif'; g.fillStyle = '#FFFFFF'; wrap(g, c.fix, P + 40, by + 120, W - 2 * P - 80, 52);
    g.font = '500 24px "JetBrains Mono", monospace'; g.fillStyle = '#8C8C8C';
    g.fillText((c.basis || 'Computed').toUpperCase() + ' · PRICES CHECKED ' + PR.checked, P, H - 120);
    g.fillText(location.host + '/token-meter', P, H - 80);
  }
  function wrap(g, text, x, y, max, lh) {
    const words = String(text).split(' '); let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t; }
    g.fillText(line, x, y); return y;
  }
  function round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function currentCard() { const k = cur === 'you' ? 'you' : +cur.slice(1); return CARD[k]; }
  $('#card-btn').onclick = async () => {
    const c = currentCard(); if (!c) return;
    await drawCard(c);
    dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
  };
  $('#card-close').onclick = () => dlg.close();
  const cardBlob = () => new Promise(r => cc.toBlob(r, 'image/png'));
  $('#card-dl').onclick = async () => {
    const url = URL.createObjectURL(await cardBlob()), a = document.createElement('a');
    a.href = url; a.download = 'my-token-tax.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    track('card_shared', { method: 'download', module: cur });
  };
  $('#card-share').onclick = async () => {
    const file = new File([await cardBlob()], 'my-token-tax.png', { type: 'image/png' });
    const data = { files: [file], title: 'My biggest token tax', text: 'Find yours: ' + location.origin + '/token-meter' };
    try {
      if (navigator.canShare && navigator.canShare(data)) await navigator.share(data);
      else if (navigator.share) await navigator.share({ title: data.title, text: data.text, url: location.origin + '/token-meter' });
      else { await navigator.clipboard.writeText(location.origin + '/token-meter'); $('#card-share').textContent = 'Link copied'; }
      track('card_shared', { method: 'share', module: cur });
    } catch (e) { /* cancelled */ }
  };
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
    $('#card-btn').disabled = !currentCard();
    markSteps();
    const on = $('#steps a.on'); on && on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if (id === 'm3') { if (!m3.img) loadImage(sampleImage(), true); else renderM3(); }
    const mod = id === 'you' ? 'you' : +id.slice(1);
    if (!opened.has(mod)) { opened.add(mod); track('module_opened', { module: mod }); }
    window.scrollTo(0, 0);
  }
  window.TM.refreshCard = () => { $('#card-btn').disabled = !currentCard(); };

  function renderAll() { renderM1(); renderM2(); renderM3(); renderM4(); renderM5(); renderM6(); window.TM.rerender && window.TM.rerender(); window.TM.refreshCard(); }
  [m1.turns, m1.words, m1.ctx].forEach(el => el.addEventListener('input', () => { renderM1(); renderM2(); completed(1); }));
  m2s.addEventListener('input', () => { renderM2(); completed(2); });
  $('#model').onchange = e => { model = e.target.value; renderAll(); };
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderM3, 120); });

  fetch('prices.json').then(r => r.json()).then(p => {
    PR = p;
    $$('em.bs:empty').forEach(e => { e.textContent = BASIS[e.dataset.b]; });
    $('#checked').textContent = new Date(p.checked).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    m4in.value = SAMPLES.json();
    renderAll();
    window.addEventListener('hashchange', route);
    route();
    const s = document.createElement('script'); s.src = 'import.js'; document.body.appendChild(s);
  });
})();
