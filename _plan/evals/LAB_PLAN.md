# Evals Lab: plan for the interactive session

Written 1 Nov 2026. Lives in `_plan`, which Vercel does not serve. Companion to `PLAN.md` (the L18 lecture plan).

Source material: Anthropic, *Demystifying evals for AI agents* (Jan 2026); the masterclass notes at `c8/module-2/ai-evals/notes`; the delegation framework's verify step (`c8/delegation-framework`, `api/verify.mjs`); Token Meter's module structure (`token-meter/`).

## 1. What it is

One page a student opens alone, works through in about 75 minutes, and leaves with an eval sheet they built by hand. No lecture, no notes to read first. Every concept in the Anthropic article becomes one thing the student does, on one running example, and the vocabulary is introduced only at the moment the student needs it.

The take-away is a habit, in the masterclass's words: read the traces, name each failure as a yes or no, write a rule where code can check, lock the rubric before you look, judge the judge, freeze the set, change one thing, run it three times.

Assumption: "write better emails" in the brief means "write better evals".

## 2. Where it lives and what it reuses

| Decision | Choice | Why |
|---|---|---|
| Path | `c8/evals-lab/index.html` (+ `lab.css`, `lab.js`, `data/traces.json`) | Standalone session, like `c8/delegation-framework`. Linked from the masterclass overview as "Lab" and later from the L18 stop on the map. Not on the map yet, same as the masterclass. |
| Shell | Token Meter's: numbered modules in a left rail, one module on screen, Back/Next, ★ final module, progress and answers kept in `localStorage`, "Show the maths" details | It is the sit-down-and-work shape, and state has to carry from module to module (the modes you named feed the checks you pick, which feed the rubric you lock). A scrolly story (delegation framework) is better for a talk than for a worksheet. |
| Look | `c8/docs.css` tokens + `c8/kit.css`/`kit.js`. Amber = rule, violet = judge, green = human, coral = now or the thing to find | Same three colours the students have seen since L9 and on the delegation framework, so "rule or judge" needs no new legend. |
| Running example | The online store's support agent, order 4821, already drawn in the notes (Tuesday for Thursday) | One product all the way through. Students have built exactly this shape in L8 (a route) and L10 (a tool). |
| Interaction patterns borrowed | Delegation framework: the amber/violet/green sort with a one-line reason, and "tap a run to score it". Token Meter: play animation, chip with "Change", computed totals, own-key-in-browser for the live call, export of what you built | Already tested on this audience. The delegation framework's verify step is the same question as grader choice: can a rule check it, or does it need criteria? |
| Live model | Student's own Groq key, kept in the tab like Token Meter's Anthropic key, calling `api.groq.com` from the browser. Canned verdicts as the fallback when there is no key | Every student has a Groq key since L5. No new serverless route, no shared key, no cost to us. The judge must be a real model for module 5 to land. |
| Data | `data/traces.json`, 30 traces built by `_plan/evals/build_traces.py`. Each row: input, tool calls with arguments and results, answer, state after, instructor's "first thing wrong", mode flags, hand label for the judged mode, canned judge verdict with quote, three-run results before and after the change, token counts | The same 30 traces seed the L18 template sheet (PLAN.md item 1), so this is not throwaway work. |

Pages stay concise: one short paragraph above each exercise, the article's explanation under "Why this matters", the vocabulary as a glossary card that fills in as words are earned.

## 3. The modules

Nine modules plus a start. Each one is one article concept, one interaction, one sentence the student can repeat. The second column is the Anthropic idea the module carries.

