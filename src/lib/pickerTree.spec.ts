import { describe, expect, it, vi } from "vitest";
import {
  createDayHeaderRow,
  flattenPickerTree,
  PICKER_MAX_DEPTH,
  type PickerRow,
} from "@/lib/pickerTree";
import type { CollectionFolderModel, CollectionModel, RequestModel } from "@/types";

const col = (id: string, name = id): CollectionModel => ({ id, name, createdAt: 0, updatedAt: 0 });
const folder = (
  id: string,
  collectionId: string,
  parentFolderId: string | null = null,
  order = 0,
): CollectionFolderModel => ({ id, collectionId, name: id, parentFolderId, order });
const req = (id: string, collectionId: string, folderId: string | null = null, name = id): RequestModel =>
  ({ id, collectionId, folderId, name, method: "GET", url: `https://x.io/${id}` }) as RequestModel;

const ids = (rows: PickerRow[]) => rows.map((row) => row.id);
const NONE = new Set<string>();

describe("flattenPickerTree", () => {
  it("returns no rows for zero collections", () => {
    expect(flattenPickerTree([], [], [], { expanded: NONE })).toEqual([]);
  });

  it("keeps collapsed collections as a single header with counts", () => {
    const rows = flattenPickerTree([col("c")], [], [req("r1", "c"), req("r2", "c")], { expanded: NONE });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "header", expandable: true, expanded: false, count: { visible: 2, total: 2 } });
  });

  it("preserves nesting and does not mix requests across folders", () => {
    const collections = [col("c")];
    const folders = [folder("f1", "c", null, 1), folder("f2", "c", "f1", 0), folder("f0", "c", null, 0)];
    const requests = [req("root", "c"), req("a", "c", "f1"), req("b", "c", "f2")];
    const rows = flattenPickerTree(collections, folders, requests, { expanded: new Set(["c", "f1", "f2"]) });
    expect(ids(rows)).toEqual(["collection:c", "folder:f0", "folder:f1", "folder:f2", "b", "a", "root"]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 2, 3, 2, 1]);
    expect(rows.find((row) => row.id === "folder:f0")).toMatchObject({ expandable: false, expanded: false });
  });

  it("promotes folders with missing or cross-collection parents to the root", () => {
    const folders = [folder("orphan", "c", "ghost"), folder("other", "d")];
    const rows = flattenPickerTree([col("c")], folders, [req("r", "c", "orphan")], {
      expanded: new Set(["c", "orphan"]),
    });
    expect(ids(rows)).toEqual(["collection:c", "folder:orphan", "r"]);
    expect(rows[1].depth).toBe(1);
  });

  it("is cycle safe and keeps every folder in a cycle reachable", () => {
    const folders = [folder("a", "c", "b"), folder("b", "c", "a"), folder("self", "c", "self")];
    const rows = flattenPickerTree([col("c")], folders, [], { expanded: new Set(["c", "a", "b"]) });
    expect(ids(rows).sort()).toEqual(["collection:c", "folder:a", "folder:b", "folder:self"]);
  });

  it("treats requests with an unknown folderId as unfoldered", () => {
    const rows = flattenPickerTree([col("c")], [], [req("r", "c", "ghost")], { expanded: new Set(["c"]) });
    expect(ids(rows)).toEqual(["collection:c", "r"]);
  });

  it("shows an empty collection as non-expandable", () => {
    const rows = flattenPickerTree([col("c")], [], [], { expanded: new Set(["c"]) });
    expect(rows[0]).toMatchObject({ expandable: false, expanded: false, count: { visible: 0, total: 0 } });
  });

  it("caps depth and adds a breadcrumb beyond it", () => {
    const depthCount = PICKER_MAX_DEPTH + 2;
    const folders = Array.from({ length: depthCount }, (_, i) => folder(`f${i}`, "c", i === 0 ? null : `f${i - 1}`));
    const expanded = new Set(["c", ...folders.map((f) => f.id)]);
    const deepest = `f${depthCount - 1}`;
    const rows = flattenPickerTree([col("c")], folders, [req("r", "c", deepest)], { expanded });
    const last = rows[rows.length - 1];
    expect(last.depth).toBe(PICKER_MAX_DEPTH);
    expect(last.kind === "item" && last.breadcrumb).toContain("f0 / f1");
    expect(rows[1].kind === "header" && rows[1].breadcrumb).toBeUndefined();
  });

  describe("filtering", () => {
    const collections = [col("c1"), col("empty"), col("c2")];
    const folders = [folder("f", "c1")];
    const requests = [req("alpha", "c1", "f"), req("beta", "c1"), req("gamma", "c2")];

    it("auto-expands matching branches, hides the rest and reports visible/total", () => {
      const rows = flattenPickerTree(collections, folders, requests, { expanded: NONE, filter: "alpha" });
      expect(ids(rows)).toEqual(["collection:c1", "folder:f", "alpha"]);
      expect(rows[0]).toMatchObject({ expanded: true, count: { visible: 1, total: 2 } });
      expect(rows[2]).toMatchObject({ kind: "item", match: { nameRanges: [[0, 5]] } });
    });

    it("hides empty collections while filtering and treats a blank filter as none", () => {
      const filtered = flattenPickerTree(collections, folders, requests, { expanded: NONE, filter: "a" });
      expect(ids(filtered)).not.toContain("collection:empty");
      const blank = flattenPickerTree(collections, folders, requests, { expanded: NONE, filter: "   " });
      expect(ids(blank)).toContain("collection:empty");
    });

    it("restores the prior expansion when the filter clears", () => {
      const expanded = new Set(["c2"]);
      const before = flattenPickerTree(collections, folders, requests, { expanded });
      flattenPickerTree(collections, folders, requests, { expanded, filter: "alpha" });
      const after = flattenPickerTree(collections, folders, requests, { expanded });
      expect(ids(after)).toEqual(ids(before));
      expect(ids(after)).toContain("gamma");
      expect(ids(after)).not.toContain("alpha");
    });

    it("matches on the folder or collection name", () => {
      const rows = flattenPickerTree(collections, folders, requests, { expanded: NONE, filter: "c2" });
      expect(ids(rows)).toEqual(["collection:c2", "gamma"]);
    });
  });

  describe("memoization", () => {
    it("returns the same array for identical identities and filter", () => {
      const collections = [col("c")];
      const folders: CollectionFolderModel[] = [];
      const requests = [req("r", "c")];
      const expanded = new Set(["c"]);
      const first = flattenPickerTree(collections, folders, requests, { expanded });
      expect(flattenPickerTree(collections, folders, requests, { expanded })).toBe(first);
      expect(flattenPickerTree(collections, folders, requests, { expanded, filter: "r" })).not.toBe(first);
    });

    it("rebuilds when any input identity changes", () => {
      const collections = [col("c")];
      const folders: CollectionFolderModel[] = [];
      const expanded = new Set(["c"]);
      const first = flattenPickerTree(collections, folders, [req("r", "c")], { expanded });
      const second = flattenPickerTree(collections, folders, [req("r", "c")], { expanded });
      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    });
  });
});

