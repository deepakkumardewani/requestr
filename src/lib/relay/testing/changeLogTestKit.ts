import {
  type ChangeOrigin,
  createChangeLog,
  createMemoryChangeStorage,
  type DataKind,
  folderSubtree,
  type WorkspaceWriter,
} from "../changeLog";
import { createFakeStoreAccess, type StoreSource } from "../storeAccess";

/** Origin ids stamped on every change made through the fake write context. */
export const TEST_THREAD_ID = "thread-1";
export const TEST_TURN_ID = "turn-1";
export const TEST_TOOL_CALL_ID = "call-1";

/** Applies writes straight to a `StoreSource`, with no Zustand or DOM. */
export function createMemoryWorkspaceWriter(
  state: StoreSource,
): WorkspaceWriter {
  let tabCounter = 0;
  const listOf = (kind: DataKind) =>
    ({
      request: "requests",
      collection: "collections",
      folder: "folders",
      environment: "environments",
      chain: "chains",
    })[kind] as
      | "requests"
      | "collections"
      | "folders"
      | "environments"
      | "chains";

  const subtreeFolderIds = (folderId: string) =>
    new Set(folderSubtree(state.folders, folderId).map((f) => f.id));

  const writer: WorkspaceWriter = {
    put(kind, entity) {
      const key = listOf(kind);
      const next = entity as { id: string };
      const list = state[key] as readonly { id: string }[];
      const exists = list.some((item) => item.id === next.id);
      (state as Record<string, unknown>)[key] = exists
        ? list.map((item) => (item.id === next.id ? next : item))
        : [...list, next];
    },
    remove(kind, id) {
      if (kind === "collection") {
        state.collections = state.collections.filter((c) => c.id !== id);
        state.folders = state.folders.filter((f) => f.collectionId !== id);
        state.requests = state.requests.filter((r) => r.collectionId !== id);
      } else if (kind === "folder") {
        const ids = subtreeFolderIds(id);
        state.folders = state.folders.filter((f) => !ids.has(f.id));
        state.requests = state.requests.filter(
          (r) => !r.folderId || !ids.has(r.folderId),
        );
      } else {
        const key = listOf(kind);
        (state as Record<string, unknown>)[key] = (
          state[key] as readonly { id: string }[]
        ).filter((item) => item.id !== id);
      }
    },
    setActiveEnvironment(id) {
      state.activeEnvironmentId = id;
    },
    tabs: () =>
      state.tabs.map((tab) => ({ tabId: tab.tabId, requestId: tab.requestId })),
    activeTabId: () => state.activeTabId,
    openRequest(request) {
      const existing = state.tabs.find((tab) => tab.requestId === request.id);
      if (existing) {
        state.activeTabId = existing.tabId;
        return existing.tabId;
      }
      tabCounter += 1;
      const tabId = `tab-${tabCounter}`;
      state.tabs = [
        ...state.tabs,
        { tabId, requestId: request.id, name: request.name } as never,
      ];
      state.activeTabId = tabId;
      return tabId;
    },
    closeTab(tabId) {
      state.tabs = state.tabs.filter((tab) => tab.tabId !== tabId);
      if (state.activeTabId === tabId) state.activeTabId = null;
    },
    activateTab(tabId) {
      state.activeTabId = tabId;
    },
  };
  return writer;
}

/** Write-tool test kit: fake stores, an in-memory writer and a log over both. */
export function createFakeWriteContext(seed: Partial<StoreSource> = {}) {
  const { access, state } = createFakeStoreAccess(seed);
  const writer = createMemoryWorkspaceWriter(state);
  const log = createChangeLog({
    store: access,
    writer,
    storage: createMemoryChangeStorage(),
  });
  const origin: ChangeOrigin = {
    threadId: TEST_THREAD_ID,
    turnId: TEST_TURN_ID,
    toolCallId: TEST_TOOL_CALL_ID,
  };
  return { store: access, state, writer, log, write: { log, writer, origin } };
}
