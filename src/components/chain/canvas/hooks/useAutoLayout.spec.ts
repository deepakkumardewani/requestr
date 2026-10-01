/** @vitest-environment happy-dom */
import type { Edge, Node } from "@xyflow/react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIT_VIEW_OPTIONS, useAutoLayout } from "./useAutoLayout";

const fitView = vi.fn();
const toastSuccess = vi.hoisted(() => vi.fn());
const computeAutoLayout = vi.hoisted(() => vi.fn());

vi.mock("@xyflow/react", () => ({ useReactFlow: () => ({ fitView }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("@/lib/chainLayout", () => ({ computeAutoLayout }));

const callOrder: string[] = [];
const store = vi.hoisted(() => ({
  pauseHistory: vi.fn(),
  resumeHistory: vi.fn(),
}));
vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => store },
}));

const nodes = [
  { id: "a", position: { x: 0, y: 0 }, data: {} },
  { id: "b", position: { x: 5, y: 5 }, data: {} },
] as Node[];

describe("useAutoLayout", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    computeAutoLayout.mockReturnValue({ a: { x: 100, y: 200 } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("re-positions laid-out nodes, keeps the rest, persists, fits the view and confirms", () => {
    const setNodes = vi.fn();
    const onUpdateNodePosition = vi.fn();
    const edges = [] as Edge[];
    const { result } = renderHook(() =>
      useAutoLayout({
        chainId: "chain-1",
        nodes,
        edges,
        setNodes,
        onUpdateNodePosition,
      }),
    );
    result.current();

    expect(computeAutoLayout).toHaveBeenCalledWith(nodes, edges);
    const updater = setNodes.mock.calls[0][0] as (prev: Node[]) => Node[];
    expect(updater(nodes).map((n) => n.position)).toEqual([
      { x: 100, y: 200 },
      { x: 5, y: 5 },
    ]);
    expect(onUpdateNodePosition).toHaveBeenCalledTimes(1);
    expect(onUpdateNodePosition).toHaveBeenCalledWith("a", { x: 100, y: 200 });
    expect(fitView).toHaveBeenCalledWith(FIT_VIEW_OPTIONS);
    expect(toastSuccess).toHaveBeenCalledWith("Layout applied");
  });

  it("wraps the per-node position updates in one history batch", () => {
    callOrder.length = 0;
    computeAutoLayout.mockReturnValue({
      a: { x: 100, y: 200 },
      b: { x: 300, y: 400 },
    });
    store.pauseHistory.mockImplementation((id: string) =>
      callOrder.push(`pause:${id}`),
    );
    store.resumeHistory.mockImplementation((id: string) =>
      callOrder.push(`resume:${id}`),
    );
    const onUpdateNodePosition = vi.fn((id: string) =>
      callOrder.push(`move:${id}`),
    );
    const { result } = renderHook(() =>
      useAutoLayout({
        chainId: "chain-1",
        nodes,
        edges: [],
        setNodes: vi.fn(),
        onUpdateNodePosition,
      }),
    );
    result.current();

    expect(callOrder).toEqual([
      "pause:chain-1",
      "move:a",
      "move:b",
      "resume:chain-1",
    ]);
  });
});
