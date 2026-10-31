import { announceSlugChange, unmarkSlugImported } from "@/lib/hub";
import { getDB } from "@/lib/idb";
import {
  mutateChain,
  persistChain,
  useChainStore,
} from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type {
  CollectionFolderModel,
  CollectionModel,
  EnvironmentModel,
  RequestModel,
  TabState,
} from "@/types";
import type { Chain } from "@/types/chain";
import { createZustandStoreAccess, type StoreAccess } from "./storeAccess";
import { trackRelayEvent } from "./telemetry";
import type { RelayChangeRecord, RelayChangeStatus } from "./threadDb";

/**
 * Change log (FR-41, FR-44). Every auto-applied write records the state it
 * replaced so it can be undone, but only while the entity still looks the way
 * the write left it: an undo never overwrites an edit made afterwards.
 */

export type DataKind =
  | "request"
  | "collection"
  | "folder"
  | "environment"
  | "chain";

/** What a change touched. `tree` is a collection or folder with everything inside it. */
export type ChangeEntity =
  | DataKind
  | "tree"
  | "requests"
  | "activeEnvironment"
  | "tab"
  | "tabRequest"
  | "settings";

export type TabRef = { tabId: string; requestId: string | null };

/** The only way Relay changes the workspace; stores are never touched elsewhere (NFR-7). */
export interface WorkspaceWriter {
  /** Inserts or fully replaces an entity. */
  put(kind: DataKind, entity: unknown): void;
  /** Removes an entity; a collection or folder takes its contents with it. */
  remove(kind: DataKind, id: string): void;
  setActiveEnvironment(id: string | null): void;
  tabs(): readonly TabRef[];
  activeTabId(): string | null;
  /** Opens (or focuses) the request's tab and returns its id. */
  openRequest(request: RequestModel): string;
  closeTab(tabId: string): void;
  activateTab(tabId: string): void;
}

/** Why an undo did nothing. */
export type UndoBlockReason =
  | "edited"
  | "removed"
  | "already_undone"
  | "not_found"
  | "failed";

export type TreeSnapshot = {
  collection: CollectionModel | null;
  folders: CollectionFolderModel[];
  requests: RequestModel[];
};

/** Tabs are keyed by request: the tab id of a tab about to be opened is not known yet. */
export type TabSnapshot = {
  /** Set when the change opened the request's tab, so undo closes it again. */
  openedForRequestId: string | null;
  activateTabId: string | null;
};

/** A change record plus what the Change Card shows; extra fields ride along in the same row. */
export type StoredChange = RelayChangeRecord & {
  summary: string;
  after: unknown;
  /** Set on an API catalog import: Undo removes it from the imported list too. */
  hubSlug?: string;
};

export type ChangeView = StoredChange & { reason?: UndoBlockReason };

export type ChangeOrigin = {
  threadId: string;
  turnId: string;
  toolCallId: string;
};

export type ChangeSpec = {
  entity: ChangeEntity;
  entityId: string;
  summary: string;
  /** What undo restores. `null` means the entity did not exist before. */
  before: unknown;
  /** The API catalog provider this change imports; stored so Undo works after a reload. */
  hubSlug?: string;
  /** Performs the write. May throw; the log then restores `before`. */
  mutate: () => void;
};

export type ApplyResult =
  | { ok: true; change: ChangeView }
  | { ok: false; error: string };

export type UndoResult =
  | { ok: true; change: ChangeView }
  | { ok: false; reason: UndoBlockReason };

export type UndoTurnResult = {
  undone: string[];
  blocked: { id: string; reason: UndoBlockReason }[];
};

export interface ChangeStorage {
  put(record: StoredChange): Promise<void>;
  get(id: string): Promise<StoredChange | null>;
  all(): Promise<StoredChange[]>;
}

/* ------------------------------ hashing helpers ----------------------------- */

const VOLATILE_KEYS = new Set(["createdAt", "updatedAt"]);

