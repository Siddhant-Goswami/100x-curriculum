# Delegation framework: any job, your own tasks, sorted by Jev

Status: plan, not built. Lives in `_plan/` so it is never deployed.
API: TypeSafe Jev, called directly. `TYPESAFE_API_KEY` is set in the Vercel dashboard.

## Goal
Anyone, in India or anywhere else, names their job, writes the tasks they actually do, and gets their job rebuilt
as three buckets by how the work can be checked:

| Bucket | Map colour | Checked by | What the agent does |
|---|---|---|---|
| **Deterministic** | amber | a rule: a program can say pass or fail | runs it alone once it passes the trust test (Autonomous) |
| **Probabilistic** | violet | a judgement written down as clear criteria that an LLM judge or a colleague applies the same way every time | drafts it; a judge checks it against your criteria; you spot-check (Accelerated) |
| **Human** | green | nothing reliable: you can't write the criteria, the result shows up only later, or it happens live, by hand, or under your signature | stays with you; the agent can prepare inputs |

The page today starts from O*NET's 923 US jobs and regexes over O*NET's wording. That's replaced by the
learner's own words and a decision model.

## 1. The learner's flow
1. **Your job.** One text box. As they type, O*NET titles are suggested, but whatever they type is accepted
   ("CA articleship", "Kirana store owner", "Ops lead, quick commerce"). An O*NET match only adds task
   suggestions; it isn't required.
2. **Your tasks.** Up to 12 rows: the task in one line, how often (a fixed list: daily, a few times a week,
   weekly, monthly, quarterly), and minutes each time. Suggestions under the box: the matched O*NET job's tasks,
   or keyword matches from a task bank (O*NET plus ~1.5k written for Indian and global roles). Tap to add,
   then edit.
3. **Sort.** One click sends all tasks to `/api/verify`. Each row gets a colour, a one-line reason, and, when
   Jev is unsure, one or two yes/no questions for the learner instead of a guess.
4. **Write the check.** Every amber or violet task asks "How would you check it?" with a template:
   - amber: "It passes if ___" (for example "the GSTR-2B total matches the purchase register to the rupee")
   - violet: up to three criteria (for example "names the client's actual number", "no promise of dates",
     "under 150 words")

   Jev then tests the check (step 3b below). A violet task whose criteria aren't clear stays green until they
   are. That's the "verified judgement" rule: no written criteria, no delegation.
5. **Your job, rebuilt.** Hours a week in each bucket, the existing story cards, the K, and the agent advice,
   all driven by the learner's own tasks. Every colour can be overridden. A "Copy link" button encodes the week
   in the URL hash, so nothing is stored on a server.

## 2. The three buckets, as Jev sees them
These definitions are the rubric. They go verbatim into the Choice `criteria`, and the team labels the test set
with the same text. Jev reads literally (jaggedness note 1), so each option names its boundary cases.

- **deterministic**: "A finished version can be checked by a fixed rule with one right answer: totals match,
  a format or field is present, a file exists, a test passes, a value is inside a limit. A program could run the
  check without any opinion."
- **probabilistic**: "There are several acceptable versions, so checking needs judgement, but that judgement
  can be written as specific criteria, like a rubric or checklist, that two careful reviewers would apply and
  agree on. The output can be reviewed as text, data or a file soon after it is made."
- **human**: "The quality can't be written as criteria two reviewers would agree on, or the result shows up
  only much later, or the task happens live with people, by hand in the physical world, or needs a person's
  authority or signature."

Examples for each (in the gold set and in the page copy):
- deterministic: reconcile bank statement with ledger; resize product photos to 1080x1080; check that an
  invoice has GSTIN and HSN codes; post the daily sales sheet to the team group by 9 am.
- probabilistic: first draft of a client status email; summarise a 40-page tender; tag support tickets by
  issue; shortlist resumes against a written must-have list.
- human: negotiate payment terms with a supplier; decide whom to hire; counsel a student who failed prelims;
  inspect stock at the godown; sign the audit report.

## 3. The Jev requests
`model: "jev-1.13.0"`, pinned. Thresholds are tuned against this version, and `jev-latest` moves when a new
release ships.

### 3a. Sort (one request per task, sent in parallel, at most 12)
`state` holds only what the questions need (jaggedness note 5):
```json
{ "job": "CA articleship", "task": "Reconcile GSTR-2B with the purchase register", "how_often": "monthly" }
```
Questions (all in one call):

