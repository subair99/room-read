import { z } from "zod";
import { completeJson } from "../llm/client";
import type { Reference } from "../types";
import { EXTRACT_SYSTEM, extractUser } from "./prompts";

const ExtractedSchema = z.array(
  z.object({
    text: z.string().min(1),
    line: z.number().int().min(0),
    kind: z.string().default("other"),
    canonical: z.string().optional(),
  }),
);

/** LLM pulls named references out of the script; we compute exact offsets. */
export async function extractReferences(script: string): Promise<Reference[]> {
  const items = await completeJson<Array<{ text: string; line: number; kind: string; canonical?: string }>>({ system: EXTRACT_SYSTEM, user: extractUser(script) }, ExtractedSchema);
  return locateReferences(script, items);
}

/** Pure: turn {text, line} items into references with character offsets. */
export function locateReferences(
  script: string,
  items: Array<{ text: string; line: number; kind: string; canonical?: string }>,
): Reference[] {
  const lines = script.split("\n");
  const lineStart: number[] = [];
  let offset = 0;
  for (const l of lines) {
    lineStart.push(offset);
    offset += l.length + 1;
  }
  const refs: Reference[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const lineText = lines[it.line];
    if (lineText === undefined) continue;
    const idx = lineText.toLowerCase().indexOf(it.text.toLowerCase());
    if (idx < 0) continue; // LLM invented or misquoted it: drop
    const start = lineStart[it.line] + idx;
    const key = `${start}:${it.text.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      id: `ref_${refs.length}`,
      text: lineText.slice(idx, idx + it.text.length),
      line: it.line,
      start,
      end: start + it.text.length,
      kind: it.kind,
      canonical: it.canonical && it.canonical.toLowerCase() !== it.text.toLowerCase() ? it.canonical : undefined,
    });
  }
  return refs;
}
