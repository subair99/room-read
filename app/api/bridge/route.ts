import { runCheck } from "@/lib/agent/loop";
import { allow, clientIp, tooMany } from "@/lib/guard/rateLimit";
import { badRequest, BridgeBodySchema, toAudience } from "@/lib/requests";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bridge mode: two audiences; each reference is judged on the WORSE audience. */
export async function POST(req: Request) {
  if (!allow(clientIp(req))) return tooMany();
  const parsed = BridgeBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { script, audiences, rules, confirmed, confirmedByText } = parsed.data;
  return sseResponse((emit) => runCheck({ script, mode: "bridge", audiences: audiences.map(toAudience), rules, confirmed, confirmedByText }, emit));
}
