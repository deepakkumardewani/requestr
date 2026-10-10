/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "rq_collapsed_folders";

async function loadFreshStore() {
  vi.resetModules();
  const mod = await import("./useFolderExpandStore");
  return mod.useFolderExpandStore;
}

describe("useFolderExpandStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("expansion state", () => {
    it("treats every folder as expanded by default", async () => {
      const store = await loadFreshStore();

      expect(store.getState().isExpanded("any")).toBe(true);
    });

    it("setExpanded(false) collapses and setExpanded(true) re-expands", async () => {
      const store = await loadFreshStore();

      store.getState().setExpanded("f1", false);
      const collapsed = store.getState().isExpanded("f1");
      store.getState().setExpanded("f1", true);

      expect(collapsed).toBe(false);
      expect(store.getState().isExpanded("f1")).toBe(true);
    });

    it("setExpanded(false) twice does not duplicate the id", async () => {
      const store = await loadFreshStore();

      store.getState().setExpanded("f1", false);
      store.getState().setExpanded("f1", false);

      expect(store.getState().collapsedFolderIds).toEqual(["f1"]);
    });

    it("toggle flips a folder between expanded and collapsed", async () => {
      const store = await loadFreshStore();

      store.getState().toggle("f1");
      const afterFirst = store.getState().isExpanded("f1");
      store.getState().toggle("f1");

      expect(afterFirst).toBe(false);
      expect(store.getState().isExpanded("f1")).toBe(true);
    });
  });

  describe("bulk operations", () => {
    it("collapseAll collapses the given folders and keeps others as they were", async () => {
      const store = await loadFreshStore();
      store.getState().setExpanded("keep", false);

      store.getState().collapseAll(["a", "b"]);

      expect([...store.getState().collapsedFolderIds].sort()).toEqual([
        "a",
        "b",
        "keep",
      ]);
    });

    it("expandAll expands only the given folders", async () => {
      const store = await loadFreshStore();
      store.getState().collapseAll(["a", "b", "other"]);

      store.getState().expandAll(["a", "b"]);

      expect(store.getState().collapsedFolderIds).toEqual(["other"]);
    });

    it("isAllExpanded is false for an empty list", async () => {
      const store = await loadFreshStore();

      expect(store.getState().isAllExpanded([])).toBe(false);
    });

    it("isAllExpanded is true only when none of the folders are collapsed", async () => {
      const store = await loadFreshStore();
      store.getState().setExpanded("b", false);

      expect(store.getState().isAllExpanded(["a"])).toBe(true);
      expect(store.getState().isAllExpanded(["a", "b"])).toBe(false);
    });

    it("toggleAll collapses everything when all are expanded", async () => {
      const store = await loadFreshStore();

      store.getState().toggleAll(["a", "b"]);

      expect(store.getState().isExpanded("a")).toBe(false);
      expect(store.getState().isExpanded("b")).toBe(false);
    });

    it("toggleAll expands everything when at least one is collapsed", async () => {
      const store = await loadFreshStore();
      store.getState().setExpanded("a", false);

      store.getState().toggleAll(["a", "b"]);

      expect(store.getState().isExpanded("a")).toBe(true);
      expect(store.getState().isExpanded("b")).toBe(true);
    });

    it("toggleAll on an empty list expands nothing and changes nothing", async () => {
      const store = await loadFreshStore();
      store.getState().setExpanded("a", false);

      store.getState().toggleAll([]);

      expect(store.getState().collapsedFolderIds).toEqual(["a"]);
    });
  });

  describe("persistence", () => {
    it("writes the collapsed ids to rq_collapsed_folders on change", async () => {
      const store = await loadFreshStore();

      store.getState().collapseAll(["a", "b"]);

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual([
        "a",
        "b",
      ]);
    });

    it("restores collapsed folders from storage when the store is created", async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(["saved"]));

      const store = await loadFreshStore();

      expect(store.getState().isExpanded("saved")).toBe(false);
      expect(store.getState().isExpanded("other")).toBe(true);
    });

    it("falls back to all-expanded when stored JSON is corrupt", async () => {
      localStorage.setItem(STORAGE_KEY, "{not json");

      const store = await loadFreshStore();

      expect(store.getState().collapsedFolderIds).toEqual([]);
    });

    it("falls back to all-expanded when reading storage throws", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

      const store = await loadFreshStore();

      expect(store.getState().collapsedFolderIds).toEqual([]);
    });

    it("keeps updating in-memory state when writing storage throws", async () => {
      const store = await loadFreshStore();
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

      store.getState().setExpanded("f1", false);

      expect(store.getState().isExpanded("f1")).toBe(false);
    });
  });
});
