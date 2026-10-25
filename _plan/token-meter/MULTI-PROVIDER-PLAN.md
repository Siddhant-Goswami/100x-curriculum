# Token Meter: model-agnostic plan

Written 25 Oct 2026. Status: phase 0, phase 1 and the CLI part of phase 2 built on 25 Oct, plus OpenCode, Hermes Agent and open-model prices (phase 3, hosted part; see NOTES.md). The ChatGPT export import is next.

Goal: the same six lessons and the "Your sessions" import, for any LLM. We get there in phases: first the top three
providers (Anthropic, OpenAI, Google), then open-weight models, then a generic path for anything else.

## What is Anthropic-only today

| Place | What's hard-wired |
|---|---|
| prices.json | One provider. Model keys `haiku/sonnet/opus/fable`; cache write premium; 5 min / 60 min cache lifetime |
| meter.js `simulate` | Cache write priced above input (true for Anthropic only) |
| meter.js module 3 | Image formula: 28 px squares, long edge capped at 2,576 px |
| meter.js "Count exactly" | Anthropic SDK, `sk-ant-` check, `claude-sonnet-5-5` |
| meter.js module 6, import.js | The lists `['haiku','sonnet','opus']` |
| index.html, meter.js, import.js | "Claude" in about 40 strings; basis tag says "Anthropic" |
| import.js B | Claude app export (`conversations.json`, `chat_messages`) |
| CLI (token-meter.mjs) | Reads `~/.claude/projects/*.jsonl`; `family()` knows only Claude names; Claude Code's own block types |

## How the three providers differ (the parts that change the maths)

Prices and limits to be checked on each provider's pricing page on the day we build; these are the shapes, not the numbers.

| | Anthropic | OpenAI | Google (Gemini) |
|---|---|---|---|
| Caching | You mark it. Write costs more than input, read about 10% | Automatic past ~1K tokens. No write fee, cached input is discounted | Implicit (automatic, discounted read) or explicit (you create it, pay storage per hour) |
| Cache lifetime | 5 min API, 1 h option | Minutes when idle, longer retention option | Implicit: provider decides. Explicit: you set the TTL |
| "Restart fee" means | Rewrite history at write price | History billed at full input price again | Same as OpenAI for implicit |
| Images | 28 px squares | Tiles (fixed base + per tile) or patches, by model | Fixed count per small image, tiles for larger |
| Exact counts | `count_tokens`, needs a key | Tokenizer is public: count in the browser, **no key** | `countTokens`, needs a key |
| Hidden thinking | Billed as output | Reasoning tokens billed as output | Thinking tokens billed as output |
| Long prompts | Haiku tier over 100K | Varies by model | Pro tier over 200K |
| Coding-agent logs | Claude Code JSONL | Codex CLI session JSONL (has token counts) | Gemini CLI session files |
| Chat app export | Settings › Export data | Settings › Data controls › Export (`conversations.json`, tree of messages) | Google Takeout › Gemini Apps activity (prompts, weak on answers) |

The lessons survive the switch. Module 1 (re-reading history) and module 5 (the restart fee) get smaller numbers on
OpenAI and Gemini because there is no write premium, and that contrast is itself worth showing.

## Phase 0: make the core provider-agnostic (no visible change)

1. **prices.json v2**: a `providers` map. Each provider carries its own facts so code reads them instead of assuming:
   ```json
   "openai": {
     "name": "OpenAI", "assistant": "ChatGPT", "source": "<pricing url>", "checked": "2026-10-xx",
     "cache": { "write_premium": false, "min_tokens": 1024, "ttl_minutes": { "api": 5, "app": 60 } },
     "image": { "scheme": "tiles", "tile": 512, "base": 85, "per_tile": 170 },
     "count": { "kind": "tokenizer", "encoding": "o200k_base" },
     "tiers": { "small": "<id>", "mid": "<id>", "top": "<id>" },
     "models": { "<id>": { "name": "...", "input": 0, "output": 0, "cache_read": 0, "cache_write": null, "long_prompt": null } }
   }
   ```
   `cache_write: null` means "same as input". Anthropic moves in unchanged.
2. **One `provider` object** in meter.js (`AI`), read everywhere: `AI.assistant` for copy, `AI.tiers` for module 6,
   `AI.image(w, h)` for module 3, `AI.count(texts)` for "Count exactly".
3. **simulate**: price writes with `p.cache_write ?? p.input`; skip caching below `cache.min_tokens`.
4. **Copy**: static "Claude" in index.html becomes `<span data-ai>Claude</span>`, filled on provider change.
   Basis tag "Anthropic" becomes the provider's name.
5. **Done when**: the page shows the same numbers as today on every module (snapshot the headline numbers before and after).

## Phase 1: OpenAI and Google on the six modules

