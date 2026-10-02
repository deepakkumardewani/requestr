/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import type { Chain } from "@/types/chain";
import { NUDGE_COALESCE_MS, useNudge } from "./useNudge";

vi.mock("@/lib/idb", () => ({
  getDB: () => Promise.resolve({ put: vi.fn(), get: vi.fn() }),
}));

const CHAIN_ID = "c1";

const node = (id: string, x: number, y: number, selected = false): Node => ({
  id,
  selected,
  position: { x, y },
  data: {},
});

function seedChain() {
  const chain = {
    id: CHAIN_ID,
    name: "c",
    nodeIds: [],
    blocks: [],
    edges: [],
    nodePositions: { a: { x: 0, y: 0 }, b: { x: 50, y: 50 } },
  } as unknown as Chain;
  useChainStore.setState({
    chains: { [CHAIN_ID]: chain },
    history: {},
    pausedHistory: {},
  });
}

const historyDepth = () =>
  useChainStore.getState().history[CHAIN_ID]?.past.length ?? 0;
const positionOf = (id: string) =>
  useChainStore.getState().chains[CHAIN_ID].nodePositions[id];

function setup(nodes: Node[], disabled = false) {
  const setNodes = vi.fn();
  const { result } = renderHook(() =>
    useNudge({ chainId: CHAIN_ID, nodes, setNodes, disabled }),
  );
  return { nudge: result.current, setNodes };
}

describe("useNudge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seedChain();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves the selected nodes by one grid step", () => {
    const { nudge } = setup([node("a", 0, 0, true), node("b", 50, 50)]);
    expect(nudge("right")).toBe(true);
    expect(positionOf("a")).toEqual({ x: 16, y: 0 });
    expect(positionOf("b")).toEqual({ x: 50, y: 50 });
  });

  it.each([
    ["up", { x: 0, y: -16 }],
    ["down", { x: 0, y: 16 }],
    ["left", { x: -16, y: 0 }],
    ["right", { x: 16, y: 0 }],
  ] as const)("%s moves a single step", (direction, expected) => {
    const { nudge } = setup([node("a", 0, 0, true)]);
    nudge(direction);
    expect(positionOf("a")).toEqual(expected);
  });

  it("moves ten steps with the large flag", () => {
    const { nudge } = setup([node("a", 0, 0, true)]);
    nudge("down", true);
    expect(positionOf("a")).toEqual({ x: 0, y: 160 });
  });

  it("updates local canvas nodes too", () => {
    const { nudge, setNodes } = setup([node("a", 0, 0, true)]);
    nudge("left");
    const updater = setNodes.mock.calls[0][0] as (prev: Node[]) => Node[];
    const next = updater([node("a", 0, 0, true), node("b", 5, 5)]);
    expect(next[0].position).toEqual({ x: -16, y: 0 });
    expect(next[1].position).toEqual({ x: 5, y: 5 });
  });

  it("is a no-op without a selection", () => {
    const { nudge, setNodes } = setup([node("a", 0, 0)]);
    expect(nudge("right")).toBe(false);
    expect(setNodes).not.toHaveBeenCalled();
    expect(historyDepth()).toBe(0);
  });

  it("is a no-op while disabled", () => {
    const { nudge } = setup([node("a", 0, 0, true)], true);
    expect(nudge("right")).toBe(false);
    expect(historyDepth()).toBe(0);
  });

  it("folds a burst into one undo entry", () => {
    const { nudge } = setup([node("a", 0, 0, true)]);
    nudge("right");
    vi.advanceTimersByTime(100);
    nudge("right");
    vi.advanceTimersByTime(100);
    nudge("right");
    expect(historyDepth()).toBe(1);
    expect(useChainStore.getState().pausedHistory).toEqual({});
    act(() => useChainStore.getState().undo(CHAIN_ID));
    expect(positionOf("a")).toEqual({ x: 0, y: 0 });
  });

  it("opens a second undo entry after a gap over the window", () => {
    const { nudge } = setup([node("a", 0, 0, true)]);
    nudge("right");
    vi.advanceTimersByTime(NUDGE_COALESCE_MS + 1);
    nudge("right");
    expect(historyDepth()).toBe(2);
  });

  it("leaves an enclosing history batch paused", () => {
    const { nudge } = setup([node("a", 0, 0, true)]);
    nudge("right");
    useChainStore.getState().pauseHistory(CHAIN_ID);
    vi.advanceTimersByTime(50);
    nudge("right");
    expect(CHAIN_ID in useChainStore.getState().pausedHistory).toBe(true);
  });
});
