import { runCheck } from "@/lib/agent/loop";
import { allow, clientIp, tooMany } from "@/lib/guard/rateLimit";
import { badRequest, CheckBodySchema, toAudience } from "@/lib/requests";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Check mode: one audience. Streams verdicts as SSE. */
export async function POST(req: Request) {
  if (!allow(clientIp(req))) return tooMany();
  const parsed = CheckBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { script, audience, rules, confirmed, confirmedByText } = parsed.data;
  return sseResponse((emit) => runCheck({ script, mode: "check", audiences: [toAudience(audience)], rules, confirmed, confirmedByText }, emit));
}
