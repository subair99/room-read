import type { Receipts } from "../evidence/record";
import { trimForReceipt } from "../evidence/record";
import { cacheGet, cachePut } from "./cache";
import { callQlooTool } from "./client";
import { MAX_RETRIES, QlooError, backoffMs, sleep } from "./errors";
import type { QlooEnvelope } from "./schemas";

/**
 * Every Qloo call goes through here: cache → call → bounded retry → receipt.
 * `reason` is required so each call in the receipts says why it was made.
 * Argument names follow the harness 0.1.26 input schemas (spike/out/tools.json).
 */
export async function qloo(
  tool: string,
  args: Record<string, unknown>,
  reason: string,
  receipts?: Receipts,
): Promise<QlooEnvelope> {
  const clean = dropUndefined(args);
  const started = Date.now();
  const cached = cacheGet(tool, clean);
  if (cached) {
    receipts?.add({ source: "qloo", tool, reason, inputs: clean, status: cached.status, summary: cached.summary, resultCount: cached.result_count, output: trimForReceipt(cached.results), cached: true, durationMs: 0 });
    return cached;
  }

  let env: QlooEnvelope | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    env = await callQlooTool(tool, clean);
    if (env.status !== "error" || !env.error?.retryable || attempt === MAX_RETRIES) break;
    await sleep(backoffMs(attempt));
  }
  if (!env) throw new QlooError("No response from Qloo", "QLOO_NO_RESPONSE", false);

  receipts?.add({ source: "qloo", tool, reason, inputs: clean, status: env.status, summary: env.summary, resultCount: env.result_count, output: trimForReceipt(env.results), cached: false, durationMs: Date.now() - started });

  if (env.status === "error") throw QlooError.fromEnvelope(env);
  cachePut(tool, clean, env);
  return env;
}

/** The harness rejects unknown or undefined properties; strip undefined values. */
function dropUndefined(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** Max items qloo_rank accepts in `options`. */
export const RANK_MAX_OPTIONS = 10;
/** Max entities qloo_trends accepts. */
export const TRENDS_MAX_ENTITIES = 5;

type Audience = { demographic?: string; signal_location?: string };

// ---- Typed wrappers, one per harness tool RoomRead uses ----

export const findTags = (query: string, reason: string, r?: Receipts, limit = 10) =>
  qloo("qloo_find_tags", { query, semantic: true, limit }, reason, r);

/** Resolve a name to an entity. `type` narrows the search (search types include actor, album, locality…). */
export const describe = (entity: string, type: string | undefined, reason: string, r?: Receipts) =>
  qloo("qloo_describe", { entity, type }, reason, r);

export const entityTags = (entities: string[], entityType: string | undefined, reason: string, r?: Receipts, limit = 10) =>
  qloo("qloo_entity_tags", { entities: entities.slice(0, 10), entity_type: entityType, limit }, reason, r);

export const recommend = (
  args: Audience & { target_type: string; signals?: string[]; signal_tags?: string[]; signal_tags_operator?: "union" | "intersection"; limit?: number },
  reason: string,
  r?: Receipts,
) => qloo("qloo_recommend", { explain: true, ...args }, reason, r);

/** Rank up to 10 options for an audience. Results come back ordered best first. */
export const rank = (args: Audience & { options: string[]; option_type: string; signals?: string[] }, reason: string, r?: Receipts) => {
  if (args.options.length > RANK_MAX_OPTIONS) throw new QlooError(`qloo_rank takes at most ${RANK_MAX_OPTIONS} options`, "ROOMREAD_TOO_MANY_OPTIONS", false);
  return qloo("qloo_rank", args, reason, r);
};

export const wherePopular = (args: { entity: string; entity_type?: string; within: string; limit?: number }, reason: string, r?: Receipts) =>
  qloo("qloo_where_popular", args, reason, r);

export const trends = (
  args: { entities: string[]; entity_type: string; start_date: string; end_date: string; limit?: number },
  reason: string,
  r?: Receipts,
) => qloo("qloo_trends", { ...args, entities: args.entities.slice(0, TRENDS_MAX_ENTITIES) }, reason, r);

export const audienceDemographics = (entity: string, entityType: string | undefined, reason: string, r?: Receipts) =>
  qloo("qloo_audience_demographics", { entity, entity_type: entityType, limit: 5 }, reason, r);

export const compareAudiences = (args: { group_a: string[]; group_b: string[]; target_type?: string; limit?: number }, reason: string, r?: Receipts) =>
  qloo("qloo_compare_audiences", args, reason, r);
