/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoplayDemo } from "./useAutoplayDemo";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];

  emit(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this,
    );
  }
}

function makeContainerRef() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return { current: container };
}

describe("useAutoplayDemo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does nothing when disabled", () => {
    const onTick = vi.fn();
    const containerRef = makeContainerRef();
    renderHook(() =>
      useAutoplayDemo({ containerRef, enabled: false, onTick }),
    );

    act(() => vi.advanceTimersByTime(10_000));
    expect(onTick).not.toHaveBeenCalled();
  });

  it("ticks after the start delay and on each interval", () => {
    const onTick = vi.fn();
    const containerRef = makeContainerRef();
    renderHook(() => useAutoplayDemo({ containerRef, enabled: true, onTick }));

    act(() => vi.advanceTimersByTime(1499));
    expect(onTick).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onTick).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(4000));
    expect(onTick).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(4000));
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it("stops permanently on first interaction inside the container", () => {
    const onTick = vi.fn();
    const containerRef = makeContainerRef();
    renderHook(() => useAutoplayDemo({ containerRef, enabled: true, onTick }));

    containerRef.current.dispatchEvent(
      new Event("pointerdown", { bubbles: true }),
    );

    act(() => vi.advanceTimersByTime(20_000));
    expect(onTick).not.toHaveBeenCalled();
  });

  it("pauses ticks while the container is off-screen", () => {
    const onTick = vi.fn();
    const containerRef = makeContainerRef();
    renderHook(() => useAutoplayDemo({ containerRef, enabled: true, onTick }));

    const observer = MockIntersectionObserver.instances[0];
    observer.emit(false);

    act(() => vi.advanceTimersByTime(6000));
    expect(onTick).not.toHaveBeenCalled();

    observer.emit(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(onTick).toHaveBeenCalled();
  });
});
