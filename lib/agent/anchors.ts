import type { Receipts } from "../evidence/record";
import type { ResolvedEntity } from "../types";
import { resolveReference } from "./resolve";

/**
 * Anchor sets give every ranking a fixed yardstick. Without them, a script
 * whose four references are all well loved would still get a "red" (the
 * bottom of four). With anchors, a reference is green only if it ranks in the
 * top third of [script references + anchors] for that audience.
 *
 * Anchors deliberately span eras and audiences so the list itself isn't
 * biased toward one age band.
 * TODO(spike): replace names that don't resolve cleanly; keep 8–12 per type.
 */
export const ANCHOR_NAMES: Record<string, string[]> = {
  "urn:entity:tv_show": ["The Office", "Friends", "Stranger Things", "Grey's Anatomy", "The Simpsons", "Squid Game", "Breaking Bad", "Wheel of Fortune", "Euphoria", "Golden Girls"],
  "urn:entity:movie": ["Titanic", "The Godfather", "Barbie", "Black Panther", "Home Alone", "Top Gun", "Frozen", "Pulp Fiction", "Mean Girls", "Jaws"],
  "urn:entity:artist": ["Beyoncé", "Taylor Swift", "Drake", "The Beatles", "Bad Bunny", "Dolly Parton", "Burna Boy", "Michael Jackson", "Billie Eilish", "Elvis Presley"],
  "urn:entity:brand": ["Nike", "Coca-Cola", "Apple", "Walmart", "Supreme", "Starbucks", "Sephora", "Ford", "Target", "Patagonia"],
  "urn:entity:book": ["Harry Potter", "To Kill a Mockingbird", "The Hunger Games", "Atomic Habits", "The Great Gatsby", "Twilight", "1984", "The Da Vinci Code"],
  "urn:entity:videogame": ["Minecraft", "Fortnite", "Super Mario Bros.", "Pac-Man", "Call of Duty", "The Sims", "Tetris", "Roblox"],
};

const g = globalThis as unknown as { __anchors?: Map<string, ResolvedEntity[]> };
const memo: Map<string, ResolvedEntity[]> = (g.__anchors ??= new Map());

/** Resolve (and memoize) the anchor set for an entity type. */
export async function anchorsFor(type: string, receipts?: Receipts): Promise<ResolvedEntity[]> {
  const hit = memo.get(type);
  if (hit) return hit;
  const names = ANCHOR_NAMES[type] ?? [];
  const out: ResolvedEntity[] = [];
  for (const name of names) {
    const r = await resolveReference(name, type, `Resolve anchor "${name}" so rankings have a fixed yardstick`, receipts);
    if (r.status === "resolved" && r.entity && r.entity.type === type) out.push(r.entity);
  }
  memo.set(type, out);
  return out;
}