/** Stores stamp these on every write, so they would make an untouched entity look edited. */
function withoutTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTimestamps);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_KEYS.has(key))
      .map(([key, item]) => [key, withoutTimestamps(item)]),
  );
}

function isTreeSnapshot(state: unknown): state is TreeSnapshot {
  if (state === null || typeof state !== "object") return false;
  const candidate = state as Partial<TreeSnapshot>;
  return (
    "collection" in candidate &&
    Array.isArray(candidate.folders) &&
    Array.isArray(candidate.requests)
  );
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

/** Storage returns rows in no guaranteed order, so a tree is hashed sorted by id. */
function hashState(store: StoreAccess, state: unknown): string {
  const canonical = isTreeSnapshot(state)
    ? {
        ...state,
        folders: byId(state.folders),
        requests: byId(state.requests),
      }
    : state;
  return store.hash(withoutTimestamps(canonical));
}

/* ------------------------------ tree snapshots ------------------------------ */

/** Collects a folder and every folder below it, parents first. */
export function folderSubtree(
  folders: readonly CollectionFolderModel[],
  rootId: string,
): CollectionFolderModel[] {
  const root = folders.find((folder) => folder.id === rootId);
  if (!root) return [];
  const children = folders.filter((folder) => folder.parentFolderId === rootId);
  return [
    root,
    ...children.flatMap((child) => folderSubtree(folders, child.id)),
  ];
}

/**
 * A collection or folder with everything inside it, parents before children
 * so a restore can insert in order. Null when `id` is neither.
 */
export function captureTree(
  store: StoreAccess,
  id: string,
): TreeSnapshot | null {
  const collection = store.collections().find((item) => item.id === id);
  if (collection) {
    return {
      collection,
      folders: store.folders().filter((f) => f.collectionId === id),
      requests: store.requests().filter((r) => r.collectionId === id),
    };
  }
  const folders = folderSubtree(store.folders(), id);
  if (folders.length === 0) return null;
  const ids = new Set(folders.map((folder) => folder.id));
  return {
    collection: null,
    folders,
    requests: store
      .requests()
      .filter((request) => request.folderId && ids.has(request.folderId)),
  };
}

/* --------------------------------- adapters --------------------------------- */

type AdapterEnv = { store: StoreAccess; writer: WorkspaceWriter };

type Adapter = {
  /** Current state of the entity, `null` when it is gone. */
  read(env: AdapterEnv, id: string): unknown;
  /** Puts `before` back (or removes the entity when `before` is `null`). */
  restore(env: AdapterEnv, id: string, before: unknown): void;
};

const rowLists = {
  request: (store: StoreAccess) => store.requests(),
  collection: (store: StoreAccess) => store.collections(),
  folder: (store: StoreAccess) => store.folders(),
  environment: (store: StoreAccess) => store.environments(),
  chain: (store: StoreAccess) => store.chains(),
} satisfies Record<DataKind, (store: StoreAccess) => readonly { id: string }[]>;

function rowAdapter(kind: DataKind): Adapter {
  return {
    read: ({ store }, id) =>
      rowLists[kind](store).find((item) => item.id === id) ?? null,
    restore({ writer }, id, before) {
      if (before === null) writer.remove(kind, id);
      else writer.put(kind, before);
    },
  };
}

const treeAdapter: Adapter = {
  read: ({ store }, id) => captureTree(store, id),
  restore({ store, writer }, id, before) {
    if (before === null) {
      const isCollection = store.exists("collection", id);
      writer.remove(isCollection ? "collection" : "folder", id);
      return;
    }
    const tree = before as TreeSnapshot;
    if (tree.collection) writer.put("collection", tree.collection);
    for (const folder of tree.folders) writer.put("folder", folder);
    for (const request of tree.requests) writer.put("request", request);
  },
};

const BATCH_ID_SEPARATOR = ",";

const requestsAdapter: Adapter = {
  read: ({ store }, id) =>
    id
      .split(BATCH_ID_SEPARATOR)
      .map(
        (requestId) => store.requests().find((r) => r.id === requestId) ?? null,
      ),
  restore({ writer }, _id, before) {
    for (const request of before as RequestModel[]) {
      writer.put("request", request);
    }
  },
};

const activeEnvironmentAdapter: Adapter = {
  read: ({ store }) => store.activeEnvironmentId(),
  restore({ store, writer }, _id, before) {
    const previous = before as string | null;
    const stillThere =
      previous !== null && store.exists("environment", previous);
    writer.setActiveEnvironment(stillThere ? previous : null);
  },
};

const tabAdapter: Adapter = {
  read: ({ writer }, requestId) =>
    writer.tabs().some((tab) => tab.requestId === requestId)
      ? { open: true }
      : null,
  restore({ writer }, _id, before) {
    const { openedForRequestId, activateTabId } = before as TabSnapshot;
    for (const tab of writer.tabs()) {
      if (openedForRequestId && tab.requestId === openedForRequestId) {
        writer.closeTab(tab.tabId);
      }
    }
    if (activateTabId && writer.tabs().some((t) => t.tabId === activateTabId)) {
      writer.activateTab(activateTabId);
    }
  },
};

/** What Relay writes on each tab kind; also what Undo restores. HTTP tabs are saved requests, so only their assertions are Relay-written. */
const TAB_REQUEST_FIELDS = {
  http: ["assertions"],
  graphql: [
    "name",
    "url",
    "headers",
    "query",
    "variables",
    "operationName",
    "auth",
  ],
  websocket: ["name", "url", "headers", "draft"],
  socketio: ["name", "url", "headers", "draft", "eventName"],
} as const;

/** The Relay-editable fields of a tab; null for a missing tab. */
export function snapshotTabRequest(
  tab: TabState | undefined,
): Record<string, unknown> | null {
  if (!tab) return null;
  const record = tab as unknown as Record<string, unknown>;
  return Object.fromEntries(
    TAB_REQUEST_FIELDS[tab.type].map((field) => [field, record[field]]),
  );
}

const findTab = (tabId: string) =>
  useTabsStore.getState().tabs.find((tab) => tab.tabId === tabId);

/** Entity id is the tab id; `before` is null for a tab Relay opened, else the fields it replaced. */
const tabRequestAdapter: Adapter = {
  read: (_env, tabId) => snapshotTabRequest(findTab(tabId)),
  restore(_env, tabId, before) {
    const tabs = useTabsStore.getState();
    if (before === null) {
      if (findTab(tabId)) tabs.closeTab(tabId);
      return;
    }
    tabs.updateTabState(tabId, before as Partial<TabState>);
  },
};

/* --------------------------------- settings --------------------------------- */

/**
 * Settings are logged per Settings section, so a change opens the right
 * section from the summary. Every group snapshots all the fields its tools can
 * write, and undo puts the whole snapshot back.
 */
export const SETTINGS_GROUPS = [
  "appearance",
  "language",
  "proxy",
  "global",
  "relay",
] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

/** next-themes keeps the theme under this key; the Settings UI reads it through `useTheme`. */
export const THEME_STORAGE_KEY = "theme";

export function readStoredTheme(): string | null {
  return localStorage.getItem(THEME_STORAGE_KEY);
}

/**
 * next-themes follows `storage` events for its key, so writing the key and
 * announcing it switches the live theme without a handle on its provider.
 * `null` removes the key, which returns to the app default.
 */
export function applyStoredTheme(theme: string | null): void {
  if (theme === null) localStorage.removeItem(THEME_STORAGE_KEY);
  else localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(
    new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: theme }),
  );
}

