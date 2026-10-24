import { audienceSignals } from "../audience";
import type { Receipts } from "../evidence/record";
import { entityFrom, tagFrom } from "../qloo/schemas";
import { entityTags, recommend } from "../qloo/tools";
import type { Audience, ResolvedEntity, UserRules } from "../types";

/**
 * Find same-type entities that keep what made the original work (its tags:
 * genre, era, mood) and that this audience loves.
 * TODO(spike): confirm how qloo_recommend takes tag signals plus audience.
 */
export async function findEquivalents(
  original: ResolvedEntity,
  audience: Audience,
  rules: UserRules,
  receipts?: Receipts,
  limit = 6,
): Promise<ResolvedEntity[]> {
  const tagEnv = await entityTags(original.entityId, `Capture what makes "${original.name}" work (genre, era, mood)`, receipts);
  const tags = tagEnv.results.map(tagFrom).filter((t) => t !== null).slice(0, 5);

  const recEnv = await recommend(
    {
      signals: { tags: tags.map((t) => t!.tagId), ...audienceSignals(audience) },
      target_type: original.type,
      limit: limit + 2,
    },
    `Find ${original.type.split(":").pop()} equivalents to "${original.name}" that ${audience.label} loves`,
    receipts,
  );

  return recEnv.results
    .map(entityFrom)
    .filter((e): e is ResolvedEntity => e !== null && e.entityId !== original.entityId)
    .filter((e) => !(rules.noBrands && e.type.includes("brand")))
    .slice(0, limit);
}
