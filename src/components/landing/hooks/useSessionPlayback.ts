"use client";

import { useEffect, useState } from "react";

/** Gap between two steps appearing, slow enough to read a row. */
const STEP_INTERVAL_MS = 850;
/** How long a finished run stays on screen before the next one starts. */
const FINISHED_HOLD_MS = 4200;

interface SessionPlaybackOptions {
  stepCount: number;
  /** False under reduced motion: every step shows at once and nothing advances. */
  animate: boolean;
  /** Called once the finished run has been held on screen; omit to stay put. */
  onFinished?: () => void;
}

interface SessionPlayback {
  /** How many steps are visible. */
  shown: number;
  done: boolean;
}

/**
 * Reveals a scripted run one step at a time. Remount the caller (React `key`)
 * to restart from the first step.
 */
export function useSessionPlayback({
  stepCount,
  animate,
  onFinished,
}: SessionPlaybackOptions): SessionPlayback {
  const [revealed, setRevealed] = useState(0);
  const shown = animate ? revealed : stepCount;
  const done = shown >= stepCount;

  useEffect(() => {
    if (!animate || revealed >= stepCount) return;
    const id = setTimeout(() => setRevealed((n) => n + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [animate, revealed, stepCount]);

  useEffect(() => {
    if (!animate || !done || !onFinished) return;
    const id = setTimeout(onFinished, FINISHED_HOLD_MS);
    return () => clearTimeout(id);
  }, [animate, done, onFinished]);

  return { shown, done };
}
