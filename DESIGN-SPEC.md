# C8 Module 2 Roadmap — Design Spec

Source of truth for the redesign of `c8-module2-roadmap.html`. This document is the plan. Once approved, the next step is building it.

---

## 0. What this page is for

The roadmap is not a syllabus. It is the first lecture, delivered as a page.

The module teaches one habit: **read a plan, approve it, verify the result.** The page should make the learner do exactly that with the curriculum itself. They read the principle, they see the plan derived from it, and they verify their own progress against binary milestones. If the page only lists lectures, it has failed the module's own standard.

### Teaching philosophy → design principles

| How we teach | What the page does |
|---|---|
| **Principle → Process → Tool.** Tools change, principles don't. | Page order is literally P → P → T. Principle section first, the road (process) second, lecture cards with tools last. Tools are the smallest, most replaceable text on the page (chips). Principle is the largest (hero). |
| **Feynman first.** Plain words before jargon. | Every technical term appears first in a plain sentence, then as a label. "Deterministic" never appears before "same input, same output, every time." |
| **Derive, don't list.** First principles, not analogy. | Nothing is presented as a given. Each section answers "why does this follow from the last one?" The road is *derived* from the three node types. Weeks are *derived* from the road. |
| **Socratic.** Ask back. | The page asks the learner questions before answering them: "Which track are you on?", "Which steps deserve rules?", "Did a real user complete the task?" Milestones are questions the learner answers about themselves, not badges the page awards. |
| **Binary checks.** Done is done or not. | Milestones are checkboxes with a written definition of done. No percentages, no "almost". |
| **Find the process by hand first.** | Week 0 is visually the origin point of the whole road, not an appendix. |

### Who, what, feel

- **Who:** A Cohort 8 learner. Mostly working professionals in India, opening this on a phone on Thursday night or a laptop on Saturday morning before a lecture. Some are non-coders who are nervous. Some are engineers who want to know "is this rigorous?" Both visit the page 12+ times over the module.
- **What they must do:** (1) On first visit: understand the shape of the module and pick a track. (2) Every week: find this week's lecture, see what they must be able to do after it, and see whether they cleared the last milestone. (3) At the cliff (Lecture 5): know it is coming and what to do about it.
- **Feel:** Calm and exact. A well-set engineering notebook, not a marketing page. Paper-warm surfaces, mono for anything that is a label or a fact, sans for anything that is a sentence. Motion is quiet and explanatory, never decorative. Nothing bounces.

### Signature element

**The road that draws itself from the principle.** The three colored node types (deterministic / probabilistic / human) inside the Process box become the three colored blocks of the road, which become the three colored phases of the timeline. Same three colors, same order, three zoom levels. The learner should be able to feel the derivation without reading a word.

---

## 1. User journeys

### Journey A — First visit (before Week 1)

1. Lands on hero. Reads the one principle. Rings drift slowly behind the headline.
2. Sees an inline question: **"Which track are you on?"** with two buttons. Nothing below the hero is track-specific until they answer. Answering writes the choice to storage and the segmented control in the header mirrors it.
3. Scrolls. The Input → Process → Output boxes arrive left to right in sequence, with a single dot travelling through them once. They understand the metaphor before reading the copy.
4. Opens the Process box. Three nodes emerge from inside it. Each node links to weeks. Hovering a node highlights its road block below. The mapping is learned by pointing, not by reading.
5. Reads the Week 0 note. Realises Week 0 is homework that already started.
6. Scrolls to the road. Four blocks, three colors, one locked. A "You are here" marker sits at the left edge of the Week 0 block.
7. Scrolls the timeline. The dashed line draws down as they scroll. Cards stagger in. Their first lecture card is highlighted as **Next**.
8. Leaves knowing: the principle, their track, what Week 0 wants from them, and when Lecture 1 is.

### Journey B — Weekly return (Thursday night)

