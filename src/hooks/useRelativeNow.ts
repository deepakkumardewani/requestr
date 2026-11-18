import { useEffect, useState } from "react";

export const RELATIVE_NOW_TICK_MS = 30_000;
/** Faster cadence while a timestamp is under a minute old so "5 seconds ago" stays honest. */
export const RELATIVE_NOW_FRESH_TICK_MS = 1_000;

type UseRelativeNowOptions = {
  /** True while any displayed timestamp is under one minute old. */
  isFresh?: boolean;
};

/**
 * A ticking `now` for relative-time labels. Pauses while the tab is hidden and
 * refreshes immediately when it becomes visible again. Call once per tree and
 * pass `now` down to leaf components.
 */
export function useRelativeNow(
  intervalMs: number = RELATIVE_NOW_TICK_MS,
  { isFresh = false }: UseRelativeNowOptions = {},
): number {
  const [now, setNow] = useState(() => Date.now());
  const tickMs = isFresh
    ? Math.min(RELATIVE_NOW_FRESH_TICK_MS, intervalMs)
    : intervalMs;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => setNow(Date.now()), tickMs);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      setNow(Date.now());
      start();
    };

    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [tickMs]);

  return now;
}
