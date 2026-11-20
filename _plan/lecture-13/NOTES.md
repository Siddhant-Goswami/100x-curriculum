# Retrieval Bench: build notes (20 Nov 2026)

Plan: Claude Doc "Retrieval Bench: build plan" (https://claude.ai/artifact/SFn1KKgmUwmTePvtijFfVt). Built with the plan's leans: first cut for the applied session and the practice set; question embedded in the browser; guess before each run; path below.

## Files
- `c8/module-2/lecture-13-retrieval-augmented-generation/bench.html`, `assets/bench.js`, `assets/bench.css` (copy of the L11 file, sheet renamed pile), `assets/retrieval.css` (scoreboard, meter, pile view), `assets/pile.json` (built).
- `api/retrieve.mjs`: ops key, lecture, words, nearest, chat (one tool allowed), loop (search_notes). A copy of the toolcall.mjs patterns, not a change to it: the live L11 route is untouched.
- `api/_pile.mjs`: built, 183 passages with 384 numbers each.
- `_plan/lecture-13/build_pile.py` (+ `embed.mjs`, `package.json`; run `npm i` here once). `standin.mjs` fakes Groq for page tests.

## Questions changed 20 Nov 2026
The user asked that the old Lecture 1 car example (Q4 trap and Q5 path) not be used anywhere in the Lecture 13 series, nor the word for it. Q4 is now the fee (not in the notes; the trap is Groq's free tier), Q5 the Zapier path (L11 points to L10's runs; the fix is in L10). The pile's passages are unchanged; only the questions and their numbers were rebuilt. The pile still carries the L1, L5 and L9 notes as written, which mention the Lecture 1 example; no bench step surfaces them (checked Q2 top 10, Q3 and Q4 nearest 10).

## Decisions made while building
- **Model: Xenova/gte-small, not all-MiniLM-L6-v2.** MiniLM put "Why models hallucinate" (L10) at rank 17 for Q3; gte-small puts it first, keeps the Q4 trap first, and needs no hidden query prefix (bge and arctic do). Browser vs script numbers agree (cosine 0.997). Browser load ~34 MB, ~12 s first time.
- **Chunks are passages of up to 170 words** cut at block boundaries inside each section, because the small model reads only the first ~256 word pieces. Nothing (title, lecture) is added to a passage before embedding.
- **Keyword search is exact-phrase, case-insensitive** (Ctrl+F over every passage, most mentions first). That is what makes "making things up" return zero.
- **Scoreboard is marked by visible regex rules** (RULES in bench.js), never by a model.
- **The map uses PCA, one scale for both axes.** It keeps ~11% of the spread, and the page says so. Lines and scores come from all 384 numbers.

## Real-model results (GPT-OSS-120B on Groq, free key)
- Bare: Q1 asks which course; Q2 invents MIT 6.821; Q4 asks which programme; Q5 invents its own list of builders. All red.
- Q1 with get_lecture: calls get_lecture(6), answers databases (2,892 tokens in).
- Q2 with words "Verifier's Law": Lecture 1. Q3 with nearest 3: cites Lecture 10.
- Q4 "What is the fee for this cohort?" with nearest 3 (L9 "The deterministic answer already existed" 0.83, L5 "Free Is a Design Decision", L2 summit map): "The cohort is free", read off Groq's free tier, 3/3. With the honest line: "the notes do not provide the fee" 3/3.
- Q5 loop: the first wording ("...which real UI builders were added to close the gap?") passed 5/5 on the command line but 1/5 on production: the model took "Bubble, Webflow" from the L10 runs table as the answer. The shipped wording says the fix added three: "Lecture 11 says the model 'still named Zapier'. In the lecture with the runs, the fix added three real UI builders to the data. Which three?" 12/12 runs, 2 to 4 searches ("still named Zapier", then "UI builders"), 1.7k to 3.8k tokens, no rate-limit wait. Bare: names Bubble etc., fails.
- Loop limit raised from 4 to 6 rounds (cheap now). An earlier Q5 draft on the roadmap and the hackathon passed only 3 of 5, because exact-phrase searches for words not in the notes used up the rounds.
- All twelve pasted: 413 "Limit 8000, Requested 31131". The pile is 29,982 tokens by o200k_base.

## Not built yet (plan steps 6 and 7)
Card sort (cards and their numbers are already in pile.json), chunk-size switch, both searches side by side, tomorrow's levels as stations, bring your own pile, the shared kit. Also: overview/notes pages, map link, analytics check.

## Test locally
    node _plan/lecture-13/standin.mjs 8799 &
    GROQ_URL=http://127.0.0.1:8799/chat GROQ_MODELS_URL=http://127.0.0.1:8799/models python3 _plan/serve.py 8771
Then open /c8/module-2/lecture-13-retrieval-augmented-generation/bench with any fake gsk_ key.

## UX pass (20 Nov 2026, after a student walkthrough)
- Layout: the action panel sits right under the headline. Scoreboard (five compact pills), the bench diagram and the wire share the right-hand rail (`.rail`, sticky on laptops; below the action on a phone).
- Seven stations: station 5 split into By its meaning (Q3, top-k slider after the nearest come back) and Nearest is not right (Q4, fixed nearest 3 = the tested trap; the honest-line switch appears only after the first answer). Q5 is station 7, "Let it search" (old name "Search twice" gave the guess away; the Q5 rule now says "one search leads to the next").
- localStorage moved to v2; `migrate()` maps old six-station progress.
- Wire: station 1 is one line per question (`trip()`); JSON never opens by itself; Groq refusals and rate limits come from a "Groq" node, not the model.
- Every guess is answered ("You guessed X. Right." / "It was Y."); guess chips stay put after a tap.
- RAG is named at station 2 (matches the notes s01); embedding and top-k at station 5; "the Lecture 12 move" (matches the notes).
- Station 3: "Lecture 1 only" label, price folded into a details row, and the "Lucky: Verifier's Law is in Lecture 1" line.
- Station 4: `api/retrieve.mjs` words() now returns `lectures` (distinct lectures over all matches), so the bench says "24 passages, in 6 lectures", same as the notes.
- Map: the flat-picture warning sits above the map once a question is placed; lecture labels nudged apart.
- End screen: the ladder recap (Q1 to Q5 and rule zero), "Fill your design card" (notes#s09), "Save the wire as a text file", and the optional own question (moved here from station 5; loading status is neutral, not red).
- Notes: the six-situations and usual-boxes tables are folded into details; s09 has "Copy a blank card".
- Asset links carry ?v=N; bump it when bench.js/css change.

## Q4 replaced again (20 Nov 2026): no cohort pricing or refunds
The user ruled out the cohort fee (and any 100x pricing or refund example): sensitive, it changes, and it pulls attention away from the lesson. Q4 is now "Which lecture shows how to put our app on the App Store?" (App Store appears nowhere in the pile). Nearest 3 by meaning: L7 "The lecture in one line" 0.82 (the function moves to a rented machine, behind a URL), L4 "How These Notes Are Organised" 0.811, L8 "The lecture in one line" 0.811. The intended trap: the model answers "Lecture 7", read off the deploy passage. Only pile.json's Q4 entry was patched (text, 384 numbers, map x/y); passages unchanged. The Q4 rule also accepts "none of the passages ... mention/cover/show" and "no lecture".
**Not yet checked on the real model.** Run `GROQ_API_KEY=... node _plan/lecture-13/check_q4.mjs` (or put the key in .env.local): want line off 0 of 3 passing, line on 3 of 3. If the line-off runs already pass (the model refuses without being told), Q4 needs a sharper decoy; the notes s05 says "it can answer anyway: Lecture 7" until then.
