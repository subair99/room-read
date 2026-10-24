import type { ReferenceVerdict } from "@/lib/types";

/** Reference × city grid of rank bands. No invented percentages. */
export function TourHeatmap({ verdicts, cities }: { verdicts: ReferenceVerdict[]; cities: string[] }) {
  if (cities.length < 2) return null;
  return (
    <div className="panel overflow-x-auto p-4 text-sm">
      <h3 className="mb-2 font-semibold">Tour heatmap</h3>
      <table className="w-full border-separate border-spacing-1">
        <thead className="text-xs text-[var(--muted)]">
          <tr>
            <th className="text-left">Reference</th>
            {cities.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {verdicts.map((v) => (
            <tr key={v.reference.id}>
              <td>{v.reference.text}</td>
              {v.scores.map((s) => (
                <td key={s.audience} className={`band-${s.band} rounded text-center`} title={s.rank === null ? "Not enough signal" : `Rank ${s.rank} of ${s.outOf}`}>
                  {s.band === "unknown" ? "?" : s.band[0].toUpperCase()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--muted)]">G / A / R = top, middle, bottom third of the ranking for that city.</p>
    </div>
  );
}
