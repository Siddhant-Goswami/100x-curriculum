# Reading UX plan: notes and practice set pages

Scope: the Notes and Practice set pages under `c8/module-2/` (Lectures 4, 5, 6 today, every lecture after). Overview pages, playgrounds, the lab and the map are out of scope. This is the plan; nothing is built yet.

The feedback: "still noisy, too many things happening on the screen". The goal: a student opens Notes or the Practice set and sees one thing, the text, with everything else reachable but silent.

---

## 1. What ui-skills.com teaches that applies here

The site's playbook is a list of small, testable rules. The ones that matter for long reading:

| Rule (ui-skills playbook / skill) | Where we break it today |
|---|---|
| Limit each view to one accent colour; keep secondary actions neutral | Coral is on the progress bar, hero dots, kickers, callout borders, section numbers, list bullets, TOC quick links, every Aarav mention, inline links and the CTA button. First viewport of L6 Notes has 11 coral elements. |
| Reserve brand colour for links and actions; keep headings neutral | Section numbers and list markers are coral. |
| Group with spacing, not dividers; space first, background shapes second, lines last | Figures, callouts, tables, checklists and glossary words are all bordered cards. Cards inside cards (the three "keys" under the HLD). |
| 60 to 75 characters per line, body 1.5 to 1.6, headings 1.2 to 1.3 | Paragraphs are 72ch at 16px, fine. But the column sits next to a 220px sidebar, so the eye has two columns to track. |
| Use sentence case for labels; uppercase at 14px or smaller needs tracking and should be rare | 6 to 15 uppercase mono kickers per page, plus every table header, plus checklist hints. |
| Subtractive design: every element needs a demonstrable purpose; hide necessary complexity; prefer a short view that links deeper | Two link systems in the sidebar (quick links above the contents), score rings and progress bars on the practice set before any task, a track picker card before the first section. |
| Avoid repeated animation in routine UI | Hover backgrounds on checklist rows and code lines, chips that shake, progress bar that tracks every scroll. |
| Improve contrast for muted text | `--ink3` at #8A8A8A on #F4F3EF is about 3:1, below the 4.5:1 body-text floor. Used for TOC numbers, captions, meta. |
| `text-wrap: balance` on headings, `pretty` on paragraphs; `tabular-nums` in tables | Not set anywhere. |

Three fonts are in play (Inter, JetBrains Mono, Caveat). The skill allows three, but mono is doing label work in prose: kickers, chips, `<code>` with its own border and background, meta lines. Mono inside a sentence reads as a change of voice. Fewer, quieter uses.

## 2. Where the noise comes from (audit of the live pages)

Counted on the live site, L6 Notes and Practice set, desktop 1516px and the first two screens.

**Chrome that never leaves the screen**
1. Coral 2px progress bar across the top, animating on every scroll.
2. Sticky header: brand in uppercase mono, three nav pills, theme button.
3. Sidebar: "ON THIS PAGE" label, then 3 to 4 coral quick links (whiteboard, lab, practice set), then a 13-row contents list with mono numbers and a 2px left rule. The quick links render above the contents because `docs.js` appends the section list after the `.sub` block. Two lists, two styles, one place.

**Inside the reading column**
4. Hero: uppercase coral kicker, then H1, then dek, then a meta row with three coral dots.
5. "The one thing to keep" card directly under the hero: coral left border, coral uppercase label. It competes with the H1 before reading starts.
6. Every H2 has a coral mono number. Every `<li>` has a coral marker.
7. Every mention of Aarav is a coral dotted link (6 to 10 per page).
8. `<code>` in prose has a background, a border and a radius: a small box every few words in sections 05, 09, 10, 12.
9. Figures are cards: border, kicker, H3, drawing, caption, then three bordered "key" boxes inside the same card. The practice set opens with one of these before any instruction.
10. Six distinct box styles across the two pages: `.call`, `.hold`, `.bigq` (dashed coral, Caveat 34px), `.wbx`, `.gl .w` glossary cards, `.ck` checklist card. Each has its own border, label and colour.
11. Practice set section 02 puts three coloured mono chips inside one sentence.
12. L5 practice set: hero, callout, three score rings, a track picker card, then section 01. The first task is below the fold.
13. Checklist rows highlight on hover, done rows turn green, a "Reset ticks" button and a progress bar sit under the list.
14. Table headers are uppercase mono on a grey band.

