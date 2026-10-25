/* Token Meter: your own sessions. Two readers, both in the browser; nothing here makes a network call except loading JSZip.
   B, the Claude app export (main build): unzip, read conversations.json, estimate tokens per message, rebuild each chat's cost
   turn by turn with the same simulator as module 1. The export has no token counts, so every number here is an estimate.
   A, Claude Code: read the token-meter.json summary that `npx 100x-token-meter` writes. Those totals come from the logs' own usage fields.
   The export's field names are not confirmed yet (open question 1 in _plan/token-meter/NOTES.md); the reader accepts the known
   shape (chat_messages with sender, text, content, created_at, attachments, files) and says so when it finds something else. */
(function () {
  'use strict';
  const T = window.TM, $ = s => document.querySelector(s);
  const { tag, esc, num, usd, pct } = T;
  const CTX = 25000;      /* Claude app system prompt and tools, per chat */
  const IMG = 1600;       /* a pasted image of unknown size: about 1,100 × 1,100 px */
  const FILE = 3000;      /* a file with no extracted text, such as a PDF the export doesn't include */
  const SPLIT = 20;       /* restart with a summary every 20 turns */
  const IMG_RE = /\.(png|jpe?g|gif|webp|heic|bmp)$/i;
  let last = null;        /* {kind, data} for re-rendering when the model changes */

  const err = m => { const e = $('#you-err'); e.textContent = m || ''; e.hidden = !m; };

  /* ---------- B: Claude app export ---------- */
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => ok(window.JSZip); s.onerror = () => no(new Error('Could not load the unzip library. Check your connection and try again.'));
      document.head.appendChild(s);
    });
  }
  async function readExport(file) {
    let text;
    if (/\.json$/i.test(file.name)) text = await file.text();
    else {
      const zip = await (await loadJSZip()).loadAsync(file);
      const names = Object.keys(zip.files);
      const hit = names.find(n => /(^|\/)conversations\.json$/i.test(n));
      if (!hit) throw new Error('No conversations.json in this zip. Files found: ' + names.slice(0, 8).join(', ') + (names.length > 8 ? '…' : ''));
      text = await zip.file(hit).async('string');
    }
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error("conversations.json isn't valid JSON."); }
    if (!Array.isArray(data)) data = data.conversations || data.chats || [];
    if (!data.length) throw new Error('The export has no chats in it.');
    return data;
  }
  function blockText(b) {
    if (!b || typeof b !== 'object') return '';
    if (typeof b.text === 'string') return b.text;
    if (b.type === 'tool_use') return JSON.stringify(b.input || {});
    if (b.type === 'tool_result') return Array.isArray(b.content) ? b.content.map(blockText).join('\n') : typeof b.content === 'string' ? b.content : '';
    return '';
  }
  /* one chat -> turns [{u, r, out, gap, images, files}] in estimated tokens */
  function chatTurns(c) {
    const msgs = (c.chat_messages || c.messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const turns = [], pasted = [];
    let prevTime = null, curTurn = null;
    for (const m of msgs) {
      const who = m.sender || m.role, at = m.created_at ? new Date(m.created_at) : null;
      const blocks = Array.isArray(m.content) ? m.content : [];
      const body = blocks.length ? blocks.filter(b => b.type !== 'thinking').map(blockText).join('\n') : (m.text || '');
      const think = blocks.filter(b => b.type === 'thinking').map(b => b.thinking || '').join('');
      if (who === 'human' || who === 'user') {
        let u = T.est(body), att = 0, img = 0, nimg = 0, nfile = 0;
        (m.attachments || []).forEach(a => {
          const t = a.extracted_content ? T.est(a.extracted_content) : FILE; att += t; nfile++;
          pasted.push({ chat: c.name, name: a.file_name || 'attachment', kind: 'file', tokens: t, basis: a.extracted_content ? 'text' : 'guess' });
        });
        (m.files || m.files_v2 || []).forEach(f => {
          const name = f.file_name || f.name || 'file', isImg = IMG_RE.test(name) || /image/.test(f.file_kind || f.file_type || '');
          const t = isImg ? IMG : FILE; if (isImg) { img += t; nimg++; } else { att += t; nfile++; }
          pasted.push({ chat: c.name, name, kind: isImg ? 'image' : 'file', tokens: t, basis: 'guess' });
        });
        curTurn = { u: u + att + img, att, img, nimg, nfile, r: 0, out: 0, gap: prevTime && at ? (at - prevTime) / 60000 : 0, at };
        turns.push(curTurn);
      } else if (curTurn) {
        const r = T.est(body); curTurn.r += r; curTurn.out += r + T.est(think);
      }
      if (at) prevTime = at;
    }
    return { turns: turns.filter(t => t.u || t.out), pasted };
  }
  /* cost of a block of tokens added at turn k and carried to the end of the chat */
  function carried(tokens, k, n, p) { return tokens * (p.input + p.cache_write + p.cache_read * Math.max(0, n - k - 2)) / 1e6; }

  function analyseB(chats, key) {
    const P = T.PR(), ttl = P.cache_lifetime_minutes.paid_plan, p = P.models[key];
    const tot = { read: 0, write: 0, output: 0, input: 0, total: 0 };
    const rows = [], pasted = [];
    let msgs = 0, tokens = 0, breaks = 0, breakExtra = 0, splitSave = 0, imgCost = 0, fileCost = 0, outCost = 0, imgs = 0, files = 0;
    const byModel = { haiku: 0, sonnet: 0, opus: 0 };
    for (const c of chats) {
      const { turns, pasted: pz } = chatTurns(c);
      if (!turns.length) continue;
      const s = T.simulate(turns, CTX, key, ttl);
      ['read', 'write', 'output', 'input', 'total'].forEach(k => { tot[k] += s.tot[k]; });
      Object.keys(byModel).forEach(k => { byModel[k] += k === key ? s.tot.total : T.simulate(turns, CTX, k, ttl).tot.total; });
      breaks += s.breaks; breakExtra += s.breakExtra;
      const n = turns.length, hist = CTX + turns.reduce((a, t) => a + t.u + t.r, 0);
      let save = 0;
      if (n > SPLIT) { save = s.tot.total - T.simulate(turns, CTX, key, ttl, SPLIT).tot.total; splitSave += Math.max(0, save); }
      turns.forEach((t, k) => { imgCost += carried(t.img, k, n, p); fileCost += carried(t.att, k, n, p); imgs += t.nimg; files += t.nfile; });
      outCost += s.tot.output * 0.75;
      msgs += turns.length * 2; tokens += hist;
      rows.push({ name: c.name || 'Untitled', date: c.created_at || (turns[0].at && turns[0].at.toISOString()), turns: n, hist, cost: s.tot.total, save, reread: s.tot.read / s.tot.total });
      pasted.push(...pz);
    }
    if (!rows.length) throw new Error('Found chats, but no messages in the shape this reader expects. The export format may have changed.');
    const taxes = [
      { id: 1, name: 'Long-chat tax', cost: splitSave, what: `${rows.filter(r => r.turns > SPLIT).length} chats ran past ${SPLIT} turns. Restarting each with a summary every ${SPLIT} turns saves this.`, fix: `Start a fresh chat with a summary every ${SPLIT} turns.` },
      { id: 3, name: 'Screenshot tax', cost: imgCost, what: `${num(imgs)} pasted images, each re-read on every later turn. Sizes aren't in the export, so each counts as about ${num(IMG)} tokens.`, fix: 'Crop to the part that matters before you paste.' },
      { id: 4, name: 'File tax', cost: fileCost, what: `${num(files)} files and pasted documents, carried through the rest of each chat.`, fix: 'Paste the part you need, as plain text or CSV.' },
      { id: 5, name: 'Cache breaks', cost: breakExtra, what: `${num(breaks)} times you came back to a chat after more than an hour, so Claude wrote the whole history again.`, fix: 'Come back within the hour, or start a fresh chat with a summary.' },
      { id: 2, name: 'Caveman savings', cost: outCost, what: 'What answers 75% shorter would save. Small, because the re-reads stay.', fix: 'Cut what Claude re-reads, not what it writes.' }
    ];
    return { kind: 'B', chats: rows.length, msgs, tokens, tot, rows, pasted, taxes, byModel, key };
  }

  /* ---------- A: Claude Code summary ---------- */
  function analyseA(j) {
    if (!j || j.tool !== 'token-meter' || !j.totals) throw new Error("This isn't a token-meter.json file. Run npx 100x-token-meter and drop the file it writes.");
    const c = j.totals.cost, tot = { read: c.cache_read, write: c.cache_write, output: c.output, input: c.input, total: c.total };
    const t = j.taxes || {}, g = k => (t[k] && t[k].cost) || 0;
    const taxes = [
      { id: 4, name: 'Noisy output', cost: g('noisy_output'), what: `${num((t.noisy_output || {}).count || 0)} tool results over 5,000 tokens, carried through the rest of their session.`, fix: 'Ask for summaries, use head, grep and limits, not whole files or logs.' },
      { id: 3, name: 'Screenshot tax', cost: g('screenshots'), what: `${num((t.screenshots || {}).count || 0)} images in your sessions, about ${num((t.screenshots || {}).tokens || 0)} tokens.`, fix: 'Crop screenshots, or describe the bug in text.' },
      { id: 1, name: 'Startup tax', cost: g('startup'), what: `Each session starts by writing about ${num((t.startup || {}).avg_first_write || 0)} tokens to the cache: CLAUDE.md, tools, MCP servers.`, fix: 'Trim CLAUDE.md and switch off MCP servers you don\'t use.' },
      { id: 5, name: 'Cache breaks', cost: g('cache_breaks'), what: `${num((t.cache_breaks || {}).count || 0)} times a model switch or a long pause made Claude write the whole history again.`, fix: 'Pick the model first, and /clear instead of coming back hours later.' },
      { id: 6, name: 'One-model tax', cost: g('one_model'), what: `${num((t.one_model || {}).count || 0)} quick jobs ran on Opus: 10 requests or fewer, each writing under 300 tokens. Haiku would have done them for less.`, fix: 'Use Haiku or Sonnet for quick lookups and edits.' }
    ];
    return { kind: 'A', j, tot, taxes };
  }

  /* ---------- render ---------- */
  function render(r) {
    const out = $('#you-out'), P = T.PR(), est = r.kind === 'B', b = est ? 'est' : 'calc';
    const taxes = r.taxes.slice().sort((a, x) => x.cost - a.cost), top = taxes.find(t => t.id !== 2) || taxes[0], max = Math.max(...taxes.map(t => t.cost), 1e-9);
    const share = 100 * top.cost / r.tot.total;
    let html = `<h2>${est ? 'Your Claude app history' : 'Your Claude Code sessions'} ${est ? tag('est') : ''}</h2>`;
    if (est) html += `<p class="tiny">Every number here is Estimated: the export has text and times, not token counts. Priced on ${P.models[r.key].name}, as if every turn re-read the full history, with ${num(CTX)} tokens of system prompt per chat and a 1-hour cache.</p>`;
    else html += `<p class="tiny">From your local logs, ${esc(r.j.period.from.slice(0, 10))} to ${esc(r.j.period.to.slice(0, 10))}: ${num(r.j.sessions)} sessions, ${num(r.j.requests)} requests. Priced with prices.json from ${esc(r.j.prices_checked || '')}.</p>`;
    html += '<div class="stats">' + (est
      ? [[num(r.chats), 'chats'], [r.tokens >= 1e6 ? (r.tokens / 1e6).toFixed(1) + 'M' : num(r.tokens), 'tokens of history'], [usd(r.tot.total), 'at API prices'], [pct(100 * r.tot.read / r.tot.total), 'was re-reading']]
      : [[num(r.j.sessions), 'sessions'], [usd(r.tot.total), 'at API prices'], [pct(100 * r.tot.read / r.tot.total), 'was cache reads'], [pct(100 * (r.tot.read + r.tot.write) / r.tot.total), 'was the cache']]
    ).map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('') + '</div>';
    html += `<p class="eyebrow">Where it went · module 1</p><div class="stack">${T.stackHTML(r.tot)}</div><div class="legend">${T.legendHTML(r.tot, b)}</div>`;
    html += `<div class="headline"><span class="n">${pct(share)}</span><p>Your biggest tax is <b>${esc(top.name)}</b>: about ${usd(top.cost)} of ${usd(r.tot.total)} ${tag(b)}. ${esc(top.fix)}</p></div>`;
    html += '<p class="eyebrow">Your taxes, biggest first</p><div class="taxes">' + taxes.map(t =>
      `<div class="tax${t === top ? ' top' : ''}"><h3><a href="#m${t.id}">${esc(t.name)}</a></h3><span class="v">${usd(t.cost)} ${tag(b)}</span><div class="bar"><i style="width:${(100 * t.cost / max).toFixed(1)}%"></i></div><p>${esc(t.what)}</p></div>`).join('') + '</div>';
    if (est) {
      html += '<p class="eyebrow">Same history on each model · module 6</p><div class="cards3">' + ['haiku', 'sonnet', 'opus'].map(k =>
        `<div class="mcard${k === 'haiku' ? ' cheap' : ''}"><h3>${P.models[k].name}</h3><div class="tot">${usd(r.byModel[k])}</div><div class="meter"><i style="width:${(100 * r.byModel[k] / r.byModel.opus).toFixed(1)}%"></i></div></div>`).join('') + '</div>';
      const topRows = r.rows.slice().sort((a, x) => x.cost - a.cost).slice(0, 10);
      html += '<p class="eyebrow">Your 10 most expensive chats</p>' + table(['Chat', 'Turns', 'History', 'Cost', 'Re-read'], topRows.map(x => [x.name, x.turns, num(x.hist), usd(x.cost), pct(100 * x.reread)]));
      const split = r.rows.filter(x => x.save > 0).sort((a, x) => x.save - a.save).slice(0, 10);
      if (split.length) html += `<p class="eyebrow">Chats that should have been split</p>` + table(['Chat', 'Turns', 'Saving if split every ' + SPLIT], split.map(x => [x.name, x.turns, usd(x.save)]));
      if (r.pasted.length) html += `<details><summary class="eyebrow">Images and files found in your messages (${num(r.pasted.length)})</summary>` + table(['Name', 'In chat', 'Kind', 'Tokens'], r.pasted.slice(0, 200).map(x => [x.name, x.chat || 'Untitled', x.kind, num(x.tokens) + (x.basis === 'guess' ? ' (guess)' : '')])) + '</details>';
    } else if (r.j.by_model) {
      html += '<p class="eyebrow">By model · module 6</p>' + table(['Model', 'Requests', 'Cost'], Object.entries(r.j.by_model).sort((a, x) => x[1].cost - a[1].cost).map(([k, v]) => [k, num(v.requests), v.cost == null ? 'not priced' : usd(v.cost)]));
    }
    out.innerHTML = html; out.hidden = false;
    T.card({ tax: top.name, n: pct(share), line: `of my Claude spend, about ${usd(top.cost)} of ${usd(r.tot.total)}`, fix: top.fix, basis: est ? 'Estimated' : 'Computed from my logs' });
    T.refreshCard();
  }
  function table(head, rows) {
    return `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'num' : 'name'}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  async function take(kind, file, zone) {
    if (!file) return;
    err(''); zone.classList.add('busy'); const label = zone.firstChild.textContent; zone.firstChild.textContent = 'Reading in your browser…';
    T.track('import_started', { source: kind });
    try {
      if (kind === 'B') { const chats = await readExport(file); last = { kind, data: chats }; render(analyseB(chats, T.model())); }
      else { let j; try { j = JSON.parse(await file.text()); } catch (e) { throw new Error("That file isn't valid JSON."); } last = { kind, data: j }; render(analyseA(j)); }
      T.track('import_completed', { source: kind });
      if (!document.querySelector('#steps a.you.done')) document.querySelector('#steps a.you').classList.add('done');
    } catch (e) { err(e.message); }
    zone.classList.remove('busy'); zone.firstChild.textContent = label;
  }
  T.rerender = () => { if (last) try { render(last.kind === 'B' ? analyseB(last.data, T.model()) : analyseA(last.data)); } catch (e) {} };
  [['B', '#b-drop', '#b-file'], ['A', '#a-drop', '#a-file']].forEach(([k, z, f]) => {
    const zone = $(z);
    $(f).addEventListener('change', e => take(k, e.target.files[0], zone));
    T.dropTarget(zone, files => take(k, files[0], zone));
  });
})();
