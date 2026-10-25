"use client";

import type { ReferenceVerdict } from "@/lib/types";

/** The script with each reference highlighted by its band. Each line is its own paragraph. */
export function ScriptPane({
  script,
  onChange,
  verdicts,
  selectedId,
  onSelect,
  editable,
  busy,
}: {
  script: string;
  onChange: (s: string) => void;
  verdicts: ReferenceVerdict[];
  selectedId?: string;
  onSelect: (id: string) => void;
  editable: boolean;
  /** A check is running: keep showing the formatted script, highlights stream in */
  busy?: boolean;
}) {
  if (editable) {
    return (
      <textarea
        className="panel h-full min-h-[320px] w-full resize-none p-4 font-mono text-sm leading-8"
        value={script}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste a stand-up set, toast, keynote or ad. One line per beat. Write your own original material."
      />
    );
  }

  // Character offset where each line starts (references carry whole-script offsets).
  const lines = script.split("\n");
  const starts: number[] = [];
  let offset = 0;
  for (const l of lines) {
    starts.push(offset);
    offset += l.length + 1;
  }
  const sorted = [...verdicts].sort((a, b) => a.reference.start - b.reference.start);

  return (
    <div className="panel relative min-h-[320px] p-4 font-mono text-sm leading-7">
      {busy && (
        <p className="absolute right-4 top-2 font-sans text-xs text-[var(--muted)]" aria-live="polite">
          {verdicts.length ? "Re-checking… highlights updating" : "Reading the room…"}
        </p>
      )}
      {lines.map((text, i) => {
        const lineStart = starts[i];
        const lineEnd = lineStart + text.length;
        if (!text.trim()) return null; // blank lines: the paragraph gap already separates beats
        const parts: React.ReactNode[] = [];
        let cursor = lineStart;
        for (const v of sorted) {
          const { start, end, id } = v.reference;
          if (start < cursor || start >= lineEnd) continue;
          parts.push(script.slice(cursor, start));
          parts.push(
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`band-${v.band} rounded px-0.5 ${selectedId === id ? "outline outline-2 outline-[var(--accent)]" : ""}`}
              title={v.reason}
            >
              {script.slice(start, Math.min(end, lineEnd))}
            </button>,
          );
          cursor = Math.min(end, lineEnd);
        }
        parts.push(script.slice(cursor, lineEnd));
        return (
          <p key={i} className="mb-5 whitespace-pre-wrap last:mb-0">
            {parts}
          </p>
        );
      })}
    </div>
  );
}
