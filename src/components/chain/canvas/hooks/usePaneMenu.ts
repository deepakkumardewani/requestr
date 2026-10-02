import { useReactFlow } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";
import { PAN_CLICK_TOLERANCE_PX } from "@/lib/chainConstants";
import type { ConnectFrom } from "@/stores/useChainStore";

type Point = { x: number; y: number };

/** An open "add block" menu: where it sits on screen, where a pick lands on the canvas, and what it attaches to. */
export type PaneMenuState = {
  anchor: Point;
  position: Point;
  connectFrom?: ConnectFrom;
};

type UsePaneMenuParams = {
  /** Suppresses the menu entirely (e.g. while a run is in progress). */
  disabled?: boolean;
};

/**
 * Right-click-on-empty-canvas add-block menu. Also exposes `openMenu` so the
 * connection-drop flow reuses the exact same menu state.
 */
export function usePaneMenu({ disabled = false }: UsePaneMenuParams = {}) {
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<PaneMenuState | null>(null);

  const openMenu = useCallback(
    (anchor: Point, connectFrom?: ConnectFrom) => {
      setMenu({ anchor, position: screenToFlowPosition(anchor), connectFrom });
    },
    [screenToFlowPosition],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  // Right-drag pans the canvas and then fires `contextmenu` on release; that
  // release must not open the menu. A plain right-click moves <= tolerance.
  const gestureStart = useRef<Point | null>(null);
  const suppressNextMenu = useRef(false);

  const onMoveStart = useCallback((event: MouseEvent | TouchEvent | null) => {
    suppressNextMenu.current = false;
    gestureStart.current =
      event && "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : null;
  }, []);

  const onMoveEnd = useCallback((event: MouseEvent | TouchEvent | null) => {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start || !event || !("clientX" in event)) return;
    suppressNextMenu.current =
      Math.hypot(event.clientX - start.x, event.clientY - start.y) >
      PAN_CLICK_TOLERANCE_PX;
  }, []);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      // Always suppress the native menu; only ours is allowed on the pane.
      event.preventDefault();
      const wasPan = suppressNextMenu.current;
      suppressNextMenu.current = false;
      if (disabled || wasPan) return;
      openMenu({ x: event.clientX, y: event.clientY });
    },
    [disabled, openMenu],
  );

  return {
    menu,
    openMenu,
    closeMenu,
    onPaneContextMenu,
    onMoveStart,
    onMoveEnd,
  };
}
