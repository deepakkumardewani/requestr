/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDedupeState } from "@/lib/analytics/dedupe";
import {
  FEEDBACK_STATE_STORAGE_KEY,
  incrementFeedbackCounter,
  readFeedbackState,
  recordFeedbackDismiss,
  recordFeedbackSubmit,
} from "./feedbackState";

const NOW = 1_700_000_000_000;

const store = (value: unknown) =>
  localStorage.setItem(FEEDBACK_STATE_STORAGE_KEY, JSON.stringify(value));

const stored = () =>
  JSON.parse(localStorage.getItem(FEEDBACK_STATE_STORAGE_KEY) ?? "null");

beforeEach(() => {
  localStorage.clear();
  resetDedupeState();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readFeedbackState", () => {
  it("returns an empty state when nothing is stored", () => {
    expect(readFeedbackState(NOW)).toEqual({
      counters: { successfulRequests: 0, chainRuns: 0, relayActions: 0 },
      dismissedAt: null,
      submitted: false,
    });
  });

  it("restores stored counters, dismissal and submission", () => {
    store({
      counters: { successfulRequests: 4, chainRuns: 2, relayActions: 7 },
      dismissedAt: NOW - 1000,
      submitted: true,
    });
    expect(readFeedbackState(NOW)).toEqual({
      counters: { successfulRequests: 4, chainRuns: 2, relayActions: 7 },
      dismissedAt: NOW - 1000,
      submitted: true,
    });
  });

  it("ignores a future-dated dismissal", () => {
    store({ dismissedAt: NOW + 1 });
    expect(readFeedbackState(NOW).dismissedAt).toBeNull();
  });

  it("keeps a dismissal dated exactly now", () => {
    store({ dismissedAt: NOW });
    expect(readFeedbackState(NOW).dismissedAt).toBe(NOW);
  });

  it("sanitises invalid counters to 0 and floors fractions", () => {
    store({
      counters: { successfulRequests: -3, chainRuns: "5", relayActions: 2.9 },
    });
    expect(readFeedbackState(NOW).counters).toEqual({
      successfulRequests: 0,
      chainRuns: 0,
      relayActions: 2,
    });
  });

  it("treats non-true submitted values as not submitted", () => {
    store({ submitted: "yes" });
    expect(readFeedbackState(NOW).submitted).toBe(false);
  });

  it("returns an empty state for a non-object payload", () => {
    localStorage.setItem(FEEDBACK_STATE_STORAGE_KEY, "42");
    expect(readFeedbackState(NOW).counters.chainRuns).toBe(0);
    localStorage.setItem(FEEDBACK_STATE_STORAGE_KEY, "null");
    expect(readFeedbackState(NOW).submitted).toBe(false);
  });

  it("returns an empty state and warns for corrupt JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(FEEDBACK_STATE_STORAGE_KEY, "{not json");
    expect(readFeedbackState(NOW)).toEqual({
      counters: { successfulRequests: 0, chainRuns: 0, relayActions: 0 },
      dismissedAt: null,
      submitted: false,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("defaults to the current clock when no time is passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store({ dismissedAt: NOW + 5000 });
    expect(readFeedbackState().dismissedAt).toBeNull();
    store({ dismissedAt: NOW - 5000 });
    expect(readFeedbackState().dismissedAt).toBe(NOW - 5000);
    vi.useRealTimers();
  });
});

describe("incrementFeedbackCounter", () => {
  it("increments only the named counter and persists it", () => {
    incrementFeedbackCounter("chainRuns");
    incrementFeedbackCounter("chainRuns");
    incrementFeedbackCounter("relayActions");
    expect(stored().counters).toEqual({
      successfulRequests: 0,
      chainRuns: 2,
      relayActions: 1,
    });
  });

  it("preserves dismissal and submission when incrementing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store({ dismissedAt: NOW - 10, submitted: true });
    incrementFeedbackCounter("successfulRequests");
    expect(stored()).toMatchObject({
      dismissedAt: NOW - 10,
      submitted: true,
    });
    vi.useRealTimers();
  });
});

describe("recordFeedbackDismiss", () => {
  it("stores the dismissal time and keeps counters", () => {
    store({ counters: { successfulRequests: 3 } });
    recordFeedbackDismiss(NOW);
    expect(stored().dismissedAt).toBe(NOW);
    expect(stored().counters.successfulRequests).toBe(3);
  });

  it("defaults to the current clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    recordFeedbackDismiss();
    expect(stored().dismissedAt).toBe(NOW);
    vi.useRealTimers();
  });
});

describe("recordFeedbackSubmit", () => {
  it("marks the state submitted and keeps other fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store({ counters: { chainRuns: 2 }, dismissedAt: NOW - 1 });
    recordFeedbackSubmit();
    expect(stored()).toMatchObject({
      submitted: true,
      dismissedAt: NOW - 1,
      counters: { chainRuns: 2 },
    });
    vi.useRealTimers();
  });
});

describe("storage failure", () => {
  it("falls back to memory when localStorage throws, without throwing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    vi.stubGlobal("localStorage", broken);
    expect(() => recordFeedbackSubmit()).not.toThrow();
    expect(readFeedbackState(NOW).submitted).toBe(true);
    incrementFeedbackCounter("relayActions");
    expect(readFeedbackState(NOW).counters.relayActions).toBe(1);
  });
});
