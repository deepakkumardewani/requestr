/** @vitest-environment happy-dom */

import type { Node } from "@xyflow/react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useAlignSelection } from "./useAlignSelection";

const node = (id: string, x: number, y: number, selected = true): Node => ({
  id,
  position: { x, y },
  width: 100,
  height: 50,
  selected,
  data: {},
});

describe("useAlignSelection", () => {
  const updateNodePositions = vi.fn();

  beforeEach(() => {
    updateNodePositions.mockReset();
    vi.spyOn(useChainStore, "getState").mockReturnValue({
      updateNodePositions,
    } as unknown as ReturnType<typeof useChainStore.getState>);
  });

  it("counts only selected nodes", () => {
    const { result } = renderHook(() =>
      useAlignSelection({
        chainId: "c1",
        nodes: [node("a", 0, 0), node("b", 10, 0, false)],
        setNodes: vi.fn(),
      }),
    );
    expect(result.current.selectedCount).toBe(1);
  });

  it("aligns left in a single store mutation and updates local nodes", () => {
    const setNodes = vi.fn();
    const nodes = [node("a", 40, 0), node("b", 10, 80), node("c", 90, 160, false)];
    const { result } = renderHook(() =>
      useAlignSelection({ chainId: "c1", nodes, setNodes }),
    );

    act(() => result.current.align("left"));

    expect(updateNodePositions).toHaveBeenCalledTimes(1);
    expect(updateNodePositions).toHaveBeenCalledWith("c1", { a: { x: 10, y: 0 } });
    const updater = setNodes.mock.calls[0][0] as (n: Node[]) => Node[];
    expect(updater(nodes).map((n) => n.position.x)).toEqual([10, 10, 90]);
  });

  it("distributes 3 nodes horizontally with equal gaps", () => {
    const nodes = [node("a", 0, 0), node("b", 120, 0), node("c", 400, 0)];
    const { result } = renderHook(() =>
      useAlignSelection({ chainId: "c1", nodes, setNodes: vi.fn() }),
    );

    act(() => result.current.distribute("horizontal"));

    expect(updateNodePositions).toHaveBeenCalledTimes(1);
    expect(updateNodePositions).toHaveBeenCalledWith("c1", { b: { x: 200, y: 0 } });
  });

  it("does nothing when no position changes", () => {
    const { result } = renderHook(() =>
      useAlignSelection({
        chainId: "c1",
        nodes: [node("a", 5, 0), node("b", 5, 80)],
        setNodes: vi.fn(),
      }),
    );
    act(() => result.current.align("left"));
    expect(updateNodePositions).not.toHaveBeenCalled();
  });
});