**Typography**
15. Body 16px, 1.6, 72ch. Good baseline, slightly small for the amount of prose (2,000+ words per Notes page). No `text-wrap`.
16. Muted text (`--ink3`) fails contrast for anything longer than a label.

## 3. The design: one column, one accent, one thing at a time

### 3.1 Principles for a reading page

1. **The text is the page.** Everything else is either a link away or sits at half the text's visual weight.
2. **One accent.** Coral means "you can click this" or "do this now". Nothing decorative is coral.
3. **Space before boxes.** A section is separated from the next by whitespace, not by a card. A box is allowed only when its content is a different kind of thing from prose: a drawing, a table, a form, a checklist. Never for emphasis.
4. **Labels in words, not in uppercase mono.** A kicker is allowed once, on the hero. Elsewhere, a label is a short sentence-case line in `--ink2`.
5. **Navigation is present, not loud.** You can always see where you are and jump anywhere, but the contents never pull the eye while reading.
6. **Nothing moves unless the reader moved it.** Scroll-linked and hover-triggered motion is removed from reading pages.

### 3.2 Layout

**Desktop (960px and up)**
- The reading column is centred in the viewport, `max-width: 68ch` at the new body size (about 720px). It no longer shares a grid with the sidebar.
- The contents become a **quiet rail** on the left of the column, outside it, at 1200px and up: section titles only, no numbers, no border rule, 13px, `--ink2`, current section in `--ink` with 500 weight. The rail is drawn at 55% opacity and returns to 100% on hover or keyboard focus. Below 1200px the rail is gone and the header's contents control (below) takes over.
- The quick links (whiteboard, lab, practice set, troubleshooting) leave the rail. They move to a **"Go on" block at the end of the page** (see 3.6) and, for the lab and practice set, to the top nav where they already are.

**Header**
- Stays sticky, but loses the progress bar. In its place, the header shows the **current section title** in the centre on reading pages (sentence case, `--ink2`, 13px), updated by the existing scroll spy. Tapping it opens a **contents popover** (a `<details>` styled list, same markup as the mobile TOC) with every section and a "Top" link. This is the "navigate or skip" affordance on every screen size.
- Brand stays, but in the same small sans as the nav, not uppercase mono. Nav pills unchanged. Theme button unchanged.

**Phone**
- Same as today's structure (mobile TOC in a `<details>`), restyled: the summary reads "Contents" in sentence case, no uppercase, no border. The header's current-section control is the primary way to jump.

### 3.3 Type

Set once in `docs.css` under a `body.read` scope so other C8 pages are untouched.

| Element | Now | Plan |
|---|---|---|
| Body | 16px / 1.6, Inter | `1.0625rem` (17px) / 1.65, `text-wrap: pretty`, `max-width: 68ch`, `overflow-wrap: break-word` |
| Lead paragraph | 17.5px, `--ink2` | 1.125rem, `--ink2`, only the hero dek |
| H1 | 32 to 52px / 1.05, weight 500 | clamp(30px, 4vw, 40px) / 1.15, weight 500, `-0.02em`, `text-wrap: balance` |
| H2 | 22 to 28px with coral mono number | 1.375rem (22px) / 1.25, weight 500, `-0.01em`, number removed from the heading. The number survives in the `id` and in the popover list as plain `--ink3` text |
| H3 | 17px | 1.0625rem, weight 600, same size as body: a bold line, not a smaller heading |
| Paragraph spacing | 14px | 1em (17px); 2.5em before an H2, 1.5em before an H3 |
| Lists | coral markers | markers in `--ink3`; 6px between items |
| Links | coral underline | unchanged. This is the only coral in running prose |
| Aarav link | coral dotted | `--ink` with a 1px dotted underline in `--ink3`; coral on hover. Still a link on every mention (per the earlier decision), no longer a highlight |
| `<code>` in prose | bg, border, radius | mono at .9em, `--ink`, background `--bg2`, no border, 2px radius |
| Strong | 700 (default) | 600 |
| Muted text | `--ink3` #8A8A8A | `--ink3` darkens to #6F6F6F in light, #8E8B84 in dark, so captions and meta pass 4.5:1. Labels under 13px that are purely decorative may stay lighter |
| Tables | uppercase mono th | th in sentence case, 13px sans, weight 500, `--ink2`, no grey band; `font-variant-numeric: tabular-nums` on the table |

