"use client";

import { useState } from "react";
import { SOURCE_LABEL } from "@/lib/evidence/labels";
import type { EvidenceRecord } from "@/lib/evidence/record";

/** Every Qloo call and every decision, labelled by where it came from. */
export function ReceiptsDrawer({ records }: { records: EvidenceRecord[] }) {
  const [open, setOpen] = useState(false);
  const qloo = records.filter((r) => r.source === "qloo");
  return (
    <div className="panel p-3 text-sm">
      <button onClick={() => setOpen(!open)} className="font-semibold">
        {open ? "▾" : "▸"} Receipts · {qloo.length} Qloo call{qloo.length === 1 ? "" : "s"} ({qloo.filter((r) => r.cached).length} cached)
      </button>
      {open && (
        <ol className="mt-2 flex max-h-96 flex-col gap-2 overflow-auto">
          {records.map((r) => (
            <li key={r.id} className="rounded border border-[var(--line)] p-2">
              <div className="text-xs text-[var(--muted)]">
                {SOURCE_LABEL[r.source]}
                {r.tool ? ` · ${r.tool}` : ""}
                {r.status ? ` · ${r.status}` : ""}
                {r.cached ? " · cached" : ""}
                {typeof r.durationMs === "number" && !r.cached ? ` · ${r.durationMs} ms` : ""}
              </div>
              <div>{r.reason}</div>
              {r.summary && <div className="text-xs">{r.summary}</div>}
              {r.inputs !== undefined && (
                <details className="text-xs">
                  <summary>inputs / output</summary>
                  <pre className="overflow-auto">{JSON.stringify({ inputs: r.inputs, output: r.output }, null, 2)}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