1. A "Which AI do you use?" screen before module 1, plus a provider picker in the header. Model list follows it. Remembered in localStorage.
2. Price entries for the current OpenAI and Gemini lineups, checked on their pricing pages that day.
3. Module 3: provider image formulas, with the cap and grid drawn to match (tiles show as larger squares).
4. Module 4 and "Count exactly":
   - OpenAI: bring your own key, browser calls `/v1/responses/input_tokens`. (OpenAI doesn't name the GPT-6 tokenizer, so a local tokenizer was dropped.)
   - Gemini: bring your own key, browser calls `generativelanguage.googleapis.com` `countTokens` directly. Same rules as today: key in memory, never sent to us.
5. Module 5: copy changes per provider ("pays full price again" instead of "writes again"); the shop analogy still fits.
6. Module 6: three cards from `AI.tiers`. Optional "compare across providers" toggle: one task, cheapest model from each.
7. New small lesson worth adding later, not in this phase: hidden thinking tokens (all three bill them as output).
8. **Done when**: each module gives a sensible number on each provider, and every number's basis tag names the right source.

## Phase 2: other people's histories

1. **Page import**: ChatGPT export zip (walk the `mapping` tree, take the current branch). Gemini Takeout import only if
   the export holds answers; otherwise show prompts-only with a clear "estimate" note.
2. **CLI 0.3.0**: one adapter per tool, auto-detected, `--tool claude|codex|gemini` to force:
   - Claude Code: today's reader, unchanged.
   - Codex CLI: `~/.codex/sessions/**/*.jsonl`, token counts from its token-count events (input, cached input, output, reasoning).
   - Gemini CLI: `~/.gemini/tmp/*/chats/*.json`, per-message token fields.
   Output `token-meter.json` version 3 adds `provider` and `tool`; `by_source` kinds stay the same so the page needn't change.
   Taxes that don't apply (e.g. "startup" write premium) report `null`, and the page hides them.
3. **Done when**: a real log from each tool runs end to end. Field names checked against real files first, as we did for Claude Code.

## Phase 3: open-weight models

See the list below. Build order: hosted open models (just prices), then exact tokenizers, then local mode.

## Phase 4: anything else

1. "Your own price card": a small form (input, output, cached input) that adds a custom model for the session.
2. Generic import: any JSONL of OpenAI-style `usage` objects (most gateways, LiteLLM and OpenRouter logs fit this).
3. Optional: read prices from OpenRouter's public models endpoint so the list stays current without hand edits.

## Open-source models: how they can use Token Meter

**1. Hosted open models, paid per token** (DeepSeek's API, Groq, Together, Fireworks, DeepInfra, Cerebras, OpenRouter)
- Fit today's maths exactly: a price entry per model and the lessons hold.
- Several offer cache-hit pricing (DeepSeek, some Fireworks and Together models); others have none, so module 1 shows
  the full re-read cost, a strong contrast.
- They return OpenAI-style `usage`, so the generic import (phase 4) covers their logs.

**2. Run on your own machine or GPU** (Ollama, llama.cpp, LM Studio, vLLM, SGLang, MLX)
- No per-token bill. Switch the unit from money to **time** (seconds of waiting) and, optionally, **GPU hours** (you enter your rate).
- Re-reading still costs: it's prefill time. Prefix caching (vLLM, SGLang, llama.cpp's prompt cache, Ollama's keep-alive)
  is the local version of the cache; unloading the model is the local restart fee.
- Ollama and llama.cpp report prompt and output token counts and durations per call, so we can measure the visitor's own speed.
- Small context windows add a lesson the APIs hide: past the limit, old history is cut, not charged.

**3. Exact token counts without a key**
- Open models publish their tokenizers. `transformers.js` loads them in the browser (Llama, Qwen, Mistral, DeepSeek, Gemma),
  so "Count exactly" works offline for all of them, the same way as OpenAI's.
- Module 4 gets a new angle: the same JSON costs different token counts on different tokenizers.

**4. Images on open vision models**
- Each family has its own patch scheme (Qwen-VL, Llama Vision, Gemma, Pixtral). One `image` entry per family in prices.json; module 3 already draws a grid.

**5. Coding agents that run open models** (OpenCode, Aider, Cline, Roo, Continue, Goose)
- Each keeps its own logs; some store tokens and cost per message. Add CLI adapters for the most-used two after phase 2,
  or point people at the generic usage import.

**6. Choosing the right size (module 6)**
- Cards become "small / mid / large" open models (e.g. 8B / 32B / 70B+) with hosted prices, or with tokens per second on local hardware.

## Decisions (confirmed 25 Oct)

1. Top three = Anthropic, OpenAI, Google.
2. One provider picker for the whole page. The visitor picks it first, on a screen before module 1. Comparing providers comes later.
3. Copy says the assistant's name (Claude / ChatGPT / Gemini).
4. The CLI keeps its npm name `100x-token-meter` and gains readers for Codex CLI and Gemini CLI.
