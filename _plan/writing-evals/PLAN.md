# Writing Evals from First Principles: plan for the interactive session

Written 1 Nov 2026. Lives in `_plan`, which Vercel does not serve.

A new project. It shares nothing with the AI evals masterclass (`c8/module-2/ai-evals`) or the Evals Lab (`c8/evals-lab`): no content, no data, no running example, no module structure. It reuses only the site's plumbing (design tokens, kit, analytics, deploy, the serverless route shape) because that is what every page here uses.

Source material: the two documents you shared on 1 Nov, the first-principles note (four-part instrument, seven-step method, five industry examples, the lab's six-week plan) and the 90-minute lecture plan (six segments, exit ticket, homework rubric). The anchor references are GDPval and OpenAI's "Moving from OpenAI Evals to Promptfoo".

## Status, 1 Nov 2026

Built, uncommitted, not deployed. Decisions taken: title "Writing Evals from First Principles", Cohort 8, first week of November, own URL `/c8/writing-evals`, not on the map. Everything else assumed as in this plan.

| Piece | File | Checked |
|---|---|---|
| Session page, 24 screens in six segments | `c8/writing-evals/index.html`, `evals.js`, `evals.css` | Walked end to end in solo mode with the recorded judge |
| Projector | `c8/writing-evals/room.html`, `room.js` | Against a local stand-in for the Apps Script |
| Prework, homework | `c8/writing-evals/prework.html`, `homework.html` | Rendered |
| Data | `build_data.py` writes `c8/writing-evals/data/` and `api/_writing-evals-labels.mjs`; numbers in `agreement-report.md` | Refuses to build outside the promised bands |
| Checkers match labels | `verify_checkers.mjs` | 0 disagreements, all five industries |
| Sealed labels | `api/evals-labels.mjs` (local: `_plan/serve.py` now runs POST /api/* in node) | 400 before a judge run, 200 after |
| Promptfoo export | zip from the keep-this screen | `promptfoo eval` on the hard checks: 21 pass, 9 fail, same as the page and the labels |

Open:
1. Room mode needs the Apps Script deployed (`apps-script.gs`, four steps at its top) and the /exec URL pasted into `ROOM_URL` in `evals.js` and `room.js`. Until then the page runs solo only. A dry run can point at any sheet without a deploy: set `localStorage we.roomUrl` in the browser.
2. The live judge (student's Groq key, `openai/gpt-oss-20b`) is untested: no key was available. Run both rubrics in `rubric-edit.json` once and check the gap appears with a real model.
3. Labels and the recorded judges are simulated (see `build_data.py` docstring). Replace with real passes via `LABEL_OVERRIDES` when they exist.

## 1. What it is

One page that runs a 90-minute room and also works for a student alone. The room version is the lecture plan, screen by screen: the instructor drives from a projector view, every student has the same page open on a laptop, and the segments where the lecture depends on the room's answers (the hook, the blind-grading spread, the board) are fed by what the students type. The solo version is the same page with the room replaced by a recorded cohort, so the spread, the arguments and the gap still appear.

The one idea stays the one idea: an eval is a measurement instrument with four parts, a population of inputs, a definition of good written before outputs are seen, a grader with a measured error rate, and a decision the number feeds. Every screen is a derivation from it, and no screen shows a term before the student has needed it.

What a student leaves with, both modes: a decision statement they wrote and had tested, a blind-grading score sheet that disagreed with the room, a three-layer rubric for one industry, a judge they wrote and ran on 30 items, two agreement numbers (expert-vs-expert, judge-vs-expert) and a verdict on whether the judge is ready, a Promptfoo config exported from what they built, and a one-paragraph eval proposal for their own feature.

## 2. Where it lives

| Decision | Choice | Why |
|---|---|---|
| Path | `c8/writing-evals/` with `index.html`, `evals.css`, `evals.js`, `data/` and `room.html` for the projector | Own folder, own URL, as asked. Flat under `c8` like `delegation-framework` and `evals-lab`, so it is a standalone session, not a module stop. Not on the map until you say so. |
| URL | `100x-curriculum.vercel.app/c8/writing-evals` | Clean URLs are already on. No rewrite needed. |
| Sub-pages | `prework` (20 minutes, sent three days before), `homework` (the one-week build plus its grading rubric, published before any submission is read), `room` (instructor projector view) | Three short reading pages in the existing `body.read` style plus one display page. |
| Plan and scripts | `_plan/writing-evals/` holds this plan, `build_data.py`, the dry-run results and the before-and-after rubric edit | Same pattern as the other `_plan` folders: data is built by a script, never edited in the JSON. |
| Audience page tag | `data-page="writing-evals"`, `data-noaarav` | Keeps the Aarav auto-link out, since Aarav does not appear here. |

## 3. The tech we have, and what each segment uses

Nothing here needs new infrastructure beyond one Apps Script sheet and one small serverless route.

| Capability | Where it already exists | Used for |
|---|---|---|
| Static pages on Vercel, clean URLs, `_plan` unserved | `vercel.json` | The page, the three reading pages, the projector view |
| Design tokens and reading mode | `c8/docs.css`, `c8/docs.js` (`body.read`, theme, `c8store` localStorage wrapper) | Look, header, popover contents, progress and answers kept per student |
| Drawn kit | `c8/kit.css`, `c8/kit.js` (whiteboard wobble filter, Caveat labels, arrowheads, seeded RNG, scrolly observer, combobox) | The four-part board drawn as a whiteboard, the three-layer sort, the industry picker |
| Analytics | `/analytics.js` (PostHog, replays mask inputs, `[data-nolabel]` hides learner text) | One event per segment reached, per judge run, per export; learners' own text is tagged `data-nolabel` |
| Student's own model key in the browser | Token Meter and the L5 lab keep a key in the tab and call the provider from the browser | The LLM judge in segment 5 runs on the student's Groq key, so there is no shared key and no cost to us |
| Serverless route with no dependencies, in-memory rate limit | `api/aarav.mjs`, `api/verify.mjs` | `api/evals-labels.mjs`: returns the sealed expert labels only after a judge run is posted |
| Google Sheet as a live data store, read at load | The map reads a public Sheet; Token Tax Audit posts to a Sheet through Apps Script | Room submissions (first move, blind scores, exit tickets) go to a Sheet through Apps Script; the projector view and every student's page poll the public CSV to draw the live spread |
| Printable summary | Evals Lab and Token Meter end with a card the student keeps | The exit ticket and the student's rubric as a one-page print |

Not used, on purpose: a database (nothing persists but the Sheet), the TypeSafe Jev route (its rubric is about delegation, not evals), and anything from `c8/evals-lab/data`.

## 4. Two modes, one page

`?room=<code>` turns on room mode. The code is a short word the instructor picks on the projector view, and every student types it on the first screen. It becomes a column in the Sheet, so cohorts never mix and the spread shown is this room's.

Without a room code the page is in solo mode. The room is replaced by a recorded cohort: 40 blind-grading score sheets and 8 first-move answers captured from the first live run (or generated and hand-edited before it, see section 6). The student still sees the spread, still reads two defensible arguments for the same item, still watches the gap appear. Everything they produce stays in `localStorage` and can be exported.

The instructor's projector view (`room.html?room=<code>`) shows one thing per segment: the first-move answers as they arrive, the four-part board filling in, the per-item spread live, the industry table, the agreement numbers as groups report them, and the exit tickets count. It never shows a student's name.

## 5. The screens

Six segments, as in the lecture plan, with the hands-on time at 45 of 90 minutes. Each row says what the student does on the page, what the room sees, and how solo mode substitutes.

### Segment 1: the hook (0:00 to 0:10)

| Screen | Student does | Room sees | Solo |
|---|---|---|---|
| 1.1 | One line: "Your VP says: evaluate our chatbot. You have a week. Go." A single text box: "The first thing you would do." Three minutes, a visible timer. Submits. | The projector lists the answers as they land, deduplicated into the six the plan expects (write test cases, LLM judge, accuracy, ask users, look at logs, other). Nothing is marked right or wrong. | The recorded cohort's eight answers appear as if arriving. |
| 1.2 | The question, alone on the screen: "When you hand the VP a number, what will she do differently if it is 60 instead of 80?" A text box. Most students will type nothing useful, and the page lets the box stay empty. | The instructor waits. | Same screen; after 60 seconds a line appears: "Most of the room left this empty. That is the lesson." |
| 1.3 | The word "Decision" is drawn onto an empty whiteboard, part one of four. One sentence: an eval with no decision attached is theatre. | The board on the projector draws the same word. | Same. |

### Segment 2: derive the instrument (0:10 to 0:22)

Three questions, each answered by typing before anything is revealed. The board fills from the room's own words.

| Screen | Question on the headline | Expected answers | What the page adds after the reveal |
|---|---|---|---|
| 2.1 | "To make that decision, what has to be true about the inputs you test on?" | realistic, edge cases, like production | "Population of inputs" drawn on the board. The add-on they will not volunteer: sampled from the world you care about, not the one that is convenient. |
| 2.2 | "How do you know an output is good?" | a rubric, a gold answer, a human | "Definition of good." Then the constraint: written before you see any outputs. The page asks "why?" and waits for a sentence; the reveal names confirmation bias. |
| 2.3 | "Who or what applies the definition, and how do you know it applies it correctly?" | an LLM judge | "Grader, with a measured error rate." The page asks "How wrong is your judge?" and leaves the box empty on purpose. |
| 2.4 | The full board: four parts. The thesis in one line: every eval failure traces to one of these being missing. "The next exercise proves it." | Board complete on the projector. | Same. |

In room mode the projector shows the students' typed phrases clustered beside each part (a word cloud is wrong here; a plain list of the ten most common phrases is right). In solo mode the recorded cohort's phrases show.

### Segment 3: blind grading (0:22 to 0:40), the engine

| Screen | Student does | Room sees | Solo |
|---|---|---|---|
| 3.1 | Twenty billing-dispute transcripts, one at a time: customer message, account state as a small structured card (plan, charge, policy window), the agent's reply. Score 1 to 5. No rubric, no criteria, eight minutes with a timer. Scores post to the Sheet as they go. | Nothing yet; the projector shows how many have finished. | Same. |
| 3.2 | After the last score: the per-item spread for the whole room, one bar per item, the student's own score marked. The page picks the two items with the widest spread. | Projector shows the same spread, large. The instructor picks the 1 and the 5 on an item and asks them to defend themselves. | The recorded cohort's spread, with the student's own scores overlaid. For the two widest items, two recorded defences appear side by side: one graded tone, one graded whether the refund matched policy. |
| 3.3 | "Neither was wrong. They were grading different things." The two words are introduced now and not before: rubric, inter-rater agreement. The page computes the room's agreement (percentage of item pairs within one point) and shows it as one number. | Same. | Same, from the cohort. |
| 3.4 | The bridge question, alone: "If two of you disagree this much, what happens when one of you is an LLM?" No box. Continue. | | |

The 20 transcripts are built so at least five are plausible but policy-violating and five are correct but curt (section 6). This is what produces defensible disagreement rather than careless grading.

### Segment 4: rubrics in three layers (0:40 to 0:55)

| Screen | Student does | What appears |
|---|---|---|
| 4.1 | The student's own grading reasons: a box for "what were you actually scoring?" prefilled with the phrases the room typed in 3.2 (or the cohort's). They drag each phrase into one of three unnamed piles. | The piles are unnamed until the student has sorted. Then the names appear: hard constraints (binary, code checks first, veto), quality dimensions (scaled, a judge with a written rubric), preference (would an expert pick this over the best human's version, blind pairwise). Each pile is drawn in one of the site's three step colours: amber for a rule, violet for a judgement with criteria, green for a human. |
| 4.2 | The industry table: five rows (legal, healthcare, manufacturing, finance, support), columns for decision, hard constraints, quality dimensions, preference baseline, trap. The headline tells them to look at the columns, not the cells. | A tap on a column header highlights it down all five rows: what changes across rows is the content, what never changes is the three layers and who checks each. |
| 4.3 | The student picks an industry (room mode: the instructor assigns one per table and students pick theirs; solo: free choice, support recommended). They write their own three-layer rubric for that industry's task: three to five hard constraints as one-line yes-or-no rules, three quality dimensions each with a one-sentence anchor for a 1 and a 5, and the preference baseline in one line. | The rubric is saved and locked with a timestamp before segment 5 opens. The lock matters: the labels they meet later must not have shaped it. |

### Segment 5: build and calibrate a judge (0:55 to 1:15)

This replaces the starter repo during the session. Promptfoo stays the execution layer, but for homework, not for the twenty minutes in the room: a page that runs the judge from the browser is the only way sixty laptops finish in time.

| Step | Minutes | Student does | What appears |
|---|---|---|---|
| 5.1 Hard constraints | 5 | For their industry: 30 items (input, reference material, model output). They turn each of their one-line rules into a check by picking from provided check types (contains, matches pattern, number equals a value computed from the reference, list membership, length under) with a field and a value. The page runs them on all 30. | A column of amber pass or fail per item. Finance and legal get the fiddly checkers provided (number tracing against the filing, citation lookup against a small table of real and fake citations) as ready-made check types, as the facilitation notes ask. |
| 5.2 Quality judge | 7 | Their three quality dimensions become one judge prompt. The page writes the scaffold (output format: a score per dimension and a one-line quote), the student writes the criteria. Run on the 30 items with their own Groq key; canned verdicts if there is no key. | Violet scores stream in one by one, with the quote. Any item that failed a hard constraint is shown as 0 regardless of the judge's score, with the rule that vetoed it. |
| 5.3 Unlock the labels | 5 | A button: "Unlock the expert labels." The page posts their judge results to `api/evals-labels`, which returns the 30 items' two expert scores per dimension. The page computes expert-vs-expert agreement, then judge-vs-expert on the same items. | Two numbers side by side, drawn large. Expected: experts 80 to 85, first-draft judge 55 to 70. A 2×2 per item of where the judge sat relative to the two experts. Nothing is spoken on screen for ten seconds (a deliberate pause; the Continue button appears late). |
| 5.4 Verdict | 3 | One sentence, typed: "Is this judge ready for regression decisions?" | Saved to their sheet. In room mode the two agreement numbers post to the Sheet so the projector can show each group's gap. |
| 5.5 Debrief | 3 | Read-only. One rubric edit, before and after, with its agreement delta. | The fix is almost always wording, not a bigger model. The edit is a real one found during the dry run (section 7), shown as a diff with the number moving from, say, 61 to 72. Then an optional "Edit your rubric and run again" if there is time; the first run's number stays on the record. |

Export: a button that writes `promptfooconfig.yaml` from what they built (tests from the 30 items, their hard constraints as deterministic assertions, their judge as a `llm-rubric` assertion) plus `expert_labels.json` and a ten-line `agreement.py`. That is the bridge to the homework and the place where the migration guide's point (evals as versioned config, run in CI, validate any recreated grader) stops being a slide.

### Segment 6: GDPval, the lab's plan, and close (1:15 to 1:30)

| Screen | Content |
|---|---|
| 6.1 | GDPval laid onto the four-part board the student drew in segment 2. Population: top-wage occupations in top-GDP industries, tasks written by professionals averaging 14 years of experience, with reference files and non-text deliverables. Definition of good: expert rubrics per occupation. Grader: blind expert pairwise, with the automated grader positioned as a predictor of experts, not a replacement. One question with a tap: "Which of the four parts did they invest most in?" Reveal: the population. The task set is the eval. |
| 6.2 | The six-week lab plan as one drawn timeline: scope and sample, rubric and gold, build graders, calibrate, baseline and freeze, ongoing CI and contamination rotation. Promptfoo marked where it sits: the execution layer. |
| 6.3 | Exit ticket, five silent minutes, a timer. Four boxes, one per part, for a feature the student is actually building. Posts to the Sheet in room mode; downloads in solo mode. Below it, the two common failures named so the student can check their own before submitting: a decision that would not change with the score, and a definition of good that depends on seeing outputs first. |
| 6.4 | Keep-this card: their board, their rubric, their two numbers, their verdict, their exit ticket, on one printable page. Link to the homework page. |

## 6. Data to build

All data is generated by `_plan/writing-evals/build_data.py` and written to `c8/writing-evals/data/`. Nothing is edited in the JSON by hand; fix the script and rebuild. Every item carries an `id` and the file carries a `version`, because a frozen, versioned dataset is one of the things the session teaches.

| File | Contents | How it is made |
|---|---|---|
| `dispute20.json` | The 20 billing-dispute transcripts for blind grading: customer message, account card (plan, disputed charge, refund-policy window, prior refunds), agent reply. Flags per item: `violates_policy`, `curt`, `warm`, `wrong_escalation`. At least five plausible-but-violating, five correct-but-curt, the rest mixed. | Generated with a strong model from a written policy and ten customer archetypes, then hand-edited so both sides of each wide-spread item are defensible. The policy itself ships in the data so the hard-constraint layer in segment 4 has something to point at. |
| `cohort.json` | The recorded cohort for solo mode: 40 score sheets over the 20 items, 8 first-move answers, 12 "what were you scoring" phrases, and two written defences for each of the three widest items. | Seeded from the first live room (the Sheet export), with names removed. Before the first room exists, generated: 40 graders drawn from four grading personas (tone-first, policy-first, brevity-first, resolution-first) with noise, which produces the right shape of disagreement. Replace with the real export after the first run. |
| `industries/<name>.json` × 5 | Per industry: the task definition, the decision it serves, 30 items with input, reference material and one model output each, and the provided checker tables (citation table for legal, drug-interaction table for healthcare, spec sheet and quote figures for manufacturing, filing numbers for finance, policy for support). | Inputs written to the industry example's strata (claim type, diagnosis rarity, quote count, quarter, issue type and customer temperature). Outputs generated by a mid-strength model so that 8 to 10 of 30 fail at least one hard constraint and the quality spread is real. |
| `labels/<name>.json` × 5 | Two expert scores per item per quality dimension, plus a pass or fail per hard constraint. Sealed: served only by the API route. | See the label protocol below. |
| `rubric-edit.json` | One before-and-after judge rubric for the support industry with the two agreement numbers, from the dry run. | Recorded by hand after the dry run in section 7. |

Label protocol. We do not have 14-year professionals on call, and the page should not pretend otherwise. The labels are called "expert labels" on screen because the lecture plan calls them that, but the homework page and the data file say how they were made: two independent passes, each by a different person (you and one domain-literate colleague) where possible, and where not, by two different strong models with different prompts and no view of each other's scores, then a pass by you on every disagreement larger than one point. The expert-vs-expert number the students compute is the real agreement between those two passes. If it does not land between 78 and 88 for an industry, the rubric anchors for that industry are too loose; rewrite them and relabel before shipping.

The numbers the session depends on. The lecture promises experts at 80 to 85 and first-draft judges at 55 to 70. That gap has to be engineered and then verified, not hoped for. The build script ends by running three plausible first-draft judge prompts (the kind students will write: short, unanchored, "rate helpfulness 1 to 5") against the labels and printing judge-vs-expert agreement per industry. Ship only when all five land in 50 to 72 and a careful anchored rubric lands 10 or more points higher. Those runs are the source of `rubric-edit.json`.

## 7. New infrastructure

| Piece | What it is | Notes |
|---|---|---|
| Apps Script web app plus a Google Sheet | One sheet with tabs `moves`, `scores`, `reasons`, `agreement`, `tickets`. Each row carries `room`, an anonymous client id (random, kept in localStorage), a timestamp and the payload. The script accepts POSTs; the sheet is published as CSV for reads. | Same pattern as Token Tax Audit for writes and the map for reads. Students' pages and the projector poll the CSV every five seconds during segments 1, 3 and 5. No names anywhere. |
| `api/evals-labels.mjs` | `POST {industry, results:[{id, scores}]}` returns the sealed labels for that industry when `results` has 30 rows with scores. Same shape as `api/verify.mjs`: no dependencies, 20 requests per 10 minutes per instance, 8-second cap. | The point is friction, not security: a student who wants to peek has to have run a judge first. Labels never sit in a public JSON. |
| Groq from the browser | The student's key, kept in the tab as Token Meter keeps its key, calling the chat completions endpoint directly. Canned verdicts per industry (generated once by the build script with a middling rubric) when there is no key. | Pin the model in the config and show it on the screen; a pinned judge model is one of the things step 7 of the method asks for. |
| Promptfoo export | Client-side YAML writer: tests from the items, `javascript` or `python` assertions for hard constraints, an `llm-rubric` assertion carrying the student's judge prompt, a `threshold`. Zipped with `expert_labels.json` and `agreement.py`. | JSZip from a CDN is the only new library. |
| Projector view | `room.html`: picks or creates a room code, shows one panel per segment, switched by the instructor with arrow keys, polling the Sheet. | Plain page on docs.css tokens, large type, no learner text beyond what they typed into the public boxes. |

## 8. Visual language, decided

- One screen does one thing. The headline is the instruction; the Continue button exists only after the thing is done. The progress bar has six segments, one per lecture segment, with the clock time of the plan printed under each so the room and the instructor share a clock.
- The board is a whiteboard sketch: kit wobble filter, Caveat labels, four parts drawn in sequence and never all at once in segment 2. It returns, unchanged, in segment 6 with GDPval written beside each part.
- Three colours, the site's own, carry the three layers everywhere: amber for a rule a program checks, violet for a judgement with written criteria, green for a human. Coral marks the one thing to do now and nothing else.
- Numbers that matter are drawn large and alone: the room's agreement in 3.3, the two agreement numbers in 5.3. Never a dashboard.
- Learner text is tagged `data-nolabel` so replays and autocapture never carry it.
- Phone width works for the reading pages and the exit ticket; the grading and judge screens are laptop-first and say so.

## 9. Build order

Each phase ends with a check that can fail.

| Phase | Build | Done when |
|---|---|---|
| 1. Data | `build_data.py`: policy, 20 disputes, 5 industries × 30 items, checker tables, two label passes, three first-draft judges, agreement report | Report shows experts 78 to 88 and first-draft judges 50 to 72 in every industry, with an anchored rubric 10 or more points above the draft |
| 2. Page skeleton | `index.html`, `evals.css`, `evals.js`: six segments, progress bar, localStorage state, solo mode on `cohort.json` | A student can walk all six segments alone, end to end, with canned judge verdicts, in under 90 minutes |
| 3. Judge and labels | Groq from the browser, check types for 5.1, `api/evals-labels.mjs`, agreement computation, 2×2 per item | Your own first-draft rubric on the support industry lands in the expected band on the live page |
| 4. Room mode | Sheet plus Apps Script, room code, polling, `room.html` with six panels | Two browsers in the same room see each other's scores in the spread within five seconds |
| 5. Export and reading pages | Promptfoo zip, keep-this print, `prework`, `homework` with the grading rubric | `promptfoo eval` runs on an exported zip with no edits and reproduces the page's hard-constraint results |
| 6. Dry run | You run segment 5 yourself end to end for every industry, then the whole session with two or three colleagues in room mode | The before-and-after rubric edit is recorded; every timer in the plan is met or the buffer rule (segment 5 loses five minutes, segment 6 sheds Q&A, segment 3 never cut) is written into the projector view |

Analytics: one PostHog event per segment reached, per judge run (with industry and whether a key was used, never the rubric text), per labels unlock, per export, per exit ticket. These tell you where a solo student stops.

## 10. The three pages around the session

Prework (`c8/writing-evals/prework`), 20 minutes, sent three days before: read the GDPval post and come with one sentence on what they spent the most effort on; install Promptfoo and run its hello-world so the homework export is not their first encounter; bring one LLM feature they are building. Links only, no summaries of either reference.

Homework (`c8/writing-evals/homework`), one week: 30 inputs sampled from logs or written with a domain expert, strata named; a three-layer rubric with hard constraints in code; a Promptfoo config that runs in CI with a pass threshold; ten items graded by two humans with both agreement numbers and one rubric edit that moved the second number. The grading rubric is on the page from day one, before any submission is read: decision statement 15, input sampling 20, hard constraints in code 20, judge calibration 30, rubric iteration 15, each with its "fails if" line as you wrote it.

Projector (`c8/writing-evals/room`): described in section 7.

## 11. Decisions for you

1. Folder and title. `c8/writing-evals` and "Writing Evals from First Principles" are my proposal. Say the word if you want a different slug.
2. Date and cohort. The plan is dated 1 Nov 2026 with no session date. Room mode needs one; solo mode does not.
3. Who does the second label pass. A colleague per industry gives honest expert-vs-expert numbers; two models with a human tie-break is the fallback and the page will say so.
4. Map. Off the map until you decide where it belongs; the page works at its own URL either way.
5. Exit-ticket feedback. The plan promises a one-line comment within 48 hours. The Sheet export is enough for that by hand. A model-drafted first pass over the tickets is possible but I would not build it for the first run.

## 12. Risks

- The gap does not appear. If first-draft judges score close to the experts on some industry, segment 5 loses its moment. Phase 1's report is the guard; do not ship an industry that fails it.
- Sixty Groq calls at once. Each student calls on their own key, so rate limits are per student. Canned verdicts cover a student with no key or a throttled one, and the page says which it used.
- Peeking. Labels behind the route stop casual peeking; a determined student can still read a classmate's screen. Acceptable.
- Apps Script latency. Writes take one to two seconds and the CSV read is cached for a few seconds; the spread in 3.2 shows a "n of N graded" count so a late bar is not read as a missing one.
- Finance and legal groups run slow. The provided checkers in 5.1 are the fix; if a group is five minutes behind, the instructor's panel has a "skip to judge" note for them.
