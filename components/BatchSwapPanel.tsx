"use client";

import { useEffect, useState } from "react";
import type { ResolvedEntity, SwapResult } from "@/lib/types";

export type BatchItem =
  | { ok: true; line: number; text: string; result: SwapResult }
  | { ok: false; line: number; text: string; error: string };

export interface BatchAccept {
  line: number;
  newLine: string;
  /** The swapped-in entity; absent when the reference is dropped */
  entity?: ResolvedEntity;
}

const dropLine = (r: SwapResult) => r.attempts.find((a) => a.step === "restructure" && a.rewrittenLine)?.rewrittenLine;

/**
 * Proposed changes: one row per flagged line (from a single or a combined search),
 * each with its own Apply button, plus Apply selected for several at once.
 */
export function BatchSwapPanel({
  items,
  skipped,
  busy,
  onApply,
  onClose,
}: {
  items: BatchItem[];
  skipped: Array<{ text: string; reason: string }>;
  busy: boolean;
  onApply: (accepts: BatchAccept[]) => void;
  onClose: () => void;
}) {
  // Every applicable change, one per line: a swap if Qloo found one, otherwise the optional drop.
  type Option = BatchAccept & { kind: "swap" | "drop" };
  const options: Option[] = items.flatMap<Option>((i) => {
    if (!i.ok) return [];
    const swapLine = i.result.accepted?.rewrittenLine;
    if (swapLine) return [{ kind: "swap" as const, line: i.line, newLine: swapLine, entity: i.result.accepted!.candidate }];
    const drop = dropLine(i.result);
    return drop ? [{ kind: "drop" as const, line: i.line, newLine: drop }] : [];
  });
  // Swaps start ticked; drops start unticked (keeping the original is the recommendation).
  const defaults = () => new Set(options.filter((o) => o.kind === "swap").map((o) => o.line));
  const [picked, setPicked] = useState<Set<number>>(defaults);
  const [pending, setPending] = useState<string | null>(null);

  // New items arrive (or applied ones leave): reset selection and the pressed button.
  useEffect(() => {
    setPicked(defaults());
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const toggle = (line: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(line)) n.delete(line);
      else n.add(line);
      return n;
    });
  const allPicked = options.length > 0 && options.every((o) => picked.has(o.line));
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(options.map((o) => o.line)));
  const chosen = options.filter((o) => picked.has(o.line));
  const swapsChosen = chosen.filter((o) => o.kind === "swap").length;
  const dropsChosen = chosen.length - swapsChosen;

  const applyOne = (key: string, accept: BatchAccept) => {
    setPending(key);
    onApply([accept]);
  };
  const applySelected = () => {
    setPending("selected");
    onApply(chosen.map(({ line, newLine, entity }) => ({ line, newLine, entity })));
  };
  const locked = busy || pending !== null;

  return (
    <div className="panel flex flex-col gap-3 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Proposed changes</h3>
        <div className="flex items-center gap-2">
          {options.length > 1 && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={allPicked} onChange={toggleAll} disabled={locked} />
              Select all ({options.length})
            </label>
          )}
          <button onClick={onClose} className="rounded px-2 py-1 text-xs text-[var(--muted)]">
            Close
          </button>
        </div>
      </div>

      {items.map((it) => {
        const swapLine = it.ok ? it.result.accepted?.rewrittenLine : undefined;
        const drop = it.ok && !swapLine ? dropLine(it.result) : undefined;
        return (
          <div key={it.line} className={`rounded border p-3 ${swapLine ? "border-[var(--green)]" : "border-[var(--line)]"}`}>
            <div className="text-xs text-[var(--muted)]">
              Line {it.line + 1} · “{it.text}”
            </div>

            {!it.ok && <p className="mt-1 text-[var(--red)]">{it.error}</p>}

            {it.ok && swapLine && (
              <div className="mt-1 flex flex-wrap items-start gap-3">
                <label className="flex flex-1 items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={picked.has(it.line)} onChange={() => toggle(it.line)} disabled={locked} />
                  <span>
                    <span className="block">{swapLine}</span>
                    <span className="block text-xs text-[var(--muted)]">{it.result.accepted!.note}</span>
                  </span>
                </label>
                <button
                  disabled={locked}
                  onClick={() => applyOne(`swap-${it.line}`, { line: it.line, newLine: swapLine, entity: it.result.accepted!.candidate })}
                  className="rounded-lg bg-[var(--green)] px-3 py-1.5 font-semibold text-white"
                >
                  {pending === `swap-${it.line}` ? "Applying…" : "Apply swap"}
                </button>
              </div>
            )}

            {it.ok && !swapLine && (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-[var(--amber)]">
                  {it.result.reason}
                  {it.result.summary ? <span className="block text-xs text-[var(--muted)]">{it.result.summary}</span> : null}
                </p>
                {drop && (
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex flex-1 items-start gap-2 text-[var(--muted)]">
                      <input type="checkbox" className="mt-1" checked={picked.has(it.line)} onChange={() => toggle(it.line)} disabled={locked} />
                      <span>Without the reference: {drop}</span>
                    </label>
                    <button
                      disabled={locked}
                      onClick={() => applyOne(`drop-${it.line}`, { line: it.line, newLine: drop })}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5"
                    >
                      {pending === `drop-${it.line}` ? "Applying…" : "Drop the reference"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {skipped.map((s) => (
        <p key={s.text} className="text-xs text-[var(--muted)]">
          “{s.text}”: {s.reason}
        </p>
      ))}

      {options.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={applySelected}
            disabled={locked || chosen.length === 0}
            className="rounded-lg bg-[var(--green)] px-3 py-1.5 font-semibold text-white"
          >
            {pending === "selected" ? "Applying…" : `Apply selected (${chosen.length}) and re-check`}
          </button>
          <span className="text-xs text-[var(--muted)]">
            {swapsChosen} swap{swapsChosen === 1 ? "" : "s"} · {dropsChosen} drop{dropsChosen === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}
