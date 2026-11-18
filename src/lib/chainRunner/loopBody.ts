import {
  type ChainEdge,
  type CollectBlock,
  LOOP_BODY_HANDLE_ID,
  type LoopBlock,
} from "@/types/chain";
import { type BlockCollections, blockGroups } from "./runGraph";

type LoopBodyShape = BlockCollections & {
  requests: Array<{ id: string }>;
  edges: ChainEdge[];
};

function bodyHandleTargets(loopId: string, edges: ChainEdge[]): string[] {
  return edges
    .filter(
      (e) => e.sourceRequestId === loopId && e.branchId === LOOP_BODY_HANDLE_ID,
    )
    .map((e) => e.targetRequestId);
}

/**
 * Every node reachable from a Loop's `body` handle, stopping at (and
 * excluding) its paired Collect — the boundary of the loop body subgraph.
 */
export function collectLoopBodyNodeIds(
  loopId: string,
  collectId: string,
  edges: ChainEdge[],
): Set<string> {
  const visited = new Set<string>();
  const queue = bodyHandleTargets(loopId, edges);

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || id === collectId || visited.has(id)) continue;
    visited.add(id);
    for (const edge of edges) {
      if (edge.sourceRequestId === id && edge.targetRequestId !== collectId) {
        queue.push(edge.targetRequestId);
      }
    }
  }

  return visited;
}

/**
 * The body nodes whose output a Collect gathers each iteration: every node of
 * any type with a drawn edge into the Collect. A body that is not wired into
 * its Collect falls back to its leaves (body nodes with no outgoing edge to
 * another body node).
 */
export function findLoopBodyTerminalIds(
  bodyIds: ReadonlySet<string>,
  collectId: string,
  edges: readonly ChainEdge[],
): string[] {
  const wired = new Set(
    edges
      .filter(
        (e) =>
          e.targetRequestId === collectId && bodyIds.has(e.sourceRequestId),
      )
      .map((e) => e.sourceRequestId),
  );
  if (wired.size > 0) return [...wired];

  const hasBodySuccessor = new Set(
    edges
      .filter((e) => bodyIds.has(e.targetRequestId))
      .map((e) => e.sourceRequestId),
  );
  return [...bodyIds].filter((id) => !hasBodySuccessor.has(id));
}

/** Every node id of a standalone body graph (requests plus all block types). */
export function loopBodyGraphNodeIds(body: LoopBodyShape): Set<string> {
  return new Set([
    ...body.requests.map((r) => r.id),
    ...blockGroups(body).flatMap(([, nodes]) => nodes.map((n) => n.id)),
  ]);
}

/**
 * A Collect depends on its Loop finishing even when no edge is drawn between
 * them (the Loop's `done` handle is optional), otherwise the scheduler would
 * dequeue the Collect at the start of the run and skip everything downstream.
 * Returns `edges` plus an implicit Loop -> Collect edge wherever none exists.
 */
export function withImplicitLoopCollectEdges(
  edges: ChainEdge[],
  collectNodes: readonly CollectBlock[],
): ChainEdge[] {
  const implicit = collectNodes
    .filter(
      (c) =>
        c.loopId &&
        !edges.some(
          (e) => e.sourceRequestId === c.loopId && e.targetRequestId === c.id,
        ),
    )
    .map(
      (c): ChainEdge => ({
        id: `implicit:${c.loopId}->${c.id}`,
        sourceRequestId: c.loopId,
        targetRequestId: c.id,
        injections: [],
      }),
    );
  return implicit.length > 0 ? [...edges, ...implicit] : edges;
}

/** Loops whose `body` handle has no outgoing edge, so there is nothing to iterate. */
export function findLoopsWithUnconnectedBody(
  loopNodes: readonly LoopBlock[],
  edges: ChainEdge[],
): string[] {
  return loopNodes
    .filter((l) => bodyHandleTargets(l.id, edges).length === 0)
    .map((l) => l.id);
}

/**
 * Loops whose connected body never reaches the paired Collect. Such a body is
 * indistinguishable from "everything downstream", so it is worth a warning.
 * Loops with an unconnected body or no paired Collect are reported elsewhere.
 */
export function findLoopsWhoseBodyMissesCollect(
  loopNodes: readonly LoopBlock[],
  collectNodes: readonly CollectBlock[],
  edges: ChainEdge[],
): string[] {
  return loopNodes
    .filter((loop) => {
      const collect = collectNodes.find((c) => c.loopId === loop.id);
      if (!collect || bodyHandleTargets(loop.id, edges).length === 0) {
        return false;
      }
      const body = collectLoopBodyNodeIds(loop.id, collect.id, edges);
      return !edges.some(
        (e) => e.targetRequestId === collect.id && body.has(e.sourceRequestId),
      );
    })
    .map((l) => l.id);
}
