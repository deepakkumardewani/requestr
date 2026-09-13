"use client";

import { useEffect, useRef } from "react";

/** Delay before the first autoplay tick fires, giving the section time to settle. */
const AUTOPLAY_START_DELAY_MS = 1500;
/** Interval between subsequent autoplay ticks. */
const AUTOPLAY_INTERVAL_MS = 4000;
/** Fraction of the container that must be visible for autoplay to keep running. */
const VISIBILITY_THRESHOLD = 0.2;
/** Interactions inside the container that permanently stop autoplay. */
const INTERACTION_EVENTS = ["pointerdown", "focusin", "pointerenter"] as const;

interface UseAutoplayDemoOptions {
  /** Ref to the element that hosts the demo; autoplay watches it for visibility and interaction. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Autoplay is fully disabled (e.g. reduced motion) when false. */
  enabled: boolean;
  /** Called on each autoplay tick. */
  onTick: () => void;
}

/**
 * Drives an idle autoplay loop for the Hero product demo: starts shortly after
 * mount, ticks on an interval, pauses while the container is off-screen, and
 * stops permanently the first time the visitor interacts with it.
 */
export function useAutoplayDemo({
  containerRef,
  enabled,
  onTick,
}: UseAutoplayDemoOptions): void {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;
    const container: HTMLElement | null = containerRef.current;
    if (!container) return;
    const target: HTMLElement = container;

    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let intervalTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let isVisible = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
      },
      { threshold: VISIBILITY_THRESHOLD },
    );

    function stop() {
      if (stopped) return;
      stopped = true;
      if (startTimer) clearTimeout(startTimer);
      if (intervalTimer) clearInterval(intervalTimer);
      for (const type of INTERACTION_EVENTS) {
        target.removeEventListener(type, stop);
      }
      observer.disconnect();
    }

    function tick() {
      if (stopped || !isVisible) return;
      onTickRef.current();
    }

    startTimer = setTimeout(() => {
      tick();
      intervalTimer = setInterval(tick, AUTOPLAY_INTERVAL_MS);
    }, AUTOPLAY_START_DELAY_MS);

    for (const type of INTERACTION_EVENTS) {
      target.addEventListener(type, stop, { once: true });
    }
    observer.observe(target);

    return stop;
  }, [containerRef, enabled]);
}
