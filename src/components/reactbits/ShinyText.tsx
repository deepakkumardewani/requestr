"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  className?: string;
  speed?: number;
}

export function ShinyText({ text, className, speed = 3 }: ShinyTextProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <span className={cn("text-muted-foreground", className)}>{text}</span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-block animate-[shine_var(--shine-speed)_linear_infinite]",
        className,
      )}
      style={
        {
          "--shine-speed": `${speed}s`,
          backgroundImage:
            "linear-gradient(120deg, currentColor 0%, currentColor 30%, rgba(255,255,255,0.85) 50%, currentColor 70%, currentColor 100%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        } as React.CSSProperties
      }
    >
      {text}
    </span>
  );
}
