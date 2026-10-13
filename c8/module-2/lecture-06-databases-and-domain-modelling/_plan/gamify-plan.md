# Modelling Lab: beginner review, consistency review, and a plan to gamify the whole practice set

Reviewed 2026-10-13 on the live page (100x-curriculum.vercel.app), walked top to bottom as a first-time student, Question 1 game played, Arena brief 2 opened and checked.

## 1. What a beginner meets, section by section

| Where | What happens | What a beginner feels |
|---|---|---|
| Top of page | "Where you are" callout, the three-bricks figure and its caption, checkpoint ring, section pills | About 250 words and two cards before anything can be tapped. The figure shows `conversation_id` before the id is derived in section 3. |
| 01 Things | One paragraph, the game card, the full-screen game, then two quick checks and a self-tick checkpoint | The game is the best part of the page. Then the two quick checks ask about "conversation" and "casual", both of which the game already asked. The checkpoint is a plain checkbox the student ticks by hand, separate from the game's own finish. |
| 02 Facts | Nine cards above a tall board; tap a card, scroll, tap a block; feedback line sits under the board | Energy drops: no shell, no score, no finish screen. The feedback is often off screen when the top row of blocks is tapped. All six block names are drawn even if section 1 was skipped, which contradicts "nothing is pre-drawn" in section 5. |
| 03 Links | Three explanatory figures, five pair cards (two yes/no each), then free-text pointer naming, a trace, the board, a fourth figure, two quick checks | The longest section, and the first time the student must type a technical name (`user_id`) with no format cue beyond the prose. The many-to-many card asks for three typed names at once. The "grade" quick check gives away Arena brief 5. |
| 04 Rows or files | Pause-and-think, eight cards sorted into two bins | Easy and quick, but a third interaction style (bins) after the board (02) and the pair cards (03). The screenshot is decided for the third time (game tray, fact card, sort card). |
| 05 Aarav's model | The assembled board, the API bridge table, three product questions with answers printed under them, a self-tick checkpoint | Nothing to do. The product questions are ticked with the answer already visible. |
| 06 Arena | Six briefs, each a table builder with type dropdowns and four flags, hints, "Check my model" | The biggest jump on the page: from tap-to-place to a form. Brief 1 alone is about twenty typed fields; six briefs are sixty plus. The checker's first cross already prints the answer ("for example `owner_id`"), so a stuck student copies it. Hint 3 is the full answer. "Column suggestions do not count" is unclear. |
| 07 Your model | Builder, two textareas, five self-tick checks, a checkpoint, copy button | Right content, but it ends on a checkbox list instead of a finish. |

Time: the hero says about 90 minutes. For a beginner, sections 1 to 5 take about 40, the Arena 45 or more, and section 7 another 20. Either say 2 hours or trim the Arena (see plan).

## 2. Consistency findings

Vocabulary. The same unit has three names: headings say "Question 1" and "01", prose says "section 4", the pills say "1 The things", the game says "Question 1" and "Next: Question 2". The same object is a "block" in sections 1 to 5 and a "table" in the builder ("+ table", "table_name", "2 things expected"). "key" and "id" are both used for the row's address.

Progress. Seven different counters: game points and stars, the checkpoint ring (0/7; the HTML still hardcodes 0/8 and the script overwrites it), "0 / 9 placed", "0 / 5 linked", "0 / 8 placed", "25 of 36 pieces", "0 / 6 done", then the practice set's own 0 / 4 ticks and the map checklist. Every checkpoint is a self-tick that can be ticked with nothing placed.

Feedback copy. Wrong answers say "Not quite." (game), "Not there." (placers), "Look again." (pairs), "Not yet." (Arena). Right answers say "Yes.", "+10", or nothing (pairs).

Interaction. Five patterns: hover-or-tap with a popup (01), tap card then tap SVG block (02), yes/no buttons plus typed names (03), tap card then tap bin (04), form builder (06, 07). The practice set page and the map both call the lab's output "tables", and the lab calls them blocks until section 6.

Small bugs and stale bits: the hardcoded 0/8; the `.scorebox` ring and the `exnav` pills duplicate each other; the stage-2 board ignores section 1 results (`aaravTables`, `stage===2` makes every block `tOk`); the Arena reset and "Load Aarav's model" use `confirm()` dialogs, which the game shell never does.

## 3. The plan: one game, seven levels

Principle: every unit on the page becomes a level played in the same full-screen shell that Question 1 already has (`.game`, `.g-bar`, `.g-dock`, `.g-over`), with the same rules, the same words, and one score. The page itself becomes the briefing between levels: a short paragraph, one hand-drawn figure, the level card with Start. Nothing else interactive sits inline.

### Rules, identical in every level

