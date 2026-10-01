/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useGhostPlacement } from "./useGhostPlacement";

afterEach(cleanup);

describe("useGhostPlacement", () => {
  it("ignores cursor movement until a block type is pending", () => {
    const { result } = renderHook(() => useGhostPlacement());
    act(() => result.current.trackCursor({ clientX: 5, clientY: 6 }));
    expect(result.current.cursorPos).toEqual({ x: 0, y: 0 });
  });

  it("tracks the cursor while a block type is pending", () => {
    const { result } = renderHook(() => useGhostPlacement());
    act(() => result.current.setPendingNodeType("delay"));
    act(() => result.current.trackCursor({ clientX: 5, clientY: 6 }));
    expect(result.current.cursorPos).toEqual({ x: 5, y: 6 });
  });

  it("cancels on Escape but not on other keys", () => {
    const { result } = renderHook(() => useGhostPlacement());
    act(() => result.current.setPendingNodeType("loop"));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(result.current.pendingNodeType).toBe("loop");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.pendingNodeType).toBeNull();
  });

  it("clearPending resets the pending type", () => {
    const { result } = renderHook(() => useGhostPlacement());
    act(() => result.current.setPendingNodeType("merge"));
    act(() => result.current.clearPending());
    expect(result.current.pendingNodeType).toBeNull();
  });
});
