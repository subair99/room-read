/**
 * DAY-1 SPIKE (diagnostic round)   npm run spike
 *
 * A. Resolve 10 TV shows (auto-picks a clearly dominant match, else asks).
 * B. Which age-band phrasings does the harness accept? (with a location, as Qloo requires)
 * C. How many results does qloo_rank return for N options? With and without an audience.
 * D. What do audience_demographics, where_popular and trends actually return?
 * E. GO / NO-GO / INCONCLUSIVE.
 *
 * Raw responses → spike/out/. Paste the console output back for the next fix.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolveReference } from "../lib/agent/resolve";
import { callQlooTool, listQlooTools } from "../lib/qloo/client";
import { entityFrom, type QlooEnvelope } from "../lib/qloo/schemas";
import type { ResolvedEntity } from "../lib/types";
import { spearman } from "../eval/metrics";

const REFERENCES = ["Seinfeld", "Friends", "Love Island", "Stranger Things", "Squid Game", "The Golden Girls", "Euphoria", "Wheel of Fortune", "The Office", "Bluey"];
const TYPE = "tv_show";
const REGION = "United States";
const PHRASES: Record<string, string[]> = {
  young: ["adults aged 18-34", "millennials", "35 and younger", "gen z"],
  middle: ["adults aged 35-54", "adults aged 36-55", "gen x"],
  older: ["adults aged 55-75", "adults over 55", "55 and older", "baby boomers", "seniors"],
};

const OUT = "spike/out";
await mkdir(OUT, { recursive: true });
const save = (name: string, data: unknown) => writeFile(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));
const short = (x: unknown, n = 400) => JSON.stringify(x, (k, v) => (k === "properties" || k === "description" ? "…" : v))?.slice(0, n);

const { tools } = await listQlooTools();
await save("tools", tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })));

// A. Resolve
console.log("A. RESOLVE");
const resolved: ResolvedEntity[] = [];
for (const name of REFERENCES) {
  try {
    const r = await resolveReference(name, TYPE, "spike");
    if (r.status === "resolved" && r.entity) resolved.push(r.entity);
    const pick = r.entity ? `${r.entity.name}${r.entity.year ? ` (${r.entity.year})` : ""} [${r.entity.type}]` : "";
    console.log(`  ${name}: ${r.status} ${pick}${r.note ? ` · auto-picked over ${r.alternatives?.length}` : ""}${r.status === "ambiguous" ? ` · ${r.candidates?.map((c) => `${c.name} ${c.year ?? ""} p=${c.popularity?.toFixed(2) ?? "?"}`).join(" | ")}` : ""}`);
  } catch (e) {
    console.log(`  ${name}: ERROR ${e instanceof Error ? e.message : e}`);
  }
}
const ids = resolved.map((e) => e.entityId).slice(0, 10);
const nameOf = (id: string) => resolved.find((e) => e.entityId === id)?.name ?? id;
if (ids.length < 3) {
  console.log("\nINCONCLUSIVE: fewer than 3 shows resolved; paste this output.");
  process.exit(0);
}

// B. Phrasing
console.log(`\nB. AGE-BAND PHRASING (signal_location = ${REGION}, ${ids.length} options)`);
const accepted: Record<string, { phrase: string; order: string[] }> = {};
for (const [band, phrases] of Object.entries(PHRASES)) {
  for (const phrase of phrases) {
    const env = await raw("qloo_rank", { options: ids, option_type: TYPE, demographic: phrase, signal_location: REGION });
    await save(`phrase-${band}-${slug(phrase)}`, env);
    const order = idsOf(env);
    const mapped = (env.interpretation as Record<string, unknown> | undefined) ?? {};
    const { options: _o, ...interp } = mapped as { options?: unknown };
    console.log(`  [${band}] "${phrase}": ${env.status} · ${order.length}/${ids.length} returned${env.status !== "ok" ? ` · ${env.summary}` : ` · ${short(interp, 220)}`}`);
    if (env.status === "ok" && order.length && !accepted[band]) accepted[band] = { phrase, order };
  }
}

// C. How many does rank return?
console.log("\nC. RANK RESULT COUNT");
for (const [label, extra] of [
  ["no audience", {}],
  ["Houston only", { signal_location: "Houston" }],
  ["10 options, US only", { signal_location: REGION }],
] as const) {
  const env = await raw("qloo_rank", { options: ids, option_type: TYPE, ...extra });
  await save(`count-${slug(label)}`, env);
  const items = env.results.map((it) => {
    const e = entityFrom(it);
    const a = (it as { affinity?: number }).affinity;
    return `${e?.name ?? "?"}${typeof a === "number" ? ` a=${a.toFixed(2)}` : ""}`;
  });
  console.log(`  ${label}: ${env.status} · ${env.results.length}/${ids.length} · ${items.join(" > ")}${env.status !== "ok" ? ` · ${env.summary}` : ""}`);
  const otherKeys = Object.keys(env).filter((k) => !["status", "summary", "results", "result_count", "schema_version", "operation", "query_intent", "execution", "interpretation", "resolution"].includes(k));
  if (otherKeys.length) console.log(`    other top-level fields: ${otherKeys.join(", ")}`);
}

// D. Other tools' real shapes
console.log("\nD. OTHER TOOLS");
const first = resolved[0];
const demo = await raw("qloo_audience_demographics", { entity: first.entityId, entity_type: TYPE, limit: 5 });
await save("audience-demographics", demo);
console.log(`  audience_demographics(${first.name}): ${demo.status} · ${demo.results.length} items${demo.status !== "ok" ? ` · ${demo.summary}` : ""}`);
console.log(`    first item: ${short(demo.results[0], 700)}`);
const wp = await raw("qloo_where_popular", { entity: first.entityId, entity_type: TYPE, within: REGION, limit: 3 });
await save("where-popular", wp);
console.log(`  where_popular(${first.name}, ${REGION}): ${wp.status} · ${wp.results.length} items`);
console.log(`    first item: ${short(wp.results[0], 500)}`);
const end = new Date();
const start = new Date(end);
start.setFullYear(end.getFullYear() - 1);
const tr = await raw("qloo_trends", { entities: ids.slice(0, 3), entity_type: TYPE, start_date: day(start), end_date: day(end), limit: 5 });
await save("trends", tr);
const trKeys = Object.keys(tr).filter((k) => !["query_intent", "execution", "resolution"].includes(k));
console.log(`  trends: ${tr.status} · results ${tr.results.length} · result_count ${tr.result_count} · fields: ${trKeys.join(", ")}`);
for (const k of trKeys.filter((k) => !["status", "summary", "schema_version", "operation", "interpretation"].includes(k))) {
  console.log(`    ${k}: ${short((tr as Record<string, unknown>)[k], 500)}`);
}

// E. Verdict
console.log("\nE. VERDICT");
console.log(`  accepted phrasings: ${Object.entries(accepted).map(([b, v]) => `${b}="${v.phrase}"`).join(", ") || "none"}`);
const y = accepted.young?.order ?? [];
const o = accepted.older?.order ?? [];
if (y.length) console.log(`  young: ${y.map(nameOf).join(" > ")}`);
if (o.length) console.log(`  older: ${o.map(nameOf).join(" > ")}`);
const rho = spearman(y, o);
if (y.length < 3 || o.length < 3) {
  console.log("  INCONCLUSIVE: rank returned fewer than 3 items per audience. Paste this output; scoring may need affinity or audience_demographics instead.");
} else if (rho !== null && rho < 0.6) {
  console.log(`  GO: young vs older Spearman ${rho.toFixed(2)}. Rankings differ by audience.`);
} else {
  console.log(`  NO-GO: young vs older Spearman ${rho?.toFixed(2)}. Rankings barely move.`);
}
process.exit(0);

async function raw(tool: string, args: Record<string, unknown>): Promise<QlooEnvelope> {
  try {
    return await callQlooTool(tool, args);
  } catch (err) {
    return { status: "error", summary: err instanceof Error ? err.message : String(err), results: [], result_count: 0 };
  }
}
function idsOf(env: QlooEnvelope): string[] {
  return env.results.map(entityFrom).filter((e) => e !== null).map((e) => e!.entityId);
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function day(d: Date) {
  return d.toISOString().slice(0, 10);
}
