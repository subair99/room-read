import { runBaseline } from "@/lib/baseline/llmOnly";
import { allow, clientIp, tooMany } from "@/lib/guard/rateLimit";
import { BaselineBodySchema, badRequest } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Without Qloo": the same question answered by the LLM alone. */
export async function POST(req: Request) {
  if (!allow(clientIp(req))) return tooMany();
  const parsed = BaselineBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  try {
    return Response.json({ items: await runBaseline(parsed.data.script, parsed.data.audienceLabel) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
