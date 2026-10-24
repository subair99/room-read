/**
 * Baseline vs RoomRead on 12 original scripts.
 *   npm run eval            → checks + baseline
 *   npm run eval -- --swaps → also runs swaps for red references (more Qloo calls)
 * Writes eval/out/results.json and rewrites eval/results.md.
 * Reviewer ratings (eval/reviewer-sheet.csv) are added by hand after the run.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { runCheck, runSwap } from "../lib/agent/loop";
import { makeAudience } from "../lib/audience";
import { runBaseline } from "../lib/baseline/llmOnly";
import type { AgeBand, Mode } from "../lib/types";
import { agreementWithQloo, mean, unsupportedClaims, unsupportedInRoomRead } from "./metrics";

interface EvalScript {
  id: string;
  kind: string;
  mode: Mode;
  audiences: Array<{ ageBand?: AgeBand; city?: string }>;
  script: string;
}

const withSwaps = process.argv.includes("--swaps");

const scripts = JSON.parse(await readFile("eval/scripts/scripts.json", "utf8")) as EvalScript[];
const rows: Array<Record<string, unknown>> = [];

for (const s of scripts) {
  const audiences = s.audiences.map((a) => makeAudience(a.ageBand, a.city));
  const t0 = Date.now();
  const check = await runCheck({ script: s.script, mode: s.mode, audiences });
  const seconds = (Date.now() - t0) / 1000;
  const baseline = await runBaseline(s.script, audiences[0].label);

  let bridgeValid: boolean | null = null;
  let swapsAccepted = 0;
  if (withSwaps) {
    for (const v of check.verdicts.filter((x) => x.band === "red" && x.resolution.entity)) {
      const swap = await runSwap({ script: s.script, reference: v.reference, entity: v.resolution.entity!, audiences });
      if (swap.accepted) swapsAccepted++;
      if (s.mode === "bridge") bridgeValid = (bridgeValid ?? true) && Boolean(swap.accepted && (swap.accepted.newPosition ?? 1) <= 2 / 3);
    }
  }

  rows.push({
    id: s.id,
    kind: s.kind,
    mode: s.mode,
    references: check.verdicts.length,
    verdict: check.verdict,
    agreement: agreementWithQloo(baseline, check),
    unsupportedBaseline: unsupportedClaims(baseline),
    unsupportedRoomRead: unsupportedInRoomRead(check),
    bridgeValid,
    swapsAccepted,
    qlooCalls: check.receipts.filter((r) => r.source === "qloo" && !r.cached).length,
    seconds,
  });
  console.log(`${s.id}: ${check.verdict}, ${check.verdicts.length} refs, ${seconds.toFixed(1)}s`);
}

await mkdir("eval/out", { recursive: true });
await writeFile("eval/out/results.json", JSON.stringify(rows, null, 2));

const n = (k: string) => rows.map((r) => r[k] as number | null);
const sum = (k: string) => n(k).reduce<number>((a, b) => a + (b ?? 0), 0);
const fmt = (x: number | null, pct = false) => (x === null ? "n/a" : pct ? `${Math.round(x * 100)}%` : x.toFixed(1));
const bridgeRows = rows.filter((r) => r.bridgeValid !== null);

const md = `# Evaluation: RoomRead vs LLM-only baseline

Run on ${new Date().toISOString().slice(0, 10)} · ${rows.length} original scripts${withSwaps ? " · swaps included" : ""}.

| Measure | LLM only | RoomRead | Notes |
| --- | --- | --- | --- |
| Agreement with Qloo's ranking | ${fmt(mean(n("agreement")), true)} | — | Baseline "will land" calls that Qloo ranks in the audience's top half |
| Unsupported claims (total) | ${sum("unsupportedBaseline")} | ${sum("unsupportedRoomRead")} | "Universally known" style claims with no evidence |
| Reference survival (reviewers) | _add_ | _add_ | Blind 1–5 from eval/reviewer-sheet.csv |
| Bridge validity | — | ${bridgeRows.length ? `${bridgeRows.filter((r) => r.bridgeValid).length}/${bridgeRows.length}` : "n/a"} | Accepted swap ranks in the top two-thirds for both audiences |
| Qloo calls / script | 0 | ${fmt(mean(n("qlooCalls")))} | Uncached calls |
| Seconds / script | — | ${fmt(mean(n("seconds")))} | |

Small sample. This shows grounding and usefulness, not laughs or sales.
`;
await writeFile("eval/results.md", md);
console.log("Wrote eval/results.md and eval/out/results.json");
process.exit(0);
