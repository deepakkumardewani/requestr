"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";

interface HeroMotion {
  /** True when the visitor (or the Settings override) asks for reduced motion. */
  reduced: boolean;
  /** Inverse of `reduced`: animations and auto-play may run. */
  animate: boolean;
}

/** Hero-lab view of the shared reduced-motion setting; concepts render a static state when `reduced`. */
export function useHeroMotion(): HeroMotion {
  const reduced = useReducedMotion();
  return { reduced, animate: !reduced };
}
