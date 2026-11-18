"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  RELAY_KEY_RESIZE_STEP_PX,
  RELAY_RESIZE_HANDLE_HIT_PX,
} from "@/lib/relay/constants";
import { getRelayMaxWidth, getRelayMinWidth } from "@/stores/useRelayStore";

type ResizeHandleProps = {
  /** Current dock width in px. */
  width: number;
  /** Receives the requested width; the owner clamps it to the allowed range. */
  onWidthChange: (width: number) => void;
};

/**
 * The dock is anchored to the right edge, so dragging left widens it and the
 * ArrowLeft key mirrors that direction.
 */
export function ResizeHandle({ width, onWidthChange }: ResizeHandleProps) {
  const t = useTranslations("relay");

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onWidthChange(window.innerWidth - event.clientX);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onWidthChange(width + RELAY_KEY_RESIZE_STEP_PX);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onWidthChange(width - RELAY_KEY_RESIZE_STEP_PX);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("resizeHandle")}
      aria-valuenow={width}
      aria-valuemin={getRelayMinWidth(window.innerWidth)}
      aria-valuemax={getRelayMaxWidth(window.innerWidth)}
      tabIndex={0}
      data-testid="relay-resize-handle"
      style={{ width: RELAY_RESIZE_HANDLE_HIT_PX }}
      className="absolute inset-y-0 left-0 z-10 -translate-x-1/2 cursor-col-resize touch-none outline-none transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border hover:after:bg-ring focus-visible:after:w-0.5 focus-visible:after:bg-ring"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
  );
}
