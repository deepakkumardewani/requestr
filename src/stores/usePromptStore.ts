"use client";

import { create } from "zustand";

/** Highest priority first; `relay-coach` is user-initiated and takes the slot directly. */
export const PROMPT_PRIORITY_ORDER = [
  "tour",
  "analytics-notice",
  "whats-new",
  "backup-nudge",
  "feedback",
] as const;

export type PromptId = (typeof PROMPT_PRIORITY_ORDER)[number] | "relay-coach";

type RequestOptions = {
  /** Higher wins. Defaults to the id's rank in `PROMPT_PRIORITY_ORDER`. */
  priority?: number;
  /** Auto prompts are preempted by `openUserInitiated` and re-queued. */
  auto?: boolean;
};

type PromptEntry = {
  id: PromptId;
  priority: number;
  auto: boolean;
  /** Insertion order: keeps ties stable and survives preemption. */
  seq: number;
};

type PromptState = {
  /** The one prompt allowed on screen, or null when the slot is free. */
  active: PromptId | null;
  current: PromptEntry | null;
  queue: PromptEntry[];
  nextSeq: number;
};

type PromptActions = {
  request: (id: PromptId, options?: RequestOptions) => void;
  release: (id: PromptId) => void;
  openUserInitiated: (id: PromptId) => void;
};

function defaultPriority(id: PromptId): number {
  const rank = PROMPT_PRIORITY_ORDER.findIndex((candidate) => candidate === id);
  return rank === -1 ? 0 : PROMPT_PRIORITY_ORDER.length - rank;
}

function byPriority(a: PromptEntry, b: PromptEntry): number {
  return b.priority - a.priority || a.seq - b.seq;
}

function withoutId(queue: PromptEntry[], id: PromptId): PromptEntry[] {
  return queue.filter((entry) => entry.id !== id);
}

function grantNext(queue: PromptEntry[]): Partial<PromptState> {
  const [next, ...rest] = [...queue].sort(byPriority);
  return { active: next?.id ?? null, current: next ?? null, queue: rest };
}

export const usePromptStore = create<PromptState & PromptActions>(
  (set, get) => {
    let grantScheduled = false;

    // Same-tick requests are all queued before the slot is granted, so the
    // winner depends on priority and order, not on which effect ran first.
    function scheduleGrant() {
      if (grantScheduled) return;
      grantScheduled = true;
      queueMicrotask(() => {
        grantScheduled = false;
        const { current, queue } = get();
        if (current === null) set(grantNext(queue));
      });
    }

    return {
      active: null,
      current: null,
      queue: [],
      nextSeq: 0,

      request(id, options = {}) {
        const { active, queue, nextSeq } = get();
        if (active === id || queue.some((entry) => entry.id === id)) return;
        const entry: PromptEntry = {
          id,
          priority: options.priority ?? defaultPriority(id),
          auto: options.auto ?? true,
          seq: nextSeq,
        };
        set({ queue: [...queue, entry], nextSeq: nextSeq + 1 });
        if (active === null) scheduleGrant();
      },

      // Safe to call for an id that was never granted: unmount never deadlocks the slot.
      release(id) {
        const { active, queue } = get();
        if (active === id) {
          set(grantNext(queue));
          return;
        }
        set({ queue: withoutId(queue, id) });
      },

      openUserInitiated(id) {
        const { active, current, queue, nextSeq } = get();
        if (active === id) return;
        const preempted = current?.auto ? current : null;
        const rest = withoutId(queue, id);
        set({
          active: id,
          current: { id, priority: Infinity, auto: false, seq: nextSeq },
          queue: preempted ? [...rest, preempted] : rest,
          nextSeq: nextSeq + 1,
        });
      },
    };
  },
);
