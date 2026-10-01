"use client";

import { create } from "zustand";
import { MigrationError, migrateChainsToV5 } from "@/lib/chainMigration";
import { listNamespaceProducers } from "@/lib/chainValueNamespace";
import { getDB } from "@/lib/idb";
import { toastStoreError } from "@/lib/storeToast";
import { generateId } from "@/lib/utils";
import {
  type ChainHistoryState,
  createHistory,
  emptyChainHistory,
} from "@/stores/chainHistory";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type {
  Chain,
  ChainAssertion,
  ChainBlock,
  ChainEdge,
  ChainScope,
  CollectBlock,
  EnvPromotion,
} from "@/types/chain";
import { CHAIN_SCHEMA_VERSION } from "@/types/chain";

/** Trailing debounce window for per-chain IDB writes. */
const PERSIST_DEBOUNCE_MS = 150;

/** Edits to the same target closer together than this share one undo entry (typing in a field). */
const UNDO_COALESCE_WINDOW_MS = 1000;

/** Max undo/redo entries retained per chain. */
const HISTORY_LIMIT = 100;

/** The undoable slice of a chain's graph — everything else (id, scope, timestamps…) is excluded. */
type ChainHistorySnapshot = Pick<
  Chain,
  | "blocks"
  | "nodeIds"
  | "edges"
  | "nodePositions"
  | "nodeAssertions"
  | "envPromotions"
  | "name"
>;

function snapshotOf(chain: Chain): ChainHistorySnapshot {
  return {
    blocks: chain.blocks,
    nodeIds: chain.nodeIds,
    edges: chain.edges,
    nodePositions: chain.nodePositions,
    nodeAssertions: chain.nodeAssertions,
    envPromotions: chain.envPromotions,
    name: chain.name,
  };
}

// Pure bounded push/undo/redo helpers; paused batches live in store `pausedHistory`.
const chainHistory = createHistory<ChainHistorySnapshot>(HISTORY_LIMIT);

type HistoryKind = "undo" | "redo";

type ChainStoreState = {
  chains: Record<string, Chain>;
  hydrated: boolean;
  /** Per-chain undo/redo stacks — see `src/stores/chainHistory.ts`. */
  history: Record<string, ChainHistoryState<ChainHistorySnapshot>>;
  /** Pre-batch snapshots for chains whose history recording is paused (e.g. mid-drag). */
  pausedHistory: Record<string, ChainHistorySnapshot>;
};

type ChainStoreActions = {
  hydrate: () => Promise<void>;
  ensureCollectionChain: (collectionId: string, name: string) => void;
  createChain: (name: string) => string;
  renameChain: (chainId: string, name: string) => void;
  deleteChain: (chainId: string) => void;
  addRequestNode: (chainId: string, requestId: string) => void;
  removeNode: (chainId: string, nodeId: string) => void;
  /** Removes several blocks as ONE undo entry (multi-select delete). */
  removeNodes: (chainId: string, nodeIds: string[]) => void;
  duplicateNode: (chainId: string, blockId: string) => string | null;
  upsertBlock: (chainId: string, block: ChainBlock) => void;
  upsertEdge: (chainId: string, edge: ChainEdge) => void;
  deleteEdge: (chainId: string, edgeId: string) => void;
  clearEdges: (chainId: string) => void;
  updateNodePosition: (
    chainId: string,
    nodeId: string,
    pos: { x: number; y: number },
  ) => void;
  upsertNodeAssertions: (
    chainId: string,
    nodeId: string,
    assertions: ChainAssertion[],
  ) => void;
  deleteNodeAssertions: (chainId: string, nodeId: string) => void;
  upsertEnvPromotion: (chainId: string, promotion: EnvPromotion) => void;
  deleteEnvPromotion: (chainId: string, edgeId: string) => void;
  /** Pauses history recording for `chainId`, capturing the pre-batch snapshot once (e.g. drag start). */
  pauseHistory: (chainId: string) => void;
  /** Resumes history recording for `chainId`, committing the batch as a single history entry (e.g. drag stop). */
  resumeHistory: (chainId: string) => void;
  /** Reverts `chainId` to its previous history entry, if any. */
  undo: (chainId: string) => void;
  /** Re-applies the most recently undone history entry for `chainId`, if any. */
  redo: (chainId: string) => void;
};

