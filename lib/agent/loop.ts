import { Receipts } from "../evidence/record";
import { audienceDemographics } from "../qloo/tools";
import type {
  Audience,
  AudienceScore,
  CheckRequest,
  CheckResult,
  Emit,
  Reference,
  ReferenceVerdict,
  ResolveOutcome,
  ResolvedEntity,
  SwapResult,
  UserRules,
} from "../types";
import { bandFromRank, position, worseBand } from "./bands";
import { extractReferences } from "./extract";
import { rankForAudience, rankPair, trendsFor } from "./rank";
import { resolveReference, typeForKind } from "./resolve";
import { restructureLine, rewriteLine } from "./rewrite";
import { runLadder } from "./retryLadder";
import { findEquivalents } from "./swap";
import { scriptVerdict } from "./verdict";

/**
 * The RoomRead loop. The LLM handles language; Qloo makes every judgment;
 * this code enforces the order and the scoring rules.
 *
 *   extract → resolve (ask on ambiguity) → rank per audience (with anchors)
 *   → trends → band (Bridge/Tour: worse audience) → verdict
 */
export async function runCheck(req: CheckRequest, emit: Emit = () => {}, receipts = new Receipts()): Promise<CheckResult> {
  const rules = req.rules ?? {};
  logRules(rules, receipts);

  emit({ type: "stage", stage: "extract", detail: "Finding cultural references" });
  const refs = await extractReferences(req.script);
  receipts.add({ source: "llm", reason: "Extract named cultural references from the script", output: refs.map((r) => r.text) });

  emit({ type: "stage", stage: "resolve", detail: `Resolving ${refs.length} reference(s) in Qloo` });
  const resolutions = new Map<string, ResolveOutcome>();
  for (const ref of refs) {
    const confirmed = req.confirmed?.[ref.id];
    if (confirmed) {
      resolutions.set(ref.id, { status: "resolved", entity: confirmed });
      receipts.add({ source: "user_rule", reason: `You confirmed "${ref.text}" = ${confirmed.name}` });
      continue;
    }
    const outcome = await resolveReference(ref.text, typeForKind(ref.kind), `Resolve "${ref.text}" to one Qloo entity`, receipts);
    resolutions.set(ref.id, outcome);
    if (outcome.status === "ambiguous" && outcome.candidates?.length) {
      emit({ type: "needs_input", referenceId: ref.id, text: ref.text, candidates: outcome.candidates });
    }
  }

  const resolved = refs
    .map((r) => ({ ref: r, entity: resolutions.get(r.id)?.entity }))
    .filter((x): x is { ref: Reference; entity: ResolvedEntity } => Boolean(x.entity));
  const entities = dedupe(resolved.map((x) => x.entity));

  const ranks = new Map<string, Map<string, { rank: number | null; outOf: number }>>();
  for (const audience of req.audiences) {
    emit({ type: "stage", stage: "rank", detail: `Ranking for ${audience.label}` });
    ranks.set(audience.label, await rankForAudience(entities, audience, receipts));
  }

  emit({ type: "stage", stage: "trends", detail: "Checking what's rising or fading" });
  const trendMap = await trendsFor(entities, receipts);

  const verdicts: ReferenceVerdict[] = [];
  for (const ref of refs) {
    const resolution = resolutions.get(ref.id)!;
    const entity = resolution.entity;
    const scores: AudienceScore[] = req.audiences.map((a) => {
      const entry = entity ? ranks.get(a.label)?.get(entity.entityId) : undefined;
      const rank = entry?.rank ?? null;
      const outOf = entry?.outOf ?? 0;
      return { audience: a.label, rank, outOf, band: bandFromRank(rank, outOf), trend: entity ? trendMap.get(entity.entityId) ?? "unknown" : "unknown" };
    });
    const band = worseBand(scores.map((s) => s.band));
    let reason = reasonFor(ref, resolution, scores);
    if (band === "red" && entity) reason += await whoItLandsWith(entity, receipts);
    receipts.add({ source: "interpretation", reason: `Band for "${ref.text}": ${band}`, output: scores });
    const v: ReferenceVerdict = { reference: ref, resolution, scores, band, reason };
    verdicts.push(v);
    emit({ type: "reference", verdict: v });
  }

  const { verdict, tweakCount } = scriptVerdict(verdicts.map((v) => ({ band: v.band, line: v.reference.line })));
  const result: CheckResult = { mode: req.mode, audiences: req.audiences, verdicts, verdict, tweakCount, receipts: receipts.records };
  emit({ type: "done", result });
  return result;
}

