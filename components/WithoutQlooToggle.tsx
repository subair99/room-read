"use client";

import { useState } from "react";
import type { BaselineItem } from "@/lib/baseline/llmOnly";

/** Side-by-side: the LLM alone vs RoomRead's Qloo-grounded verdict. */
export function WithoutQlooToggle({ script, audienceLabel }: { script: string; audienceLabel: string }) {
  const [items, setItems] = useState<BaselineItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/baseline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ script, audienceLabel }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Baseline failed");
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Without Qloo (LLM only)</span>
        <button onClick={items ? () => setItems(null) : run} disabled={busy || !script} className="rounded border border-[var(--line)] px-2 py-1">
          {busy ? "Asking…" : items ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p className="mt-2 text-[var(--red)]">{error}</p>}
      {items && (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((it, i) => (
            <li key={i}>
              <strong>{it.reference}</strong>: {it.willLand ? "will land" : "won't land"} — {it.reason}
              {it.swap ? ` (suggests: ${it.swap})` : ""}
            </li>
          ))}
          <li className="text-xs text-[var(--muted)]">No ranks, no sources: this is the model's opinion.</li>
        </ul>
      )}
    </div>
  );
}