1. Header shows a slim progress strip (the road in miniature) with a dot at the current week. Tapping it jumps to the current phase.
2. Page opens scrolled to the hero, but a floating **"This week: Lecture 7 · Sat 10 Oct"** pill appears bottom-right after the hero leaves the viewport. Tapping it scrolls to that card.
3. The current-week card is highlighted with a breathing marker. Past cards show a tick. Milestone cards show a checkbox they can tick: "A named user who did not build it completed the task." Ticking it fills the ring in the header (n of 5).
4. Leaves in under a minute.

### Journey C — The cliff (Week 3, no-code track)

1. On the Lecture 5 card, the cliff callout is visible from Week 2 onwards, not just on the day.
2. The card carries a coral edge and a short instruction: come to office hours the day before.
3. In the sticky header strip, the cliff is a small notch on the Part 1 segment. Hovering it says "Lecture 5: the cliff."

### Journey D — Mobile in the lecture

1. Single column. Road blocks stack. Timeline line hidden, week badges inline.
2. Track switch stays in the sticky header and never wraps to two lines.
3. Nothing requires hover. All cross-highlights have tap equivalents.

---

## 2. Global systems

### 2.1 Layout and type

Keep the current system. It is already right for the intent.

- Max width 1040px, 24px gutters, 16px on phones.
- `Inter` 500 for headings (never 600 or 700 on headings; the page is calm). `JetBrains Mono` for every label, date, kicker, tool name, and definition-of-done header.
- Type scale as is. Add one step: **`--t-caption` 11px mono, uppercase, letter-spacing .1em** is used in seven places already; name it.

### 2.2 Color

Keep the paper palette and the three semantic colors. Two additions:

| Token | Value | Use |
|---|---|---|
| `--now` | `var(--coral)` | Current-week marker, "You are here", the floating pill. Coral already means "attention", so "now" borrows it. |
| `--now-ring` | `rgba(242,96,60,.25)` | The breathing halo around the current-week marker. |

Rule: coral means **now or action**. Amber, violet, green mean **kind of component**. Grey means **locked or past**. Never mix these roles.

### 2.3 Motion tokens

```css
--d-micro: 120ms;   /* hover, press, chip color */
--d-small: 200ms;   /* segmented pill slide, tooltips */
--d-med:   320ms;   /* card reveal, zoom open */
--d-long:  480ms;   /* road fill, timeline draw */
--e-out:   cubic-bezier(.16,1,.3,1);   /* everything entering */
--e-in:    cubic-bezier(.55,0,1,.45);  /* everything leaving */
--e-io:    cubic-bezier(.65,0,.35,1);  /* moving between states */
--stagger: 60ms;
```

Rules:
- No spring or overshoot easing anywhere. The page's argument is that reliable systems don't guess.
- Transforms on enter are ≤ 12px translate or ≥ 0.96 scale. Nothing flies in.
- `prefers-reduced-motion: reduce`: keep opacity fades only. Kill translate, scale, the travelling dot, the ring drift, the breathing halo. The timeline line renders fully drawn.
- Reveal animations run once. Scrolling back up does not replay them.

### 2.4 Scroll reveal system

