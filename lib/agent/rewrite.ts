import { z } from "zod";
import { completeJson } from "../llm/client";
import type { UserRules } from "../types";
import { REWRITE_SYSTEM, restructureUser, rewriteUser } from "./prompts";

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
