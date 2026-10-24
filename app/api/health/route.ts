import { listQlooTools } from "@/lib/qloo/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness: is `qloo mcp` up and are the tools listed? Makes no Qloo data call. */
export async function GET() {
  try {
    const { tools } = await listQlooTools();
    return Response.json({ ok: true, tools: tools.map((t) => t.name) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
