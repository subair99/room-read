"use client";

import type { AgeBand, Mode, UserRules } from "@/lib/types";

export interface AudienceState {
  mode: Mode;
  ageBand: AgeBand;
  city: string;
  ageBandB: AgeBand;
  cityB: string;
  cities: string[];
  rules: UserRules;
}

const BANDS: AgeBand[] = ["18-34", "35-54", "55+"];

export function AudienceBar({ value, onChange, onRun, busy }: { value: AudienceState; onChange: (v: AudienceState) => void; onRun: () => void; busy: boolean }) {
  const set = (patch: Partial<AudienceState>) => onChange({ ...value, ...patch });
  return (
    <div className="panel flex flex-wrap items-end gap-3 p-3">
      <Field label="Mode">
        <select className="input" value={value.mode} onChange={(e) => set({ mode: e.target.value as Mode })}>
          <option value="check">Check (one audience)</option>
          <option value="bridge">Bridge (two audiences)</option>
          <option value="tour">Tour (up to 5 cities)</option>
        </select>
      </Field>

      <Field label={value.mode === "bridge" ? "Audience A age" : "Age band"}>
        <select className="input" value={value.ageBand} onChange={(e) => set({ ageBand: e.target.value as AgeBand })}>
          {BANDS.map((b) => <option key={b}>{b}</option>)}
        </select>
      </Field>

      {value.mode !== "tour" && (
        <Field label={value.mode === "bridge" ? "Audience A city" : "City"}>
          <input className="input" value={value.city} onChange={(e) => set({ city: e.target.value })} placeholder="Houston" />
        </Field>
      )}

      {value.mode === "bridge" && (
        <>
          <Field label="Audience B age">
            <select className="input" value={value.ageBandB} onChange={(e) => set({ ageBandB: e.target.value as AgeBand })}>
              {BANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Audience B city">
            <input className="input" value={value.cityB} onChange={(e) => set({ cityB: e.target.value })} placeholder="Houston" />
          </Field>
        </>
      )}

      {value.mode === "tour" && (
        <Field label="Cities (comma-separated, 2–5)">
          <input className="input w-72" value={value.cities.join(", ")} onChange={(e) => set({ cities: e.target.value.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 5) })} placeholder="Houston, Chicago, Atlanta" />
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value.rules.noBrands)} onChange={(e) => set({ rules: { ...value.rules, noBrands: e.target.checked } })} />
        No brand names
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value.rules.clean)} onChange={(e) => set({ rules: { ...value.rules, clean: e.target.checked } })} />
        Keep it clean
      </label>

      <button onClick={onRun} disabled={busy} className="ml-auto rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? "Reading…" : "Read the room"}
      </button>

      <style>{`.input{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:14px}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
      {label}
      {children}
    </label>
  );
}