| Key | Type | Asks |
|---|---|---|
| `bucket_a` | choice | "How can a finished version of `task` be checked?" Options in the order det, prob, hum, with the criteria above |
| `bucket_b` | choice | the same question, options in the order hum, prob, det (jaggedness note 8: order can move the answer) |
| `rule` | noul | "Could a program check a finished `task` with a fixed pass/fail rule?" |
| `criteria` | noul | "Could the person write down criteria for a good `task` that two reviewers would apply the same way?" |
| `live` | noul | "Does `task` happen live with people, by hand in the physical world, or need the person's signature or authority?" |
| `reach` | noul | "Could an AI agent working on a computer get every input `task` needs?" |
| `undo` | noul | "If `task` were done wrong, could the mistake be caught and undone before it reaches a client, money or another person's numbers?" |

All arithmetic (hours a week, averages, thresholds) is done in code, never asked of Jev (jaggedness note 2).

**Combining the answers in code** (`classify()` in `api/verify.mjs`):
1. `p` = the average of `bucket_a` and `bucket_b` probabilities. `bucket` = the arg max.
2. Guardrails, in order:
   - `live` > 0.6 or `reach` < 0.4: human
   - bucket det but `rule` < 0.4: prob
   - bucket prob but `criteria` < 0.4: human