export interface SwapRequest {
  script: string;
  reference: Reference;
  entity: ResolvedEntity;
  audiences: Audience[];
  rules?: UserRules;
  originalPosition?: number | null;
}

/**
 * Swap one reference using the retry ladder. With several audiences
 * (Bridge/Tour) the candidate must beat the original on the WORSE audience.
 */
export async function runSwap(req: SwapRequest, receipts = new Receipts()): Promise<SwapResult & { receipts: Receipts["records"] }> {
  const rules = req.rules ?? {};
  logRules(rules, receipts);
  const lines = req.script.split("\n");
  const line = lines[req.reference.line] ?? "";
  const primary = req.audiences[0];

  const candidates = await findEquivalents(req.entity, primary, rules, receipts);

  const result = await runLadder(req.reference.id, line, req.originalPosition ?? null, {
    candidates,
    compare: async (candidate) => {
      let worstCand: number | null = -1;
      let worstOrig: number | null = -1;
      for (const a of req.audiences) {
        const pair = await rankPair(req.entity, candidate, a, receipts);
        const c = position(pair.candidate.rank, pair.candidate.outOf);
        const o = position(pair.original.rank, pair.original.outOf);
        worstCand = c === null || worstCand === null ? null : Math.max(worstCand, c);
        worstOrig = o === null || worstOrig === null ? null : Math.max(worstOrig, o);
      }
      return { candidate: worstCand, original: worstOrig };
    },
    rewrite: async (candidate) => {
      const text = await rewriteLine(line, req.reference.text, candidate.name, rules);
      receipts.add({ source: "llm", reason: `Rewrite the line with "${candidate.name}"`, output: text });
      return text;
    },
    restructure: async () => {
      const text = await restructureLine(line, req.reference.text, rules);
      receipts.add({ source: "llm", reason: "Restructure the line without a named reference", output: text });
      return text;
    },
  });

  receipts.add({ source: "interpretation", reason: result.reason, output: result.attempts.map((a) => ({ step: a.step, accepted: a.accepted, note: a.note })) });
  return { ...result, receipts: receipts.records };
}

/** Apply an accepted swap to the script text. */
export function applySwap(script: string, lineIndex: number, newLine: string): string {
  const lines = script.split("\n");
  lines[lineIndex] = newLine;
  return lines.join("\n");
}

function reasonFor(ref: Reference, res: ResolveOutcome, scores: AudienceScore[]): string {
  if (res.status === "ambiguous") return `"${ref.text}" could mean several things. Pick one to score it.`;
  if (res.status === "not_found") return `Qloo doesn't have enough signal on "${ref.text}".`;
  return scores
    .map((s) => {
      if (s.rank === null) return `${s.audience}: not enough signal`;
      const trend = s.trend === "rising" ? ", rising" : s.trend === "fading" ? ", fading" : "";
      return `${s.audience}: ranks ${s.rank} of ${s.outOf}${trend}`;
    })
    .join(" · ");
}

async function whoItLandsWith(entity: ResolvedEntity, receipts: Receipts): Promise<string> {
  try {
    const env = await audienceDemographics(entity.entityId, `Explain who "${entity.name}" does land with`, receipts);
    return env.summary ? ` Qloo: ${env.summary.slice(0, 140)}` : "";
  } catch {
    return "";
  }
}

function logRules(rules: UserRules, receipts: Receipts) {
  const parts = [rules.noBrands && "no brand names", rules.clean && "keep it clean", ...(rules.custom ?? [])].filter(Boolean);
  if (parts.length) receipts.add({ source: "user_rule", reason: `Rules: ${parts.join(", ")}` });
}

function dedupe(es: ResolvedEntity[]): ResolvedEntity[] {
  const seen = new Set<string>();
  return es.filter((e) => (seen.has(e.entityId) ? false : (seen.add(e.entityId), true)));
}
