"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/** Start loading the video this far before it scrolls into view. */
const NEAR_VIEWPORT_MARGIN = "200px";

interface DemoVideoProps {
  /** Path without extension, e.g. `/media/relay/relay-loop` (`.webm`, `.mp4` must exist). */
  src: string;
  /** Poster image path; defaults to `${src}.webp`. */
  poster?: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Muted looping clip. The poster is the base layer and the video fades in only
 * once it is actually playing, so a load error, blocked autoplay or reduced
 * motion all leave the poster in place with no broken-video chrome.
 */
export function DemoVideo({
  src,
  poster = `${src}.webp`,
  alt,
  width,
  height,
  className,
}: DemoVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [nearViewport, setNearViewport] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

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

  const showVideo = nearViewport && !reduced && !failed;

  return (
    <div
      ref={frameRef}
      className={cn("relative overflow-hidden bg-zinc-950", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {/* biome-ignore lint/performance/noImgElement: static poster, no optimizer needed */}
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src={poster}
        width={width}
        height={height}
        alt={alt}
      />
      {showVideo && (
        <video
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            playing ? "opacity-100" : "opacity-0",
          )}
          width={width}
          height={height}
          aria-hidden="true"
          tabIndex={-1}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src={`${src}.webm`} type="video/webm" />
          {/* Sources report load errors on themselves; the last one means none played. */}
          <source
            src={`${src}.mp4`}
            type="video/mp4"
            onError={() => setFailed(true)}
          />
        </video>
      )}
    </div>
  );
}