One `IntersectionObserver`, threshold 0.15, `rootMargin: 0 0 -10% 0`. Any element with `data-reveal` gets `.is-in` once. Children with `data-reveal-child` stagger by index × `--stagger`, capped at 8 children (beyond that, no extra delay, so long card grids don't feel slow).

### 2.5 Accessibility baseline

- All interactive elements are `<button>` or `<a>`, never a div with a click handler. The Process box becomes a `<button>`.
- Focus ring: 2px coral, 3px offset, on `:focus-visible` only.
- Cross-highlights (node → road block) are announced via `aria-describedby`, not just color.
- Track switch is a `role="radiogroup"` with two `role="radio"` buttons. Arrow keys move between them.
- Milestone checkboxes are real `<input type="checkbox">` with a visible label.
- Colored node types always carry a text label. The three dots are decorative.

---

## 3. Section-by-section spec

### 3.1 Header

**Layout.** As now: brand left, track switch right. Height 64px. Sticky with blur.

**New: progress strip.** A 3px strip along the bottom edge of the header, hidden while the hero is in view, fades in once the user scrolls past it (`--d-small`). It is the road in miniature: four segments in the road's proportions and colors (white/amber/violet/green, the last one striped for locked). A 8px coral dot sits at the current date's position. Segments are buttons that jump to their phase. Hover on a segment: it thickens to 5px and a mono tooltip names it.

**Track switch.**
- Change from two independently-colored buttons to a **sliding pill**: one coral pill moves behind the active label over `--d-small` with `--e-io`. Labels crossfade color.
- On change, the switch itself does nothing else. The content re-render is handled per card (see 3.7). No toast, no flash.
- Label "Your track" stays. On phones the label hides and the control stays on one line.

**Copy.** Brand tag `Cohort 8 · Module 2` stays.

### 3.2 Hero

**Layout.** As now. Rings stay.

**Animation.**
- Rings: a slow parallax, `translateY` of ±20px tied to scroll position over the hero's height, and a 60s linear infinite rotation of 2°. Barely perceptible. Off under reduced motion.
- Headline: fades up 12px over `--d-med` on load. The coral span "one principle." arrives 120ms after the rest.
- Subline: the three nouns **input, process, output** each gain their weight in sequence, 200ms apart, then settle. This is the only "typographic" animation on the page and it pre-loads the metaphor for section 3.3.
- Meta line and trackline: fade in after the subline.

**New: first-visit track question.** If no stored track:
- The trackline box is replaced by a question card: mono kicker `BEFORE YOU READ ON`, sentence **"Which track are you on?"**, two buttons `No-code` and `Code`, and one line under them: *"Same theory, same milestones. Different tools. Change any time from the top of the page."*
- Everything below the hero is rendered in the default track but the practical cards show a dimmed "Pick a track to see your tools" chip instead of tools until answered.
- On answer: the question card crossfades into the trackline (`--d-med`), the header pill slides, the practical cards' tool chips fade in.

**Copy suggestions.**

| Current | Suggested | Why |
|---|---|---|
| `Milestones 5 binary checks` | `Milestones 5 pass/fail checks` | "Binary" is jargon before the concept has landed. |
| (trackline, no-code) `You will not write code. You will read an agent's plan, approve it, and verify the result.` | `You will not write code. You will read an agent's plan, approve it, and verify the result. Same theory and same milestones as the code track.` | Removes the fear that no-code is the lesser track. |
| (trackline, code) `Same theory, same checks, your own backend.` | keep | |

### 3.3 The first principle (Input → Process → Output)

**Layout.** As now: three boxes, two arrows, Process outlined in coral.

**Animation on reveal.**
1. Input box fades up (`--d-med`).
2. First arrow draws: it is an inline SVG line + head, `stroke-dashoffset` animates over `--d-small`.
3. Process box fades up.
4. Second arrow draws.
5. Output box fades up.
6. A 6px coral dot travels Input → Process → Output once along the arrows over 1200ms, `--e-io`, and fades out inside Output. This is the whole lesson in one motion: something goes in, something happens, something comes out.

On hover of any box, the dot replays (desktop only, throttled to once per 2s).

**Process box interaction.**
- Becomes a `<button>` with `aria-expanded` and `aria-controls`.
- Hover: lifts 2px, border thickens to 2px coral, hint text underlines.
- Hint text: `Open the process ↓` / `Close ↑`. Not "zoom" — zoom is a tool metaphor, open is a plain one. The chevron rotates 180° on toggle.
- The dashed "INSIDE THE PROCESS" container opens with `grid-template-rows: 0fr → 1fr` (not `max-height`, which eases wrong) over `--d-med`. Content fades in 80ms after the row starts.
- The three nodes **scale from 0.96 and fade in, staggered left to right**, so they look like they emerged from inside the Process box above them. Each node's colored dot does a single 1.0 → 1.3 → 1.0 pulse on arrival.

**Cross-highlight.** Hover or focus on a node: the matching road block in section 3.4 gets a 2px ring in its color and the node's link underlines. Tapping the node link scrolls to the phase. On touch, the highlight is skipped and the link just works.

**Week 0 note.** Reveal it last, 200ms after the nodes. The coral `0` circle draws its border (SVG circle, `stroke-dashoffset`) rather than fading, so Week 0 is visibly the origin.

**Copy suggestions.**

| Current | Suggested | Why |
|---|---|---|
| `Tap the process to zoom in.` | `Open the process to see what is inside it.` | Device-neutral, plain. |
| `Zoom into any process and every step is one of three kinds.` | `Look inside any process and every step is one of three kinds.` | Same. |
| `Which steps deserve rules? Weeks 1 to 4 →` | `Which steps deserve rules? Weeks 1 to 5 →` | Lecture 8 is in Week 5 (see 3.6). |
| Node "Human": `Judgement. A person in the loop where the cost of a wrong answer is too high to hand over.` | `Judgement. A person stays in the loop wherever a wrong answer costs more than a slow one.` | Sharper reason. |
| Week 0 note: `The manual run is the map. Weeks 1 to 12 automate what the map shows.` | keep | This is the best sentence on the page. |

### 3.4 The road

**Layout.** As now: four blocks, column widths 2 / 4 / 6 / 3.

Change the proportions to match reality: Week 0 is not two weeks wide relative to four. Use `1.5fr 4fr 6fr 2fr` on desktop so the road reads as a calendar. Week 0 keeps a minimum width so its text fits.

**Animation on reveal.** Blocks fill left to right: each block's background is clipped (`clip-path: inset(0 100% 0 0)` → `inset(0)`) over `--d-long`, staggered by `--stagger` × 2. It reads as the road being laid.

**"You are here."** A coral vertical marker with a small mono label above it, positioned by the current date as a percentage across the road (Week 0 start to Week 12 end). Before 14 Sep it sits in the Week 0 block. After the module ends it sits at the far right. It fades in after the road fill completes and has the breathing halo (`--now-ring`, 2s ease-in-out infinite, off under reduced motion).

**Block interaction.**
- Hover: lift 3px, shadow deepens (as now). Add: the block's `wk` label brightens to full opacity.
- Click: smooth scroll to the phase, then the phase's week badge does a single 1.0 → 1.08 → 1.0 pulse on arrival so the eye lands on it.
- Locked block: stripes as now. Hover or focus shows a tooltip: `Opens after Lecture 18 · Fri 20 Nov`. The block is still a button and still scrolls to the locked phase.

**Cliff notch.** On the Part 1 block, a small coral tick mark at Lecture 5's position along the block's bottom edge, with a tooltip `Lecture 5: the cliff`. Only shown on the no-code track, since the cliff is a no-code phenomenon.

**Copy suggestions.**

| Current | Suggested | Why |
|---|---|---|
| `Tap a block to jump to its weeks.` | `Choose a block to jump to its weeks.` | Device-neutral. |
| Part 1 block `Weeks 1 to 4` | `Weeks 1 to 5` | Lecture 8 is Week 5 Friday. |
| Part 2 subtitle `LLMs, tools, retrieval, memory, harness, data, evals` | `LLMs, tools, retrieval, memory, evals` | Seven nouns is a list; five is a sentence. "Harness" is introduced inside the phase, not on the road. |
| Legend `Locked, opens later` | `Locked · opens after Lecture 18` | Say when. |

### 3.5 Curriculum timeline — structure

**Layout.** As now: vertical dashed line, week badge on the line, module tab, white group card per phase.

**Animation.**
- The dashed line is an SVG path whose `stroke-dashoffset` follows scroll, so the line is drawn as far as the user has scrolled. On reduced motion it is fully drawn.
- Week badges pop in (`opacity`, `scale .9 → 1`) as their phase enters.
- Cards stagger in, 8 cap.

**Current week.** The phase containing the current week gets a `.is-now` class. Its week badge carries the breathing halo. Inside it, the current week's card(s) get a coral left border (3px) and a small mono label `THIS WEEK` in the top row instead of the date only. The next upcoming lecture card, wherever it is, gets `NEXT · in 3 days` (relative wording for ≤ 7 days, absolute date otherwise).

**Past lectures.** The tick stays. The label changes from `Done` to `Held`. The page does not know if the learner attended; it only knows the date passed. Don't claim more than you know.

**Sub-arcs in Part 2.** Ten cards in one grid is a wall. Group them with a slim mono divider that spans the grid:

- `LLMs and tools · Lectures 9 to 11`
- `Retrieval and memory · Lectures 12 to 14`
- `Connecting the dots · Lecture 15`
- `Data, fine-tuning, evaluation · Lectures 16 to 18`

The data already has an `arc` field; render it.

### 3.6 Phase headers and ranges

Fix the week-boundary inconsistency. Lecture 8 (end-to-end MVP, milestone 1) is Week 5 Friday but sits in Part 1. Two honest options:

- **Recommended:** Part 1 badge `Weeks 1 to 5`, range `19 Sep to 16 Oct · Lectures 1 to 8`. Part 2 badge `Weeks 5 to 10`, range `17 Oct to 20 Nov · Lectures 9 to 18`. Week 5 appears in both and that is true: Friday ships the MVP, Saturday starts LLMs. The hero already says the milestone is the boundary, not the calendar.
- Alternative: move Lecture 8 into Part 2 as a "bridge" card. Not recommended: the MVP is the deterministic milestone.

Apply the same fix to the node links (3.3) and road blocks (3.4).

**Copy suggestions.**

| Current | Suggested | Why |
|---|---|---|
| Part 1 why: `Rules first. The three interfaces of every app (UI, API, database), then one deployed MVP in a real user's hands. Nothing here guesses.` | keep | |
| Part 2 why (long) | `Now add the components that predict instead of compute: LLMs, tool calling, retrieval, memory. Then shape them with data, fine-tune only when that is the right answer, and evaluate them against a rubric you wrote before seeing any output. Every one of them wrapped in a check.` | Same content, one fewer clause, "before seeing any output" is the point. |
| Part 3 why: `Where does a person have to stay? How agents are built for humans, and where human attention must remain.` | `Where does a person have to stay? Agents are built for humans, so the last question is where human attention cannot be automated away.` | Turns the fragment into a derivation. |
| Part 3 range `Locked · Opens after Lecture 18` | `Locked · Opens after Lecture 18 (20 Nov)` | Say when. |

### 3.7 Lecture cards

**Anatomy** (top to bottom): `Lecture n` + date row · title · chips (type, tool) · "You will be able to:" sentence · optional cliff · optional milestone.

**States.**

| State | Treatment |
|---|---|
| Upcoming | As now. |
| Next | Coral left border 3px, top-row label `NEXT · in n days`. |
| This week | Coral left border, label `THIS WEEK · Sat 10 Oct`. |
| Held (past) | Opacity .7, green tick, tick title "Held". |
| Locked | Dashed border, lock glyph, no hover lift. |
| Tools unannounced | Chip reads `Tool to be announced` in `--ink3`, dashed border, so it is visibly provisional. |

**Hover.** Border to coral, background to white, lift 2px, `--d-micro`. Focus-within shows the same.

**Track switch behaviour.** Do not re-render the whole timeline. For each practical card, only the tool chip and the "You will be able to" sentence change. Both crossfade: old fades out over `--d-micro`, new fades in over `--d-small`. The card height is locked during the swap (`min-height` set from the current height, released after) so the page does not jump. Theory cards do not move at all. This is the strongest possible demonstration that theory is shared.

**Milestone block (5 cards).**
- Heading `MILESTONE n of 5` in mono, phase color.
- Body: the definition of done, verbatim from data.
- New: a checkbox, `I cleared this`, stored in `localStorage` under `c8m2-ms-<n>`. Checking it: the checkbox fills over `--d-micro`, the block's left edge gets a 3px bar in the phase color, and the header ring (below) increments. Unchecking reverses. No confetti. Done is quiet.
- This is the learner verifying their own result, which is the module's habit.

**Milestone ring in header.** Next to the track switch, a 20px ring with a mono `n/5`. Fills clockwise as milestones are checked. Hover tooltip lists which are done. Hidden until the first milestone date has passed.

**Cliff block.**
- Keep the coral soft background. Add a 3px coral left border and the mono kicker `THE CLIFF`.
- Copy: `The track gets hard here. Come to office hours the day before, not the day after.`
- Visible from the moment the page loads, not date-gated. The point is warning.

**Copy suggestions, card-level.**

| Lecture | Current | Suggested | Why |
|---|---|---|---|
| 1 | `You will hear what this module asks of you: read a plan, approve it, verify the result.` | `Know what this module asks of you: read a plan, approve it, verify the result.` | Every other card starts with a verb the learner can do. |
| 5 no-code | `Move the app into Antigravity, read the agent's plan before approving it, and reject one wrong step.` | keep | "Reject one wrong step" is a perfect binary outcome. |
| 8 milestone | `Done equals: a named user who did not build it completes the task on the deployed link. Public moment 1.` | `Done means: a named person who did not build it completes the task on the live link. Public moment 1.` | "Done means" reads as plain speech; "equals" reads as code. "Live link" matches "put it live" elsewhere. Apply "Done means" to all five. |
| 10 | `Explain tool calling as the model asking for an action, not taking it.` | keep | Best one-liner in Part 2. |
| 15 | `Draw the control graph of your own system (deterministic, model and human nodes) and explain why the arrangement, not the model, decides reliability.` | `Draw the control graph of your own system, with its rule, model and human nodes, and explain why the arrangement, not the model, decides reliability.` | Parentheses out of prose; "rule" matches the plain word used in 3.3. |
| 16 | tools `TBD` | `Tool to be announced` (via existing normaliser, already handles TBD) | Consistency. |
| 18 | `Run an eval with a written rubric, and judge the judge: show one case where the LLM grader was wrong.` | keep | |
| Week 0 card top-right | `In progress` (hard-coded) | Date-driven: `Now` before 14 Sep, `Held` after. | Static state lies after Week 1. |

### 3.8 Floating "this week" pill

- Appears bottom-right (bottom-center on phones, above the safe area) once the hero scrolls out, fades in over `--d-small`, slides up 8px.
- Content: mono, `This week · Lecture 7 · Sat 10 Oct`. Before the module: `Starts · Sat 19 Sep · Lecture 1`. After Lecture 18: `Part 3 opens soon`.
- Tap: scrolls to the card. Hides while the card is in view, so it never covers what it points to.
- Dismissable with an × for the session.

### 3.9 Footer

Add one line under the brand in mono, `--ink3`: `Questions about the plan? Bring them to office hours.` (Channel name to confirm, see §5.)

---

## 4. Motion inventory (single list for the build)

| # | Element | Trigger | Motion | Duration / easing | Reduced motion |
|---|---|---|---|---|---|
| 1 | Hero headline | load | fade + up 12px, coral span delayed 120ms | `--d-med` `--e-out` | fade only |
| 2 | Hero subline nouns | load | weight 400 → 600, sequential 200ms | 3 × 200ms | none |
| 3 | Hero rings | scroll / time | parallax ±20px, 2° rotation over 60s | linear | none |
| 4 | Track question → trackline | answer | crossfade | `--d-med` | fade |
| 5 | Header pill | track change | translateX | `--d-small` `--e-io` | instant |
| 6 | Header progress strip | scroll past hero | fade in | `--d-small` | fade |
| 7 | IPO boxes and arrows | reveal | sequenced fade-up + stroke draw | `--d-med` each | fade |
| 8 | Travelling dot | reveal, hover | path motion I → P → O | 1200ms `--e-io` | none |
| 9 | Process open | click | `grid-template-rows` 0fr → 1fr, content fade | `--d-med` `--e-out` | fade |
| 10 | Three nodes | on open | scale .96 → 1 + fade, stagger; dot pulse | `--d-med`, 60ms stagger | fade |
| 11 | Week 0 circle | on open | SVG border draw | `--d-long` | none |
| 12 | Node → road cross-highlight | hover / focus | 2px ring in node color | `--d-micro` | same |
| 13 | Road blocks | reveal | clip-path fill left → right | `--d-long`, 120ms stagger | fade |
| 14 | "You are here" marker | after 13 | fade in, breathing halo | 2s loop | static |
| 15 | Road block hover | hover | lift 3px, shadow | `--d-micro` | color only |
| 16 | Jump target badge | after scroll | scale pulse 1 → 1.08 → 1 | 400ms | none |
| 17 | Timeline line | scroll | stroke draw | scroll-linked | fully drawn |
| 18 | Week badges | reveal | fade + scale .9 → 1 | `--d-small` | fade |
| 19 | Lecture cards | reveal | fade + up 12px, stagger, cap 8 | `--d-med` | fade |
| 20 | Card hover | hover | border, bg, lift 2px | `--d-micro` | color only |
| 21 | Track swap on card | track change | crossfade chip + sentence, height locked | `--d-micro` out, `--d-small` in | instant |
| 22 | Milestone checkbox | change | fill + left bar | `--d-micro` | same |
| 23 | Header ring | milestone change | arc fills | `--d-med` `--e-out` | instant |
| 24 | Floating pill | hero exits | fade + up 8px | `--d-small` | fade |
| 25 | Process chevron | toggle | rotate 180° | `--d-small` | instant |

Nothing else on the page moves.

---

## 5. Open questions (need an answer before build, none block the start)

1. **Office hours channel.** Footer and cliff copy say "office hours". Is that Discord, a calendar link, or something else? Copy will link it.
2. **Unnamed tools.** Lectures 11 (no-code), 13, 14, 15, 16 show "Tool to be announced". Fine for launch. Confirm they will be filled before Week 6 so the provisional chip style does not become permanent.
3. **Milestone self-check persistence.** Spec uses `localStorage` (per device). If you want it to survive across devices or to see cohort-wide completion, it needs a backend. Recommend shipping local first.
4. **Week 5 overlap.** Confirm the recommended "Weeks 1 to 5 / Weeks 5 to 10" fix in §3.6.
5. **Part 3 unlock.** Is it date-gated (after 20 Nov) or manually flipped? Spec assumes date-gated with a constant you can override.

---

## 6. Build plan (next step, after this spec is approved)

Keep the single-file, no-framework approach. It is the right call for a page that will be forked per cohort.

1. **Tokens and motion system.** Add motion tokens, `--now` colors, reveal observer, reduced-motion rules. No visual change yet.
2. **Structural fixes.** Process box → button. Week boundary fix. Sub-arc dividers. "Held" instead of "Done". Date-driven Week 0 state.
3. **First-visit track question** and per-card crossfade swap.
4. **Now-awareness.** Current-week card state, "You are here" marker, header progress strip, floating pill.
5. **Principle section motion.** Sequenced IPO reveal, travelling dot, grid-rows open, node emergence, cross-highlight.
6. **Road and timeline motion.** Clip-path fill, scroll-drawn line, badge pulse on jump.
7. **Milestones.** Checkboxes, storage, header ring.
8. **Copy pass** from the tables above, then a reduced-motion pass, then a phone pass at 360px and 390px, then keyboard-only pass.
9. **Audit** against the installed `12-principles-of-animation` and `interaction-design` skills before calling it done.

Each step ships independently. The page is never broken between steps.
