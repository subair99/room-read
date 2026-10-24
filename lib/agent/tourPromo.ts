import { z } from "zod";
import { makeAudience } from "../audience";
import { Receipts } from "../evidence/record";
import { completeJson } from "../llm/client";
import type { AgeBand, CheckResult, Emit, SwapResult, UserRules } from "../types";
import { applySwap, runCheck, runSwap } from "./loop";
import { PROMO_SYSTEM, promoUser } from "./prompts";

export interface TourPromoResult {
  city: string;
  draft: string;
  check: CheckResult;
  fixes: SwapResult[];
  final: string;
}

/**
 * RoomRead writes a promo blurb for a city, then culture-checks its OWN copy
 * and fixes weak references before showing it — the agent checking its work.
 */
export async function runTourPromo(
  show: string,
  city: string,
  ageBand: AgeBand | undefined,
  rules: UserRules = {},
  emit: Emit = () => {},
): Promise<TourPromoResult> {
  const receipts = new Receipts();
  emit({ type: "stage", stage: "promo", detail: `Writing a promo blurb for ${city}` });
  const { blurb } = await completeJson<{ blurb: string }>({ system: PROMO_SYSTEM, user: promoUser(show, city, ageBand) }, z.object({ blurb: z.string().min(1) }));
  receipts.add({ source: "llm", reason: `Draft promo blurb for ${city}`, output: blurb });

  const audience = makeAudience(ageBand, city);
  const check = await runCheck({ script: blurb, mode: "check", audiences: [audience], rules }, emit, receipts);

  let final = blurb;
  const fixes: SwapResult[] = [];
  for (const v of check.verdicts) {
    if (v.band !== "red" || !v.resolution.entity) continue;
    emit({ type: "stage", stage: "self-check", detail: `Fixing "${v.reference.text}" in my own draft` });
    const swap = await runSwap({ script: final, reference: v.reference, entity: v.resolution.entity, audiences: [audience], rules }, receipts);
    fixes.push(swap);
    if (swap.accepted?.rewrittenLine) final = applySwap(final, v.reference.line, swap.accepted.rewrittenLine);
  }
  return { city, draft: blurb, check: { ...check, receipts: receipts.records }, fixes, final };
}
