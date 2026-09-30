/**
 * Hand-written bounded undo/redo history, one stack per chain id.
 *
 * P4.1 asked for approval to add `zundo`; approval could not be obtained
 * interactively in this run, so this module implements the documented
 * fallback: "a hand-written bounded history stack on the graph slice with
 * the same pause / resume / undo / redo surface, so P4.2 onwards is
 * unchanged." `useChainStore` composes this with its own `chains` map to
 * implement per-chain undo/redo.
 */

export type ChainHistoryState<T> = {
  past: T[];
  future: T[];
};

export function emptyChainHistory<T>(): ChainHistoryState<T> {
  return { past: [], future: [] };
}

export type ChainHistoryController<T> = {
  /** Captures `snapshot` as the pre-batch state for `key`, once, until `resume` is called. */
  pause: (key: string, snapshot: T) => void;
  /** Clears the pause for `key` and returns the snapshot captured by `pause`, if any. */
  resume: (key: string) => T | undefined;
  /** Whether `key` currently has an in-flight paused batch. */
  isPaused: (key: string) => boolean;
  /** Pushes `snapshot` onto `history.past`, clearing `future`, bounded to `limit` entries. */
  push: (history: ChainHistoryState<T>, snapshot: T) => ChainHistoryState<T>;
  /** Moves the top of `past` into `future` (holding `current`); null if `past` is empty. */
  undo: (
    history: ChainHistoryState<T>,
    current: T,
  ) => { snapshot: T; history: ChainHistoryState<T> } | null;
  /** Moves the head of `future` back onto `past` (holding `current`); null if `future` is empty. */
  redo: (
    history: ChainHistoryState<T>,
    current: T,
  ) => { snapshot: T; history: ChainHistoryState<T> } | null;
};

export function createHistory<T>(limit: number): ChainHistoryController<T> {
  const pausedSnapshots = new Map<string, T>();

  return {
    pause(key, snapshot) {
      if (!pausedSnapshots.has(key)) pausedSnapshots.set(key, snapshot);
    },
    resume(key) {
      const snapshot = pausedSnapshots.get(key);
      pausedSnapshots.delete(key);
      return snapshot;
    },
    isPaused(key) {
      return pausedSnapshots.has(key);
    },
    push(history, snapshot) {
      return { past: [...history.past, snapshot].slice(-limit), future: [] };
    },
    undo(history, current) {
      if (history.past.length === 0) return null;
      const snapshot = history.past[history.past.length - 1];
      return {
        snapshot,
        history: {
          past: history.past.slice(0, -1),
          future: [current, ...history.future],
        },
      };
    },
    redo(history, current) {
      if (history.future.length === 0) return null;
      const snapshot = history.future[0];
      return {
        snapshot,
        history: {
          past: [...history.past, current],
          future: history.future.slice(1),
        },
      };
    },
  };
}
