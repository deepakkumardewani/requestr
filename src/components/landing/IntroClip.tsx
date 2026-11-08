"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/** Start loading the video this far before it scrolls into view. */
const NEAR_VIEWPORT_MARGIN = "200px";
const CLIP_WIDTH = 800;
const CLIP_HEIGHT = 450;

interface IntroClipProps {
  /** Path without extension, e.g. `/intro/clip-1` (`.webm`, `.mp4`, `.webp` must exist). */
  src: string;
  alt: string;
  className?: string;
}

/**
 * Muted looping clip from the real app. No video bytes are requested until the
 * frame is near the viewport, and under reduced motion only the poster shows.
 */
export function IntroClip({ src, alt, className }: IntroClipProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || reduced) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [reduced]);

  const poster = `${src}.webp`;
  const showVideo = nearViewport && !reduced;

  return (
    <div
      ref={frameRef}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-sm ring-1 ring-foreground/5",
        className,
      )}
    >
      {showVideo ? (
        <video
          className="block h-auto w-full"
          width={CLIP_WIDTH}
          height={CLIP_HEIGHT}
          poster={poster}
          aria-label={alt}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
        >
          <source src={`${src}.webm`} type="video/webm" />
          <source src={`${src}.mp4`} type="video/mp4" />
        </video>
      ) : (
        // biome-ignore lint/performance/noImgElement: tiny static poster, no optimizer needed
        <img
          className="block h-auto w-full"
          src={poster}
          width={CLIP_WIDTH}
          height={CLIP_HEIGHT}
          alt={alt}
          loading="lazy"
        />
      )}
    </div>
  );
}
