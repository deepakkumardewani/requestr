"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface BorderGlowProps {
  children: ReactNode;
  className?: string;
  /** CSS gradient used for the animated border ring */
  gradient?: string;
  /** seconds for one full sweep of the gradient */
  duration?: number;
}

const DEFAULT_GRADIENT =
  "linear-gradient(120deg, rgba(52,211,153,0.5), rgba(96,165,250,0.45), rgba(192,132,252,0.45), rgba(52,211,153,0.5))";

/**
 * Ambient animated gradient border. The glow is not hover-triggered, so it
 * composes with hover effects (e.g. GlareHover) without stacking. Reduced
 * motion renders a static gradient border with no animation.
 */
export function BorderGlow({
  children,
  className,
  gradient = DEFAULT_GRADIENT,
  duration = 8,
}: BorderGlowProps) {
  const reduced = useReducedMotion();

  return (
    <div className={cn("relative rounded-xl p-px", className)}>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60"
        style={{ background: gradient, backgroundSize: "300% 300%" }}
        animate={
          reduced
            ? undefined
            : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
        }
        transition={
          reduced ? undefined : { duration, ease: "linear", repeat: Infinity }
        }
      />
      <div className="relative h-full rounded-[inherit]">{children}</div>
    </div>
  );
}
