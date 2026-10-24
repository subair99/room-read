import { z } from "zod";
import { makeAudience } from "./audience";
import type { Audience } from "./types";

/** Request validation shared by the API routes and the MCP server. */
export const AgeBandSchema = z.enum(["18-34", "35-54", "55+"]);

export const AudienceInputSchema = z
  .object({ ageBand: AgeBandSchema.optional(), city: z.string().trim().min(1).max(80).optional() })
  .refine((a: { ageBand?: string; city?: string }) => Boolean(a.ageBand || a.city), "Give an age band, a city, or both");

export const RulesSchema = z
  .object({ noBrands: z.boolean().optional(), clean: z.boolean().optional(), custom: z.array(z.string().max(200)).max(5).optional() })
  .default({});

export const EntitySchema = z.object({ entityId: z.string(), name: z.string(), type: z.string() });

export const ScriptSchema = z.string().trim().min(1).max(4000);

const EntityWithMetaSchema = EntitySchema.extend({ year: z.number().optional(), popularity: z.number().optional(), description: z.string().optional() });

export const CheckBodySchema = z.object({
  script: ScriptSchema,
  audience: AudienceInputSchema,
  rules: RulesSchema,
  confirmed: z.record(EntityWithMetaSchema).optional(),
  confirmedByText: z.record(EntityWithMetaSchema).optional(),
});

export const BridgeBodySchema = z.object({
  script: ScriptSchema,
  audiences: z.tuple([AudienceInputSchema, AudienceInputSchema]),
  rules: RulesSchema,
  confirmed: z.record(EntityWithMetaSchema).optional(),
  confirmedByText: z.record(EntityWithMetaSchema).optional(),
});

export const TourBodySchema = z.object({
  script: ScriptSchema,
  cities: z.array(z.string().trim().min(1)).min(2).max(5),
  ageBand: AgeBandSchema.optional(),
  rules: RulesSchema,
  confirmedByText: z.record(EntityWithMetaSchema).optional(),
  promo: z.object({ show: z.string().trim().min(3).max(300), city: z.string().trim().min(1) }).optional(),
});

export const SwapBodySchema = z.object({
  script: ScriptSchema,
  reference: z.object({ id: z.string(), text: z.string(), line: z.number().int().min(0), start: z.number(), end: z.number(), kind: z.string() }),
  entity: EntitySchema,
  audiences: z.array(AudienceInputSchema).min(1).max(5),
  rules: RulesSchema,
  originalPosition: z.number().min(0).max(1).nullable().optional(),
});

export const BaselineBodySchema = z.object({ script: ScriptSchema, audienceLabel: z.string().min(1).max(120) });

export function toAudience(a: z.infer<typeof AudienceInputSchema>): Audience {
  return makeAudience(a.ageBand, a.city);
}

export function badRequest(err: z.ZodError): Response {
  return Response.json({ error: "Invalid request", issues: err.issues.slice(0, 5) }, { status: 400 });
}
