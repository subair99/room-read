import { position } from "./bands";

export interface BridgeCandidate {
  id: string;
  name: string;
  /** One rank per audience, each from its own Qloo query */
  ranks: Array<number | null>;
  outOf: number[];
}

export interface BridgePick {
  id: string;
  name: string;
  /** Worse (higher) percentile position across audiences */
  worst: number;
  average: number;
}

/**
 * ENCORE-style bridge rule: choose the candidate whose WORSE audience position
 * is best; break ties on the better average. Raw scores are never averaged
 * across queries — only percentile positions within each query.
 * Candidates missing a rank for any audience are skipped.
 */
export function pickBridge(candidates: BridgeCandidate[]): BridgePick | null {
  const scored: BridgePick[] = [];
  for (const c of candidates) {
    const positions = c.ranks.map((r, i) => position(r, c.outOf[i] ?? 0));
    if (positions.some((p) => p === null)) continue;
    const ps = positions as number[];
    scored.push({
      id: c.id,
      name: c.name,
      worst: Math.max(...ps),
      average: ps.reduce((a, b) => a + b, 0) / ps.length,
    });
  }
  scored.sort((a, b) => a.worst - b.worst || a.average - b.average);
  return scored[0] ?? null;
}
