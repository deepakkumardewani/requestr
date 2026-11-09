/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { DemoVideo } from "./DemoVideo";

const props = {
  src: "/media/relay/relay-loop",
  poster: "/media/relay/relay-poster.webp",
  alt: "Relay loop",
  width: 1280,
  height: 800,
};

let intersect: () => void;
let notIntersect: () => void;
let noEntries: () => void;

class FakeObserver {
  constructor(cb: IntersectionObserverCallback) {
    const self = this as unknown as IntersectionObserver;
    intersect = () =>
      cb([{ isIntersecting: true } as IntersectionObserverEntry], self);
    notIntersect = () =>
      cb([{ isIntersecting: false } as IntersectionObserverEntry], self);
    noEntries = () => cb([], self);
  }
  observe() {}
  disconnect() {}
}

describe("DemoVideo", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.stubGlobal(
      "matchMedia",
      () =>
        ({
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useSettingsStore.setState({ reducedMotion: "system" });
  });

  it("renders the poster first with a fixed aspect ratio and no video", () => {
    const { container } = render(<DemoVideo {...props} />);
    expect(screen.getByAltText("Relay loop")).toHaveAttribute(
      "src",
      props.poster,
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.firstElementChild).toHaveStyle({
      aspectRatio: "1280 / 800",
    });
  });

  it("mounts a muted looping inline video with both sources near the viewport", () => {
    const { container } = render(<DemoVideo {...props} />);
    act(() => intersect());
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    const sources = [...container.querySelectorAll("source")].map((s) => [
      s.getAttribute("src"),
      s.getAttribute("type"),
    ]);
    expect(sources).toEqual([
      ["/media/relay/relay-loop.webm", "video/webm"],
      ["/media/relay/relay-loop.mp4", "video/mp4"],
    ]);
  });

  it("hides the video until it plays so the poster stays visible", () => {
    const { container } = render(<DemoVideo {...props} />);
    act(() => intersect());
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).toHaveClass("opacity-0");
    fireEvent.playing(video);
    expect(video).toHaveClass("opacity-100");
  });

  it("drops the video and keeps the poster when the last source errors", () => {
    const { container } = render(<DemoVideo {...props} />);
    act(() => intersect());
    const mp4 = container.querySelector('source[type="video/mp4"]') as Element;
    fireEvent.error(mp4);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("Relay loop")).toBeInTheDocument();
  });

  it("hides the video again when it pauses", () => {
    const { container } = render(<DemoVideo {...props} />);
    act(() => intersect());
    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.playing(video);
    fireEvent.pause(video);
    expect(video).toHaveClass("opacity-0");
  });

  it("ignores observer callbacks that are not intersecting", () => {
    const { container } = render(<DemoVideo {...props} />);
    act(() => notIntersect());
    expect(container.querySelector("video")).toBeNull();
    act(() => noEntries());
    expect(container.querySelector("video")).toBeNull();
  });

  it("defaults the poster to the source path with a webp extension", () => {
    render(<DemoVideo {...props} poster={undefined} />);
    expect(screen.getByAltText("Relay loop")).toHaveAttribute(
      "src",
      "/media/relay/relay-loop.webp",
    );
  });

  it("applies a custom className to the frame", () => {
    const { container } = render(<DemoVideo {...props} className="frame" />);
    expect(container.firstElementChild).toHaveClass("frame");
  });

  it("never mounts a video under reduced motion", () => {
    useSettingsStore.setState({ reducedMotion: "on" });
    const { container } = render(<DemoVideo {...props} />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("Relay loop")).toBeInTheDocument();
  });
});
