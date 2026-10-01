/** @vitest-environment happy-dom */

import { cleanup, renderHook } from "@testing-library/react";
import type { Connection } from "@xyflow/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOOP_BODY_HANDLE_ID } from "@/types/chain";
import { useChainStore } from "@/stores/useChainStore";
import type { ChainBlock, ChainEdge, MergeBlock } from "@/types/chain";
import {
  getInvalidMergeNodeIds,
  getMaxLoopNestingDepth,
  getUnpairedLoopNodeIds,
  getUnresolvedCollectNodeIds,
  hasLoopNestingViolation,
  isValidChainConnection,
  useChainConnect,
} from "./useChainConnect";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

describe("useChainConnect validation functions", () => {
  describe("getUnpairedLoopNodeIds", () => {
    it("returns empty array when all Loops have Collects", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "collect1", type: "collect", loopId: "loop1" },
      ];

      const result = getUnpairedLoopNodeIds(blocks);
      expect(result).toEqual([]);
    });

    it("returns Loop ids when Collect is missing", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "delay1", type: "delay", delayMs: 100 },
      ];

      const result = getUnpairedLoopNodeIds(blocks);
      expect(result).toEqual(["loop1"]);
    });

    it("returns multiple unpaired Loop ids", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "loop2", type: "loop", sourceJsonPath: "$.data", itemAlias: "data", maxIterations: 50 },
        { id: "collect2", type: "collect", loopId: "loop2" },
      ];

      const result = getUnpairedLoopNodeIds(blocks);
      expect(result).toContain("loop1");
      expect(result.length).toBe(1);
    });

    it("handles empty block list", () => {
      const result = getUnpairedLoopNodeIds([]);
      expect(result).toEqual([]);
    });
  });

  describe("getUnresolvedCollectNodeIds", () => {
    it("returns empty array when all Collects have valid Loops", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "collect1", type: "collect", loopId: "loop1" },
      ];

      const result = getUnresolvedCollectNodeIds(blocks);
      expect(result).toEqual([]);
    });

    it("returns Collect ids when Loop does not exist", () => {
      const blocks: ChainBlock[] = [
        { id: "collect1", type: "collect", loopId: "nonexistent-loop" },
      ];

      const result = getUnresolvedCollectNodeIds(blocks);
      expect(result).toEqual(["collect1"]);
    });

    it("returns multiple unresolved Collect ids", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "collect1", type: "collect", loopId: "loop1" },
        { id: "collect2", type: "collect", loopId: "nonexistent" },
        { id: "collect3", type: "collect", loopId: "also-nonexistent" },
      ];

      const result = getUnresolvedCollectNodeIds(blocks);
      expect(result).toHaveLength(2);
      expect(result).toContain("collect2");
      expect(result).toContain("collect3");
    });

    it("handles empty block list", () => {
      const result = getUnresolvedCollectNodeIds([]);
      expect(result).toEqual([]);
    });
  });

  describe("hasLoopNestingViolation", () => {
    it("returns false for no Loops", () => {
      const blocks: ChainBlock[] = [
        { id: "delay1", type: "delay", delayMs: 100 },
      ];

      const result = hasLoopNestingViolation(blocks, []);
      expect(result).toBe(false);
    });

    it("returns false for single Loop", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
      ];

      const result = hasLoopNestingViolation(blocks, []);
      expect(result).toBe(false);
    });

    it("returns false for two nested Loops (allowed)", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "loop2", type: "loop", sourceJsonPath: "$.nested", itemAlias: "nested", maxIterations: 50 },
      ];

      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "loop1",
          targetRequestId: "loop2",
          branchId: "body",
          injections: [],
        },
      ];

      const result = hasLoopNestingViolation(blocks, edges);
      expect(result).toBe(false);
    });

    it("returns false for three nested Loops (at max allowed)", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "loop2", type: "loop", sourceJsonPath: "$.nested", itemAlias: "nested", maxIterations: 50 },
        { id: "loop3", type: "loop", sourceJsonPath: "$.deep", itemAlias: "deep", maxIterations: 25 },
      ];

      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "loop1",
          targetRequestId: "loop2",
          branchId: "body",
          injections: [],
        },
        {
          id: "edge2",
          sourceRequestId: "loop2",
          targetRequestId: "loop3",
          branchId: "body",
          injections: [],
        },
      ];

      const result = hasLoopNestingViolation(blocks, edges);
      expect(result).toBe(false);
    });

    it("returns true for four nested Loops (exceeds max)", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items", itemAlias: "item", maxIterations: 100 },
        { id: "loop2", type: "loop", sourceJsonPath: "$.nested", itemAlias: "nested", maxIterations: 50 },
        { id: "loop3", type: "loop", sourceJsonPath: "$.deep", itemAlias: "deep", maxIterations: 25 },
        { id: "loop4", type: "loop", sourceJsonPath: "$.verydeep", itemAlias: "verydeep", maxIterations: 10 },
      ];

      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "loop1",
          targetRequestId: "loop2",
          branchId: "body",
          injections: [],
        },
        {
          id: "edge2",
          sourceRequestId: "loop2",
          targetRequestId: "loop3",
          branchId: "body",
          injections: [],
        },
        {
          id: "edge3",
          sourceRequestId: "loop3",
          targetRequestId: "loop4",
          branchId: "body",
          injections: [],
        },
      ];

      const result = hasLoopNestingViolation(blocks, edges);
      expect(result).toBe(true);
    });

    it("handles multiple independent Loops correctly", () => {
      const blocks: ChainBlock[] = [
        { id: "loop1", type: "loop", sourceJsonPath: "$.items1", itemAlias: "item1", maxIterations: 100 },
        { id: "loop2", type: "loop", sourceJsonPath: "$.items2", itemAlias: "item2", maxIterations: 50 },
        { id: "loop3", type: "loop", sourceJsonPath: "$.nested", itemAlias: "nested", maxIterations: 25 },
      ];

      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "loop2",
          targetRequestId: "loop3",
          branchId: "body",
          injections: [],
        },
      ];

      const result = hasLoopNestingViolation(blocks, edges);
      expect(result).toBe(false);
    });
  });

  describe("isValidChainConnection", () => {
    it("allows normal connections", () => {
      const connection: Connection = {
        source: "node1",
        target: "node2",
        sourceHandle: null,
        targetHandle: null,
      };

      const result = isValidChainConnection(connection, []);
      expect(result).toBe(true);
    });

    it("disallows duplicate Loop body handle connections", () => {
      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "loop1",
          targetRequestId: "node1",
          branchId: "body",
          injections: [],
        },
      ];

      const connection: Connection = {
        source: "loop1",
        target: "node2",
        sourceHandle: "body",
        targetHandle: null,
      };

      const result = isValidChainConnection(connection, edges);
      expect(result).toBe(false);
    });

    it("allows multiple non-body-handle connections from same source", () => {
      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "loop1",
          targetRequestId: "node1",
          branchId: "success",
          injections: [],
        },
      ];

      const connection: Connection = {
        source: "loop1",
        target: "node2",
        sourceHandle: "success",
        targetHandle: null,
      };

      const result = isValidChainConnection(connection, edges);
      expect(result).toBe(true);
    });
  });

  describe("getInvalidMergeNodeIds", () => {
    it("returns empty array when all Merges have two+ incoming edges", () => {
      const mergeNodes: MergeBlock[] = [
        { id: "merge1", type: "merge", mode: "all" },
      ];

      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "node1",
          targetRequestId: "merge1",
          branchId: undefined,
          injections: [],
        },
        {
          id: "edge2",
          sourceRequestId: "node2",
          targetRequestId: "merge1",
          branchId: undefined,
          injections: [],
        },
      ];

      const result = getInvalidMergeNodeIds(mergeNodes, edges);
      expect(result).toEqual([]);
    });

    it("returns Merge ids with fewer than two incoming edges", () => {
      const mergeNodes: MergeBlock[] = [
        { id: "merge1", type: "merge", mode: "all" },
        { id: "merge2", type: "merge", mode: "all" },
      ];

      const edges: ChainEdge[] = [
        {
          id: "edge1",
          sourceRequestId: "node1",
          targetRequestId: "merge1",
          branchId: undefined,
          injections: [],
        },
      ];

      const result = getInvalidMergeNodeIds(mergeNodes, edges);
      expect(result).toContain("merge1");
      expect(result).toContain("merge2");
      expect(result.length).toBe(2);
    });
  });
});

