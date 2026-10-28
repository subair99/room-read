# RoomRead

**Read the room before you're in it.** Paste a script, pick your crowd. RoomRead uses Qloo taste data to show which cultural references land, which bomb, and what to say instead, with receipts.

> Every writer has a spell-checker. Nobody has a reference-checker. Now they do.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com) (30 Sep – 30 Oct 2026).

| | |
| --- | --- |
| **Live demo** | **[ADD LIGHTSAIL URL]** (no sign-up; open a judge tab and press Run) |
| **Demo video** | See below |
| **License** | [MIT](LICENSE) |

## Demo video

[![Watch the RoomRead demo](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)](https://youtu.be/VIDEO_ID)

*Click the thumbnail to watch (about 2½ minutes): Check, Bridge and Tour modes on the five judge scripts.*

<!--
To fill in: replace VIDEO_ID in both places with the ID from your YouTube link
(https://youtu.be/AbC123xyz → AbC123xyz). If the video isn't on YouTube, swap the image URL
for your own thumbnail, e.g. docs/screenshots/video-thumbnail.png, and the link for the video URL.
-->

## Screenshots

| Check: the stand-up opener | Bridge: the wedding toast | Tour: the sneaker ad |
| --- | --- | --- |
| ![Check mode](docs/screenshots/check.png) | ![Bridge mode](docs/screenshots/bridge.png) | ![Tour mode](docs/screenshots/tour.png) |

## The problem

A cultural reference is a bet that the audience shares your taste. When it misses, the joke dies, the analogy confuses and the ad wastes its spend. An AI model can't tell you which references a specific crowd knows and loves; it only knows what's been written about them. Ask one whether Whitney Houston lands with both 25-year-olds and their parents and it says "she's universal". Qloo's audience data says otherwise.

## What it does

1. **Find:** pulls every cultural reference (shows, artists, films, games, brands) out of your text and pins each one to a real Qloo entity. If a name is ambiguous, it asks you which one you meant.
2. **Score:** each reference gets 🟢 lands, 🟠 mixed or 🔴 misses for your audience, plus a trend flag (rising or fading).
3. **Swap:** for anything that misses, it proposes a familiar alternative that does the *same job in the line*, rewrites the line, and re-checks it. Apply swaps or drops one at a time, or select all and apply them together.
4. **Receipts:** every verdict links to the exact Qloo calls behind it.

| Mode | Question it answers |
| --- | --- |
| **Check** | Will these references land with this audience (age band and/or city)? |
| **Bridge** | Which references work for *both* of two audiences (say, a wedding's friends and parents)? Each reference is judged on the crowd it serves worse. |
| **Tour** | How do the references change across 2–5 cities? Shown as a heatmap, plus a promo blurb for one city that RoomRead culture-checks itself. |

A **Without Qloo** toggle shows what the AI model alone says about the same text, side by side.

When no swap passes the checks, RoomRead says **"keep the original"**. It never forces a bad swap, and where Qloo has no data it says "not enough signal" instead of guessing.

## Try it in 60 seconds (for judges)

Open the live demo and pick a judge tab:

| Tab | Mode | Audience | What to look for |
| --- | --- | --- | --- |
| Stand-up opener | Check | 18–34, Houston | A weak sitcom reference gets swapped; a reference the joke depends on is kept; one with no Qloo data gets no guess |
| Wedding toast | Bridge | 18–34 + 55+ | Turn on **Without Qloo** and compare it with the data |
| Sneaker ad | Tour | 18–34, five cities | The heatmap changes by city; the Atlanta promo blurb is self-checked |
| Sales keynote | Check | 35–54, Chicago | A reference doing a specific job is only swapped if a familiar title can do that job |
| Physics analogy | Check | 18–34 | Every reference gets resolved and scored |

You can also paste your own text. All judge scripts are original material written for this project.

## How it works

```
script + audience
  → extract references                         (AI model)
  → resolve each to one Qloo entity            qloo_describe (asks you when ambiguous)
  → age score vs well-known anchor titles      qloo_audience_demographics
  → city score vs anchors, in one query        qloo_rank (city as signal_location)
  → trend flag                                 qloo_trends
  → band: green / amber / red  (Bridge, Tour, combined: the worse audience wins)
  → for weak references:
      equivalents   qloo_entity_tags → qloo_recommend (per audience)
      → familiarity bar → must improve the band → fit check (AI model)
      → rewrite the line → re-check
      → retry ladder (up to 3 rewrites) → otherwise "keep the original"
  → verdict + receipts
```

**The AI model handles language. Qloo makes every judgment. Plain code enforces the order and the rules.**

### Scoring rules

1. **Age: relative to well-known titles.** `qloo_audience_demographics` says how much each age bucket over- or under-indexes for a title. RoomRead averages the buckets in the chosen band:

   $$I = \frac{1}{|B|}\sum_{b \in B} \text{affinity}_b$$

   It then places $I$ among six anchor titles of the same type for the same band: top third green, middle amber, bottom third red. Comparing with anchors cancels category skew (for example, 55+ under-indexes for most artists). If fewer than three anchors have data, it falls back to fixed thresholds (≥ +0.10 green, ≤ −0.15 red). Titles with Qloo popularity below 0.5 can't be green, because they're too niche to be familiar.
2. **City: one query, against anchors.** `qloo_rank` with the city as `signal_location`, ranked together with anchors so positions are never compared across queries. A reference Qloo doesn't return for that city shows as "not in the city ranking".
3. **Bridge and combined audiences: the worse band wins.**
4. **A swap must earn it.**
   - It must be at least as familiar as the original: $\text{pop}_{\text{swap}} \ge \max(0.95,\ \text{pop}_{\text{orig}} - 0.005)$.
   - It must improve the band (amber → green; red → amber or green).
   - It must pass a fit check that it plays the same role in the line.
   - Dropping a reference is offered as an option but never applied automatically.
5. **Label everything.** Qloo results, RoomRead's interpretation and AI-written text are kept separate in the receipts.

### Qloo tools used, and why

All calls go through the official **Qloo MCP harness** (`qloo mcp`, over stdio).

| Tool | Why RoomRead calls it |
| --- | --- |
| `qloo_describe` | Resolve a reference to one entity; returns candidates when ambiguous |
| `qloo_audience_demographics` | Age score: which age groups over- or under-index |
| `qloo_rank` | City score: references and anchors ranked with the city as the location |
| `qloo_trends` | Flag references that are rising or fading |
| `qloo_entity_tags` | Capture what makes the original work (genre, era, mood) |
| `qloo_recommend` | Find same-type equivalents this audience loves |
| `qloo_where_popular` | Place signal for Tour mode |
| `qloo_find_tags` | Map vibe words to real Qloo tags |

A redacted request-to-result walkthrough is in [docs/request-to-result.md](docs/request-to-result.md).

### RoomRead as an MCP tool

`npm run mcp` exposes RoomRead itself as an MCP server with one tool, `culture_check`, so other agents can culture-check text before they publish it.

## Built with

Qloo MCP harness · Model Context Protocol SDK · Qwen (`qwen-plus`, via Alibaba Cloud Model Studio's OpenAI-compatible API) · Next.js 15 · React 19 · TypeScript · Tailwind CSS · Zod · Node.js built-in SQLite (response cache) · Server-Sent Events · Docker · AWS Lightsail

## Run it locally

Requirements: Node.js 22.19+, the Qloo hackathon credential, and a key for any OpenAI-compatible model (such as Qwen), Claude or Azure OpenAI.

```sh
npm install --global @qloo/qloo-harness          # 0.1.26 or later
qloo config set base-url https://hackathon.api.qloo.com
qloo setup --qloo                                 # enter the Qloo credential
qloo doctor --network                             # should accept the credential

git clone https://github.com/<your-username>/room-read && cd room-read
cp .env.example .env.local                        # add your model key; never commit it
npm install
npm run spike                                     # checks Qloo and the model end to end: GO / NO-GO
npm run dev                                       # http://localhost:3000
```

Other scripts: `npm test` (unit tests), `npm run typecheck`, `npm run eval` (AI-only baseline vs RoomRead), `npm run mcp` (the `culture_check` MCP server).

## Deploy

RoomRead runs as one always-on Docker container. The server spawns `qloo mcp` as a child process, so **serverless hosts won't work**. The live demo runs on an **AWS Lightsail** container service.

```sh
docker build --platform linux/amd64 -t roomread .
docker run -p 3000:3000 \
  -e QLOO_API_KEY=... \
  -e QLOO_BASE_URL=https://hackathon.api.qloo.com/ \
  -e QLOO_TRUSTED_BASE_URL=https://hackathon.api.qloo.com/ \
  -e LLM_PROVIDER=openai-compatible \
  -e LLM_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1 \
  -e LLM_API_KEY=... -e LLM_MODEL=qwen-plus \
  roomread
```

On Lightsail: `aws lightsail push-container-image`, then `create-container-service-deployment` with the same environment variables. Long requests stream with keep-alives, so the load balancer never times out.

## Evaluation

Twelve original scripts, each run through an AI-only baseline and through RoomRead. Measures:
- agreement with Qloo's data
- unsupported claims made by the baseline
- rank correlation (Spearman)
- swap quality, rated by blind reviewers

See [eval/results.md](eval/results.md).

## Responsible use and known limitations

- Scores describe the **aggregate affinity of an audience segment**, not any individual person.
- RoomRead checks whether a reference is **familiar and loved**, not whether a joke is funny.
- Age band and place are the only audience inputs. No personal data is sent to Qloo.
- City-level signal can be thin: Qloo may rank only a few titles for a city, and RoomRead shows that rather than filling the gap.
- Thin data shows as "not enough signal". RoomRead never invents a number.
- Qloo responses are cached for up to 72 hours to keep the demo fast; receipts show what was called.

## Project layout

```
app/            Next.js UI and API routes (check, bridge, tour, swap, swap-all, baseline, brief, health, judge)
components/     Script pane, evidence panel, proposed-changes panel, bridge view, tour heatmap, receipts
lib/qloo/       Qloo MCP client, typed tool wrappers, Zod schemas, SQLite cache, errors
lib/agent/      The loop: extract, resolve, anchors, age affinity, rank, bands, bridge, swap, retry ladder, rewrite, verdict
lib/llm/        Model client (OpenAI-compatible, Anthropic, Azure)
mcp-server/     culture_check as an MCP tool for other agents
fixtures/       Judge-mode scripts (original material)
eval/           Baseline comparison harness and results
spike/          End-to-end GO / NO-GO check
tests/          Unit tests for the pure logic
```

## License

[MIT](LICENSE)
