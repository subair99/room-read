import type { Verdict } from "@/lib/types";

const STYLE: Record<Verdict, string> = {
  ship: "bg-[color-mix(in_srgb,var(--green)_15%,transparent)] text-[var(--green)]",
  tweak: "bg-[color-mix(in_srgb,var(--amber)_15%,transparent)] text-[var(--amber)]",
  rework: "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-[var(--red)]",
};

export function VerdictBadge({ verdict, tweakCount }: { verdict: Verdict; tweakCount: number }) {
  const text = verdict === "ship" ? "Ship it" : verdict === "tweak" ? `Tweak ${tweakCount} line${tweakCount === 1 ? "" : "s"}` : "Rework";
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STYLE[verdict]}`}>{text}</span>;
}
