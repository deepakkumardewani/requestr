import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
} from "@/components/chain/nodes/LoopNode";
import { generateId } from "@/lib/utils";
import type {
  ChainBlock,
  ChainEdge,
  ConditionNodeConfig,
  MergeBlock,
} from "@/types/chain";
import { chainEdgeToFlowEdge } from "./useChainEdges";

/** Minimum number of incoming edges a Merge block needs to be considered valid. */
const MIN_MERGE_INCOMING_EDGES = 2;

/**
 * A Loop's `body` and `done` source handles each drive exactly one outgoing
 * edge — `body` is the single entry point into the loop's body subgraph,
 * `done` is the single continuation once the loop (and its Collect) has
 * finished. A second connection from the same (source, handle) pair is
 * invalid.
 */
const LOOP_SINGLE_USE_HANDLE_IDS = new Set<string>([
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
]);

/**
 * Pure connection-validity check shared by React Flow's `isValidConnection`
 * (drag-time preview) and `useChainConnect`'s `onConnect` guard (drop-time
 * rejection). Only restricts Loop's `body`/`done` handles to a single edge
 * each — all other connections are left to the existing self-loop/duplicate
 * checks in `onConnect`.
 */
export function isValidChainConnection(
  connection: Connection,
  chainEdges: ChainEdge[],
): boolean {
  const handleId = connection.sourceHandle;
  if (
    !connection.source ||
    !handleId ||
    !LOOP_SINGLE_USE_HANDLE_IDS.has(handleId)
  ) {
    return true;
  }
  return !chainEdges.some(
    (e) => e.sourceRequestId === connection.source && e.branchId === handleId,
  );
}

/**
 * IDs of every Merge block with fewer than `MIN_MERGE_INCOMING_EDGES`
 * incoming edges — drives the canvas validation banner and disables Run
 * until each Merge has at least two connected branches.
 */
export function getInvalidMergeNodeIds(
  mergeNodes: MergeBlock[],
  edges: ChainEdge[],
): string[] {
  return mergeNodes
    .filter(
      (node) =>
        edges.filter((e) => e.targetRequestId === node.id).length <
        MIN_MERGE_INCOMING_EDGES,
    )
    .map((node) => node.id);
}

/** Maximum nesting depth for Loop blocks (3 levels maximum = depths 1, 2, 3; depth 4 is violation). */
const MAX_LOOP_NESTING_DEPTH = 3;

/**
 * IDs of every Loop block that does not have a paired Collect block.
 * A Collect should exist somewhere in the chain with loopId matching this Loop.
 */
export function getUnpairedLoopNodeIds(blocks: ChainBlock[]): string[] {
  const loopIds = new Set(
    blocks.filter((b) => b.type === "loop").map((b) => b.id),
  );
  const pairedLoopIds = new Set(
    blocks
      .filter((b) => b.type === "collect")
      .map((b) => {
        const collectBlock = b as Extract<ChainBlock, { type: "collect" }>;
        return collectBlock.loopId;
      }),
  );
  return Array.from(loopIds).filter((id) => !pairedLoopIds.has(id));
}

/**
 * IDs of every Collect block whose loopId does not resolve to an existing Loop.
 */
export function getUnresolvedCollectNodeIds(blocks: ChainBlock[]): string[] {
  const loopIds = new Set(
    blocks.filter((b) => b.type === "loop").map((b) => b.id),
  );
  return blocks
    .filter((b) => {
      if (b.type !== "collect") return false;
      const collectBlock = b as Extract<ChainBlock, { type: "collect" }>;
      return !loopIds.has(collectBlock.loopId);
    })
    .map((b) => b.id);
}

/**
 * True if the chain contains Loop nesting deeper than the max allowed.
 * Traverses the edge graph to detect nested Loop bodies.
 */
export function hasLoopNestingViolation(
  blocks: ChainBlock[],
  edges: ChainEdge[],
): boolean {
  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  function getMaxLoopDepth(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) return -1; // Cycle detection
    visited.add(nodeId);

    const block = blockMap.get(nodeId);
    if (!block || block.type !== "loop") return 0;

    // Find all nodes that are in this Loop's body (connected via body handle)
    const bodyEdges = edges.filter(
      (e) => e.sourceRequestId === nodeId && e.branchId === LOOP_BODY_HANDLE_ID,
    );

    let maxChildDepth = 0;
    for (const edge of bodyEdges) {
      const childDepth = getMaxLoopDepth(
        edge.targetRequestId,
        new Set(visited),
      );
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }

    return 1 + maxChildDepth;
  }

  // Check all Loop nodes
  const loopNodes = blocks.filter((b) => b.type === "loop");
  for (const loopNode of loopNodes) {
    const depth = getMaxLoopDepth(loopNode.id, new Set());
    if (depth > MAX_LOOP_NESTING_DEPTH) {
      return true;
    }
  }

  return false;
}

type UseChainConnectParams = {
  chainEdges: ChainEdge[];
  conditionNodes: ConditionNodeConfig[];
  delayNodes: { id: string }[];
  displayNodes: { id: string }[];
  onUpsertEdge: (edge: ChainEdge) => void;
  onDeleteEdge: (id: string) => void;
  setEdges: (updater: (eds: Edge[]) => Edge[]) => void;
};

/** True when the connection touches a control-flow node (condition/delay) or a display node. */
function involvesControlFlowOrDisplay(
  connection: Connection,
  conditionNodeIds: Set<string>,
  delayNodeIds: Set<string>,
  displayNodeIds: Set<string>,
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

/**
 * Validated `onConnect` for the chain canvas: rejects self-loops and duplicate edges,
 * and builds the single new `ChainEdge` + its React Flow edge via `chainEdgeToFlowEdge`.
 */
export function useChainConnect({
  chainEdges,
  conditionNodes,
  delayNodes,
  displayNodes,
  onUpsertEdge,
  onDeleteEdge,
  setEdges,
}: UseChainConnectParams) {
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

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      if (connection.source === connection.target) {
        toast.error("A node cannot connect to itself");
        return;
      }

      if (!isValidChainConnection(connection, chainEdges)) {
        toast.error("This handle already has a connection");
        return;
      }

      const branchId = connection.sourceHandle ?? undefined;
      const isDuplicate = chainEdges.some(
        (e) =>
          e.sourceRequestId === connection.source &&
          e.targetRequestId === connection.target &&
          e.branchId === branchId,
      );
      if (isDuplicate) {
        toast.error("This connection already exists");
        return;
      }

      const needsRoutingInjection =
        involvesControlFlowOrDisplay(
          connection,
          conditionNodeIds,
          delayNodeIds,
          displayNodeIds,
        ) || branchId === "fail";

      const newEdge: ChainEdge = {
        id: generateId(),
        sourceRequestId: connection.source,
        targetRequestId: connection.target,
        injections: needsRoutingInjection
          ? [{ sourceJsonPath: "", targetField: "url", targetKey: "" }]
          : [],
        branchId,
      };
      onUpsertEdge(newEdge);

      const flowEdge = chainEdgeToFlowEdge(newEdge, conditionNodes, {
        onDeleteEdge,
      });
      setEdges((eds) => addEdge(flowEdge, eds));
    },
    [
      chainEdges,
      conditionNodes,
      conditionNodeIds,
      delayNodeIds,
      displayNodeIds,
      onUpsertEdge,
      onDeleteEdge,
      setEdges,
    ],
  );

  return { onConnect, conditionNodeIds, delayNodeIds, displayNodeIds } as const;
}
