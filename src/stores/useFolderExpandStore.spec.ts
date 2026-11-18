import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "rq_collapsed_folders";

type Storage = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
};

let backing: Record<string, string>;

function stubStorage(overrides: Partial<Storage> = {}) {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => backing[k] ?? null,
    setItem: (k: string, v: string) => {
      backing[k] = v;
    },
    ...overrides,
  });
}

/** The store reads localStorage at module load, so every test gets a fresh module. */
async function loadStore() {
  vi.resetModules();
  const mod = await import("./useFolderExpandStore");
  return mod.useFolderExpandStore;
}

beforeEach(() => {
  backing = {};
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFolderExpandStore", () => {
  describe("initial hydration", () => {
    it("starts with every folder expanded when nothing is stored", async () => {
      const store = await loadStore();

      expect(store.getState().collapsedFolderIds).toEqual([]);
      expect(store.getState().isExpanded("f1")).toBe(true);
    });

    it("restores collapsed folders from storage", async () => {
      backing[STORAGE_KEY] = JSON.stringify(["f1", "f2"]);

      const store = await loadStore();

      expect(store.getState().collapsedFolderIds).toEqual(["f1", "f2"]);
      expect(store.getState().isExpanded("f1")).toBe(false);
      expect(store.getState().isExpanded("f3")).toBe(true);
    });

    it("falls back to empty when stored JSON is corrupt", async () => {
      backing[STORAGE_KEY] = "{not json";

      const store = await loadStore();

      expect(store.getState().collapsedFolderIds).toEqual([]);
    });

    it("falls back to empty when storage throws on read", async () => {
      stubStorage({
        getItem: () => {
          throw new Error("denied");
        },
      });

      const store = await loadStore();

      expect(store.getState().collapsedFolderIds).toEqual([]);
    });

    it("starts with no open collections", async () => {
      const store = await loadStore();

      expect(store.getState().openCollectionIds).toEqual([]);
    });
  });

  describe("expand state persistence round trip", () => {
    it("persists a collapse and restores it in a fresh module", async () => {
      const first = await loadStore();
      first.getState().setExpanded("f1", false);
      first.getState().toggle("f2");

      expect(JSON.parse(backing[STORAGE_KEY])).toEqual(["f1", "f2"]);

      const second = await loadStore();
      expect(second.getState().isExpanded("f1")).toBe(false);
      expect(second.getState().isExpanded("f2")).toBe(false);
      expect(second.getState().isExpanded("f3")).toBe(true);
    });

    it("persists re-expanding so the folder is open after reload", async () => {
      backing[STORAGE_KEY] = JSON.stringify(["f1", "f2"]);
      const first = await loadStore();

      first.getState().setExpanded("f1", true);

      const second = await loadStore();
      expect(second.getState().collapsedFolderIds).toEqual(["f2"]);
    });

    it("does not persist open collections across sessions", async () => {
      const first = await loadStore();
      first.getState().openCollection("c1");

      const second = await loadStore();
      expect(second.getState().openCollectionIds).toEqual([]);
    });

    it("keeps in-memory state when storage throws on write", async () => {
      const store = await loadStore();
      stubStorage({
        setItem: () => {
          throw new Error("quota");
        },
      });

      store.getState().setExpanded("f1", false);

      expect(store.getState().isExpanded("f1")).toBe(false);
    });
  });

  describe("toggle and setExpanded", () => {
    it("toggle flips expanded state each call", async () => {
      const store = await loadStore();

      store.getState().toggle("f1");
      expect(store.getState().isExpanded("f1")).toBe(false);
      store.getState().toggle("f1");
      expect(store.getState().isExpanded("f1")).toBe(true);
    });

    it("collapsing an already collapsed folder does not duplicate it", async () => {
      const store = await loadStore();

      store.getState().setExpanded("f1", false);
      store.getState().setExpanded("f1", false);

      expect(store.getState().collapsedFolderIds).toEqual(["f1"]);
    });
  });

  describe("bulk actions", () => {
    it("collapseAll collapses the given folders and keeps others", async () => {
      const store = await loadStore();
      store.getState().setExpanded("keep", false);

      store.getState().collapseAll(["a", "b"]);

      expect(store.getState().collapsedFolderIds.sort()).toEqual([
        "a",
        "b",
        "keep",
      ]);
      expect(JSON.parse(backing[STORAGE_KEY]).sort()).toEqual([
        "a",
        "b",
        "keep",
      ]);
    });

    it("expandAll expands only the given folders", async () => {
      const store = await loadStore();
      store.getState().collapseAll(["a", "b", "c"]);

      store.getState().expandAll(["a", "b"]);

      expect(store.getState().collapsedFolderIds).toEqual(["c"]);
    });

    it("isAllExpanded is false for an empty list", async () => {
      const store = await loadStore();

      expect(store.getState().isAllExpanded([])).toBe(false);
    });

    it("isAllExpanded is true only when none of the folders are collapsed", async () => {
      const store = await loadStore();
      expect(store.getState().isAllExpanded(["a", "b"])).toBe(true);

      store.getState().setExpanded("b", false);

      expect(store.getState().isAllExpanded(["a", "b"])).toBe(false);
    });

    it("toggleAll collapses everything when all are expanded", async () => {
      const store = await loadStore();

      store.getState().toggleAll(["a", "b"]);

      expect(store.getState().isExpanded("a")).toBe(false);
      expect(store.getState().isExpanded("b")).toBe(false);
    });

    it("toggleAll expands everything when any is collapsed", async () => {
      const store = await loadStore();
      store.getState().setExpanded("a", false);

      store.getState().toggleAll(["a", "b"]);

      expect(store.getState().isAllExpanded(["a", "b"])).toBe(true);
    });
  });

  describe("open collections", () => {
    it("setOpenCollectionIds replaces the list", async () => {
      const store = await loadStore();
      store.getState().openCollection("old");

      store.getState().setOpenCollectionIds(["c1", "c2"]);

      expect(store.getState().openCollectionIds).toEqual(["c1", "c2"]);
    });

    it("openCollection appends once and ignores repeats", async () => {
      const store = await loadStore();

      store.getState().openCollection("c1");
      const afterFirst = store.getState().openCollectionIds;
      store.getState().openCollection("c1");
      store.getState().openCollection("c2");

      expect(afterFirst).toEqual(["c1"]);
      expect(store.getState().openCollectionIds).toEqual(["c1", "c2"]);
    });
  });
});
