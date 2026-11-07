/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  scrollProgress,
  stageForProgress,
  useScrollChoreography,
} from "./useScrollChoreography";

const VIEWPORT = 1000;
const TRACK_HEIGHT = 4000;

describe("scrollProgress", () => {
  it("is 0 when the track is not scrollable", () => {
    expect(scrollProgress({ top: -50, height: 800 }, VIEWPORT)).toBe(0);
    expect(scrollProgress({ top: -50, height: VIEWPORT }, VIEWPORT)).toBe(0);
  });

  it("is 0 before the track top reaches the viewport top", () => {
    expect(scrollProgress({ top: 300, height: TRACK_HEIGHT }, VIEWPORT)).toBe(0);
  });

  it("is proportional mid-track", () => {
    expect(scrollProgress({ top: -1500, height: TRACK_HEIGHT }, VIEWPORT)).toBe(
      0.5,
    );
  });

  it("clamps to 1 past the end", () => {
    expect(scrollProgress({ top: -9000, height: TRACK_HEIGHT }, VIEWPORT)).toBe(
      1,
    );
  });
});

describe("stageForProgress", () => {
  it.each([
    [0, 0],
    [0.24, 0],
    [0.25, 1],
    [0.6, 2],
    [0.99, 3],
    [1, 3],
  ])("progress %s maps to stage %s of 4", (progress, stage) => {
    expect(stageForProgress(progress, 4)).toBe(stage);
  });
});

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

describe("useScrollChoreography", () => {
  let observerCallbacks: ObserverCallback[];
  let disconnect: ReturnType<typeof vi.fn>;
  let rafQueue: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let top: number;
  let track: HTMLDivElement;

  const flushFrames = () => {
    const pending = [...rafQueue.values()];
    rafQueue.clear();
    act(() => pending.forEach((cb) => cb(0)));
  };
  const setInView = (isIntersecting: boolean) =>
    act(() => observerCallbacks.forEach((cb) => cb([{ isIntersecting }])));
  const scrollTo = (nextTop: number) => {
    top = nextTop;
    window.dispatchEvent(new Event("scroll"));
  };

  beforeEach(() => {
    observerCallbacks = [];
    disconnect = vi.fn();
    rafQueue = new Map();
    nextFrame = 1;
    top = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: ObserverCallback) {
          observerCallbacks.push(cb);
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = nextFrame++;
      rafQueue.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => rafQueue.delete(id));
    vi.stubGlobal("innerHeight", VIEWPORT);
    track = document.createElement("div");
    track.getBoundingClientRect = () =>
      ({ top, height: TRACK_HEIGHT }) as DOMRect;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const render = (enabled = true, ref: HTMLElement | null = track) =>
    renderHook(
      ({ on }) =>
        useScrollChoreography({
          trackRef: { current: ref },
          stageCount: 4,
          enabled: on,
        }),
      { initialProps: { on: enabled } },
    );

  it("starts at stage 0, progress 0, out of view", () => {
    const { result } = render();
    expect(result.current).toEqual({ progress: 0, stage: 0, inView: false });
  });

  it("does not observe or listen when disabled (reduced motion)", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { result } = render(false);
    expect(observerCallbacks).toHaveLength(0);
    expect(add).not.toHaveBeenCalledWith(
      "scroll",
      expect.anything(),
      expect.anything(),
    );
    expect(result.current.progress).toBe(0);
    add.mockRestore();
  });

  it("does nothing when the track ref is empty", () => {
    const { result } = render(true, null);
    expect(observerCallbacks).toHaveLength(0);
    expect(result.current.inView).toBe(false);
  });

  it("ignores scroll while the track is off-screen", () => {
    const { result } = render();
    setInView(false);
    scrollTo(-3000);
    flushFrames();
    expect(result.current.progress).toBe(0);
    expect(rafQueue.size).toBe(0);
  });

  it("maps scroll positions to progress and stage once in view", () => {
    const { result } = render();
    setInView(true);
    expect(result.current.inView).toBe(true);

    scrollTo(-1500);
    flushFrames();
    expect(result.current.progress).toBe(0.5);
    expect(result.current.stage).toBe(2);

    scrollTo(-3000);
    flushFrames();
    expect(result.current.progress).toBe(1);
    expect(result.current.stage).toBe(3);

    scrollTo(0);
    flushFrames();
    expect(result.current.progress).toBe(0);
    expect(result.current.stage).toBe(0);
  });

  it("syncs immediately on entering view without a scroll event", () => {
    top = -750;
    const { result } = render();
    setInView(true);
    expect(result.current.progress).toBe(0.25);
    expect(result.current.stage).toBe(1);
  });

  it("coalesces several scroll events into one frame", () => {
    const { result } = render();
    setInView(true);
    scrollTo(-300);
    scrollTo(-600);
    scrollTo(-900);
    expect(rafQueue.size).toBe(1);
    flushFrames();
    expect(result.current.progress).toBe(0.3);
  });

  it("treats a missing observer entry as out of view", () => {
    const { result } = render();
    act(() => observerCallbacks.forEach((cb) => cb([])));
    expect(result.current.inView).toBe(false);
  });

  it("pauses when the track leaves view and stops listening", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { result } = render();
    setInView(true);
    setInView(false);
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    scrollTo(-3000);
    expect(rafQueue.size).toBe(0);
    expect(result.current.inView).toBe(false);
    remove.mockRestore();
  });

  it("cancels a pending frame on unmount and disconnects the observer", () => {
    const { unmount } = render();
    setInView(true);
    scrollTo(-300);
    expect(rafQueue.size).toBe(1);
    unmount();
    expect(rafQueue.size).toBe(0);
    expect(disconnect).toHaveBeenCalled();
  });

  it("stops tracking when disabled after being enabled", () => {
    const { result, rerender } = render();
    setInView(true);
    rerender({ on: false });
    scrollTo(-3000);
    expect(rafQueue.size).toBe(0);
    expect(result.current.progress).toBe(0);
  });
});