export type ChainStore = ChainStoreState & ChainStoreActions;

// ── Persistence — debounced per chain id, trailing 150ms ───────────────────

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingChains = new Map<string, Chain>();

type PersistOp = "save" | "delete" | "load" | "migrate";

/** Toasts carry no chain context, so the console record is what makes a failure diagnosable. */
function reportPersistenceError(
  op: PersistOp,
  error: unknown,
  chainId?: string,
): void {
  console.error(`[chain] ${op} failed`, { chainId, op, error });
}

async function writeChain(chain: Chain): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("chains", chain);
  } catch (error) {
    reportPersistenceError("save", error, chain.id);
    toastStoreError("saveChainFailed", { cause: error });
  }
}

async function flushChain(chainId: string): Promise<void> {
  const timer = pendingTimers.get(chainId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(chainId);
  }
  const chain = pendingChains.get(chainId);
  pendingChains.delete(chainId);
  if (chain) await writeChain(chain);
}

/** Debounced per-chain persistence; call `.flush(chainId?)` to force an immediate write. */
function persistChain(chain: Chain): void {
  pendingChains.set(chain.id, chain);
  const existing = pendingTimers.get(chain.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingTimers.delete(chain.id);
    void flushChain(chain.id);
  }, PERSIST_DEBOUNCE_MS);
  pendingTimers.set(chain.id, timer);
}

persistChain.flush = async function flush(chainId?: string): Promise<void> {
  if (chainId) {
    await flushChain(chainId);
    return;
  }
  const ids = Array.from(pendingChains.keys());
  await Promise.all(ids.map((id) => flushChain(id)));
};

export { persistChain };

async function deleteChainFromDB(chainId: string): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("chains", chainId);
  } catch (error) {
    reportPersistenceError("delete", error, chainId);
    toastStoreError("deleteChainFailed", { cause: error });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Replaces the item sharing `item.id`, or appends it when absent. */
function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];
}

const DUPLICATE_ALIAS_SUFFIX = "_copy";

/**
 * `alias` made unique against every name the chain already publishes:
 * `result` -> `result_copy` -> `result_copy2`. Blank stays blank (half-edited).
 */
