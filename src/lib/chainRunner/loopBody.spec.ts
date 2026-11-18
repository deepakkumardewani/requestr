import { describe, expect, it } from "vitest";
import { LOOP_BODY_HANDLE_ID } from "@/types/chain";
import type { ChainEdge, CollectBlock, LoopBlock } from "@/types/chain";
import {
  collectLoopBodyNodeIds,
  findLoopBodyTerminalIds,
  findLoopsWhoseBodyMissesCollect,
  findLoopsWithUnconnectedBody,
  withImplicitLoopCollectEdges,
} from "./loopBody";

const edge = (
  source: string,
  target: string,
  branchId?: string,
): ChainEdge => ({
  id: `${source}->${target}`,
  sourceRequestId: source,
  targetRequestId: target,
  injections: [],
  branchId,
});

const loop = (id: string): LoopBlock => ({
  id,
  type: "loop",
  sourceJsonPath: "$",
  itemAlias: "item",
  maxIterations: 10,
});
const collect = (id: string, loopId: string): CollectBlock => ({
  id,
  type: "collect",
  loopId,
});

describe("withImplicitLoopCollectEdges", () => {
  it("adds a Loop -> Collect edge when none is drawn", () => {
    const edges = [edge("a", "loop")];
    const result = withImplicitLoopCollectEdges(edges, [collect("c", "loop")]);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      sourceRequestId: "loop",
      targetRequestId: "c",
    });
  });

  it("returns the same edges when the done edge already exists", () => {
    const edges = [edge("loop", "c", "done")];
    expect(withImplicitLoopCollectEdges(edges, [collect("c", "loop")])).toBe(
      edges,
    );
  });

  it("ignores a Collect with no paired Loop id", () => {
    const edges: ChainEdge[] = [];
    expect(withImplicitLoopCollectEdges(edges, [collect("c", "")])).toBe(edges);
  });
});

describe("findLoopBodyTerminalIds", () => {
  it("uses every node type with an edge into Collect", () => {
    const edges = [
      edge("body", "disp"),
      edge("body", "req2"),
      edge("disp", "c"),
    ];
    const bodyIds = new Set(["body", "disp", "req2"]);
    expect(findLoopBodyTerminalIds(bodyIds, "c", edges)).toEqual(["disp"]);
  });

  it("falls back to leaves when the body is not wired into Collect", () => {
    const edges = [edge("loop", "body", LOOP_BODY_HANDLE_ID), edge("body", "x")];
    const bodyIds = new Set(["body", "x"]);
    expect(findLoopBodyTerminalIds(bodyIds, "c", edges)).toEqual(["x"]);
  });

  it("is empty for an empty body", () => {
    expect(findLoopBodyTerminalIds(new Set(), "c", [])).toEqual([]);
  });
});

describe("loop body validators", () => {
  const loops = [loop("l1")];
  const collects = [collect("c1", "l1")];

  it("flags a Loop whose body handle has no edge", () => {
    expect(
      findLoopsWithUnconnectedBody(loops, [edge("l1", "c1", "done")]),
    ).toEqual(["l1"]);
    expect(
      findLoopsWithUnconnectedBody(loops, [
        edge("l1", "b", LOOP_BODY_HANDLE_ID),
      ]),
    ).toEqual([]);
  });

  it("flags a connected body that never reaches Collect", () => {
    const unwired = [edge("l1", "b", LOOP_BODY_HANDLE_ID), edge("b", "after")];
    expect(findLoopsWhoseBodyMissesCollect(loops, collects, unwired)).toEqual([
      "l1",
    ]);
    const wired = [...unwired, edge("after", "c1")];
    expect(findLoopsWhoseBodyMissesCollect(loops, collects, wired)).toEqual([]);
  });

  it("does not double-report an unconnected body or a missing Collect", () => {
    expect(findLoopsWhoseBodyMissesCollect(loops, collects, [])).toEqual([]);
    expect(
      findLoopsWhoseBodyMissesCollect(
        loops,
        [],
        [edge("l1", "b", LOOP_BODY_HANDLE_ID)],
      ),
    ).toEqual([]);
  });

  it("collectLoopBodyNodeIds stops at the paired Collect", () => {
    const edges = [
      edge("l1", "b", LOOP_BODY_HANDLE_ID),
      edge("b", "c1"),
      edge("c1", "down"),
    ];
    expect([...collectLoopBodyNodeIds("l1", "c1", edges)]).toEqual(["b"]);
  });
});
