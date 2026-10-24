import { describe, expect, it } from "vitest";
import { pickBridge } from "../lib/agent/bridge";

describe("bridge rule", () => {
  it("picks the candidate whose worse audience position is best", () => {
    const pick = pickBridge([
      { id: "a", name: "Loved by one", ranks: [1, 10], outOf: [10, 10] }, // worst = 1.0
      { id: "b", name: "Fine for both", ranks: [3, 4], outOf: [10, 10] }, // worst = 0.33
      { id: "c", name: "Middling", ranks: [5, 5], outOf: [10, 10] }, // worst = 0.44
    ]);
    expect(pick?.id).toBe("b");
  });

  it("breaks ties on the better average", () => {
    const pick = pickBridge([
      { id: "a", name: "A", ranks: [4, 4], outOf: [10, 10] },
      { id: "b", name: "B", ranks: [1, 4], outOf: [10, 10] },
    ]);
    expect(pick?.id).toBe("b");
  });

  it("skips candidates missing a rank and returns null when none qualify", () => {
    expect(pickBridge([{ id: "a", name: "A", ranks: [1, null], outOf: [10, 10] }])).toBeNull();
  });
});
