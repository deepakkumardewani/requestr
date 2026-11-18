type CoalescerOptions = {
  /** Largest gap between two events that still counts as one run. */
  windowMs: number;
  /** Injectable clock so tests never depend on real time. */
  now?: () => number;
};

export type Coalescer = {
  /** Records an event; true when it continues the previous run (gap <= windowMs). */
  tick: () => boolean;
  /** Ends the current run so the next event opens a fresh one. */
  reset: () => void;
};

/** Groups rapid repeated events into runs; callers fold every event after the first into one. */
export function createCoalescer({
  windowMs,
  now = Date.now,
}: CoalescerOptions): Coalescer {
  let lastAt: number | null = null;
  return {
    tick() {
      const at = now();
      const continues = lastAt !== null && at - lastAt <= windowMs;
      lastAt = at;
      return continues;
    },
    reset() {
      lastAt = null;
    },
  };
}
