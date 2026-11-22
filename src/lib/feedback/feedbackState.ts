import { safeStorage } from "@/lib/analytics/dedupe";

/** Versioned so a future shape change can ignore old data instead of migrating it. */
export const FEEDBACK_STATE_STORAGE_KEY = "rq_feedback_v1";

export type FeedbackCounterKind =
  | "successfulRequests"
  | "chainRuns"
  | "relayActions";

export type FeedbackState = {
  counters: Record<FeedbackCounterKind, number>;
  /** Epoch ms of the last auto-prompt dismissal, or null. */
  dismissedAt: number | null;
  /** True once the user has submitted feedback: never ask again. */
  submitted: boolean;
};

const EMPTY_COUNTERS: Record<FeedbackCounterKind, number> = {
  successfulRequests: 0,
  chainRuns: 0,
  relayActions: 0,
};

const COUNTER_KINDS = Object.keys(EMPTY_COUNTERS) as FeedbackCounterKind[];

const emptyState = (): FeedbackState => ({
  counters: { ...EMPTY_COUNTERS },
  dismissedAt: null,
  submitted: false,
});

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function parseState(raw: string, now: number): FeedbackState {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return emptyState();
  const record = parsed as Record<string, unknown>;
  const stored = (record.counters ?? {}) as Record<string, unknown>;
  const counters = { ...EMPTY_COUNTERS };
  for (const kind of COUNTER_KINDS) counters[kind] = toCount(stored[kind]);
  const dismissedAt =
    typeof record.dismissedAt === "number" && record.dismissedAt <= now
      ? record.dismissedAt
      : null;
  return { counters, dismissedAt, submitted: record.submitted === true };
}

/** Independent of analytics consent. Future-dated dismissals are ignored so a bad clock cannot snooze forever. */
export function readFeedbackState(now: number = Date.now()): FeedbackState {
  const raw = safeStorage.get(FEEDBACK_STATE_STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    return parseState(raw, now);
  } catch (error) {
    console.warn("[requestly] feedback: corrupt state", error);
    return emptyState();
  }
}

function writeFeedbackState(state: FeedbackState): void {
  safeStorage.set(FEEDBACK_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function incrementFeedbackCounter(kind: FeedbackCounterKind): void {
  const state = readFeedbackState();
  state.counters[kind] += 1;
  writeFeedbackState(state);
}

export function recordFeedbackDismiss(now: number = Date.now()): void {
  writeFeedbackState({ ...readFeedbackState(now), dismissedAt: now });
}

export function recordFeedbackSubmit(): void {
  writeFeedbackState({ ...readFeedbackState(), submitted: true });
}
