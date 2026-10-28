/**
 * AI-only baseline vs RoomRead on 12 original scripts.
 *   npm run eval            → checks + baseline
 *   npm run eval -- --swaps → also runs swaps for red references (more Qloo calls)
 * Writes eval/out/results.json, eval/out/swaps.csv and rewrites eval/results.md.
 * Reviewer ratings (eval/reviewer-sheet.csv) are added by hand after the run.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { runCheck, runSwap } from "../lib/agent/loop";
import { makeAudience } from "../lib/audience";
import { runBaseline } from "../lib/baseline/llmOnly";
import type { AgeBand, Mode } from "../lib/types";
import { agreement, mean, unsupportedClaims, unsupportedInRoomRead, type AgreementCounts } from "./metrics";

interface EvalScript {
  id: string;
  kind: string;
  mode: Mode;
  audiences: Array<{ ageBand?: AgeBand; city?: string }>;
  script: string;
}

const withSwaps = process.argv.includes("--swaps");
const scripts = JSON.parse(await readFile("eval/scripts/scripts.json", "utf8")) as EvalScript[];

interface Row {
  id: string; kind: string; mode: Mode; error?: string;
  references: number; resolved: number; green: number; amber: number; red: number; unknown: number;
  verdict: string; agree: AgreementCounts; unsupportedBaseline: number; unsupportedRoomRead: number;
  redSwapped: number; redKept: number; qlooCalls: number; seconds: number;
}
const rows: Row[] = [];
const swapLines: string[] = ["script_id,reference,band,swap,original_line,new_line"];
const csv = (s: string) => `"${s.replace(/"/g, '""')}"`;

for (const s of scripts) {
  const audiences = s.audiences.map((a) => makeAudience(a.ageBand, a.city));
  let t0 = Date.now();
  try {
    // One more try if the network drops mid-script (Qloo results are cached, so it's quick).
    let check: Awaited<ReturnType<typeof runCheck>> | undefined;
    for (let attempt = 1; !check; attempt++) {
      t0 = Date.now();
      try {
        check = await runCheck({ script: s.script, mode: s.mode, audiences });
      } catch (err) {
        if (attempt >= 2) throw err;
        console.log(`${s.id}: retrying after error: ${(err as Error).message}`);
      }
    }
    const seconds = (Date.now() - t0) / 1000;
    const baseline = await runBaseline(s.script, audiences.map((a) => a.label).join(" + "));
    const count = (b: string) => check.verdicts.filter((v) => v.band === b).length;

    let redSwapped = 0;
    let redKept = 0;
    if (withSwaps) {
      for (const v of check.verdicts.filter((x) => x.band === "red" && x.resolution.entity)) {
        const swap = await runSwap({ script: s.script, reference: v.reference, entity: v.resolution.entity!, audiences });
        if (swap.accepted) redSwapped++;
        else redKept++;
        swapLines.push([s.id, csv(v.reference.text), v.band, csv(swap.accepted?.candidate?.name ?? "(keep original)"),
          csv(swap.originalLine), csv(swap.accepted?.rewrittenLine ?? "")].join(","));
      }
    }

    rows.push({
      id: s.id, kind: s.kind, mode: s.mode,
      references: check.verdicts.length,
      resolved: check.verdicts.filter((v) => v.resolution.entity).length,
      green: count("green"), amber: count("amber"), red: count("red"), unknown: count("unknown"),
      verdict: check.verdict,
      agree: agreement(baseline, check),
      unsupportedBaseline: unsupportedClaims(baseline),
      unsupportedRoomRead: unsupportedInRoomRead(check),
      redSwapped, redKept,
      qlooCalls: check.receipts.filter((r) => r.source === "qloo" && !r.cached).length,
      seconds,
    });
    console.log(`${s.id}: ${check.verdict}, ${check.verdicts.length} refs (${count("green")}G ${count("amber")}A ${count("red")}R ${count("unknown")}?), ${seconds.toFixed(1)}s`);
  } catch (err) {
    console.log(`${s.id}: ERROR ${(err as Error).message}`);
    rows.push({ id: s.id, kind: s.kind, mode: s.mode, error: (err as Error).message, references: 0, resolved: 0, green: 0, amber: 0, red: 0, unknown: 0,
      verdict: "error", agree: { landCalls: 0, confirmed: 0, overconfident: 0, qlooRed: 0, baselineCaught: 0 },
      unsupportedBaseline: 0, unsupportedRoomRead: 0, redSwapped: 0, redKept: 0, qlooCalls: 0, seconds: 0 });
  }
}

await mkdir("eval/out", { recursive: true });
await writeFile("eval/out/results.json", JSON.stringify(rows, null, 2));
if (withSwaps) await writeFile("eval/out/swaps.csv", swapLines.join("\n") + "\n");

const ok = rows.filter((r) => !r.error);
const sum = (f: (r: Row) => number) => ok.reduce((a, r) => a + f(r), 0);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}% (${a}/${b})` : "n/a");
const one = (x: number | null) => (x === null ? "n/a" : x.toFixed(1));

const refs = sum((r) => r.references);
const resolved = sum((r) => r.resolved);
const landCalls = sum((r) => r.agree.landCalls);
const qlooRed = sum((r) => r.agree.qlooRed);
const reds = sum((r) => r.redSwapped + r.redKept);

const md = `# Evaluation: RoomRead vs AI-only baseline

Run on ${new Date().toISOString().slice(0, 10)} · ${ok.length} of ${rows.length} original scripts completed${withSwaps ? " · swaps included" : ""} · model: ${process.env.LLM_MODEL ?? "default"}.

The baseline is the same model, given the same script and audience, asked the same question with no Qloo data (\`lib/baseline/llmOnly.ts\`).

## Headline

| Measure | Result | What it means |
| --- | --- | --- |
| References found | ${refs} (${pct(resolved, refs)} resolved to a Qloo entity) | Coverage of the extract + resolve steps |
| Bands | ${sum((r) => r.green)} green · ${sum((r) => r.amber)} amber · ${sum((r) => r.red)} red · ${sum((r) => r.unknown)} no signal | RoomRead never guesses where Qloo has no data |
| Baseline "will land" calls Qloo confirms (green) | ${pct(sum((r) => r.agree.confirmed), landCalls)} | How often the AI's confidence is backed by data |
| Baseline "will land" calls Qloo scores **red** | ${pct(sum((r) => r.agree.overconfident), landCalls)} | Confident misses the writer would have shipped |
| Qloo red references the baseline also flagged | ${pct(sum((r) => r.agree.baselineCaught), qlooRed)} | Misses the AI alone would have caught |
| Unsupported "universal / iconic" claims | baseline ${sum((r) => r.unsupportedBaseline)} · RoomRead ${sum((r) => r.unsupportedRoomRead)} | Claims of popularity with no evidence |
${withSwaps ? `| Red references with an accepted swap | ${pct(sum((r) => r.redSwapped), reds)} | The rest get "keep the original" rather than a forced swap |\n` : ""}| Uncached Qloo calls per script | ${one(mean(ok.map((r) => r.qlooCalls)))} | |
| Seconds per script (check only) | ${one(mean(ok.map((r) => r.seconds)))} | |

## Per script

| Script | Kind | Mode | Refs | G / A / R / ? | Verdict | Baseline land calls → Qloo red |${withSwaps ? " Red swapped / kept |" : ""}
| --- | --- | --- | --- | --- | --- | --- |${withSwaps ? " --- |" : ""}
${rows.map((r) => r.error
  ? `| ${r.id} | ${r.kind} | ${r.mode} | — | — | error: ${r.error.slice(0, 60)} | — |${withSwaps ? " — |" : ""}`
  : `| ${r.id} | ${r.kind} | ${r.mode} | ${r.references} | ${r.green} / ${r.amber} / ${r.red} / ${r.unknown} | ${r.verdict} | ${r.agree.overconfident} of ${r.agree.landCalls} |${withSwaps ? ` ${r.redSwapped} / ${r.redKept} |` : ""}`).join("\n")}

## Reviewer ratings

_To add: blind 1–5 ratings from \`eval/reviewer-sheet.csv\` (does the swapped line keep the joke's job; does it fit the crowd). Reviewers: n = ?, roles._

## Limits

Small sample of original scripts. This measures grounding (whether claims about an audience are backed by data), not whether a joke is funny or an ad sells. "Agreement" treats Qloo's band as the reference point, so it measures how far the AI alone departs from the data, not ground truth about any individual.
`;
await writeFile("eval/results.md", md);
console.log("Wrote eval/results.md and eval/out/results.json" + (withSwaps ? " and eval/out/swaps.csv" : ""));
process.exit(0);
