import { makeAudience } from "../audience";
import { Receipts } from "../evidence/record";
import { ageProfileFrom } from "../qloo/schemas";
import { audienceDemographics } from "../qloo/tools";
import type {
  Audience,
  AudienceScore,
  Band,
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
import { type AgeProfile, NICHE_POPULARITY, ageIndex, bandFromIndex, describeIndex, strongestBucket } from "./ageAffinity";
import { bandFromRank, position, worseBand } from "./bands";
import { extractReferences } from "./extract";
import { type RankEntry, rankForAudience, rankPair, trendsFor } from "./rank";
import { resolveReference, typeForKind } from "./resolve";
import { restructureLine, rewriteLine } from "./rewrite";
import { type Comparison, runLadder } from "./retryLadder";
import { findEquivalents } from "./swap";
import { scriptVerdict } from "./verdict";

/**
 * The RoomRead loop. The LLM handles language; Qloo makes every judgment;
 * this code enforces the order and the scoring rules.
 *
 *   extract → resolve (ask on real ambiguity)
 *   → AGE signal:  qloo_audience_demographics index for the band (every entity)
 *   → CITY signal: qloo_rank with signal_location, against anchors
 *   → band per audience = worse of its signals; Bridge/Tour = worse audience
 *   → trends → verdict
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
      receipts.add({ source: "user_rule", reason: `You confirmed "${ref.text}" = ${confirmed.name}${confirmed.year ? ` (${confirmed.year})` : ""}` });
      continue;
    }
    const outcome = await resolveReference(ref.text, typeForKind(ref.kind), `Resolve "${ref.text}" to one Qloo entity`, receipts);
    resolutions.set(ref.id, outcome);
    if (outcome.status === "ambiguous" && outcome.candidates?.length) {
      emit({ type: "needs_input", referenceId: ref.id, text: ref.text, candidates: outcome.candidates });
    }
  }

  const entities = dedupe(refs.map((r) => resolutions.get(r.id)?.entity).filter((e): e is ResolvedEntity => Boolean(e)));

  const needAge = req.audiences.some((a) => a.ageBand);
  const profiles = needAge ? await ageProfiles(entities, receipts, emit) : new Map<string, AgeProfile>();

  const cityRanks = new Map<string, Map<string, RankEntry>>();
  for (const audience of req.audiences.filter((a) => a.city)) {
    emit({ type: "stage", stage: "rank", detail: `Ranking in ${audience.city}` });
    // City only: age is measured by the demographics index, so don't mix it in here.
    cityRanks.set(audience.label, await rankForAudience(entities, makeAudience(undefined, audience.city), receipts));
  }

  emit({ type: "stage", stage: "trends", detail: "Checking what's rising or fading" });
  const trendMap = await trendsFor(entities, receipts);

  const verdicts: ReferenceVerdict[] = [];
  for (const ref of refs) {
    const resolution = resolutions.get(ref.id)!;
    const entity = resolution.entity;
    const scores = req.audiences.map((a) => scoreFor(a, entity, profiles, cityRanks, trendMap));
    const band = worseBand(scores.map((s) => s.band));
    const reason = reasonFor(ref, resolution, scores, entity ? profiles.get(entity.entityId) : undefined, band);
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

function scoreFor(
  a: Audience,
  entity: ResolvedEntity | undefined,
  profiles: Map<string, AgeProfile>,
  cityRanks: Map<string, Map<string, RankEntry>>,
  trendMap: Map<string, AudienceScore["trend"]>,
): AudienceScore {
  const trend = entity ? trendMap.get(entity.entityId) ?? "unknown" : "unknown";
  if (!entity) return { audience: a.label, rank: null, outOf: 0, band: "unknown", trend };

  const bands: Band[] = [];
  let idx: number | null | undefined;
  if (a.ageBand) {
    idx = ageIndex(profiles.get(entity.entityId), a.ageBand);
    bands.push(bandFromIndex(idx, entity.popularity));
  }
  const city = a.city ? cityRanks.get(a.label)?.get(entity.entityId) : undefined;
  if (a.city) bands.push(bandFromRank(city?.rank ?? null, city?.outOf ?? 0));

  return {
    audience: a.label,
    rank: city?.rank ?? null,
    outOf: city?.outOf ?? 0,
    ageIndex: idx,
    cityAffinity: city?.affinity ?? null,
    band: worseBand(bands),
    trend,
  };
}

/** One audience_demographics call per entity (entity-level data, reused across audiences). */
async function ageProfiles(entities: ResolvedEntity[], receipts: Receipts, emit: Emit): Promise<Map<string, AgeProfile>> {
  emit({ type: "stage", stage: "demographics", detail: "Reading who each reference over-indexes with" });
  const out = new Map<string, AgeProfile>();
  for (const e of entities) {
    const p = await profileOf(e, receipts);
    if (p) out.set(e.entityId, p);
  }
  return out;
}

async function profileOf(e: ResolvedEntity, receipts: Receipts): Promise<AgeProfile | undefined> {
  try {
    const env = await audienceDemographics(e.entityId, e.type, `Read which age groups over- or under-index for "${e.name}"`, receipts);
    return ageProfileFrom(env.results[0]);
  } catch {
    return undefined;
  }
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
 * Swap one reference using the retry ladder. A candidate must beat the
 * original on EVERY audience's signals (we compare the worst case), and
 * must be popular enough to be familiar.
 */
export async function runSwap(req: SwapRequest, receipts = new Receipts()): Promise<SwapResult & { receipts: Receipts["records"] }> {
  const rules = req.rules ?? {};
  logRules(rules, receipts);
  const lines = req.script.split("\n");
  const line = lines[req.reference.line] ?? "";
  const primary = req.audiences[0];

  const found = await findEquivalents(req.entity, primary, rules, receipts);
  const originalProfile = req.audiences.some((a) => a.ageBand) ? await profileOf(req.entity, receipts) : undefined;

  // Score every candidate once, then try them best-first so the first
  // accepted swap is the strongest one, not just the first that's "less bad".
  const memo = new Map<string, Comparison>();
  const compare = async (candidate: ResolvedEntity): Promise<Comparison> => {
    const hit = memo.get(candidate.entityId);
    if (hit) return hit;
    const c = await scoreCandidate(candidate);
    memo.set(candidate.entityId, c);
    return c;
  };
  for (const c of found) await compare(c);
  const ordered = [...found].sort((a, b) => rankKey(memo.get(a.entityId)) - rankKey(memo.get(b.entityId)));
  receipts.add({
    source: "interpretation",
    reason: `Scored ${found.length} candidate(s); trying the strongest first`,
    output: ordered.map((c) => ({ name: c.name, worstScore: memo.get(c.entityId)?.candidate, lands: memo.get(c.entityId)?.acceptable })),
  });

  const result = await runLadder(req.reference.id, line, req.originalPosition ?? null, {
    candidates: ordered,
    compare,
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

  async function scoreCandidate(candidate: ResolvedEntity): Promise<Comparison> {
    if (candidate.popularity !== undefined && candidate.popularity < NICHE_POPULARITY) {
      return { candidate: null, original: null, detail: `"${candidate.name}" is too niche to be familiar (popularity ${candidate.popularity.toFixed(2)}).` };
    }
    // Scores are "badness" on one 0–1 scale (lower is better) so age and city
    // signals can be combined: age index +0.5 → 0, −0.5 → 1; city position as-is.
    let worstCand = -Infinity;
    let worstOrig = -Infinity;
    const details: string[] = [];
    const bands: Band[] = [];
    const candProfile = req.audiences.some((a) => a.ageBand) ? await profileOf(candidate, receipts) : undefined;
    for (const a of req.audiences) {
      if (a.ageBand) {
        const c = ageIndex(candProfile, a.ageBand);
        const o = ageIndex(originalProfile, a.ageBand);
        if (c === null) return { candidate: null, original: null, detail: `No age data for "${candidate.name}".` };
        worstCand = Math.max(worstCand, badness(c));
        bands.push(bandFromIndex(c, candidate.popularity));
        worstOrig = Math.max(worstOrig, o === null ? 1 : badness(o));
        details.push(`${a.ageBand}: ${describeIndex(c)} vs original ${o === null ? "n/a" : describeIndex(o)}`);
      }
      if (a.city) {
        const pair = await rankPair(req.entity, candidate, makeAudience(undefined, a.city), receipts);
        const c = position(pair.candidate.rank, pair.candidate.outOf);
        const o = position(pair.original.rank, pair.original.outOf);
        if (c === null) {
          // Qloo's city ranking often omits titles; don't let a missing signal block a swap.
          details.push(`${a.city}: no city signal`);
          if (!a.ageBand) return { candidate: null, original: null, detail: `No ${a.city} signal for "${candidate.name}".` };
          continue;
        }
        worstCand = Math.max(worstCand, c);
        bands.push(bandFromRank(pair.candidate.rank, pair.candidate.outOf));
        worstOrig = Math.max(worstOrig, o ?? 1);
        details.push(`${a.city}: ranks ${pair.candidate.rank}/${pair.candidate.outOf} vs original ${pair.original.rank ?? "—"}/${pair.original.outOf}`);
      }
    }
    const worst = worseBand(bands);
    if (worstCand === -Infinity) return { candidate: null, original: null, detail: details.join(" · ") || `No signal for "${candidate.name}".` };
    return { candidate: worstCand, original: worstOrig, detail: `${details.join(" · ")} · lands as ${worst}`, acceptable: worst === "green" || worst === "amber" };
  }
}

/** Age index → badness on 0–1 (lower is better), so it can be combined with city positions. */
function badness(index: number): number {
  return 0.5 - Math.max(-0.5, Math.min(0.5, index));
}

/** Sort key: acceptable first, then by worst-case score (lower is better), unscored last. */
function rankKey(c: Comparison | undefined): number {
  if (!c || c.candidate === null) return 1e9;
  return (c.acceptable === false ? 1e6 : 0) + c.candidate;
}

/** Apply an accepted swap to the script text. */
export function applySwap(script: string, lineIndex: number, newLine: string): string {
  const lines = script.split("\n");
  lines[lineIndex] = newLine;
  return lines.join("\n");
}

function reasonFor(ref: Reference, res: ResolveOutcome, scores: AudienceScore[], profile: AgeProfile | undefined, band: Band): string {
  if (res.status === "ambiguous") return `"${ref.text}" could mean several things. Pick one to score it.`;
  if (res.status === "not_found") return `Qloo doesn't have enough signal on "${ref.text}".`;
  const parts = scores.map((s) => {
    const bits: string[] = [];
    if (s.ageIndex !== undefined) bits.push(s.ageIndex === null ? "no age data" : describeIndex(s.ageIndex));
    if (s.outOf > 0 || s.rank !== null) bits.push(s.rank === null ? "not in the city ranking" : `ranks ${s.rank} of ${s.outOf} locally`);
    const trend = s.trend === "rising" ? ", rising" : s.trend === "fading" ? ", fading" : "";
    return `${s.audience}: ${bits.join(", ") || "no signal"}${trend}`;
  });
  let reason = parts.join(" · ");
  const pop = res.entity?.popularity;
  if (pop !== undefined && pop < NICHE_POPULARITY) reason += ` · niche overall (popularity ${pop.toFixed(2)})`;
  if (band === "red") {
    const top = strongestBucket(profile);
    if (top && top.value > 0) reason += ` · strongest with ${top.label} (${top.value >= 0 ? "+" : "−"}${Math.abs(top.value).toFixed(2)})`;
  }
  return reason;
}

function logRules(rules: UserRules, receipts: Receipts) {
  const parts = [rules.noBrands && "no brand names", rules.clean && "keep it clean", ...(rules.custom ?? [])].filter(Boolean);
  if (parts.length) receipts.add({ source: "user_rule", reason: `Rules: ${parts.join(", ")}` });
}

function dedupe(es: ResolvedEntity[]): ResolvedEntity[] {
  const seen = new Set<string>();
  return es.filter((e) => (seen.has(e.entityId) ? false : (seen.add(e.entityId), true)));
}
