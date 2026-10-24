import type { BaselineItem } from "../lib/baseline/llmOnly";
import type { CheckResult } from "../lib/types";
import { position } from "../lib/agent/bands";

/** Share of the baseline's "will land" calls that Qloo ranks in the top half. */
export function agreementWithQloo(baseline: BaselineItem[], check: CheckResult): number | null {
  let total = 0;
  let agree = 0;
  for (const b of baseline.filter((x) => x.willLand)) {
    const v = check.verdicts.find((x) => x.reference.text.toLowerCase() === b.reference.toLowerCase());
    const s = v?.scores[0];
    const pos = s ? position(s.rank, s.outOf) : null;
    if (pos === null) continue;
    total++;
    if (pos <= 0.5) agree++;
  }
  return total ? agree / total : null;
}

const UNSUPPORTED = /\b(universal(ly)?|everyone knows|widely (known|recognized)|iconic|timeless|beloved by all|household name)\b/i;

/** Popularity claims made with no evidence attached. */
export function unsupportedClaims(baseline: BaselineItem[]): number {
  return baseline.filter((b) => UNSUPPORTED.test(b.reason)).length;
}

/** RoomRead's reasons come from ranks; count any that slip into the same language. */
export function unsupportedInRoomRead(check: CheckResult): number {
  return check.verdicts.filter((v) => UNSUPPORTED.test(v.reason)).length;
}

/** Spearman rank correlation between two orderings of the same ids. */
export function spearman(a: string[], b: string[]): number | null {
  const common = a.filter((x) => b.includes(x));
  const n = common.length;
  if (n < 3) return null;
  const ra = new Map(a.filter((x) => common.includes(x)).map((x, i) => [x, i]));
  const rb = new Map(b.filter((x) => common.includes(x)).map((x, i) => [x, i]));
  let d2 = 0;
  for (const x of common) d2 += (ra.get(x)! - rb.get(x)!) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

export function mean(xs: Array<number | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
