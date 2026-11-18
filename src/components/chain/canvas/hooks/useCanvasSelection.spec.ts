/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { useCanvasSelection } from "./useCanvasSelection";

afterEach(cleanup);

const steps = [{ id: "step-1", nodeId: "n7" }] as unknown as RunStep[];

describe("useCanvasSelection", () => {
  it("clicking a node selects, focuses, opens details and notifies the run-log bridge", () => {
    const { result } = renderHook(() =>
      useCanvasSelection({ selectedStepId: null }),
    );
    const bridge = vi.fn();
    act(() => result.current.registerCanvasNodeClick(bridge));
    act(() => result.current.clickNode("n1"));
    expect(result.current).toMatchObject({
      selectedNodeId: "n1",
      keyboardFocusNodeId: "n1",
      nodeDetailOpen: true,
    });
    expect(bridge).toHaveBeenCalledWith("n1");
  });

  it("closeDetails keeps the focus ring; closeDetailsAndClearFocus drops it", () => {
    const { result } = renderHook(() =>
      useCanvasSelection({ selectedStepId: null }),
    );
    act(() => result.current.clickNode("n1"));
    act(() => result.current.closeDetails());
    expect(result.current.nodeDetailOpen).toBe(false);
    expect(result.current.selectedNodeId).toBeNull();
    expect(result.current.keyboardFocusNodeId).toBe("n1");
    act(() => result.current.closeDetailsAndClearFocus());
    expect(result.current.keyboardFocusNodeId).toBeNull();
  });

  it("clearKeyboardFocus clears the focus", () => {
    const { result } = renderHook(() =>
      useCanvasSelection({ selectedStepId: null }),
    );
    act(() => result.current.setKeyboardFocusNodeId("n2"));
    act(() => result.current.clearKeyboardFocus());
    expect(result.current.keyboardFocusNodeId).toBeNull();
  });

  it("opens and closes the edit-request panel", () => {
    const { result } = renderHook(() =>
      useCanvasSelection({ selectedStepId: null }),
    );
    act(() => result.current.setEditRequestId("r1"));
    expect(result.current.editRequestId).toBe("r1");
    act(() => result.current.closeEditRequest());
    expect(result.current.editRequestId).toBeNull();
  });

  it("focuses the node of the selected run-log step", () => {
    const { result } = renderHook(() =>
      useCanvasSelection({ runSteps: steps, selectedStepId: "step-1" }),
    );
    expect(result.current.keyboardFocusNodeId).toBe("n7");
  });

  it("ignores a selected step that is unknown or has no steps to search", () => {
    const unknown = renderHook(() =>
      useCanvasSelection({ runSteps: steps, selectedStepId: "nope" }),
    );
    expect(unknown.result.current.keyboardFocusNodeId).toBeNull();
    const noSteps = renderHook(() =>
      useCanvasSelection({ selectedStepId: "step-1" }),
    );
    expect(noSteps.result.current.keyboardFocusNodeId).toBeNull();
  });
});