describe("flattenPickerTree at scale", () => {
  const LARGE = 1500;

  it("builds the tree once for 1,500 requests and re-scores new filters from the cached tree", () => {
    const collections = [col("c")];
    const folders: CollectionFolderModel[] = [];
    const requests = Array.from({ length: LARGE }, (_, i) => req(`r${i}`, "c"));
    const walk = vi.fn(requests[Symbol.iterator].bind(requests));
    Object.defineProperty(requests, Symbol.iterator, { value: walk });
    const expanded = new Set(["c"]);

    const all = flattenPickerTree(collections, folders, requests, { expanded });
    expect(all).toHaveLength(LARGE + 1);
    const filtered = flattenPickerTree(collections, folders, requests, { expanded, filter: "r149" });
    const cleared = flattenPickerTree(collections, folders, requests, { expanded, filter: "r1" });

    const matched = filtered.filter((row) => row.kind === "item").length;
    expect(matched).toBeGreaterThan(0);
    expect(matched).toBeLessThan(LARGE);
    expect(cleared.length).toBeGreaterThan(filtered.length);
    expect(walk).toHaveBeenCalledTimes(1);
  });
});

describe("createDayHeaderRow", () => {
  it("builds a non-expandable day header in the shared row model", () => {
    expect(createDayHeaderRow("Today", 3)).toEqual({
      kind: "header",
      id: "day:Today",
      headerType: "day",
      label: "Today",
      depth: 0,
      expandable: false,
      expanded: true,
      count: { visible: 3, total: 3 },
    });
  });
});
