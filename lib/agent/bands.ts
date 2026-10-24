import type { Band } from "../types";

/**
 * Rank → percentile position. 0 = top of the list, 1 = bottom.
 * Positions are only ever compared WITHIN one Qloo query (never raw scores
 * across queries) — see the scoring rules in the README.
 */
export function position(rank: number | null, outOf: number): number | null {
  if (rank === null || outOf <= 0) return null;
  if (outOf === 1) return 0;
  return (rank - 1) / (outOf - 1);
}

/** Top third green, middle third amber, bottom third red. */
export function bandFromPosition(pos: number | null): Band {
  if (pos === null) return "unknown";
  if (pos <= 1 / 3) return "green";
  if (pos <= 2 / 3) return "amber";
  return "red";
}

export function bandFromRank(rank: number | null, outOf: number): Band {
  return bandFromPosition(position(rank, outOf));
}

const ORDER: Record<Band, number> = { green: 0, amber: 1, red: 2, unknown: 3 };

/** Bridge uses the worse audience's band. Unknown only wins if all are unknown. */
export function worseBand(bands: Band[]): Band {
  const known = bands.filter((b) => b !== "unknown");
  if (known.length === 0) return "unknown";
  return known.reduce((a, b) => (ORDER[b] > ORDER[a] ? b : a));
}
