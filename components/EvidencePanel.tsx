import { LIMIT_NOTE } from "@/lib/evidence/labels";
import type { ReferenceVerdict, ResolvedEntity } from "@/lib/types";

export function EvidencePanel({
  verdict,
  onSwap,
  onConfirm,
}: {
  verdict?: ReferenceVerdict;
  onSwap: (v: ReferenceVerdict) => void;
  onConfirm: (refId: string, e: ResolvedEntity) => void;
}) {
  if (!verdict) return <div className="panel p-4 text-sm text-[var(--muted)]">Click a highlighted reference to see the evidence.</div>;
  const { reference, resolution, scores, band, reason } = verdict;
  return (
    <div className="panel flex flex-col gap-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">“{reference.text}”</h3>
        <span className={`band-${band} rounded px-2 py-0.5 text-xs font-semibold uppercase`}>{band}</span>
      </div>

      {resolution.entity && <p className="text-[var(--muted)]">Qloo entity: {resolution.entity.name} · {resolution.entity.type.split(":").pop()}</p>}

      {resolution.status === "ambiguous" && (
        <div>
          <p className="mb-1">Which one did you mean?</p>
          <div className="flex flex-wrap gap-2">
            {resolution.candidates?.map((c) => (
              <button key={c.entityId} onClick={() => onConfirm(reference.id, c)} className="rounded border border-[var(--line)] px-2 py-1 hover:border-[var(--accent)]">
                {c.name} <span className="text-[var(--muted)]">({c.type.split(":").pop()})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <table className="w-full">
        <thead className="text-left text-xs text-[var(--muted)]">
          <tr><th>Audience</th><th>Rank</th><th>Band</th><th>Trend</th></tr>
        </thead>
        <tbody>
          {scores.map((s) => (
            <tr key={s.audience}>
              <td>{s.audience}</td>
              <td>{s.rank === null ? "—" : `${s.rank} of ${s.outOf}`}</td>
              <td><span className={`band-${s.band} px-1`}>{s.band}</span></td>
              <td>{s.trend === "unknown" ? "—" : s.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p><span className="text-xs text-[var(--muted)]">Qloo result · </span>{reason}</p>

      {(band === "red" || band === "amber") && resolution.entity && (
        <button onClick={() => onSwap(verdict)} className="self-start rounded-lg bg-[var(--accent)] px-3 py-1.5 font-semibold text-white">
          Find a swap
        </button>
      )}

      <p className="text-xs text-[var(--muted)]">{LIMIT_NOTE}</p>
    </div>
  );
}
