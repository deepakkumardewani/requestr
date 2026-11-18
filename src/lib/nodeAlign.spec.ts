import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { alignNodes, distribute } from "./nodeAlign";

const node = (
  id: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  measured = true
): Node => ({
  id,
  position: { x, y },
  data: {},
  ...(w && h
    ? measured
      ? { measured: { width: w, height: h } }
      : { width: w, height: h }
    : {}),
});

const pos = (nodes: Node[]) => nodes.map((n) => n.position);

describe("alignNodes", () => {
  const nodes = [node("a", 10, 5, 100, 50), node("b", 50, 80, 40, 20)];

  it("aligns left", () => {
    expect(pos(alignNodes(nodes, "left"))).toEqual([
      { x: 10, y: 5 },
      { x: 10, y: 80 },
    ]);
  });
  it("aligns right", () => {
    expect(pos(alignNodes(nodes, "right"))).toEqual([
      { x: 10, y: 5 },
      { x: 70, y: 80 },
    ]);
  });
  it("aligns top", () => {
    expect(pos(alignNodes(nodes, "top"))).toEqual([
      { x: 10, y: 5 },
      { x: 50, y: 5 },
    ]);
  });
  it("aligns bottom", () => {
    expect(pos(alignNodes(nodes, "bottom"))).toEqual([
      { x: 10, y: 50 },
      { x: 50, y: 80 },
    ]);
  });
  it("falls back to stored dimensions", () => {
    const stored = [
      node("a", 0, 0, 100, 10, false),
      node("b", 20, 0, 50, 10, false),
    ];
    expect(pos(alignNodes(stored, "right"))[1]).toEqual({ x: 50, y: 0 });
  });
  it("skips unmeasured nodes without moving them", () => {
    const mixed = [...nodes, node("c", 999, 999)];
    const out = alignNodes(mixed, "left");
    expect(out[2].position).toEqual({ x: 999, y: 999 });
    expect(out[1].position.x).toBe(10);
  });
  it("is a no-op below two measurable nodes", () => {
    expect(pos(alignNodes([nodes[0], node("c", 9, 9)], "left"))).toEqual([
      { x: 10, y: 5 },
      { x: 9, y: 9 },
    ]);
  });
  it("does not mutate input", () => {
    const snapshot = structuredClone(nodes);
    alignNodes(nodes, "left");
    expect(nodes).toEqual(snapshot);
  });
});

describe("distribute", () => {
  it("requires 3+ measurable nodes", () => {
    const two = [node("a", 0, 0, 10, 10), node("b", 100, 0, 10, 10)];
    expect(pos(distribute(two, "horizontal"))).toEqual(pos(two));
    const twoPlusUnmeasured = [...two, node("c", 5, 5)];
    expect(pos(distribute(twoPlusUnmeasured, "horizontal"))).toEqual(
      pos(twoPlusUnmeasured)
    );
  });
  it("creates equal horizontal gaps regardless of input order", () => {
    const nodes = [
      node("c", 200, 0, 20, 10),
      node("a", 0, 0, 40, 10),
      node("b", 50, 7, 20, 10),
    ];
    const out = distribute(nodes, "horizontal");
    const byId = Object.fromEntries(out.map((n) => [n.id, n.position]));
    // span 220, sizes 80, gap 70
    expect(byId.a).toEqual({ x: 0, y: 0 });
    expect(byId.b).toEqual({ x: 110, y: 7 });
    expect(byId.c).toEqual({ x: 200, y: 0 });
  });
  it("creates equal vertical gaps", () => {
    const nodes = [
      node("a", 0, 0, 10, 10),
      node("b", 3, 20, 10, 30),
      node("c", 0, 100, 10, 20),
    ];
    const out = distribute(nodes, "vertical");
    // span 120, sizes 60, gap 30
    expect(out[1].position).toEqual({ x: 3, y: 40 });
    expect(out[2].position).toEqual({ x: 0, y: 100 });
  });
  it("leaves unmeasured nodes untouched and does not mutate input", () => {
    const nodes = [
      node("a", 0, 0, 10, 10),
      node("u", 55, 55),
      node("b", 20, 0, 10, 10),
      node("c", 100, 0, 10, 10),
    ];
    const snapshot = structuredClone(nodes);
    const out = distribute(nodes, "horizontal");
    expect(out[1].position).toEqual({ x: 55, y: 55 });
    expect(nodes).toEqual(snapshot);
  });
});
