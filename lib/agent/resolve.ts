import type { Receipts } from "../evidence/record";
import { candidatesFrom, entityFrom, interpretedType } from "../qloo/schemas";
import { describe } from "../qloo/tools";
import type { ResolveOutcome, ResolvedEntity } from "../types";

/** LLM "kind" → harness entity type. */
const KIND_TO_TYPE: Record<string, string> = {
  tv_show: "tv_show",
  movie: "movie",
  artist: "artist",
  song: "artist", // Qloo indexes artists, not songs
  book: "book",
  brand: "brand",
  person: "person",
  place: "place",
  game: "videogame",
  podcast: "podcast",
};

export function typeForKind(kind: string): string | undefined {
  return KIND_TO_TYPE[kind];
}

/**
 * When several same-name entities match, RoomRead picks the top one only if
 * it is clearly more popular than the next (DOMINANCE ×), and shows the
 * others so the user can switch. Otherwise it asks. Never a silent guess.
 */
export const DOMINANCE = 1.5;

export async function resolveReference(
  text: string,
  typeHint: string | undefined,
  reason: string,
  receipts?: Receipts,
): Promise<ResolveOutcome> {
  const first = await resolveOnce(text, typeHint, reason, receipts);
  // The LLM's type guess can be wrong (e.g. "brand" for a website). Retry once without it.
  if (first.status === "not_found" && typeHint) {
    return resolveOnce(text, undefined, `${reason} (retry without the "${typeHint}" type guess)`, receipts);
  }
  return first;
}

async function resolveOnce(
  text: string,
  typeHint: string | undefined,
  reason: string,
  receipts?: Receipts,
): Promise<ResolveOutcome> {
  const env = await describe(text, typeHint, reason, receipts);

  if (env.status === "needs_input") {
    const candidates = candidatesFrom(env).map((c) => withType(c, typeHint)).slice(0, 5);
    if (!candidates.length) return { status: "not_found" };
    const sorted = [...candidates].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const [top, next] = sorted;
    if (top.popularity !== undefined && (next?.popularity ?? 0) * DOMINANCE <= top.popularity) {
      const note = `Picked "${top.name}"${top.year ? ` (${top.year})` : ""}, the clearly most popular of ${sorted.length} matches. You can switch.`;
      receipts?.add({ source: "interpretation", reason: note, output: sorted.map((c) => ({ name: c.name, year: c.year, popularity: c.popularity })) });
      return { status: "resolved", entity: top, alternatives: sorted.slice(1), note };
    }
    return { status: "ambiguous", candidates: sorted };
  }

  const entities = env.results.map(entityFrom).filter((e): e is ResolvedEntity => e !== null);
  if (env.status === "empty" || entities.length === 0) return { status: "not_found" };
  const type = interpretedType(env) ?? typeHint;
  return { status: "resolved", entity: withType(entities[0], type) };
}

function withType(e: ResolvedEntity, type: string | undefined): ResolvedEntity {
  return e.type === "unknown" && type ? { ...e, type } : e;
}
