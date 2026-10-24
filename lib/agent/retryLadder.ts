import type { ResolvedEntity, SwapAttempt, SwapResult } from "../types";

/**
 * Retry ladder for a reference that doesn't land:
 *   1. next equivalent (Qloo-recommended, same type)
 *   2. if none works: flag it, recommend keeping the original, and OFFER a
 *      version without the reference (never applied automatically: stripping
 *      references makes scripts bland, which is the opposite of the point)
 * A swap is accepted only if the candidate ranks HIGHER than the original
 * IN THE SAME Qloo query (rule 1: rank within one query, never across), and
 * the rewritten line actually contains the candidate.
 * Dependencies are injected so this is unit-testable without Qloo or an LLM.
 * MAX_ATTEMPTS limits LLM rewrites (incl. restructure). Candidates rejected on
 * Qloo scores alone cost no rewrite, so they don't use up attempts.
 */
export const MAX_ATTEMPTS = 3;
/** Cap on rejected candidates shown in the swap card. */
export const MAX_SKIPPED_SHOWN = 4;

export interface Comparison {
  /** Scores where LOWER is better (rank position, or −age index), worst case across audiences */
  candidate: number | null;
  original: number | null;
  /** Human-readable evidence for the receipts and the swap card */
  detail?: string;
  /** False when the candidate is better but still doesn't land (e.g. still red). */
  acceptable?: boolean;
}

export interface LadderDeps {
  candidates: ResolvedEntity[];
  compare: (candidate: ResolvedEntity) => Promise<Comparison>;
  rewrite: (candidate: ResolvedEntity) => Promise<string>;
  restructure: () => Promise<string | null>;
}

export async function runLadder(
  referenceId: string,
  originalLine: string,
  originalPosition: number | null,
  deps: LadderDeps,
): Promise<SwapResult> {
  const attempts: SwapAttempt[] = [];
  let rewrites = 0;
  let skipped = 0;
  const skip = (a: SwapAttempt) => {
    skipped++;
    if (skipped <= MAX_SKIPPED_SHOWN) attempts.push(a);
  };

  for (const candidate of deps.candidates) {
    if (rewrites >= MAX_ATTEMPTS - 1) break; // keep one rewrite for restructure
    const cmp = await deps.compare(candidate);
    const why = cmp.detail ? ` ${cmp.detail}` : "";
    if (cmp.candidate === null) {
      skip({ step: "next_equivalent", candidate, newPosition: null, accepted: false, note: cmp.detail ?? `Not enough Qloo signal for "${candidate.name}".` });
      continue;
    }
    const baseline = cmp.original ?? 1;
    if (cmp.candidate >= baseline) {
      skip({ step: "next_equivalent", candidate, newPosition: cmp.candidate, accepted: false, note: `"${candidate.name}" doesn't score higher than the original for this audience.${why}` });
      continue;
    }
    if (cmp.acceptable === false) {
      skip({ step: "next_equivalent", candidate, newPosition: cmp.candidate, accepted: false, note: `"${candidate.name}" is better but still doesn't land for this audience.${why}` });
      continue;
    }
    const line = await deps.rewrite(candidate);
    rewrites++;
    if (!line.toLowerCase().includes(candidate.name.toLowerCase())) {
      attempts.push({ step: "next_equivalent", candidate, rewrittenLine: line, newPosition: cmp.candidate, accepted: false, note: "Rewrite dropped the new reference; rejected." });
      continue;
    }
    const ok: SwapAttempt = { step: "next_equivalent", candidate, rewrittenLine: line, newPosition: cmp.candidate, accepted: true, note: `"${candidate.name}" scores higher than the original for this audience.${why}` };
    attempts.push(ok);
    return { referenceId, originalLine, originalPosition, attempts, accepted: ok, flagged: false, reason: ok.note };
  }

  if (skipped > MAX_SKIPPED_SHOWN) {
    attempts.push({ step: "next_equivalent", accepted: false, note: `…and ${skipped - MAX_SKIPPED_SHOWN} more candidate(s) that didn't land.` });
  }

  const reason = deps.candidates.length
    ? "No Qloo-approved swap keeps the joke. Consider keeping the original."
    : "No familiar reference that lands for this audience also keeps the joke. Consider keeping the original.";

  if (rewrites < MAX_ATTEMPTS) {
    const line = await deps.restructure();
    if (line) {
      attempts.push({ step: "restructure", rewrittenLine: line, newPosition: null, accepted: false, note: "Option: the line without a named reference. Only use it if the reference really has to go." });
    }
  }

  attempts.push({ step: "flag", accepted: false, note: reason });
  return { referenceId, originalLine, originalPosition, attempts, flagged: true, reason };
}
