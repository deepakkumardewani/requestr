import { type Edge, useEdgesState } from "@xyflow/react";
import { useEffect } from "react";
import type { ChainEdge, ConditionNodeConfig } from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";

export type ChainEdgeCallbacks = {
  onDeleteEdge: (id: string) => void;
};

/**
 * Single source of truth for converting a `ChainEdge` into a React Flow `Edge`.
 * Used both to render the full edge list and to build a single new edge on connect.
 */
export function chainEdgeToFlowEdge(
  edge: ChainEdge,
  conditionNodes: ConditionNodeConfig[],
  { onDeleteEdge }: ChainEdgeCallbacks,
): Edge {
  // Routing edge from a condition node — purple dashed
  if (
    edge.branchId &&
    conditionNodes.some((cn) => cn.id === edge.sourceRequestId)
  ) {
    const condNode = conditionNodes.find(
      (cn) => cn.id === edge.sourceRequestId,
    );
    const branch = condNode?.branches.find((b) => b.id === edge.branchId);
    const label = branch?.label || edge.branchId;
    return {
      id: edge.id,
      source: edge.sourceRequestId,
      target: edge.targetRequestId,
      sourceHandle: edge.branchId,
      type: "deletable",
      style: {
        stroke: "var(--chain-edge-branch)",
        strokeWidth: 2,
        strokeDasharray: "4 2",
      },
      data: {
        label,
        labelStyle: { fontSize: 10, fill: "var(--chain-edge-branch-label)" },
        labelBgStyle: {
          fill: "var(--chain-edge-label-bg)",
          fillOpacity: 0.92,
        },
        onDeleteEdge,
      },
    };
  }

  // Fail routing edge from an API node — red dashed
  if (edge.branchId === CHAIN_HANDLE_IDS.FAIL) {
    return {
      id: edge.id,
      source: edge.sourceRequestId,
      target: edge.targetRequestId,
      sourceHandle: CHAIN_HANDLE_IDS.FAIL,
      type: "deletable",
      style: {
        stroke: "var(--chain-edge-fail)",
        strokeWidth: 2,
        strokeDasharray: "4 2",
      },
      data: { onDeleteEdge },
    };
  }

  // Standard extraction edge (success path or legacy)
  const isSuccessHandle = edge.branchId === CHAIN_HANDLE_IDS.SUCCESS;

  return {
    id: edge.id,
    source: edge.sourceRequestId,
    target: edge.targetRequestId,
    sourceHandle: isSuccessHandle ? CHAIN_HANDLE_IDS.SUCCESS : undefined,
    type: "deletable",
    style: {
      stroke: isSuccessHandle
        ? "var(--chain-edge-success)"
        : "var(--chain-edge-default)",
      strokeWidth: 2,
      strokeDasharray: isSuccessHandle ? "4 2" : undefined,
    },
    data: { onDeleteEdge },
  };
}

export function buildFlowEdges(
  chainEdges: ChainEdge[],
  conditionNodes: ConditionNodeConfig[],
  callbacks: ChainEdgeCallbacks,
): Edge[] {
  return chainEdges.map((e) =>
    chainEdgeToFlowEdge(e, conditionNodes, callbacks),
  );
}

type UseChainEdgesParams = {
  chainEdges: ChainEdge[];
  conditionNodes: ConditionNodeConfig[];
  onDeleteEdge: (id: string) => void;
};

/** Builds React Flow edges from `chain.edges` and keeps them in sync with the chain data. */
export function useChainEdges({
  chainEdges,
  conditionNodes,
  onDeleteEdge,
}: UseChainEdgesParams) {
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    buildFlowEdges(chainEdges, conditionNodes, { onDeleteEdge }),
  );

  useEffect(() => {
    setEdges(buildFlowEdges(chainEdges, conditionNodes, { onDeleteEdge }));
  }, [chainEdges, conditionNodes, onDeleteEdge, setEdges]);

  return { edges, setEdges, onEdgesChange } as const;
}
