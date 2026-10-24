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
export function JudgeModePicker({ onPick }: { onPick: (s: JudgeScript) => void }) {
  const [items, setItems] = useState<JudgeScript[]>([]);
  useEffect(() => {
    fetch("/api/judge").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => setItems([]));
  }, []);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[var(--muted)]">Judge mode:</span>
      {items.map((s) => (
        <button key={s.id} onClick={() => onPick(s)} className="rounded-full border border-[var(--line)] px-3 py-1 hover:border-[var(--accent)]">
          {s.title}
        </button>
      ))}
    </div>
  );
}
