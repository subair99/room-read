import { audienceSignals } from "../audience";
import type { Receipts } from "../evidence/record";
import { entityFrom } from "../qloo/schemas";
import { rank, trends } from "../qloo/tools";
import type { Audience, ResolvedEntity, Trend } from "../types";
import { anchorsFor } from "./anchors";

export interface RankEntry {
  rank: number | null;
  outOf: number;
}

/**
 * Rank entities for ONE audience. Entities are grouped by type and each group
 * is ranked in ONE query together with that type's anchor set.
 * Returns entityId → {rank, outOf} within its own query.
 *
 * TODO(spike): if qloo_rank rejects a city + age band together, rank by age
 * band here and add city strength from qloo_where_popular as a second signal.
 */
export async function rankForAudience(
  entities: ResolvedEntity[],
  audience: Audience,
  receipts?: Receipts,
): Promise<Map<string, RankEntry>> {
  const out = new Map<string, RankEntry>();
  const byType = new Map<string, ResolvedEntity[]>();
  for (const e of entities) byType.set(e.type, [...(byType.get(e.type) ?? []), e]);

  for (const [type, group] of byType) {
    const anchors = await anchorsFor(type, receipts);
    const options = unique([...group.map((e) => e.entityId), ...anchors.map((a) => a.entityId)]);
    const env = await rank(
      { options, option_type: type, ...audienceSignals(audience) },
      `Rank ${group.length} script reference(s) against ${anchors.length} anchors for ${audience.label}`,
      receipts,
    );
    const ordered = env.results.map(entityFrom).filter((e) => e !== null).map((e) => e!.entityId);
    const outOf = ordered.length;
    for (const e of group) {
      const idx = ordered.indexOf(e.entityId);
      out.set(e.entityId, { rank: idx >= 0 ? idx + 1 : null, outOf });
    }
  }
  return out;
}

/**
 * Compare a candidate with the original in ONE query for one audience.
 * Returns percentile positions (0 best) or null when Qloo has no signal.
 */
export async function rankPair(
  original: ResolvedEntity,
  candidate: ResolvedEntity,
  audience: Audience,
  receipts?: Receipts,
): Promise<{ original: RankEntry; candidate: RankEntry }> {
  const anchors = await anchorsFor(original.type, receipts);
  const options = unique([original.entityId, candidate.entityId, ...anchors.map((a) => a.entityId)]);
  const env = await rank(
    { options, option_type: original.type, ...audienceSignals(audience) },
    `Check whether "${candidate.name}" ranks higher than "${original.name}" for ${audience.label}`,
    receipts,
  );
  const ordered = env.results.map(entityFrom).filter((e) => e !== null).map((e) => e!.entityId);
  const at = (id: string): RankEntry => {
    const i = ordered.indexOf(id);
    return { rank: i >= 0 ? i + 1 : null, outOf: ordered.length };
  };
  return { original: at(original.entityId), candidate: at(candidate.entityId) };
}

/**
 * Trend over the last 12 months, per entity (max 5 per call, same type).
 * TODO(spike): confirm the trends result shape; this reads a numeric
 * change field if present and otherwise returns "unknown".
 */
export async function trendsFor(entities: ResolvedEntity[], receipts?: Receipts): Promise<Map<string, Trend>> {
  const out = new Map<string, Trend>();
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - 1);
  const byType = new Map<string, ResolvedEntity[]>();
  for (const e of entities) byType.set(e.type, [...(byType.get(e.type) ?? []), e]);

  for (const [type, group] of byType) {
    for (let i = 0; i < group.length; i += 5) {
      const chunk = group.slice(i, i + 5);
      try {
        const env = await trends(
          { entity_type: type, entities: chunk.map((e) => e.entityId), start_date: iso(start), end_date: iso(end) },
          "Flag references that are rising or fading over the last 12 months",
          receipts,
        );
        for (const item of env.results) {
          const e = entityFrom(item);
          if (!e) continue;
          out.set(e.entityId, trendFromItem(item));
        }
      } catch {
        // Trends are a nice-to-have; never fail a check over them.
      }
    }
  }
  return out;
}

export function trendFromItem(item: unknown): Trend {
  if (!item || typeof item !== "object") return "unknown";
  const o = item as Record<string, unknown>;
  const v = [o.change, o.delta, o.trend_change, o.percent_change].find((x) => typeof x === "number") as number | undefined;
  if (v === undefined) return "unknown";
  if (v > 0.05) return "rising";
  if (v < -0.05) return "fading";
  return "steady";
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const unique = <T,>(xs: T[]) => [...new Set(xs)];
