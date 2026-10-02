/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePaneMenu } from "./usePaneMenu";

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    screenToFlowPosition: (p: { x: number; y: number }) => ({
      x: p.x * 2,
      y: p.y * 2,
    }),
  }),
}));

function contextMenuEvent(x: number, y: number) {
  return { clientX: x, clientY: y, preventDefault: vi.fn() };
}

describe("usePaneMenu", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => usePaneMenu());
    expect(result.current.menu).toBeNull();
  });

  it("opens at the cursor, converts to flow space and prevents the native menu", () => {
    const { result } = renderHook(() => usePaneMenu());
    const event = contextMenuEvent(10, 20);

    act(() => result.current.onPaneContextMenu(event as never));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.menu).toEqual({
      anchor: { x: 10, y: 20 },
      position: { x: 20, y: 40 },
      connectFrom: undefined,
    });
  });

  it("still prevents the native menu but stays closed when disabled", () => {
    const { result } = renderHook(() => usePaneMenu({ disabled: true }));
    const event = contextMenuEvent(1, 1);

    act(() => result.current.onPaneContextMenu(event as never));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.menu).toBeNull();
  });

  it("openMenu carries connectFrom and closeMenu clears the state", () => {
    const { result } = renderHook(() => usePaneMenu());
    const connectFrom = { nodeId: "n1", handleId: "body" };

    act(() => result.current.openMenu({ x: 3, y: 4 }, connectFrom));
    expect(result.current.menu?.connectFrom).toBe(connectFrom);

    act(() => result.current.closeMenu());
    expect(result.current.menu).toBeNull();
  });

  describe("right-drag pan suppression", () => {
    const start = { clientX: 100, clientY: 100 };

    it("suppresses the menu after a pan beyond the tolerance", () => {
      const { result } = renderHook(() => usePaneMenu());
      act(() => {
        result.current.onMoveStart(start as never);
        result.current.onMoveEnd({ clientX: 106, clientY: 100 } as never);
      });
      const event = contextMenuEvent(106, 100);
      act(() => result.current.onPaneContextMenu(event as never));

      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.menu).toBeNull();
    });

    it("opens the menu when movement is within the tolerance", () => {
      const { result } = renderHook(() => usePaneMenu());
      act(() => {
        result.current.onMoveStart(start as never);
        result.current.onMoveEnd({ clientX: 104, clientY: 100 } as never);
      });
      act(() => result.current.onPaneContextMenu(contextMenuEvent(104, 100) as never));
      expect(result.current.menu).not.toBeNull();
    });

    it("consumes the suppression once, and ignores events without coordinates", () => {
      const { result } = renderHook(() => usePaneMenu());
      act(() => {
        result.current.onMoveStart(start as never);
        result.current.onMoveEnd({ clientX: 300, clientY: 100 } as never);
      });
      act(() => result.current.onPaneContextMenu(contextMenuEvent(1, 1) as never));
      expect(result.current.menu).toBeNull();
      act(() => result.current.onPaneContextMenu(contextMenuEvent(1, 1) as never));
      expect(result.current.menu).not.toBeNull();

      act(() => {
        result.current.closeMenu();
        result.current.onMoveStart(null);
        result.current.onMoveEnd(null);
      });
      act(() => result.current.onPaneContextMenu(contextMenuEvent(2, 2) as never));
      expect(result.current.menu).not.toBeNull();
    });
  });
});
