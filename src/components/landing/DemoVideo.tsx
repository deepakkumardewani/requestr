"use client";

import { useEffect, useRef } from "react";

interface DemoVideoProps {
  /** Path without extension, e.g. `/intro/clip-1`. */
  src: string;
  label: string;
}

/** Controllable demo video; pauses itself when it unmounts (dialog closes). */
export function DemoVideo({ src, label }: DemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  return (
    // biome-ignore lint/a11y/useMediaCaption: silent screen recording, no audio track to caption
    <video
      ref={videoRef}
      className="block h-auto w-full rounded-lg bg-zinc-950"
      poster={`${src}.webp`}
      aria-label={label}
      controls
      autoPlay
      playsInline
    >
      <source src={`${src}.webm`} type="video/webm" />
      <source src={`${src}.mp4`} type="video/mp4" />
    </video>
  );
}
