/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasCommands } from "./useCanvasCommands";

const store = vi.hoisted(() => ({
  duplicateNode: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  removeNodes: vi.fn(),
}));
const nudge = vi.hoisted(() => vi.fn());
const shortcuts = vi.hoisted(() => vi.fn());

vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => store },
}));
vi.mock("./useChainCanvasShortcuts", () => ({
  useChainCanvasShortcuts: shortcuts,
}));

beforeEach(() => {
  shortcuts.mockReturnValue({ nudge });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  return renderHook(() =>
    useCanvasCommands({
      chainId: "c1",
      requests: [{ id: "api-1" }] as never,
      blocks: [],
      collectNodes: [],
      nodes: [
        { id: "a", selected: true },
        { id: "b", selected: false },
        { id: "c", selected: true },
      ] as never,
      edges: [],
      setNodes: vi.fn(),
      chainEdges: [],
      nodePositions: {},
      canvasFocused: true,
      isRunning: false,
      onUpdateNodePosition: vi.fn(),
    }),
  );
}

const wired = () => shortcuts.mock.calls.at(-1)?.[0];

describe("useCanvasCommands", () => {
  it("exposes the shortcut-owned nudge command", () => {
    expect(setup().result.current.nudge).toBe(nudge);
  });

  it("opens the find dialog from the shortcut and lets it close itself", () => {
    const { result } = setup();
    expect(result.current.findNode.open).toBe(false);
    act(() => wired().onOpenFindNode());
    expect(result.current.findNode.open).toBe(true);
    act(() => result.current.findNode.onOpenChange(false));
    expect(result.current.findNode.open).toBe(false);
  });

  it("passes the set of API node ids and clipboard state to the shortcuts", () => {
    setup();
    expect(wired().apiNodeIds).toEqual(new Set(["api-1"]));
    expect(wired().hasClipboard).toBe(false);
  });

  it("duplicates, undoes and redoes through the chain store", () => {
    const { result } = setup();
    result.current.duplicateBlock("b1");
    expect(store.duplicateNode).toHaveBeenCalledWith("c1", "b1");
    wired().onUndo();
    wired().onRedo();
    expect(store.undo).toHaveBeenCalledWith("c1");
    expect(store.redo).toHaveBeenCalledWith("c1");
  });

  it("deletes the whole selection in one store action", () => {
    setup();
    wired().onDeleteSelection();
    expect(store.removeNodes).toHaveBeenCalledWith("c1", ["a", "c"]);
  });

  it("clicks the block-menu trigger", () => {
    const { result } = setup();
    const trigger = document.createElement("button");
    trigger.dataset.testid = "block-menu-trigger";
    const click = vi.fn();
    trigger.addEventListener("click", click);
    document.body.append(trigger);
    result.current.openBlockMenu();
    expect(click).toHaveBeenCalledTimes(1);
    trigger.remove();
  });

  it("does not throw when the block-menu trigger is absent", () => {
    const { result } = setup();
    expect(() => result.current.openBlockMenu()).not.toThrow();
  });
});
