/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_IDLE_WINDOW_MS,
  FEEDBACK_SNOOZE_MS,
  isFeedbackEligible,
  isIdle,
  type FeedbackEligibilityInput,
  type IdleSignals,
} from "./eligibility";
import type { FeedbackState } from "./feedbackState";

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const idleSignals = (overrides: Partial<IdleSignals> = {}): IdleSignals => ({
  requestInFlight: false,
  chainRunning: false,
  inputFocused: false,
  lastActivityAt: null,
  ...overrides,
});

const stateWith = (overrides: Partial<FeedbackState> = {}): FeedbackState => ({
  counters: { successfulRequests: 10, chainRuns: 0, relayActions: 0 },
  dismissedAt: null,
  submitted: false,
  ...overrides,
});

const input = (
  overrides: Partial<FeedbackEligibilityInput> = {}
): FeedbackEligibilityInput => ({
  sessionDays: ["2026-01-01", "2026-01-02", "2026-01-03"],
  isFirstSession: false,
  state: stateWith(),
  shownThisSession: false,
  idle: idleSignals(),
  now: NOW,
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isFeedbackEligible", () => {
  it("is eligible when every rule is satisfied", () => {
    expect(isFeedbackEligible(input())).toBe(true);
  });

  it("is not eligible in the first session", () => {
    expect(isFeedbackEligible(input({ isFirstSession: true }))).toBe(false);
  });

  it("is not eligible with fewer than 3 session days", () => {
    expect(
      isFeedbackEligible(input({ sessionDays: ["2026-01-01", "2026-01-02"] }))
    ).toBe(false);
  });

  it("is eligible with more than 3 session days", () => {
    expect(
      isFeedbackEligible(input({ sessionDays: ["a", "b", "c", "d", "e"] }))
    ).toBe(true);
  });

  it("is not eligible with no usage at all", () => {
    const state = stateWith({
      counters: { successfulRequests: 0, chainRuns: 0, relayActions: 0 },
    });
    expect(isFeedbackEligible(input({ state }))).toBe(false);
  });

  it("is not eligible at 9 successful requests", () => {
    const state = stateWith({
      counters: { successfulRequests: 9, chainRuns: 0, relayActions: 0 },
    });
    expect(isFeedbackEligible(input({ state }))).toBe(false);
  });

  it("is eligible with one chain run alone", () => {
    const state = stateWith({
      counters: { successfulRequests: 0, chainRuns: 1, relayActions: 0 },
    });
    expect(isFeedbackEligible(input({ state }))).toBe(true);
  });

  it("is eligible with one relay action alone", () => {
    const state = stateWith({
      counters: { successfulRequests: 0, chainRuns: 0, relayActions: 1 },
    });
    expect(isFeedbackEligible(input({ state }))).toBe(true);
  });

  it("is not eligible within 30 days of a dismissal", () => {
    const state = stateWith({ dismissedAt: NOW - FEEDBACK_SNOOZE_MS + 1 });
    expect(isFeedbackEligible(input({ state }))).toBe(false);
  });

  it("is eligible again exactly 30 days after a dismissal", () => {
    const state = stateWith({ dismissedAt: NOW - FEEDBACK_SNOOZE_MS });
    expect(isFeedbackEligible(input({ state }))).toBe(true);
  });

  it("is not eligible once feedback was submitted, however long ago", () => {
    const state = stateWith({ submitted: true });
    expect(isFeedbackEligible(input({ state, now: NOW + 400 * DAY }))).toBe(
      false
    );
  });

  it("is not eligible when a prompt was already shown this session", () => {
    expect(isFeedbackEligible(input({ shownThisSession: true }))).toBe(false);
  });

  it("is not eligible while the user is not idle", () => {
    expect(
      isFeedbackEligible(
        input({ idle: idleSignals({ requestInFlight: true }) })
      )
    ).toBe(false);
  });

  it("gives the same answer when analytics is opted out (R34)", () => {
    const before = isFeedbackEligible(input());
    vi.stubGlobal("navigator", { doNotTrack: "1", globalPrivacyControl: true });
    expect(isFeedbackEligible(input())).toBe(before);
    expect(isFeedbackEligible(input({ isFirstSession: true }))).toBe(false);
  });
});

describe("isIdle", () => {
  it("is idle with no activity recorded", () => {
    expect(isIdle(idleSignals(), NOW)).toBe(true);
  });

  it("is not idle while a request is in flight", () => {
    expect(isIdle(idleSignals({ requestInFlight: true }), NOW)).toBe(false);
  });

  it("is not idle while a chain is running", () => {
    expect(isIdle(idleSignals({ chainRunning: true }), NOW)).toBe(false);
  });

  it("is not idle while an input is focused", () => {
    expect(isIdle(idleSignals({ inputFocused: true }), NOW)).toBe(false);
  });

  it("is not idle with activity just under the idle window ago", () => {
    const lastActivityAt = NOW - FEEDBACK_IDLE_WINDOW_MS + 1;
    expect(isIdle(idleSignals({ lastActivityAt }), NOW)).toBe(false);
  });

  it("is idle once the idle window has fully elapsed", () => {
    const lastActivityAt = NOW - FEEDBACK_IDLE_WINDOW_MS;
    expect(isIdle(idleSignals({ lastActivityAt }), NOW)).toBe(true);
  });
});
