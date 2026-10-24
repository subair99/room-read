/**
 * DAY-1 GO / NO-GO SPIKE — run this before building anything else.
 *   npm run spike
 *
 * 1. Lists the harness tools and saves their input schemas (spike/out/tools.json).
 *    Use that file to fix argument names in lib/qloo/tools.ts and lib/audience.ts.
 * 2. Resolves 10 references, ranks them for 2 age bands and 2 cities,
 *    checks trends for 3 and where_popular for 1. Saves every raw response.
 * 3. Prints GO if the rankings clearly differ between audiences.
 *
 * Uses raw calls (no cache) so you see exactly what Qloo returns.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { audienceSignals, makeAudience } from "../lib/audience";
import { callQlooTool, listQlooTools } from "../lib/qloo/client";
import { entityFrom } from "../lib/qloo/schemas";
import { spearman } from "../eval/metrics";

const REFERENCES = ["Seinfeld", "Friends", "Love Island", "Stranger Things", "Squid Game", "The Golden Girls", "Euphoria", "Wheel of Fortune", "The Office", "Bluey"];
const TYPE = "urn:entity:tv_show";
const AUDIENCES = [makeAudience("18-34"), makeAudience("55+"), makeAudience(undefined, "Houston"), makeAudience(undefined, "New York")];

const OUT = "spike/out";
await mkdir(OUT, { recursive: true });
const save = (name: string, data: unknown) => writeFile(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));

// 1. Tools and their input schemas
const { tools } = await listQlooTools();
await save("tools", tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })));
console.log(`Tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);

// 2a. Resolve
const ids: Record<string, string> = {};
for (const name of REFERENCES) {
  const t0 = Date.now();
  const env = await callQlooTool("qloo_describe", { query: name });
  await save(`describe-${slug(name)}`, env);
  const e = env.results.map(entityFrom).find((x) => x && x.type === TYPE) ?? env.results.map(entityFrom).find(Boolean);
  if (e) ids[name] = e.entityId;
  console.log(`describe ${name}: ${env.status} → ${e ? `${e.name} (${e.type})` : "no entity"} · ${Date.now() - t0} ms`);
}

// 2b. Rank per audience
const orders: Record<string, string[]> = {};
for (const a of AUDIENCES) {
  const t0 = Date.now();
  const args = { options: Object.values(ids), option_type: TYPE, ...audienceSignals(a) };
  const env = await callQlooTool("qloo_rank", args);
  await save(`rank-${slug(a.label)}`, { args, env });
  orders[a.label] = env.results.map(entityFrom).filter(Boolean).map((e) => e!.entityId);
  const names = orders[a.label].map((id) => Object.keys(ids).find((k) => ids[k] === id) ?? id);
  console.log(`rank ${a.label}: ${env.status} · ${Date.now() - t0} ms\n   ${names.join(" > ")}`);
}

// 2c. Trends and where_popular
const trendIds = Object.values(ids).slice(0, 3);
const end = new Date();
const start = new Date(end);
start.setFullYear(end.getFullYear() - 1);
await save("trends", await callQlooTool("qloo_trends", { entity_type: TYPE, entities: trendIds, start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) }).catch((e) => ({ error: String(e) })));
await save("where-popular", await callQlooTool("qloo_where_popular", { entity: Object.values(ids)[0], within: "United States" }).catch((e) => ({ error: String(e) })));

// 3. Go / no-go
const age = spearman(orders["18-34"] ?? [], orders["55+"] ?? []);
const city = spearman(orders["Houston"] ?? [], orders["New York"] ?? []);
console.log(`\nSpearman 18-34 vs 55+: ${age?.toFixed(2) ?? "n/a"}   Houston vs New York: ${city?.toFixed(2) ?? "n/a"}`);
const go = (age !== null && age < 0.6) || (city !== null && city < 0.8);
console.log(go
  ? "GO: rankings differ by audience. Build RoomRead."
  : "NO-GO: rankings barely move between audiences. Check the arguments in spike/out/rank-*.json first; if they're right, switch to ENCORE Bridge.");
console.log(`Raw responses saved in ${OUT}/`);
process.exit(0);

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
