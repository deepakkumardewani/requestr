import { toast } from "sonner";
import type { StateCreator } from "zustand";
import { getDB } from "@/lib/idb";
import { migrateEdge } from "@/types/chain";
import type { ChainGraphSlice, ChainStore } from "./chainStoreUtils";
import { getOrCreateConfig, persistConfig } from "./chainStoreUtils";

export const createChainGraphSlice: StateCreator<
  ChainStore,
  [],
  [],
  ChainGraphSlice
> = (set) => ({
  configs: {},

  async loadConfig(collectionId) {
    const db = getDB();
    if (!db) return;
    try {
      const instance = await db;
      const config = await instance.get("chainConfigs", collectionId);
      if (config) {
        const migrated = {
          ...config,
          edges: (config.edges ?? []).map(migrateEdge),
        };
        set((state) => ({
          configs: { ...state.configs, [collectionId]: migrated },
        }));
      } else {
        set((state) => ({
          configs: {
            ...state.configs,
            [collectionId]: { collectionId, edges: [], nodePositions: {} },
          },
        }));
      }
    } catch (error) {
      toast.error("Failed to load chain config", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  upsertEdge(collectionId, edge) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const existingIdx = config.edges.findIndex((e) => e.id === edge.id);
      const edges =
        existingIdx >= 0
          ? config.edges.map((e) => (e.id === edge.id ? edge : e))
          : [...config.edges, edge];
      const updated = { ...config, edges };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  deleteEdge(collectionId, edgeId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        edges: config.edges.filter((e) => e.id !== edgeId),
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  updateNodePosition(collectionId, requestId, pos) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        nodePositions: { ...config.nodePositions, [requestId]: pos },
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  clearEdges(collectionId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = { ...config, edges: [] };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  initNodeIds(collectionId, requestIds) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      if (config.nodeIds !== undefined) return state;
      const updated = { ...config, nodeIds: requestIds };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  addNode(collectionId, requestId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const nodeIds = config.nodeIds ?? [];
      if (nodeIds.includes(requestId)) return state;
      const updated = { ...config, nodeIds: [...nodeIds, requestId] };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  removeNode(collectionId, requestId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        nodeIds: (config.nodeIds ?? []).filter((id) => id !== requestId),
        edges: config.edges.filter(
          (e) =>
            e.sourceRequestId !== requestId && e.targetRequestId !== requestId,
        ),
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  addHistoryNode(collectionId, node) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const historyNodes = config.historyNodes ?? [];
      const updated = { ...config, historyNodes: [...historyNodes, node] };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  updateHistoryNode(collectionId, nodeId, patch) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        historyNodes: (config.historyNodes ?? []).map((n) =>
          n.id === nodeId ? { ...n, ...patch } : n,
        ),
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  removeHistoryNode(collectionId, nodeId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        historyNodes: (config.historyNodes ?? []).filter(
          (n) => n.id !== nodeId,
        ),
        edges: config.edges.filter(
          (e) => e.sourceRequestId !== nodeId && e.targetRequestId !== nodeId,
        ),
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },
});
