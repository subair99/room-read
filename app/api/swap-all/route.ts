import { runSwap } from "@/lib/agent/loop";
import { allow, clientIp, tooMany } from "@/lib/guard/rateLimit";
import { badRequest, SwapAllBodySchema, toAudience } from "@/lib/requests";
import { jsonStreamResponse } from "@/lib/sse";
import { mapLimit } from "@/lib/util/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Find swaps for several flagged references at once.
 * Swaps rewrite whole lines, so only ONE reference per line is swapped (the
 * first listed; the client sends the worst first). The rest are reported as
 * skipped so the writer can do them after re-checking.
 */
export async function POST(req: Request) {
  if (!allow(clientIp(req))) return tooMany();
  const parsed = SwapAllBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { script, items, rules } = parsed.data;
  const audiences = parsed.data.audiences.map(toAudience);

  const seenLines = new Set<number>();
  const todo = items.filter((it) => (seenLines.has(it.reference.line) ? false : (seenLines.add(it.reference.line), true)));
  const skipped = items.filter((it) => !todo.includes(it)).map((it) => ({ referenceId: it.reference.id, text: it.reference.text, reason: "Same line as another flagged reference. Re-check after accepting, then swap it." }));

  // Streamed with keep-alives: a cold batch can take a minute, longer than proxies wait on an idle connection.
  return jsonStreamResponse(async () => {
  // Two swaps at a time; each swap already runs its own Qloo calls in parallel.
  const results = await mapLimit(todo, 2, async (it) => {
    try {
      const r = await runSwap({ script, reference: it.reference, entity: it.entity, audiences, rules, originalPosition: it.originalPosition ?? null });
      return { ok: true as const, line: it.reference.line, text: it.reference.text, result: r };
    } catch (err) {
      return { ok: false as const, line: it.reference.line, text: it.reference.text, error: err instanceof Error ? err.message : String(err) };
    }
  });
  return { results, skipped };
  });
}
