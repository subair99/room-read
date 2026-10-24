// Shared types for RoomRead. Kept dependency-free so the agent, the API
// routes, the MCP server and the eval harness can all import them.

export type Mode = "check" | "bridge" | "tour";

/** Rank band shown to the user. "unknown" = not enough Qloo signal. */
export type Band = "green" | "amber" | "red" | "unknown";

export type Trend = "rising" | "fading" | "steady" | "unknown";

/** UI age bands. Mapped to Qloo's demographic values in lib/audience.ts. */
export type AgeBand = "18-34" | "35-54" | "55+";

export interface Audience {
  /** Display label, e.g. "Houston · 18-34" */
  label: string;
  ageBand?: AgeBand;
  city?: string;
}

export interface UserRules {
  noBrands?: boolean;
  clean?: boolean;
  /** Free-text rules, passed to the rewrite prompt only. */
  custom?: string[];
}

export interface Reference {
  id: string;
  /** Exact text as written in the script, e.g. "MySpace" */
  text: string;
  /** 0-based line index */
  line: number;
  /** Character offsets within the whole script */
  start: number;
  end: number;
  /** LLM's guess at the kind of thing: tv_show, artist, brand, movie, place... */
  kind: string;
}

export interface ResolvedEntity {
  entityId: string;
  name: string;
  /** Qloo entity type, e.g. "urn:entity:tv_show" */
  type: string;
}

export type ResolveStatus = "resolved" | "ambiguous" | "not_found";

export interface ResolveOutcome {
  status: ResolveStatus;
  entity?: ResolvedEntity;
  candidates?: ResolvedEntity[];
}

export interface AudienceScore {
  audience: string;
  /** 1-based position in the ranked list, or null if Qloo returned nothing */
  rank: number | null;
  /** Size of the ranked list (script references + anchors) */
  outOf: number;
  band: Band;
  trend: Trend;
}

export interface ReferenceVerdict {
  reference: Reference;
  resolution: ResolveOutcome;
  scores: AudienceScore[];
  /** Overall band; for Bridge this is the WORSE of the audiences */
  band: Band;
  /** One-line reason, built from Qloo results (never invented) */
  reason: string;
}

export type Verdict = "ship" | "tweak" | "rework";

export interface CheckRequest {
  script: string;
  mode: Mode;
  audiences: Audience[];
  rules?: UserRules;
  /** Pre-confirmed entity choices from a previous needs_input round */
  confirmed?: Record<string, ResolvedEntity>;
}

export interface CheckResult {
  mode: Mode;
  audiences: Audience[];
  verdicts: ReferenceVerdict[];
  verdict: Verdict;
  tweakCount: number;
  receipts: import("./evidence/record").EvidenceRecord[];
}

export type LadderStep = "next_equivalent" | "restructure" | "flag";

export interface SwapAttempt {
  step: LadderStep;
  candidate?: ResolvedEntity;
  rewrittenLine?: string;
  /** Percentile position (0 = best, 1 = worst) for the candidate */
  newPosition?: number | null;
  accepted: boolean;
  note: string;
}

export interface SwapResult {
  referenceId: string;
  originalLine: string;
  originalPosition: number | null;
  attempts: SwapAttempt[];
  accepted?: SwapAttempt;
  flagged: boolean;
  reason: string;
}

/** Events streamed to the browser over SSE while the agent works. */
export type AgentEvent =
  | { type: "stage"; stage: string; detail?: string }
  | { type: "reference"; verdict: ReferenceVerdict }
  | { type: "needs_input"; referenceId: string; text: string; candidates: ResolvedEntity[] }
  | { type: "done"; result: CheckResult }
  | { type: "promo"; result: PromoSummary }
  | { type: "error"; message: string };

export type Emit = (event: AgentEvent) => void;

/** Tour promo outcome sent to the browser: RoomRead's draft, what it fixed, the final copy. */
export interface PromoSummary {
  city: string;
  draft: string;
  final: string;
  fixes: Array<{ reference: string; accepted: boolean; note: string }>;
}
