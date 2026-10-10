# Lecture 6 · Databases and domain modelling — review of The Modeling Lab and the build plan

Reviewed: https://memory-lab-beryl.vercel.app (repo `Siddhant-Goswami/memory-lab`, commit `58b54cf`; the deployed `data.js` and `app.js` are byte-identical to the repo). Reviewed against: the Module 2 sheet (Lecture 6 row, both tracks), the Lecture 3, 4 and 5 pages and worksheets in this repo, `DESIGN-SPEC.md`, and the house rules in memory (concise pages, Create/Read/Update/Delete wording, no Git/Discord links, map is the source of truth).

Written 10 Oct 2026, the lecture day. Lecture 7 (Connect backend to database, Supabase, both tracks) is Fri 16 Oct, so the practice set is due before that.

---

## 1. Verdict in one paragraph

The lab is already the right shape: Socratic prompts before every reveal, one idea per screen, a builder where the student actually makes tables, a grader, and a capstone on the student's own app. Three things keep it out of sync with C8. First, it is a Cohort 7 artefact: Aarav is the *builder* in it, while in C8 Aarav is the *user* (the analyst with the Monday Jira workflow) and the student is the builder, and the "21-day program" extension is C7 content that no C8 student has seen. Second, it leans on code: SQL export, "restart the server", `NOT NULL`, `BIGINT`, composite and surrogate keys, column types like `uuid` and `timestamptz`, a percentage score with a pass mark. Third, the woven Aarav example is *shown*, not *built*: the student reads four modules of explanation, answers two-option quizzes, and is handed the finished ER diagram. The learn-by-doing part only begins in the Arena, on ten generic briefs (libraries, bakeries, car rentals) that never touch the app they are building in Lectures 3 to 8.

The plan below keeps the engine (builder, grader, ER view, CSV sheets, local save) and rebuilds the content so the student *constructs* Aarav's model step by step from his real chat, then does the same for their own app, and leaves with the exact tables they will type into Supabase on 16 Oct.

---

## 2. What the sheet says Lecture 6 must deliver

From the Lecture 6 row (identical on both tabs):

| Sheet column | Value |
|---|---|
| Title | 6. Databases and domain modelling |
| Date | Sat 10 Oct 2026 |
| Type / Tools | combined theory · **Paper exercise** |
| Students can | Model their domain as entities and relationships before any table exists. |
| Prep note | Domain modelling as a paper exercise before Supabase is opened. |
| Outcome 1 | Distinguish temporary in-memory state from persistent storage. |
| Outcome 2 | Identify a product's entities, attributes, and relationships through domain modeling. |
| Outcome 3 | Use primary keys, foreign keys, and relationship types to design a relational schema. |
| Outcome 4 | **Choose storage based on the data's structure, keeping large files separate from relational records.** |

Coverage today:

| Outcome | In the lab? | Note |
|---|---|---|
| 1 memory vs storage | Yes | The amnesia demo. Shows the loss, never shows the fix. |
| 2 entities, attributes, relationships | Yes | Explained and quizzed; not built by the student for Aarav. |
| 3 keys and relationship types | Yes | Explained; the only "doing" is the Arena. |
| 4 files vs rows | **No** | Nothing in the lab. The Attachment quiz is the only hook. |

Lecture 7's outcomes (code tab) name the tables we must land on: "save linked conversations and messages", "retrieve the correct conversation history", "stored data survives a restart". Lecture 4's practice set already gave both tracks an API table for Aarav with `/workflows` and `/workflows/{id}/diagnoses`. Lecture 6 sits exactly between those two: every noun in the Lecture 4 API table is a candidate entity, and every entity becomes a Supabase table in Lecture 7.

---

## 3. Review findings

### 3.1 Out of sync with C8 (must fix)

