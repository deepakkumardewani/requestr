/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCanvasPanels } from "./useCanvasPanels";

afterEach(cleanup);

describe("useCanvasPanels", () => {
  it("starts with everything closed", () => {
    const { result } = renderHook(() => useCanvasPanels());
    expect(Object.values(result.current.panelIds).every((id) => id === null)).toBe(
      true,
    );
    expect(result.current.arrowPanel.open).toBe(false);
    expect(result.current.subChainPickerNodeId).toBeNull();
  });

  it.each([
    "start",
    "condition",
    "evaluate",
    "validate",
    "merge",
    "loop",
    "collect",
    "subchain",
  ] as const)("the %s opener opens only that panel", (type) => {
    const { result } = renderHook(() => useCanvasPanels());
    act(() => result.current.openers[type]("n1"));
    const open = Object.entries(result.current.panelIds).filter(
      ([, id]) => id !== null,
    );
    expect(open).toEqual([[type, "n1"]]);
  });

  it("opens and closes a side panel through its opener", () => {
    const { result } = renderHook(() => useCanvasPanels());
    act(() => result.current.openers.loop("l1"));
    expect(result.current.panelIds.loop).toBe("l1");
    expect(result.current.panelIds.merge).toBeNull();
    act(() => result.current.closePanel("loop"));
    expect(result.current.panelIds.loop).toBeNull();
  });

  it.each([
    "start",
    "condition",
    "evaluate",
    "validate",
    "merge",
    "loop",
    "collect",
    "subchain",
  ] as const)("configureBlock routes %s to its side panel", (type) => {
    const { result } = renderHook(() => useCanvasPanels());
    act(() => result.current.configureBlock(type, "n1"));
    expect(result.current.panelIds[type]).toBe("n1");
    expect(result.current.arrowPanel.open).toBe(false);
  });

  it("configureBlock routes display to the arrow panel", () => {
    const { result } = renderHook(() => useCanvasPanels());
    act(() => result.current.configureBlock("display", "d1"));
    expect(result.current.arrowPanel).toEqual({
      open: true,
      edgeId: null,
      displayNodeId: "d1",
    });
  });

  it("switches the arrow panel between an edge and a display node, and closes it", () => {
    const { result } = renderHook(() => useCanvasPanels());
    act(() => result.current.openEdgeConfig("e1"));
    expect(result.current.arrowPanel).toEqual({
      open: true,
      edgeId: "e1",
      displayNodeId: null,
    });
    act(() => result.current.openDisplayConfig("d1"));
    expect(result.current.arrowPanel.edgeId).toBeNull();
    act(() => result.current.closeArrowPanel());
    expect(result.current.arrowPanel.open).toBe(false);
  });

  it("tracks the sub-chain picker node", () => {
    const { result } = renderHook(() => useCanvasPanels());
    act(() => result.current.setSubChainPickerNodeId("sc"));
    expect(result.current.subChainPickerNodeId).toBe("sc");
  });
});
