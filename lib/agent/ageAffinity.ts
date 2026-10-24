import type { AgeBand, Band } from "../types";

/**
 * Age scoring from qloo_audience_demographics.
 * For each entity Qloo returns an affinity index per age bucket: positive =
 * the bucket over-indexes for this title, negative = under-indexes.
 * Example (spike, Seinfeld): 55_and_older +0.28, 30_to_34 −0.50.
 *
 * Unlike rank, this exists for every entity Qloo knows, so classic references
 * aren't dropped. The thresholds below are RoomRead's interpretation, labelled
 * as such in the receipts. TODO(eval): calibrate on the 12 eval scripts.
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
