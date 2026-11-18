import { useMemo } from "react";
import { type ChainGraph, graphNodeIds } from "@/lib/chainRunner/runGraph";
import { resolveNodeMeta } from "@/lib/chainRunner/stepRecording";
import { findCyclicNodeIds } from "@/lib/chainRunner/utils";

export type ChainCycle = {
  /** Only the nodes that sit on a cycle (not nodes merely downstream of one). */
  nodeIds: string[];
  /** Display names for `nodeIds`, resolved for every block type. */
  nodeNames: string[];
  /** An edge that lies on the cycle, for canvas highlighting. */
  edgeId: string | undefined;
};

const NO_CYCLE: ChainCycle = { nodeIds: [], nodeNames: [], edgeId: undefined };

/**
 * Derives the chain's cycle from its graph during render. Uses the same id
 * list as the runner (`graphNodeIds`) so a cycle through any block type
 * blocks Run here exactly when the runner would refuse it.
 */
export function useChainCycle(graph: ChainGraph): ChainCycle {
  return useMemo(() => {
    const nodeIds = findCyclicNodeIds(graphNodeIds(graph), graph.edges);
    if (nodeIds.length === 0) return NO_CYCLE;
    const members = new Set(nodeIds);
    return {
      nodeIds,
      nodeNames: nodeIds.map((id) => resolveNodeMeta(id, graph).label),
      edgeId: graph.edges.find(
        (e) => members.has(e.sourceRequestId) && members.has(e.targetRequestId),
      )?.id,
    };
  }, [graph]);
}
