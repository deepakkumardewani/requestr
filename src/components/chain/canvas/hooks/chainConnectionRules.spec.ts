import { describe, expect, it } from "vitest";
import type { ChainBlock, ChainEdge } from "@/types/chain";
import { getMultiInboundDisplayIds } from "./chainConnectionRules";

const display = (id: string) =>
  ({
    id,
    type: "display",
    sourceJsonPath: "$",
    targetField: "header",
    targetKey: "k",
  }) as ChainBlock;

const edge = (id: string, source: string, target: string): ChainEdge => ({
  id,
  sourceRequestId: source,
  targetRequestId: target,
  injections: [],
});

describe("getMultiInboundDisplayIds", () => {
  it("flags a Display with two or more incoming edges", () => {
    const ids = getMultiInboundDisplayIds(
      [display("d1")],
      [edge("e1", "a", "d1"), edge("e2", "b", "d1")],
    );
    expect(ids).toEqual(["d1"]);
  });

  it("ignores a Display with a single or no incoming edge", () => {
    const blocks = [display("d1"), display("d2")];
    expect(getMultiInboundDisplayIds(blocks, [edge("e1", "a", "d1")])).toEqual(
      [],
    );
  });

  it("ignores non-Display blocks with several incoming edges and outgoing edges", () => {
    const merge = { id: "m1", type: "merge", mode: "all" } as ChainBlock;
    const edges = [
      edge("e1", "a", "m1"),
      edge("e2", "b", "m1"),
      edge("e3", "d1", "x"),
      edge("e4", "d1", "y"),
    ];
    expect(getMultiInboundDisplayIds([merge, display("d1")], edges)).toEqual(
      [],
    );
  });
});
