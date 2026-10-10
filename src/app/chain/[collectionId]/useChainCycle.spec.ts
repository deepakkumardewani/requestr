/** @vitest-environment happy-dom */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChainGraph } from "@/lib/chainRunner/runGraph";
import type { ChainEdge } from "@/types/chain";
import { useChainCycle } from "./useChainCycle";

const edge = (id: string, from: string, to: string): ChainEdge => ({
  id,
  sourceRequestId: from,
  targetRequestId: to,
  injections: [],
});

function makeGraph(overrides: Record<string, unknown> = {}): ChainGraph {
  return {
    requests: [],
    edges: [],
    delayNodes: [],
    conditionNodes: [],
    displayNodes: [],
    evaluateNodes: [],
    validateNodes: [],
    mergeNodes: [],
    loopNodes: [],
    collectNodes: [],
    subChainBlocks: [],
    ...overrides,
  } as ChainGraph;
}

const requests = (...ids: string[]) =>
  ids.map((id) => ({ id, name: `Req ${id}` }));

describe("useChainCycle", () => {
  afterEach(cleanup);

  it("returns an empty cycle with no edge for an acyclic chain", () => {
    const graph = makeGraph({
      requests: requests("a", "b"),
      edges: [edge("e1", "a", "b")],
    });

    const { result } = renderHook(() => useChainCycle(graph));

    expect(result.current).toEqual({
      nodeIds: [],
      nodeNames: [],
      edgeId: undefined,
    });
  });

  it("returns the same empty-cycle reference for different acyclic graphs", () => {
    const { result, rerender } = renderHook(({ g }) => useChainCycle(g), {
      initialProps: { g: makeGraph({ requests: requests("a") }) },
    });
    const first = result.current;

    rerender({ g: makeGraph({ requests: requests("a", "b") }) });

    expect(result.current).toBe(first);
  });

  it("reports the nodes, names and an edge that sit on a request cycle", () => {
    const graph = makeGraph({
      requests: requests("a", "b"),
      edges: [edge("e1", "a", "b"), edge("e2", "b", "a")],
    });

    const { result } = renderHook(() => useChainCycle(graph));

    expect([...result.current.nodeIds].sort()).toEqual(["a", "b"]);
    expect([...result.current.nodeNames].sort()).toEqual(["Req a", "Req b"]);
    expect(["e1", "e2"]).toContain(result.current.edgeId);
  });

  it("excludes nodes merely downstream of a cycle and picks an edge between cycle members", () => {
    const graph = makeGraph({
      requests: requests("a", "b", "c"),
      edges: [
        edge("into-tail", "b", "c"),
        edge("e1", "a", "b"),
        edge("e2", "b", "a"),
      ],
    });

    const { result } = renderHook(() => useChainCycle(graph));

    expect([...result.current.nodeIds].sort()).toEqual(["a", "b"]);
    expect(result.current.edgeId).not.toBe("into-tail");
    expect(["e1", "e2"]).toContain(result.current.edgeId);
  });

  it("detects a cycle through a control-flow block and names it by block type", () => {
    const graph = makeGraph({
      requests: requests("a"),
      delayNodes: [{ id: "d1" }],
      edges: [edge("e1", "a", "d1"), edge("e2", "d1", "a")],
    });

    const { result } = renderHook(() => useChainCycle(graph));

    expect([...result.current.nodeNames].sort()).toEqual(["Delay", "Req a"]);
  });

  it("detects a self-loop", () => {
    const graph = makeGraph({
      requests: requests("a"),
      edges: [edge("self", "a", "a")],
    });

    const { result } = renderHook(() => useChainCycle(graph));

    expect(result.current.nodeIds).toEqual(["a"]);
    expect(result.current.edgeId).toBe("self");
  });

  it("recomputes when the graph changes from cyclic to acyclic", () => {
    const cyclic = makeGraph({
      requests: requests("a", "b"),
      edges: [edge("e1", "a", "b"), edge("e2", "b", "a")],
    });
    const fixed = makeGraph({
      requests: requests("a", "b"),
      edges: [edge("e1", "a", "b")],
    });
    const { result, rerender } = renderHook(({ g }) => useChainCycle(g), {
      initialProps: { g: cyclic },
    });
    expect(result.current.nodeIds).toHaveLength(2);

    rerender({ g: fixed });

    expect(result.current.nodeIds).toEqual([]);
    expect(result.current.edgeId).toBeUndefined();
  });
});
