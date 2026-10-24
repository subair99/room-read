import { renderBriefHtml } from "@/lib/brief/renderBrief";
import type { CheckResult } from "@/lib/types";

export const runtime = "nodejs";

/** Room brief: printable HTML (the browser saves it as PDF). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { script?: string; result?: CheckResult; title?: string } | null;
  if (!body?.script || !body.result) return Response.json({ error: "script and result are required" }, { status: 400 });
  return new Response(renderBriefHtml(body.script, body.result, body.title), { headers: { "content-type": "text/html; charset=utf-8" } });
}
