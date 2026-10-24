import { describe, expect, it } from "vitest";
import { ageIndex, bandFromIndex, describeIndex, strongestBucket } from "../lib/agent/ageAffinity";
import { trendFromSeries } from "../lib/agent/rank";

// Real values from the day-1 spike: qloo_audience_demographics(Seinfeld)
const SEINFELD = { "24_and_younger": -0.036, "25_to_29": -0.263, "30_to_34": -0.501, "35_to_44": -0.161, "45_to_54": 0.064, "55_and_older": 0.279 };

describe("age index", () => {
  it("averages the band's buckets", () => {
    expect(ageIndex(SEINFELD, "18-34")).toBeCloseTo(-0.2667, 3);
    expect(ageIndex(SEINFELD, "35-54")).toBeCloseTo(-0.0485, 3);
    expect(ageIndex(SEINFELD, "55+")).toBeCloseTo(0.279, 3);
    expect(ageIndex(undefined, "55+")).toBeNull();
  });

  it("Seinfeld is red for 18-34, amber for 35-54, green for 55+", () => {
    expect(bandFromIndex(ageIndex(SEINFELD, "18-34"), 0.995)).toBe("red");
    expect(bandFromIndex(ageIndex(SEINFELD, "35-54"), 0.995)).toBe("amber");
    expect(bandFromIndex(ageIndex(SEINFELD, "55+"), 0.995)).toBe("green");
  });

  it("a niche title can't be green", () => {
    expect(bandFromIndex(0.4, 0.2)).toBe("amber");
    expect(bandFromIndex(null)).toBe("unknown");
  });

  it("names who it does land with", () => {
    expect(strongestBucket(SEINFELD)).toEqual({ label: "55+", value: 0.279 });
    expect(describeIndex(0.279)).toBe("over-indexes (+0.28)");
    expect(describeIndex(-0.2667)).toBe("under-indexes (−0.27)");
  });
});

describe("trend from weekly percentiles", () => {
  it("detects rising, fading and steady", () => {
    expect(trendFromSeries([0.5, 0.5, 0.52, 0.6, 0.62, 0.64])).toBe("rising");
    expect(trendFromSeries([0.9, 0.9, 0.85, 0.8, 0.8, 0.79])).toBe("fading");
    expect(trendFromSeries([0.955, 0.955, 0.955, 0.955])).toBe("steady");
    expect(trendFromSeries([0.5])).toBe("unknown");
  });
});

import { relativeAgeBand, relativePosition } from "../lib/agent/ageAffinity";

describe("relative age band (vs anchors)", () => {
  // e.g. 55+ indices for well-known artists: everything under-indexes
  const anchors = [-0.9, -0.85, -0.8, -0.7, -0.6, -0.3];
  it("a title that under-indexes can still be top third against its peers", () => {
    expect(relativeAgeBand(-0.5, anchors, 0.99)).toEqual({ band: "green", rank: 2, outOf: 7 });
  });
  it("bottom of the anchors is red", () => {
    expect(relativeAgeBand(-0.95, anchors, 0.99).band).toBe("red");
  });
  it("falls back to fixed thresholds with too few anchors", () => {
    expect(relativeAgeBand(0.3, [0.1], 0.99)).toEqual({ band: "green", rank: null, outOf: 0 });
  });
  it("niche titles can't be green", () => {
    expect(relativeAgeBand(0, anchors, 0.2).band).toBe("amber");
  });
  it("position runs 0 (best) to 1 (worst)", () => {
    expect(relativePosition(0, anchors)).toBe(0);
    expect(relativePosition(-1, anchors)).toBe(1);
  });
});
