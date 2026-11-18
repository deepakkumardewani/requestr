import type { Ref } from "react";
import { cn } from "@/lib/utils";
import { tickPosition } from "./railProgress";
import { SECTION_STATUSES } from "./statusCodes";

interface RailTrackProps {
  activeId: string;
  /** The fill line; the rail writes its scale straight onto this node. */
  fillRef: Ref<HTMLSpanElement>;
}

/** A hairline with one tick per section and a fill for how far the reader is. */
export function RailTrack({ activeId, fillRef }: RailTrackProps) {
  const count = SECTION_STATUSES.length;
  return (
    <span className="relative block h-full w-1.5">
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70" />
      <span
        ref={fillRef}
        // Starts empty; StatusRail owns the transform from here on.
        style={{ transform: "scaleY(0)" }}
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 origin-top bg-[var(--status-color)] transition-colors duration-500"
      />
      {SECTION_STATUSES.map((entry, index) => (
        <span
          key={entry.sectionId}
          style={{ top: `${tickPosition(index, count) * 100}%` }}
          className={cn(
            "absolute left-1/2 h-px -translate-x-1/2 transition-[width,background-color] duration-500",
            entry.sectionId === activeId
              ? "w-1.5 bg-[var(--status-color)]"
              : "w-1 bg-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}
