import type { Edge, Node } from "@xyflow/react";
import dagre from "dagre";

const DEFAULT_LAYOUT_OPTIONS = {
  nodeWidth: 240,
  nodeHeight: 80,
  rankdir: "LR" as const,
  nodesep: 60,
  ranksep: 100,
};

/**
 * Compute dagre left-to-right auto-layout positions for a set of React Flow nodes/edges.
 * Returns a map of node.id → { x, y } using top-left corner coordinates
 * (dagre returns center coords; we subtract half-width/height to align with React Flow).
 */
export function computeAutoLayout(
  nodes: Node[],
  edges: Edge[],
  nodeWidth = DEFAULT_LAYOUT_OPTIONS.nodeWidth,
  nodeHeight = DEFAULT_LAYOUT_OPTIONS.nodeHeight,
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: DEFAULT_LAYOUT_OPTIONS.rankdir,
    nodesep: DEFAULT_LAYOUT_OPTIONS.nodesep,
    ranksep: DEFAULT_LAYOUT_OPTIONS.ranksep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const result: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const positioned = g.node(node.id);
    if (positioned) {
      result[node.id] = {
        x: positioned.x - nodeWidth / 2,
        y: positioned.y - nodeHeight / 2,
      };
    }
  }

  return result;
}
