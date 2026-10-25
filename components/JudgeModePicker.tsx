"use client";

import { useEffect, useState } from "react";
import type { AgeBand, Mode } from "@/lib/types";

export interface JudgeScript {
  id: string;
  title: string;
  mode: Mode;
  script: string;
  audience?: { ageBand?: AgeBand; city?: string };
  audiences?: Array<{ ageBand?: AgeBand; city?: string }>;
  cities?: string[];
  ageBand?: AgeBand;
  promo?: { show: string; city: string };
  note?: string;
}

/** Five preloaded original scripts so judges can try it without typing. */
export function JudgeModePicker({ onPick, activeId }: { onPick: (s: JudgeScript) => void; activeId?: string | null }) {
  const [items, setItems] = useState<JudgeScript[]>([]);
  useEffect(() => {
    fetch("/api/judge").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => setItems([]));
  }, []);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[var(--muted)]">Judge mode:</span>
      {items.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-white"
                : "border-[var(--line)] hover:border-[var(--accent)]"
            }`}
          >
            {s.title}
          </button>
        );
      })}
    </div>
  );
}
