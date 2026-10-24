import type { Receipts } from "../evidence/record";
import type { ResolvedEntity } from "../types";
import { resolveReference } from "./resolve";

/**
 * Anchor sets give every ranking a fixed yardstick. Without them, a script
 * whose four references are all well loved would still get a "red" (the
 * bottom of four). With anchors, a reference is green only if it ranks in the
 * top third of [script references + anchors] for that audience.
 *
 * qloo_rank takes at most 10 options, so each ranking uses ANCHORS_PER_QUERY
 * anchors plus up to REFS_PER_QUERY script references. The SAME anchors are
 * used in every query for a type, so positions stay comparable.
 * Anchors span eras and audiences so the yardstick isn't tilted toward one age.
 * TODO(spike): swap out any name that doesn't resolve cleanly.
 */
export const ANCHORS_PER_QUERY = 6;
export const REFS_PER_QUERY = 4;

export const ANCHOR_NAMES: Record<string, string[]> = {
  tv_show: ["Friends", "Stranger Things", "The Simpsons", "Squid Game", "Wheel of Fortune", "Euphoria", "Grey's Anatomy", "The Golden Girls"],
  movie: ["Titanic", "Barbie", "The Godfather", "Black Panther", "Home Alone", "Frozen", "Top Gun", "Mean Girls"],
  artist: ["Beyoncé", "Taylor Swift", "The Beatles", "Bad Bunny", "Dolly Parton", "Drake", "Michael Jackson", "Billie Eilish"],
  brand: ["Nike", "Coca-Cola", "Apple", "Walmart", "Supreme", "Starbucks", "Ford", "Patagonia"],
  book: ["Harry Potter and the Sorcerer's Stone", "To Kill a Mockingbird", "The Hunger Games", "Atomic Habits", "The Great Gatsby", "Twilight", "1984", "The Da Vinci Code"],
  videogame: ["Minecraft", "Fortnite", "Super Mario Bros.", "Pac-Man", "Call of Duty", "The Sims", "Tetris", "Roblox"],
  podcast: ["The Joe Rogan Experience", "Call Her Daddy", "Serial", "The Daily", "Crime Junkie", "SmartLess", "Armchair Expert", "This American Life"],
  person: ["Oprah Winfrey", "Elon Musk", "Kim Kardashian", "Barack Obama", "MrBeast", "Serena Williams", "Tom Hanks", "Rihanna"],
};

const g = globalThis as unknown as { __anchors?: Map<string, ResolvedEntity[]> };
const memo: Map<string, ResolvedEntity[]> = (g.__anchors ??= new Map());

/** Resolve (and memoize) the first ANCHORS_PER_QUERY anchors that resolve for a type. */
export async function anchorsFor(type: string, receipts?: Receipts): Promise<ResolvedEntity[]> {
  const hit = memo.get(type);
  if (hit) return hit;
  const out: ResolvedEntity[] = [];
  for (const name of ANCHOR_NAMES[type] ?? []) {
    if (out.length >= ANCHORS_PER_QUERY) break;
    const r = await resolveReference(name, type, `Resolve anchor "${name}" so rankings share a fixed yardstick`, receipts);
    if (r.status === "resolved" && r.entity && r.entity.type === type) out.push(r.entity);
  }
  memo.set(type, out);
  return out;
}
