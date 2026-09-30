"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { MigrationError, migrateChainsToV5 } from "@/lib/chainMigration";
import { getDB } from "@/lib/idb";
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

/** Trailing debounce window for per-chain IDB writes. */
const PERSIST_DEBOUNCE_MS = 150;

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

const chainHistory = createHistory<ChainHistorySnapshot>(HISTORY_LIMIT);

type ChainStoreState = {
  chains: Record<string, Chain>;
  hydrated: boolean;
  /** Per-chain undo/redo stacks — see `src/stores/chainHistory.ts`. */
  history: Record<string, ChainHistoryState<ChainHistorySnapshot>>;
};

type ChainStoreActions = {
  hydrate: () => Promise<void>;
  ensureCollectionChain: (collectionId: string, name: string) => void;
  createChain: (name: string) => string;
  renameChain: (chainId: string, name: string) => void;
  deleteChain: (chainId: string) => void;
  addRequestNode: (chainId: string, requestId: string) => void;
  removeNode: (chainId: string, nodeId: string) => void;
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
  /**
   * True when chain `id`'s subchain-reference graph contains a cycle —
   * either a direct self-reference (a subchain block on `id` whose
   * `chainId` is `id` itself) or a transitive one (`id` reaches a chain
   * that, through its own subchain blocks, reaches back to `id`).
   * Config-time check only; walks the in-memory `chains` map (already
   * hydrated), so it never needs the async IDB path.
   */
  detectSubchainCycle: (id: string) => boolean;
};

export type ChainStore = ChainStoreState & ChainStoreActions;

// ── Persistence — debounced per chain id, trailing 150ms ───────────────────

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingChains = new Map<string, Chain>();

