import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import type { CollectionModel, HttpTab, RequestModel } from "@/types";
import { useCollectionsStore } from "./useCollectionsStore";
import { useTabsStore } from "./useTabsStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

const deleteChainMock = vi.fn();
vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => ({ deleteChain: deleteChainMock }) },
}));

const sampleHttpTab: HttpTab = {
  tabId: "tab-1",
  requestId: null,
  name: "Get User",
  isDirty: false,
  type: "http",
  url: "https://api.example.com/u",
  headers: [],
  method: "GET",
  params: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
};

function resetStores() {
  useCollectionsStore.setState({ collections: [], folders: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

describe("useCollectionsStore", () => {
  beforeEach(() => {
    resetStores();
    vi.mocked(getDB).mockReturnValue(null);
    vi.clearAllMocks();
  });

  it("createCollection appends collection", () => {
    const c = useCollectionsStore.getState().createCollection("My API");
    expect(c.name).toBe("My API");
    expect(useCollectionsStore.getState().collections).toHaveLength(1);
    expect(useCollectionsStore.getState().collections[0].id).toBe(c.id);
  });

  it("renameCollection updates name and touches updatedAt", () => {
    const { id } = useCollectionsStore.getState().createCollection("A");
    const before = useCollectionsStore.getState().collections[0].updatedAt;
    vi.useFakeTimers();
    vi.setSystemTime(before + 10_000);
    useCollectionsStore.getState().renameCollection(id, "B");
    vi.useRealTimers();
    const col = useCollectionsStore.getState().collections[0];
    expect(col.name).toBe("B");
    expect(col.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("bulkImportCollection merges collection and requests", () => {
    const collection: CollectionModel = {
      id: "imp-col",
      name: "Imported",
      createdAt: 1,
      updatedAt: 1,
    };
    const requests: RequestModel[] = [
      {
        id: "imp-req",
        collectionId: "imp-col",
        name: "R1",
        method: "GET",
        url: "/",
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    useCollectionsStore.getState().bulkImportCollection(collection, requests);
    const s = useCollectionsStore.getState();
    expect(s.collections.map((c) => c.id)).toContain("imp-col");
    expect(s.requests).toHaveLength(1);
    expect(s.requests[0].id).toBe("imp-req");
  });

  it("addRequest creates request in collection", () => {
    const { id: colId } = useCollectionsStore.getState().createCollection("C");
    const req = useCollectionsStore.getState().addRequest(colId, sampleHttpTab);
    expect(req.collectionId).toBe(colId);
    expect(req.name).toBe(sampleHttpTab.name);
    expect(useCollectionsStore.getState().requests).toContainEqual(
      expect.objectContaining({ id: req.id }),
    );
  });

  it("updateRequest patches fields", () => {
    const { id: colId } = useCollectionsStore.getState().createCollection("C");
    const req = useCollectionsStore.getState().addRequest(colId, sampleHttpTab);
    useCollectionsStore.getState().updateRequest(req.id, { name: "Renamed" });
    const r = useCollectionsStore
      .getState()
      .requests.find((x) => x.id === req.id);
    expect(r?.name).toBe("Renamed");
  });

  it("moveRequest changes collection id", () => {
    const a = useCollectionsStore.getState().createCollection("A");
    const b = useCollectionsStore.getState().createCollection("B");
    const req = useCollectionsStore.getState().addRequest(a.id, sampleHttpTab);
    useCollectionsStore.getState().moveRequest(req.id, b.id);
    expect(
      useCollectionsStore.getState().requests.find((r) => r.id === req.id)
        ?.collectionId,
    ).toBe(b.id);
  });

  it("deleteRequest removes request and closes tab", () => {
    const { id: colId } = useCollectionsStore.getState().createCollection("C");
    const req = useCollectionsStore.getState().addRequest(colId, sampleHttpTab);
    useTabsStore.getState().openTab({ ...sampleHttpTab, requestId: req.id });
    useCollectionsStore.getState().deleteRequest(req.id);
    expect(
      useCollectionsStore.getState().requests.some((r) => r.id === req.id),
    ).toBe(false);
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });

  it("deleteCollection removes nested requests and closes their tabs", () => {
    const { id: colId } = useCollectionsStore.getState().createCollection("C");
    const r1 = useCollectionsStore.getState().addRequest(colId, sampleHttpTab);
    const r2 = useCollectionsStore
      .getState()
      .addRequest(colId, { ...sampleHttpTab, name: "two" });
    useTabsStore.getState().openTab({ ...sampleHttpTab, requestId: r1.id });
    useTabsStore
      .getState()
      .openTab({ ...sampleHttpTab, name: "t2", requestId: r2.id });
    useCollectionsStore.getState().deleteCollection(colId);
    expect(useCollectionsStore.getState().collections).toHaveLength(0);
    expect(useCollectionsStore.getState().requests).toHaveLength(0);
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });

  it("deleteCollection cascades to delete the chain living at the same id", () => {
    const { id: colId } = useCollectionsStore.getState().createCollection("C");
    useCollectionsStore.getState().deleteCollection(colId);
    expect(deleteChainMock).toHaveBeenCalledWith(colId);
  });

  it("hydrate early-returns when getDB is null", async () => {
    await useCollectionsStore.getState().hydrate();
    expect(useCollectionsStore.getState().collections).toEqual([]);
  });

  it("hydrate loads collections and requests", async () => {
    const collections: CollectionModel[] = [
      { id: "c1", name: "C1", createdAt: 1, updatedAt: 1 },
    ];
    const requests: RequestModel[] = [
      {
        id: "q1",
        collectionId: "c1",
        name: "R",
        method: "GET",
        url: "/",
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const db = {
      getAll: vi.fn(async (store: string) => {
        if (store === "collections") return collections;
        if (store === "requests") return requests;
        return [];
      }),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useCollectionsStore.getState().hydrate();

    expect(useCollectionsStore.getState().collections).toEqual(collections);
    expect(useCollectionsStore.getState().requests).toEqual(requests);
  });

  it("hydrate toast on failure", async () => {
    const db = {
      getAll: vi.fn().mockRejectedValue(new Error("load fail")),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useCollectionsStore.getState().hydrate();

    expect(toast.error).toHaveBeenCalledWith("Failed to load collections", {
      description: "load fail",
    });
  });

  it("persistCollection error surfaces toast", async () => {
    const db = {
      put: vi.fn().mockRejectedValue(new Error("put fail")),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useCollectionsStore.getState().createCollection("X");

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to save collection", {
        description: "put fail",
      }),
    );
  });
});

describe("useCollectionsStore folders", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    vi.mocked(getDB).mockReturnValue(null);
  });

  function seedCollection() {
    return useCollectionsStore.getState().createCollection("C").id;
  }

  function foldersOf() {
    return useCollectionsStore.getState().folders;
  }

  it("createFolder defaults to the name 'New Folder' at the collection root", () => {
    const colId = seedCollection();

    const folder = useCollectionsStore.getState().createFolder(colId);

    expect(folder).toMatchObject({
      collectionId: colId,
      name: "New Folder",
      parentFolderId: null,
      order: 0,
    });
    expect(foldersOf()).toEqual([folder]);
  });

  it("createFolder nests a folder under the given parent", () => {
    const colId = seedCollection();
    const parent = useCollectionsStore.getState().createFolder(colId);

    const child = useCollectionsStore
      .getState()
      .createFolder(colId, parent.id, "Child");

    expect(child.parentFolderId).toBe(parent.id);
    expect(child.name).toBe("Child");
  });

  it("createFolder bumps the order of existing siblings only", () => {
    const colId = seedCollection();
    const first = useCollectionsStore.getState().createFolder(colId);
    const nested = useCollectionsStore
      .getState()
      .createFolder(colId, first.id, "Nested");

    const second = useCollectionsStore.getState().createFolder(colId);

    const byId = new Map(foldersOf().map((f) => [f.id, f]));
    expect(second.order).toBe(0);
    expect(byId.get(first.id)?.order).toBe(1);
    expect(byId.get(nested.id)?.order).toBe(0);
  });

  it("renameFolder changes only the targeted folder's name", () => {
    const colId = seedCollection();
    const a = useCollectionsStore.getState().createFolder(colId, null, "A");
    const b = useCollectionsStore.getState().createFolder(colId, null, "B");

    useCollectionsStore.getState().renameFolder(a.id, "Renamed");

    const byId = new Map(foldersOf().map((f) => [f.id, f]));
    expect(byId.get(a.id)?.name).toBe("Renamed");
    expect(byId.get(b.id)?.name).toBe("B");
  });

  it("renameFolder trims the name and ignores blank names", () => {
    const colId = seedCollection();
    const a = useCollectionsStore.getState().createFolder(colId, null, "A");

    useCollectionsStore.getState().renameFolder(a.id, "  Padded  ");
    expect(foldersOf().find((f) => f.id === a.id)?.name).toBe("Padded");

    useCollectionsStore.getState().renameFolder(a.id, "   ");
    expect(foldersOf().find((f) => f.id === a.id)?.name).toBe("Padded");
  });

  it("duplicateFolder returns null for an unknown folder id", () => {
    seedCollection();

    expect(useCollectionsStore.getState().duplicateFolder("missing")).toBeNull();
    expect(foldersOf()).toEqual([]);
  });

  describe("duplicateFolder on a nested tree", () => {
    function seedTree() {
      const colId = seedCollection();
      const store = useCollectionsStore.getState();
      const root = store.createFolder(colId, null, "Root");
      const child = store.createFolder(colId, root.id, "Child");
      const grandchild = store.createFolder(colId, child.id, "Grand");
      const rootReq = store.addRequest(colId, sampleHttpTab, root.id);
      const grandReq = store.addRequest(
        colId,
        { ...sampleHttpTab, name: "Deep" },
        grandchild.id,
      );
      const outsideReq = store.addRequest(
        colId,
        { ...sampleHttpTab, name: "Outside" },
        null,
      );
      return { colId, root, child, grandchild, rootReq, grandReq, outsideReq };
    }

    it("copies the whole subtree with fresh ids and a '(copy)' suffix on the root", () => {
      const { root, child, grandchild } = seedTree();

      const copy = useCollectionsStore.getState().duplicateFolder(root.id);

      const originalIds = [root.id, child.id, grandchild.id];
      const copies = foldersOf().filter((f) => !originalIds.includes(f.id));
      expect(copy?.name).toBe("Root (copy)");
      expect(copies.map((f) => f.name).sort()).toEqual([
        "Child",
        "Grand",
        "Root (copy)",
      ]);
    });

    it("remaps parentFolderId so the copy forms its own tree", () => {
      const { root, child, grandchild } = seedTree();

      const copy = useCollectionsStore.getState().duplicateFolder(root.id);

      const originalIds = [root.id, child.id, grandchild.id];
      const copies = foldersOf().filter((f) => !originalIds.includes(f.id));
      const copiedChild = copies.find((f) => f.name === "Child");
      const copiedGrand = copies.find((f) => f.name === "Grand");
      expect(copy?.parentFolderId).toBeNull();
      expect(copiedChild?.parentFolderId).toBe(copy?.id);
      expect(copiedGrand?.parentFolderId).toBe(copiedChild?.id);
    });

    it("clones contained requests into the copied folders and leaves originals untouched", () => {
      const { root, rootReq, grandReq, outsideReq } = seedTree();

      const copy = useCollectionsStore.getState().duplicateFolder(root.id);

      const requests = useCollectionsStore.getState().requests;
      const clones = requests.filter(
        (r) => ![rootReq.id, grandReq.id, outsideReq.id].includes(r.id),
      );
      const copiedFolderIds = foldersOf()
        .filter((f) => f.id === copy?.id || f.name === "Child" || f.name === "Grand")
        .map((f) => f.id);
      expect(requests).toHaveLength(5);
      expect(clones.map((r) => r.name).sort()).toEqual(["Deep", "Get User"]);
      for (const clone of clones) {
        expect(clone.folderId).not.toBe(root.id);
        expect(copiedFolderIds).toContain(clone.folderId);
      }
      expect(requests.find((r) => r.id === rootReq.id)?.folderId).toBe(root.id);
    });

    it("places the copy at the top of its siblings by bumping their order", () => {
      const colId = seedCollection();
      const store = useCollectionsStore.getState();
      const other = store.createFolder(colId, null, "Other");
      const target = store.createFolder(colId, null, "Target");
      // order: Target 0, Other 1

      const copy = useCollectionsStore.getState().duplicateFolder(target.id);

      const byId = new Map(foldersOf().map((f) => [f.id, f]));
      expect(copy?.order).toBe(0);
      expect(byId.get(target.id)?.order).toBe(0);
      expect(byId.get(other.id)?.order).toBe(2);
    });
  });

  describe("deleteFolder", () => {
    it("removes the folder, its subfolders and every request inside, sparing others", () => {
      const colId = seedCollection();
      const store = useCollectionsStore.getState();
      const root = store.createFolder(colId, null, "Root");
      const child = store.createFolder(colId, root.id, "Child");
      const sibling = store.createFolder(colId, null, "Sibling");
      store.addRequest(colId, sampleHttpTab, root.id);
      store.addRequest(colId, sampleHttpTab, child.id);
      const kept = store.addRequest(colId, sampleHttpTab, sibling.id);
      const rootLevel = store.addRequest(colId, sampleHttpTab, null);

      useCollectionsStore.getState().deleteFolder(root.id);

      const s = useCollectionsStore.getState();
      expect(s.folders.map((f) => f.id)).toEqual([sibling.id]);
      expect(s.requests.map((r) => r.id).sort()).toEqual(
        [kept.id, rootLevel.id].sort(),
      );
    });

    it("closes tabs of deleted requests but keeps tabs of surviving ones", () => {
      const colId = seedCollection();
      const store = useCollectionsStore.getState();
      const folder = store.createFolder(colId, null, "F");
      const doomed = store.addRequest(colId, sampleHttpTab, folder.id);
      const survivor = store.addRequest(colId, sampleHttpTab, null);
      useTabsStore.getState().openTab({ ...sampleHttpTab, requestId: doomed.id });
      useTabsStore
        .getState()
        .openTab({ ...sampleHttpTab, name: "keep", requestId: survivor.id });

      useCollectionsStore.getState().deleteFolder(folder.id);

      expect(useTabsStore.getState().tabs.map((t) => t.requestId)).toEqual([
        survivor.id,
      ]);
    });

    it("persists removal of the folder to IndexedDB", async () => {
      const colId = seedCollection();
      const folder = useCollectionsStore.getState().createFolder(colId);
      const db = { delete: vi.fn().mockResolvedValue(undefined) };
      vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

      useCollectionsStore.getState().deleteFolder(folder.id);

      await vi.waitFor(() =>
        expect(db.delete).toHaveBeenCalledWith("folders", folder.id),
      );
    });
  });
});
