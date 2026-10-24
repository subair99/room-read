"use client";

import type { ReferenceVerdict } from "@/lib/types";

/** The script with each reference highlighted by its band. */
export function ScriptPane({
  script,
  onChange,
  verdicts,
  selectedId,
  onSelect,
  editable,
}: {
  script: string;
  onChange: (s: string) => void;
  verdicts: ReferenceVerdict[];
  selectedId?: string;
  onSelect: (id: string) => void;
  editable: boolean;
}) {
  if (editable || verdicts.length === 0) {
    return (
      <textarea
        className="panel h-full min-h-[320px] w-full resize-none p-4 font-mono text-sm leading-6"
        value={script}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a stand-up set, toast, keynote or ad. Write your own original material."
      />
    );
  }

  const sorted = [...verdicts].sort((a, b) => a.reference.start - b.reference.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const v of sorted) {
    const { start, end, id } = v.reference;
    if (start < cursor) continue;
    parts.push(script.slice(cursor, start));
    parts.push(
      <button
        key={id}
        onClick={() => onSelect(id)}
        className={`band-${v.band} rounded px-0.5 ${selectedId === id ? "outline outline-2 outline-[var(--accent)]" : ""}`}
        title={v.reason}
      >
        {script.slice(start, end)}
      </button>,
    );
    cursor = end;
  }
  parts.push(script.slice(cursor));

  return <div className="panel min-h-[320px] whitespace-pre-wrap p-4 font-mono text-sm leading-7">{parts}</div>;
}