3. **Unsure** when any of these holds:
   - `bucket_a` and `bucket_b` disagree
   - the top `p` < 0.6
   - a guardrail noul is between 0.4 and 0.6

   Then the response carries which noul questions to ask the learner, reworded for people ("Could a program
   check it with a fixed rule?"). Their answers replace the nouls and step 2 runs again in the browser.
4. Return `{bucket, p, reason, ask:[...], undo, model}`. `reason` is chosen in code from the deciding signal
   (for example "happens live with people", "a rule can check it", "you can write the criteria").

### 3b. Check the check (one request per amber or violet task, after the learner writes it)
`state`: `{ "task": ..., "check": "<what the learner wrote>" }`

| Key | Type | Asks |
|---|---|---|
| `is_rule` | noul | "Is `check` a fixed rule a program could apply with a pass or fail result?" |
| `is_clear` | noul | "Is `check` specific enough that two careful reviewers would reach the same verdict on the same output?" |
| `fits` | noul | "Does `check` test whether `task` was done well, rather than something unrelated?" |

- amber: `is_rule` ≥ 0.6 and `fits` ≥ 0.6 keep it amber. Otherwise it moves to violet, with the note "This
  check needs judgement; write it as criteria".
- violet: `is_clear` ≥ 0.6 and `fits` ≥ 0.6 make it **verified judgement**. Otherwise it is shown as green
  until rewritten, with the note "Make the criteria specific: what exactly would you look for?". Up to three
  tries, then the learner can override.
- A violet check that passes `is_rule` too is upgraded to amber.

### 3c. Building the job (all in the browser, no API)
- Minutes a week per task = minutes × times per week (fixed table: daily 5, few/week 3, weekly 1,
  monthly 0.25, quarterly 0.08).
- Hours per bucket and share of the week. These feed the existing story, the "Your week" table, the K and the
  agent advice.
- Level per task:
  - amber with `undo` ≥ 0.6: Autonomous after 8 of 10
  - amber with low `undo`: Accelerated
  - violet: Accelerated with an LLM judge using the learner's criteria
  - green: You
- Hours saved use the page's current multipliers (Accelerated 0.6, Autonomous 0.15), plus the "new work" of
  checking.

## 4. `api/verify.mjs` (Vercel function, no dependencies, like `api/aarav.mjs`)
- `POST /api/verify` `{job, tasks:[{task, how_often}]}` returns `{tasks:[{bucket, p, reason, ask, undo}], model}`.
- `POST /api/verify?step=check` `{task, check, bucket}` returns `{bucket, verified, note}`.
- `fetch('https://api.typesafe.ai/v1/systemone', {Authorization: 'Bearer ' + process.env.TYPESAFE_API_KEY})`,
  tasks in parallel with `Promise.all`, 8 s timeout.
- Limits:
  - At most 12 tasks, 200 characters per task, 400 per check, 80 for the job.
  - Strip control characters.
  - Simple per-IP limit (20 calls in 10 minutes) in module memory. It's best-effort, which is enough for a
    course page at $0.042 per 1M tokens.
- Errors:
  - On a 429, retry once after `retry-after`.
  - On a 401, 5xx or timeout, return `{fallback:true}` so the page asks the questions by hand.
  - Never pass TypeSafe error bodies through to the page.
- Logging: the model version and the bucket only, never task text. The page says, in one line under the button:
  "Your tasks are sent to TypeSafe's Jev to be sorted. They aren't stored or used for training."
- Prompt injection: tasks are learner-written, so a task could argue for its own bucket (jaggedness note 6).
  Low risk, since the only effect is their own colour, which they can override anyway. The questions refer to
  `task` by name, and the definitions stay in `criteria`.

## 5. Page changes (`c8/delegation-framework/index.html`)
| Section | Change |
|---|---|
| `#job` "Start with your job" | free-text job, O*NET suggestions optional; the "pick from 923" copy goes |
| new `#tasks` "Write your week" | task rows, suggestions, the Sort button, inline unsure questions |
| new `#checks` "How you'd check each one" | check templates for amber and violet rows, verified state |
| `#story` cards | copy no longer says "O*NET surveyed people who work as…"; uses the learner's job string; three buckets named as above |
| `#yours` table | adds the Check column; "Back to O*NET's answers" becomes "Back to Jev's answers" |
| `#card` rules | rule 2 becomes the three-bucket test; rule 3 (undo) and 4 (8 of 10) stay |
| `#k`, `#agents` | unchanged logic, fed by the new tasks |
| Method note + sources | Jev 1.13, the rubric, the gold-set score, "override it when you know better"; O*NET credit stays for suggestions |
| Footer | "Sorted by TypeSafe Jev 1.13 · Suggestions: O*NET 31.0, CC BY 4.0" |

The current flow (pick an O*NET job, get its 12 tasks) remains as a shortcut: "Start from O*NET's list for
this job". It fills the rows, then they go through the same Sort.

`kind()` changes from flags j/r/c/u to the bucket and `undo`. The O*NET regex screen in `build_onet.py`
stays only for the O*NET defaults, as the offline fallback.

## 6. Proving it works
- `_plan/gold.csv`: 300 tasks hand-labelled by two people using section 2's text.
  - Half from Indian and non-US roles, 30 in Hinglish.
  - Disagreements are settled and then logged. Rows the two people couldn't agree on are dropped, since if
    people can't agree, Jev can't be scored.
- `_plan/eval_verify.mjs` runs the gold set through `classify()` and reports:
  - accuracy and macro-F1
  - recall on human tasks
  - how often `bucket_a` and `bucket_b` disagree
  - the unsure rate
  - a confusion matrix
- **Ship bar:** macro-F1 ≥ 0.80, human recall ≥ 0.90, and an unsure rate under 25% (asking too many questions
  wears learners out).
- Tune only the criteria text and the thresholds, then re-run. Keep a log of each run in `_plan/eval_log.md`.
- Same for checks: 60 hand-written checks (good rule, vague rule, good rubric, vague rubric). `is_clear` should
  separate them at ≥ 0.85 accuracy.

## 7. Build order
1. **Smoke test (day 1).**
   - `vercel env pull` to a gitignored `.env.local`, then call `/v1/models` and one `systemone` request with
     the sort questions on five tasks.
   - Confirm the response shape and latency.
2. **Rubric and gold set (days 1–2).** Write section 2's text, label the 300, write the 60 checks.
3. **`api/verify.mjs` and eval (days 2–3).** Iterate until the ship bar is met.
4. **Page (days 3–5).** Free-text job, task rows, Sort, unsure questions, checks, re-wire story, table, K and
   agents. Keep the reading-mode layout and the map colours.
5. **Copy and method note (day 5).**
6. **Test (day 6).**
   - Phone and desktop.
   - The API-down fallback (wrong key in preview).
   - 12 tasks at once.
   - A Hinglish week.
   - A week that's all green.
7. **Deploy.** Preview URL first, then production.

## 8. Risks
| Risk | Mitigation |
|---|---|
| Hinglish and other languages are weaker | 30 Hinglish tasks in the gold set; if they miss the bar, a note asking for English task lines |
| Learners write vague tasks ("reporting") | Before sorting, a single noul "Is `task` one specific, repeatable task?"; if no, ask them to split it |
| Option order shifts the answer | two orderings per request; disagreement means unsure |
| Version drift | pinned `jev-1.13.0`; re-run the eval before moving to 1.14 |
| API down or key revoked | fallback to hand-answered questions; the page still works |
| Cost | ~400 tokens per task, so a full week is ~5k tokens, about $0.0002 |

## 9. Decisions needed
- Keep the O*NET shortcut, or free text only?
- Hinglish: support it at launch, or English task lines only?
- Who labels the gold set (two people, about three hours each)?
