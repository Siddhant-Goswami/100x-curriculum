# Eval log: api/verify.mjs against the gold set

One entry per run of eval_verify.mjs. Tune only the criteria text and the thresholds.

## Run 2026-10-19 08:15 · jev-1.13.0 · via https://100x-curriculum.vercel.app

**Sort, 300 tasks.** Accuracy 93.7% · macro-F1 0.936 · human recall 85.0% · a/b disagree 1.3% · unsure 28.3% · split asked 0.3% · ship bar not met

- det: precision 96.1%, recall 99.0%, F1 0.975
- prob: precision 86.6%, recall 97.0%, F1 0.915
- hum: precision 100.0%, recall 85.0%, F1 0.919

| gold \ got | det | prob | hum |
|---|---|---|---|
| det | 99 | 1 | 0 |
| prob | 3 | 97 | 0 |
| hum | 1 | 14 | 85 |

- undefined (300): accuracy 93.7%, macro-F1 0.936, human recall 85.0%, unsure 28.3%

- questions asked: rule 52, criteria 17, live 11, reach 5, split 1

<details><summary>19 misses</summary>

- g029 prob → det: Write unit tests for edge cases in the pricing function
- g033 prob → det (asked): Refactor the order service into smaller functions without changing behaviour
- g051 hum → prob (asked): Decide whether to rewrite the billing service
- g056 hum → prob (asked): Choose the tech stack for a new product line
- g061 hum → prob (asked): Give feedback to a teammate on a missed deadline
- g064 hum → prob (asked): Decide which tech debt to pay down this quarter
- g066 hum → prob (asked): Write peer feedback for a colleague's performance review
- g074 hum → prob (asked): Decide build vs buy for the feature flag system
- g130 hum → prob (asked): Decide whether to pivot to the enterprise segment
- g138 hum → prob (asked): Decide pricing for the new enterprise tier
- g145 hum → prob (asked): Decide how much of the runway to spend on marketing
- g153 det → prob (asked): Format the deck to the firm template fonts, colours and logo placement
- g215 hum → prob (asked): Decide how to staff consultants across engagements
- g217 hum → prob (asked): Advise the client on whether to exit a business line
- g221 hum → det: Track whether the cost programme delivers savings after 12 months
- g224 hum → prob: Decide when to escalate a delivery risk to the partner
- g268 prob → det: Write Selenium scripts for the regression pack
- g284 hum → prob (asked): Decide which resources to release from the project
- g293 hum → prob (asked): Decide whether to escalate a slipping milestone to the delivery head

</details>

**Checks, 60.** is_clear separates 90.0% (bar 85%: MET) · is_rule 75.0% · verified = good 90.0%

- good_rule: verified 15 of 15
- vague_rule: verified 3 of 15
- good_rubric: verified 12 of 15
- vague_rubric: verified 0 of 15

### Tuning, 19 Oct 2026
Run 1 above used T = {live .6, reach .4, rule .4, criteria .4, fence .1, top .6}: 14 human tasks ("Decide whether to rewrite the billing service", "Decide pricing for the new enterprise tier") went violet, and 28% of tasks asked a question, mostly rule.
A sweep over the saved signals (live .5–.7, reach .2–.4, rule/criteria .3–.5, fence 0–.1, top .5–.6) picked T = {live .5, reach .2, rule .3, criteria .4, fence .05, top .6}. Replay of the same 300 tasks:

**Sort, 300 tasks.** Accuracy 95.3% · macro-F1 0.953 · human recall 91.0% · a/b disagree 1.3% · unsure 11.7% · split asked 0.3% · ship bar MET
- software_engineer: accuracy 92.0%, human recall 84.0% (weakest) · founder 97.3%, 92.0% · management_consultant 94.7%, 92.0% · it_services 97.3%, 96.0%
- questions asked: rule 21, live 10, criteria 2, reach 2, split 1

Caveat: thresholds were tuned and scored on the same 300 tasks, and the labels were drafted by a model, not two people. Write a fresh held-out set before trusting the number further.

Then fence 0 (asked for fewer questions after a live software-engineer week still asked on 4 of 10): questions only when the two orderings disagree or no bucket reaches .6. Replay: same accuracy 95.3%, macro-F1 0.953, human recall 91.0%; unsure 3.0% (rule 4, criteria 2, live 2, reach 1, split 1).
