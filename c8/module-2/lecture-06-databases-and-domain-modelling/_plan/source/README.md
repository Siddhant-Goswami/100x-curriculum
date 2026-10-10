# The Modeling Lab

An interactive, browser-based course that teaches **domain modeling** by doing: map a product into entities, attributes, relationships, and basic constraints, then express the result as an ER diagram and SQL schema.

Built for 100xEngineers Cohort 7, in the 100x design language (white canvas, coral accent, Space Grotesk / DM Sans). No install, no server, no account — **just double-click `index.html`.** Works for the code track and the no-code track alike.

## How to run it

- **Easiest:** double-click `index.html` → opens in your browser.
- Or: `open index.html` (macOS) / `xdg-open index.html` (Linux).

Progress and your schemas are saved automatically in the browser. Use **Reset progress** in the sidebar to start over.

Run `npm test` for the grader, migration, CSV, and SQL regression suite.

## How it's built pedagogically

Socratic and Feynman, by design. Every concept opens with a **Pause and think** question so the student reasons out the *why* before the idea is ever named. One concept per screen (headline, subtitle, one short body), quick checks that present **one question at a time**, and visual diagrams throughout (chat mock, fan diagrams, trace chains, live ER).

A single example is **woven through the whole flow**: Aarav, an early-career builder whose AI app types back a plan but forgets everything when the tab closes. We model his world question by question, and by module 6 his finished schema appears as an ER diagram, then scales up to the full 21-day workflow-diagnosis program with no new theory. Finally the student turns the same three questions on their own app.

**Lessons**
1. **Start here** — feel Aarav's app forget (live amnesia demo), then the three questions that fix it: things, what they have, how they connect.
2. **Entities** — the nouns of Aarav's world + the CRUD test (is it its own thing?).
3. **Attributes** — what describes an entity, and the entity-vs-attribute boundary (tone vs a reusable tone).
4. **Relationships** — one-to-one, one-to-many, many-to-many, the join/associative table, and *where in-between data (grade, quantity, status) belongs*.
5. **Keys & ER** — primary keys, foreign keys (on the many side), traced through Aarav's data.
6. **Aarav's blueprint** — the woven example fully assembled as an ER diagram (the MVP), then scaled to the whole program.
7. **Your blueprint** — a free, ungraded canvas where the student models their *own* app (entities, keys, relationships) and exports it to ER + CSV.

**The Arena** — 10 graded modeling exercises across 3 tiers:

| Tier | Exercises (skill) |
|------|-------------------|
| Beginner | Library (1:N) · Pet Clinic (1:N) · Bakery (junction table) · Music Library (entity vs attribute) |
| Intermediate | Online Learning (M:N) · University Grades (attribute on junction) · Car Rental (contract entity) · Hospital Assignments (historical records) |
| Advanced | LinkedIn Automation (lifecycle + analytics) · Food Delivery (marketplace + assignment) |

For each: read the brief → build tables (columns, PK/FK, required/unique constraints, references) → **Submit**. The grader checks entities, attributes, keys, broken references, contradictory relationships, and one-to-one uniqueness. View the ER diagram, download valid sample CSV files, or export a SQL schema.

## Files

```
index.html       → app shell (sidebar + lesson player + arena)
css/tokens.css   → 100xEngineers design tokens (colors, type, spacing) — drop-in brand sheet
css/app.css      → app-specific components, built on the tokens
js/data.js       → lesson content + the 10 exercise rubrics
js/grader.js     → the schema-grading engine
js/app.js        → linear player, schema builder, Arena, ER/CSV/SQL export
```

To add an exercise, copy an object in `CHALLENGES` (in `js/data.js`) and describe its `rubric`. Mark an attribute `critical: true` to make missing it block a pass (use it for the exercise's teaching point). No other changes needed.

## Design

Implements the **100xEngineers design system** (`css/tokens.css` is the brand's drop-in token sheet): white canvas, coral `#F96846` as the single accent, generous whitespace, borders over heavy shadows, Space Grotesk + DM Sans + JetBrains Mono, and subtle 150–200ms motion. Icons are [Lucide](https://lucide.dev) (outline), loaded via CDN.
