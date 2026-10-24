import { runSwap } from "@/lib/agent/loop";
import { allow, clientIp, tooMany } from "@/lib/guard/rateLimit";
import { badRequest, SwapBodySchema, toAudience } from "@/lib/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Swap one reference through the retry ladder. */
export async function POST(req: Request) {
  if (!allow(clientIp(req))) return tooMany();
  const parsed = SwapBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const b = parsed.data;
  try {
    const result = await runSwap({ ...b, audiences: b.audiences.map(toAudience) });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
