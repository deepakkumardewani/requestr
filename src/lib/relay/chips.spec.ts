import { describe, expect, it } from "vitest";
import { chipKey, type ContextChip } from "./chips";

describe("chipKey", () => {
  it("creates a stable key from kind and id", () => {
    const chip: ContextChip = { kind: "request", id: "r1", label: "Request" };
    expect(chipKey(chip)).toBe("request:r1");
  });

  it("distinguishes chips by kind and id", () => {
    const r1 = chipKey({ kind: "request", id: "r1" });
    const r2 = chipKey({ kind: "request", id: "r2" });
    const c1 = chipKey({ kind: "collection", id: "r1" });
    expect(r1).not.toBe(r2);
    expect(r1).not.toBe(c1);
  });

  it("works with all chip kinds", () => {
    expect(chipKey({ kind: "tab", id: "a" })).toBe("tab:a");
    expect(chipKey({ kind: "request", id: "a" })).toBe("request:a");
    expect(chipKey({ kind: "chain", id: "a" })).toBe("chain:a");
    expect(chipKey({ kind: "collection", id: "a" })).toBe("collection:a");
    expect(chipKey({ kind: "environment", id: "a" })).toBe("environment:a");
  });
});

describe("chip identity", () => {
  it("derives the same key for equal chips so keyed lists stay stable", () => {
    expect(chipKey({ kind: "chain", id: "c9" })).toBe(chipKey({ kind: "chain", id: "c9" }));
  });

  it("ignores the label when building the key", () => {
    const a: ContextChip = { kind: "request", id: "r1", label: "Old name" };
    const b: ContextChip = { kind: "request", id: "r1", label: "Renamed" };
    expect(chipKey(a)).toBe(chipKey(b));
  });

  it("keeps an empty id distinct per kind", () => {
    expect(chipKey({ kind: "request", id: "" })).toBe("request:");
    expect(chipKey({ kind: "chain", id: "" })).toBe("chain:");
  });
});

describe("chip kinds", () => {
  it("builds distinct keys for the same id across every kind", () => {
    const kinds = ["tab", "request", "chain", "collection", "environment"] as const;
    const keys = kinds.map((kind) => chipKey({ kind, id: "x" }));
    expect(new Set(keys).size).toBe(5);
  });
});
