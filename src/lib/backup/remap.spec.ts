import { describe, expect, it } from "vitest";
import {
  dependencyOrder,
  type IdRemap,
  remapPreferences,
  rewriteReferences,
} from "./remap";

describe("rewriteReferences", () => {
  it("returns the very same value when the remap is empty", () => {
    const value = { id: "a", nested: ["a"] };
    expect(rewriteReferences(value, new Map())).toBe(value);
  });

  it("rewrites string values, nested values, arrays and object keys", () => {
    const remap: IdRemap = new Map([["old-1", "new-1"]]);
    const input = {
      collectionId: "old-1",
      pinnedRequestIds: ["old-1", "keep"],
      positions: { "old-1": { x: 1 } },
      count: 3,
      flag: true,
      empty: null,
    };
    expect(rewriteReferences(input, remap)).toEqual({
      collectionId: "new-1",
      pinnedRequestIds: ["new-1", "keep"],
      positions: { "new-1": { x: 1 } },
      count: 3,
      flag: true,
      empty: null,
    });
  });

  it("does not rewrite prose that merely contains an id", () => {
    const remap: IdRemap = new Map([["old-1", "new-1"]]);
    expect(rewriteReferences({ note: "see old-1 here" }, remap)).toEqual({
      note: "see old-1 here",
    });
  });

  it("does not mutate its input", () => {
    const remap: IdRemap = new Map([["a", "b"]]);
    const input = { ref: "a" };
    rewriteReferences(input, remap);
    expect(input).toEqual({ ref: "a" });
  });
});

describe("remapPreferences", () => {
  const remap: IdRemap = new Map([
    ["env-old", "env-new"],
    ["f-old", "f-new"],
  ]);

  it("remaps a bare id value", () => {
    expect(remapPreferences({ requestly_active_env_id: "env-old" }, remap)).toEqual(
      { requestly_active_env_id: "env-new" },
    );
  });

  it("remaps ids inside a JSON array value", () => {
    const result = remapPreferences(
      { rq_collapsed_folders: JSON.stringify(["f-old", "other"]) },
      remap,
    );
    expect(result.rq_collapsed_folders).toBe('["f-new","other"]');
  });

  it("remaps ids inside a JSON object value", () => {
    const result = remapPreferences(
      { rq_sidebar_open_sections: '{"f-old":true}' },
      remap,
    );
    expect(result.rq_sidebar_open_sections).toBe('{"f-new":true}');
  });

  it("keeps plain text and malformed JSON untouched", () => {
    const input = { a: "true", b: "[not json", c: "{broken" };
    expect(remapPreferences(input, remap)).toEqual(input);
  });
});

describe("dependencyOrder", () => {
  const refsOf = (record: Record<string, unknown>) =>
    record.parent ? [String(record.parent)] : [];

  it("places each record after the in-list record it references", () => {
    const records = [
      { id: "child", parent: "mid" },
      { id: "mid", parent: "root" },
      { id: "root" },
    ];
    expect(dependencyOrder(records, "id", refsOf).map((r) => r.id)).toEqual([
      "root",
      "mid",
      "child",
    ]);
  });

  it("ignores references to records outside the list", () => {
    const records = [{ id: "a", parent: "elsewhere" }, { id: "b" }];
    expect(dependencyOrder(records, "id", refsOf).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("breaks a reference cycle and still returns every record once", () => {
    const records = [
      { id: "a", parent: "b" },
      { id: "b", parent: "a" },
    ];
    const ordered = dependencyOrder(records, "id", refsOf).map((r) => r.id);
    expect(ordered).toHaveLength(2);
    expect([...ordered].sort()).toEqual(["a", "b"]);
  });
});
