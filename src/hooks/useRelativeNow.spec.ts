/** @vitest-environment happy-dom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELATIVE_NOW_FRESH_TICK_MS,
  RELATIVE_NOW_TICK_MS,
  useRelativeNow,
} from "./useRelativeNow";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useRelativeNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("ticks every interval", () => {
    const { result } = renderHook(() => useRelativeNow());
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(RELATIVE_NOW_TICK_MS);
    });

    expect(result.current).toBe(initial + RELATIVE_NOW_TICK_MS);
  });

  it("ticks every second while fresh", () => {
    const { result } = renderHook(() =>
      useRelativeNow(undefined, { isFresh: true })
    );
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(RELATIVE_NOW_FRESH_TICK_MS * 3);
    });

    expect(result.current).toBe(initial + RELATIVE_NOW_FRESH_TICK_MS * 3);
  });

  it("does not tick while hidden and catches up immediately when visible", () => {
    const { result } = renderHook(() => useRelativeNow());
    const initial = result.current;

    act(() => setVisibility("hidden"));
    act(() => {
      vi.advanceTimersByTime(RELATIVE_NOW_TICK_MS * 4);
    });
    expect(result.current).toBe(initial);

    act(() => setVisibility("visible"));
    expect(result.current).toBe(initial + RELATIVE_NOW_TICK_MS * 4);

    act(() => {
      vi.advanceTimersByTime(RELATIVE_NOW_TICK_MS);
    });
    expect(result.current).toBe(initial + RELATIVE_NOW_TICK_MS * 5);
  });

  it("starts paused when mounted in a hidden tab", () => {
    setVisibility("hidden");
    const { result } = renderHook(() => useRelativeNow());
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(RELATIVE_NOW_TICK_MS * 2);
    });

    expect(result.current).toBe(initial);
  });

  it("clears the interval and listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useRelativeNow());
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });
});