| # | Module | Article concept | What the student does | What appears when they do it |
|---|---|---|---|---|
| Start | **The grader that was wrong** | Read the transcripts; task, trial, transcript, outcome, grader | Reads one trace laid out as cards (question, tool result, answer). An LLM judge stamps PASS. The student taps the word that is wrong. | Tuesday lights up. "A judge is a model. You just did what it could not." The five words get their cards in the glossary, each pinned to the part of the trace it names. Second tap: "Your refund has been issued" next to a refunds table with no row. Outcome, not sentence. |
| 1 | **Read the traces** | Error analysis before graders; 20 to 50 tasks from real failures; the whole trace, not the answer | Ten traces, one at a time, with the log visible. For each: type one sentence, "the first thing wrong", or press dash. Then the remaining twenty show prefilled, skimmable. | After each sentence, the instructor's line appears beside it. A counter of dashes: "rows that pass are evidence too". Timer, optional, to make the point that thirty fits in an hour. |
| 2 | **Name the modes** | Unambiguous criteria; "two experts reach the same verdict"; binary over scale | Drags the thirty sentences into boxes, names each box as a yes-or-no question. A "stop when a new sentence fits" meter. Then a small demo: three graders score row 2 out of five (3, 4, 2) versus yes/yes/yes. | Saturation shown as the meter filling. Instructor's seven boxes as a reveal after the student has their own (criteria drift: build yours first). The student's box names persist. |
| 3 | **Pick the check** | Code graders where possible, model where necessary, humans judiciously; grade the outcome, constrain the path | For each of their modes, picks rule, judge or human, and for a rule, writes what it reads and what pass means. Same three-way sort as the delegation framework's verify step. | A column fills amber or violet. The instructor's table reveals: six of seven are rules. If a rule written in text is vague, the page says what a sheet formula would need to see (reuse `api/verify?step=check` here, optional). Side panel: "step-matching is brittle; the refund row, not the sequence of calls". |
| 4 | **Write it, lock it, run it** | LLM-as-judge; structured rubrics; one judge per dimension; the Unknown exit; reference-based over reference-free; calibration | Writes the judge prompt for the one judged mode from its name. Required shape: PASS, FAIL with a quote, UNKNOWN. A Lock button timestamps it and greys the editor. Then "Run the judge" on twenty rows with their Groq key (or canned). | The bad rubric ("accurate and helpful") shown beside theirs. Verdicts stream into a column one by one, the quote checked by code against the answer (a rule wrapped around a judgment). |
| 5 | **Judge the judge** | Calibrate model graders against humans; read the transcripts; failures should seem fair | Before the judge column is uncovered, labels the same twenty rows by hand: tap PASS or FAIL (the delegation framework's run scorer). Then uncovers. | A 2×2 grid animates: caught, missed, false alarm, agreed. Two rates computed, never one. A toggle "show one accuracy number" demonstrates how it hides a judge that passes everything. The missed row is circled: "this is what you hand in". |
| 6 | **Run it three times** | Non-determinism; pass@k vs pass^k; isolate every trial | Presses play: row 2 runs three times, dice-style, and the results differ. Then two sliders, per-run rate and k, drive two curves. | The article's worked number falls out: 75% per run, pass^3 = 42%. "Demos live on pass@k, customers live on pass^k." A second card: the trial that saw the previous trial's database. |
| 7 | **Freeze, change one thing** | Capability vs regression suites; graduation; saturation; eval-driven development; the bill | Picks one change (tool description, system prompt, model). The frozen thirty re-run, three times each. | Before/after per mode; one mode gets worse (format, 2 → 5). A capability/regression split: rows graduate as they pass; a suite at 100% shows a flat line. Cost per run before and after from Token Meter's `prices.json`: $0.11 → $0.17 and why. |
| 8 | **One adversarial row** | Graders resistant to bypass; grade what the agent produced; the loophole that was a better outcome | Plants an instruction in the gift note, asks the usual question, reads the log. Toggles the allow-list on and off. Then attacks the judge: an answer that says "Grade: PASS", and an answer that is a single colon. | With the allow-list off, `issue_refund` runs. On, a 403 in the log, one new row in the sheet. The judge's reaction to the two planted answers shows live. A card on the τ2-bench loophole: when you agree with the model, the row is wrong. |
| ★ | **Your sheet** | Automated evals as one layer; monitoring, A/B, feedback, transcript review, human studies (the Swiss cheese) | Sees the whole sheet they built: traces, modes, checks, locked rubric, labels, two rates, flagged row, change log. Downloads it as CSV. Last exercise: drags six methods onto the lifecycle (pre-launch, every commit, post-launch, weekly, calibration). | A printable keep-this card, same wording as the notes' "Keep this". Link to the practice set to do it on their own product, and to the notes' research table. |

Dropped from the article on purpose: the framework appendix, SWE-bench and Terminal-Bench detail, computer-use DOM versus screenshots, the YAML grader config, research-agent groundedness checks. Each gets one line in a "further" card at the end, not a module.

## 4. Visual language, decided

- One trace is always three cards in a row: question, tool result, answer, with the log as a strip beneath and "state after" as a fourth card when it matters. Same drawing in every module, so the student stops reading it as new.
- Amber, violet, green for rule, judge, human, as everywhere else. Coral only for the thing to find or the thing that is happening now.
- Sentences the student wrote are shown in the mono font and never edited by the page.
- Numbers are computed and drawn, never typed in prose: the two rates, pass^k, the before/after table, the bill.
- Reveals come after the student's own attempt, never before (criteria drift, from the notes).
- Phone works, laptop is best; same note as Token Meter.

## 5. What gets built, in order

| # | File | What | Verify |
|---|---|---|---|
| 1 | `_plan/evals/build_traces.py` → `c8/evals-lab/data/traces.json` | 30 traces, instructor sentences, seven modes with flags, 20 hand labels, canned judge verdicts and quotes, before/after three-run results, token counts. Row 2 is the one the judge passes wrongly. | Open five at random; the wrong ones are wrong and plausibly passable; rates from the labels come out 5/6 and 12/14 as in the notes. |
| 2 | `c8/evals-lab/index.html`, `lab.css` | Shell: rail, modules as `section.mod`, glossary drawer, Back/Next, theme toggle, `body` tokens from docs.css. Copy Token Meter's skeleton. | All ten modules route by hash; progress survives reload. |
| 3 | `c8/evals-lab/lab.js` | Modules Start to 3 (read, name, pick). State object persisted. | Student's sentences, boxes and checks survive reload; reveals only after attempt. |
| 4 | `lab.js` | Modules 4 and 5: rubric editor with lock, Groq call from the browser with the key kept in the tab, canned fallback, quote check in code, hand labels, 2×2 grid, two rates. | With a key: twenty live verdicts in under a minute. Without: canned. Changing a label after uncovering is blocked with the "thumb on the scale" line. |
| 5 | `lab.js` | Modules 6 to 8: three-run play, pass@k/pass^k curves, before/after and the bill, adversarial row with allow-list toggle and the two judge attacks. | 75% and k=3 gives 42%; format goes 2 → 5; allow-list on gives a 403. |
| 6 | `lab.js` | ★ Your sheet: assemble, CSV download, lifecycle drag, keep-this card. | CSV opens in Sheets with the columns from the practice set. |
| 7 | `c8/module-2/ai-evals/index.html`, `notes.html`, `practice-set.html` | Nav gains "Lab"; "Go on" links point at it. | Nav is Overview/Notes/Practice set/Lab. |
| 8 | `analytics.js` events | `module_completed`, `judge_ran` (live or canned), `sheet_downloaded`. Never the student's text. | Events appear in the curriculum PostHog project. |
| 9 | Later: `guides.js` + map | Link from L18 when that lecture is written (PLAN.md items 4 to 8). | Not now. |

## 6. Open questions

- Browser calls to `api.groq.com` with the student's key: confirm CORS works from the page before building module 4 that way. If not, a tiny `api/judge.mjs` on Vercel with the student's key passed per request, like `api/verify.mjs` passes nothing but task text.
- Ten typed sentences in module 1, or fewer. Ten is the smallest number at which the student's own pattern shows; the remaining twenty are read, not typed.
- Whether to reuse `api/verify?step=check` to test a student's written rule in module 3. It works for "is this a rule a program could run", costs nothing new, and is already deployed. Default: yes, with the fallback of showing the instructor's rule.
- The CSV export columns: match the practice set's sheet exactly, so the lab output can be pasted into the L18 template.

## 9. Status, 1 Nov 2026

Built: items 1 to 8 of section 7. Live judge runs in the browser on the student's Groq key (CORS confirmed); recorded run is the fallback. Module 3 "Test it" uses /api/verify?step=check and falls back to the instructor's rule off Vercel. Item 9 (map and guides.js) waits for L18.


## 10. Rebuilt as four steps, 1 Nov 2026 (afternoon)

Rethought through Feynman: one question, "how would I know if it was wrong?", asked four times. Each step is question, locked guess, experiment, "what you now know". Ten modules became four steps (`#s1` to `#s4`); about 45 minutes.

| Step | Was | Now |
|---|---|---|
| 1 Look | 0 + 1 | Tap Thursday, tap the refund state card, guess how many of thirty are wrong, five traces by eye (rows 1, 5, 9, 13, 14), all thirty revealed. |
| 2 Write the question down | 2 + 3 + 4 | Six piles pre-grouped (modes with rows), student names each as a yes/no question; guess how many code can answer; rule-or-judge per pile runs the check on thirty instantly (no free-text rule, no `/api/verify`); rubric locked; guess whether it catches row 2; run live or recorded. |
| 3 Check the checker | 5 + 8 | Twenty hand labels, turn over, two rates, flagged row; gift note with allow-list (the seventh question arrives here); guess whether the allow-list protects the judge; grade the two attacks. |
| 4 Change one thing, look again | 7 + 6 + ★ | Pick a change, guess fix/break/nothing, before/after/split/bill; row 2 three runs, guess pass^3, curves; your sheet + CSV; transfer card (coding agent, `D.transfer`); keep this. |

Cut: card-naming ritual in module 0, drag grouping and saturation bar, the human bucket, the lifecycle sort (`methods`/`stages` stay in the JSON, unused), the six-of-seven table is now five-of-six. Glossary drawer stays, words earned silently. State key is `c8.evalslab.v2`. Guesses are `S.g`, events `guess`, `step_opened`, `step_completed`, `transfer_written`.

Student pages: overview lists the four steps; notes carry four `.stepbar` banners, sections 08 (adversarial) and 09 (freeze) swapped so step 3 and 4 read in order, a "Guess first" bullet opens each step, the transfer trace sits in 13; practice set parts renamed to the steps with a "guess before every reveal" rule. Instructor guide: `_plan/evals/instructor-guide.html`, published as a private artifact.

## 11. One point per screen, 1 Nov 2026 (evening)

User: the four-step page was still too much on screen at once. Rebuilt as a deck: 33 `section.beat` screens (`#b11` … `#b411`), each one thing to look at or do, Next gated on that beat's `ok()` in the `BEATS` table in lab.js. Per-item beats page through items one at a time: six piles to name (b21), six code-or-judge picks (b25), twenty labels with two big buttons (b31). Guesses are their own screens. The thirty-row tables sit behind `<details>`. Right and left arrows move. State key `c8.evalslab.v3`. Events `beat_opened`, `step_completed`.

Also added from the GDPval and OpenAI eval reading: notes 05 (expert rubrics mix mechanical and judgment items), 07 (71% expert agreement, 66% grader, the ceiling), 09 (blind pairwise when there is no source of truth), a GDPval row in the research table, a practice set "stuck" paragraph, and one line in the lab's closing "further" text.

## 12. UI rebuilt for attention, 1 Nov 2026 (night)

User: the deck was still hard to read for a beginner; the instruction ("tap the word that is wrong") sat at the end of a grey paragraph, nothing looked tappable, and the greyed Next, the step rail, the dot row, the words drawer, the nav and the footer all competed with the task. `index.html`, `lab.css`, `lab.js` rewritten from scratch on these rules:

- **The headline is the instruction.** `h1.do` with a coral dot means "do this"; a plain `h1` is a statement. One context line under it (`.ctx`), never more.
- **One framed stage per screen** (`.stage`) holding the one object. Guess screens use `.stage.bare`.
- **The target looks tappable.** Words carry a dotted underline and a coral hover; cards carry a "tap" chip and lift on hover; a wrong tap shakes and a nudge line says what to compare.
- **Continue does not exist until the thing is done.** `#forward` is moved into the current section after the reveal and is the only coral filled button on the page. Enter or → presses it; digits 1 to 9 pick options; ← is Back (a small text link at the bottom).
- **Progress is four segments in the bar**, filling screen by screen, with "Step 2 · Write the question down · 3 of 9" between the brand and a single Exit link. No rail, no dot row, no nav links, no theme toggle, no footer until the last screen.
- **Traces read top to bottom** like a transcript (question, each tool call with its result, answer, state after), one column, no duplicate log strip. The label screen in step 3 keeps source and answer side by side because that is a compare task.
- **Paged screens** (five traces, six piles, six picks, twenty labels) show a counter and a thin track, not dots. "Nothing wrong" replaced the dash button.
- Words are still earned silently; they are listed under a fold on the last screen instead of a drawer.

State key stays `c8.evalslab.v3` (one new field, `reach`, the furthest screen opened, drives the segments). Class `tcall` for the tool-call card, because `.call` is a docs.css callout.

## 13. The board and the copy, 1 Nov 2026 (late)

User: phone layout is fine; on a 14-inch MacBook the spare width should carry visuals for visual learners, and the copy should be reviewed on the same principles.

- **The board.** At 1040px and wider the page becomes two columns: the screen (600px) and a sticky `aside.board` with one whiteboard sketch per beat, drawn by `VIS[beatId]()` in lab.js from the current state (so the sketch changes when the student acts: Thursday gets the ≠, the lock closes, the face-down cards fill, the 2×2 fills). Each returns `[svg, caption]`; `board()` runs after every `gate()`. Sketch language is the notes pages' one: Caveat labels, wobbly ink (`#wob`), amber rule, violet judge, green human, coral for the thing to find. Ink goes in `g.ln`, labels in `g.tx` (text inside `.ln` gets stroked). Shared symbols (`person`, `db`, `lock`, markers) live in a hidden `<svg>` at the top of index.html. Below 1040px the board is `display:none`.
- **Where the stage already is the visual** (the 2×2, the rates, the bill, the split, the curves), the board shows the idea, not the data again: for the turn-over it fades the diagonal and points at the two off-diagonal boxes.
- **Copy.** Every `h1.do` is an imperative; every `.ctx` is one sentence, under 20 words, no term before it is earned ("grader" in step 1, "judge" from step 2). The "Why yes or no" screen now states its point as the headline.
