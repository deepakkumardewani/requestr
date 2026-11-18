import type { Node } from "@xyflow/react";

export type AlignEdge = "left" | "top" | "right" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

const MIN_DISTRIBUTE_NODES = 3;

interface Bounds {
  node: Node;
  width: number;
  height: number;
}

/** Measured size wins; stored size is the fallback; otherwise the node is unusable. */
function boundsOf(node: Node): Bounds | null {
  const width = node.measured?.width ?? node.width;
  const height = node.measured?.height ?? node.height;
  if (!width || !height) return null;
  return { node, width, height };
}

function collectBounds(nodes: readonly Node[]): Bounds[] {
  return nodes.flatMap((node) => {
    const bounds = boundsOf(node);
    return bounds ? [bounds] : [];
  });
}

/** Applies per-id position patches without mutating the input array or nodes. */
function applyPositions(
  nodes: readonly Node[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
): Node[] {
  return nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
}

function alignedPosition(
  { node, width, height }: Bounds,
  edge: AlignEdge,
  target: number,
): { x: number; y: number } {
  switch (edge) {
    case "left":
      return { x: target, y: node.position.y };
    case "right":
      return { x: target - width, y: node.position.y };
    case "top":
      return { x: node.position.x, y: target };
    case "bottom":
      return { x: node.position.x, y: target - height };
  }
}

function alignTarget(bounds: Bounds[], edge: AlignEdge): number {
  const values = bounds.map(({ node, width, height }) => {
    switch (edge) {
      case "left":
        return node.position.x;
      case "right":
        return node.position.x + width;
      case "top":
        return node.position.y;
      case "bottom":
        return node.position.y + height;
      default:
        return edge satisfies never;
    }
  });
  return edge === "left" || edge === "top"
    ? Math.min(...values)
    : Math.max(...values);
}

/** Aligns measurable nodes to the selection's outermost edge. */
export function alignNodes(nodes: readonly Node[], edge: AlignEdge): Node[] {
  const bounds = collectBounds(nodes);
  if (bounds.length < 2) return [...nodes];
  const target = alignTarget(bounds, edge);
  const positions = new Map(
    bounds.map((b) => [b.node.id, alignedPosition(b, edge, target)]),
  );
  return applyPositions(nodes, positions);
}

/** Spaces measurable nodes so gaps are equal; the two outermost nodes stay put. */
export function distribute(
  nodes: readonly Node[],
  axis: DistributeAxis,
): Node[] {
  const bounds = collectBounds(nodes);
  if (bounds.length < MIN_DISTRIBUTE_NODES) return [...nodes];

  const horizontal = axis === "horizontal";
  const start = (b: Bounds) =>
    horizontal ? b.node.position.x : b.node.position.y;
  const size = (b: Bounds) => (horizontal ? b.width : b.height);

  const sorted = [...bounds].sort((a, b) => start(a) - start(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = start(last) + size(last) - start(first);
  const totalSize = sorted.reduce((sum, b) => sum + size(b), 0);
  const gap = (span - totalSize) / (sorted.length - 1);

  const positions = new Map<string, { x: number; y: number }>();
  let cursor = start(first);
  for (const b of sorted) {
    const { x, y } = b.node.position;
    positions.set(b.node.id, horizontal ? { x: cursor, y } : { x, y: cursor });
    cursor += size(b) + gap;
  }
  return applyPositions(nodes, positions);
}
