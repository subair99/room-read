"use client";

import { useMemo, useState } from "react";
import { AudienceBar, type AudienceState } from "@/components/AudienceBar";
import { BatchSwapPanel, type BatchAccept, type BatchItem } from "@/components/BatchSwapPanel";
import { BridgeView } from "@/components/BridgeView";
import { EvidencePanel } from "@/components/EvidencePanel";
import { JudgeModePicker, type JudgeScript } from "@/components/JudgeModePicker";
import { ReceiptsDrawer } from "@/components/ReceiptsDrawer";
import { ScriptPane } from "@/components/ScriptPane";
import { SwapCard } from "@/components/SwapCard";
import { TourHeatmap } from "@/components/TourHeatmap";
import { VerdictBadge } from "@/components/VerdictBadge";
import { WithoutQlooToggle } from "@/components/WithoutQlooToggle";
import { position } from "@/lib/agent/bands";
import { audienceLabel } from "@/lib/audience";
import { fetchResult, streamAgent } from "@/lib/client/stream";
import type { EvidenceRecord } from "@/lib/evidence/record";
import type { AgentEvent, CheckResult, PromoSummary, ReferenceVerdict, ResolvedEntity, SwapResult } from "@/lib/types";

const START: AudienceState = {
  mode: "check",
  ageBand: "18-34",
  city: "Houston",
  ageBandB: "55+",
  cityB: "Houston",
  cities: ["Houston", "Chicago", "Atlanta"],
  rules: {},
};

