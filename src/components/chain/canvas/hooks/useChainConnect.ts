import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import type { ChainEdge, ConditionNodeConfig } from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";
import {
  createsLoopNestingViolation,
  isValidChainConnection,
} from "./chainConnectionRules";
import { chainEdgeToFlowEdge } from "./useChainEdges";

// The pure rules live in `chainConnectionRules`; re-exported so existing
// importers (page, structure validation, specs) keep one stable entry point.
export {
  getInvalidMergeNodeIds,
  getMaxLoopNestingDepth,
  getUnpairedLoopNodeIds,
  getUnresolvedCollectNodeIds,
  hasLoopNestingViolation,
  isValidChainConnection,
} from "./chainConnectionRules";

type UseChainConnectParams = {
  /** Host chain — its blocks are read at connect time for the nesting-depth check. */
  chainId: string;
  chainEdges: ChainEdge[];
  conditionNodes: ConditionNodeConfig[];
  delayNodes: { id: string }[];
  displayNodes: { id: string }[];
  onUpsertEdge: (edge: ChainEdge) => void;
  onDeleteEdge: (id: string) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
};

type NodeIdSets = {
  conditionNodeIds: Set<string>;
  delayNodeIds: Set<string>;
  displayNodeIds: Set<string>;
};

/** `errors.chain.toast` key explaining why `connection` is refused, or null when it is allowed. */
function connectionRejection(
  connection: Connection,
  chainEdges: ChainEdge[],
): "selfConnection" | "handleOccupied" | "duplicateConnection" | null {
  if (connection.source === connection.target) return "selfConnection";
  if (!isValidChainConnection(connection, chainEdges)) return "handleOccupied";
  const branchId = connection.sourceHandle ?? undefined;
  const isDuplicate = chainEdges.some(
    (e) =>
      e.sourceRequestId === connection.source &&
      e.targetRequestId === connection.target &&
      e.branchId === branchId,
  );
  return isDuplicate ? "duplicateConnection" : null;
}

/** True when the connection touches a control-flow node (condition/delay) or a display node. */
function involvesControlFlowOrDisplay(
  connection: Connection,
  { conditionNodeIds, delayNodeIds, displayNodeIds }: NodeIdSets,
): boolean {
  const isConditionSource =
    conditionNodeIds.has(connection.source) &&
    connection.sourceHandle !== null &&
    connection.sourceHandle !== undefined;
  return (
    isConditionSource ||
    delayNodeIds.has(connection.source) ||
    delayNodeIds.has(connection.target) ||
    conditionNodeIds.has(connection.target) ||
    displayNodeIds.has(connection.source) ||
    displayNodeIds.has(connection.target)
  );
}

/** The single new `ChainEdge` for an accepted `connection`. */
function buildConnectionEdge(
  connection: Connection,
  nodeIds: NodeIdSets,
): ChainEdge {
  const branchId = connection.sourceHandle ?? undefined;
  const needsRoutingInjection =
    involvesControlFlowOrDisplay(connection, nodeIds) ||
    branchId === CHAIN_HANDLE_IDS.FAIL;
  return {
    id: generateId(),
    sourceRequestId: connection.source,
    targetRequestId: connection.target,
    injections: needsRoutingInjection
      ? [{ sourceJsonPath: "", targetField: "url", targetKey: "" }]
      : [],
    branchId,
  };
}

/** Memoized id sets for the node kinds that change how a new edge is seeded. */
function useNodeIdSets(
  conditionNodes: { id: string }[],
  delayNodes: { id: string }[],
  displayNodes: { id: string }[],
): NodeIdSets {
  const conditionNodeIds = useMemo(
    () => new Set(conditionNodes.map((n) => n.id)),
    [conditionNodes],
  );
  const delayNodeIds = useMemo(
    () => new Set(delayNodes.map((n) => n.id)),
    [delayNodes],
  );
  const displayNodeIds = useMemo(
    () => new Set(displayNodes.map((n) => n.id)),
    [displayNodes],
  );
  return useMemo(
    () => ({ conditionNodeIds, delayNodeIds, displayNodeIds }),
    [conditionNodeIds, delayNodeIds, displayNodeIds],
  );
}

/**
 * Validated `onConnect` for the chain canvas: rejects self-loops and duplicate edges,
 * and builds the single new `ChainEdge` + its React Flow edge via `chainEdgeToFlowEdge`.
 */
export function useChainConnect({
  chainId,
  chainEdges,
  conditionNodes,
  delayNodes,
  displayNodes,
  onUpsertEdge,
  onDeleteEdge,
  setEdges,
}: UseChainConnectParams) {
  const t = useTranslations("chain");
  const tErrors = useTranslations("errors");
  const nodeIds = useNodeIdSets(conditionNodes, delayNodes, displayNodes);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const rejection = connectionRejection(connection, chainEdges);
      if (rejection) {
        toast.error(tErrors(`chain.toast.${rejection}`));
        return;
      }

      const newEdge = buildConnectionEdge(connection, nodeIds);
      const blocks = useChainStore.getState().chains[chainId]?.blocks ?? [];
      if (createsLoopNestingViolation(blocks, chainEdges, newEdge)) {
        toast.error(t("loopNestingConnectRefused"));
        return;
      }
      onUpsertEdge(newEdge);
      const flowEdge = chainEdgeToFlowEdge(newEdge, conditionNodes, {
        onDeleteEdge,
      });
      setEdges((eds) => addEdge(flowEdge, eds));
    },
    [
      chainId,
      t,
      tErrors,
      chainEdges,
      conditionNodes,
      nodeIds,
      onUpsertEdge,
      onDeleteEdge,
      setEdges,
    ],
  );

  return { onConnect, ...nodeIds } as const;
}
