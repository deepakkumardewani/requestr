import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { computeAutoLayout } from "./chainLayout";

const node = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("computeAutoLayout", () => {
  it("returns an empty map for an empty graph", () => {
    expect(computeAutoLayout([], [])).toEqual({});
  });

  it("places a chain left-to-right with increasing x", () => {
    const pos = computeAutoLayout(
      [node("a"), node("b"), node("c")],
      [edge("a", "b"), edge("b", "c")],
    );
    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);
  });

  it("separates parallel branches vertically in the same rank", () => {
    const pos = computeAutoLayout(
      [node("a"), node("b"), node("c")],
      [edge("a", "b"), edge("a", "c")],
    );
    expect(pos.b.x).toBe(pos.c.x);
    expect(pos.b.y).not.toBe(pos.c.y);
  });

  it("positions disconnected nodes without edges", () => {
    const pos = computeAutoLayout([node("a"), node("b")], []);
    expect(Object.keys(pos).sort()).toEqual(["a", "b"]);
  });

  it("converts dagre center coordinates to top-left using the given size", () => {
    const [width, height] = [100, 40];
    const pos = computeAutoLayout([node("a")], [], width, height);
    // A lone node is centred at (width/2, height/2), so its top-left is the origin.
    expect(pos.a).toEqual({ x: 0, y: 0 });
  });
});
