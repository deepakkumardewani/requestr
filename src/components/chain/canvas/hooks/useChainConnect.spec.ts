/** @vitest-environment happy-dom */

import { cleanup, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOOP_BODY_HANDLE_ID } from "@/components/chain/nodes/LoopNode";
import type { ChainBlock, ChainEdge, MergeBlock } from "@/types/chain";
import {
  getInvalidMergeNodeIds,
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
        { id: "api1", type: "api", requestId: "req1" } as any,
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
        { id: "api1", type: "api", requestId: "req1" } as any,
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
      const connection = {
        source: "node1",
        target: "node2",
        sourceHandle: null,
      } as any;

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

      const connection = {
        source: "loop1",
        target: "node2",
        sourceHandle: "body",
      } as any;

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

      const connection = {
        source: "loop1",
        target: "node2",
        sourceHandle: "success",
      } as any;

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

describe("useChainConnect — onConnect", () => {
  function setup(chainEdges: ChainEdge[] = []) {
    const onUpsertEdge = vi.fn();
    const onDeleteEdge = vi.fn();
    const setEdges = vi.fn();
    const { result } = renderHook(() =>
      useChainConnect({
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
});
