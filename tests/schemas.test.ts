import { describe, expect, it } from "vitest";
import { locateReferences } from "../lib/agent/extract";
import { stableStringify } from "../lib/qloo/cache";
import { entityFrom, QlooEnvelopeSchema } from "../lib/qloo/schemas";

describe("Qloo envelope", () => {
  it("parses an ok result and fills defaults", () => {
    const env = QlooEnvelopeSchema.parse({ status: "ok", results: [{ entity_id: "x", name: "X" }] });
    expect(env.summary).toBe("");
    expect(env.result_count).toBe(0);
  });
  it("rejects an unknown status", () => {
    expect(QlooEnvelopeSchema.safeParse({ status: "weird" }).success).toBe(false);
  });
  it("reads entity ids from either id field", () => {
    expect(entityFrom({ id: "a", name: "A", type: "urn:entity:movie" })?.entityId).toBe("a");
    expect(entityFrom({ name: "no id" })).toBeNull();
  });
});

describe("helpers", () => {
  it("stable stringify ignores key order", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });
  it("locates references and drops misquotes", () => {
    const refs = locateReferences("I love Friends\nand MySpace", [
      { text: "Friends", line: 0, kind: "tv_show" },
      { text: "MySpace", line: 1, kind: "brand" },
      { text: "Invented", line: 1, kind: "other" },
    ]);
    expect(refs.map((r) => r.text)).toEqual(["Friends", "MySpace"]);
    expect("I love Friends\nand MySpace".slice(refs[1].start, refs[1].end)).toBe("MySpace");
  });
});
