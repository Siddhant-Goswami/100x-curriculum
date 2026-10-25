# Token Meter: build notes

Spec: "Token Meter one-pager spec.md" (25 Oct 2026). Live route: /token-meter (not deployed yet).

## Where things are
- token-meter/index.html, meter.css, meter.js: modules 1 to 6, routing, result card
- token-meter/import.js: Your sessions. B = Claude app export zip (JSZip 3.10.1 from cdnjs), A = token-meter.json
- token-meter/prices.json: the page's price file. The CLI repo has a copy; keep them the same
- CLI: its own repo, github.com/Siddhant-Goswami/token-meter (local: ~/projects/100x/token-meter), published to npm as `100x-token-meter` (npm refused `token-meter` and `token-meter-cli` as matching `tokenmeter` and `tokenmeter-cli` with dashes removed).
  It carries its own copy of prices.json: when prices change, update both, bump the version and `npm publish`
- "Count exactly" (modules 3, 4): bring your own key. The visitor pastes their Anthropic API key; the browser calls countTokens on
  api.anthropic.com directly with the official SDK (jsDelivr ESM, @anthropic-ai/sdk 0.133.0, dangerouslyAllowBrowser). No server route, no key of ours.
  Key kept in memory, or sessionStorage if they tick the box. A Claude subscription can't be connected: Anthropic has no sign-in for third-party apps.
- analytics.js: `token-meter` entry, eventsOnly (no autocapture, no replays, no page leaves). Shared PostHog key and project by choice (25 Oct)

## Decisions made while building
- Prices checked against platform.claude.com/docs/en/about-claude/pricing on 25 Oct 2026. Deck values were right.
  The two [check] cells: Haiku 5.5 cache write 0.125 (5 min) / 0.20 (1 h); Opus 5.5 cache write 5 / 8.
  Haiku 5.5 charges more for prompts over 100K tokens; prices.json has that tier and the simulator uses it.
  Fable 5.1 added for the CLI, which meets it in real logs.
- Cost model: the cache breakpoint sits before the newest message. Turn n reads the history up to two turns back, writes the last exchange,
  pays input on the new message and output on the answer. One simulator (simulate in meter.js) serves modules 1, 2 and import B.
- Modules 1 and 2 hit their "done when" targets only with a large starting context, so module 1 has a third control,
  "Already in the chat before turn 1" (25K / 100K / 200K), defaulting to 100K. With a plain 25K chat, module 1 shows 77% but module 2 shows 19%.
- CLI: none of the three listed tools emits the tax signals, so it reads the JSONL itself (deduplicated by requestId).
  The one-model rule counts short Opus jobs (10 requests or fewer, none writing 300+ tokens). Counting every short Opus request
  flagged 60% of agent steps and showed $111 of $311.
- Import B assumes: 25K tokens of system prompt per chat, 1-hour cache, 1,600 tokens per pasted image, 3,000 per file without extracted text.

## Still open
- [ ] Real claude.ai export: confirm conversations.json fields (reader expects chat_messages, sender, text, content, created_at, attachments, files)
- [x] Claude Code JSONL fields: checked 25 Oct. usage has cache_creation.ephemeral_5m/1h; images are base64 blocks in user content and inside tool_result
- [ ] Launch date, and CTA target (footer link points to 100xengineers.com for now)
- [ ] Check chars ÷ 3.5 against 20 count_tokens results before launch

## Teaching redesign (25 Oct, after the UI review)
- Two panes from 1000px: controls left, picture + big number right, body 18px, headline number 84px. One column below that.
- Two colours carry every lesson: grey = old history (cache read + write), coral = new words (input + output). The four-way split is under "Show the maths".
- M1: "Play the chat" animates the bubble stack and per-message columns; defaults 5 messages, plain 25K chat. M2: two transcripts, answer bubbles shrink.
  M3: number tweens, "down from N" when cropped, crop button is the coral one. M4: punctuation/indent highlighted in both panes (pre behind a transparent textarea), 5-row JSON sample.
  M5: shop ticket + stamps, 3 messages pre-played, "Come back tomorrow". M6: cost scale with three dots, Once / 1,000 times toggle.
  Your sessions: "Load a demo history" (demoExport in import.js, seeded, 14 chats).
- One basis tag per module, on the big number. "Count exactly" sits under "Check with Claude". Pager: Make my card is ghost, Next is dark.
- M1 (25 Oct, later): the chat stack shows a short sample chat (SAMPLE in meter.js, a Goa trip): You bubbles right, Claude left, each named.
  Two zones: "Read again" (hatched setup block + old turns, earlier ones folded into one grey block) and "New: message N" in coral, each with its token count.
  Per-message chart has a currency y-axis, message numbers, a written key, and a note when message 1 runs off the top.
- M2 uses the same stack (chatStackHTML in meter.js) on both sides; the shorter side cuts Claude's sample answers to that share of their words.
- Your sessions, Claude Code (25 Oct): CLI 0.2.0 writes by_source (kind: setup, prompts, replies, tool, mcp, skill, agent, notes; name, cost, tokens, calls).
  Each request's real cost is shared over its context by estimated size, so the split sums to the real total. Skill content = isMeta text after a Skill call
  or a non-built-in slash command; skill_listing and mcp_instructions_delta attachments get their own lines. Page: sourcesHTML in import.js, grouped and
  expandable; "Demo: Claude Code" loads demoCode(). Older (version 1) files show a line asking for npx 100x-token-meter@latest.

