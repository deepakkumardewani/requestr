/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TabState } from "@/types";

type ReconcileModule = typeof import("./reconcile");
type IdbModule = typeof import("@/lib/idb");
type TabsModule = typeof import("@/stores/useTabsStore");

async function load(): Promise<{
  reconcile: ReconcileModule;
  idb: IdbModule;
  tabs: TabsModule;
}> {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const idb = await import("@/lib/idb");
  const tabs = await import("@/stores/useTabsStore");
  const reconcile = await import("./reconcile");
  return { reconcile, idb, tabs };
}

async function seed(
  idb: IdbModule,
  store: string,
  records: unknown[],
): Promise<void> {
  const db = await idb.getLooseDB();
  for (const record of records) await db.put(store, record);
}

function tab(tabId: string, requestId?: string): TabState {
  return { tabId, requestId } as TabState;
}

describe("reconcileAfterRestore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("closes tabs whose request is gone and keeps the rest", async () => {
    const { reconcile, idb, tabs } = await load();
    await seed(idb, "requests", [{ id: "req-1" }]);
    tabs.useTabsStore.setState({
      hydrated: true,
      tabs: [tab("t1", "req-1"), tab("t2", "req-gone"), tab("t3")],
      activeTabId: "t2",
    });

    const result = await reconcile.reconcileAfterRestore();

    expect(result.closedTabs).toBe(1);
    const state = tabs.useTabsStore.getState();
    expect(state.tabs.map((t) => t.tabId)).toEqual(["t1", "t3"]);
    expect(state.activeTabId).toBe("t1");
  });

  it("closes nothing when every tab's request exists", async () => {
    const { reconcile, idb, tabs } = await load();
    await seed(idb, "requests", [{ id: "req-1" }]);
    tabs.useTabsStore.setState({
      hydrated: true,
      tabs: [tab("t1", "req-1")],
      activeTabId: "t1",
    });

    const result = await reconcile.reconcileAfterRestore();

    expect(result.closedTabs).toBe(0);
    expect(tabs.useTabsStore.getState().tabs).toHaveLength(1);
  });

  it("hydrates the tabs store first so closing never persists over the saved tabs", async () => {
    const { reconcile, tabs } = await load();
    const hydrate = vi.fn(async () => {
      tabs.useTabsStore.setState({
        hydrated: true,
        tabs: [tab("saved", "req-gone")],
        activeTabId: "saved",
      });
    });
    tabs.useTabsStore.setState({ hydrated: false, tabs: [], hydrate });

    const result = await reconcile.reconcileAfterRestore();

    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(result.closedTabs).toBe(1);
  });

  it("does not hydrate again when the store is already hydrated", async () => {
    const { reconcile, tabs } = await load();
    const hydrate = vi.fn(async () => undefined);
    tabs.useTabsStore.setState({ hydrated: true, tabs: [], hydrate });

    await reconcile.reconcileAfterRestore();

    expect(hydrate).not.toHaveBeenCalled();
  });

  it("counts references that point at records the restore did not bring", async () => {
    const { reconcile, idb, tabs } = await load();
    await seed(idb, "requests", [{ id: "req-1", collectionId: "col-missing" }]);
    await seed(idb, "chains", [{ id: "chain-1", nodeIds: ["req-1", "req-gone"] }]);
    const db = await idb.getLooseDB();
    await db.put("settings", { pinnedRequestIds: ["req-1", "req-unpinned"] }, "app");
    tabs.useTabsStore.setState({ hydrated: true, tabs: [], activeTabId: null });

    const result = await reconcile.reconcileAfterRestore();

    // missing collection + missing chain node + missing pinned request
    expect(result.danglingCount).toBe(3);
  });

  it("reports zero dangling references for a consistent workspace", async () => {
    const { reconcile, idb, tabs } = await load();
    await seed(idb, "collections", [{ id: "col-1" }]);
    await seed(idb, "requests", [{ id: "req-1", collectionId: "col-1" }]);
    tabs.useTabsStore.setState({ hydrated: true, tabs: [], activeTabId: null });

    const result = await reconcile.reconcileAfterRestore();

    expect(result.danglingCount).toBe(0);
  });

  it("treats a snapshot without requests as having none, closing request-bound tabs", async () => {
    vi.doMock("./exporter", () => ({ collectBackupData: async () => ({}) }));
    const { reconcile, tabs } = await load();
    tabs.useTabsStore.setState({
      hydrated: true,
      tabs: [tab("t1", "req-1"), tab("t2")],
      activeTabId: "t1",
    });

    let result;
    try {
      result = await reconcile.reconcileAfterRestore();
    } finally {
      vi.doUnmock("./exporter");
    }

    expect(result.closedTabs).toBe(1);
    expect(tabs.useTabsStore.getState().tabs.map((t) => t.tabId)).toEqual(["t2"]);
  });
});
