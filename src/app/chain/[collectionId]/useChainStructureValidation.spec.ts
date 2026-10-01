/** @vitest-environment happy-dom */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  Chain,
  ChainBlock,
  ChainEdge,
  CollectBlock,
  LoopBlock,
} from "@/types/chain";
import { useChainStructureValidation } from "./useChainStructureValidation";

const CHAIN_ID = "chain-1";

const loop = (id: string): LoopBlock => ({
  id,
  type: "loop",
  sourceJsonPath: "$.items",
  itemAlias: "item",
  maxIterations: 10,
});
const collect = (id: string, loopId: string): CollectBlock => ({
  id,
  type: "collect",
  loopId,
});
const edge = (source: string, target: string, branchId?: string): ChainEdge => ({
  id: `${source}->${target}`,
  sourceRequestId: source,
  targetRequestId: target,
  injections: [],
  branchId,
});

function makeChain(blocks: ChainBlock[], edges: ChainEdge[]): Chain {
  return {
    id: CHAIN_ID,
    scope: "standalone",
    schemaVersion: 5,
    name: "c",
    createdAt: 0,
    blocks,
    nodeIds: [],
    edges,
    nodePositions: {},
  } as Chain;
}

function validate(blocks: ChainBlock[], edges: ChainEdge[]) {
  return renderHook(() =>
    useChainStructureValidation(CHAIN_ID, makeChain(blocks, edges)),
  ).result.current;
}

describe("useChainStructureValidation loop body checks", () => {
  it("flags a loop whose body handle is unconnected", () => {
    const result = validate([loop("l"), collect("c", "l")], []);
    expect(result.loopsWithUnconnectedBodyIds).toEqual(["l"]);
    expect(result.loopsWhoseBodyMissesCollectIds).toEqual([]);
  });

  it("flags a loop whose body never reaches its Collect", () => {
    const result = validate(
      [loop("l"), collect("c", "l")],
      [edge("l", "r1", "body")],
    );
    expect(result.loopsWhoseBodyMissesCollectIds).toEqual(["l"]);
    expect(result.loopsWithUnconnectedBodyIds).toEqual([]);
  });

  it("reports nothing for a well-formed loop", () => {
    const result = validate(
      [loop("l"), collect("c", "l")],
      [edge("l", "r1", "body"), edge("r1", "c")],
    );
    expect(result.loopsWithUnconnectedBodyIds).toEqual([]);
    expect(result.loopsWhoseBodyMissesCollectIds).toEqual([]);
  });
});
