import type { StateCreator } from "zustand";
import type { ChainConfigSlice, ChainStore } from "./chainStoreUtils";
import { getOrCreateConfig, persistConfig } from "./chainStoreUtils";

export const createChainConfigSlice: StateCreator<
  ChainStore,
  [],
  [],
  ChainConfigSlice
> = (set) => ({
  upsertNodeAssertions(collectionId, requestId, assertions) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        nodeAssertions: {
          ...(config.nodeAssertions ?? {}),
          [requestId]: assertions,
        },
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  deleteNodeAssertions(collectionId, requestId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const nodeAssertions = { ...(config.nodeAssertions ?? {}) };
      delete nodeAssertions[requestId];
      const updated = { ...config, nodeAssertions };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  upsertDelayNode(collectionId, node) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const existing = config.delayNodes ?? [];
      const idx = existing.findIndex((n) => n.id === node.id);
      const delayNodes =
        idx >= 0
          ? existing.map((n) => (n.id === node.id ? node : n))
          : [...existing, node];
      const updated = { ...config, delayNodes };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  removeDelayNode(collectionId, nodeId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        delayNodes: (config.delayNodes ?? []).filter((n) => n.id !== nodeId),
        edges: config.edges.filter(
          (e) => e.sourceRequestId !== nodeId && e.targetRequestId !== nodeId,
        ),
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  upsertConditionNode(collectionId, node) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const existing = config.conditionNodes ?? [];
      const idx = existing.findIndex((n) => n.id === node.id);
      const conditionNodes =
        idx >= 0
          ? existing.map((n) => (n.id === node.id ? node : n))
          : [...existing, node];
      const updated = { ...config, conditionNodes };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  removeConditionNode(collectionId, nodeId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        conditionNodes: (config.conditionNodes ?? []).filter(
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

  upsertDisplayNode(collectionId, node) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const existing = config.displayNodes ?? [];
      const idx = existing.findIndex((n) => n.id === node.id);
      const displayNodes =
        idx >= 0
          ? existing.map((n) => (n.id === node.id ? node : n))
          : [...existing, node];
      const updated = { ...config, displayNodes };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  removeDisplayNode(collectionId, nodeId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        displayNodes: (config.displayNodes ?? []).filter(
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

  upsertEnvPromotion(collectionId, promotion) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const existing = config.envPromotions ?? [];
      const idx = existing.findIndex((p) => p.edgeId === promotion.edgeId);
      const envPromotions =
        idx >= 0
          ? existing.map((p) => (p.edgeId === promotion.edgeId ? promotion : p))
          : [...existing, promotion];
      const updated = { ...config, envPromotions };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },

  deleteEnvPromotion(collectionId, edgeId) {
    set((state) => {
      const config = getOrCreateConfig(state.configs, collectionId);
      const updated = {
        ...config,
        envPromotions: (config.envPromotions ?? []).filter(
          (p) => p.edgeId !== edgeId,
        ),
      };
      persistConfig(updated);
      return { configs: { ...state.configs, [collectionId]: updated } };
    });
  },
});
