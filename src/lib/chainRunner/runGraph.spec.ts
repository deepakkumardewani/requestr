import { describe, expect, it } from "vitest";
import type { RequestModel } from "@/types";
import {
  controlFlowNodeIds,
  filterGraphByNodeIds,
  graphNodeIds,
  type ChainGraph,
} from "./runGraph";

const request = (id: string) => ({ id }) as RequestModel;

function buildGraph(): ChainGraph {
  return {
    requests: [request("r1"), request("r2")],
    edges: [
      {
        id: "e1",
        sourceRequestId: "r1",
        targetRequestId: "r2",
        injections: [],
      },
      {
        id: "e2",
        sourceRequestId: "r2",
        targetRequestId: "d1",
        injections: [],
      },
    ],
    delayNodes: [{ id: "d1", type: "delay", delayMs: 1 }],
    conditionNodes: [],
    displayNodes: [],
    evaluateNodes: [],
    validateNodes: [],
    mergeNodes: [{ id: "m1", type: "merge", mode: "all" }],
    loopNodes: [],
    collectNodes: [],
    subChainBlocks: [
      { id: "s1", type: "subchain", chainId: "c", inputBindings: {} },
    ],
    startBlock: { id: "start", type: "start", inputs: [] },
  };
}

describe("runGraph", () => {
  it("controlFlowNodeIds lists every block id except Start", () => {
    expect(controlFlowNodeIds(buildGraph())).toEqual(["d1", "m1", "s1"]);
  });

  it("graphNodeIds includes requests, blocks and the Start block", () => {
    expect(graphNodeIds(buildGraph()).sort()).toEqual(
      ["d1", "m1", "r1", "r2", "s1", "start"].sort(),
    );
  });

  it("filterGraphByNodeIds keeps only matching nodes and edges within the subset, and drops Start", () => {
    const filtered = filterGraphByNodeIds(
      buildGraph(),
      new Set(["r1", "r2", "s1", "start"]),
    );

    expect(filtered.requests.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(filtered.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(filtered.delayNodes).toEqual([]);
    expect(filtered.subChainBlocks.map((n) => n.id)).toEqual(["s1"]);
    expect(filtered.startBlock).toBeUndefined();
  });
});
