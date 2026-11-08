/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFinalFrame, getScenarioDuration } from "./relayDemoEngine";
import { RELAY_SCENARIOS } from "./scenarios";
import { TICK_MS, useRelayDemo } from "./useRelayDemo";

const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion.value,
}));

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observers: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(
    public callback: IOCallback,
    public options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
}

function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function setInView(isIntersecting: boolean) {
  act(() => observers.at(-1)!.callback([{ isIntersecting }]));
}

function renderDemo() {
  const el = document.createElement("div");
  return renderHook(() => useRelayDemo({ current: el }));
}

describe("useRelayDemo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observers = [];
    reducedMotion.value = false;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts at the first scenario with an empty frame, not static", () => {
    const { result } = renderDemo();
    expect(result.current.scenario).toBe(RELAY_SCENARIOS[0]);
    expect(result.current.frame).toEqual({
      promptText: "",
      replyText: "",
      visibleCards: 0,
    });
    expect(result.current.isStatic).toBe(false);
  });

  it("observes the container with a partial-visibility threshold", () => {
    renderDemo();
    expect(observers[0].observe).toHaveBeenCalledTimes(1);
    expect(observers[0].options).toEqual({ threshold: 0.3 });
  });

  it("registers no timers until the demo is in view", () => {
    renderDemo();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(5000));
  });

  it("types the prompt once in view", () => {
    const { result } = renderDemo();
    setInView(true);
    act(() => vi.advanceTimersByTime(TICK_MS * 4));
    expect(result.current.frame.promptText).toBe(
      RELAY_SCENARIOS[0].prompt.slice(0, 5),
    );
  });

  it("pauses and clears the timer when scrolled off-screen", () => {
    const { result } = renderDemo();
    setInView(true);
    act(() => vi.advanceTimersByTime(TICK_MS * 4));
    const before = result.current.frame;
    setInView(false);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.frame).toEqual(before);
  });

  it("pauses when the tab is hidden and resumes when shown", () => {
    const { result } = renderDemo();
    setInView(true);
    act(() => vi.advanceTimersByTime(TICK_MS * 4));
    const before = result.current.frame;

    act(() => setTabHidden(true));
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.frame).toEqual(before);

    act(() => setTabHidden(false));
    act(() => vi.advanceTimersByTime(TICK_MS * 4));
    expect(result.current.frame.promptText.length).toBeGreaterThan(
      before.promptText.length,
    );
  });

  it("starts paused when the tab is already hidden on mount", () => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    renderDemo();
    setInView(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cycles through at least 3 scenarios and loops back to the first", () => {
    const { result } = renderDemo();
    setInView(true);
    const seen: string[] = [result.current.scenario.id];
    for (let i = 0; i < RELAY_SCENARIOS.length; i++) {
      act(() =>
        vi.advanceTimersByTime(
          Math.ceil(getScenarioDuration(RELAY_SCENARIOS[i]) / TICK_MS) * TICK_MS,
        ),
      );
      seen.push(result.current.scenario.id);
    }
    expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
    expect(seen.at(-1)).toBe(RELAY_SCENARIOS[0].id);
  });

  it("treats a missing intersection entry as off-screen", () => {
    const { result } = renderDemo();
    setInView(true);
    act(() => observers.at(-1)!.callback([] as never));
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.isStatic).toBe(false);
  });

  it("disconnects the observer and removes the listener on unmount", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderDemo();
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("does nothing when the container ref is empty", () => {
    renderHook(() => useRelayDemo({ current: null }));
    expect(observers).toHaveLength(0);
  });

  describe("reduced motion", () => {
    beforeEach(() => {
      reducedMotion.value = true;
    });

    it("returns the first scenario's final frame as static", () => {
      const { result } = renderDemo();
      expect(result.current.isStatic).toBe(true);
      expect(result.current.scenario).toBe(RELAY_SCENARIOS[0]);
      expect(result.current.frame).toEqual(getFinalFrame(RELAY_SCENARIOS[0]));
    });

    it("never observes or starts timers and the frame never changes", () => {
      const { result } = renderDemo();
      expect(observers).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      act(() => vi.advanceTimersByTime(60_000));
      expect(result.current.frame).toEqual(getFinalFrame(RELAY_SCENARIOS[0]));
    });
  });
});
