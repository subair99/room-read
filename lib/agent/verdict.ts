import type { Band, Verdict } from "../types";

/**
 * Ship it   : no red and at most one amber.
 * Rework    : more than 3 reds, or reds are at least half of all scored references.
 * Tweak     : everything in between. tweakCount = lines with a red or amber.
 */
export function scriptVerdict(items: Array<{ band: Band; line: number }>): { verdict: Verdict; tweakCount: number } {
  const scored = items.filter((i) => i.band !== "unknown");
  const reds = scored.filter((i) => i.band === "red").length;
  const ambers = scored.filter((i) => i.band === "amber").length;
  const tweakLines = new Set(scored.filter((i) => i.band === "red" || i.band === "amber").map((i) => i.line));
  const tweakCount = tweakLines.size;

  if (reds === 0 && ambers <= 1) return { verdict: "ship", tweakCount };
  if (reds > 3 || (scored.length > 0 && reds / scored.length >= 0.5)) return { verdict: "rework", tweakCount };
  return { verdict: "tweak", tweakCount };
}
