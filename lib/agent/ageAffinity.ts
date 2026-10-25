import type { AgeBand, Band } from "../types";

/**
 * Age scoring from qloo_audience_demographics.
 * For each entity Qloo returns an affinity index per age bucket: positive =
 * the bucket over-indexes for this title, negative = under-indexes.
 * Example (spike, Seinfeld): 55_and_older +0.28, 30_to_34 −0.50.
 *
 * Unlike rank, this exists for every entity Qloo knows, so classic references
 * aren't dropped.
 *
 * Raw indices are skewed by category (e.g. 55+ under-indexes for most
 * artists), so the band is RELATIVE: where the reference sits among the
 * well-known anchors of the same type for the same age band (top third
 * green, middle amber, bottom third red). The fixed thresholds are only a
 * fallback when too few anchors have data.
 */
export const BAND_BUCKETS: Record<AgeBand, string[]> = {
  "18-34": ["24_and_younger", "25_to_29", "30_to_34"],
  "35-54": ["35_to_44", "45_to_54"],
  "55+": ["55_and_older"],
};

export const BUCKET_LABEL: Record<string, string> = {
  "24_and_younger": "under 25",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55+",
};

/** Index at or above this is green. */
export const GREEN_AT = 0.1;
/** Index at or below this is red. */
export const RED_AT = -0.15;
/** Below this Qloo popularity, a title is too niche to count as familiar: green drops to amber. */
export const NICHE_POPULARITY = 0.5;
/**
 * Qloo popularity is a percentile across a catalogue of hundreds of millions of
 * entities, so 0.9 still admits names most people don't know. A swap must
 * clear this floor AND be at least as popular as the reference it replaces
 * (never trade down in familiarity). Seinfeld is 0.995, Squid Game 0.999.
 */
export const SWAP_MIN_POPULARITY = Number(process.env.SWAP_MIN_POPULARITY || 0.95);
/** Small tolerance so near-equal titles (0.991 vs 0.993) both count as "as familiar". */
export const FAMILIARITY_TOLERANCE = 0.005;

/** The familiarity bar a candidate must clear to replace `original`. */
export function familiarityBar(originalPopularity?: number): number {
  return Math.max(SWAP_MIN_POPULARITY, (originalPopularity ?? 0) - FAMILIARITY_TOLERANCE);
}

export type AgeProfile = Record<string, number>;

/** Mean index across the band's buckets; null if Qloo has none of them. */
export function ageIndex(profile: AgeProfile | undefined, band: AgeBand): number | null {
  if (!profile) return null;
  const vals = BAND_BUCKETS[band].map((b) => profile[b]).filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function bandFromIndex(index: number | null, popularity?: number): Band {
  if (index === null) return "unknown";
  let band: Band = index >= GREEN_AT ? "green" : index <= RED_AT ? "red" : "amber";
  if (band === "green" && popularity !== undefined && popularity < NICHE_POPULARITY) band = "amber";
  return band;
}

/** Minimum anchors with data before the relative band is trusted. */
export const MIN_ANCHORS = 3;

export interface RelativeAge {
  band: Band;
  /** 1 = highest index among [reference + anchors] for this band */
  rank: number | null;
  outOf: number;
}

/**
 * Where the reference's index sits among the anchors' indices for the same
 * age band. Ties go in the reference's favour. Niche titles can't be green.
 */
export function relativeAgeBand(index: number | null, anchorIndices: number[], popularity?: number): RelativeAge {
  if (index === null) return { band: "unknown", rank: null, outOf: 0 };
  if (anchorIndices.length < MIN_ANCHORS) return { band: bandFromIndex(index, popularity), rank: null, outOf: 0 };
  const rank = 1 + anchorIndices.filter((a) => a > index).length;
  const outOf = anchorIndices.length + 1;
  const pos = (rank - 1) / (outOf - 1);
  let band: Band = pos <= 1 / 3 ? "green" : pos <= 2 / 3 ? "amber" : "red";
  if (band === "green" && popularity !== undefined && popularity < NICHE_POPULARITY) band = "amber";
  return { band, rank, outOf };
}

/** 0 (best) … 1 (worst) position among anchors, for combining with city positions. */
export function relativePosition(index: number, anchorIndices: number[]): number {
  if (anchorIndices.length < MIN_ANCHORS) return 0.5 - Math.max(-0.5, Math.min(0.5, index));
  const rank = 1 + anchorIndices.filter((a) => a > index).length;
  return (rank - 1) / anchorIndices.length;
}

export function strongestBucket(profile: AgeProfile | undefined): { label: string; value: number } | null {
  if (!profile) return null;
  const entries = Object.entries(profile).filter(([k, v]) => typeof v === "number" && k in BUCKET_LABEL);
  if (!entries.length) return null;
  const [k, v] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { label: BUCKET_LABEL[k], value: v };
}

export function describeIndex(i: number): string {
  const s = `${i >= 0 ? "+" : "−"}${Math.abs(i).toFixed(2)}`;
  if (i >= GREEN_AT) return `over-indexes (${s})`;
  if (i <= RED_AT) return `under-indexes (${s})`;
  return `about average (${s})`;
}