Fonts: Inter and JetBrains Mono stay. Caveat stays only inside drawings (SVG) and the lab. The `.bigq` question is set in Inter at 1.375rem, weight 500, not in Caveat.

### 3.4 Boxes: six become two

| Today | Becomes |
|---|---|
| `.call` "one thing to keep" under the hero | Stays as the only framed note on the page, restyled: no border, `--bg2` background, 20px padding, radius 10px, label "Keep this" in sentence case `--ink2`. It moves to the **end** of the page on Notes (a summary is read after the text) and stays at the top on the Practice set (where it is the brief) |
| `.hold` open thread | Plain paragraph, prefixed in bold: **Open thread.** |
| `.bigq` dashed coral box | A pull line: one centred sentence, 1.375rem, weight 500, 2em of space above and below, no box |
| `.think` pause-and-think | Keeps its input (it is a control) but loses the border and coral rule: label in words, input, reveal |
| `.wbx` figure card | `<figure>` with no border: drawing on the page background, caption below in `--ink2` 15px. The three "keys" collapse into one caption sentence ("Numbers name the pieces, dashed zones show whose machine, arrows are API calls.") or a `<details>` titled "How to read it" when they need more |
| `.gl .w` glossary grid of cards | A definition list: term in 600 weight, definition on the same line, hairline between entries, inside a `<details>` titled "Words from this lecture" that is closed by default |
| `.cards` link grids | On reading pages, a plain list of links |
| `.q` inline chips in prose | Italic words. The coloured chip stays in the lab, where it is a control |
| `.ck` checklist | Keeps the card (it is a form), loses the hover highlight and the green fill; a done row shows a tick and `--ink2` text only |
| Score rings and `.stg` bars | Removed from the Practice set. One line of text replaces them: "2 of 4 ready", next to the checklist heading, updated by the existing `paint()` |
| `.trkpick` card (L5) | A one-line segmented control under the hero dek: "Track A · Track B · Both", no card, no helper copy |

Allowed on a reading page after this: at most **one** framed note, plus figures, tables and forms. Nothing else draws a border.

### 3.5 Practice set: one task in front of the student

The practice set is a to-do, not an essay. Order it as the student works:

