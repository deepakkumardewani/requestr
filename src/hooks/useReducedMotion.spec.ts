/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useReducedMotion } from "./useReducedMotion";

type MqListener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners: MqListener[] = [];
  const mq = {
    matches,
    addEventListener: vi.fn((_: string, fn: MqListener) => listeners.push(fn)),
    removeEventListener: vi.fn((_: string, fn: MqListener) => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchChange: (newMatches: boolean) => {
      listeners.forEach((fn) => fn({ matches: newMatches } as MediaQueryListEvent));
    },
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mq),
  });
  return mq;
}

describe("useReducedMotion", () => {
  beforeEach(() => useSettingsStore.setState({ reducedMotion: "system" }));
  afterEach(() => vi.restoreAllMocks());

  it("returns false when prefers-reduced-motion is not set", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce is active", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("updates when media query changes", () => {
    const mq = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => mq.dispatchChange(true));
    expect(result.current).toBe(true);
  });

  it("on forces reduced motion and off forces motion, whatever the OS says", () => {
    mockMatchMedia(false);
    const forced = renderHook(() => useReducedMotion());
    act(() => useSettingsStore.setState({ reducedMotion: "on" }));
    expect(forced.result.current).toBe(true);
    expect(document.documentElement.dataset.reducedMotion).toBe("on");

    mockMatchMedia(true);
    const off = renderHook(() => useReducedMotion());
    act(() => useSettingsStore.setState({ reducedMotion: "off" }));
    expect(off.result.current).toBe(false);
    expect(document.documentElement.dataset.reducedMotion).toBe("off");
  });

  it("system follows the OS and leaves no attribute on <html>", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    expect(document.documentElement.hasAttribute("data-reduced-motion")).toBe(false);
  });

  it("stops listening to the media query on unmount", () => {
    const mq = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(mq.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    expect(result.current).toBe(false);
  });
});