function uniqueDuplicateAlias(chain: Chain, alias: string): string {
  if (alias.trim() === "") return alias;
  const taken = new Set(
    listNamespaceProducers(chain.blocks, chain.edges).map((p) => p.name),
  );
  let candidate = `${alias}${DUPLICATE_ALIAS_SUFFIX}`;
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${alias}${DUPLICATE_ALIAS_SUFFIX}${n}`;
  }
  return candidate;
}

/**
 * A duplicate must not republish its source's name, or the last block to run
 * silently wins. Display `targetKey` is deliberately left alone: it names a
 * real header/param/body path, so renaming it would change what gets injected.
 */
function duplicateBlock(
  chain: Chain,
  source: ChainBlock,
  id: string,
): ChainBlock {
  switch (source.type) {
    case "collect":
      // The runner pairs by `.find`, so a copy sharing the original's `loopId` would shadow or be shadowed.
      return { ...source, id, loopId: "" };
    case "evaluate":
      return {
        ...source,
        id,
        outputAlias: uniqueDuplicateAlias(chain, source.outputAlias),
      };
    case "loop":
      return {
        ...source,
        id,
        itemAlias: uniqueDuplicateAlias(chain, source.itemAlias),
      };
    default:
      return { ...source, id };
  }
}

function createEmptyChain(id: string, scope: ChainScope, name: string): Chain {
  return {
    id,
    scope,
    schemaVersion: CHAIN_SCHEMA_VERSION,
    collectionId: scope === "collection" ? id : undefined,
    name,
    createdAt: Date.now(),
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
  };
}

/** Resolves a node id to its block, if it is a non-request block (delay/condition/display/history). */
export function getNode(chain: Chain, id: string): ChainBlock | undefined {
  return chain.blocks.find((b) => b.id === id);
}

/**
 * Single source of truth for "a chain has at most one Start block" — every
 * insertion path (block menu, duplicate, ghost placement) must route
 * through `upsertBlock`/`duplicateNode` below rather than re-checking this
 * independently.
 */
export function hasStartBlock(chain: Chain): boolean {
  return chain.blocks.some((b) => b.type === "start");
}

/**
 * Records `prevChain`'s undoable slice as the history entry to restore to on
 * undo, unless `chainId` is currently paused (a drag batch in progress) —
 * in that case the pause already captured the right pre-batch snapshot and
 * per-mutation recording is skipped so the whole batch is one history entry.
 */
function recordHistory(
  state: ChainStoreState,
  chainId: string,
  prevChain: Chain,
): ChainStoreState["history"] {
  if (chainId in state.pausedHistory) return state.history;
  const existing =
    state.history[chainId] ?? emptyChainHistory<ChainHistorySnapshot>();
  return {
    ...state.history,
    [chainId]: chainHistory.push(existing, snapshotOf(prevChain)),
  };
}

type MutateChainOptions = {
  /** Set false for changes that must not create an undo entry. Defaults to true. */
  recordHistory?: boolean;
};

type CommitOptions = MutateChainOptions & {
  /** Rapid repeat commits sharing a key fold into the first one's undo entry. */
  coalesceKey?: string;
};

let lastCoalesced: { key: string; at: number } | null = null;

/**
 * True when `key` repeats the previous commit inside the window. Any commit
 * without a key (or with a different one) breaks the run, so coalescing never
 * swallows an entry that interleaves with another kind of edit.
 */
function continuesCoalescedRun(key: string | undefined): boolean {
  const now = Date.now();
  const continues =
    key !== undefined &&
    lastCoalesced?.key === key &&
    now - lastCoalesced.at < UNDO_COALESCE_WINDOW_MS;
  lastCoalesced = key === undefined ? null : { key, at: now };
  return continues;
}

/**
 * Pure state transition: applies `fn` to an EXISTING chain. Returns `state`
 * unchanged for a missing chain (only `createChain`/`ensureCollectionChain`
 * may create one) or when `fn` returns the chain it was given (a no-op).
 * Side effects (persistence, toasts) are the caller's job, after `set`.
 */
export function mutateChain<S extends ChainStoreState>(
  state: S,
  chainId: string,
  fn: (chain: Chain) => Chain,
  { recordHistory: shouldRecord = true }: MutateChainOptions = {},
): S {
  const chain = state.chains[chainId];
  if (!chain) return state;
  const updated = fn(chain);
  if (updated === chain) return state;
  return {
    ...state,
    chains: { ...state.chains, [chainId]: updated },
    history: shouldRecord
      ? recordHistory(state, chainId, chain)
      : state.history,
  };
}

function keepHistoryForUnchangedChains(
  state: Pick<ChainStoreState, "chains" | "history">,
  loaded: Record<string, Chain>,
): ChainStoreState["history"] {
  const kept: ChainStoreState["history"] = {};
  for (const [id, entry] of Object.entries(state.history)) {
    const inMemory = state.chains[id];
    const persisted = loaded[id];
    if (!inMemory || !persisted) continue;
    if (
      JSON.stringify(snapshotOf(inMemory)) ===
      JSON.stringify(snapshotOf(persisted))
    ) {
      kept[id] = entry;
    }
  }
  return kept;
}

/** `nodeIds` plus a Loop's paired Collect — removing a Loop must take its Collect too. */
function expandWithPairedCollects(
  chain: Chain,
  nodeIds: string[],
): Set<string> {
  const expanded = new Set(nodeIds);
  for (const id of nodeIds) {
    const block = chain.blocks.find((b) => b.id === id);
    if (block?.type !== "loop") continue;
    const pairedCollect = chain.blocks.find(
      (b): b is CollectBlock => b.type === "collect" && b.loopId === id,
    );
    if (pairedCollect) expanded.add(pairedCollect.id);
  }
  return expanded;
}

function omitKeys<T>(record: Record<string, T>, keys: Set<string>) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !keys.has(key)),
  );
}

/**
 * Pure removal of `nodeIds` (plus cascade: a Loop takes its paired Collect)
 * and every edge, position, assertion and promotion that referenced them.
 */
function withoutNodes(chain: Chain, nodeIds: string[]): Chain {
  const removed = expandWithPairedCollects(chain, nodeIds);
  const removedEdgeIds = new Set(
    chain.edges
      .filter(
        (e) => removed.has(e.sourceRequestId) || removed.has(e.targetRequestId),
      )
      .map((e) => e.id),
  );

  return {
    ...chain,
    nodeIds: chain.nodeIds.filter((id) => !removed.has(id)),
    blocks: chain.blocks.filter((b) => !removed.has(b.id)),
    edges: chain.edges.filter((e) => !removedEdgeIds.has(e.id)),
    nodePositions: omitKeys(chain.nodePositions, removed),
    nodeAssertions: chain.nodeAssertions
      ? omitKeys(chain.nodeAssertions, removed)
      : undefined,
    envPromotions: chain.envPromotions?.filter(
      (p) => !removedEdgeIds.has(p.edgeId),
    ),
  };
}

/**
 * Applies `fn` to an existing chain, then persists the result. Persistence
 * runs after `set` returns so updaters stay pure (they may be re-run).
 */
function commitMutation(
  chainId: string,
  fn: (chain: Chain) => Chain,
  { coalesceKey, ...options }: CommitOptions = {},
): void {
  const coalesced = continuesCoalescedRun(coalesceKey);
  const before = useChainStore.getState().chains[chainId];
  useChainStore.setState((state) =>
    mutateChain(state, chainId, fn, {
      recordHistory: options.recordHistory !== false && !coalesced,
    }),
  );
  const after = useChainStore.getState().chains[chainId];
  if (after && after !== before) persistChain(after);
}

/** Shared undo/redo body; the two directions differ only in which history op runs. */
function applyHistoryStep(chainId: string, kind: HistoryKind): void {
  // After undo/redo the next edit must open a fresh entry, not fold into a pre-undo run.
  lastCoalesced = null;
  const before = useChainStore.getState().chains[chainId];
  useChainStore.setState((state) => {
    const history = state.history[chainId];
    const chain = state.chains[chainId];
    if (!history || !chain) return state;
    const result = chainHistory[kind](history, snapshotOf(chain));
    if (!result) return state;
    return {
      ...state,
      chains: { ...state.chains, [chainId]: { ...chain, ...result.snapshot } },
      history: { ...state.history, [chainId]: result.history },
    };
  });
  const after = useChainStore.getState().chains[chainId];
  if (after && after !== before) persistChain(after);
  void persistChain.flush(chainId);
}

export const useChainStore = create<ChainStore>()((set, get) => ({
  chains: {},
  hydrated: false,
  history: {},
  pausedHistory: {},

  async hydrate() {
    // Snapshot the chains map reference. If a user action (e.g. createChain)
    // mutates the store while this async hydration is in flight, `chains`
    // will be a new object and we must not clobber that newer state with
    // whatever was last persisted to IDB.
    const chainsBeforeHydration = get().chains;
    // Note: unlike the very first hydration (where `hydrated` starts false so
    // consumers can gate their initial render), we deliberately do NOT flip
    // `hydrated` back to false here on a re-hydrate. The chain-page mounts on
    // every navigation into `/chain/[id]` and always re-calls hydrate() to
    // pick up any out-of-band IDB changes — the sidebar's ChainList, however,
    // stays mounted across that navigation (it lives in the root layout), so
    // resetting `hydrated` would make an already-rendered chain list vanish
    // for the duration of a redundant re-fetch.
    const db = getDB();
    if (!db) {
      set({ hydrated: true });
      return;
    }
    // Flush any debounced in-flight writes before reading from IDB — otherwise
    // a chain created/edited just before this hydrate() call (e.g. navigating
    // straight into the chain page after creation) can still be sitting in the
    // 150ms debounce buffer, and the getAll() below would silently clobber it.
    await persistChain.flush();
    const instance = await db;

    if (!useSettingsStore.getState().chainMigrationV5) {
      try {
        const allCollections = await instance.getAll("collections");
        const collectionNames = new Map(
          allCollections.map((c) => [c.id, c.name]),
        );
        await migrateChainsToV5(instance, collectionNames);
        useSettingsStore.getState().setSetting("chainMigrationV5", true);
      } catch (error) {
        set({ hydrated: true });
        reportPersistenceError("migrate", error);
        if (error instanceof MigrationError) throw error;
        toastStoreError("migrateChainsFailed", { cause: error });
        return;
      }
    }

    try {
      const all = await instance.getAll("chains");
      if (get().chains !== chainsBeforeHydration) {
        set({ hydrated: true });
        return;
      }
      const map: Record<string, Chain> = {};
      for (const chain of all) map[chain.id] = chain;
      // Undo stacks only stay valid for chains whose persisted content still
      // matches memory; out-of-band changes (or deletions) invalidate them.
      set((state) => ({
        chains: map,
        hydrated: true,
        history: keepHistoryForUnchangedChains(state, map),
      }));
    } catch (error) {
      reportPersistenceError("load", error);
      toastStoreError("loadChainsFailed", { cause: error });
      set({ hydrated: true });
    }
  },

  ensureCollectionChain(collectionId, name) {
    const existing = get().chains[collectionId];
    if (existing) return;
    const chain = createEmptyChain(collectionId, "collection", name);
    set((state) => ({
      chains: { ...state.chains, [collectionId]: chain },
    }));
    persistChain(chain);
  },

  createChain(name) {
    const id = generateId();
    const chain = createEmptyChain(id, "standalone", name);
    set((state) => ({ chains: { ...state.chains, [id]: chain } }));
    persistChain(chain);
    return id;
  },

  renameChain(chainId, name) {
    // `name` is part of the undo snapshot (spec), so a rename must be
    // recorded or a later undo would silently revert it.
    commitMutation(chainId, (chain) => ({ ...chain, name }));
  },

  deleteChain(chainId) {
    // Drop the paused-batch snapshot and undo stacks too; otherwise they leak
    // and an undo could resurrect edits for a deleted chain.
    set((state) => {
      const { [chainId]: _chain, ...chains } = state.chains;
      const { [chainId]: _history, ...history } = state.history;
      const { [chainId]: _paused, ...pausedHistory } = state.pausedHistory;
      return { chains, history, pausedHistory };
    });
    pendingTimers.delete(chainId);
    pendingChains.delete(chainId);
    void deleteChainFromDB(chainId);
    void useChainRunStore.getState().handleChainDeleted(chainId);
  },

  addRequestNode(chainId, requestId) {
    commitMutation(chainId, (chain) =>
      chain.nodeIds.includes(requestId)
        ? chain
        : { ...chain, nodeIds: [...chain.nodeIds, requestId] },
    );
  },

  removeNode(chainId, nodeId) {
    get().removeNodes(chainId, [nodeId]);
  },

  removeNodes(chainId, nodeIds) {
    if (nodeIds.length === 0) return;
    commitMutation(chainId, (chain) => withoutNodes(chain, nodeIds));
  },

  duplicateNode(chainId, blockId) {
    const chain = get().chains[chainId];
    const source = chain?.blocks.find((b) => b.id === blockId);
    if (!chain || !source) return null;
    if (source.type === "start") {
      toastStoreError("startBlockLimit");
      return null;
    }

    const newId = generateId();
    const duplicate = duplicateBlock(chain, source, newId);
    const blocksToAdd = [duplicate];

    // Cascade: duplicating a Loop also duplicates its paired Collect
    if (source.type === "loop") {
      const pairedCollect = chain.blocks.find(
        (b): b is CollectBlock => b.type === "collect" && b.loopId === blockId,
      );
      if (pairedCollect) {
        const newCollectId = generateId();
        const duplicateCollect: CollectBlock = {
          ...pairedCollect,
          id: newCollectId,
          loopId: newId, // Rebind to new Loop
        };
        blocksToAdd.push(duplicateCollect);
      }
    }

    commitMutation(chainId, (current) => ({
      ...current,
      blocks: [...current.blocks, ...blocksToAdd],
    }));
    return newId;
  },

  upsertBlock(chainId, block) {
    const chain = get().chains[chainId];
    if (!chain) return;
    const isNewStart =
      block.type === "start" && !chain.blocks.some((b) => b.id === block.id);
    if (isNewStart && hasStartBlock(chain)) {
      toastStoreError("startBlockLimit");
      return;
    }
    commitMutation(chainId, (current) => ({
      ...current,
      blocks: upsertById(current.blocks, block),
    }));
  },

  upsertEdge(chainId, edge) {
    commitMutation(chainId, (chain) => ({
      ...chain,
      edges: upsertById(chain.edges, edge),
    }));
  },

  deleteEdge(chainId, edgeId) {
    commitMutation(chainId, (chain) => ({
      ...chain,
      edges: chain.edges.filter((e) => e.id !== edgeId),
      envPromotions: chain.envPromotions?.filter((p) => p.edgeId !== edgeId),
    }));
  },

  clearEdges(chainId) {
    commitMutation(chainId, (chain) => ({ ...chain, edges: [] }));
  },

  updateNodePosition(chainId, nodeId, pos) {
    commitMutation(chainId, (chain) => ({
      ...chain,
      nodePositions: { ...chain.nodePositions, [nodeId]: pos },
    }));
  },

  upsertNodeAssertions(chainId, nodeId, assertions) {
    commitMutation(
      chainId,
      (chain) => ({
        ...chain,
        nodeAssertions: {
          ...(chain.nodeAssertions ?? {}),
          [nodeId]: assertions,
        },
      }),
      { coalesceKey: `assertions:${chainId}:${nodeId}` },
    );
  },

  deleteNodeAssertions(chainId, nodeId) {
    commitMutation(chainId, (chain) => {
      const nodeAssertions = { ...(chain.nodeAssertions ?? {}) };
      delete nodeAssertions[nodeId];
      return { ...chain, nodeAssertions };
    });
  },

  upsertEnvPromotion(chainId, promotion) {
    commitMutation(chainId, (chain) => {
      const existing = chain.envPromotions ?? [];
      const idx = existing.findIndex((p) => p.edgeId === promotion.edgeId);
      const envPromotions =
        idx >= 0
          ? existing.map((p) => (p.edgeId === promotion.edgeId ? promotion : p))
          : [...existing, promotion];
      return { ...chain, envPromotions };
    });
  },

  deleteEnvPromotion(chainId, edgeId) {
    commitMutation(chainId, (chain) => ({
      ...chain,
      envPromotions: (chain.envPromotions ?? []).filter(
        (p) => p.edgeId !== edgeId,
      ),
    }));
  },

  pauseHistory(chainId) {
    set((state) => {
      const chain = state.chains[chainId];
      // Capture once per batch: a second pause must keep the original snapshot.
      if (!chain || chainId in state.pausedHistory) return state;
      return {
        pausedHistory: { ...state.pausedHistory, [chainId]: snapshotOf(chain) },
      };
    });
  },

  resumeHistory(chainId) {
    const snapshot = get().pausedHistory[chainId];
    if (!snapshot) return;
    set((state) => {
      const { [chainId]: _paused, ...pausedHistory } = state.pausedHistory;
      const existing =
        state.history[chainId] ?? emptyChainHistory<ChainHistorySnapshot>();
      return {
        pausedHistory,
        history: {
          ...state.history,
          [chainId]: chainHistory.push(existing, snapshot),
        },
      };
    });
    void persistChain.flush(chainId);
  },

  undo(chainId) {
    applyHistoryStep(chainId, "undo");
  },

  redo(chainId) {
    applyHistoryStep(chainId, "redo");
  },
}));
