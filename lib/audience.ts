import type { AgeBand, Audience } from "./types";

/**
 * The harness takes the demographic as natural language and converts it to
 * Qloo's age signals. TODO(spike): set these to the phrasings the spike shows
 * as accepted ("adults aged 18-34" works; "adults aged 55 and older" did not).
 */
export const AGE_BAND_TO_QLOO: Record<AgeBand, string> = {
  "18-34": "adults aged 18-34",
  "35-54": "adults aged 35-54",
  "55+": "adults aged 55-75",
};

/**
 * Qloo requires a location whenever a demographic is given. Age-only
 * audiences use this region; set DEFAULT_LOCATION to change it.
 */
export const defaultLocation = () => process.env.DEFAULT_LOCATION || "United States";

export function audienceLabel(a: Pick<Audience, "ageBand" | "city">): string {
  return [a.city, a.ageBand].filter(Boolean).join(" · ") || "General audience";
}

export function makeAudience(ageBand?: AgeBand, city?: string): Audience {
  return { ageBand, city, label: audienceLabel({ ageBand, city }) };
}

/** Audience fields shared by qloo_rank and qloo_recommend. */
export function audienceSignals(a: Audience): { demographic?: string; signal_location?: string } {
  const out: { demographic?: string; signal_location?: string } = {};
  if (a.ageBand) out.demographic = AGE_BAND_TO_QLOO[a.ageBand];
  if (a.city) out.signal_location = a.city;
  else if (a.ageBand) out.signal_location = defaultLocation();
  return out;
}
