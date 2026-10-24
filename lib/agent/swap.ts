import { audienceSignals } from "../audience";
import type { Receipts } from "../evidence/record";
import { entityFrom, isInsightsType, tagFrom } from "../qloo/schemas";
import { entityTags, recommend } from "../qloo/tools";
import type { Audience, ResolvedEntity, UserRules } from "../types";

/**
 * Find same-type entities THIS audience loves that keep the original's
 * genre/mood. Primary query: the original's top tags + the audience (not
 * "fans of the original", which pulls toward the original's own audience).
 * If that returns too few, add a fans-of-the-original query as a fallback.
 */
export async function findEquivalents(
  original: ResolvedEntity,
  audience: Audience,
  rules: UserRules,
  receipts?: Receipts,
  limit = 8,
): Promise<ResolvedEntity[]> {
  if (!isInsightsType(original.type)) return [];
  if (rules.noBrands && original.type === "brand") return [];

  let tagIds: string[] = [];
  try {
    const tagEnv = await entityTags([original.entityId], original.type, `Capture what makes "${original.name}" work (genre, era, mood)`, receipts, 5);
    tagIds = tagEnv.results.map(tagFrom).filter((t) => t !== null).map((t) => t!.tagId).slice(0, 3);
  } catch {
    // Tags sharpen the match but aren't required.
  }

  const seen = new Set<string>([original.entityId]);
  const out: ResolvedEntity[] = [];
  const take = (results: unknown[]) => {
    for (const e of results.map(entityFrom)) {
      if (!e || seen.has(e.entityId)) continue;
      if (rules.noBrands && e.type === "brand") continue;
      seen.add(e.entityId);
      out.push(e.type === "unknown" ? { ...e, type: original.type } : e);
    }
  };

  const primary = await recommend(
    {
      target_type: original.type,
      ...(tagIds.length ? { signal_tags: tagIds, signal_tags_operator: "union" as const } : {}),
      ...audienceSignals(audience),
      limit: limit + 2,
    },
    `Find ${original.type} titles in the same genre/mood as "${original.name}" that ${audience.label} loves`,
    receipts,
  );
  take(primary.results);

  if (out.length < 3) {
    const fallback = await recommend(
      { target_type: original.type, signals: [original.entityId], ...audienceSignals(audience), limit: limit + 2 },
      `Fallback: titles that fans of "${original.name}" also like, for ${audience.label}`,
      receipts,
    );
    take(fallback.results);
  }
  return out.slice(0, limit);
}
