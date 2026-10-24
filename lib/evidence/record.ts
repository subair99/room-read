import type { QlooStatus } from "../qloo/schemas";

/**
 * Where a piece of information came from. The UI shows these as separate
 * labels so Qloo results are never confused with our interpretation.
 */
export type EvidenceSource = "qloo" | "interpretation" | "user_rule" | "llm";

export interface EvidenceRecord {
  id: string;
  at: string;
  source: EvidenceSource;
  /** Qloo tool name when source === "qloo" */
  tool?: string;
  /** Why this call or decision was made, in plain words */
  reason: string;
  inputs?: unknown;
  status?: QlooStatus;
  summary?: string;
  resultCount?: number;
  /** Trimmed output kept for the receipts drawer */
  output?: unknown;
  cached?: boolean;
  durationMs?: number;
}

let counter = 0;

export class Receipts {
  readonly records: EvidenceRecord[] = [];

  add(r: Omit<EvidenceRecord, "id" | "at">): EvidenceRecord {
    const rec: EvidenceRecord = {
      id: `ev_${Date.now().toString(36)}_${(counter++).toString(36)}`,
      at: new Date().toISOString(),
      ...r,
    };
    this.records.push(rec);
    return rec;
  }

  qlooCalls(): number {
    return this.records.filter((r) => r.source === "qloo" && !r.cached).length;
  }
}

/** Keep receipts small: cap arrays and strip long strings. */
export function trimForReceipt(value: unknown, maxItems = 10, maxStr = 300): unknown {
  if (Array.isArray(value)) return value.slice(0, maxItems).map((v) => trimForReceipt(v, maxItems, maxStr));
  if (typeof value === "string") return value.length > maxStr ? `${value.slice(0, maxStr)}…` : value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = trimForReceipt(v, maxItems, maxStr);
    return out;
  }
  return value;
}