type SettingsValues = Record<string, unknown>;

type SettingsGroupAccess = {
  read: () => SettingsValues;
  write: (values: SettingsValues) => void;
};

/** Writes every listed key through `setSetting`, the action the Settings UI calls. */
function writeSettingKeys(keys: readonly string[], values: SettingsValues) {
  const { setSetting } = useSettingsStore.getState();
  for (const key of keys) {
    (setSetting as (key: string, value: unknown) => void)(key, values[key]);
  }
}

const readSettingKeys = (keys: readonly string[]): SettingsValues => {
  const state = useSettingsStore.getState() as unknown as SettingsValues;
  return Object.fromEntries(keys.map((key) => [key, state[key]]));
};

const PROXY_KEYS = ["proxyUrl", "sslVerify", "followRedirects"] as const;
const GLOBAL_KEYS = ["globalBaseUrl", "globalHeaders"] as const;

const SETTINGS_ACCESS: Record<SettingsGroup, SettingsGroupAccess> = {
  appearance: {
    read: () => ({ theme: readStoredTheme() }),
    write: (values) => applyStoredTheme(values.theme as string | null),
  },
  language: {
    read: () => readSettingKeys(["locale"]),
    write: (values) => writeSettingKeys(["locale"], values),
  },
  proxy: {
    read: () => readSettingKeys(PROXY_KEYS),
    write: (values) => writeSettingKeys(PROXY_KEYS, values),
  },
  global: {
    read: () => readSettingKeys(GLOBAL_KEYS),
    write: (values) => writeSettingKeys(GLOBAL_KEYS, values),
  },
  relay: {
    read: () => {
      const { shareValues, speechEngine, enabled } = useRelayStore.getState();
      return { shareValues, speechEngine, enabled };
    },
    write: (values) => {
      const relay = useRelayStore.getState();
      relay.setShareValues(values.shareValues as boolean);
      relay.setSpeechEngine(values.speechEngine as "browser" | "grok");
      relay.setEnabled(values.enabled as boolean);
    },
  },
};

