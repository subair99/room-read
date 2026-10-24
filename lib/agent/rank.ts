import { audienceSignals } from "../audience";
import type { Receipts } from "../evidence/record";
import { affinityFrom, entityFrom, isInsightsType, trendSeriesFrom } from "../qloo/schemas";
import { rank, trends, TRENDS_MAX_ENTITIES } from "../qloo/tools";
import type { Audience, ResolvedEntity, Trend } from "../types";
import { anchorsFor, REFS_PER_QUERY } from "./anchors";

export interface RankEntry {
  rank: number | null;
  outOf: number;
  affinity?: number;
}

/**
 * Rank entities for ONE audience. Entities are grouped by type; each query
 * holds up to REFS_PER_QUERY script references plus the SAME anchor set for
 * that type (qloo_rank takes at most 10 options).
 * Returns entityId → {rank, outOf} within its own query.
 */
export async function rankForAudience(
  entities: ResolvedEntity[],
  audience: Audience,
  receipts?: Receipts,
): Promise<Map<string, RankEntry>> {
  const out = new Map<string, RankEntry>();
  for (const [type, group] of groupByType(entities)) {
    if (!isInsightsType(type)) continue; // e.g. "locality": nothing to rank
    const anchors = await anchorsFor(type, receipts);
    for (let i = 0; i < group.length; i += REFS_PER_QUERY) {
      const chunk = group.slice(i, i + REFS_PER_QUERY);
      const options = unique([...chunk.map((e) => e.entityId), ...anchors.map((a) => a.entityId)]);
      const env = await rank(
        { options, option_type: type, ...audienceSignals(audience) },
        `Rank ${chunk.length} script reference(s) against ${anchors.length} anchors for ${audience.label}`,
        receipts,
      );
      const ordered = orderedIds(env.results);
      for (const e of chunk) {
        const idx = ordered.indexOf(e.entityId);
        out.set(e.entityId, { rank: idx >= 0 ? idx + 1 : null, outOf: ordered.length, affinity: idx >= 0 ? affinityFrom(env.results[idx]) : undefined });
      }
    }
  }
  return out;
}

/** Compare a candidate with the original in ONE query for one audience. */
export async function rankPair(
  original: ResolvedEntity,
  candidate: ResolvedEntity,
  audience: Audience,
  receipts?: Receipts,
): Promise<{ original: RankEntry; candidate: RankEntry }> {
  const anchors = await anchorsFor(original.type, receipts);
  const options = unique([original.entityId, candidate.entityId, ...anchors.map((a) => a.entityId)]).slice(0, 10);
  const env = await rank(
    { options, option_type: original.type, ...audienceSignals(audience) },
    `Check whether "${candidate.name}" ranks higher than "${original.name}" for ${audience.label}`,
    receipts,
  );
  const ordered = orderedIds(env.results);
  const at = (id: string): RankEntry => {
    const i = ordered.indexOf(id);
    return { rank: i >= 0 ? i + 1 : null, outOf: ordered.length };
  };
  return { original: at(original.entityId), candidate: at(candidate.entityId) };
}

/**
 * Trend over the last 12 months (max 5 entities per call, same type).
 * Reads env.series: weekly population percentiles per entity. Compares the
 * mean of the first and last 4 weeks.
 */
export async function trendsFor(entities: ResolvedEntity[], receipts?: Receipts): Promise<Map<string, Trend>> {
  const out = new Map<string, Trend>();
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - 1);
  for (const [type, group] of groupByType(entities)) {
    if (!isInsightsType(type)) continue;
    for (let i = 0; i < group.length; i += TRENDS_MAX_ENTITIES) {
      const chunk = group.slice(i, i + TRENDS_MAX_ENTITIES);
      try {
        const env = await trends(
          { entities: chunk.map((e) => e.entityId), entity_type: type, start_date: iso(start), end_date: iso(end) },
          "Flag references that are rising or fading over the last 12 months",
          receipts,
        );
        for (const s of trendSeriesFrom(env)) out.set(s.entityId, trendFromSeries(s.percentiles.map((x) => x.p)));
      } catch {
        // Trends are a nice-to-have; never fail a check over them.
      }
    }
  }
  return out;
}

/** Oldest → newest percentiles. Rising/fading if the 4-week mean moved by more than 0.02. */
export function trendFromSeries(oldestFirst: number[]): Trend {
  if (oldestFirst.length < 2) return "unknown";
  const n = Math.min(4, Math.floor(oldestFirst.length / 2) || 1);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const delta = mean(oldestFirst.slice(-n)) - mean(oldestFirst.slice(0, n));
  if (delta > 0.02) return "rising";
  if (delta < -0.02) return "fading";
  return "steady";
}

function orderedIds(results: unknown[]): string[] {
  return results.map(entityFrom).filter((e) => e !== null).map((e) => e!.entityId);
}

function groupByType(entities: ResolvedEntity[]): Map<string, ResolvedEntity[]> {
  const m = new Map<string, ResolvedEntity[]>();
  for (const e of entities) m.set(e.type, [...(m.get(e.type) ?? []), e]);
  return m;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const unique = <T,>(xs: T[]) => [...new Set(xs)];
