"use client";

import { type RefObject, useEffect, useState } from "react";

/** Fraction of the track that must be visible before scroll tracking runs. */
const VISIBILITY_THRESHOLD = 0;

/** 0 when the track's top reaches the viewport top, 1 when its end does. */
export function scrollProgress(
  rect: Pick<DOMRect, "top" | "height">,
  viewportHeight: number,
): number {
  const scrollable = rect.height - viewportHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, -rect.top / scrollable));
}

/** Maps 0..1 progress onto a stage index in [0, stageCount). */
export function stageForProgress(progress: number, stageCount: number): number {
  return Math.min(stageCount - 1, Math.floor(progress * stageCount));
}

interface UseScrollChoreographyOptions {
  trackRef: RefObject<HTMLElement | null>;
  stageCount: number;
  /** False under reduced motion: no listeners, progress stays at 0. */
  enabled: boolean;
}

interface ScrollChoreography {
  progress: number;
  stage: number;
  /** True while the track intersects the viewport; scroll work is paused otherwise. */
  inView: boolean;
}

/**
 * Scroll-linked stage for a tall track with a sticky stage inside. Listens to
 * scroll only while the track is on-screen, and not at all when disabled.
 */
export function useScrollChoreography({
  trackRef,
  stageCount,
  enabled,
}: UseScrollChoreographyOptions): ScrollChoreography {
  const [progress, setProgress] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: VISIBILITY_THRESHOLD },
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, [trackRef, enabled]);

  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !inView || !track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setProgress(
        scrollProgress(track.getBoundingClientRect(), window.innerHeight),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [trackRef, enabled, inView]);

  return { progress, stage: stageForProgress(progress, stageCount), inView };
}
