// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsTruncated } from "./useIsTruncated";

type Callback = () => void;
const observers: { cb: Callback; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeResizeObserver {
  disconnect = vi.fn();
  constructor(cb: Callback) {
    observers.push({ cb, disconnect: this.disconnect });
  }
  observe = vi.fn();
}

function makeElement(scrollWidth: number, clientWidth: number) {
  const el = document.createElement("p");
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
    writable: true,
  });
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    value: clientWidth,
    writable: true,
  });
  return el;
}

/** Attaches the element during render so the layout effect finds it on mount. */
function renderWith(el: HTMLElement | null, initial: string) {
  return renderHook(
    ({ content }) => {
      const result = useIsTruncated<HTMLElement>(content);
      (result.ref as { current: HTMLElement | null }).current = el;
      return result;
    },
    { initialProps: { content: initial } }
  );
}

describe("useIsTruncated", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is false before any element is attached", () => {
    const { result } = renderHook(() => useIsTruncated<HTMLElement>("x"));
    expect(result.current.isTruncated).toBe(false);
  });

  it("is false when content fits and true when it overflows", () => {
    const fits = renderWith(makeElement(100, 100), "a");
    const clipped = renderWith(makeElement(150, 100), "b");
    expect(fits.result.current.isTruncated).toBe(false);
    expect(clipped.result.current.isTruncated).toBe(true);
  });

  it("re-measures when the element is resized", () => {
    const el = makeElement(150, 100);
    const { result } = renderWith(el, "a");
    expect(result.current.isTruncated).toBe(true);

    Object.defineProperty(el, "clientWidth", {
      configurable: true,
      value: 200,
    });
    act(() => observers[observers.length - 1].cb());

    expect(result.current.isTruncated).toBe(false);
  });

  it("disconnects the observer on unmount and when content changes", () => {
    const { rerender, unmount } = renderWith(makeElement(10, 10), "a");
    rerender({ content: "b" });
    expect(observers[0].disconnect).toHaveBeenCalled();
    unmount();
    expect(observers[observers.length - 1].disconnect).toHaveBeenCalled();
  });

  it("still measures once when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { result } = renderWith(makeElement(150, 100), "a");
    expect(result.current.isTruncated).toBe(true);
  });
});
