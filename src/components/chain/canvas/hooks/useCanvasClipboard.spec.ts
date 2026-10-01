/** @vitest-environment happy-dom */
import type { Node } from "@xyflow/react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/useUIStore";
import type { ChainBlock, ChainEdge } from "@/types/chain";
import { PASTE_OFFSET, useCanvasClipboard } from "./useCanvasClipboard";

const store = vi.hoisted(() => ({
  pauseHistory: vi.fn(),
  resumeHistory: vi.fn(),
  upsertBlock: vi.fn(),
  upsertEdge: vi.fn(),
  updateNodePosition: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => store },
}));

const DELAY: ChainBlock = { id: "d1", type: "delay", delayMs: 100 };
const DISPLAY: ChainBlock = {
  id: "disp1",
  type: "display",
  label: "Out",
  fields: [],
} as unknown as ChainBlock;
const LOOP = { id: "l1", type: "loop" } as unknown as ChainBlock;
const START: ChainBlock = { id: "s1", type: "start", inputs: [] };

const edge = (id: string, from: string, to: string): ChainEdge =>
  ({ id, sourceRequestId: from, targetRequestId: to, injections: [] }) as never;

const selected = (...ids: string[]): Node[] =>
  ids.map((id) => ({ id, position: { x: 0, y: 0 }, data: {}, selected: true }));

const POSITIONS = { d1: { x: 10, y: 20 }, disp1: { x: 30, y: 40 } };

function setup(overrides: Partial<Parameters<typeof useCanvasClipboard>[0]> = {}) {
  return renderHook(() =>
    useCanvasClipboard({
      chainId: "c1",
      nodes: selected("d1", "disp1"),
      blocks: [DELAY, DISPLAY, LOOP, START],
      chainEdges: [],
      nodePositions: POSITIONS,
      ...overrides,
    }),
  );
}

describe("useCanvasClipboard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ chainClipboard: null });
  });

  it("copies selected supported blocks with positions and only internal edges", () => {
    const internal = edge("e1", "d1", "disp1");
    const { result } = setup({
      chainEdges: [internal, edge("e2", "d1", "outside")],
    });
    act(() => result.current.copySelection());
    expect(useUIStore.getState().chainClipboard).toEqual({
      blocks: [DELAY, DISPLAY],
      edges: [internal],
      positions: POSITIONS,
    });
  });

  it("defaults a missing position to the origin", () => {
    const { result } = setup({ nodePositions: {} });
    act(() => result.current.copySelection());
    expect(useUIStore.getState().chainClipboard?.positions.d1).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("ignores unsupported block types and unselected blocks", () => {
    const { result } = setup({ nodes: selected("l1", "s1", "api-1") });
    act(() => result.current.copySelection());
    expect(useUIStore.getState().chainClipboard).toBeNull();
  });

  it("does nothing when pasting an empty clipboard", () => {
    const { result } = setup();
    expect(result.current.hasClipboard).toBe(false);
    act(() => result.current.pasteSelection());
    expect(store.upsertBlock).not.toHaveBeenCalled();
  });

  it("pastes copies under fresh ids, offset, edges remapped, as one history step", () => {
    const { result } = setup({ chainEdges: [edge("e1", "d1", "disp1")] });
    act(() => result.current.copySelection());
    expect(result.current.hasClipboard).toBe(true);
    act(() => result.current.pasteSelection());

    const newIds = store.upsertBlock.mock.calls.map(([, b]) => b.id);
    expect(newIds).toHaveLength(2);
    expect(newIds).not.toContain("d1");
    expect(store.updateNodePosition).toHaveBeenCalledWith("c1", newIds[0], {
      x: 10 + PASTE_OFFSET,
      y: 20 + PASTE_OFFSET,
    });
    const pasted = store.upsertEdge.mock.calls[0][1];
    expect(pasted).toMatchObject({
      sourceRequestId: newIds[0],
      targetRequestId: newIds[1],
    });
    expect(pasted.id).not.toBe("e1");
    expect(store.pauseHistory).toHaveBeenCalledTimes(1);
    expect(store.resumeHistory).toHaveBeenCalledTimes(1);
  });

  it("increments the offset on repeated pastes and resets on a new copy", () => {
    const { result } = setup();
    act(() => result.current.copySelection());
    act(() => result.current.pasteSelection());
    act(() => result.current.pasteSelection());
    const firstX = (n: number) => store.updateNodePosition.mock.calls[n][2].x;
    expect(firstX(0)).toBe(10 + PASTE_OFFSET);
    expect(firstX(2)).toBe(10 + PASTE_OFFSET * 2);

    act(() => result.current.copySelection());
    act(() => result.current.pasteSelection());
    expect(firstX(4)).toBe(10 + PASTE_OFFSET);
  });

  it("toasts how many selected blocks were skipped when some are not copyable", () => {
    const { result } = setup({ nodes: selected("d1", "l1", "s1") });
    act(() => result.current.copySelection());
    expect(toast.info).toHaveBeenCalledWith(
      "2 blocks can't be copied and were skipped.",
    );
    expect(useUIStore.getState().chainClipboard?.blocks).toEqual([DELAY]);
  });

  it("uses the singular form for one skipped block", () => {
    const { result } = setup({ nodes: selected("d1", "l1") });
    act(() => result.current.copySelection());
    expect(toast.info).toHaveBeenCalledWith(
      "1 block can't be copied and was skipped.",
    );
  });

  it("does not toast when every selected block is copied", () => {
    const { result } = setup();
    act(() => result.current.copySelection());
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("toasts and leaves the clipboard untouched when nothing is copyable", () => {
    const { result } = setup({ nodes: selected("l1") });
    act(() => result.current.copySelection());
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().chainClipboard).toBeNull();
  });
});
