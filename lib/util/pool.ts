/** Map with at most `limit` promises in flight; keeps input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Qloo calls in flight at once. Kind to the event quota, much faster than one-by-one. */
export const QLOO_CONCURRENCY = Number(process.env.QLOO_CONCURRENCY || 3);
