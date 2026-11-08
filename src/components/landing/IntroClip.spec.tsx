/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroClip } from "./IntroClip";

const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion.value,
}));

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: FakeObserver[] = [];

class FakeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(
    public callback: ObserverCallback,
    public options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
}

function emit(isIntersecting: boolean) {
  act(() => observers[0]?.callback([{ isIntersecting }]));
}

describe("IntroClip", () => {
  beforeEach(() => {
    observers = [];
    reducedMotion.value = false;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows only the lazy poster before it is near the viewport", () => {
    const { container } = render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    const img = screen.getByAltText("Chain");
    expect(img).toHaveAttribute("src", "/intro/clip-2.webp");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("source")).toBeNull();
  });

  it("observes the frame with a 200px pre-load margin", () => {
    render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    expect(observers).toHaveLength(1);
    expect(observers[0]?.options).toEqual({ rootMargin: "200px" });
    expect(observers[0]?.observe).toHaveBeenCalledTimes(1);
  });

  it("keeps the poster when the entry is not intersecting", () => {
    const { container } = render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    emit(false);
    expect(container.querySelector("video")).toBeNull();
    expect(observers[0]?.disconnect).not.toHaveBeenCalled();
  });

  it("ignores an empty entries list", () => {
    const { container } = render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    act(() => observers[0]?.callback([]));
    expect(container.querySelector("video")).toBeNull();
  });

  it("swaps in a muted looping video with both sources once near the viewport", () => {
    const { container } = render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    emit(true);
    const video = screen.getByLabelText("Chain");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("poster", "/intro/clip-2.webp");
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("preload", "metadata");
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(
      [...container.querySelectorAll("source")].map((s) =>
        s.getAttribute("src"),
      ),
    ).toEqual(["/intro/clip-2.webm", "/intro/clip-2.mp4"]);
    expect(container.querySelector("img")).toBeNull();
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  it("stays poster-only and never observes under reduced motion", () => {
    reducedMotion.value = true;
    const { container } = render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    expect(observers).toHaveLength(0);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("Chain")).toHaveAttribute(
      "src",
      "/intro/clip-2.webp",
    );
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<IntroClip src="/intro/clip-2" alt="Chain" />);
    unmount();
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  it("merges a custom className onto the frame", () => {
    const { container } = render(
      <IntroClip src="/intro/clip-2" alt="Chain" className="custom-frame" />,
    );
    expect(container.firstElementChild).toHaveClass("custom-frame", "rounded-xl");
  });
});
