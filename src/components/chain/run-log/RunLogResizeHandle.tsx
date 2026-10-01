"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

/** Height change in px per ArrowUp/ArrowDown press on the focused handle. */
const KEYBOARD_RESIZE_STEP_PX = 16;

type RunLogResizeHandleProps = {
  height: number;
  minHeight: number;
  maxHeight: number;
  /** Live height while dragging; `null` once the drag ends. */
  onPreview: (height: number | null) => void;
  /** Final height, fired once per drag or keypress. */
  onCommit: (height: number) => void;
};

type DragState = { startY: number; startHeight: number; current: number };

/**
 * Keyboard- and pointer-operable separator. Pointer capture keeps the drag
 * alive outside the handle without window listeners, so nothing can leak if
 * the dock unmounts mid-drag.
 */
export function RunLogResizeHandle({
  height,
  minHeight,
  maxHeight,
  onPreview,
  onCommit,
}: RunLogResizeHandleProps) {
  const t = useTranslations("chain");
  const dragRef = useRef<DragState | null>(null);

  const clamp = (value: number) =>
    Math.min(Math.max(value, minHeight), maxHeight);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      startY: event.clientY,
      startHeight: height,
      current: height,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Dragging up (smaller clientY) makes the dock taller.
    drag.current = clamp(drag.startHeight + drag.startY - event.clientY);
    onPreview(drag.current);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    onPreview(null);
    if (drag.current !== drag.startHeight) onCommit(drag.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onCommit(clamp(height + KEYBOARD_RESIZE_STEP_PX));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onCommit(clamp(height - KEYBOARD_RESIZE_STEP_PX));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={t("runLogResizeHandle")}
      aria-valuenow={height}
      aria-valuemin={minHeight}
      aria-valuemax={maxHeight}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="h-1 w-full shrink-0 cursor-row-resize touch-none bg-transparent hover:bg-border focus-visible:bg-ring focus-visible:outline-none"
    />
  );
}
