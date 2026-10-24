import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { QlooEnvelope } from "./schemas";

/**
 * SQLite cache keyed on tool + inputs. Protects the event quota and makes
 * judge mode instant. Only "ok" and "empty" results are cached.
 *
 * Uses Node's built-in SQLite (node:sqlite, Node 22.13+), so there is no
 * native module to compile on any machine or host.
 */
const g = globalThis as unknown as { __qlooCache?: DatabaseSync };

function db(): DatabaseSync {
  if (g.__qlooCache) return g.__qlooCache;
  const path = process.env.CACHE_PATH || "data/cache.db";
  mkdirSync(dirname(path), { recursive: true });
  const d = new DatabaseSync(path);
  d.exec("PRAGMA journal_mode = WAL");
  d.exec(`CREATE TABLE IF NOT EXISTS qloo_cache (
    key TEXT PRIMARY KEY,
    tool TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  g.__qlooCache = d;
  return d;
}

const ttlMs = () => Number(process.env.CACHE_TTL_HOURS || 72) * 3600_000;

export function cacheKey(tool: string, args: unknown): string {
  return createHash("sha256").update(tool).update("\0").update(stableStringify(args)).digest("hex");
}

export function cacheGet(tool: string, args: unknown): QlooEnvelope | null {
  const row = db()
    .prepare("SELECT body, created_at FROM qloo_cache WHERE key = ?")
    .get(cacheKey(tool, args)) as { body: string; created_at: number } | undefined;
  if (!row) return null;
  if (Date.now() - Number(row.created_at) > ttlMs()) return null;
  return JSON.parse(row.body) as QlooEnvelope;
}

export function cachePut(tool: string, args: unknown, env: QlooEnvelope): void {
  if (env.status !== "ok" && env.status !== "empty") return;
  db()
    .prepare("INSERT OR REPLACE INTO qloo_cache (key, tool, body, created_at) VALUES (?, ?, ?, ?)")
    .run(cacheKey(tool, args), tool, JSON.stringify(env), Date.now());
}

/** Deterministic JSON so {a,b} and {b,a} hit the same cache key. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
