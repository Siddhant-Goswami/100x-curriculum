/* Token Meter: your own sessions. Two readers, both in the browser; nothing here makes a network call except loading JSZip.
   B, the Claude app export (main build): unzip, read conversations.json, estimate tokens per message, rebuild each chat's cost
   turn by turn with the same simulator as module 1. The export has no token counts, so every number here is an estimate.
   A, coding agents: read the token-meter.json summary that `npx 100x-token-meter` writes from Claude Code, Codex CLI, Gemini CLI, OpenCode
   or Hermes Agent logs. Those totals come from the logs' own usage fields. The file says which tool and provider it came from (version 3),
   and the words follow it. Tools that keep session totals only (Hermes) send null taxes and no by_source; by_tool[x].measured says what each had.
   B is the Claude app only, so it shows when Claude is the chosen AI.
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
  /* the coding agent each provider's CLI reader covers, and the words its tips use */
  const TOOLS = {
    'claude-code': { label: 'Claude Code', prov: 'anthropic', memory: 'CLAUDE.md', clear: '/clear', notes: "Claude Code's notes" },
    codex: { label: 'Codex CLI', prov: 'openai', memory: 'AGENTS.md', clear: '/new', notes: "Codex's notes" },
    'gemini-cli': { label: 'Gemini CLI', prov: 'google', memory: 'GEMINI.md', clear: '/clear', notes: "Gemini CLI's notes" },
    opencode: { label: 'OpenCode', prov: null, memory: 'AGENTS.md', clear: '/new', notes: "OpenCode's notes" },
    hermes: { label: 'Hermes Agent', prov: null, memory: 'SOUL.md and AGENTS.md', clear: '/new', notes: "Hermes's notes" },
    mixed: { label: 'coding agent', prov: null, memory: 'your memory files (CLAUDE.md, AGENTS.md, GEMINI.md)', clear: 'a fresh session', notes: "The tools' own notes" }
  };
  const toolOf = p => Object.keys(TOOLS).find(k => TOOLS[k].prov === p);

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
    const AI = T.AI(), ttl = AI.cache.ttl_minutes.app, p = AI.models[key];
    const tot = { read: 0, write: 0, output: 0, input: 0, total: 0 };
    const rows = [], pasted = [];
    let msgs = 0, tokens = 0, breaks = 0, breakExtra = 0, splitSave = 0, imgCost = 0, fileCost = 0, outCost = 0, imgs = 0, files = 0;
    const byModel = {}; AI.tiers.forEach(k => { byModel[k] = 0; });
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
      { id: 5, name: 'Restart fees', cost: breakExtra, what: `${num(breaks)} times you came back to a chat after more than an hour, so Claude wrote the whole history again.`, fix: 'Come back within the hour, or start a fresh chat with a summary.' },
      { id: 2, name: 'Caveman savings', cost: outCost, what: 'What answers 75% shorter would save. Small, because the re-reads stay.', fix: 'Cut what Claude re-reads, not what it writes.' }
    ];
    return { kind: 'B', chats: rows.length, msgs, tokens, tot, rows, pasted, taxes, byModel, key };
  }

  /* ---------- A: coding agent summary ---------- */
  function analyseA(j) {
    if (!j || j.tool !== 'token-meter' || !j.totals) throw new Error("This isn't a token-meter.json file. Run npx 100x-token-meter and drop the file it writes.");
    const c = j.totals.cost, tot = { read: c.cache_read, write: c.cache_write, output: c.output, input: c.input, total: c.total };
    const t = j.taxes || {}, g = k => (t[k] && t[k].cost) || 0;
    /* files before version 3 came from Claude Code only */
    const tl = TOOLS[j.source] || TOOLS['claude-code'], FP = T.PR().providers[j.provider || tl.prov || ''];
    const who = FP ? FP.assistant : 'the model', tier = i => FP ? FP.models[FP.tiers[i]].name : ['the small model', 'the mid model', 'the top model'][i];
    const resend = !FP || FP.cache.write_premium ? 'store the whole history again' : 'pay full price for the whole history again';
    const taxes = [
      { id: 4, name: 'Noisy output', cost: g('noisy_output'), what: `${num((t.noisy_output || {}).count || 0)} tool results over 5,000 tokens, carried through the rest of their session.`, fix: 'Ask for summaries, use head, grep and limits, not whole files or logs.' },
      { id: 3, name: 'Screenshot tax', cost: g('screenshots'), what: `${num((t.screenshots || {}).count || 0)} images in your sessions, about ${num((t.screenshots || {}).tokens || 0)} tokens.`, fix: 'Crop screenshots, or describe the bug in text.' },
      { id: 1, name: 'Startup tax', cost: g('startup'), what: `Each session starts by sending about ${num((t.startup || {}).avg_first_write || 0)} new tokens: ${tl.memory}, tools, MCP servers.`, fix: `Trim ${tl.memory} and switch off MCP servers you don't use.` },
      { id: 5, name: 'Restart fees', cost: g('cache_breaks'), what: `${num((t.cache_breaks || {}).count || 0)} times a model switch or a long pause made ${who} ${resend}.`, fix: `Pick the model first, and use ${tl.clear} instead of coming back hours later.` },
      { id: 6, name: 'One-model tax', cost: g('one_model'), what: `${num((t.one_model || {}).count || 0)} quick jobs ran on ${tier(2)}: 10 requests or fewer, each writing under 300 tokens. ${tier(0)} would have done them for less.`, fix: `Use ${tier(0)} or ${tier(1)} for quick lookups and edits.` }
    ].filter(x => t[{ 4: 'noisy_output', 3: 'screenshots', 1: 'startup', 5: 'cache_breaks', 6: 'one_model' }[x.id]] !== null);
    return { kind: 'A', j, tot, taxes, tl, who };
  }

  /* ---------- A: where the money went, by source (token-meter.json version 2 and later) ---------- */
  const GROUPS = (who, tl) => [
    ['agent', 'Subagents', `Helpers ${who} started. Each reads its own setup and files, so this is often the biggest line.`],
    ['tool', 'Built-in tools', `What ${who} asked the shell, file and edit tools for, and what came back. Big results get re-read on every later step.`],
    ['mcp', 'MCP servers', 'Calls to connected servers, plus their instructions, loaded every session whether you use them or not.'],
    ['skill', 'Skills', `Skill instructions ${who} loaded, plus the list of every skill it sees each session.`],
    ['setup', 'Startup', `System prompt, ${tl.memory} and the tool list, paid again in every session.`],
    ['prompts', 'Your prompts', 'What you typed. Usually a small share: the cost is in what your prompts set off.'],
    ['replies', who === 'the model' ? 'Replies' : `${who}'s replies`, `What ${who} wrote back to you, and its thinking.`],
    ['notes', tl.notes, 'Reminders and command output the tool adds on its own.']
  ];
  function sourcesHTML(list, total, who, tl) {
    const groups = GROUPS(who, tl).map(([kind, name, what]) => {
      const items = list.filter(x => x.kind === kind), cost = items.reduce((a, x) => a + x.cost, 0);
      return { kind, name, what, items, cost, calls: items.reduce((a, x) => a + (x.calls || 0), 0) };
    }).filter(g => g.cost > 0).sort((a, b) => b.cost - a.cost);
    const max = groups[0] ? groups[0].cost : 1;
    return '<p class="eyebrow">Where it went, by source</p><div class="srcs">' + groups.map(g => {
      const named = g.items.length > 1 || (g.items[0] && g.items[0].name && !['agent', 'prompts', 'replies', 'notes'].includes(g.kind));
      const rows = named ? `<ul>${g.items.map(x => `<li><span>${esc(x.name)}</span><em>${x.calls ? num(x.calls) + (x.calls === 1 ? ' call' : ' calls') : ''}</em><b>${usd(x.cost)}</b></li>`).join('')}</ul>` : '';
      return `<details class="src"${named ? '' : ' data-flat'}><summary><span class="nm">${g.name}</span><span class="v">${usd(g.cost)} <small>${pct(100 * g.cost / total)}</small></span><span class="bar"><i style="width:${(100 * g.cost / max).toFixed(1)}%"></i></span></summary><p>${esc(g.what)}${g.kind === 'agent' && g.calls ? ` It started ${num(g.calls)}.` : ''}</p>${rows}</details>`;
    }).join('') + `</div><p class="tiny">Each request's real cost is shared over what was in the model's context, by estimated size ${tag('est')}. Names only: no prompts or code are in the file.</p>`;
  }

  /* ---------- render ---------- */
  function render(r) {
    const out = $('#you-out'), AI = T.AI(), est = r.kind === 'B', b = est ? 'est' : 'calc';
    const taxes = r.taxes.slice().sort((a, x) => x.cost - a.cost), top = taxes.find(t => t.id !== 2) || taxes[0], max = Math.max(...taxes.map(t => t.cost), 1e-9);
    const share = top ? 100 * top.cost / r.tot.total : 0;
    let html = `<h2>${est ? 'Your Claude app history' : `Your ${esc(r.tl.label)} sessions`} ${est ? tag('est') : ''}</h2>`;
    if (est) html += `<p class="tiny">Every number here is Estimated: the export has text and times, not token counts. Priced on ${AI.models[r.key].name}, as if every turn re-read the full history, with ${num(CTX)} tokens of system prompt per chat and a 1-hour cache.</p>`;
    else html += `<p class="tiny">From your local logs, ${esc(r.j.period.from.slice(0, 10))} to ${esc(r.j.period.to.slice(0, 10))}: ${num(r.j.sessions)} sessions, ${num(r.j.requests)} requests. Priced with prices.json from ${esc(r.j.prices_checked || '')}.</p>`;
    html += '<div class="stats">' + (est
      ? [[num(r.chats), 'chats'], [r.tokens >= 1e6 ? (r.tokens / 1e6).toFixed(1) + 'M' : num(r.tokens), 'tokens of history'], [usd(r.tot.total), 'at API prices'], [pct(100 * r.tot.read / r.tot.total), 'was re-reading']]
      : [[num(r.j.sessions), 'sessions'], [usd(r.tot.total), 'at API prices'], [pct(100 * r.tot.read / r.tot.total), 'was cache reads'], [pct(100 * (r.tot.read + r.tot.write) / r.tot.total), 'was the cache']]
    ).map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('') + '</div>';
    html += `<p class="eyebrow">Where it went · module 1</p><div class="stack">${T.stackHTML(r.tot)}</div><div class="legend">${T.legendHTML(r.tot)}</div>`;
    if (top) {
      html += `<div class="headline">${T.cue(false, 'Your biggest tax')}<span class="n">${pct(share)}</span><p><b>${esc(top.name)}</b>: about ${usd(top.cost)} of ${usd(r.tot.total)} ${tag(b)}. ${esc(top.fix)}</p></div>`;
      html += '<p class="eyebrow">Your taxes, biggest first</p><div class="taxes">' + taxes.map(t =>
        `<div class="tax${t === top ? ' lead' : ''}"><h3><a href="#m${t.id}">${esc(t.name)}</a></h3><span class="v">${usd(t.cost)} ${tag(b)}</span><div class="bar"><i style="width:${(100 * t.cost / max).toFixed(1)}%"></i></div><p>${esc(t.what)}</p></div>`).join('') + '</div>';
    } else html += `<p class="tiny">${esc(r.tl.label)} keeps a total per session, not each request, so there are no tax scores for it. Totals and models are below.</p>`;
    if (est) {
      const top = r.byModel[AI.tiers[2]];
      html += '<p class="eyebrow">Same history on each model · module 6</p><div class="cards3">' + AI.tiers.map((k, i) =>
        `<div class="mcard${i === 0 ? ' cheap' : ''}"><h3>${AI.models[k].name}</h3><div class="tot">${usd(r.byModel[k])}</div><div class="meter"><i style="width:${(100 * r.byModel[k] / top).toFixed(1)}%"></i></div></div>`).join('') + '</div>';
      const topRows = r.rows.slice().sort((a, x) => x.cost - a.cost).slice(0, 10);
      html += '<p class="eyebrow">Your 10 most expensive chats</p>' + table(['Chat', 'Turns', 'History', 'Cost', 'Re-read'], topRows.map(x => [x.name, x.turns, num(x.hist), usd(x.cost), pct(100 * x.reread)]));
      const split = r.rows.filter(x => x.save > 0).sort((a, x) => x.save - a.save).slice(0, 10);
      if (split.length) html += `<p class="eyebrow">Chats that should have been split</p>` + table(['Chat', 'Turns', 'Saving if split every ' + SPLIT], split.map(x => [x.name, x.turns, usd(x.save)]));
      if (r.pasted.length) html += `<details><summary class="eyebrow">Images and files found in your messages (${num(r.pasted.length)})</summary>` + table(['Name', 'In chat', 'Kind', 'Tokens'], r.pasted.slice(0, 200).map(x => [x.name, x.chat || 'Untitled', x.kind, num(x.tokens) + (x.basis === 'guess' ? ' (guess)' : '')])) + '</details>';
    } else {
      const unsplit = r.j.by_tool ? Object.keys(r.j.by_tool).filter(k => !(r.j.by_tool[k].measured || ['by_source']).includes('by_source')) : [];
      if (r.j.by_source && r.j.by_source.length) html += sourcesHTML(r.j.by_source, r.tot.total, r.who, r.tl);
      else if (!unsplit.length) html += '<p class="tiny">For a split by tool, MCP server and skill, run <code>npx 100x-token-meter@latest</code> again and drop the new file.</p>';
      if (unsplit.length) html += `<p class="tiny">${esc(unsplit.map(k => (TOOLS[k] || { label: k }).label).join(' and '))} ${unsplit.length > 1 ? "don't" : "doesn't"} log what was in the context, so ${unsplit.length > 1 ? 'they have' : 'it has'} no split by source.</p>`;
    }
    if (!est && r.j.by_tool && Object.keys(r.j.by_tool).length > 1) {
      html += '<p class="eyebrow">By tool</p>' + table(['Tool', 'Sessions', 'Requests', 'Cost'], Object.entries(r.j.by_tool).sort((a, x) => x[1].cost - a[1].cost).map(([k, v]) => [(TOOLS[k] || { label: k }).label, num(v.sessions), num(v.requests), usd(v.cost)]));
    }
    if (!est && r.j.by_model) {
      html += '<p class="eyebrow">By model · module 6</p>' + table(['Model', 'Requests', 'Cost'], Object.entries(r.j.by_model).sort((a, x) => x[1].cost - a[1].cost).map(([k, v]) => [k + (v.local ? ' (on your machine)' : ''), num(v.requests), v.cost == null ? 'not priced' : usd(v.cost)]));
      if (r.j.local && r.j.local.requests) html += `<p class="tiny">Models on your machine bill nothing. Their cost here is what the same model costs hosted on OpenRouter, so you can compare. A model with no hosted match shows as not priced.</p>`;
    }
    out.innerHTML = html; out.hidden = false;
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

  /* ---------- demo: a made-up Claude app export, for showing the page without a real file ---------- */
  /* Deterministic (seeded) so the demo looks the same every time it is shown. 14 chats over a month: a few long ones,
     some pasted screenshots and files, two chats resumed the next day. Shaped exactly like the export reader expects. */
  function demoExport() {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const words = n => Array.from({ length: n }, (_, i) => ['the', 'plan', 'customer', 'draft', 'revenue', 'and', 'then', 'check', 'table', 'for', 'launch', 'week', 'email', 'summary', 'again'][(i * 7 + Math.floor(rnd() * 15)) % 15]).join(' ');
    const chats = [
      ['Launch plan for the webinar', 34, 0.3, 2, 1, true], ['Rewrite the pricing page', 9, 0.1, 0, 1, false], ['Debug the signup form', 27, 0.4, 5, 0, true],
      ['Q3 board deck outline', 18, 0.2, 1, 2, false], ['Cold email variants', 6, 0, 0, 0, false], ['Summarise customer calls', 12, 0.1, 0, 3, false],
      ['Hiring rubric for designers', 8, 0, 0, 0, false], ['Fix the invoice export', 22, 0.5, 4, 1, true], ['Trip to Jaipur', 5, 0, 1, 0, false],
      ['SQL for churn by plan', 15, 0.3, 2, 0, false], ['Rename the product', 11, 0, 0, 0, false], ['Terms of service review', 7, 0.1, 0, 1, false],
      ['Weekly metrics writeup', 25, 0.2, 3, 1, false], ['Onboarding emails', 10, 0, 0, 0, false]
    ];
    const t0 = Date.UTC(2026, 8, 20, 9, 0);
    return chats.map(([name, turns, longness, imgs, files, resumed], ci) => {
      const start = t0 + ci * 2 * 86400000 + Math.floor(rnd() * 8) * 3600000, msgs = [];
      let at = start, imgLeft = imgs, fileLeft = files;
      for (let k = 0; k < turns; k++) {
        if (resumed && k === Math.floor(turns * 0.6)) at += 26 * 3600000; else at += (3 + Math.floor(rnd() * 6)) * 60000;
        const u = { uuid: `u${ci}-${k}`, sender: 'human', text: words(20 + Math.floor(rnd() * 60)), created_at: new Date(at).toISOString(), attachments: [], files: [] };
        if (imgLeft && rnd() < 0.5) { imgLeft--; u.files.push({ file_name: `Screenshot ${k + 1}.png`, file_kind: 'image' }); }
        if (fileLeft && rnd() < 0.4) { fileLeft--; u.attachments.push({ file_name: ['brief.pdf', 'calls.docx', 'metrics.xlsx'][fileLeft % 3], extracted_content: words(900 + Math.floor(rnd() * 1500)) }); }
        msgs.push(u);
        at += 40000;
        msgs.push({ uuid: `a${ci}-${k}`, sender: 'assistant', text: words(120 + Math.floor(rnd() * 400 * (1 + longness))), created_at: new Date(at).toISOString() });
      }
      return { uuid: 'c' + ci, name, created_at: new Date(start).toISOString(), chat_messages: msgs };
    });
  }
  /* a made-up token-meter.json for the chosen AI's coding agent, shaped like the CLI's version 3 output.
     Each tool gets its own tool names and memory file; the shares are the same so the demos compare */
  const DEMO_TOOLS = {
    'claude-code': [['tool', 'Bash'], ['tool', 'Read'], ['tool', 'Edit'], ['tool', 'Write'], ['tool', 'Grep'], ['setup', 'System prompt, CLAUDE.md and tool definitions'], ['skill', 'Skill list, loaded every session'], ['skill', 'frontend-design']],
    codex: [['tool', 'exec'], ['tool', 'shell'], ['tool', 'apply_patch'], ['tool', 'update_plan'], ['tool', 'view_image'], ['setup', 'System prompt and tool definitions'], ['setup', 'AGENTS.md and environment'], ['setup', 'Instructions Codex adds']],
    'gemini-cli': [['tool', 'run_shell_command'], ['tool', 'read_file'], ['tool', 'replace'], ['tool', 'write_file'], ['tool', 'search_file_content'], ['setup', 'System prompt, GEMINI.md and tool definitions'], ['tool', 'google_web_search'], ['tool', 'list_directory']]
  };
  function demoCode() {
    const AI = T.AI(), source = toolOf(T.prov()) || 'claude-code', n = DEMO_TOOLS[source];
    const src = [
      ['agent', 'Subagents', 48.2, 0, 61], [...n[0], 31.4, 0, 820], [...n[1], 14.9, 0, 410], [...n[2], 6.2, 0, 230], [...n[3], 4.1, 0, 38], [...n[4], 2.7, 0, 160],
      [...n[5], 17.6, 0, 0], ['setup', 'Tool list', 6.3, 0, 0],
      ['mcp', 'playwright', 9.8, 0, 140], ['mcp', 'github', 3.1, 0, 52], ['mcp', 'Server instructions, loaded every session', 2.4, 0, 0], ['mcp', 'notion', 0.6, 0, 6],
      [...n[6], 3.2, 0, n[6][0] === 'tool' ? 40 : 0], [...n[7], 1.4, 0, n[7][0] === 'setup' ? 0 : 4],
      ['replies', 'Replies', 5.3, 0, 0], ['prompts', 'Your prompts', 1.2, 0, 0], ['notes', "The tool's own notes", 2.1, 0, 0]
    ].map(([kind, name, cost, tokens, calls]) => ({ kind, name, cost, tokens, calls }));
    const total = src.reduce((a, x) => a + x.cost, 0), id = k => AI.models[k].id || k, [s, m, t] = AI.tiers;
    const cost = { cache_read: total * 0.58, cache_write: AI.cache.write_premium ? total * 0.27 : 0, output: total * 0.12, input: total * (AI.cache.write_premium ? 0.03 : 0.30), total };
    return { tool: 'token-meter', version: 3, source, provider: T.prov(), prices_checked: T.PR().checked, period: { days: 30, from: '2026-09-25T09:00:00.000Z', to: '2026-10-24T18:00:00.000Z' },
      sessions: 46, requests: 2380, totals: { cost }, by_source: src.sort((a, b) => b.cost - a.cost),
      by_model: { [id(m)]: { requests: 2010, cost: total * 0.71 }, [id(t)]: { requests: 260, cost: total * 0.26 }, [id(s)]: { requests: 110, cost: total * 0.03 } },
      taxes: { noisy_output: { count: 74, cost: 21.5 }, screenshots: { count: 31, tokens: 48000, cost: 3.9 }, startup: { sessions: 46, avg_first_write: 21400, cost: 23.9 }, cache_breaks: { count: 12, cost: 6.8 }, one_model: { count: 9, cost: 1.7 } } };
  }
  /* the Claude app import is Claude's own; the CLI path names the chosen AI's coding agent */
  T.onProvider = () => {
    const isClaude = T.prov() === 'anthropic', tl = TOOLS[toolOf(T.prov())];
    $('#b-path').hidden = !isClaude; $('#demo-btn').hidden = !isClaude;
    $('#paths').classList.toggle('one', !isClaude);
    $('#a-name').textContent = tl.label; $('#demo-a-name').textContent = tl.label;
    if (last && last.kind === 'B' && !isClaude) { last = null; $('#you-out').hidden = true; $('#you-out').innerHTML = ''; }
  };
  T.onProvider();
  $('#demo-a-btn').onclick = () => {
    err('');
    try { const j = demoCode(); last = { kind: 'A', data: j }; render(analyseA(j)); T.track('import_completed', { source: 'demo_code' }); document.querySelector('#steps a.you').classList.add('done'); }
    catch (e) { err(e.message); }
  };
  $('#demo-btn').onclick = () => {
    err('');
    try { const chats = demoExport(); last = { kind: 'B', data: chats }; render(analyseB(chats, T.model())); T.track('import_completed', { source: 'demo' }); document.querySelector('#steps a.you').classList.add('done'); }
    catch (e) { err(e.message); }
  };
  [['B', '#b-drop', '#b-file'], ['A', '#a-drop', '#a-file']].forEach(([k, z, f]) => {
    const zone = $(z);
    $(f).addEventListener('change', e => take(k, e.target.files[0], zone));
    T.dropTarget(zone, files => take(k, files[0], zone));
  });
})();
