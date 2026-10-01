/** @vitest-environment happy-dom */
import type { Node } from "@xyflow/react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollectBlock } from "@/types/chain";
import { useChainCanvasShortcuts } from "./useChainCanvasShortcuts";

const store = vi.hoisted(() => ({
  pauseHistory: vi.fn(),
  resumeHistory: vi.fn(),
}));
const useKeyboardShortcuts = vi.hoisted(() => vi.fn());
const autoLayout = vi.hoisted(() => vi.fn());
const fitView = vi.fn();

vi.mock("@xyflow/react", () => ({ useReactFlow: () => ({ fitView }) }));
vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => store },
}));
vi.mock("@/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts }));
vi.mock("./useAutoLayout", () => ({
  FIT_VIEW_OPTIONS: { padding: 0.2 },
  useAutoLayout: () => autoLayout,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const node = (id: string, selected = false): Node => ({
  id,
  selected,
  position: { x: 0, y: 0 },
  data: {},
});

function setup(
  overrides: Partial<Parameters<typeof useChainCanvasShortcuts>[0]> = {},
) {
  const params = {
    chainId: "c1",
    nodes: [node("api-1", true), node("blk", true), node("idle")],
    edges: [],
    setNodes: vi.fn(),
    collectNodes: [] as CollectBlock[],
    canvasFocused: true,
    hasClipboard: true,
    isRunning: false,
    apiNodeIds: new Set(["api-1"]),
    onDuplicateApiNode: vi.fn(),
    onDuplicateBlock: vi.fn(),
    onUpdateNodePosition: vi.fn(),
    onCopySelection: vi.fn(),
    onPasteSelection: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onOpenBlockMenu: vi.fn(),
    onDeleteSelection: vi.fn(),
    ...overrides,
  };
  renderHook(() => useChainCanvasShortcuts(params));
  const [handlers, options] = useKeyboardShortcuts.mock.calls.at(-1) ?? [];
  return { params, handlers, options };
}

describe("useChainCanvasShortcuts", () => {
  it("forwards focus, clipboard and selection state to the key binder", () => {
    expect(setup().options).toEqual({
      canvasFocused: true,
      hasClipboard: true,
      hasSelection: true,
    });
    expect(setup({ nodes: [node("a")] }).options.hasSelection).toBe(false);
  });

  it("passes plain commands straight through", () => {
    const { params, handlers } = setup();
    for (const key of [
      "onCopySelection",
      "onPasteSelection",
      "onUndo",
      "onRedo",
      "onOpenBlockMenu",
      "onDeleteSelection",
    ] as const) {
      expect(handlers[key]).toBe(params[key]);
    }
  });

  it("duplicates selected API nodes and blocks as one history step", () => {
    const { params, handlers } = setup();
    handlers.onDuplicateSelection();
    expect(params.onDuplicateApiNode).toHaveBeenCalledWith("api-1");
    expect(params.onDuplicateBlock).toHaveBeenCalledWith("blk");
    expect(params.onDuplicateBlock).not.toHaveBeenCalledWith("idle");
    expect(store.pauseHistory).toHaveBeenCalledWith("c1");
    expect(store.resumeHistory).toHaveBeenCalledWith("c1");
  });

  it("skips a Collect whose Loop is also selected", () => {
    const collect = { id: "blk", loopId: "loop" } as CollectBlock;
    const { params, handlers } = setup({
      nodes: [node("loop", true), node("blk", true)],
      collectNodes: [collect],
    });
    handlers.onDuplicateSelection();
    expect(params.onDuplicateBlock).toHaveBeenCalledTimes(1);
    expect(params.onDuplicateBlock).toHaveBeenCalledWith("loop");
  });

  it("does not duplicate while running or with nothing selected", () => {
    const running = setup({ isRunning: true });
    running.handlers.onDuplicateSelection();
    expect(running.params.onDuplicateBlock).not.toHaveBeenCalled();
    const empty = setup({ nodes: [node("idle")] });
    empty.handlers.onDuplicateSelection();
    expect(store.pauseHistory).not.toHaveBeenCalled();
  });

  it("tolerates a missing API duplicate handler", () => {
    const { handlers } = setup({ onDuplicateApiNode: undefined });
    expect(() => handlers.onDuplicateSelection()).not.toThrow();
  });

  it("selects all nodes and fits the view", () => {
    const { params, handlers } = setup();
    handlers.onSelectAll();
    const updater = vi.mocked(params.setNodes).mock.calls[0][0] as (p: Node[]) => Node[];
    expect(updater(params.nodes).every((n) => n.selected)).toBe(true);
    handlers.onFitViewChain();
    expect(fitView).toHaveBeenCalledWith({ padding: 0.2 });
  });

  it("offers auto-layout only while not running", () => {
    expect(setup().handlers.onAutoLayoutChain).toBe(autoLayout);
    expect(setup({ isRunning: true }).handlers.onAutoLayoutChain).toBeUndefined();
  });
});
