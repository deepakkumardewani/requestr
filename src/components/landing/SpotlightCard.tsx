"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_COLOR = "var(--landing-accent)";
/** --card-x/--card-y are written on pointer move; the light fades in on hover. */
const HIGHLIGHT_CLASS =
  "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100 bg-[radial-gradient(300px_circle_at_var(--card-x,50%)_var(--card-y,0%),color-mix(in_srgb,var(--spot-color)_16%,transparent),transparent_70%)]";

interface SpotlightCardProps {
  children: ReactNode;
  /** Any CSS colour; the light under the pointer is tinted with it. */
  color?: string;
  className?: string;
}

function followPointer(event: PointerEvent<HTMLDivElement>) {
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--card-x", `${event.clientX - rect.left}px`);
  card.style.setProperty("--card-y", `${event.clientY - rect.top}px`);
}

/** A card with a soft light that follows the pointer across it. */
export function SpotlightCard({
  children,
  color = DEFAULT_COLOR,
  className,
}: SpotlightCardProps) {
  return (
    <div
      onPointerMove={followPointer}
      style={{ "--spot-color": color } as CSSProperties}
      className={cn(
        "group/spot relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-300 hover:border-[color-mix(in_srgb,var(--spot-color)_45%,var(--border))]",
        className,
      )}
    >
      <div aria-hidden="true" className={HIGHLIGHT_CLASS} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
