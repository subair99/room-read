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
    const msg = err instanceof Error ? err.message : String(err);
    const friendly = /timed out|longer than/i.test(msg) ? "Qloo was slow to answer. Try again: everything so far is cached, so it'll be quicker." : msg;
    return Response.json({ error: friendly }, { status: 502 });
  }
}
