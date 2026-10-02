import { describe, expect, it } from "vitest";
import {
  AFTER_NODE_OFFSET_X,
  NODE_WIDTH_ESTIMATE,
  RIGHT_OF_BOUNDS_GAP,
  STACK_GAP_Y,
  resolvePlacementOrigin,
  stackPositions,
} from "./nodePlacement";

const BOUNDS = { minX: 10, maxX: 500, minY: 40, maxY: 300 };
const VIEWPORT = { x: 700, y: 400 };

describe("constants", () => {
  it("exposes the layout spacing", () => {
    expect(STACK_GAP_Y).toBe(140);
    expect(AFTER_NODE_OFFSET_X).toBe(320);
    expect(RIGHT_OF_BOUNDS_GAP).toBe(80);
  });
});

describe("stackPositions", () => {
  it.each([0, -3, NaN])("returns [] for count %s", (count) => {
    expect(stackPositions({ x: 0, y: 0 }, count)).toEqual([]);
  });

  it("returns the origin for a single node", () => {
    expect(stackPositions({ x: 5, y: 7 }, 1)).toEqual([{ x: 5, y: 7 }]);
  });

  it("stacks vertically with a non-overlapping gap", () => {
    const result = stackPositions({ x: 5, y: 10 }, 3);
    expect(result).toEqual([
      { x: 5, y: 10 },
      { x: 5, y: 10 + STACK_GAP_Y },
      { x: 5, y: 10 + 2 * STACK_GAP_Y },
    ]);
  });
});

describe("resolvePlacementOrigin", () => {
  it("places after the anchor, keeping its y", () => {
    expect(
      resolvePlacementOrigin(
        { anchorPosition: { x: 100, y: 50 } },
        BOUNDS,
        VIEWPORT
      )
    ).toEqual({ x: 100 + AFTER_NODE_OFFSET_X, y: 50 });
  });

  it("prefers the anchor over an explicit position", () => {
    expect(
      resolvePlacementOrigin(
        { anchorPosition: { x: 0, y: 0 }, position: { x: 9, y: 9 } },
        BOUNDS,
        VIEWPORT
      )
    ).toEqual({ x: AFTER_NODE_OFFSET_X, y: 0 });
  });

  it("uses an explicit (drop) position as-is", () => {
    expect(
      resolvePlacementOrigin({ position: { x: 33, y: 44 } }, BOUNDS, VIEWPORT)
    ).toEqual({ x: 33, y: 44 });
  });

  it("places right of bounds at the top when no anchor/position", () => {
    expect(resolvePlacementOrigin({}, BOUNDS, VIEWPORT)).toEqual({
      x: BOUNDS.maxX + NODE_WIDTH_ESTIMATE + RIGHT_OF_BOUNDS_GAP,
      y: BOUNDS.minY,
    });
  });

  it("uses the viewport center on an empty canvas", () => {
    expect(resolvePlacementOrigin({}, null, VIEWPORT)).toEqual(VIEWPORT);
  });

  it("still honours anchor/position on an empty canvas", () => {
    expect(
      resolvePlacementOrigin({ position: { x: 1, y: 2 } }, null, VIEWPORT)
    ).toEqual({ x: 1, y: 2 });
  });
});
