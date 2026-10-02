"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { RUN_LOG_RESIZE_STEP } from "@/lib/runLogLayout";
import {
  DEFAULT_RUN_LOG_HEIGHT,
  MIN_RUN_LOG_HEIGHT,
} from "@/stores/useUIStore";

type Orientation = "horizontal" | "vertical";

type ResizeSeparatorProps = {
  /** `vertical` is a column divider (x axis); `horizontal` a row divider (y axis). */
  orientation: Orientation;
  label: string;
  value: number;
  min: number;
  max: number;
  /** Value restored on double-click. */
  defaultValue: number;
  /** Value change per screen pixel. Read at event time so it tracks live layout. */
  getUnitsPerPixel?: () => number;
  /** Live value while dragging; `null` once the drag ends. */
  onPreview: (value: number | null) => void;
  /** Final value, fired once per drag, keypress or reset. */
  onCommit: (value: number) => void;
  className?: string;
};

type DragState = { start: number; startValue: number; current: number };

const ORIENTATION_CLASSES: Record<Orientation, string> = {
  horizontal: "h-1 w-full cursor-row-resize",
  vertical: "h-full w-1 cursor-col-resize",
};

/**
 * Keyboard- and pointer-operable separator. Pointer capture keeps the drag
 * alive outside the handle without window listeners, so nothing can leak if
 * the owner unmounts mid-drag. Growing direction: up for horizontal, right for
 * vertical.
 */
export function ResizeSeparator({
  orientation,
  label,
  value,
  min,
  max,
  defaultValue,
  getUnitsPerPixel = () => 1,
  onPreview,
  onCommit,
  className = "",
}: ResizeSeparatorProps) {
  const dragRef = useRef<DragState | null>(null);
  const isVertical = orientation === "vertical";

  const clamp = (next: number) => Math.min(Math.max(next, min), max);
  const coordinate = (event: { clientX: number; clientY: number }) =>
    isVertical ? event.clientX : event.clientY;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      start: coordinate(event),
      startValue: value,
      current: value,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pixels = coordinate(event) - drag.start;
    const grow = isVertical ? pixels : -pixels;
    drag.current = clamp(drag.startValue + grow * getUnitsPerPixel());
    onPreview(drag.current);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    onPreview(null);
    if (drag.current !== drag.startValue) onCommit(drag.current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = RUN_LOG_RESIZE_STEP * getUnitsPerPixel();
    const grow = isVertical ? "ArrowRight" : "ArrowUp";
    const shrink = isVertical ? "ArrowLeft" : "ArrowDown";
    const targets: Record<string, number> = {
      [grow]: value + step,
      [shrink]: value - step,
      Home: min,
      End: max,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    onCommit(clamp(targets[event.key]));
  };

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onCommit(clamp(defaultValue))}
      className={`${ORIENTATION_CLASSES[orientation]} shrink-0 touch-none bg-transparent hover:bg-border focus-visible:bg-ring focus-visible:outline-none ${className}`}
    />
  );
}

type RunLogResizeHandleProps = {
  height: number;
  minHeight?: number;
  maxHeight: number;
  onPreview: (height: number | null) => void;
  onCommit: (height: number) => void;
};

/** Dock-height separator on top of the dock. */
export function RunLogResizeHandle({
  height,
  minHeight = MIN_RUN_LOG_HEIGHT,
  maxHeight,
  onPreview,
  onCommit,
}: RunLogResizeHandleProps) {
  const t = useTranslations("chain");
  return (
    <ResizeSeparator
      orientation="horizontal"
      label={t("runLogResizeHandle")}
      value={height}
      min={minHeight}
      max={maxHeight}
      defaultValue={DEFAULT_RUN_LOG_HEIGHT}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  );
}