export const isSettingsGroup = (id: string): id is SettingsGroup =>
  Object.hasOwn(SETTINGS_ACCESS, id);

/** Entity id is the group; the snapshot is that group's writable fields. */
const settingsAdapter: Adapter = {
  read: (_env, id) => (isSettingsGroup(id) ? SETTINGS_ACCESS[id].read() : null),
  restore(_env, id, before) {
    if (isSettingsGroup(id))
      SETTINGS_ACCESS[id].write(before as SettingsValues);
  },
};

/** Current values of a settings group, for building a change's `before`. */
export function readSettingsGroup(group: SettingsGroup): SettingsValues {
  return SETTINGS_ACCESS[group].read();
}

/** Applies new values to a settings group; the change log wraps this as `mutate`. */
export function writeSettingsGroup(
  group: SettingsGroup,
  values: SettingsValues,
): void {
  SETTINGS_ACCESS[group].write(values);
}

const ADAPTERS: Record<ChangeEntity, Adapter> = {
  request: rowAdapter("request"),
  collection: rowAdapter("collection"),
  folder: rowAdapter("folder"),
  environment: rowAdapter("environment"),
  chain: rowAdapter("chain"),
  tree: treeAdapter,
  requests: requestsAdapter,
  activeEnvironment: activeEnvironmentAdapter,
  tab: tabAdapter,
  tabRequest: tabRequestAdapter,
  settings: settingsAdapter,
};

function adapterFor(entity: string): Adapter | null {
  return Object.hasOwn(ADAPTERS, entity)
    ? ADAPTERS[entity as ChangeEntity]
    : null;
}

/* ---------------------------------- storage --------------------------------- */

export function createMemoryChangeStorage(): ChangeStorage {
  const rows = new Map<string, StoredChange>();
  return {
    put: async (record) => {
      rows.set(record.id, record);
    },
    get: async (id) => rows.get(id) ?? null,
    all: async () => [...rows.values()],
  };
}

