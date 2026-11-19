# Retrieval Bench: build notes (20 Nov 2026)

Plan: Claude Doc "Retrieval Bench: build plan" (https://claude.ai/artifact/SFn1KKgmUwmTePvtijFfVt). Built with the plan's leans: first cut for the applied session and the practice set; question embedded in the browser; guess before each run; path below.

## Files
- `c8/module-2/lecture-13-retrieval-augmented-generation/bench.html`, `assets/bench.js`, `assets/bench.css` (copy of the L11 file, sheet renamed pile), `assets/retrieval.css` (scoreboard, meter, pile view), `assets/pile.json` (built).
- `api/retrieve.mjs`: ops key, lecture, words, nearest, chat (one tool allowed), loop (search_notes). A copy of the toolcall.mjs patterns, not a change to it: the live L11 route is untouched.
- `api/_pile.mjs`: built, 183 passages with 384 numbers each.
- `_plan/lecture-13/build_pile.py` (+ `embed.mjs`, `package.json`; run `npm i` here once). `standin.mjs` fakes Groq for page tests.

## Decisions made while building
- **Model: Xenova/gte-small, not all-MiniLM-L6-v2.** MiniLM put "Why models hallucinate" (L10) at rank 17 for Q3; gte-small puts it first, keeps the Q4 trap first, and needs no hidden query prefix (bge and arctic do). Browser vs script numbers agree (cosine 0.997). Browser load ~34 MB, ~12 s first time.
- **Chunks are passages of up to 170 words** cut at block boundaries inside each section, because the small model reads only the first ~256 word pieces. Nothing (title, lecture) is added to a passage before embedding.
- **Keyword search is exact-phrase, case-insensitive** (Ctrl+F over every passage, most mentions first). That is what makes "making things up" return zero.
- **Scoreboard is marked by visible regex rules** (RULES in bench.js), never by a model.
- **The map uses PCA, one scale for both axes.** It keeps ~11% of the spread, and the page says so. Lines and scores come from all 384 numbers.

## Real-model results (GPT-OSS-120B on Groq, free key)
- Bare: Q1 asks which course; Q2 invents MIT 6.821; Q4 invents a refund table; Q5 says $100. All red.
- Q1 with get_lecture: calls get_lecture(6), answers databases (2,892 tokens in).
- Q2 with words "Verifier's Law": Lecture 1. Q3 with nearest 3: cites Lecture 10.
- Q4 with nearest 3 (L1 Rolls-Royce refund first, 0.83): presented as "the cohort's refund policy" 3/3. With the honest line: "not in the notes" 2/2.
- Q5 loop: search "verification by judgment" then "refund", answers 7.5 crore / a million dollars, every run. Three rounds use ~8.5k tokens, over a free key's 8k a minute, so the loop waits the seconds Groq names (up to 15 s, twice) and says so on the wire.
- All twelve pasted: 413 "Limit 8000, Requested 31131". The pile is 29,982 tokens by o200k_base.

## Not built yet (plan steps 6 and 7)
Card sort (cards and their numbers are already in pile.json), chunk-size switch, both searches side by side, tomorrow's levels as stations, bring your own pile, the shared kit. Also: overview/notes pages, map link, analytics check.

## Test locally
    node _plan/lecture-13/standin.mjs 8799 &
    GROQ_URL=http://127.0.0.1:8799/chat GROQ_MODELS_URL=http://127.0.0.1:8799/models python3 _plan/serve.py 8771
Then open /c8/module-2/lecture-13-retrieval-augmented-generation/bench with any fake gsk_ key.
