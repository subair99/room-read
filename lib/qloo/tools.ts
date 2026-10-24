import type { Receipts } from "../evidence/record";
import { trimForReceipt } from "../evidence/record";
import { cacheGet, cachePut } from "./cache";
import { callQlooTool } from "./client";
import { MAX_RETRIES, QlooError, backoffMs, sleep } from "./errors";
import type { QlooEnvelope } from "./schemas";

/**
 * Every Qloo call goes through here: cache → call → bounded retry → receipt.
 * `reason` is required so each call in the receipts says why it was made.
 *
 * TODO(spike): the argument names below follow the kit's MCP starter table.
 * Confirm each against spike/out/tools.json (the tools' input schemas) and
 * fix any mismatch here — nowhere else needs to change.
 */
export async function qloo(
  tool: string,
  args: Record<string, unknown>,
  reason: string,
  receipts?: Receipts,
): Promise<QlooEnvelope> {
  const started = Date.now();
  const cached = cacheGet(tool, args);
  if (cached) {
    receipts?.add({ source: "qloo", tool, reason, inputs: args, status: cached.status, summary: cached.summary, resultCount: cached.result_count, output: trimForReceipt(cached.results), cached: true, durationMs: 0 });
    return cached;
  }

  let env: QlooEnvelope | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    env = await callQlooTool(tool, args);
    if (env.status !== "error" || !env.error?.retryable || attempt === MAX_RETRIES) break;
    await sleep(backoffMs(attempt));
  }
  if (!env) throw new QlooError("No response from Qloo", "QLOO_NO_RESPONSE", false);

  receipts?.add({ source: "qloo", tool, reason, inputs: args, status: env.status, summary: env.summary, resultCount: env.result_count, output: trimForReceipt(env.results), cached: false, durationMs: Date.now() - started });

  if (env.status === "error") throw QlooError.fromEnvelope(env);
  cachePut(tool, args, env);
  return env;
}

// ---- Typed wrappers (one per harness tool RoomRead uses) ----

export const findTags = (query: string, limit: number, reason: string, r?: Receipts) =>
  qloo("qloo_find_tags", { query, limit }, reason, r);

export const describe = (query: string, reason: string, r?: Receipts) =>
  qloo("qloo_describe", { query }, reason, r);

export const entityTags = (entity: string, reason: string, r?: Receipts) =>
  qloo("qloo_entity_tags", { entity }, reason, r);

export const recommend = (
  args: { signals: Record<string, unknown>; target_type: string; limit?: number },
  reason: string,
  r?: Receipts,
) => qloo("qloo_recommend", args, reason, r);

export const rank = (
  args: { options: string[]; option_type?: string; signals?: Record<string, unknown>; demographic?: Record<string, unknown>; location?: Record<string, unknown> },
  reason: string,
  r?: Receipts,
) => qloo("qloo_rank", args, reason, r);

export const wherePopular = (args: { entity: string; within: string }, reason: string, r?: Receipts) =>
  qloo("qloo_where_popular", args, reason, r);

export const trends = (
  args: { entity_type: string; entities: string[]; start_date: string; end_date: string },
  reason: string,
  r?: Receipts,
) => qloo("qloo_trends", args, reason, r);

export const audienceDemographics = (entity: string, reason: string, r?: Receipts) =>
  qloo("qloo_audience_demographics", { entity }, reason, r);

export const compareAudiences = (args: { group_a: unknown; group_b: unknown }, reason: string, r?: Receipts) =>
  qloo("qloo_compare_audiences", args, reason, r);
