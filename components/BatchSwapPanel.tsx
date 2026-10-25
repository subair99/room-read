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
  const swappable = items.filter((i): i is Extract<BatchItem, { ok: true }> => i.ok && Boolean(i.result.accepted?.rewrittenLine));
  const [picked, setPicked] = useState<Set<number>>(new Set(swappable.map((p) => p.line)));
  const [pending, setPending] = useState<string | null>(null);

  // New items arrive (or applied ones leave): reset selection and the pressed button.
  useEffect(() => {
    setPicked(new Set(swappable.map((p) => p.line)));
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

  const applyOne = (key: string, accept: BatchAccept) => {
    setPending(key);
    onApply([accept]);
  };
  const applySelected = () => {
    setPending("selected");
    onApply(
      swappable
        .filter((p) => picked.has(p.line))
        .map((p) => ({ line: p.line, newLine: p.result.accepted!.rewrittenLine!, entity: p.result.accepted!.candidate })),
    );
  };
  const locked = busy || pending !== null;

  return (
    <div className="panel flex flex-col gap-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Proposed changes</h3>
        <button onClick={onClose} className="rounded px-2 py-1 text-xs text-[var(--muted)]">
          Close
        </button>
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
                    <span className="flex-1 text-[var(--muted)]">Without the reference: {drop}</span>
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

      {swappable.length > 1 && (
        <button
          onClick={applySelected}
          disabled={locked || picked.size === 0}
          className="self-start rounded-lg bg-[var(--green)] px-3 py-1.5 font-semibold text-white"
        >
          {pending === "selected" ? "Applying…" : `Apply selected (${picked.size}) and re-check`}
        </button>
      )}
    </div>
  );
}
