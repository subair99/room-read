# RoomRead

**Read the room before you're in it.** RoomRead is a culture-check agent for stand-up sets, toasts, keynotes and ads. It finds every cultural reference in your text and uses Qloo's taste graph to rank how strongly your audience (age band and/or city) loves each one. It swaps in references that rank higher, re-checks every swap, and shows a receipt for every verdict.

> Every writer has a spell-checker. Nobody has a reference-checker. Now they do.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com) during the submission period (30 Sep – 30 Oct 2026).

- **Live demo:** _add URL_
- **License:** MIT

## The problem

A cultural reference is a bet that the audience shares your taste. When it misses, the joke dies, the analogy confuses and the ad wastes its spend. An LLM can't tell you which references a specific crowd knows and loves; it only knows what's been written about them. Qloo knows audience affinity by age and place.

## What it does

| Mode | Question it answers |
| --- | --- |
| **Check** | Will these references land with this audience? |
| **Bridge** | Which references work for *both* of two audiences (say, a wedding's friends and parents)? |
| **Tour** | How do the references change city by city? It can also write a promo blurb for a city and then culture-check its own copy. |

Every run ends with a verdict (**Ship it**, **Tweak N lines** or **Rework**), a receipts drawer and a printable room brief. A **Without Qloo** toggle shows what the LLM alone says about the same text.

## How it works

```
script + audience
  → extract references (LLM)
  → resolve each to one Qloo entity (qloo_describe; ask the user when ambiguous)
  → rank per audience, together with a fixed anchor set (qloo_rank, qloo_where_popular)
  → trend flags (qloo_trends)
  → band: top third green, middle amber, bottom red (Bridge/Tour: the worse audience)
  → for weak references: equivalents (qloo_entity_tags → qloo_recommend)
      → rewrite (LLM) → re-rank original vs candidate in ONE query
      → retry ladder: next equivalent → restructure the line → flag for you
  → verdict + receipts
```

The LLM handles language. Qloo makes every judgment. Plain code enforces the order and the rules.

### Scoring rules

1. **Rank, don't average.** Qloo scores are normalized per query, so RoomRead compares rank positions *within one query* and never mixes raw scores across queries.
2. **Anchors.** Each ranking includes a fixed set of well-known titles from several eras, so "green" means "top third against a stable yardstick", not "best of the four references in this script".
3. **Bridge.** Choose the reference whose worse audience rank is best; ties go to the better average.
4. **A swap must earn it.** A candidate is accepted only if it ranks higher than the original in the same query and the rewritten line actually contains it.
5. **Label everything.** Qloo results, RoomRead's interpretation, your rules and AI-written text are shown separately in the receipts.

### Qloo tools used, and why

| Tool | Why RoomRead calls it |
| --- | --- |
| `qloo_describe` | Resolve a reference ("that Seinfeld bit") to one entity; returns candidates when ambiguous |
| `qloo_find_tags` | Map vibe words to real Qloo tags |
| `qloo_rank` | Rank references plus anchors for an audience: the core score |
| `qloo_where_popular` | Place signal for Tour mode |
| `qloo_trends` | Flag references that are rising or fading |
| `qloo_entity_tags` | Capture what makes the original work (genre, era, mood) |
| `qloo_recommend` | Find same-type equivalents this audience loves |
| `qloo_audience_demographics` | Explain who a red reference *does* land with |

A redacted request → result walkthrough is in [docs/request-to-result.md](docs/request-to-result.md).

## Run it

Requirements: Node.js 22.19+, the Qloo event credential, and a Claude or Azure OpenAI key.

```sh
npm install --global @qloo/qloo-harness   # must be >= 0.1.26
qloo setup --qloo                          # enter the event credential
qloo setup --status

git clone <this repo> && cd room-read
cp .env.example .env.local                 # add your model key; never commit it
npm install
npm run spike                              # day-1 check: prints GO / NO-GO
npm run dev                                # http://localhost:3000
```

Other scripts: `npm test` (unit tests), `npm run eval` (baseline vs RoomRead), `npm run mcp` (RoomRead as an MCP tool, `culture_check`).

### Deploy

One always-on Docker container (Railway, Fly.io, Render paid tier or Azure Container Apps). The Next.js server spawns `qloo mcp` as a child process, so serverless hosts won't work. Set `QLOO_API_KEY` and the model key as host secrets.

```sh
docker build -t roomread .
docker run -p 3000:3000 -e QLOO_API_KEY=... -e ANTHROPIC_API_KEY=... roomread
```

## Evaluation

12 original scripts, run through an honest LLM-only baseline and through RoomRead. See [eval/results.md](eval/results.md) for the measures and the real numbers once run.

## Responsible use and known limitations

- Scores describe **aggregate affinity of an audience segment**. They are not a prediction about any person.
- RoomRead checks whether a reference is **familiar and loved**, not whether a joke is funny.
- Age band and place are the only audience inputs. No personal data is sent to Qloo.
- Thin data shows as "not enough signal". RoomRead never guesses or invents a number.
- Ambiguous references are shown to you to confirm; fuzzy matches are never forced.
- Judge-mode results are cached real runs, labelled with their capture date.

## Project layout

```
app/            Next.js UI and API routes (check, bridge, tour, swap, baseline, brief, health, judge)
components/     Script pane, evidence panel, swap card, bridge view, tour heatmap, receipts
lib/qloo/       qloo mcp client, typed tool wrappers, Zod schemas, SQLite cache, errors
lib/agent/      The loop: extract, resolve, rank, bands, bridge, swap, retry ladder, rewrite, verdict
lib/evidence/   Receipts and source labels
mcp-server/     culture_check as an MCP tool for other agents
fixtures/       Judge-mode scripts (original material)
eval/           Baseline comparison harness and results
spike/          Day-1 go / no-go script
tests/          Unit tests for the pure logic
```
