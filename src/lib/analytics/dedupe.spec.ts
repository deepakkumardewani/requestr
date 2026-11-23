/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetDedupeState,
  safeStorage,
  shouldSendOnce,
  shouldSendOncePerSession,
  withinSessionCap,
} from "./dedupe";

beforeEach(() => {
  localStorage.clear();
  resetDedupeState();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("safeStorage", () => {
  it("round-trips values through localStorage", () => {
    safeStorage.set("k", "v");
    expect(localStorage.getItem("k")).toBe("v");
    expect(safeStorage.get("k")).toBe("v");
  });

  it("returns null for a missing key", () => {
    expect(safeStorage.get("missing")).toBeNull();
  });

  it("removes from both storage and memory", () => {
    safeStorage.set("k", "v");
    safeStorage.remove("k");
    expect(localStorage.getItem("k")).toBeNull();
    expect(safeStorage.get("k")).toBeNull();
  });

  describe("when localStorage throws", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const broken = () => {
        throw new Error("denied");
      };
      vi.stubGlobal("localStorage", {
        getItem: broken,
        setItem: broken,
        removeItem: broken,
      });
    });

    it("falls back to memory without throwing", () => {
      expect(() => safeStorage.set("k", "v")).not.toThrow();
      expect(safeStorage.get("k")).toBe("v");
      expect(() => safeStorage.remove("k")).not.toThrow();
      expect(safeStorage.get("k")).toBeNull();
    });

    it("warns only once across repeated failures", () => {
      safeStorage.get("a");
      safeStorage.set("a", "1");
      safeStorage.remove("a");
      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it("warns again after state is reset", () => {
      safeStorage.get("a");
      resetDedupeState();
      safeStorage.get("a");
      expect(console.warn).toHaveBeenCalledTimes(2);
    });
  });

  it("works with memory only when localStorage is absent", () => {
    vi.stubGlobal("localStorage", undefined);
    safeStorage.set("k", "v");
    expect(safeStorage.get("k")).toBe("v");
    safeStorage.remove("k");
    expect(safeStorage.get("k")).toBeNull();
  });
});

describe("shouldSendOnce", () => {
  it("is true the first time and false afterwards", () => {
    expect(shouldSendOnce("first_request")).toBe(true);
    expect(shouldSendOnce("first_request")).toBe(false);
  });

  it("tracks keys independently", () => {
    expect(shouldSendOnce("a")).toBe(true);
    expect(shouldSendOnce("b")).toBe(true);
  });

  it("persists across in-memory resets via storage", () => {
    shouldSendOnce("a");
    resetDedupeState();
    expect(shouldSendOnce("a")).toBe(false);
  });
});

describe("shouldSendOncePerSession", () => {
  it("is true once per key until reset", () => {
    expect(shouldSendOncePerSession("k")).toBe(true);
    expect(shouldSendOncePerSession("k")).toBe(false);
    expect(shouldSendOncePerSession("other")).toBe(true);
    resetDedupeState();
    expect(shouldSendOncePerSession("k")).toBe(true);
  });

  it("does not touch storage", () => {
    shouldSendOncePerSession("k");
    expect(localStorage.length).toBe(0);
  });
});

describe("withinSessionCap", () => {
  it("allows exactly max calls then refuses", () => {
    expect([1, 2, 3, 4].map(() => withinSessionCap("k", 3))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("counts keys separately", () => {
    withinSessionCap("a", 1);
    expect(withinSessionCap("a", 1)).toBe(false);
    expect(withinSessionCap("b", 1)).toBe(true);
  });

  it("refuses everything when max is 0", () => {
    expect(withinSessionCap("k", 0)).toBe(false);
  });

  it("restarts the count after reset", () => {
    withinSessionCap("k", 1);
    resetDedupeState();
    expect(withinSessionCap("k", 1)).toBe(true);
  });
});