## Three providers (25 Oct, phases 0 and 1 of MULTI-PROVIDER-PLAN.md)
- The page opens on "Which AI do you use?" (#start) until a provider is picked; it is saved in localStorage tm:prov. Header has a provider select next to the model select.
- prices.json version 2: providers.anthropic / openai / google, each with assistant name, cache rules (write_premium, ttl_minutes, lifetime), image rule,
  count (kind, model, key prefix), tiers (small, mid, top) and default. Missing cache_write = input price. `next` = an announced price change, used from its date.
- Prices checked 25 Oct on developers.openai.com/api/docs/pricing and ai.google.dev/gemini-api/docs/pricing.
  OpenAI: GPT-6 Luna / GPT-6.1 Sol / GPT-6 Astra; writes cost 1.25× input (30 min) or 2.5× (12 h) on GPT-5.6 and later; over 272K is dearer.
  Google: Gemini 3.5 Flash-Lite / 3.8 Flash / 4 Argon; implicit cache only, no write fee, lifetime not published (5 min assumed).
  Argon doubles on 1 Dec 2026, 3.8 Flash and 3.6 Flash double on 1 Jan 2027 (in prices.json as next).
- Module 3: OpenAI = 32 px squares × 1.2 at the image's own size (detail auto), over 30,000 squares refused. Gemini = flat per image by detail
  level (280 / 560 / 1,120 default / 2,240): the module swaps the shrink slider for a detail picker and says cropping doesn't change the count.
- Count exactly: OpenAI POST /v1/responses/input_tokens, Google countTokens, both with fetch and the visitor's own key (sessionStorage tm:key:openai / tm:key:google).
  OpenAI's 401 has no CORS header, so a wrong key shows as a failed fetch; the page says "couldn't reach OpenAI, or it turned the key down".
  Not yet tried with a real OpenAI or Google key.
- Your sessions: the Claude app path shows only for Claude. The CLI path is named for the provider's agent (Claude Code, Codex CLI, Gemini CLI);
  the result follows the file's own source and provider, not the picker.
- CLI 0.3.0 (not published yet): readers for Claude Code, Codex CLI (~/.codex/sessions rollout JSONL: token_usage_record, turn_context.model;
  input_tokens includes cached and written) and Gemini CLI (~/.gemini/tmp/*/chats/session-*.json: tokens.input includes cached, thoughts billed as output).
  One engine prices all three. --tool claude|codex|gemini, default all. Output version 3 adds source, provider and by_tool.
  On this machine the Claude Code numbers match 0.2.0 exactly except startup (+0.15%: it now counts the first request's uncached input too).

## OpenCode, Hermes and open models (25 Oct, later)
- CLI 0.3.0 also reads OpenCode (~/.local/share/opencode/opencode.db: session_message.data per assistant message, falling back to session_v2 totals;
  older storage/message/<session>/*.json) and Hermes Agent (~/.hermes/state.db: session_model_usage, one row per session, model and route).
  Both are SQLite, read with node:sqlite (Node 22.13+); older Node skips them with a note. --tool opencode|hermes.
- Hermes keeps no per-request detail: its rows carry n requests each, count toward totals and by_model only; if no tool in the file has
  per-request logs, every tax is null. by_tool[x].measured lists what each tool had (totals, by_model, taxes, by_source). OpenCode has taxes, no by_source.
- prices.json gains providers.open (picker: false): OpenRouter prices for ~30 open models, checked 25 Oct from openrouter.ai/api/v1/models.
  Ollama tags map to the hosted model only where family and size match (aliases). A local run (Ollama, LM Studio, localhost) is priced as the hosted
  model, marked local in by_model, summed in top-level local. qwen3:8b has no hosted match, so it stays unpriced.
- Model lookup now also strips a router's vendor/ prefix (google/gemini-3.8-flash) and matches bare vendor ids (glm-5.3 → z-ai/glm-5.3).
- Page: the picker hides providers with picker: false; import.js knows opencode and hermes, hides null taxes with a line saying why, says which tools
  have no split by source, and labels local models "(on your machine)".
- Checked: Claude Code and Codex numbers unchanged on this machine; Hermes on real data (840 requests, 365 days); OpenCode only on made-up data,
  because the one real session failed on an expired OpenRouter key.

- 26 Oct: OpenCode dropped from the 0.3.0 release (CLI reader, --tool opencode, README, import.js), because its field names were only checked
  on made-up data. The reader is in commit 8b7dec0 of the CLI repo, ready to bring back.

## Still open (providers)
- [ ] OpenCode: bring the reader back from CLI commit 8b7dec0 after one real session confirms the per-message field names (tokens.input/output/reasoning/cache.read/write)
- [ ] Hermes: confirm input_tokens excludes cache reads when a hosted provider caches (all local rows so far have no cache)
- [ ] Try Count exactly with a real OpenAI key and a real Gemini key
- [ ] Publish CLI 0.3.0 (npm publish) and push the CLI repo
- [ ] Phase 2: ChatGPT app export import; Gemini app (Takeout) only if it holds answers
