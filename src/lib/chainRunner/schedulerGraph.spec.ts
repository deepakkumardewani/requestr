import { describe, expect, it } from "vitest";
import type { ChainEdge, ChainRunState, MergeBlock } from "@/types/chain";
import {
  anyMergesFedBy,
  buildDependencyGraph,
  feedsOnly,
  predecessorsOf,
} from "./schedulerGraph";

const edge = (s: string, t: string): ChainEdge =>
  ({ id: `${s}-${t}`, sourceRequestId: s, targetRequestId: t }) as ChainEdge;

describe("buildDependencyGraph", () => {
  it("counts in-degree and adjacency, ignoring unknown ids", () => {
    const { inDegree, adjacency } = buildDependencyGraph(
      ["a", "b", "c"],
      [edge("a", "b"), edge("a", "c"), edge("b", "c"), edge("x", "a")],
    );
    expect(inDegree.get("a")).toBe(0);
    expect(inDegree.get("c")).toBe(2);
    expect(adjacency.get("a")).toEqual(["b", "c"]);
  });
});

describe("feedsOnly / predecessorsOf", () => {
  const edges = [edge("a", "m"), edge("b", "m"), edge("b", "z"), edge("a", "m")];
  it("feedsOnly is false when the node also feeds another target", () => {
    expect(feedsOnly(edges, "a", "m")).toBe(true);
    expect(feedsOnly(edges, "b", "m")).toBe(false);
  });
  it("predecessorsOf returns distinct sources", () => {
    expect(predecessorsOf(edges, "m")).toEqual(["a", "b"]);
  });
});

describe("anyMergesFedBy", () => {
  const anyMerge = { id: "m1", mode: "any" } as MergeBlock;
  const allMerge = { id: "m2", mode: "all" } as MergeBlock;
  const edges = [edge("a", "m1"), edge("a", "m2")];
  const runState = {
    a: { state: "passed", extractedValues: {} },
  } as ChainRunState;

  it("returns only unfired any-mode merges fed by the node", () => {
    const opts = { mergeNodes: [anyMerge, allMerge], edges, runState };
    expect(anyMergesFedBy("a", { ...opts, firedMerges: new Set() })).toEqual([
      "m1",
    ]);
    expect(anyMergesFedBy("a", { ...opts, firedMerges: new Set(["m1"]) })).toEqual(
      [],
    );
  });
});
