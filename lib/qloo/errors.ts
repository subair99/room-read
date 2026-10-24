import type { QlooEnvelope } from "./schemas";

export class QlooError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly recovery?: string,
  ) {
    super(message);
    this.name = "QlooError";
  }

  static fromEnvelope(env: QlooEnvelope): QlooError {
    return new QlooError(
      env.summary || env.error?.code || "Qloo returned an error",
      env.error?.code ?? "QLOO_ERROR",
      env.error?.retryable ?? false,
      env.error?.recovery,
    );
  }
}

export const MAX_RETRIES = 2;

/** Bounded exponential backoff: 500 ms, 1 s. Only used when retryable is true. */
export function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Statuses that still carry usable results. */
export function hasUsableResults(env: QlooEnvelope): boolean {
  return (env.status === "ok" || env.status === "partial" || env.status === "degraded") && env.results.length > 0;
}
