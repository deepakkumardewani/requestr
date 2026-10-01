/** @vitest-environment happy-dom */
import type { Node } from "@xyflow/react";
import { cleanup, renderHook } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOOP_BODY_HANDLE_ID } from "@/types/chain";
import { useFlowHandlers } from "./useFlowHandlers";

const store = vi.hoisted(() => ({
  pauseHistory: vi.fn(),
  resumeHistory: vi.fn(),
}));
vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => store },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const params = {
    chainId: "c1",
    chainEdges: [],
    onEdgesChange: vi.fn(),
    onDeleteEdge: vi.fn(),
    onUpdateNodePosition: vi.fn(),
  };
  return { params, ...renderHook(() => useFlowHandlers(params)) };
}

describe("useFlowHandlers", () => {
  it("wraps a drag in one history step and persists the final position", () => {
    const { result, params } = setup();
    result.current.onNodeDragStart();
    expect(store.pauseHistory).toHaveBeenCalledWith("c1");
    result.current.onNodeDragStop({} as ReactMouseEvent, {
      id: "n1",
      position: { x: 3, y: 4 },
    } as Node);
    expect(params.onUpdateNodePosition).toHaveBeenCalledWith("n1", {
      x: 3,
      y: 4,
    });
    expect(store.resumeHistory).toHaveBeenCalledWith("c1");
  });

  it("forwards edge changes and deletes removed edges", () => {
    const { result, params } = setup();
    const changes = [
      { type: "remove", id: "e1" },
      { type: "select", id: "e2", selected: true },
    ] as never;
    result.current.handleEdgesChange(changes);
    expect(params.onEdgesChange).toHaveBeenCalledWith(changes);
    expect(params.onDeleteEdge).toHaveBeenCalledTimes(1);
    expect(params.onDeleteEdge).toHaveBeenCalledWith("e1");
  });

  it("rejects a second edge from an already-used single-use loop handle", () => {
    const params = {
      chainId: "c1",
      chainEdges: [
        { id: "e1", sourceRequestId: "loop", branchId: LOOP_BODY_HANDLE_ID },
      ] as never,
      onEdgesChange: vi.fn(),
      onDeleteEdge: vi.fn(),
      onUpdateNodePosition: vi.fn(),
    };
    const { result } = renderHook(() => useFlowHandlers(params));
    const connection = {
      source: "loop",
      target: "x",
      sourceHandle: LOOP_BODY_HANDLE_ID,
      targetHandle: null,
    };
    expect(result.current.isValidConnection(connection)).toBe(false);
    expect(
      result.current.isValidConnection({ ...connection, source: "other" }),
    ).toBe(true);
  });
});
