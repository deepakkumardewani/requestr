import type { FeedbackState } from "@/lib/feedback/feedbackState";

export const FEEDBACK_MIN_SESSION_DAYS = 3;
export const FEEDBACK_MIN_SUCCESSFUL_REQUESTS = 10;
export const FEEDBACK_MIN_CHAIN_RUNS = 1;
export const FEEDBACK_MIN_RELAY_ACTIONS = 1;
export const FEEDBACK_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
export const FEEDBACK_IDLE_WINDOW_MS = 3000;

export type IdleSignals = {
  requestInFlight: boolean;
  chainRunning: boolean;
  /** A focused input, textarea, contenteditable or editor. */
  inputFocused: boolean;
  /** Epoch ms of the last pointer or key activity; null when none yet. */
  lastActivityAt: number | null;
};

export type FeedbackEligibilityInput = {
  /** Distinct local session days, as returned by `getSessionDays`. */
  sessionDays: readonly string[];
  isFirstSession: boolean;
  state: FeedbackState;
  /** An auto-prompt was already shown in this page session. */
  shownThisSession: boolean;
  idle: IdleSignals;
  now: number;
};

function hasEnoughUsage({ counters }: FeedbackState): boolean {
  return (
    counters.successfulRequests >= FEEDBACK_MIN_SUCCESSFUL_REQUESTS ||
    counters.chainRuns >= FEEDBACK_MIN_CHAIN_RUNS ||
    counters.relayActions >= FEEDBACK_MIN_RELAY_ACTIONS
  );
}

export function isIdle(idle: IdleSignals, now: number): boolean {
  if (idle.requestInFlight || idle.chainRunning || idle.inputFocused) {
    return false;
  }
  return (
    idle.lastActivityAt === null ||
    now - idle.lastActivityAt >= FEEDBACK_IDLE_WINDOW_MS
  );
}

function isSnoozed(state: FeedbackState, now: number): boolean {
  return (
    state.dismissedAt !== null && now - state.dismissedAt < FEEDBACK_SNOOZE_MS
  );
}

/** Pure: whether the feedback auto-prompt may be requested right now (R30-R33). */
export function isFeedbackEligible(input: FeedbackEligibilityInput): boolean {
  const { state, now } = input;
  if (state.submitted || input.isFirstSession || input.shownThisSession) {
    return false;
  }
  if (input.sessionDays.length < FEEDBACK_MIN_SESSION_DAYS) return false;
  if (!hasEnoughUsage(state) || isSnoozed(state, now)) return false;
  return isIdle(input.idle, now);
}
