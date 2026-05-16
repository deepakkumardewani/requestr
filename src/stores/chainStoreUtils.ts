import { toast } from "sonner";
import { getDB } from "@/lib/idb";
import type {
  ChainAssertion,
  ChainConfig,
  ChainEdge,
  ChainHistoryNode,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayNodeConfig,
  EnvPromotion,
} from "@/types/chain";

// ── Slice type declarations ────────────────────────────────────────────────

export type ChainGraphSlice = {
  configs: Record<string, ChainConfig>;
  loadConfig: (collectionId: string) => Promise<void>;
  upsertEdge: (collectionId: string, edge: ChainEdge) => void;
  deleteEdge: (collectionId: string, edgeId: string) => void;
  updateNodePosition: (
    collectionId: string,
    requestId: string,
    pos: { x: number; y: number },
  ) => void;
  clearEdges: (collectionId: string) => void;
  /** One-time migration: sets nodeIds only when undefined. No-op if already set. */
  initNodeIds: (collectionId: string, requestIds: string[]) => void;
  addNode: (collectionId: string, requestId: string) => void;
  removeNode: (collectionId: string, requestId: string) => void;
  addHistoryNode: (collectionId: string, node: ChainHistoryNode) => void;
  updateHistoryNode: (
    collectionId: string,
    nodeId: string,
    patch: Partial<ChainHistoryNode>,
  ) => void;
  removeHistoryNode: (collectionId: string, nodeId: string) => void;
};

export type ChainConfigSlice = {
  upsertNodeAssertions: (
    collectionId: string,
    requestId: string,
    assertions: ChainAssertion[],
  ) => void;
  deleteNodeAssertions: (collectionId: string, requestId: string) => void;
  upsertDelayNode: (collectionId: string, node: DelayNodeConfig) => void;
  removeDelayNode: (collectionId: string, nodeId: string) => void;
  upsertConditionNode: (
    collectionId: string,
    node: ConditionNodeConfig,
  ) => void;
  removeConditionNode: (collectionId: string, nodeId: string) => void;
  upsertDisplayNode: (collectionId: string, node: DisplayNodeConfig) => void;
  removeDisplayNode: (collectionId: string, nodeId: string) => void;
  upsertEnvPromotion: (collectionId: string, promotion: EnvPromotion) => void;
  deleteEnvPromotion: (collectionId: string, edgeId: string) => void;
};

/** Full combined store type — used by both slices as the StateCreator type param. */
export type ChainStore = ChainGraphSlice & ChainConfigSlice;

// ── Shared helpers ─────────────────────────────────────────────────────────

export function getOrCreateConfig(
  configs: Record<string, ChainConfig>,
  collectionId: string,
): ChainConfig {
  return (
    configs[collectionId] ?? {
      collectionId,
      edges: [],
      nodePositions: {},
    }
  );
}

export async function persistConfig(config: ChainConfig): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("chainConfigs", config);
  } catch (error) {
    toast.error("Failed to save chain config", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
