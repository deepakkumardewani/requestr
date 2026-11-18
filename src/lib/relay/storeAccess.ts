import { useChainRunStore } from "@/stores/useChainRunStore";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type {
  CollectionFolderModel,
  CollectionModel,
  EnvironmentModel,
  HistoryEntry,
  RequestModel,
  ResponseData,
  TabState,
} from "@/types";
import type { Chain, ChainRunState } from "@/types/chain";

export type EntityKind =
  | "request"
  | "collection"
  | "folder"
  | "environment"
  | "chain";

/**
 * What Relay tools may know about the workspace. Tools take this interface,
 * never a store, so they run in tests without Zustand or a DOM (NFR-7).
 */
export interface StoreAccess {
  collections(): readonly CollectionModel[];
  folders(): readonly CollectionFolderModel[];
  requests(): readonly RequestModel[];
  environments(): readonly EnvironmentModel[];
  chains(): readonly Chain[];
  activeEnvironmentId(): string | null;
  activeTab(): TabState | null;
  /** Latest response for a saved request: its open tab first, then history. */
  lastResponseFor(requestId: string): ResponseData | null;
  chainRunState(chainId: string): ChainRunState | undefined;
  /** Live check against current store state (FR-43). */
  exists(kind: EntityKind, id: string): boolean;
  /** Stable for equal data; used to detect edits made after a Relay change (FR-44). */
  hash(entity: unknown): string;
}

/** Raw store data an access object is built from. */
export type StoreSource = {
  collections: readonly CollectionModel[];
  folders: readonly CollectionFolderModel[];
  requests: readonly RequestModel[];
  environments: readonly EnvironmentModel[];
  chains: readonly Chain[];
  activeEnvironmentId: string | null;
  tabs: readonly TabState[];
  activeTabId: string | null;
  responses: Readonly<Record<string, ResponseData | null>>;
  history: readonly HistoryEntry[];
  chainRunState: Readonly<Record<string, ChainRunState>>;
};

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;
const HASH_HEX_LENGTH = 8;

/** JSON with object keys sorted, so key order never changes a hash. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(",")}}`;
}

export function hashEntity(entity: unknown): string {
  const text = stableStringify(entity);
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0).toString(HEX_RADIX).padStart(HASH_HEX_LENGTH, "0");
}

function latestHistoryResponse(
  history: readonly HistoryEntry[],
  requestId: string,
): ResponseData | null {
  const latest = history
    .filter((entry) => entry.request.requestId === requestId)
    .reduce<HistoryEntry | null>(
      (best, entry) =>
        !best || entry.timestamp > best.timestamp ? entry : best,
      null,
    );
  return latest?.response ?? null;
}

function tabResponse(source: StoreSource, requestId: string) {
  const tabs = source.tabs.filter((tab) => tab.requestId === requestId);
  const ordered = [
    ...tabs.filter((tab) => tab.tabId === source.activeTabId),
    ...tabs.filter((tab) => tab.tabId !== source.activeTabId),
  ];
  for (const tab of ordered) {
    const response = source.responses[tab.tabId];
    if (response) return response;
  }
  return null;
}

function existsIn(source: StoreSource, kind: EntityKind, id: string): boolean {
  const lists: Record<EntityKind, readonly { id: string }[]> = {
    request: source.requests,
    collection: source.collections,
    folder: source.folders,
    environment: source.environments,
    chain: source.chains,
  };
  return lists[kind].some((item) => item.id === id);
}

/** Builds an access object that re-reads `getSource` on every call, so it is always live. */
export function createStoreAccess(getSource: () => StoreSource): StoreAccess {
  return {
    collections: () => getSource().collections,
    folders: () => getSource().folders,
    requests: () => getSource().requests,
    environments: () => getSource().environments,
    chains: () => getSource().chains,
    activeEnvironmentId: () => getSource().activeEnvironmentId,
    activeTab() {
      const { tabs, activeTabId } = getSource();
      return tabs.find((tab) => tab.tabId === activeTabId) ?? null;
    },
    lastResponseFor(requestId) {
      const source = getSource();
      return (
        tabResponse(source, requestId) ??
        latestHistoryResponse(source.history, requestId)
      );
    },
    chainRunState: (chainId) => getSource().chainRunState[chainId],
    exists: (kind, id) => existsIn(getSource(), kind, id),
    hash: hashEntity,
  };
}

function readZustandSource(): StoreSource {
  const environments = useEnvironmentsStore.getState();
  const tabs = useTabsStore.getState();
  const collections = useCollectionsStore.getState();
  return {
    collections: collections.collections,
    folders: collections.folders,
    requests: collections.requests,
    environments: environments.environments,
    chains: Object.values(useChainStore.getState().chains),
    activeEnvironmentId: environments.activeEnvId,
    tabs: tabs.tabs,
    activeTabId: tabs.activeTabId,
    responses: useResponseStore.getState().responses,
    history: useHistoryStore.getState().entries,
    chainRunState: useChainRunStore.getState().runState,
  };
}

/** The production access, backed by the live Zustand stores. */
export function createZustandStoreAccess(): StoreAccess {
  return createStoreAccess(readZustandSource);
}

const EMPTY_SOURCE: StoreSource = {
  collections: [],
  folders: [],
  requests: [],
  environments: [],
  chains: [],
  activeEnvironmentId: null,
  tabs: [],
  activeTabId: null,
  responses: {},
  history: [],
  chainRunState: {},
};

/** In-memory access for tests; `state` can be mutated between calls. */
export function createFakeStoreAccess(seed: Partial<StoreSource> = {}): {
  access: StoreAccess;
  state: StoreSource;
} {
  const state: StoreSource = { ...EMPTY_SOURCE, ...seed };
  return { access: createStoreAccess(() => state), state };
}
