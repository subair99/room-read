import { describe, expect, it } from "vitest";
import { bandFromPosition, bandFromRank, position, worseBand } from "../lib/agent/bands";
import { scriptVerdict } from "../lib/agent/verdict";

describe("rank bands", () => {
  it("maps rank to percentile position within one query", () => {
    expect(position(1, 10)).toBe(0);
    expect(position(10, 10)).toBe(1);
    expect(position(null, 10)).toBeNull();
    expect(position(1, 1)).toBe(0);
  });

  it("splits into thirds", () => {
    expect(bandFromRank(1, 13)).toBe("green");
    expect(bandFromRank(7, 13)).toBe("amber");
    expect(bandFromRank(13, 13)).toBe("red");
    expect(bandFromPosition(null)).toBe("unknown");
  });

  it("bridge uses the worse band, ignoring unknown unless all are unknown", () => {
    expect(worseBand(["green", "red"])).toBe("red");
    expect(worseBand(["green", "unknown"])).toBe("green");
    expect(worseBand(["unknown", "unknown"])).toBe("unknown");
  });
});

describe("script verdict", () => {
  it("ships with no red and at most one amber", () => {
    expect(scriptVerdict([{ band: "green", line: 0 }, { band: "amber", line: 1 }]).verdict).toBe("ship");
  });
  it("tweaks a mixed script and counts lines", () => {
    const r = scriptVerdict([{ band: "green", line: 0 }, { band: "red", line: 1 }, { band: "amber", line: 2 }, { band: "green", line: 3 }]);
    expect(r).toEqual({ verdict: "tweak", tweakCount: 2 });
  });
  it("reworks when half or more are red", () => {
    expect(scriptVerdict([{ band: "red", line: 0 }, { band: "green", line: 1 }]).verdict).toBe("rework");
  });
});
