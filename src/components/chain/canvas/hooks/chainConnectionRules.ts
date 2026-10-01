import type { Connection } from "@xyflow/react";
import { isBlockOfType } from "@/lib/chainBlocks";
import { MAX_LOOP_NESTING_DEPTH } from "@/lib/chainConstants";
import type { ChainBlock, ChainEdge, MergeBlock } from "@/types/chain";
import { LOOP_BODY_HANDLE_ID, LOOP_DONE_HANDLE_ID } from "@/types/chain";

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

/**
 * IDs of every Loop block that does not have a paired Collect block.
 * A Collect should exist somewhere in the chain with loopId matching this Loop.
 */
export function getUnpairedLoopNodeIds(blocks: ChainBlock[]): string[] {
  const loopIds = new Set(
    blocks.filter(isBlockOfType("loop")).map((b) => b.id),
  );
  const pairedLoopIds = new Set(
    blocks.filter(isBlockOfType("collect")).map((b) => b.loopId),
  );
  return Array.from(loopIds).filter((id) => !pairedLoopIds.has(id));
}

/**
 * IDs of every Collect block whose loopId does not resolve to an existing Loop.
 */
export function getUnresolvedCollectNodeIds(blocks: ChainBlock[]): string[] {
  const loopIds = new Set(
    blocks.filter(isBlockOfType("loop")).map((b) => b.id),
  );
  return blocks
    .filter(isBlockOfType("collect"))
    .filter((b) => !loopIds.has(b.loopId))
    .map((b) => b.id);
}

/**
 * Block ids in a Loop's body: everything reachable from its `body` handle,
 * stopping at the Loop's own Collect (the body's end marker).
 */
function getLoopBodyIds(
  loopId: string,
  blocks: ChainBlock[],
  edges: ChainEdge[],
): Set<string> {
  const collectIds = new Set(
    blocks
      .filter((b) => b.type === "collect" && b.loopId === loopId)
      .map((b) => b.id),
  );
  const body = new Set<string>();
  const stack = edges
    .filter(
      (e) => e.sourceRequestId === loopId && e.branchId === LOOP_BODY_HANDLE_ID,
    )
    .map((e) => e.targetRequestId);
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined) break;
    if (body.has(id) || id === loopId || collectIds.has(id)) continue;
    body.add(id);
    for (const e of edges) {
      if (e.sourceRequestId === id) stack.push(e.targetRequestId);
    }
  }
  return body;
}

/** Deepest chain of Loops nested inside one another (a lone Loop is depth 1). */
export function getMaxLoopNestingDepth(
  blocks: ChainBlock[],
  edges: ChainEdge[],
): number {
  const loopIds = new Set(
    blocks.filter((b) => b.type === "loop").map((b) => b.id),
  );

  function depthOf(loopId: string, ancestors: Set<string>): number {
    const inner = [...getLoopBodyIds(loopId, blocks, edges)].filter(
      (id) => loopIds.has(id) && !ancestors.has(id),
    );
    const nextAncestors = new Set(ancestors).add(loopId);
    return 1 + Math.max(0, ...inner.map((id) => depthOf(id, nextAncestors)));
  }

  return Math.max(0, ...[...loopIds].map((id) => depthOf(id, new Set())));
}

/** True if Loops nest deeper than `MAX_LOOP_NESTING_DEPTH` (spec: max 3). */
export function hasLoopNestingViolation(
  blocks: ChainBlock[],
  edges: ChainEdge[],
): boolean {
  return getMaxLoopNestingDepth(blocks, edges) > MAX_LOOP_NESTING_DEPTH;
}

/** True when adding `edge` pushes Loop nesting past the cap that the graph did not already exceed. */
export function createsLoopNestingViolation(
  blocks: ChainBlock[],
  edges: ChainEdge[],
  edge: ChainEdge,
): boolean {
  return (
    !hasLoopNestingViolation(blocks, edges) &&
    hasLoopNestingViolation(blocks, [...edges, edge])
  );
}