1. Hero: title, one-line dek, due date as a plain sentence (no coral dots).
2. **What to submit**, moved to the top. The checklist is the spine. Each deliverable row links to where it is earned (section anchor or lab level). The "n of 4 ready" line sits beside the heading. "Reset ticks" moves into the header popover's footer as a text link, so it is reachable but not on the page.
3. The task sections (Draw yours, Fill the box, Rules) follow, each short, each ending with one primary action at most (one coral button per page, the lab link on L6, the raw request on L5).
4. The reference figure (Aarav's HLD) moves **below** "Draw yours" as a figure the student consults, not the first thing on the page.
5. The brief (`.call`) stays at the top as the one framed note.

L5: the three score rings, the callout and the track picker that precede section 01 compress into: hero, brief, segmented track control, then "What to submit", then the five steps. Prediction log and verifier keep their forms.

### 3.6 Explore and skip

- **Contents popover in the header** on every width: all sections, current one marked, "Top" and "Practice set" or "Notes" cross-link at the bottom. Keyboard: the control is a button, the list is focusable, Escape closes.
- **Quiet rail** at 1200px and up, as in 3.2.
- **"Go on" block** at the end of every reading page: three to five links in a plain list (next lecture page, the lab, the whiteboard, troubleshooting, the map). This replaces the sidebar quick links and the `.cards` grids.
- **Skip links inside the text** stay as ordinary sentences with links ("Practise it: Level 1 for things…"). They are already the right shape.
- **Keyboard**: existing `:focus-visible` ring stays coral (it is an action cue).

### 3.7 Motion

On reading pages: remove the progress bar, the `.up` entrance animation, hover backgrounds on `.ck li` and `.code .ln`, the vote-bar reveal. Keep: checkbox tick (120ms), popover open/close (150ms ease-out), theme toggle. `prefers-reduced-motion` rule unchanged.

### 3.8 Dark mode

Same tokens; the darker `--ink3` is mirrored. The framed note uses `--bg2`. Drawings already use `currentColor`.

## 4. Build plan

Keep the single-CSS, no-framework setup. All changes are additive behind `body.read`, so untouched pages keep their look until they opt in.

1. **Tokens and type** in `docs.css`: `body.read` scope with the type scale from 3.3, darker `--ink3`, `text-wrap`, `tabular-nums`. No layout change yet. Ship, compare side by side.
2. **Layout**: centred column, quiet rail at 1200px and up, sidebar grid removed under `body.read`. `docs.js`: build the rail and the popover from the same section list; stop merging `.sub` links into the TOC; header shows the current section from the existing observer; progress bar not created when `body.read`.
3. **Boxes**: restyle `.call`, `.hold`, `.bigq`, `.think`, `.wbx`, `.gl`, `.ck`; add `.pull`, `.goon`, `.ready` (the "n of 4" line). Remove `.scorebox` and `.stg` from reading pages. Segmented track control for L5.
4. **Page edits, L6 first**: `notes.html` and `practice-set.html` opt in (`class="read"`), coral numbers removed from H2s, keys folded into captions, glossary into `<details>`, chips to italics, "Keep this" moved to the end on Notes, practice set reordered per 3.5, "Go on" block added. Then L5, then L4.
5. **Pass**: phone at 360px and 390px, 200% zoom, keyboard only, dark mode, reduced motion. Count coral elements and boxes per screen against the budget below.
6. **Audit** with the installed `interface-design` skill and the ui-skills playbook list above before calling it done.

Each step ships on its own; the pages are never broken between steps.

## 5. The budget (how we know it worked)

Per viewport on a reading page, desktop and phone:

| Measure | L6 Notes today, first screen | Target |
|---|---|---|
| Coral elements (excluding inline links) | 11 | 1 or 0 |
| Framed boxes | 2 (hero note, figure) | 1 at most |
| Uppercase labels | 4 | 0 (1 on the hero if kept) |
| Columns the eye tracks | 2 | 1 |
| Things that move without input | 1 (progress bar) | 0 |
| Fonts in the prose column | 3 | 2 (Inter, mono for code) |

And one qualitative check with three students: open the Notes cold, read for two minutes, then ask "what did you look at that was not the text?" The answer should be "nothing" or "the heading in the top bar".

## 6. Decisions to confirm (none block step 1)

1. **Aarav links on every mention** stay as links but lose the coral. If you would rather link only the first mention per section, that is a one-line change in `docs.js`.
2. **"Keep this" at the end of Notes** rather than the top. If you want it at the top, it stays the only box there and the figure card count still drops.
3. **Section numbers** disappear from headings. They stay in the popover and in anchors (`#s07`) so existing links keep working.
4. **Caveat** leaves prose and stays in drawings. The one big question in the practice set becomes a pull line in Inter.
5. **Body at 17px**. If 16px is a house rule, keep 16px and widen the measure to 70ch; the rest of the plan holds.
