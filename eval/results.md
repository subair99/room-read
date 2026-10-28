# Evaluation: RoomRead vs AI-only baseline

Run on 2026-10-28 · 12 of 12 original scripts completed · swaps included · model: qwen3.8-max-0902.

The baseline is the same model, given the same script and audience, asked the same question with no Qloo data (`lib/baseline/llmOnly.ts`).

## Headline

| Measure | Result | What it means |
| --- | --- | --- |
| References found | 36 (81% (29/36) resolved to a Qloo entity) | Coverage of the extract + resolve steps |
| Bands | 2 green · 18 amber · 6 red · 10 no signal | RoomRead never guesses where Qloo has no data |
| Baseline "will land" calls Qloo confirms (green) | 9% (2/22) | How often the AI's confidence is backed by data |
| Baseline "will land" calls Qloo scores **red** | 27% (6/22) | Confident misses the writer would have shipped |
| Qloo red references the baseline also flagged | 0% (0/6) | Misses the AI alone would have caught |
| Unsupported "universal / iconic" claims | baseline 6 · RoomRead 0 | Claims of popularity with no evidence |
| Red references with an accepted swap | 33% (2/6) | The rest get "keep the original" rather than a forced swap |
| Uncached Qloo calls per script | 8.1 | |
| Seconds per script (check only) | 29.1 | |

## Per script

| Script | Kind | Mode | Refs | G / A / R / ? | Verdict | Baseline land calls → Qloo red | Red swapped / kept |
| --- | --- | --- | --- | --- | --- | --- | --- |
| e01 | standup | check | 2 | 0 / 0 / 0 / 2 | ship | 0 of 0 | 0 / 0 |
| e02 | standup | check | 3 | 1 / 2 / 0 / 0 | tweak | 0 of 2 | 0 / 0 |
| e03 | toast | bridge | 3 | 0 / 1 / 1 / 1 | rework | 1 of 1 | 1 / 0 |
| e04 | toast | bridge | 3 | 0 / 3 / 0 / 0 | tweak | 0 of 3 | 0 / 0 |
| e05 | ad | tour | 3 | 0 / 2 / 1 / 0 | tweak | 1 of 2 | 0 / 1 |
| e06 | ad | check | 3 | 0 / 0 / 1 / 2 | rework | 1 of 1 | 0 / 1 |
| e07 | keynote | check | 2 | 0 / 1 / 0 / 1 | ship | 0 of 1 | 0 / 0 |
| e08 | keynote | check | 4 | 0 / 4 / 0 / 0 | tweak | 0 of 4 | 0 / 0 |
| e09 | lesson | check | 3 | 0 / 1 / 1 / 1 | rework | 1 of 2 | 1 / 0 |
| e10 | lesson | check | 2 | 0 / 1 / 0 / 1 | ship | 0 of 1 | 0 / 0 |
| e11 | standup | tour | 4 | 1 / 1 / 0 / 2 | ship | 0 of 1 | 0 / 0 |
| e12 | ad | bridge | 4 | 0 / 2 / 2 / 0 | rework | 2 of 4 | 0 / 2 |

## Reviewer ratings

_To add: blind 1–5 ratings from `eval/reviewer-sheet.csv` (does the swapped line keep the joke's job; does it fit the crowd). Reviewers: n = ?, roles._

## Limits

Small sample of original scripts. This measures grounding (whether claims about an audience are backed by data), not whether a joke is funny or an ad sells. "Agreement" treats Qloo's band as the reference point, so it measures how far the AI alone departs from the data, not ground truth about any individual.
