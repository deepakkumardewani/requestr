/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDedupeState } from "@/lib/analytics/dedupe";
import {
  getSessionDays,
  isFirstSession,
  recordSession,
  SESSION_DAYS_STORAGE_KEY,
} from "./sessionTracker";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const stored = () =>
  JSON.parse(localStorage.getItem(SESSION_DAYS_STORAGE_KEY) ?? "null");

beforeEach(() => {
  localStorage.clear();
  resetDedupeState();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("recordSession", () => {
  it("records the first session as a local-date string", () => {
    recordSession(at(2026, 3, 5));
    expect(stored()).toEqual(["2026-03-05"]);
  });

  it("is idempotent within a day", () => {
    recordSession(at(2026, 3, 5));
    recordSession(at(2026, 3, 5));
    expect(stored()).toEqual(["2026-03-05"]);
  });

  it("appends later days in order", () => {
    recordSession(at(2026, 3, 5));
    recordSession(at(2026, 3, 7));
    expect(stored()).toEqual(["2026-03-05", "2026-03-07"]);
  });

  it("keeps only the most recent 365 days", () => {
    const days = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    localStorage.setItem(SESSION_DAYS_STORAGE_KEY, JSON.stringify(days));
    recordSession(at(2026, 1, 1));
    const result = stored();
    expect(result).toHaveLength(365);
    expect(result[0]).toBe(days[1]);
    expect(result[364]).toBe("2026-01-01");
  });

  it("drops future-dated entries when rewriting", () => {
    localStorage.setItem(
      SESSION_DAYS_STORAGE_KEY,
      JSON.stringify(["2026-03-01", "2030-01-01"]),
    );
    recordSession(at(2026, 3, 5));
    expect(stored()).toEqual(["2026-03-01", "2026-03-05"]);
  });

  it("does not throw when storage fails and keeps the day in memory", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = () => {
      throw new Error("quota");
    };
    vi.stubGlobal("localStorage", {
      getItem: broken,
      setItem: broken,
      removeItem: broken,
    });
    expect(() => recordSession(at(2026, 3, 5))).not.toThrow();
    expect(getSessionDays(at(2026, 3, 5))).toEqual(["2026-03-05"]);
  });
});

describe("getSessionDays", () => {
  it("returns an empty list with nothing stored", () => {
    expect(getSessionDays(at(2026, 3, 5))).toEqual([]);
  });

  it("sorts and de-duplicates stored days", () => {
    localStorage.setItem(
      SESSION_DAYS_STORAGE_KEY,
      JSON.stringify(["2026-03-04", "2026-03-02", "2026-03-04"]),
    );
    expect(getSessionDays(at(2026, 3, 5))).toEqual(["2026-03-02", "2026-03-04"]);
  });

  it("ignores future dates", () => {
    localStorage.setItem(
      SESSION_DAYS_STORAGE_KEY,
      JSON.stringify(["2026-03-04", "2026-03-06"]),
    );
    expect(getSessionDays(at(2026, 3, 5))).toEqual(["2026-03-04"]);
  });

  it("includes today", () => {
    localStorage.setItem(SESSION_DAYS_STORAGE_KEY, JSON.stringify(["2026-03-05"]));
    expect(getSessionDays(at(2026, 3, 5))).toEqual(["2026-03-05"]);
  });

  it("filters out malformed entries", () => {
    localStorage.setItem(
      SESSION_DAYS_STORAGE_KEY,
      JSON.stringify(["2026-03-04", "March 3", 20260301, null, "2026-3-4"]),
    );
    expect(getSessionDays(at(2026, 3, 5))).toEqual(["2026-03-04"]);
  });

  it("returns empty and warns on corrupt JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(SESSION_DAYS_STORAGE_KEY, "{not json");
    expect(getSessionDays(at(2026, 3, 5))).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns empty when the stored value is not an array", () => {
    localStorage.setItem(SESSION_DAYS_STORAGE_KEY, JSON.stringify({ a: 1 }));
    expect(getSessionDays(at(2026, 3, 5))).toEqual([]);
  });

  it("defaults to the current clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(at(2026, 3, 5));
      recordSession();
      expect(getSessionDays()).toEqual(["2026-03-05"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("isFirstSession", () => {
  it("is true when nothing is recorded", () => {
    expect(isFirstSession(at(2026, 3, 5))).toBe(true);
  });

  it("is true when today is the earliest recorded day", () => {
    recordSession(at(2026, 3, 5));
    expect(isFirstSession(at(2026, 3, 5))).toBe(true);
  });

  it("is false once an earlier day exists", () => {
    recordSession(at(2026, 3, 5));
    recordSession(at(2026, 3, 6));
    expect(isFirstSession(at(2026, 3, 6))).toBe(false);
  });

  it("treats only future-dated entries as no history", () => {
    localStorage.setItem(SESSION_DAYS_STORAGE_KEY, JSON.stringify(["2030-01-01"]));
    expect(isFirstSession(at(2026, 3, 5))).toBe(true);
  });

  it("is true on the first session even when storage fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", {
      getItem: broken,
      setItem: broken,
      removeItem: broken,
    });
    expect(isFirstSession(at(2026, 3, 5))).toBe(true);
  });

  it("defaults to the current clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(at(2026, 3, 5));
      expect(isFirstSession()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
