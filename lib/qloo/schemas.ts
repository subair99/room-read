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
}

/** Pull an entity id/name/type out of whatever item shape a tool returns. */
export function entityFrom(item: unknown): EntityRef | null {
  const parsed = QlooEntityLikeSchema.safeParse(item);
  if (!parsed.success) return null;
  const e = parsed.data;
  const entityId = e.entity_id ?? e.id;
  if (!entityId) return null;
  return {
    entityId,
    name: e.name ?? entityId,
    type: e.subtype ?? e.type ?? e.types?.[0] ?? "unknown",
  };
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
