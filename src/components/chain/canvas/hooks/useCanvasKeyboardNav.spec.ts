/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import { useCanvasKeyboardNav } from "./useCanvasKeyboardNav";
import type { NudgeDirection } from "./useNudge";

type EventOptions = { shiftKey?: boolean; outsideCanvas?: boolean };

/** `currentTarget` is the canvas wrapper; `outsideCanvas` models a portaled panel's target. */
function makeEvent(key: string, { shiftKey = false, outsideCanvas = false }: EventOptions = {}) {
  const wrapper = document.createElement("div");
  const target = document.createElement("div");
  if (!outsideCanvas) wrapper.appendChild(target);
  return {
    key,
    shiftKey,
    target,
    currentTarget: wrapper,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLDivElement>;
}

const nodes: Node[] = [
  { id: "a", type: "chainNode", position: { x: 0, y: 0 }, data: {} },
  { id: "b", type: "conditionNode", position: { x: 100, y: 0 }, data: {} },
];

function setup(
  keyboardFocusNodeId: string | null = null,
  onNudge?: (direction: NudgeDirection, large: boolean) => boolean,
) {
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
      onNudge,
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
    expect(onConfigureNode).toHaveBeenCalledWith(nodes[1]);
  });

  it("Enter on a chainNode never uses the generic configure path", () => {
    const { onCanvasKeyDown, onConfigureNode } = setup("a");
    onCanvasKeyDown(makeEvent("Enter"));
    expect(onConfigureNode).not.toHaveBeenCalled();
  });

  it.each([
    "startNode",
    "delayNode",
    "displayNode",
    "evaluateNode",
    "validateNode",
    "mergeNode",
    "loopNode",
    "collectNode",
    "subchainNode",
  ])("Enter on a %s hands the node to onConfigureNode", (type) => {
    const node: Node = { id: "n", type, position: { x: 0, y: 0 }, data: {} };
    const onClickNode = vi.fn();
    const onConfigureNode = vi.fn();
    const { result } = renderHook(() =>
      useCanvasKeyboardNav({
        nodes: [node],
        keyboardFocusNodeId: "n",
        setKeyboardFocusNodeId: vi.fn(),
        pendingNodeType: null,
        onClickNode,
        onConfigureNode,
        onCloseDetails: vi.fn(),
      }),
    );
    result.current(makeEvent("Enter"));
    expect(onConfigureNode).toHaveBeenCalledWith(node);
    expect(onClickNode).not.toHaveBeenCalled();
  });

  it("ignores Enter while a ghost block is being placed", () => {
    const onConfigureNode = vi.fn();
    const { result } = renderHook(() =>
      useCanvasKeyboardNav({
        nodes,
        keyboardFocusNodeId: "b",
        setKeyboardFocusNodeId: vi.fn(),
        pendingNodeType: "delay",
        onClickNode: vi.fn(),
        onConfigureNode,
        onCloseDetails: vi.fn(),
      }),
    );
    result.current(makeEvent("Enter"));
    expect(onConfigureNode).not.toHaveBeenCalled();
  });

  it("ignores Enter typed into form fields", () => {
    const { onCanvasKeyDown, onConfigureNode } = setup("b");
    const event = {
      ...makeEvent("Enter"),
      target: document.createElement("input"),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;
    onCanvasKeyDown(event);
    expect(onConfigureNode).not.toHaveBeenCalled();
  });

  it("Escape clears focus and closes details", () => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId, onCloseDetails } =
      setup("a");
    onCanvasKeyDown(makeEvent("Escape"));
    expect(setKeyboardFocusNodeId).toHaveBeenCalledWith(null);
    expect(onCloseDetails).toHaveBeenCalled();
  });

  it("ignores keys typed into form fields", () => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup();
    const input = document.createElement("input");
    const event = {
      key: "ArrowRight",
      target: input,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLDivElement>;
    onCanvasKeyDown(event);
    expect(setKeyboardFocusNodeId).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores keys while a ghost block is being placed", () => {
    const setKeyboardFocusNodeId = vi.fn();
    const { result } = renderHook(() =>
      useCanvasKeyboardNav({
        nodes,
        keyboardFocusNodeId: null,
        setKeyboardFocusNodeId,
        pendingNodeType: "delay",
        onClickNode: vi.fn(),
        onConfigureNode: vi.fn(),
        onCloseDetails: vi.fn(),
      }),
    );
    result.current(makeEvent("ArrowRight"));
    expect(setKeyboardFocusNodeId).not.toHaveBeenCalled();
  });

  it("does nothing on an empty canvas", () => {
    const setKeyboardFocusNodeId = vi.fn();
    const { result } = renderHook(() =>
      useCanvasKeyboardNav({
        nodes: [],
        keyboardFocusNodeId: null,
        setKeyboardFocusNodeId,
        pendingNodeType: null,
        onClickNode: vi.fn(),
        onConfigureNode: vi.fn(),
        onCloseDetails: vi.fn(),
      }),
    );
    result.current(makeEvent("Escape"));
    expect(setKeyboardFocusNodeId).not.toHaveBeenCalled();
  });

  it("Enter with a stale focus id does nothing; unrelated keys are ignored", () => {
    const { onCanvasKeyDown, onClickNode, setKeyboardFocusNodeId } =
      setup("gone");
    onCanvasKeyDown(makeEvent("Enter"));
    onCanvasKeyDown(makeEvent("x"));
    expect(onClickNode).not.toHaveBeenCalled();
    expect(setKeyboardFocusNodeId).not.toHaveBeenCalled();
  });

  it("ArrowDown/ArrowUp step through nodes in reading order, wrapping", () => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup("b");
    onCanvasKeyDown(makeEvent("ArrowDown"));
    expect(setKeyboardFocusNodeId).toHaveBeenLastCalledWith("a");
    onCanvasKeyDown(makeEvent("ArrowUp"));
    expect(setKeyboardFocusNodeId).toHaveBeenLastCalledWith("a");
  });

  it.each([
    ["role=textbox", '<div role="textbox"><span></span></div>'],
    ["select", "<select></select>"],
    ["CodeMirror", '<div class="cm-editor"><div class="cm-content"></div></div>'],
  ])("ignores keys typed into %s", (_name, html) => {
    const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup("a");
    const host = document.createElement("div");
    host.innerHTML = html;
    const target = host.querySelector("span, .cm-content") ?? host.firstElementChild;
    const event = { ...makeEvent("ArrowRight"), target } as unknown as React.KeyboardEvent<HTMLDivElement>;
    onCanvasKeyDown(event);
    expect(setKeyboardFocusNodeId).not.toHaveBeenCalled();
  });

  describe("arrow nudge", () => {
    it.each([
      ["ArrowUp", "up"],
      ["ArrowDown", "down"],
      ["ArrowLeft", "left"],
      ["ArrowRight", "right"],
    ])("%s nudges %s and skips focus navigation", (key, direction) => {
      const onNudge = vi.fn().mockReturnValue(true);
      const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup("a", onNudge);
      const event = makeEvent(key);
      onCanvasKeyDown(event);
      expect(onNudge).toHaveBeenCalledWith(direction, false);
      expect(setKeyboardFocusNodeId).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("passes Shift through as the large step", () => {
      const onNudge = vi.fn().mockReturnValue(true);
      const { onCanvasKeyDown } = setup("a", onNudge);
      onCanvasKeyDown(makeEvent("ArrowRight", { shiftKey: true }));
      expect(onNudge).toHaveBeenCalledWith("right", true);
    });

    it("falls back to focus navigation when nothing is selected", () => {
      const onNudge = vi.fn().mockReturnValue(false);
      const { onCanvasKeyDown, setKeyboardFocusNodeId } = setup(null, onNudge);
      onCanvasKeyDown(makeEvent("ArrowRight"));
      expect(setKeyboardFocusNodeId).toHaveBeenCalledWith("b");
    });

    it("never nudges from outside the canvas DOM (portaled panel focus)", () => {
      const onNudge = vi.fn().mockReturnValue(true);
      const { onCanvasKeyDown } = setup("a", onNudge);
      onCanvasKeyDown(makeEvent("ArrowRight", { outsideCanvas: true }));
      expect(onNudge).not.toHaveBeenCalled();
    });

    it("never nudges while typing in a form field", () => {
      const onNudge = vi.fn().mockReturnValue(true);
      const { onCanvasKeyDown } = setup("a", onNudge);
      const event = {
        ...makeEvent("ArrowRight"),
        target: document.createElement("input"),
      } as unknown as React.KeyboardEvent<HTMLDivElement>;
      onCanvasKeyDown(event);
      expect(onNudge).not.toHaveBeenCalled();
    });
  });
});
