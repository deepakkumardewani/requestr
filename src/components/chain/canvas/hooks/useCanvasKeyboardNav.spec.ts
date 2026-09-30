/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import { useCanvasKeyboardNav } from "./useCanvasKeyboardNav";

function makeEvent(key: string) {
  return {
    key,
    target: document.createElement("div"),
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLDivElement>;
}

const nodes: Node[] = [
  { id: "a", type: "chainNode", position: { x: 0, y: 0 }, data: {} },
  { id: "b", type: "conditionNode", position: { x: 100, y: 0 }, data: {} },
];

function setup(keyboardFocusNodeId: string | null = null) {
  const setKeyboardFocusNodeId = vi.fn();
  const onClickNode = vi.fn();
  const onConfigureNode = vi.fn();
  const onCloseDetails = vi.fn();
  const { result } = renderHook(() =>
    useCanvasKeyboardNav({
      nodes,
      keyboardFocusNodeId,
      setKeyboardFocusNodeId,
      pendingNodeType: null,
      onClickNode,
      onConfigureNode,
      onCloseDetails,
    }),
  );
  return {
    onCanvasKeyDown: result.current,
    setKeyboardFocusNodeId,
    onClickNode,
    onConfigureNode,
    onCloseDetails,
  };
}

describe("useCanvasKeyboardNav", () => {
  it("ArrowRight moves focus to the second node when nothing is focused", () => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup(null);
    onCanvasKeyDown(makeEvent("ArrowRight"));
    expect(setKeyboardFocusNodeId).toHaveBeenCalledWith("b");
  });

  it("ArrowLeft wraps around to the last node", () => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup("a");
    onCanvasKeyDown(makeEvent("ArrowLeft"));
    expect(setKeyboardFocusNodeId).toHaveBeenCalledWith("b");
  });

  it("Enter on a chainNode opens node details via onClickNode", () => {
    const { onCanvasKeyDown, onClickNode } = setup("a");
    onCanvasKeyDown(makeEvent("Enter"));
    expect(onClickNode).toHaveBeenCalledWith("a");
  });

  it("Enter on a conditionNode configures it", () => {
    const { onCanvasKeyDown, onConfigureNode } = setup("b");
    onCanvasKeyDown(makeEvent("Enter"));
    expect(onConfigureNode).toHaveBeenCalledWith("b");
  });

  it("Escape clears focus and closes details", () => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId, onCloseDetails } =
      setup("a");
    onCanvasKeyDown(makeEvent("Escape"));
    expect(setKeyboardFocusNodeId).toHaveBeenCalledWith(null);
    expect(onCloseDetails).toHaveBeenCalled();
  });
});
