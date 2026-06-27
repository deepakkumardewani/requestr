"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface LogoLoopItem {
  label: string;
  icon?: React.ReactNode;
}

interface LogoLoopProps {
  items: LogoLoopItem[];
  className?: string;
  speed?: number;
}

export function LogoLoop({ items, className, speed = 30 }: LogoLoopProps) {
  const reduced = useReducedMotion();
  const repeated = [...items, ...items];

  return (
    <div
      className={cn("overflow-hidden", className)}
      onMouseEnter={(e) => {
        const el = e.currentTarget.querySelector<HTMLDivElement>("[data-loop]");
        if (el) el.style.animationPlayState = "paused";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget.querySelector<HTMLDivElement>("[data-loop]");
        if (el) el.style.animationPlayState = "running";
      }}
    >
      <div
        data-loop
        className={cn(
          "flex items-center gap-8 whitespace-nowrap",
          !reduced && "animate-[marquee_var(--loop-speed)_linear_infinite]",
        )}
        style={{ "--loop-speed": `${speed}s` } as React.CSSProperties}
      >
        {(reduced ? items : repeated).map((item, i) => (
          <span
            key={`${item.label}-${i}`}
            className="inline-flex items-center gap-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {item.icon}
              {item.label}
            </span>
            <span className="text-border/60 select-none" aria-hidden>
              ·
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
