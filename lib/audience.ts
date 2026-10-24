import type { AgeBand, Audience } from "./types";

/**
 * Map UI age bands to the values Qloo expects.
 * TODO(spike): confirm the exact demographic values from `qloo_rank`'s
 * input schema (spike/out/tools.json) and update this map.
 */
export const AGE_BAND_TO_QLOO: Record<AgeBand, string> = {
  "18-34": "35_and_younger",
  "35-54": "36_to_55",
  "55+": "55_and_older",
};

export function audienceLabel(a: Pick<Audience, "ageBand" | "city">): string {
  return [a.city, a.ageBand].filter(Boolean).join(" · ") || "General audience";
}

export function makeAudience(ageBand?: AgeBand, city?: string): Audience {
  return { ageBand, city, label: audienceLabel({ ageBand, city }) };
}

/**
 * Build the audience part of a Qloo request.
 * TODO(spike): confirm field names (`demographic`, `signals`, `location`).
 */
export function audienceSignals(a: Audience): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (a.ageBand) out.demographic = { age: AGE_BAND_TO_QLOO[a.ageBand] };
  if (a.city) out.location = { query: a.city };
  return out;
}
