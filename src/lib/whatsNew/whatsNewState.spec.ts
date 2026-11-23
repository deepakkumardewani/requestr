/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDedupeState } from "@/lib/analytics/dedupe";

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, unknown[] | undefined>,
  readError: null as Error | null,
  collect: vi.fn(),
}));

vi.mock("@/lib/backup/exporter", () => ({
  collectBackupData: (...args: unknown[]) => {
    mocks.collect(...args);
    return mocks.readError
      ? Promise.reject(mocks.readError)
      : Promise.resolve(mocks.data);
  },
}));

import {
  isReturningUser,
  LAST_SEEN_VERSION_KEY,
  readLastSeenVersion,
  recordSeenVersion,
} from "./whatsNewState";

const ONBOARDING_KEY = "rq_onboarding_complete";

beforeEach(() => {
  localStorage.clear();
  resetDedupeState();
  mocks.data = {};
  mocks.readError = null;
  mocks.collect.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("last seen version", () => {
  it("is null before anything is recorded", () => {
    expect(readLastSeenVersion()).toBeNull();
  });

  it("round-trips a recorded version and persists it under the stable key", () => {
    recordSeenVersion("1.4.0");
    expect(readLastSeenVersion()).toBe("1.4.0");
    expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe("1.4.0");
    expect(LAST_SEEN_VERSION_KEY).toBe("rq_whats_new_last_seen");
  });
});

describe("isReturningUser", () => {
  it("is false for a brand-new browser with no data", async () => {
    await expect(isReturningUser()).resolves.toBe(false);
  });

  it("is true with a stored last-seen version, without reading data", async () => {
    recordSeenVersion("0.1.0");
    await expect(isReturningUser()).resolves.toBe(true);
    expect(mocks.collect).not.toHaveBeenCalled();
  });

  it("is true once onboarding is complete", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    await expect(isReturningUser()).resolves.toBe(true);
    expect(mocks.collect).not.toHaveBeenCalled();
  });

  it.each(["requests", "collections", "chains"])(
    "is true when saved %s exist",
    async (list) => {
      mocks.data = { [list]: [{ id: "x" }] };
      await expect(isReturningUser()).resolves.toBe(true);
      expect(mocks.collect).toHaveBeenCalledWith(["collections", "chains"]);
    }
  );

  it("is false when every saved list is empty or absent", async () => {
    mocks.data = { requests: [], collections: [], chains: undefined };
    await expect(isReturningUser()).resolves.toBe(false);
  });

  it("stays false, and warns, when saved data cannot be read", async () => {
    mocks.readError = new Error("idb blocked");
    await expect(isReturningUser()).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      "[requestly] whats-new: could not read saved data",
      mocks.readError
    );
  });
});
