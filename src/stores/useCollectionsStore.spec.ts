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
  useCollectionsStore.setState({ collections: [], requests: [] });
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
