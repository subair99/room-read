import { z } from "zod";
import { completeJson } from "../llm/client";
import type { UserRules } from "../types";
import { FIT_SYSTEM, REWRITE_SYSTEM, fitUser, restructureUser, rewriteUser } from "./prompts";

const LineSchema = z.object({ line: z.string().min(1) });

export async function rewriteLine(line: string, original: string, replacement: string, rules: UserRules): Promise<string> {
  const out = await completeJson<{ line: string }>({ system: REWRITE_SYSTEM, user: rewriteUser(line, original, replacement, rules) }, LineSchema);
  return out.line.trim();
}

export async function restructureLine(line: string, original: string, rules: UserRules): Promise<string | null> {
  try {
    const out = await completeJson<{ line: string }>({ system: REWRITE_SYSTEM, user: restructureUser(line, original, rules) }, LineSchema);
    const text = out.line.trim();
    return text && text !== line ? text : null;
  } catch {
    return null;
  }
}

export interface FitResult {
  job: string;
  fits: Array<{ name: string; why: string }>;
}

/**
 * Language check only: which Qloo-approved candidates can play the same role
 * in the line. Qloo has already decided whether each candidate lands.
 */
export async function pickFitting(line: string, original: string, candidates: string[]): Promise<FitResult> {
  if (!candidates.length) return { job: "", fits: [] };
  try {
    const out = await completeJson<FitResult>(
      { system: FIT_SYSTEM, user: fitUser(line, original, candidates), temperature: 0 },
      z.object({ job: z.string(), fits: z.array(z.object({ name: z.string(), why: z.string() })) }),
    );
    const known = new Set(candidates.map((c) => c.toLowerCase()));
    return { job: out.job, fits: out.fits.filter((f) => known.has(f.name.toLowerCase())) };
  } catch {
    return { job: "", fits: [] };
  }
}
