"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { GridPulses } from "./GridPulses";

/** Same 48px cell as GRID_CELL_PX in pulses.ts, so the streaks ride these lines. */
const GRID_LINES =
  "bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px]";
const MASKS = {
  /** Fades out below the fold line: for a section that opens the page. */
  top: "[mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black,transparent)]",
  /** Fades out on every side: for a band in the middle of the page. */
  center:
    "[mask-image:radial-gradient(ellipse_65%_75%_at_50%_50%,black,transparent)]",
} as const;
const ACCENT_GLOW =
  "bg-[radial-gradient(ellipse_50%_40%_at_70%_20%,rgb(52_211_153/0.12),transparent)]";
/** A soft light that follows the pointer; --spot-x/--spot-y are set from JS. */
const POINTER_SPOTLIGHT =
  "bg-[radial-gradient(420px_circle_at_var(--spot-x,50%)_var(--spot-y,-20%),rgb(52_211_153/0.10),transparent_70%)]";

/** Writes the pointer position onto `element` as CSS variables, without re-rendering. */
function trackPointer(element: HTMLElement): () => void {
  const handler = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };
  window.addEventListener("pointermove", handler, { passive: true });
  return () => window.removeEventListener("pointermove", handler);
}

interface GridBackdropProps {
  mask?: keyof typeof MASKS;
  /** The off-centre emerald wash behind the hero visual. */
  glow?: boolean;
}

/**
 * Editor grid with request-coloured streaks running along it and a light that
 * follows the pointer. Fill a `relative` section with it.
 */
export function GridBackdrop({
  mask = "top",
  glow = false,
}: GridBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return trackPointer(root);
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className={cn("absolute inset-0", MASKS[mask])}>
        <div className={cn("absolute inset-0", GRID_LINES)} />
        <GridPulses />
      </div>
      {glow ? <div className={cn("absolute inset-0", ACCENT_GLOW)} /> : null}
      <div className={cn("absolute inset-0", POINTER_SPOTLIGHT)} />
    </div>
  );
}