- Right call: +10. Right after a miss on the same item: +5. Three in a row: +5 bonus.
- Stars by misses: 0 or 1 miss = 3 stars, up to 4 = 2 stars, more = 1 star. Opening a hint in the Arena costs one star.
- Wrong: "Not quite." plus a one-line nudge specific to the item (not the generic CRUD question). Right: "Yes." plus the why.
- A level is complete when its state is complete, never by a self-tick. The checkpoint becomes the level's star row.
- Levels unlock in order; "Jump ahead" is allowed but the level says what it builds on (fixes the section 2 leak: the board shows "?" blocks until level 1 found them).
- Every level ends with the same win card: stars, points, one-line summary, "Next: Level N", "Play again", "Back to the lab".

### The level map

Replace the checkpoint ring and the section pills with one map at the top: seven tiles, each with its star row, points, and a locked / next / done state, and a total. The same component is drawn again at the bottom of the page as the finish. The practice set page reads the same `localStorage` key and auto-ticks deliverables 2, 3 and 4 when the lab says the level is done, so a student never ticks a box the lab has not earned.

### Level by level

1. Find the things (exists). Keep. Make the miss hint per word (a `nudge` field on each token), fold the two quick checks into a bonus round on the win card ("Two more calls: is 'conversation' a thing? is 'casual'?", +10 each), and drop the inline quick checks.
2. Fill the blocks. Full screen: fact cards drawn one at a time on the left, the board on the right with the six blocks (only the ones found in level 1 are named) and the coral hold tray. Tap the block. Bonus round: the tone pause-and-think as a typed line (+15 for any line of 8+ characters, the reveal shown after), then "9:12 am" and "attachment" as two more calls.
3. Connect the blocks. Five rounds, one pair each. A round shows the mini figure, the two yes/no questions (+5 each), then "place the pointer": tap the block that holds it, then pick its name from three chips (`user_id`, `users_id`, `conversation_id`) instead of typing. The many-to-many round offers chips for the third block's name and its two pointers. Between rounds 1 and 2 the shell shows the "number the rows" and "which side" figures as interstitial cards, so the derivation stays, but in the flow. The win card plays the trace animation. Bonus calls: "how often" and "grade".
4. Rows or files. The eight-card sort in the shell, tap a card then tap a bin. The screenshot pause-and-think is the level's opening card instead of a form on the page.
5. Boss: can the model answer? The assembled board in the shell. Three product questions; for each the student taps the blocks in order along the arrows (users, conversations, messages). A wrong tap flashes, the right path lights up, +10 per question. Then the bridge: four API addresses, tap the block each one lands on. This replaces the printed answers and the self-ticks.
6. The Arena. Keep the builder, since building from a blank page is the skill, but: column names come from a chip row under each table ("name, phone, species, date_of_birth, owner_id") that the student taps to add, with typing still allowed; the first check shows crosses without the example name, the second check shows it; hints cost a star; each brief earns stars and the pill becomes a star row. Brief 1 may start from the level 5 board with "Load my board" for 2 stars max, or blank for 3.
7. Your model. Stays a workspace, not a game, but ends with the run's finish card: stars across all levels, total points, the blueprint text, and the link to What to Submit. The five "before calling it done" ticks remain as the only self-ticks on the page, because only the student can judge their own model.

### One vocabulary

- Unit: "Level 1" to "Level 7" in the shell and the map; headings keep "Question 1 to 3" as the level titles, since the three questions are the idea. Drop the word "section" from the prose.
- Object: "block" everywhere in levels 1 to 5. Level 5's win card says it once: "Next week each block becomes a table." From level 6 on, the builder says "table" and the chips say "block → table" once in the briefing.
- Address: "id" is the column, "key" is the flag. Say "the row's id, its key" once in level 3 and then only "id".
- Feedback: "Yes." and "Not quite." only.

### Order of work

Phase 0, before the Thursday office hour (about 2 hours): the vocabulary pass, the stale 0/8, the stage-2 leak gate, hide the example name on the first Arena check, remove the two duplicated quick checks in level 1, one feedback phrase everywhere, `confirm()` dialogs replaced by in-page buttons.

Phase 1 (about a day): generalise the Question 1 shell into `game(level, opts)` in `l06-lab.js`, the level map component replacing the ring and the pills, levels 2 and 4 ported (they are the existing placers), per-level stars saved under `S.lv[n]`, the practice set reading the lab's state.

Phase 2 (about a day): level 3 as rounds with chip naming and interstitial figures; level 5 as the path-tap boss.

Phase 3 (half a day): Arena stars, chip rows, hint cost, delayed answers; level 7 finish card.

Saved state: keep the existing keys (`tags`, `facts`, `dir`, `keys`, `sort`, `schemas`, `solved`, `bp`, `g1`) so students who have started do not lose progress; add `lv` for points and stars. Checkpoint ticks under `c8.ck.l06-lab` are derived, not stored.

Tests: extend `_plan/tests/checker.test.js` with the star rule, the unlock rule, and the stage-2 gate.
