/**
 * Per-IP token bucket. Protects the shared event quota during judging.
 * In-memory is fine for one always-on container.
 */
type Bucket = { tokens: number; updated: number };
const g = globalThis as unknown as { __buckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__buckets ??= new Map());

export function allow(ip: string, perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE || 20)): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: perMinute, updated: now };
  const refill = ((now - b.updated) / 60_000) * perMinute;
  b.tokens = Math.min(perMinute, b.tokens + refill);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function tooMany(): Response {
  return Response.json({ error: "Too many requests. Try judge mode, or wait a minute." }, { status: 429 });
}
