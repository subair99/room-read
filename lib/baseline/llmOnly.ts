import { z } from "zod";
import { BASELINE_SYSTEM, baselineUser } from "../agent/prompts";
import { completeJson } from "../llm/client";

/**
 * The honest "Without Qloo" path: same model, same kind of question, no Qloo.
 * It must not be crippled — the comparison only means something if it's fair.
 */
export const BaselineItemSchema = z.object({
  reference: z.string(),
  willLand: z.boolean(),
  reason: z.string(),
  swap: z.string().nullable(),
});
export type BaselineItem = z.infer<typeof BaselineItemSchema>;

export async function runBaseline(script: string, audienceLabel: string): Promise<BaselineItem[]> {
  return completeJson({ system: BASELINE_SYSTEM, user: baselineUser(script, audienceLabel) }, z.array(BaselineItemSchema));
}
