import type { ResolvedEntity, SwapAttempt, SwapResult } from "../types";

/**
 * Retry ladder for a reference that doesn't land:
 *   1. next equivalent (Qloo-recommended, same type)
 *   2. restructure the line without a named reference
 *   3. flag it for the writer, with the reason
 * A swap is accepted only if the candidate ranks HIGHER than the original
 * IN THE SAME Qloo query (rule 1: rank within one query, never across), and
 * the rewritten line actually contains the candidate.
 * Dependencies are injected so this is unit-testable without Qloo or an LLM.
 */
export const MAX_ATTEMPTS = 3;

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

  for (const candidate of deps.candidates) {
    if (attempts.length >= MAX_ATTEMPTS - 1) break; // keep one slot for restructure
    const cmp = await deps.compare(candidate);
    const why = cmp.detail ? ` ${cmp.detail}` : "";
    if (cmp.candidate === null) {
      attempts.push({ step: "next_equivalent", candidate, newPosition: null, accepted: false, note: cmp.detail ?? `Not enough Qloo signal for "${candidate.name}".` });
      continue;
    }
    const baseline = cmp.original ?? 1;
    if (cmp.candidate >= baseline) {
      attempts.push({ step: "next_equivalent", candidate, newPosition: cmp.candidate, accepted: false, note: `"${candidate.name}" doesn't score higher than the original for this audience.${why}` });
      continue;
    }
    if (cmp.acceptable === false) {
      attempts.push({ step: "next_equivalent", candidate, newPosition: cmp.candidate, accepted: false, note: `"${candidate.name}" is better but still doesn't land for this audience.${why}` });
      continue;
    }
    const line = await deps.rewrite(candidate);
    if (!line.toLowerCase().includes(candidate.name.toLowerCase())) {
      attempts.push({ step: "next_equivalent", candidate, rewrittenLine: line, newPosition: cmp.candidate, accepted: false, note: "Rewrite dropped the new reference; rejected." });
      continue;
    }
    const ok: SwapAttempt = { step: "next_equivalent", candidate, rewrittenLine: line, newPosition: cmp.candidate, accepted: true, note: `"${candidate.name}" scores higher than the original for this audience.${why}` };
    attempts.push(ok);
    return { referenceId, originalLine, originalPosition, attempts, accepted: ok, flagged: false, reason: ok.note };
  }

  if (attempts.length < MAX_ATTEMPTS) {
    const line = await deps.restructure();
    if (line) {
      const ok: SwapAttempt = { step: "restructure", rewrittenLine: line, newPosition: null, accepted: true, note: "Rewritten without a named reference. Review it: there's nothing for Qloo to rank." };
      attempts.push(ok);
      return { referenceId, originalLine, originalPosition, attempts, accepted: ok, flagged: false, reason: ok.note };
    }
    attempts.push({ step: "restructure", accepted: false, note: "Couldn't restructure the line cleanly." });
  }

  const reason = deps.candidates.length
    ? "No swap ranked higher for this audience. Over to you."
    : "No equivalents found in Qloo for this reference. Over to you.";
  attempts.push({ step: "flag", accepted: false, note: reason });
  return { referenceId, originalLine, originalPosition, attempts, flagged: true, reason };
}
