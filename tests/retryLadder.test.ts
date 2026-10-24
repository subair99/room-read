import { describe, expect, it } from "vitest";
import { runLadder } from "../lib/agent/retryLadder";
import type { ResolvedEntity } from "../lib/types";

const e = (name: string): ResolvedEntity => ({ entityId: name.toLowerCase(), name, type: "tv_show" });

describe("retry ladder", () => {
  it("accepts the first candidate that ranks higher in the same query", async () => {
    const r = await runLadder("ref_0", "line with MySpace", 0.9, {
      candidates: [e("Worse"), e("Better")],
      compare: async (c) => ({ candidate: c.name === "Better" ? 0.1 : 0.95, original: 0.9 }),
      rewrite: async (c) => `line with ${c.name}`,
      restructure: async () => "plain line",
    });
    expect(r.accepted?.candidate?.name).toBe("Better");
    expect(r.attempts).toHaveLength(2);
    expect(r.flagged).toBe(false);
  });

  it("rejects a rewrite that drops the new reference", async () => {
    const r = await runLadder("ref_0", "line", 0.9, {
      candidates: [e("Better")],
      compare: async () => ({ candidate: 0.1, original: 0.9 }),
      rewrite: async () => "a line without it",
      restructure: async () => null,
    });
    expect(r.attempts[0].accepted).toBe(false);
    expect(r.flagged).toBe(true);
  });

  it("restructures when no equivalent ranks higher, then stops", async () => {
    const r = await runLadder("ref_0", "line", 0.5, {
      candidates: [e("A"), e("B"), e("C")],
      compare: async () => ({ candidate: 0.8, original: 0.5 }),
      rewrite: async (c) => c.name,
      restructure: async () => "restructured line",
    });
    expect(r.accepted?.step).toBe("restructure");
    expect(r.attempts.length).toBeLessThanOrEqual(3);
  });

  it("skips a candidate that is better but still doesn't land", async () => {
    const r = await runLadder("ref_0", "line", 0.8, {
      candidates: [e("StillRed"), e("Lands")],
      compare: async (c) => (c.name === "StillRed" ? { candidate: 0.6, original: 0.8, acceptable: false } : { candidate: 0.2, original: 0.8, acceptable: true }),
      rewrite: async (c) => `line ${c.name}`,
      restructure: async () => null,
    });
    expect(r.attempts[0].accepted).toBe(false);
    expect(r.accepted?.candidate?.name).toBe("Lands");
  });

  it("flags when nothing works", async () => {
    const r = await runLadder("ref_0", "line", 0.5, {
      candidates: [],
      compare: async () => ({ candidate: null, original: 0.5 }),
      rewrite: async () => "",
      restructure: async () => null,
    });
    expect(r.flagged).toBe(true);
    expect(r.attempts.at(-1)?.step).toBe("flag");
  });
});
