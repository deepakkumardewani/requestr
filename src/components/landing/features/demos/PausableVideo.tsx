"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useInView } from "motion/react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DemoVideo } from "../../DemoVideo";

const IN_VIEW_AMOUNT = 0.25;

/** Pauses or resumes the clip DemoVideo mounted inside `wrapper`. */
function applyPlayback(wrapper: HTMLElement | null, play: boolean) {
  const video = wrapper?.querySelector("video");
  if (!video) return;
  if (!play) {
    video.pause();
    return;
  }
  video.play().catch((error: unknown) => {
    // Browsers may refuse playback (battery saver, autoplay policy); the poster stays.
    console.warn("[PausableVideo] play() was refused", error);
  });
}

/**
 * DemoVideo loops for as long as the page is open. This wrapper stops it while
 * it is off screen and gives the visitor a pause button, as a loop longer than
 * five seconds needs.
 */
export function PausableVideo(props: ComponentProps<typeof DemoVideo>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapperRef, { amount: IN_VIEW_AMOUNT });
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const Icon = paused ? PlayIcon : PauseIcon;

  useEffect(() => {
    applyPlayback(wrapperRef.current, inView && !paused);
  }, [inView, paused]);

  return (
    <div ref={wrapperRef} className="relative">
      <DemoVideo {...props} />
      {reduced ? null : (
        <button
          type="button"
          aria-pressed={paused}
          aria-label="Pause the recording"
          onClick={() => setPaused((value) => !value)}
          className="absolute right-3 bottom-3 rounded-full border border-border bg-background/80 p-2 text-foreground backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
