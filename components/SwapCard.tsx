import type { SwapResult } from "@/lib/types";

const STEP_LABEL = { next_equivalent: "Candidate", restructure: "Without a reference", flag: "Result" } as const;

/** Statistics only: every rung of the retry ladder and the evidence behind it. Actions live in Proposed changes. */
export function SwapCard({ result }: { result: SwapResult }) {
  return (
    <div className="panel flex flex-col gap-2 p-4 text-sm">
      <h3 className="font-semibold">Swap statistics</h3>
      <p className="text-[var(--muted)]">Original: {result.originalLine}</p>
      {result.summary && <p className="text-xs text-[var(--muted)]">{result.summary}</p>}
      <ol className="flex flex-col gap-2">
        {result.attempts.map((a, i) => (
          <li key={i} className={`rounded border p-2 ${a.accepted ? "border-[var(--green)]" : "border-[var(--line)]"}`}>
            <div className="text-xs text-[var(--muted)]">
              {i + 1}. {STEP_LABEL[a.step]}
              {a.candidate ? ` · ${a.candidate.name}` : ""}
              {a.accepted ? " · proposed" : ""}
            </div>
            {a.rewrittenLine && <div className="mt-1">{a.rewrittenLine}</div>}
            <div className="mt-1 text-xs">{a.note}</div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-[var(--muted)]">Apply or skip this in Proposed changes.</p>
    </div>
  );
}
