import { runCheck } from "@/lib/agent/loop";
import { runTourPromo } from "@/lib/agent/tourPromo";
import { makeAudience } from "@/lib/audience";
import { allow, clientIp, tooMany } from "@/lib/guard/rateLimit";
import { badRequest, TourBodySchema } from "@/lib/requests";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tour mode: the same script for 2–5 cities (heatmap), plus an optional promo
 * blurb that RoomRead writes for one city and then checks itself.
 */
export async function POST(req: Request) {
  if (!allow(clientIp(req))) return tooMany();
  const parsed = TourBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { script, cities, ageBand, rules, promo } = parsed.data;
  const audiences = cities.map((c) => makeAudience(ageBand, c));
  return sseResponse(async (emit) => {
    await runCheck({ script, mode: "tour", audiences, rules }, emit);
    if (promo) {
      // The promo's own check must not leak into the main script view: pass stage updates only.
      const stageOnly: typeof emit = (e) => {
        if (e.type === "stage" || e.type === "error") emit(e);
      };
      const result = await runTourPromo(promo.show, promo.city, ageBand, rules, stageOnly);
      emit({
        type: "promo",
        result: {
          city: result.city,
          draft: result.draft,
          final: result.final,
          fixes: result.fixes.map((f) => ({
            reference: result.check.verdicts.find((v) => v.reference.id === f.referenceId)?.reference.text ?? f.referenceId,
            accepted: Boolean(f.accepted),
            note: f.reason,
          })),
        },
      });
    }
  });
}
