import {
  type ChangeOrigin,
  createChangeLog,
  createMemoryChangeStorage,
  type DataKind,
  folderSubtree,
  type WorkspaceWriter,
} from "../changeLog";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeStoreAccess, type StoreSource } from "../storeAccess";
import {
  executeTool,
  grantApproval,
  relayToolRegistry,
  type ToolRegistry,
} from "../tools/registry";

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

  /** The stores close the tabs of a request that is deleted. */
  const closeTabsOfRemoved = (requestsBefore: StoreSource["requests"]) => {
    const remaining = new Set(state.requests.map((r) => r.id));
    const gone = new Set(
      requestsBefore.filter((r) => !remaining.has(r.id)).map((r) => r.id),
    );
    state.tabs = state.tabs.filter(
      (tab) => !tab.requestId || !gone.has(tab.requestId),
    );
  };

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
      const requestsBefore = state.requests;
      if (kind === "collection") {
        state.collections = state.collections.filter((c) => c.id !== id);
        state.folders = state.folders.filter((f) => f.collectionId !== id);
        state.requests = state.requests.filter((r) => r.collectionId !== id);
        // As in the store, a collection takes its chain (same id) with it.
        state.chains = state.chains.filter((c) => c.id !== id);
        closeTabsOfRemoved(requestsBefore);
      } else if (kind === "folder") {
        const ids = subtreeFolderIds(id);
        state.folders = state.folders.filter((f) => !ids.has(f.id));
        state.requests = state.requests.filter(
          (r) => !r.folderId || !ids.has(r.folderId),
        );
        closeTabsOfRemoved(requestsBefore);
      } else if (kind === "request") {
        state.requests = state.requests.filter((r) => r.id !== id);
        closeTabsOfRemoved(requestsBefore);
      } else {
        const key = listOf(kind);
        (state as Record<string, unknown>)[key] = (
          state[key] as readonly { id: string }[]
        ).filter((item) => item.id !== id);
        // As in the store, deleting the active environment clears the selection.
        if (kind === "environment" && state.activeEnvironmentId === id) {
          state.activeEnvironmentId = null;
        }
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
  const storage = createMemoryChangeStorage();
  const log = createChangeLog({ store: access, writer, storage });
  const origin: ChangeOrigin = {
    threadId: TEST_THREAD_ID,
    turnId: TEST_TURN_ID,
    toolCallId: TEST_TOOL_CALL_ID,
  };
  return {
    store: access,
    state,
    writer,
    storage,
    log,
    write: { log, writer, origin },
  };
}

/** Every tool that can change the workspace; read tools never record a change. */
export function listWriteTools(
  registry: ToolRegistry = relayToolRegistry,
): string[] {
  return [...registry.values()]
    .filter((tool) => tool.kind === "auto" || tool.kind === "confirm")
    .map((tool) => tool.name);
}

export type WriteUndoRoundTrip = {
  /** Store contents before the write. */
  before: StoreSource;
  /** Store contents after the write, to prove the write changed something. */
  afterWrite: StoreSource;
  /** Store contents after Undo; equals `before` when the undo is faithful. */
  afterUndo: StoreSource;
  /** Ids of the changes the tool recorded. */
  changeIds: string[];
  /** The undo results, one per recorded change, newest change first. */
  undone: boolean[];
};

type FakeWriteContext = ReturnType<typeof createFakeWriteContext>;

/** Detached copy of the store contents, so later writes cannot change it. */
const cloneState = (state: StoreSource): StoreSource => structuredClone(state);

const changeIdsOf = (data: unknown): string[] => {
  const { changeId, changeIds } = (data ?? {}) as {
    changeId?: string;
    changeIds?: string[];
  };
  return changeIds ?? (changeId ? [changeId] : []);
};

/**
 * Runs one write tool through the registry, then undoes everything it recorded
 * newest first, so a property spec can deep-equal the store before and after.
 */
export async function writeThenUndo(
  ctx: FakeWriteContext,
  toolName: string,
  input: unknown,
  registry: ToolRegistry = relayToolRegistry,
): Promise<WriteUndoRoundTrip> {
  const before = cloneState(ctx.state);
  const outcome = await executeTool(registry, toolName, input, {
    store: ctx.store,
    redact: DEFAULT_REDACT_CONTEXT,
    write: ctx.write,
    approval: grantApproval(),
  });
  if (!outcome.ok) throw new Error(`${toolName} failed: ${outcome.error}`);
  const afterWrite = cloneState(ctx.state);
  const changeIds = changeIdsOf(outcome.data);
  const undone: boolean[] = [];
  for (const id of [...changeIds].reverse()) {
    undone.push((await ctx.log.undo(id)).ok);
  }
  return {
    before,
    afterWrite,
    afterUndo: cloneState(ctx.state),
    changeIds,
    undone,
  };
}
