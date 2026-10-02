/**
 * Pure placement helpers for nodes added from the API picker (PICKER-12, EMPTY-3).
 * Kept free of store/React imports so they are trivially testable.
 */

export type Point = { x: number; y: number };

export type PlacementBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * Structural subset of `AddApiIntent` (src/types/chain.ts).
 * - `anchorPosition`: the caller resolves `anchorNodeId` to that node's position.
 * - `position`: an explicit drop position. A `pendingConnection` is only placeable
 *   through the drop position, so callers pass it here too.
 */
export type PlacementIntent = {
  anchorPosition?: Point;
  position?: Point;
};

/** Vertical distance between stacked nodes so they never overlap. */
export const STACK_GAP_Y = 140;
/** Horizontal distance from an anchor node to nodes placed after it. */
export const AFTER_NODE_OFFSET_X = 320;
/** Horizontal gap between the existing canvas bounds and newly placed nodes. */
export const RIGHT_OF_BOUNDS_GAP = 80;
/** Bounds hold node top-left positions, so the rightmost node's width must be cleared too. */
export const NODE_WIDTH_ESTIMATE = 560;

export function stackPositions(origin: Point, count: number): Point[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: Math.floor(count) }, (_, i) => ({
    x: origin.x,
    y: origin.y + i * STACK_GAP_Y,
  }));
}

export function resolvePlacementOrigin(
  intent: PlacementIntent,
  bounds: PlacementBounds | null,
  viewportCenter: Point,
): Point {
  if (intent.anchorPosition) {
    return {
      x: intent.anchorPosition.x + AFTER_NODE_OFFSET_X,
      y: intent.anchorPosition.y,
    };
  }
  if (intent.position) return { ...intent.position };
  if (!bounds) return { ...viewportCenter };
  return {
    x: bounds.maxX + NODE_WIDTH_ESTIMATE + RIGHT_OF_BOUNDS_GAP,
    y: bounds.minY,
  };
}

/** Used when the canvas is empty and the viewport centre is unknown (the dialog sits outside React Flow). */
export const PLACEMENT_FALLBACK_CENTER: Point = { x: 0, y: 0 };

export function getPlacementBounds(positions: Point[]): PlacementBounds | null {
  if (positions.length === 0) return null;
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
