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