1. **Aarav's role is inverted.** Lab: "Aarav built a small app". C8: the student built the app (Lectures 3 and 5); Aarav is the named user, an analyst at an IT company in India whose weekly workflow is Jira → dashboard → report → Slack (the golden pair in `guides.js`, the Track B prompt in Lecture 5). Every screen that says "Aarav's app" must become "your app, with Aarav using it".
2. **The extended model is C7.** `AARAV_FULL` (workflows with pain_score, workflow_maps, prototypes, interviews, "21-day program") has no counterpart in C8. Replace with the C8 extension: the Lecture 4 API table, which adds `workflows` and `diagnoses` to the chat tables.
3. **`plans` vs `diagnoses`.** Lecture 4 and 5 call the resource a *diagnosis* that contains a *plan*. Use a `diagnoses` table with a `plan` column so the model matches the API table the students already wrote. (Flag: if you prefer `plans`, change the Lecture 4 practice set too; the map wins on conflicts.)
4. **"Cohort 7"** in the intro pill and README. Title and folder must follow the map: "6. Databases and domain modelling" (British spelling in the sheet; the lab uses "modeling" throughout).
5. **No Track A / Track B framing.** Lectures 3, 4 and 5 all offer Track A (your own observation) and Track B (Aarav's workflow diagnoser). The lab's "Your blueprint" is Track A; the Aarav model is Track B; nothing says so.
6. **No deliverables, dates, or map stop.** Every other lecture has a practice-set page with "What to submit" ticks, a due date, and a `GUIDES.L<n>` worksheet on the map. The lab has neither a submission list nor a worksheet.
7. **Separate site, separate design system.** The lab runs on its own Vercel project with Space Grotesk, DM Sans, Lucide icons from an unpinned CDN, coral `#F96846`, no dark mode. The curriculum runs on `docs.css` (Inter, JetBrains Mono, paper palette, coral `#F2603C`, dark mode, the four-tab top bar). Lecture 4's Request Builder is the precedent: a playground page inside the lecture folder, on the shared stylesheet.
8. **Percent score and "pass at 85%".** The design spec's rule is binary checks, "no percentages, no almost". Replace the score ring with a checklist of named checks; done means every structural check passes.

### 3.2 Code-flavoured wording to remove (both tracks must read it the same way)

| Where | Now | Change to |
|---|---|---|
| Demo | "restart the server", "server running" | "close the app and reopen it" (status pill: "app running") |
| Builder | PK / FK / NN / UQ checkboxes, title "Required (NOT NULL)" | words: key, points to, required, unique |
| Builder types | text, integer, decimal, boolean, date, timestamp, uuid, id | text, number, yes/no, date and time, id |
| Keys module | `enrollments(student_id, course_id)`, composite primary key, surrogate id, unique foreign key | a drawn three-column mini table; say "the pair cannot repeat" |
| Keys module | "CSV files ... do not preserve types ... A SQL schema does, so the builder exports both" | drop SQL entirely; keep the CSV sheets as the paper artefact |
| Arena, blueprint | "SQL schema" download, `.sql` files | remove (Lecture 7 regenerates whatever the code track needs from the same tables) |
| Entities | "CRUD test" | "the Create, Read, Update, Delete test" (spelled out once, as Lecture 4 did) |
| Capstone checklist | "duplicate enrollment, two analytics rows ..., composite keys" | rewrite in Aarav's terms (two diagnoses for one chat, a message with no conversation) |
| Hints, feedback | `fk`, `pk`, `UQ`, `m:n`, `1:N` | "key", "points to", "unique", "many-to-many", "one-to-many" |

Keep: `snake_case` table and column names (Supabase will show the same), "primary key", "foreign key", "ER diagram" (the sheet's own words are entities and relationships; introduce "ER" once as the name of the picture).

### 3.3 Pedagogy gaps against how C8 teaches

- **Shown, not built.** The Entities, Attributes, Relationships and Keys modules explain Aarav's model; the student never places a single noun. The curriculum's rule is derive, don't list. Fix: each module ends with the student *doing* that step on Aarav's real chat, and the ER diagram in module 5 is assembled from what *they* placed, not from a constant.
- **No commitment before the reveal.** Lecture 5 locks Send until you predict the status code. The lab's "Pause and think" is a passive prompt with an open "Reveal". Fix: on the four key prompts, a one-line text box that must be filled before the reveal opens (saved locally, shown back beside the answer).
- **The demo shows loss, not the fix.** Students feel the amnesia; they never see rows appear. Fix: a second phase where "save to a table" is on, every message lands as a row in a visible `messages` sheet, and reopening the app replays from the sheet. The row and column shape is derived from the chat before the words "entity" and "attribute" appear.
- **Outcome 4 is missing.** Fix: a short sorting exercise (see module 4 below).
- **The Arena briefs are generic and long.** Ten exercises, four of which repeat a move already drilled (library duplicates pet clinic; online learning duplicates university; car rental duplicates hospital; food delivery is too big for a paper exercise). The house rule is concise. Fix: six briefs, each one teaching a single move, led by Aarav's own app as the first graded exercise so that the canonical Lecture 7 schema is the one every student has already passed.
- **Everything is linear and locked.** A student who only wants the Arena before class must click through 25 screens. Fix: keep the order, but unlock every module from the start; show ticks for done ones. (Lecture 4's builder lets you jump between steps.)

### 3.4 Content accuracy and small issues

- Entities module says "Aarav is a user" with an `email`; in C8 the app has no sign-in yet (Lecture 8 adds authentication). Keep `users` with `name` only, and say sign-in comes in Lecture 8.
- The many-to-many example (students and courses) is fine but foreign to the running example. Better: a workflow uses many tools (Jira, Slack, a dashboard) and a tool appears in many workflows → `workflow_tools`. Keep students and courses only in the Arena.
- The one-to-one example (billing profile) is not in any C8 app. Use "one diagnosis per workflow run, kept as history" to teach why one-to-many with history beats one-to-one overwrites. Keep one-to-one as a named shape with a one-line example.
- `renderER` draws relationships as text lines ("1 ──< ∞"), not as lines between boxes. Acceptable for a paper exercise; mention as optional polish only.
- Lucide is loaded from `unpkg.com/lucide@latest` (unpinned). The curriculum uses inline SVG. Drop Lucide when moving onto `docs.css`.
- The builder row has seven controls per column; on a phone it will wrap badly. Lecture 4 and 5 are used on phones. Needs a stacked layout under 640px.
- Local storage key is `modeling-lab.v2`; house convention is `c8.l06.*`.
- README mentions `npm test` and GitHub; fine for the repo, must not appear on any page.
- The tests (`test/*.test.js`) pass (7 of 7). Keep them next to the moved code in `_plan/tests/` so they never deploy.

---

## 4. The rebuilt flow

Working title on the map: **Databases and domain modelling**. Page title: **The Modelling Lab**. Both tracks, one path. The student is the builder; Aarav is the user.

The spine is the three questions the lab already uses, kept word for word because they are good: **What are the things? What does each thing have? How do they connect?** Each module answers one for Aarav *by the student's hand*, then module 5 assembles their answers.

### Module 0 · Feel it (outcome 1)
1. Intro: "Your app can think. Now teach it to remember." Aarav pastes his Monday workflow, gets a plan, closes the tab, comes back on Monday: gone.
2. **Demo, phase 1 (as today):** type as Aarav, close and reopen the app, messages vanish. Pre-filled with Aarav's real golden input so the words on screen are his.
3. **Demo, phase 2 (new):** switch "save to a table" on. Each message appears as a row in a `messages` sheet beside the chat: `id`, `role`, `content`, `created_at`. Reopen the app: the chat replays from the sheet. Pause and think, with a required one-line answer: *"What did the table need to know about each message to bring it back?"* The reveal names it: a row per thing, a column per fact. Memory dies, storage survives.

### Module 1 · The things (outcome 2, entities)
1. Concept: nouns are candidates; the Create, Read, Update, Delete test plus identity and lifecycle decide.
2. **Do it:** the Aarav chat transcript (user message, plan, a second conversation, a screenshot he attached) with tappable words. Tap a word, choose *thing*, *fact about a thing*, or *neither*. Target set: user, conversation, message, workflow, diagnosis. Instant feedback per tap, with the test applied in one sentence ("a plan can be created again tomorrow and the old one kept, so it is a thing").
3. Two quick checks kept (Conversation, email). Drop the third (Message), it is now done by hand.

### Module 2 · What each thing has (outcome 2, attributes)
1. Concept: the facts you need to recreate one; if it only describes something else it is a column, not a table.
2. **Do it:** a bank of fact cards (`name`, `role`, `content`, `created_at`, `started_at`, `description`, `plan`, `tone`, `screenshot`) and five entity boxes from module 1. Drag or tap-to-assign each card to its entity. `tone` goes on `diagnoses`; `screenshot` is held back with a note: "we come back to this one in module 4".
3. The boundary concept (tone as a column now, a table if users save and reuse tones) with the existing quiz.

### Module 3 · How they connect (outcome 3, relationship types and keys)
1. Concept: three shapes. One-to-many is the workhorse. Many-to-many needs a third table. One-to-one is rare and worth a second look.
2. **Do it, part 1 (shape):** four pairs from Aarav's app, pick the shape for each: user→conversations, conversation→messages, workflow→diagnoses, workflow↔tools. Feedback explains the "many" side.
3. Concept: every row needs an address (`id`); the many side carries the pointer; that pointer is the foreign key.
4. **Do it, part 2 (place the key):** for each one-to-many pair, tap which table gets the pointer and name it (`user_id` on conversations, `conversation_id` on messages, `workflow_id` on diagnoses). For workflow↔tools, build the third table's two columns. The trace chain (message → conversation → user) animates from what they placed.
5. The "in-between data" idea, kept, but on the Aarav example: *"Aarav rates a diagnosis 1 to 5. Which table?"* then the grade-on-enrollment quiz as the transfer check.

### Module 4 · Rows or files (outcome 4, new)
1. Pause and think, required answer: *"Aarav attaches a screenshot of his Jira board. Can it go in a column?"*
2. **Do it:** sort cards into **a row in a table** or **a file in storage, with its link in a row**: name, message text, created time, a Jira screenshot, a 20-page process PDF, a voice note, the plan text, the file's name and size. Reveal: structured facts are rows; large or binary things are files; the table keeps the link, the owner and the time. Add `attachments(id, message_id, file_url, file_name)` to Aarav's model.
3. One line on what this means for Supabase: tables for rows, a storage bucket for files, named in Lecture 7.

### Module 5 · Aarav's blueprint (assembled from the student's work)
1. The ER diagram rendered from modules 1 to 4: `users`, `conversations`, `messages`, `attachments`, `workflows`, `diagnoses`, `tools`, `workflow_tools`. Not a constant: it reads what the student placed, with any still-missing piece shown dashed with a link back to the step.
2. Side by side: the Lecture 4 API table. Each address lit up against its entity (`/workflows` ↔ workflows, `/workflows/{id}/diagnoses` ↔ diagnoses). The sentence: "every noun in your API table is a table here. That is not a coincidence."
3. The checklist, binary: can the model answer *"show me Aarav's last conversation"*, *"show every diagnosis for this workflow, oldest first"*, *"which screenshot went with which message"*. Three ticks.
4. "Close the tab now. Nothing is lost." Then: the Arena.

### Module 6 · The Arena (practice, graded by binary checks)
Six briefs, one move each, in this order:

| # | Brief | The move | Kept from |
|---|---|---|---|
| 1 | Aarav's workflow diagnoser | the canonical model, from a blank builder this time | new |
| 2 | The pet clinic | one-to-many, key on the many side | petclinic |
| 3 | The music library | entity vs attribute (pull artist and album out) | music |
| 4 | The corner bakery | many-to-many with a quantity on the join | bakery |
| 5 | University grades | the fact that belongs to the pairing | university |
| 6 | Hospital assignments | history is a row, not a column | hospital |

Optional seventh for those who want it: LinkedIn post automation (status column, one analytics row per post) as "stretch". Drop library, online learning, car rental, food delivery.

Grading: the existing grader stays, the display changes. Each rubric item becomes a named check with a tick or a cross and one sentence ("`messages` has no pointer to its conversation"). "Done" when every structural check is a tick; optional attributes are listed as suggestions, never counted. No ring, no percentage, no 85%.

### Module 7 · Your blueprint (Track A; Track B is module 5)
1. "In one line, what does your app do?" (kept), then "Which three questions must the data answer?" (new, three short boxes). The checks in step 4 are these three questions.
2. The builder, starter table `users`.
3. The three-question cards, kept, reworded in plain words.
4. **The self-check, binary:** for each of the three questions, "can my tables answer this?" tick; "which files does my app store, and where is the link?" tick; "which address in my Lecture 4 API table maps to which table?" tick.
5. Outputs: ER diagram on screen; **Download the sheets** (CSV, one per table, the paper artefact and the thing the no-code track can import). No SQL.

---

## 5. The practice set, deliverables, and dates

Page: `c8/module-2/lecture-06-databases-and-domain-modelling/practice-set.html`, same shape as Lecture 4's (practice set in one sentence, how it works, deliverables with ticks, rules).

**In one sentence:** Build Aarav's model by hand in the Modelling Lab, pass the six Arena briefs, then model your own app and prove it can answer your three questions.

**Deliverables (ticks save on the device):**
1. Aarav's blueprint: a screenshot of the ER diagram from module 5 with all three checks ticked.
2. The Arena: all six done (the lab shows 6/6).
3. Your blueprint: the ER screenshot plus your three questions and the three ticks.
4. Rows or files: one sentence per file your app stores, and the column that holds its link.
5. The bridge: your Lecture 4 API table with a table name written beside every address.

Track B (Assignment 1 not finished): deliverable 3 uses Aarav's model, with one table of your own added.

**Dates (confirmed 10 Oct):** office hour Thu 15 Oct 2026, 8:30 pm IST. The practice set is due before it. Lecture 7 practical is Fri 16 Oct.

**Wording rule:** this is a practice set, not an assignment. Every page says so once, plainly; the word "assignment" appears only when naming Assignment 1 from Week 0.

Submission wording: "post in the Discord channel", plain text, no link.

---

## 6. Where it lives and how it is wired

Follow the Lecture 4 layout (playground inside the lecture folder) and the Lecture 5 page set.

```
c8/module-2/lecture-06-databases-and-domain-modelling/
  index.html                       Overview: kick, title, one-line lecture, your path, when you need it
  notes.html                       Notes: the lecture, section by section (from your lecture doc, when you share it)
  practice-set.html                Practice set: the one sentence, deliverables, rules
  troubleshooting.html             Short: "my tables look wrong" questions; lab save/reset; CSV opening in Sheets
  playgrounds/modelling-lab.html   The lab: single page, on docs.css + l06.css
  assets/l06.css                   Lab components only (builder, sheets, ER boxes, tap-to-tag transcript)
  assets/l06-data.js               Modules + the six briefs (from data.js, rewritten)
  assets/l06-grader.js             grader.js, unchanged logic, check-list output
  assets/l06-lab.js                app.js, reworked
  _plan/                           this plan, the original memory-lab source, tests (never deploys)
```

- Top bar on every page: Overview · Notes · Practice set (Troubleshooting linked from the practice set), exactly as Lecture 5.
- `guides.js`: add `GUIDE_LINKS.l06Hub/l06Notes/l06Practice/l06Trouble/l06Lab` plus anchors for the lab modules, and `GUIDES.L6 = { all: {...} }` with four stages (Aarav's blueprint, the Arena, your blueprint, submit), `deadline: 'Practice set'`, `due` to be announced, `next: 'Next: typing these tables into Supabase, and watching a row survive a refresh.'`, `errors`, `read`, `words`, `kw`.
- Map: the L6 stop exists on the sheet; only the worksheet is new, so no map code changes.
- `docs.css` gives dark mode, the theme toggle, the progress line and the fonts for free. Drop `tokens.css`, `app.css`, Lucide; redraw the dozen icons inline.
- Local storage: `c8.l06.lab` (progress, answers, placed pieces), `c8.l06.schemas.<key>`, `c8.l06.ticks.*`. One Reset in the lab footer.
- The separate `memory-lab-beryl.vercel.app` deployment: leave it up until the moved lab is live, then point it at the new address or retire it (your call; the practice set must link only to the in-repo copy).

---

## 7. Build order (what I would do, in this sequence)

1. **Scaffold** the folder, the four pages on the Lecture 5 pattern, and `GUIDES.L6` with placeholders. Deploy check: the top bar, the map stop worksheet, and the links resolve.
2. **Port the engine**: builder, ER view, CSV sheets, grader, local save, onto `docs.css` with `l06.css`. Strip SQL, Lucide, the type list, the abbreviations. Stack the builder row under 640px. Run the ported tests from `_plan/tests/`.
3. **Rewrite the modules** in `l06-data.js`: Aarav as the user, C8 wording, Create/Read/Update/Delete spelled out, the one-to-many and many-to-many examples from Aarav's app, no C7 extension.
4. **Build the four doing-steps**: tap-to-tag transcript (module 1), assign facts (module 2), pick shape and place the key (module 3), rows-or-files sort (module 4). Each writes to `c8.l06.lab` so module 5 can read it.
5. **Module 5 assembly**: ER from the student's placements, the API-table bridge, three binary checks. Module 0 phase 2 (save-to-table demo) belongs here too; it shares the sheet renderer.
6. **Arena**: six briefs, Aarav first, check-list grading, Done state, stretch brief.
7. **Your blueprint**: three questions, binary self-check, CSV download, no SQL.
8. **Practice set, overview, troubleshooting copy**, deliverable ticks, `GUIDES.L6` filled in, memory file for Lecture 6.
9. **Walk it on a phone and in dark mode**, then `vercel --prod`.

Steps 1 to 3 are mechanical and can start now. Step 3 and the notes page need your lecture doc for the "Notes" tab; everything else is derivable from the sheet, Lectures 4 and 5, and the lab.

---

## 8. Decisions I made (say so if you want them reversed)

- Lab moves into this repo under the Lecture 6 folder, on `docs.css`, as Lecture 4's Request Builder did. The standalone deployment is retired after.
- `diagnoses` with a `plan` column, matching the Lecture 4 API table, not `plans`.
- Six Arena briefs plus one stretch, not ten.
- Binary check lists instead of a percentage score.
- CSV sheets stay as the paper artefact; SQL export goes.
- British "modelling" on pages and the map, matching the sheet; the lab's page title is "The Modelling Lab".
- All modules unlocked from the start; order is recommended, not enforced.

## 9. Answers received (10 Oct)

- The lecture has not run yet; the session is combined for both tracks. Notes are written from the exercise itself.
- Due before the Thu 15 Oct office hour, 8:30 pm IST.
- The memory-lab repo is C7 only. The C8 version is forked into this repo; the original stays untouched.
