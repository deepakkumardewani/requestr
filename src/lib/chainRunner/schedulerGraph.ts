import type { ChainEdge, ChainRunState, MergeBlock } from "@/types/chain";
import { isMergeLaneOpen } from "./executors/merge";

export type DependencyGraph = {
  inDegree: Map<string, number>;
  adjacency: Map<string, string[]>;
};

/** Builds in-degree and adjacency maps; edges touching unknown ids are ignored. */
export function buildDependencyGraph(
  ids: string[],
  edges: ChainEdge[],
): DependencyGraph {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of ids) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    const src = edge.sourceRequestId;
    const tgt = edge.targetRequestId;
    if (!inDegree.has(src) || !inDegree.has(tgt)) continue;
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    adjacency.get(src)?.push(tgt);
  }
  return { inDegree, adjacency };
}

/** True when every outgoing edge of `nodeId` goes to `mergeId`, so skipping it starves no other consumer. */
export function feedsOnly(
  edges: ChainEdge[],
  nodeId: string,
  mergeId: string,
): boolean {
  return edges
    .filter((e) => e.sourceRequestId === nodeId)
    .every((e) => e.targetRequestId === mergeId);
}

/** Distinct source ids of every edge entering `mergeId`. */
export function predecessorsOf(edges: ChainEdge[], mergeId: string): string[] {
  const sources = edges
    .filter((e) => e.targetRequestId === mergeId)
    .map((e) => e.sourceRequestId);
  return [...new Set(sources)];
}

type MergesFedByOptions = {
  mergeNodes: MergeBlock[];
  edges: ChainEdge[];
  runState: ChainRunState;
  firedMerges: ReadonlySet<string>;
};

/**
 * Ids of unfired "any"-mode Merges that `nodeId` feeds through an open lane.
 * A dead lane (e.g. a Condition's losing handle) must not fire the Merge.
 */
export function anyMergesFedBy(
  nodeId: string,
  { mergeNodes, edges, runState, firedMerges }: MergesFedByOptions,
): string[] {
  return mergeNodes
    .filter((merge) => merge.mode === "any" && !firedMerges.has(merge.id))
    .filter((merge) =>
      edges.some(
        (e) =>
          e.targetRequestId === merge.id &&
          e.sourceRequestId === nodeId &&
          isMergeLaneOpen(e, runState[nodeId]),
      ),
    )
    .map((merge) => merge.id);
}
