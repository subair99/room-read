import type { BaselineItem } from "../lib/baseline/llmOnly";
import type { CheckResult, ReferenceVerdict } from "../lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Find RoomRead's verdict for a reference the baseline named (loose text/entity match). */
export function matchVerdict(name: string, check: CheckResult): ReferenceVerdict | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return check.verdicts.find((v) => {
    const t = norm(v.reference.text);
    const e = norm(v.resolution.entity?.name ?? "");
    return t === n || e === n || (t && (t.includes(n) || n.includes(t))) || (e && (e.includes(n) || n.includes(e)));
  });
}

export interface AgreementCounts {
  /** Baseline "will land" calls where Qloo has a band */
  landCalls: number;
  /** ...that Qloo scores green */
  confirmed: number;
  /** ...that Qloo scores red (the baseline was confidently wrong) */
  overconfident: number;
  /** References Qloo scores red */
  qlooRed: number;
  /** ...that the baseline also flagged as not landing */
  baselineCaught: number;
}

export function agreement(baseline: BaselineItem[], check: CheckResult): AgreementCounts {
  const c: AgreementCounts = { landCalls: 0, confirmed: 0, overconfident: 0, qlooRed: 0, baselineCaught: 0 };
  for (const b of baseline) {
    const v = matchVerdict(b.reference, check);
    if (!v || v.band === "unknown") continue;
    if (b.willLand) {
      c.landCalls++;
      if (v.band === "green") c.confirmed++;
      if (v.band === "red") c.overconfident++;
    }
  }
  for (const v of check.verdicts.filter((x) => x.band === "red")) {
    c.qlooRed++;
    const b = baseline.find((x) => matchVerdict(x.reference, { ...check, verdicts: [v] }));
    if (b && !b.willLand) c.baselineCaught++;
  }
  return c;
}

const UNSUPPORTED = /\b(universal(ly)?|everyone knows|widely (known|recognized|recognised)|iconic|timeless|beloved by all|household name)\b/i;

/** Popularity claims made with no evidence attached. */
export function unsupportedClaims(baseline: BaselineItem[]): number {
  return baseline.filter((b) => UNSUPPORTED.test(b.reason)).length;
}

/** RoomRead's reasons come from Qloo numbers; count any that slip into the same language. */
export function unsupportedInRoomRead(check: CheckResult): number {
  return check.verdicts.filter((v) => UNSUPPORTED.test(v.reason)).length;
}

export function mean(xs: Array<number | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Spearman rank correlation between two orderings of the same ids (used by the spike). */
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
