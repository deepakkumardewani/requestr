import { useCallback, useEffect, useState } from "react";
import type { GhostBlockType } from "../../blockRegistry";

type CursorPos = { x: number; y: number };

/** Click-to-place mode: which block type follows the cursor, where the cursor is, and Escape to cancel. */
export function useGhostPlacement() {
  const [pendingNodeType, setPendingNodeType] = useState<GhostBlockType | null>(
    null,
  );
  const [cursorPos, setCursorPos] = useState<CursorPos>({ x: 0, y: 0 });

  useEffect(() => {
    if (!pendingNodeType) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPendingNodeType(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingNodeType]);

  const trackCursor = useCallback(
    (e: { clientX: number; clientY: number }) => {
      if (pendingNodeType) setCursorPos({ x: e.clientX, y: e.clientY });
    },
    [pendingNodeType],
  );

  const clearPending = useCallback(() => setPendingNodeType(null), []);

  return {
    pendingNodeType,
    cursorPos,
    setPendingNodeType,
    trackCursor,
    clearPending,
  };
}
