/** @vitest-environment happy-dom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STABLE_FRAMES_TO_STOP,
  useRevealedRow,
  useSidebarRevealStore,
} from "./useSidebarRevealStore";

describe("useSidebarRevealStore", () => {
  beforeEach(() => useSidebarRevealStore.setState({ revealed: null }));

  it("starts with nothing revealed", () => {
    expect(useSidebarRevealStore.getState().revealed).toBeNull();
  });

  it("reveal records the id and clear removes it", () => {
    useSidebarRevealStore.getState().reveal("f1");
    expect(useSidebarRevealStore.getState().revealed).toEqual({ id: "f1" });
    useSidebarRevealStore.getState().clear();
    expect(useSidebarRevealStore.getState().revealed).toBeNull();
  });

  it("makes a fresh request object each time so repeats are distinguishable", () => {
    useSidebarRevealStore.getState().reveal("f1");
    const first = useSidebarRevealStore.getState().revealed;
    useSidebarRevealStore.getState().reveal("f1");
    expect(useSidebarRevealStore.getState().revealed).not.toBe(first);
  });
});

afterEach(cleanup);

describe("useRevealedRow", () => {
  const scrollIntoView = vi.fn();
  /** Mounts the hook with a real element on its ref, as a tree row would. */
  const mountRow = (id: string) => {
    const hook = renderHook(() => useRevealedRow<HTMLDivElement>(id));
    return hook;
  };
  beforeEach(() => {
    useSidebarRevealStore.setState({ revealed: null });
    scrollIntoView.mockReset();
  });

  it("is not selected while nothing is revealed", () => {
    const { result } = mountRow("a");
    expect(result.current.selected).toBe(false);
  });

  it("selects only the revealed row and scrolls it into view", () => {
    const element = document.createElement("div");
    element.scrollIntoView = scrollIntoView;
    const a = renderHook(() => useRevealedRow<HTMLDivElement>("a"));
    const b = renderHook(() => {
      const row = useRevealedRow<HTMLDivElement>("b");
      row.ref.current = element;
      return row;
    });
    act(() => useSidebarRevealStore.getState().reveal("b"));
    expect(b.result.current.selected).toBe(true);
    expect(a.result.current.selected).toBe(false);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("scrolls again when the same row is revealed twice", () => {
    const element = document.createElement("div");
    element.scrollIntoView = scrollIntoView;
    renderHook(() => {
      const row = useRevealedRow<HTMLDivElement>("a");
      row.ref.current = element;
      return row;
    });
    act(() => useSidebarRevealStore.getState().reveal("a"));
    act(() => useSidebarRevealStore.getState().reveal("a"));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("deselects after clear", () => {
    const { result } = mountRow("a");
    act(() => useSidebarRevealStore.getState().reveal("a"));
    expect(result.current.selected).toBe(true);
    act(() => useSidebarRevealStore.getState().clear());
    expect(result.current.selected).toBe(false);
  });

  it("does not throw where scrollIntoView is unavailable or the row is unmounted", () => {
    const element = document.createElement("div");
    Object.assign(element, { scrollIntoView: undefined });
    renderHook(() => {
      const row = useRevealedRow<HTMLDivElement>("a");
      row.ref.current = element;
      return row;
    });
    renderHook(() => useRevealedRow<HTMLDivElement>("a"));
    expect(() =>
      act(() => useSidebarRevealStore.getState().reveal("a")),
    ).not.toThrow();
  });
});

describe("useRevealedRow frame following", () => {
  const MAX_SETTLE_FRAMES = 90;
  let frames: FrameRequestCallback[];
  let top: number;
  const scrollIntoView = vi.fn();

  const runFrame = () => {
    const callback = frames.shift();
    act(() => callback?.(0));
  };
  const mountRevealed = () => {
    const element = document.createElement("div");
    element.scrollIntoView = scrollIntoView;
    element.getBoundingClientRect = () => ({ top }) as DOMRect;
    renderHook(() => {
      const row = useRevealedRow<HTMLDivElement>("a");
      row.ref.current = element;
      return row;
    });
    act(() => useSidebarRevealStore.getState().reveal("a"));
  };

  beforeEach(() => {
    frames = [];
    top = 0;
    scrollIntoView.mockReset();
    useSidebarRevealStore.setState({ revealed: null });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("re-scrolls when the row moved and keeps following", () => {
    mountRevealed();
    top = 40;
    top = 40;
    runFrame();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(frames).toHaveLength(1);
  });

  it("stops following only after the row holds still for several frames", () => {
    mountRevealed();
    for (let i = 1; i < STABLE_FRAMES_TO_STOP; i++) {
      runFrame();
      expect(frames).toHaveLength(1);
    }
    runFrame();
    expect(frames).toHaveLength(0);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("stops at the frame cap even if the row keeps moving", () => {
    mountRevealed();
    for (let frame = 1; frame <= MAX_SETTLE_FRAMES + 5 && frames.length; frame++) {
      top += 1;
      runFrame();
    }
    expect(frames).toHaveLength(0);
    expect(scrollIntoView).toHaveBeenCalledTimes(MAX_SETTLE_FRAMES + 1);
  });
});
