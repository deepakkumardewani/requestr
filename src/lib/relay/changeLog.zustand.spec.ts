// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import {
  captureTree,
  createChangeLog,
  createMemoryChangeStorage,
  createZustandWorkspaceWriter,
  readSettingsGroup,
  writeSettingsGroup,
} from "./changeLog";
import { createZustandStoreAccess } from "./storeAccess";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn().mockRejectedValue(new Error("no idb in tests")),
}));

const request = {
  id: "r1",
  collectionId: "c1",
  folderId: null,
  name: "List",
  method: "GET" as const,
  url: "https://api.test/a",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
};

describe("Zustand workspace writer", () => {
  beforeEach(() => {
    useCollectionsStore.setState({
      collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
      folders: [],
      requests: [request],
    });
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    useTabsStore.setState({ tabs: [], activeTabId: null });
  });

  it("applies and undoes a request edit through the live stores", async () => {
    const log = createChangeLog({
      store: createZustandStoreAccess(),
      writer: createZustandWorkspaceWriter(),
      storage: createMemoryChangeStorage(),
    });
    const origin = { threadId: "t", turnId: "u", toolCallId: "c" };
    const applied = await log.apply(origin, {
      entity: "request",
      entityId: "r1",
      summary: "Edited",
      before: request,
      mutate: () =>
        createZustandWorkspaceWriter().put("request", {
          ...request,
          url: "https://api.test/b",
        }),
    });
    expect(applied.ok).toBe(true);
    expect(useCollectionsStore.getState().requests[0].url).toBe("https://api.test/b");

    const id = (applied as { change: { id: string } }).change.id;
    expect((await log.undo(id)).ok).toBe(true);
    expect(useCollectionsStore.getState().requests[0].url).toBe("https://api.test/a");
  });

  it("Undo of a deleted collection puts it back at its original position (T3.2)", async () => {
    const col = (id: string) => ({ id, name: id, createdAt: 1, updatedAt: 1 });
    useCollectionsStore.setState({
      collections: [col("a"), col("b"), col("c")],
      folders: [],
      requests: [],
    });
    const store = createZustandStoreAccess();
    const log = createChangeLog({
      store,
      writer: createZustandWorkspaceWriter(),
      storage: createMemoryChangeStorage(),
    });
    const applied = await log.apply(
      { threadId: "t", turnId: "u", toolCallId: "c" },
      {
        entity: "tree",
        entityId: "b",
        summary: "Deleted b",
        before: captureTree(store, "b"),
        mutate: () =>
          useCollectionsStore.setState((s) => ({
            collections: s.collections.filter((c) => c.id !== "b"),
          })),
      },
    );
    expect(useCollectionsStore.getState().collections.map((c) => c.id)).toEqual(["a", "c"]);

    const id = (applied as { change: { id: string } }).change.id;
    expect((await log.undo(id)).ok).toBe(true);
    expect(useCollectionsStore.getState().collections.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("opens, focuses and closes tabs and switches the environment", () => {
    const writer = createZustandWorkspaceWriter();
    const tabId = writer.openRequest(request);
    expect(writer.tabs()).toEqual([{ tabId, requestId: "r1" }]);
    expect(writer.openRequest(request)).toBe(tabId);
    expect(writer.activeTabId()).toBe(tabId);
    writer.closeTab(tabId);
    expect(writer.tabs()).toEqual([]);

    writer.put("environment", {
      id: "e1",
      name: "Dev",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    });
    writer.setActiveEnvironment("e1");
    expect(useEnvironmentsStore.getState().activeEnvId).toBe("e1");
    writer.remove("environment", "e1");
    expect(useEnvironmentsStore.getState().environments).toEqual([]);
  });

  it("ignores a legacy speechEngine value when restoring relay settings", () => {
    useRelayStore.setState({ shareValues: false, enabled: true });
    writeSettingsGroup("relay", {
      shareValues: true,
      speechEngine: "grok",
      enabled: false,
    });
    expect(useRelayStore.getState()).toMatchObject({ shareValues: true, enabled: false });
    expect(readSettingsGroup("relay")).toEqual({ shareValues: true, enabled: false });
  });
});