export default function Home() {
  const [script, setScript] = useState("");
  const [aud, setAud] = useState<AudienceState>(START);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [verdicts, setVerdicts] = useState<ReferenceVerdict[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [swap, setSwap] = useState<SwapResult | null>(null);
  const [swapReceipts, setSwapReceipts] = useState<EvidenceRecord[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, ResolvedEntity>>({});
  // Swaps you accepted: re-checks reuse the exact entity instead of resolving the name again.
  const [byText, setByText] = useState<Record<string, ResolvedEntity>>({});
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [promoReq, setPromoReq] = useState<{ show: string; city: string } | undefined>();
  const [promo, setPromo] = useState<PromoSummary | null>(null);
  const [batch, setBatch] = useState<{ items: BatchItem[]; skipped: Array<{ text: string; reason: string }> } | null>(null);
  const [includeAmber, setIncludeAmber] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [activeJudge, setActiveJudge] = useState<string | null>(null);

  const audiences = useMemo(() => {
    if (aud.mode === "bridge") return [{ ageBand: aud.ageBand, city: aud.city || undefined }, { ageBand: aud.ageBandB, city: aud.cityB || undefined }];
    if (aud.mode === "tour") return aud.cities.map((c) => ({ ageBand: aud.ageBand, city: c }));
    return [{ ageBand: aud.ageBand, city: aud.city || undefined }];
  }, [aud]);

  const selected = verdicts.find((v) => v.reference.id === selectedId);
  // Side panel: statistics for the clicked reference, from Proposed changes (same line).
  const selectedStatsItem = selected ? batch?.items.find((i) => i.ok && i.line === selected.reference.line && i.text === selected.reference.text) : undefined;
  const selectedStats = selectedStatsItem && selectedStatsItem.ok ? selectedStatsItem.result : null;

  async function run(override?: { script?: string; aud?: AudienceState; confirmed?: Record<string, ResolvedEntity>; byText?: Record<string, ResolvedEntity>; promo?: { show: string; city: string } | null; keepProposals?: boolean }) {
    const s = override?.script ?? script;
    const a = override?.aud ?? aud;
    const conf = override?.confirmed ?? confirmed;
    const named = override?.byText ?? byText;
    if (!s.trim()) return;
    setBusy(true);
    setError(null);
    setVerdicts([]);
    setResult(null);
    setSwap(null);
    setPromo(null);
    if (!override?.keepProposals) setBatch(null);
    setEditing(false);
    const promoBody = override?.promo === null ? undefined : override?.promo ?? promoReq;

    const onEvent = (e: AgentEvent) => {
      if (e.type === "stage") setStage(e.detail ?? e.stage);
      if (e.type === "reference") setVerdicts((vs) => [...vs.filter((v) => v.reference.id !== e.verdict.reference.id), e.verdict]);
      if (e.type === "done") setResult((r) => r ?? e.result); // Tour: keep the main check, not the promo's
      if (e.type === "promo") setPromo(e.result);
      if (e.type === "error") setError(e.message);
    };

    try {
      if (a.mode === "bridge") {
        await streamAgent("/api/bridge", { script: s, audiences: [{ ageBand: a.ageBand, city: a.city || undefined }, { ageBand: a.ageBandB, city: a.cityB || undefined }], rules: a.rules, confirmed: conf, confirmedByText: named }, onEvent);
      } else if (a.mode === "tour") {
        await streamAgent("/api/tour", { script: s, cities: a.cities, ageBand: a.ageBand, rules: a.rules, promo: promoBody, confirmedByText: named }, onEvent);
      } else {
        await streamAgent("/api/check", { script: s, audience: { ageBand: a.ageBand, city: a.city || undefined }, rules: a.rules, confirmed: conf, confirmedByText: named }, onEvent);
      }
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const flagged = verdicts
    .filter((v) => v.resolution.entity && (v.band === "red" || (includeAmber && v.band === "amber")))
    .sort((a, b) => (a.band === b.band ? 0 : a.band === "red" ? -1 : 1)); // worst first: one swap per line

  async function findAllSwaps() {
    if (!flagged.length) return;
    setBatch(null);
    setSwap(null);
    setError(null);
    setStage(`Finding swaps for ${flagged.length} flagged reference${flagged.length === 1 ? "" : "s"}`);
    setBatchBusy(true);
    try {
      const data = await fetchResult<{ results: BatchItem[]; skipped: Array<{ text: string; reason: string }> }>("/api/swap-all", {
        script,
        audiences,
        rules: aud.rules,
        items: flagged.slice(0, 8).map((v) => ({
          reference: v.reference,
          entity: v.resolution.entity,
          originalPosition: v.scores[0] ? position(v.scores[0].rank, v.scores[0].outOf) : null,
        })),
      });
      setBatch({ items: data.results, skipped: data.skipped ?? [] });
      setSwapReceipts((data.results as BatchItem[]).flatMap((r) => (r.ok ? ((r.result as SwapResult & { receipts?: EvidenceRecord[] }).receipts ?? []) : [])));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStage("");
      setBatchBusy(false);
    }
  }

  function applyBatch(accepts: BatchAccept[]) {
    if (!accepts.length) return;
    const lines = script.split("\n");
    for (const a of accepts) lines[a.line] = a.newLine;
    const next = lines.join("\n");
    const nextByText = { ...byText };
    for (const a of accepts) if (a.entity) nextByText[a.entity.name.toLowerCase()] = a.entity;
    setByText(nextByText);
    setScript(next);
    // Keep the lines you haven't applied yet; swaps replace whole lines, so their line numbers stay valid.
    const applied = new Set(accepts.map((a) => a.line));
    setBatch((b) => {
      const rest = b?.items.filter((i) => !applied.has(i.line)) ?? [];
      return rest.length ? { items: rest, skipped: b?.skipped ?? [] } : null;
    });
    setSwap(null);
    setConfirmed({});
    run({ script: next, confirmed: {}, byText: nextByText, keepProposals: true });
  }

  function confirmEntity(refId: string, e: ResolvedEntity) {
    const next = { ...confirmed, [refId]: e };
    setConfirmed(next);
    run({ confirmed: next });
  }

  function pickJudge(j: JudgeScript) {
    setActiveJudge(j.id);
    const next: AudienceState = {
      ...aud,
      mode: j.mode,
      ageBand: j.audience?.ageBand ?? j.audiences?.[0]?.ageBand ?? j.ageBand ?? aud.ageBand,
      city: j.audience?.city ?? j.audiences?.[0]?.city ?? "",
      ageBandB: j.audiences?.[1]?.ageBand ?? aud.ageBandB,
      cityB: j.audiences?.[1]?.city ?? "",
      cities: j.cities ?? aud.cities,
    };
    setScript(j.script);
    setAud(next);
    setConfirmed({});
    setByText({});
    setPromoReq(j.promo);
    run({ script: j.script, aud: next, confirmed: {}, byText: {}, promo: j.promo ?? null });
  }

  const labels = audiences.map((a) => audienceLabel(a));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">RoomRead</h1>
          <p className="text-sm text-[var(--muted)]">Read the room before you&apos;re in it. Every verdict comes from Qloo&apos;s taste graph, with a receipt.</p>
        </div>
        {result && <VerdictBadge verdict={result.verdict} tweakCount={result.tweakCount} />}
      </header>

      <JudgeModePicker onPick={pickJudge} activeId={activeJudge} />
      <AudienceBar value={aud} onChange={setAud} onRun={() => run()} busy={busy} />

      {stage && <p className="text-sm text-[var(--muted)]">⋯ {stage}</p>}
      {error && <p className="text-sm text-[var(--red)]">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-2">
          <ScriptPane script={script} onChange={setScript} verdicts={verdicts} selectedId={selectedId} onSelect={setSelectedId} editable={editing} busy={busy} />
          {!editing && (
            <button
              onClick={() => {
                setEditing(true);
                setActiveJudge(null); // your own edits: no longer the preloaded script
              }}
              className="self-start text-sm text-[var(--accent)]"
            >
              Edit script
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <EvidencePanel verdict={selected} onConfirm={confirmEntity} />
          {selectedStats && <SwapCard result={selectedStats} />}
        </div>
      </div>

      {!busy && verdicts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            onClick={findAllSwaps}
            disabled={!flagged.length || Boolean(stage)}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-semibold text-white"
          >
            {batchBusy ? "Searching…" : `Find swaps for all flagged (${flagged.length})`}
          </button>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeAmber} onChange={(e) => setIncludeAmber(e.target.checked)} />
            Include amber
          </label>
        </div>
      )}

      {batch && <BatchSwapPanel items={batch.items} skipped={batch.skipped} busy={busy} onApply={applyBatch} onClose={() => setBatch(null)} />}

      {aud.mode === "bridge" && <BridgeView verdicts={verdicts} audiences={labels} />}
      {aud.mode === "tour" && <TourHeatmap verdicts={verdicts} cities={labels} />}

      {promo && (
        <div className="panel flex flex-col gap-2 p-4 text-sm">
          <h3 className="font-semibold">Promo blurb for {promo.city}: written, then checked by RoomRead</h3>
          <p className="text-[var(--muted)]">First draft: {promo.draft}</p>
          {promo.fixes.map((f, i) => (
            <p key={i} className={f.accepted ? "text-[var(--green)]" : "text-[var(--red)]"}>
              {f.accepted ? "Fixed" : "Flagged"} “{f.reference}”: {f.note}
            </p>
          ))}
          <p><strong>Final:</strong> {promo.final}</p>
        </div>
      )}

      <WithoutQlooToggle script={script} audienceLabel={labels.join(" + ")} />
      <ReceiptsDrawer records={[...(result?.receipts ?? []), ...swapReceipts]} />

      <footer className="pb-8 text-xs text-[var(--muted)]">
        Scores describe aggregate affinity of an audience segment, not any individual. RoomRead checks familiarity and affinity, not whether a joke is funny.
      </footer>
    </main>
  );
}
