import type { SwapResult } from "@/lib/types";

const STEP_LABEL = { next_equivalent: "Equivalent", restructure: "Restructure", flag: "Flagged" } as const;

/** Shows every rung of the retry ladder, not just the winner. */
export function SwapCard({ result, onAccept }: { result: SwapResult; onAccept: (line: string) => void }) {
  return (
    <div className="panel flex flex-col gap-2 p-4 text-sm">
      <h3 className="font-semibold">Swap attempts</h3>
      <p className="text-[var(--muted)]">Original: {result.originalLine}</p>
      <ol className="flex flex-col gap-2">
        {result.attempts.map((a, i) => (
          <li key={i} className={`rounded border p-2 ${a.accepted ? "border-[var(--green)]" : "border-[var(--line)]"}`}>
            <div className="text-xs text-[var(--muted)]">
              {i + 1}. {STEP_LABEL[a.step]}
              {a.candidate ? ` · ${a.candidate.name}` : ""}
            </div>
            {a.rewrittenLine && <div className="mt-1">{a.rewrittenLine}</div>}
            <div className="mt-1 text-xs">{a.note}</div>
          </li>
        ))}
      </ol>
      {result.accepted?.rewrittenLine && (
        <button onClick={() => onAccept(result.accepted!.rewrittenLine!)} className="self-start rounded-lg bg-[var(--green)] px-3 py-1.5 font-semibold text-white">
          Accept swap
        </button>
      )}
      {result.flagged && <p className="font-semibold text-[var(--red)]">{result.reason}</p>}
    </div>
  );
}