const CHAIN_ID = "chain-under-test";

describe("useChainConnect — onConnect", () => {
  function setup(chainEdges: ChainEdge[] = []) {
    const onUpsertEdge = vi.fn();
    const onDeleteEdge = vi.fn();
    const setEdges = vi.fn();
    const { result } = renderHook(() =>
      useChainConnect({
        chainId: CHAIN_ID,
        chainEdges,
        conditionNodes: [],
        delayNodes: [],
        displayNodes: [],
        onUpsertEdge,
        onDeleteEdge,
        setEdges,
      }),
    );
    return { result, onUpsertEdge, setEdges };
  }

  it("rejects a self-loop connection", () => {
    const { result, onUpsertEdge } = setup();
    result.current.onConnect({
      source: "n1",
      target: "n1",
      sourceHandle: null,
      targetHandle: null,
    });
    expect(toast.error).toHaveBeenCalledWith(
      "A node cannot connect to itself",
    );
    expect(onUpsertEdge).not.toHaveBeenCalled();
  });

  it("rejects a second connection from a Loop body handle", () => {
    const existingEdge: ChainEdge = {
      id: "e1",
      sourceRequestId: "loop1",
      targetRequestId: "n2",
      branchId: LOOP_BODY_HANDLE_ID,
      injections: [],
    };
    const { result, onUpsertEdge } = setup([existingEdge]);
    result.current.onConnect({
      source: "loop1",
      target: "n3",
      sourceHandle: LOOP_BODY_HANDLE_ID,
      targetHandle: null,
    });
    expect(toast.error).toHaveBeenCalledWith(
      "This handle already has a connection",
    );
    expect(onUpsertEdge).not.toHaveBeenCalled();
  });

  it("rejects an exact duplicate edge", () => {
    const existingEdge: ChainEdge = {
      id: "e1",
      sourceRequestId: "n1",
      targetRequestId: "n2",
      branchId: undefined,
      injections: [],
    };
    const { result, onUpsertEdge } = setup([existingEdge]);
    result.current.onConnect({
      source: "n1",
      target: "n2",
      sourceHandle: null,
      targetHandle: null,
    });
    expect(toast.error).toHaveBeenCalledWith(
      "This connection already exists",
    );
    expect(onUpsertEdge).not.toHaveBeenCalled();
  });

  it("accepts a valid, non-duplicate connection", () => {
    const { result, onUpsertEdge, setEdges } = setup();
    result.current.onConnect({
      source: "n1",
      target: "n2",
      sourceHandle: null,
      targetHandle: null,
    });
    expect(onUpsertEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRequestId: "n1",
        targetRequestId: "n2",
      }),
    );
    expect(setEdges).toHaveBeenCalled();
  });

  it("ignores an incomplete connection", () => {
    const { result, onUpsertEdge } = setup();
    result.current.onConnect({
      source: "n1",
      target: null as unknown as string,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(onUpsertEdge).not.toHaveBeenCalled();
  });

  it("adds the new edge to the flow edges through the setEdges updater", () => {
    const { result, setEdges } = setup();
    result.current.onConnect({
      source: "n1",
      target: "n2",
      sourceHandle: null,
      targetHandle: null,
    });
    const updater = setEdges.mock.calls[0][0] as (e: unknown[]) => unknown[];
    expect(updater([])).toHaveLength(1);
  });

  describe("routing injection", () => {
    function connectWith(
      ids: { condition?: string; delay?: string; display?: string },
      connection: { source: string; target: string; sourceHandle?: string },
    ) {
      const onUpsertEdge = vi.fn();
      const { result } = renderHook(() =>
        useChainConnect({
          chainId: CHAIN_ID,
          chainEdges: [],
          conditionNodes: ids.condition ? [{ id: ids.condition, branches: [] } as never] : [],
          delayNodes: ids.delay ? [{ id: ids.delay } as never] : [],
          displayNodes: ids.display ? [{ id: ids.display } as never] : [],
          onUpsertEdge,
          onDeleteEdge: vi.fn(),
          setEdges: vi.fn(),
        }),
      );
      result.current.onConnect({
        sourceHandle: null,
        targetHandle: null,
        ...connection,
      });
      return onUpsertEdge.mock.calls[0][0] as ChainEdge;
    }

    it.each([
      ["condition branch source", { condition: "x" }, { source: "x", target: "y", sourceHandle: "b1" }],
      ["condition target", { condition: "x" }, { source: "y", target: "x" }],
      ["delay source", { delay: "x" }, { source: "x", target: "y" }],
      ["delay target", { delay: "x" }, { source: "y", target: "x" }],
      ["display source", { display: "x" }, { source: "x", target: "y" }],
      ["display target", { display: "x" }, { source: "y", target: "x" }],
      ["fail branch", {}, { source: "y", target: "z", sourceHandle: "fail" }],
    ])("seeds a routing injection for a %s", (_label, ids, connection) => {
      expect(connectWith(ids, connection).injections).toHaveLength(1);
    });

    it("leaves a plain API-to-API edge without injections", () => {
      expect(
        connectWith({}, { source: "a", target: "b" }).injections,
      ).toEqual([]);
    });

    it("does not treat a condition source without a handle as routing", () => {
      expect(
        connectWith({ condition: "x" }, { source: "x", target: "y" })
          .injections,
      ).toEqual([]);
    });
  });

  describe("Loop nesting depth", () => {
    const loop = (id: string): ChainBlock => ({
      id,
      type: "loop",
      sourceJsonPath: "$.items",
      itemAlias: "item",
      maxIterations: 10,
    });
    const body = (id: string, from: string, to: string): ChainEdge => ({
      id,
      sourceRequestId: from,
      targetRequestId: to,
      branchId: LOOP_BODY_HANDLE_ID,
      injections: [],
    });
    const plain = (id: string, from: string, to: string): ChainEdge => ({
      id,
      sourceRequestId: from,
      targetRequestId: to,
      injections: [],
    });

    it("counts a Loop nested behind an intermediate request", () => {
      const blocks = [loop("l1"), loop("l2")];
      const edges = [body("e1", "l1", "req"), plain("e2", "req", "l2")];
      expect(getMaxLoopNestingDepth(blocks, edges)).toBe(2);
    });

    it("does not count a sequential Loop after the Collect as nested", () => {
      const blocks: ChainBlock[] = [
        loop("l1"),
        { id: "c1", type: "collect", loopId: "l1" },
        loop("l2"),
      ];
      const edges = [body("e1", "l1", "c1"), plain("e2", "c1", "l2")];
      expect(getMaxLoopNestingDepth(blocks, edges)).toBe(1);
    });

    it("refuses a connection that would nest a 4th Loop", () => {
      useChainStore.setState({
        chains: {
          [CHAIN_ID]: {
            id: CHAIN_ID,
            blocks: [loop("l1"), loop("l2"), loop("l3"), loop("l4")],
          } as never,
        },
      });
      const edges = [
        body("e1", "l1", "l2"),
        body("e2", "l2", "l3"),
      ];
      const { result, onUpsertEdge } = setup(edges);
      result.current.onConnect({
        source: "l3",
        target: "l4",
        sourceHandle: LOOP_BODY_HANDLE_ID,
        targetHandle: null,
      });
      expect(toast.error).toHaveBeenCalledWith(
        "Loops can nest at most 3 levels deep",
      );
      expect(onUpsertEdge).not.toHaveBeenCalled();
    });
  });
});
