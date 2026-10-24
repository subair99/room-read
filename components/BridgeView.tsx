import type { ReferenceVerdict } from "@/lib/types";

/** Both audiences' rankings side by side; the overall band is the worse one. */
export function BridgeView({ verdicts, audiences }: { verdicts: ReferenceVerdict[]; audiences: string[] }) {
  if (audiences.length < 2) return null;
  return (
    <div className="panel overflow-x-auto p-4 text-sm">
      <h3 className="mb-2 font-semibold">Bridge: judged on the weaker audience</h3>
      <table className="w-full">
        <thead className="text-left text-xs text-[var(--muted)]">
          <tr>
            <th>Reference</th>
            {audiences.map((a) => <th key={a}>{a}</th>)}
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          {verdicts.map((v) => (
            <tr key={v.reference.id}>
              <td>{v.reference.text}</td>
              {v.scores.map((s) => (
                <td key={s.audience}><span className={`band-${s.band} px-1`}>{s.rank === null ? "—" : `${s.rank}/${s.outOf}`}</span></td>
              ))}
              <td><span className={`band-${v.band} px-1 font-semibold`}>{v.band}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
