import { runCheck } from "../lib/agent/loop";
import { makeAudience } from "../lib/audience";
import type { AgeBand, UserRules } from "../lib/types";

export interface CultureCheckInput {
  text: string;
  ageBand?: AgeBand;
  city?: string;
  /** Optional second audience → Bridge mode */
  ageBandB?: AgeBand;
  cityB?: string;
  rules?: UserRules;
}

/** RoomRead as a tool for other writing agents: check text before publishing. */
export async function cultureCheck(input: CultureCheckInput) {
  const audiences = [makeAudience(input.ageBand, input.city)];
  if (input.ageBandB || input.cityB) audiences.push(makeAudience(input.ageBandB, input.cityB));
  const result = await runCheck({
    script: input.text,
    mode: audiences.length > 1 ? "bridge" : "check",
    audiences,
    rules: input.rules,
  });
  return {
    verdict: result.verdict,
    tweakCount: result.tweakCount,
    audiences: audiences.map((a) => a.label),
    references: result.verdicts.map((v) => ({
      text: v.reference.text,
      line: v.reference.line,
      band: v.band,
      reason: v.reason,
      entity: v.resolution.entity?.name ?? null,
      needsInput: v.resolution.status === "ambiguous",
    })),
    qlooCalls: result.receipts.filter((r) => r.source === "qloo" && !r.cached).length,
    limits: "Aggregate audience affinity from Qloo rankings; not a prediction about any person and not a judgment of humour.",
  };
}
