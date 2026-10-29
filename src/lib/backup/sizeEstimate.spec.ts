import { describe, expect, it } from "vitest";
import { countSections, estimateBackup, estimateBytes } from "./sizeEstimate";

describe("countSections", () => {
  it("counts array sections by length and omits sections without a key", () => {
    const counts = countSections({
      collections: [{ id: "a" }, { id: "b" }],
      environments: [],
    });
    expect(counts).toEqual({ collections: 2, environments: 0 });
  });

  it("counts object sections by key count", () => {
    const counts = countSections({
      settings: { theme: "dark", proxyUrl: "x" },
      preferences: { k: "v" },
    });
    expect(counts).toEqual({ settings: 2, preferences: 1 });
  });

  it("counts a non-container value as zero", () => {
    const counts = countSections({
      history: null,
    } as unknown as Parameters<typeof countSections>[0]);
    expect(counts).toEqual({ history: 0 });
  });

  it("returns nothing for empty data", () => {
    expect(countSections({})).toEqual({});
  });

  it("counts relayThreads and chains by their own keys", () => {
    expect(countSections({ relayThreads: [{}, {}, {}], chains: [{}] })).toEqual(
      { relayThreads: 3, chains: 1 }
    );
  });
});

describe("estimateBytes", () => {
  it("is zero for empty data", () => {
    expect(estimateBytes({})).toBe(0);
  });

  it("sums the serialised size of every value", () => {
    // "[1,2]" is 5 bytes, '{"a":"b"}' is 9 bytes
    expect(estimateBytes({ collections: [1, 2], settings: { a: "b" } })).toBe(
      14
    );
  });

  it("measures bytes, not characters", () => {
    // '"é"' is 2 quotes + 2 UTF-8 bytes
    expect(
      estimateBytes({ settings: "é" } as unknown as Parameters<
        typeof estimateBytes
      >[0])
    ).toBe(4);
  });
});

describe("estimateBackup", () => {
  it("combines bytes and counts", () => {
    expect(estimateBackup({ collections: [1, 2] })).toEqual({
      bytes: 5,
      counts: { collections: 2 },
    });
  });
});