/** IndexedDB when available, otherwise memory for the rest of the session. */
function createDefaultChangeStorage(): ChangeStorage {
  const memory = createMemoryChangeStorage();
  let useMemory = false;

  async function run<T>(
    onDb: (db: NonNullable<Awaited<ReturnType<typeof getDB>>>) => Promise<T>,
    onMemory: () => Promise<T>,
  ): Promise<T> {
    if (!useMemory) {
      try {
        const opening = getDB();
        if (opening) return await onDb(await opening);
      } catch (error) {
        console.warn("[relay] change storage unavailable, using memory", {
          error,
        });
      }
      useMemory = true;
    }
    return onMemory();
  }

  return {
    put: (record) =>
      run(
        async (db) => void (await db.put("relay_changes", record)),
        () => memory.put(record),
      ),
    get: (id) =>
      run(
        async (db) =>
          ((await db.get("relay_changes", id)) as StoredChange) ?? null,
        () => memory.get(id),
      ),
    all: () =>
      run(
        async (db) => (await db.getAll("relay_changes")) as StoredChange[],
        () => memory.all(),
      ),
  };
}

/* ----------------------------------- log ------------------------------------ */

const ID_TIME_WIDTH = 13;
const ID_COUNTER_WIDTH = 6;
let idCounter = 0;

/** Sorts in creation order, even within one millisecond, so a turn can be undone newest first. */
function nextChangeId(): string {
  idCounter += 1;
  const time = Date.now().toString().padStart(ID_TIME_WIDTH, "0");
  const counter = String(idCounter).padStart(ID_COUNTER_WIDTH, "0");
  return `${time}-${counter}-${crypto.randomUUID().slice(0, 8)}`;
}

export type ChangeLog = {
  apply(origin: ChangeOrigin, spec: ChangeSpec): Promise<ApplyResult>;
  undo(changeId: string): Promise<UndoResult>;
  /** Reverts a turn's applied changes newest first; blocked ones are reported, not forced. */
  undoTurn(turnId: string): Promise<UndoTurnResult>;
  /** Loads a change (for example after a reload) and caches it for `getView`. */
  load(changeId: string): Promise<ChangeView | null>;
  getView(changeId: string): ChangeView | null;
  subscribe(listener: () => void): () => void;
};

export type ChangeLogDeps = {
  store: StoreAccess;
  writer: WorkspaceWriter;
  storage?: ChangeStorage;
};

