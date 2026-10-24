import { z } from "zod";

/** Every harness tool returns this envelope (see qloo-hackathon-kit MCP starter). */
export const QlooStatusSchema = z.enum(["ok", "empty", "needs_input", "partial", "degraded", "error"]);
export type QlooStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";

export const QlooErrorSchema = z.object({
  code: z.string(),
  retryable: z.boolean().default(false),
  recovery: z.string().optional(),
});

export const QlooEnvelopeSchema = z
  .object({
    status: QlooStatusSchema,
    summary: z.string().default(""),
    results: z.array(z.unknown()).default([]),
    result_count: z.number().default(0),
    error: QlooErrorSchema.optional(),
  })
  .passthrough();

/** Written out explicitly (rather than z.infer) so the shape is readable at a glance. */
export interface QlooEnvelope {
  status: QlooStatus;
  summary: string;
  results: unknown[];
  result_count: number;
  error?: { code: string; retryable: boolean; recovery?: string };
  [extra: string]: unknown;
}

/**
 * Loose entity shape until the spike confirms the real field names.
 * TODO(spike): tighten this once spike/out/*.json shows the result items.
 */
export const QlooEntityLikeSchema = z
  .object({
    entity_id: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    types: z.array(z.string()).optional(),
  })
  .passthrough();

export interface EntityRef {
  entityId: string;
  name: string;
  type: string;
  year?: number;
  popularity?: number;
  description?: string;
}

/** Pull an entity id/name/type out of whatever item shape a tool returns. */
export function entityFrom(item: unknown): EntityRef | null {
  const parsed = QlooEntityLikeSchema.safeParse(item);
  if (!parsed.success) return null;
  const e = parsed.data;
  const entityId = e.entity_id ?? e.id;
  if (!entityId) return null;
  const o = item as Record<string, unknown>;
  const rawType = e.subtype ?? (e.type && e.type !== "urn:entity" ? e.type : undefined) ?? e.types?.[0] ?? "unknown";
  return {
    entityId,
    name: e.name ?? entityId,
    type: shortType(rawType),
    year: typeof o.release_year === "number" ? o.release_year : undefined,
    popularity: typeof o.popularity === "number" ? o.popularity : undefined,
    description: typeof o.description === "string" ? o.description.slice(0, 160) : undefined,
  };
}

/**
 * On `needs_input`, the harness puts same-name matches in
 * resolution.issues[].candidates (id, name, type, popularity, description, release_year).
 */
export function candidatesFrom(env: QlooEnvelope): EntityRef[] {
  const issues = (env.resolution as { issues?: Array<{ candidates?: unknown[] }> } | undefined)?.issues ?? [];
  return issues.flatMap((i) => (i.candidates ?? []).map(entityFrom)).filter((e): e is EntityRef => e !== null);
}

/** On `ok`, describe reports the matched entity's type here (result items carry no type). */
export function interpretedType(env: QlooEnvelope): string | undefined {
  const t = (env.interpretation as { entity?: { type?: string } } | undefined)?.entity?.type;
  return t ? shortType(t) : undefined;
}

/** Harness tools take short types ("tv_show"); API results may use URNs ("urn:entity:tv_show"). */
export function shortType(t: string): string {
  return t.replace(/^urn:entity:/, "").split(":")[0];
}

/** Entity types the Insights tools (rank, recommend, trends) accept. */
export const INSIGHTS_TYPES = ["artist", "book", "brand", "movie", "person", "place", "podcast", "tv_show", "videogame"] as const;
export type InsightsType = (typeof INSIGHTS_TYPES)[number];
export function isInsightsType(t: string): t is InsightsType {
  return (INSIGHTS_TYPES as readonly string[]).includes(t);
}

/** Tags returned by qloo_find_tags / qloo_entity_tags. */
export interface TagRef {
  tagId: string;
  name: string;
}

export function tagFrom(item: unknown): TagRef | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const tagId = (o.tag_id ?? o.id) as string | undefined;
  if (!tagId) return null;
  return { tagId, name: (o.name as string | undefined) ?? tagId };
}

/** audience_demographics item → { "24_and_younger": -0.04, ..., "55_and_older": 0.28 } */
export function ageProfileFrom(item: unknown): Record<string, number> | undefined {
  const age = (item as { query?: { age?: unknown } } | undefined)?.query?.age;
  if (!age || typeof age !== "object") return undefined;
  return Object.fromEntries(Object.entries(age).filter(([, v]) => typeof v === "number")) as Record<string, number>;
}

/** rank items carry an affinity score (0–1). */
export function affinityFrom(item: unknown): number | undefined {
  const a = (item as { affinity?: unknown } | undefined)?.affinity;
  return typeof a === "number" ? a : undefined;
}

/** trends: env.series[] = { entity: { entityId }, points: [{ date, population_percentile, ... }] } (newest first) */
export function trendSeriesFrom(env: QlooEnvelope): Array<{ entityId: string; percentiles: Array<{ date: string; p: number }> }> {
  const series = (env.series as Array<{ entity?: { entityId?: string }; points?: Array<{ date?: string; population_percentile?: number }> }> | undefined) ?? [];
  return series
    .filter((s) => s.entity?.entityId)
    .map((s) => ({
      entityId: s.entity!.entityId!,
      percentiles: (s.points ?? [])
        .filter((p) => typeof p.population_percentile === "number" && p.date)
        .map((p) => ({ date: p.date!, p: p.population_percentile! }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
}
