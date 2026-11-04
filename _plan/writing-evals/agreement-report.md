# Agreement report

Built by `build_data.py`, version 2026-11-01.1. Agreement = share of (item, dimension) cells within one point on a 1 to 5 scale.

| Industry | Hard fails | Expert vs expert | First-draft judge vs experts | Anchored judge vs experts | Gap closed by the edit |
|---|---|---|---|---|---|
| Support | 9 of 30 | 86% | 67% | 83% | +16 points |
| Legal | 11 of 30 | 84% | 59% | 83% | +24 points |
| Healthcare | 10 of 30 | 82% | 66% | 82% | +16 points |
| Manufacturing | 15 of 30 | 84% | 67% | 81% | +13 points |
| Finance | 10 of 30 | 86% | 64% | 84% | +20 points |

Blind grading, recorded room: 40 sheets, agreement within one point 71%.

What the lecture promises: experts 80 to 85, first-draft judges 55 to 70. The build refuses to write files unless every industry lands inside 80 to 86 and 56 to 68, with the anchored judge at least 10 points above the draft and no higher than the experts.

Provenance: simulated expert passes and simulated judges (see the docstring). With a Groq key, run both rubrics in `rubric-edit.json` on the live page and record the real numbers here.
