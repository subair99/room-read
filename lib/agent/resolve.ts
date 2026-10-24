import type { Receipts } from "../evidence/record";
import { entityFrom } from "../qloo/schemas";
import { describe } from "../qloo/tools";
import type { ResolveOutcome, ResolvedEntity } from "../types";

const KIND_TO_TYPE: Record<string, string> = {
  tv_show: "urn:entity:tv_show",
  movie: "urn:entity:movie",
  artist: "urn:entity:artist",
  song: "urn:entity:artist", // TODO(spike): Qloo may not index songs; fall back to artist
  book: "urn:entity:book",
  brand: "urn:entity:brand",
  person: "urn:entity:person",
  place: "urn:entity:place",
  game: "urn:entity:videogame",
  podcast: "urn:entity:podcast",
};

export function typeForKind(kind: string): string | undefined {
  return KIND_TO_TYPE[kind];
}

/**
 * Resolve a reference to ONE Qloo entity. Never force a fuzzy match:
 * needs_input → return candidates so the user can choose.
 */
export async function resolveReference(
  text: string,
  typeHint: string | undefined,
  reason: string,
  receipts?: Receipts,
): Promise<ResolveOutcome> {
  const env = await describe(text, reason, receipts);
  const entities = env.results.map(entityFrom).filter((e): e is ResolvedEntity => e !== null);

  if (env.status === "needs_input") {
    return { status: "ambiguous", candidates: entities.slice(0, 5) };
  }
  if (env.status === "empty" || entities.length === 0) return { status: "not_found" };

  // Prefer an exact-name match of the hinted type; otherwise the top result.
  const exact = entities.find(
    (e) => e.name.toLowerCase() === text.toLowerCase() && (!typeHint || e.type === typeHint),
  );
  const pick = exact ?? entities[0];
  // If the top two are both exact names of different types, ask instead of guessing.
  const sameName = entities.filter((e) => e.name.toLowerCase() === text.toLowerCase());
  if (!exact && sameName.length > 1) return { status: "ambiguous", candidates: sameName.slice(0, 5) };
  return { status: "resolved", entity: pick };
}