async function writeChain(chain: Chain): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("chains", chain);
  } catch (error) {
    toast.error("Failed to save chain", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
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
    toast.error("Failed to delete chain", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function createEmptyChain(id: string, scope: ChainScope, name: string): Chain {
  return {
    id,
    scope,
    schemaVersion: 5,
    collectionId: scope === "collection" ? id : undefined,
    name,
    createdAt: Date.now(),
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
  };
}

function getOrCreateChain(
  chains: Record<string, Chain>,
  chainId: string,
): Chain {
  return chains[chainId] ?? createEmptyChain(chainId, "standalone", "");
}

/** Every node id a chain exposes to the canvas: request ids plus non-request block ids. */
export function allNodeIds(chain: Chain): string[] {
  return [...chain.nodeIds, ...chain.blocks.map((b) => b.id)];
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
  history: Record<string, ChainHistoryState<ChainHistorySnapshot>>,
  chainId: string,
  prevChain: Chain,
): Record<string, ChainHistoryState<ChainHistorySnapshot>> {
  if (chainHistory.isPaused(chainId)) return history;
  const existing =
    history[chainId] ?? emptyChainHistory<ChainHistorySnapshot>();
  return {
    ...history,
    [chainId]: chainHistory.push(existing, snapshotOf(prevChain)),
  };
}

export const useChainStore = create<ChainStore>()((set, get) => ({
  chains: {},
  hydrated: false,
  history: {},

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
        if (error instanceof MigrationError) throw error;
        toast.error("Failed to migrate chains", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
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
      set({ chains: map, hydrated: true });
    } catch (error) {
      toast.error("Failed to load chains", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
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
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const updated = { ...chain, name };
      persistChain(updated);
      return { chains: { ...state.chains, [chainId]: updated } };
    });
  },

  deleteChain(chainId) {
    set((state) => {
      const updated = { ...state.chains };
      delete updated[chainId];
      return { chains: updated };
    });
    pendingTimers.delete(chainId);
    pendingChains.delete(chainId);
    void deleteChainFromDB(chainId);
    void useChainRunStore.getState().handleChainDeleted(chainId);
  },

  addRequestNode(chainId, requestId) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      if (chain.nodeIds.includes(requestId)) return state;
      const updated = { ...chain, nodeIds: [...chain.nodeIds, requestId] };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  removeNode(chainId, nodeId) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const blockToRemove = chain.blocks.find((b) => b.id === nodeId);

      // Determine all nodes to remove (cascade: Loop → Collect)
      const nodesToRemove = new Set([nodeId]);
      if (blockToRemove?.type === "loop") {
        // Also remove the paired Collect
        const pairedCollect = chain.blocks.find(
          (b): b is CollectBlock => b.type === "collect" && b.loopId === nodeId,
        );
        if (pairedCollect) {
          nodesToRemove.add(pairedCollect.id);
        }
      }

      const removedEdgeIds = new Set(
        chain.edges
          .filter(
            (e) =>
              nodesToRemove.has(e.sourceRequestId) ||
              nodesToRemove.has(e.targetRequestId),
          )
          .map((e) => e.id),
      );

      const nodePositions = { ...chain.nodePositions };
      const nodeAssertions = chain.nodeAssertions
        ? { ...chain.nodeAssertions }
        : undefined;

      for (const id of nodesToRemove) {
        delete nodePositions[id];
        if (nodeAssertions) delete nodeAssertions[id];
      }

      const updated: Chain = {
        ...chain,
        nodeIds: chain.nodeIds.filter((id) => !nodesToRemove.has(id)),
        blocks: chain.blocks.filter((b) => !nodesToRemove.has(b.id)),
        edges: chain.edges.filter((e) => !removedEdgeIds.has(e.id)),
        nodePositions,
        nodeAssertions,
        envPromotions: chain.envPromotions?.filter(
          (p) => !removedEdgeIds.has(p.edgeId),
        ),
      };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  duplicateNode(chainId, blockId) {
    const chain = get().chains[chainId];
    const source = chain?.blocks.find((b) => b.id === blockId);
    if (!chain || !source) return null;
    if (source.type === "start") {
      toast.error("Only one Start block is allowed per chain");
      return null;
    }

    const newId = generateId();
    const duplicate = { ...source, id: newId } as ChainBlock;
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

    set((state) => {
      const current = getOrCreateChain(state.chains, chainId);
      const updated = {
        ...current,
        blocks: [...current.blocks, ...blocksToAdd],
      };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, current),
      };
    });
    return newId;
  },

  upsertBlock(chainId, block) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const idx = chain.blocks.findIndex((b) => b.id === block.id);
      const isNewStart = idx < 0 && block.type === "start";
      if (isNewStart && hasStartBlock(chain)) {
        toast.error("Only one Start block is allowed per chain");
        return state;
      }
      const blocks =
        idx >= 0
          ? chain.blocks.map((b) => (b.id === block.id ? block : b))
          : [...chain.blocks, block];
      const updated = { ...chain, blocks };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  upsertEdge(chainId, edge) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const idx = chain.edges.findIndex((e) => e.id === edge.id);
      const edges =
        idx >= 0
          ? chain.edges.map((e) => (e.id === edge.id ? edge : e))
          : [...chain.edges, edge];
      const updated = { ...chain, edges };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  deleteEdge(chainId, edgeId) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const updated = {
        ...chain,
        edges: chain.edges.filter((e) => e.id !== edgeId),
        envPromotions: chain.envPromotions?.filter((p) => p.edgeId !== edgeId),
      };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  clearEdges(chainId) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const updated = { ...chain, edges: [] };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  updateNodePosition(chainId, nodeId, pos) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const updated = {
        ...chain,
        nodePositions: { ...chain.nodePositions, [nodeId]: pos },
      };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  upsertNodeAssertions(chainId, nodeId, assertions) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const updated = {
        ...chain,
        nodeAssertions: {
          ...(chain.nodeAssertions ?? {}),
          [nodeId]: assertions,
        },
      };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  deleteNodeAssertions(chainId, nodeId) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const nodeAssertions = { ...(chain.nodeAssertions ?? {}) };
      delete nodeAssertions[nodeId];
      const updated = { ...chain, nodeAssertions };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  upsertEnvPromotion(chainId, promotion) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const existing = chain.envPromotions ?? [];
      const idx = existing.findIndex((p) => p.edgeId === promotion.edgeId);
      const envPromotions =
        idx >= 0
          ? existing.map((p) => (p.edgeId === promotion.edgeId ? promotion : p))
          : [...existing, promotion];
      const updated = { ...chain, envPromotions };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  deleteEnvPromotion(chainId, edgeId) {
    set((state) => {
      const chain = getOrCreateChain(state.chains, chainId);
      const updated = {
        ...chain,
        envPromotions: (chain.envPromotions ?? []).filter(
          (p) => p.edgeId !== edgeId,
        ),
      };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: recordHistory(state.history, chainId, chain),
      };
    });
  },

  pauseHistory(chainId) {
    const chain = get().chains[chainId];
    if (!chain) return;
    chainHistory.pause(chainId, snapshotOf(chain));
  },

  resumeHistory(chainId) {
    const snapshot = chainHistory.resume(chainId);
    if (!snapshot) return;
    set((state) => {
      const existing =
        state.history[chainId] ?? emptyChainHistory<ChainHistorySnapshot>();
      return {
        history: {
          ...state.history,
          [chainId]: chainHistory.push(existing, snapshot),
        },
      };
    });
    void persistChain.flush(chainId);
  },

  undo(chainId) {
    set((state) => {
      const history = state.history[chainId];
      const chain = state.chains[chainId];
      if (!history || !chain) return state;
      const result = chainHistory.undo(history, snapshotOf(chain));
      if (!result) return state;
      const updated = { ...chain, ...result.snapshot };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: { ...state.history, [chainId]: result.history },
      };
    });
    void persistChain.flush(chainId);
  },

  redo(chainId) {
    set((state) => {
      const history = state.history[chainId];
      const chain = state.chains[chainId];
      if (!history || !chain) return state;
      const result = chainHistory.redo(history, snapshotOf(chain));
      if (!result) return state;
      const updated = { ...chain, ...result.snapshot };
      persistChain(updated);
      return {
        chains: { ...state.chains, [chainId]: updated },
        history: { ...state.history, [chainId]: result.history },
      };
    });
    void persistChain.flush(chainId);
  },

  detectSubchainCycle(id) {
    const chains = get().chains;
    const visited = new Set<string>();

    const walk = (chainId: string): boolean => {
      if (chainId === id && visited.size > 0) return true;
      if (visited.has(chainId)) return false;
      visited.add(chainId);

      const chain = chains[chainId];
      if (!chain) return false;

      for (const block of chain.blocks) {
        if (block.type !== "subchain") continue;
        if (walk(block.chainId)) return true;
      }
      return false;
    };

    return walk(id);
  },
}));
