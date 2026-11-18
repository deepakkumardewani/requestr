/** @vitest-environment happy-dom */
import type { Node } from "@xyflow/react";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainBlock } from "@/types/chain";
import {
  BLOCK_REGISTRY,
  type ConfigurableBlockType,
} from "../../blockRegistry";
import { useNodeInteractions } from "./useNodeInteractions";

afterEach(cleanup);

const node = (type: string | undefined): Node => ({
  id: "n1",
  type,
  position: { x: 0, y: 0 },
  data: {},
});
const mouse = () =>
  ({
    preventDefault: vi.fn(),
    clientX: 10,
    clientY: 20,
  } as unknown as ReactMouseEvent);

const CONFIGURABLE = (
  Object.keys(BLOCK_REGISTRY) as (keyof typeof BLOCK_REGISTRY)[]
).filter((t) => BLOCK_REGISTRY[t].configurable) as ConfigurableBlockType[];

describe("useNodeInteractions", () => {
  it.each(CONFIGURABLE)("double-click on a %s node configures it", (type) => {
    const configureBlock = vi.fn();
    const { result } = renderHook(() =>
      useNodeInteractions({ blocks: [], configureBlock })
    );
    result.current.onNodeDoubleClick(
      mouse(),
      node(BLOCK_REGISTRY[type].flowNodeType)
    );
    expect(configureBlock).toHaveBeenCalledWith(type, "n1");
  });

  it.each(["chainNode", "delayNode", "unknown", undefined])(
    "double-click on %s does nothing",
    (flowType) => {
      const configureBlock = vi.fn();
      const { result } = renderHook(() =>
        useNodeInteractions({ blocks: [], configureBlock })
      );
      result.current.onNodeDoubleClick(mouse(), node(flowType));
      expect(configureBlock).not.toHaveBeenCalled();
    }
  );

  it("configureNode is the shared entry used by Enter and double-click", () => {
    const configureBlock = vi.fn();
    const { result } = renderHook(() =>
      useNodeInteractions({ blocks: [], configureBlock })
    );
    result.current.configureNode(node("loopNode"));
    expect(configureBlock).toHaveBeenCalledWith("loop", "n1");
    configureBlock.mockClear();
    result.current.configureNode(node("delayNode"));
    expect(configureBlock).not.toHaveBeenCalled();
  });

  it("opens the context menu with the registry type of the node and closes it", () => {
    const blocks: ChainBlock[] = [{ id: "n1", type: "delay", delayMs: 1 }];
    const { result } = renderHook(() =>
      useNodeInteractions({ blocks, configureBlock: vi.fn() })
    );
    const event = mouse();
    act(() => result.current.onNodeContextMenu(event, node("delayNode")));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({
      x: 10,
      y: 20,
      nodeId: "n1",
      nodeType: "delay",
    });
    act(() => result.current.closeContextMenu());
    expect(result.current.contextMenu).toBeNull();
  });

  it("treats a node that is not a block as an api node", () => {
    const { result } = renderHook(() =>
      useNodeInteractions({ blocks: [], configureBlock: vi.fn() })
    );
    act(() => result.current.onNodeContextMenu(mouse(), node("chainNode")));
    expect(result.current.contextMenu?.nodeType).toBe("api");
  });

  describe("onSelectionContextMenu", () => {
    const blocks: ChainBlock[] = [
      { id: "n1", type: "delay", delayMs: 1 },
      { id: "n2", type: "delay", delayMs: 1 },
    ];
    const selected = [
      { ...node("delayNode"), id: "n1" },
      { ...node("delayNode"), id: "n2" },
    ];

    afterEach(() => vi.restoreAllMocks());

    it("targets the selected node under the pointer", () => {
      const el = document.createElement("div");
      el.className = "react-flow__node";
      el.setAttribute("data-id", "n2");
      document.elementsFromPoint = vi.fn(() => [el]);
      const { result } = renderHook(() =>
        useNodeInteractions({ blocks, configureBlock: vi.fn() })
      );
      act(() => result.current.onSelectionContextMenu(mouse(), selected));
      expect(result.current.contextMenu?.nodeId).toBe("n2");
    });

    it("falls back to the first selected node when none is under the pointer", () => {
      document.elementsFromPoint = vi.fn(() => []);
      const { result } = renderHook(() =>
        useNodeInteractions({ blocks, configureBlock: vi.fn() })
      );
      act(() => result.current.onSelectionContextMenu(mouse(), selected));
      expect(result.current.contextMenu?.nodeId).toBe("n1");
    });

    it("does nothing for an empty selection", () => {
      document.elementsFromPoint = vi.fn(() => []);
      const { result } = renderHook(() =>
        useNodeInteractions({ blocks, configureBlock: vi.fn() })
      );
      act(() => result.current.onSelectionContextMenu(mouse(), []));
      expect(result.current.contextMenu).toBeNull();
    });
  });
});