export function createChangeLog({
  store,
  writer,
  storage = createDefaultChangeStorage(),
}: ChangeLogDeps): ChangeLog {
  const env: AdapterEnv = { store, writer };
  const views = new Map<string, ChangeView>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  function remember(view: ChangeView): ChangeView {
    views.set(view.id, view);
    notify();
    return view;
  }

  /** Best effort: the caller already has a failure to report. */
  function rollback(spec: ChangeSpec): void {
    try {
      ADAPTERS[spec.entity].restore(env, spec.entityId, spec.before);
    } catch (error) {
      console.error("[relay] rolling back a failed change failed", {
        entity: spec.entity,
        entityId: spec.entityId,
        error,
      });
    }
  }

  async function apply(
    origin: ChangeOrigin,
    spec: ChangeSpec,
  ): Promise<ApplyResult> {
    try {
      spec.mutate();
    } catch (error) {
      console.error("[relay] applying a change failed", {
        spec: spec.entity,
        error,
      });
      rollback(spec);
      return { ok: false, error: "the change could not be applied" };
    }
    const after = ADAPTERS[spec.entity].read(env, spec.entityId);
    const record: StoredChange = {
      id: nextChangeId(),
      ...origin,
      entity: spec.entity,
      entityId: spec.entityId,
      before: spec.before,
      afterHash: hashState(store, after),
      status: "applied",
      summary: spec.summary,
      after,
      ...(spec.hubSlug && { hubSlug: spec.hubSlug }),
    };
    try {
      await storage.put(record);
    } catch (error) {
      console.error("[relay] saving the change log failed", {
        changeId: record.id,
        error,
      });
      rollback(spec);
      return { ok: false, error: "the change could not be recorded" };
    }
    trackRelayEvent("relay_tool_applied", { entity: spec.entity });
    return { ok: true, change: remember(record) };
  }

  async function setStatus(
    record: StoredChange,
    status: RelayChangeStatus,
    reason?: UndoBlockReason,
  ): Promise<ChangeView> {
    const next: StoredChange = { ...record, status };
    try {
      await storage.put(next);
    } catch (error) {
      console.warn("[relay] saving the change status failed", {
        changeId: record.id,
        error,
      });
    }
    return remember({ ...next, reason });
  }

  async function undo(changeId: string): Promise<UndoResult> {
    const record = await storage.get(changeId);
    const adapter = record ? adapterFor(record.entity) : null;
    if (!record || !adapter) return { ok: false, reason: "not_found" };
    if (record.status === "undone") {
      return { ok: false, reason: "already_undone" };
    }
    const current = adapter.read(env, record.entityId);
    if (hashState(store, current) !== record.afterHash) {
      const reason = current === null ? "removed" : "edited";
      await setStatus(record, "blocked", reason);
      return { ok: false, reason };
    }
    try {
      adapter.restore(env, record.entityId, record.before);
    } catch (error) {
      console.error("[relay] undo failed", { changeId, error });
      return { ok: false, reason: "failed" };
    }
    const change = await setStatus(record, "undone");
    if (record.hubSlug) {
      unmarkSlugImported(record.hubSlug);
      announceSlugChange();
    }
    trackRelayEvent("relay_undo", { entity: record.entity });
    return { ok: true, change };
  }

  async function undoTurn(turnId: string): Promise<UndoTurnResult> {
    const rows = (await storage.all())
      .filter((row) => row.turnId === turnId && row.status !== "undone")
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    const result: UndoTurnResult = { undone: [], blocked: [] };
    for (const row of rows) {
      const outcome = await undo(row.id);
      if (outcome.ok) result.undone.push(row.id);
      else result.blocked.push({ id: row.id, reason: outcome.reason });
    }
    return result;
  }

  async function load(changeId: string): Promise<ChangeView | null> {
    const cached = views.get(changeId);
    if (cached) return cached;
    const record = await storage.get(changeId);
    return record ? remember(record) : null;
  }

  return {
    apply,
    undo,
    undoTurn,
    load,
    getView: (changeId) => views.get(changeId) ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/* --------------------------------- tool glue -------------------------------- */

/** What a write tool needs beyond reading: the log, the writer and who is asking. */
export type WriteContext = {
  log: ChangeLog;
  writer: WorkspaceWriter;
  origin: ChangeOrigin;
};

export type CommitOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

export const WRITE_UNAVAILABLE = "changes are not available right now";

/**
 * Applies a write through the log and shapes the answer for the model: ids
 * and a one-line summary only, never the entity states (FR-46).
 */
export async function commitChange(
  write: WriteContext | undefined,
  spec: ChangeSpec,
  data: Record<string, unknown> = {},
): Promise<CommitOutcome> {
  if (!write) return { ok: false, error: WRITE_UNAVAILABLE };
  const result = await write.log.apply(write.origin, spec);
  if (!result.ok) return result;
  const { id, turnId, entity, entityId, summary } = result.change;
  return {
    ok: true,
    data: { changeId: id, turnId, entity, entityId, summary, ...data },
  };
}

/* ----------------------------- production wiring ---------------------------- */

/**
 * Replaces the stored entity, then calls an existing store action whose only
 * job here is to persist it: the stores keep their IndexedDB writers private.
 */
function replaceThenPersist(
  kind: "collection" | "folder",
  entity: CollectionModel | CollectionFolderModel,
): void {
  const store = useCollectionsStore;
  if (kind === "collection") {
    store.setState((s) => ({
      collections: upsertById(s.collections, entity as CollectionModel),
    }));
    store.getState().renameCollection(entity.id, entity.name);
    return;
  }
  store.setState((s) => ({
    folders: upsertById(s.folders, entity as CollectionFolderModel),
  }));
  store.getState().renameFolder(entity.id, entity.name);
}

function upsertById<T extends { id: string }>(list: T[], next: T): T[] {
  return list.some((item) => item.id === next.id)
    ? list.map((item) => (item.id === next.id ? next : item))
    : [...list, next];
}

function putRequest(request: RequestModel): void {
  useCollectionsStore.setState((s) => ({
    requests: upsertById(s.requests, request),
  }));
  useCollectionsStore.getState().updateRequest(request.id, request);
}

function putEnvironment(env: EnvironmentModel): void {
  const envs = useEnvironmentsStore.getState();
  if (envs.environments.some((item) => item.id === env.id)) {
    envs.updateEnv(env.id, env);
  } else {
    envs.importEnv(env);
  }
}

/**
 * Replaces the whole chain through `mutateChain` so the canvas keeps its own
 * undo entry, then saves it now: a Relay undo must survive an immediate reload.
 */
function putChain(chain: Chain): void {
  useChainStore.setState((state) =>
    state.chains[chain.id]
      ? mutateChain(state, chain.id, () => chain)
      : { chains: { ...state.chains, [chain.id]: chain } },
  );
  persistChain(chain);
  void persistChain.flush(chain.id);
}

/** The production writer, backed by the live Zustand stores. */
export function createZustandWorkspaceWriter(): WorkspaceWriter {
  return {
    put(kind, entity) {
      if (kind === "request") putRequest(entity as RequestModel);
      else if (kind === "chain") putChain(entity as Chain);
      else if (kind === "environment")
        putEnvironment(entity as EnvironmentModel);
      else replaceThenPersist(kind, entity as CollectionModel);
    },
    remove(kind, id) {
      if (kind === "chain") {
        useChainStore.getState().deleteChain(id);
        return;
      }
      const collections = useCollectionsStore.getState();
      if (kind === "request") collections.deleteRequest(id);
      else if (kind === "collection") collections.deleteCollection(id);
      else if (kind === "folder") collections.deleteFolder(id);
      else useEnvironmentsStore.getState().deleteEnv(id);
    },
    setActiveEnvironment: (id) =>
      useEnvironmentsStore.getState().setActiveEnv(id),
    tabs: () =>
      useTabsStore
        .getState()
        .tabs.map((tab) => ({ tabId: tab.tabId, requestId: tab.requestId })),
    activeTabId: () => useTabsStore.getState().activeTabId,
    openRequest(request) {
      const tabs = useTabsStore.getState();
      const existing = tabs.tabs.find((tab) => tab.requestId === request.id);
      if (existing) {
        tabs.setActiveTab(existing.tabId);
        return existing.tabId;
      }
      tabs.openTab({
        type: "http",
        requestId: request.id,
        name: request.name,
        method: request.method,
        url: request.url,
        params: request.params,
        headers: request.headers,
        auth: request.auth,
        body: request.body,
        preScript: request.preScript,
        postScript: request.postScript,
        isDirty: false,
      });
      return useTabsStore.getState().activeTabId ?? "";
    },
    closeTab: (tabId) => useTabsStore.getState().closeTab(tabId),
    activateTab: (tabId) => useTabsStore.getState().setActiveTab(tabId),
  };
}

let sharedLog: ChangeLog | null = null;

/** The app-wide log over the live stores; tests build their own with `createChangeLog`. */
export function getRelayChangeLog(): ChangeLog {
  sharedLog ??= createChangeLog({
    store: createZustandStoreAccess(),
    writer: createZustandWorkspaceWriter(),
  });
  return sharedLog;
}
