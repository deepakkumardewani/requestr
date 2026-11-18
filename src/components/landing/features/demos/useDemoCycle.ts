"use client";

import { useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const IN_VIEW_AMOUNT = 0.35;

/** The option after `index`, back to the first after the last. */
export function nextCycleIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index + 1) % count;
}

interface DemoCycleOptions {
  count: number;
  intervalMs: number;
}

/**
 * Steps a demo through its examples while it is on screen. Stops for good once
 * the visitor picks one, and never moves under reduced motion, so the demo
 * holds a still, readable state.
 */
export function useDemoCycle<T extends Element = HTMLElement>({
  count,
  intervalMs,
}: DemoCycleOptions) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount: IN_VIEW_AMOUNT });
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const playing = autoplay && inView && !reduced && count > 1;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setIndex((current) => nextCycleIndex(current, count)),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [playing, count, intervalMs]);

  const pick = useCallback((next: number) => {
    setAutoplay(false);
    setIndex(next);
  }, []);

  /** Any other edit by the visitor also hands them control. */
  const stop = useCallback(() => setAutoplay(false), []);

  return { ref, index, pick, stop, inView, reduced, playing };
}
