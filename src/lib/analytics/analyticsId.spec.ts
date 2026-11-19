/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_ID_STORAGE_KEY,
  clearAnalyticsId,
  getAnalyticsId,
} from "./analyticsId";
import { resetDedupeState } from "./dedupe";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  localStorage.clear();
  resetDedupeState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("analytics id", () => {
  it("uses a key distinct from the rate-limit anon id", () => {
    expect(ANALYTICS_ID_STORAGE_KEY).toBe("rq_analytics_id");
    expect(ANALYTICS_ID_STORAGE_KEY).not.toBe("rq_anon_id");
  });

  it("mints a uuid on first call and persists it", () => {
    const id = getAnalyticsId();
    expect(id).toMatch(UUID_V4);
    expect(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY)).toBe(id);
  });

  it("returns the same id on later calls", () => {
    expect(getAnalyticsId()).toBe(getAnalyticsId());
  });

  it("reuses an id already in storage without generating one", () => {
    const spy = vi.spyOn(globalThis.crypto, "randomUUID");
    localStorage.setItem(ANALYTICS_ID_STORAGE_KEY, "existing-id");
    expect(getAnalyticsId()).toBe("existing-id");
    expect(spy).not.toHaveBeenCalled();
  });

  it("clears the id on opt-out and regenerates a different one", () => {
    const first = getAnalyticsId();
    clearAnalyticsId();
    expect(localStorage.getItem(ANALYTICS_ID_STORAGE_KEY)).toBeNull();
    const second = getAnalyticsId();
    expect(second).toMatch(UUID_V4);
    expect(second).not.toBe(first);
  });

  it("clearing when no id exists is a no-op", () => {
    expect(() => clearAnalyticsId()).not.toThrow();
  });

  it("still returns a stable id when storage is unavailable", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", {
      getItem: broken,
      setItem: broken,
      removeItem: broken,
    });
    try {
      const id = getAnalyticsId();
      expect(id).toMatch(UUID_V4);
      expect(getAnalyticsId()).toBe(id);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
