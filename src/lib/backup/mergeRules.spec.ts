import { describe, expect, it } from "vitest";
import {
  IMPORTED_SUFFIX,
  mergeKeepingExisting,
  mergeList,
  recordsEqual,
} from "./mergeRules";
import type { IdRemap } from "./remap";

describe("recordsEqual", () => {
  it("ignores a differing top-level updatedAt", () => {
    expect(recordsEqual({ id: "a", updatedAt: 1 }, { id: "a", updatedAt: 2 })).toBe(
      true,
    );
  });

  it("compares nested arrays and objects deeply", () => {
    const a = { id: "a", tags: [{ k: 1 }, { k: 2 }] };
    expect(recordsEqual(a, { id: "a", tags: [{ k: 1 }, { k: 2 }] })).toBe(true);
    expect(recordsEqual(a, { id: "a", tags: [{ k: 1 }, { k: 3 }] })).toBe(false);
    expect(recordsEqual(a, { id: "a", tags: [{ k: 1 }] })).toBe(false);
  });

  it("distinguishes arrays from objects and differing key sets", () => {
    expect(recordsEqual({ v: [] }, { v: {} })).toBe(false);
    expect(recordsEqual({ v: {} }, { v: [] })).toBe(false);
    expect(recordsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(recordsEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
    expect(recordsEqual({ a: null }, { a: { x: 1 } })).toBe(false);
  });
});

describe("mergeList", () => {
  const named = { keyField: "id", named: true } as const;

  it("adds records whose id is new", () => {
    const result = mergeList([{ id: "a" }], [{ id: "b", name: "B" }], new Map(), named);
    expect(result).toEqual({ adds: [{ id: "b", name: "B" }], skipped: 0, kept: 0 });
  });

  it("skips an identical record, ignoring updatedAt", () => {
    const result = mergeList(
      [{ id: "a", name: "A", updatedAt: 1 }],
      [{ id: "a", name: "A", updatedAt: 99 }],
      new Map(),
      named,
    );
    expect(result).toEqual({ adds: [], skipped: 1, kept: 0 });
  });

  it("stores a colliding record under a new id with the (imported) suffix", () => {
    const remap: IdRemap = new Map();
    const result = mergeList(
      [{ id: "a", name: "Mine" }],
      [{ id: "a", name: "Theirs" }],
      remap,
      named,
    );
    expect(result.kept).toBe(1);
    expect(result.adds).toHaveLength(1);
    const [added] = result.adds;
    expect(added.name).toBe("Theirs (imported)");
    expect(IMPORTED_SUFFIX).toBe(" (imported)");
    expect(added.id).toMatch(/^a-i[0-9a-z]+$/);
    expect(remap.get("a")).toBe(added.id);
  });

  it("never renames records of an unnamed list", () => {
    const result = mergeList(
      [{ id: "h", name: "x", url: "u1" }],
      [{ id: "h", name: "x", url: "u2" }],
      new Map(),
      { keyField: "id" },
    );
    expect(result.adds[0].name).toBe("x");
    expect(result.adds[0].id).not.toBe("h");
  });

  it("does not suffix a collision whose name is not a string", () => {
    const result = mergeList(
      [{ id: "a", name: 1, v: 1 }],
      [{ id: "a", name: 2, v: 2 }],
      new Map(),
      named,
    );
    expect(result.adds[0].name).toBe(2);
  });

  it("gives the same new id each time, so a second import is a no-op", () => {
    const existing = [{ id: "a", name: "Mine" }];
    const incoming = [{ id: "a", name: "Theirs" }];
    const first = mergeList(existing, incoming, new Map(), named);
    const second = mergeList([...existing, ...first.adds], incoming, new Map(), named);
    expect(second).toEqual({ adds: [], skipped: 1, kept: 0 });
  });

  it("extends the id when a different record already holds the derived id", () => {
    const probe = mergeList([{ id: "a", name: "M" }], [{ id: "a", name: "T" }], new Map(), named);
    const derivedId = probe.adds[0].id as string;
    const result = mergeList(
      [{ id: "a", name: "M" }, { id: derivedId, name: "squatter" }],
      [{ id: "a", name: "T" }],
      new Map(),
      named,
    );
    expect(result.adds[0].id).toBe(`${derivedId}x`);
    expect(result.kept).toBe(1);
  });

  it("keeps the existing record for a list that cannot re-issue keys", () => {
    const result = mergeList(
      [{ collectionId: "c", v: 1 }],
      [{ collectionId: "c", v: 2 }],
      new Map(),
      { keyField: "collectionId", keepExistingOnCollision: true },
    );
    expect(result).toEqual({ adds: [], skipped: 1, kept: 0 });
  });

  it("rewrites references through the remap before comparing", () => {
    const remap: IdRemap = new Map([["p-old", "p-new"]]);
    const result = mergeList(
      [{ id: "f", parent: "p-new" }],
      [{ id: "f", parent: "p-old" }],
      remap,
      { keyField: "id" },
    );
    expect(result).toEqual({ adds: [], skipped: 1, kept: 0 });
  });

  it("applies finalize to added records and to renamed ones", () => {
    const finalize = (r: Record<string, unknown>) => ({ ...r, status: "blocked" });
    const result = mergeList(
      [{ id: "a", v: 1 }],
      [{ id: "a", v: 2 }, { id: "n", v: 3 }],
      new Map(),
      { keyField: "id", finalize },
    );
    expect(result.adds).toHaveLength(2);
    expect(result.adds.map((r) => r.status)).toEqual(["blocked", "blocked"]);
  });

  it("treats an existing finalized copy as identical", () => {
    const finalize = (r: Record<string, unknown>) => ({ ...r, status: "blocked" });
    const result = mergeList(
      [{ id: "a", status: "blocked" }],
      [{ id: "a", status: "applied" }],
      new Map(),
      { keyField: "id", finalize },
    );
    expect(result).toEqual({ adds: [], skipped: 1, kept: 0 });
  });

  it("collapses duplicate incoming records into one add", () => {
    const result = mergeList([], [{ id: "d" }, { id: "d" }], new Map(), { keyField: "id" });
    expect(result.adds).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it("skips a colliding record whose renamed twin is already stored", () => {
    const probe = mergeList([{ id: "a", name: "M" }], [{ id: "a", name: "T" }], new Map(), named);
    const twin = probe.adds[0];
    const remap: IdRemap = new Map();
    const result = mergeList([{ id: "a", name: "M" }, twin], [{ id: "a", name: "T" }], remap, named);
    expect(result).toEqual({ adds: [], skipped: 1, kept: 0 });
    expect(remap.get("a")).toBe(twin.id);
  });

  it("never modifies the existing records", () => {
    const existing = [{ id: "a", name: "Mine" }];
    mergeList(existing, [{ id: "a", name: "Theirs" }], new Map(), named);
    expect(existing).toEqual([{ id: "a", name: "Mine" }]);
  });
});

describe("mergeKeepingExisting", () => {
  it("lets existing values win and adds only absent keys", () => {
    expect(
      mergeKeepingExisting({ theme: "dark", a: 1 }, { theme: "light", b: 2 } as never),
    ).toEqual({ theme: "dark", a: 1, b: 2 });
  });
});
