# Request → result walkthrough (redacted)

_Fill this in from one real run after the spike. Keys, headers and personal data must never appear here._

## 1. Request
- Script: the stand-up opener from judge mode (original text)
- Audience: Houston · 18-34
- Rules: none

## 2. Extraction (LLM)
References found: `…`

## 3. Resolution (Qloo)
| Reference | Tool | Status | Entity chosen | Why |
| --- | --- | --- | --- | --- |
| | `qloo_describe` | | | |

## 4. Ranking (Qloo)
`qloo_rank` with the script's references plus the anchor set for that type, audience signals for 18-34 and Houston.
Paste the redacted arguments and the returned order here.

## 5. Interpretation (RoomRead)
Rank → percentile position → band (top third green, middle amber, bottom red). Show the numbers for each reference.

## 6. Swap (Qloo + LLM)
`qloo_entity_tags` → `qloo_recommend` → `qloo_rank` (original vs candidate in one query) → rewrite → accepted or next rung.

## 7. What this does NOT establish
Aggregate affinity of an audience segment only. Not a prediction about any person, and not a judgment of whether the joke is funny.
