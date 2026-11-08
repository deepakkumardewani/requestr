/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoVideo } from "./DemoVideo";

describe("DemoVideo", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a labelled controllable video with poster and both sources", () => {
    const { container } = render(<DemoVideo src="/intro/clip-1" label="Demo" />);
    const video = screen.getByLabelText("Demo");
    expect(video).toHaveAttribute("poster", "/intro/clip-1.webp");
    expect(video).toHaveAttribute("controls");
    const sources = [...container.querySelectorAll("source")].map((s) => [
      s.getAttribute("src"),
      s.getAttribute("type"),
    ]);
    expect(sources).toEqual([
      ["/intro/clip-1.webm", "video/webm"],
      ["/intro/clip-1.mp4", "video/mp4"],
    ]);
  });

  it("pauses the video when it unmounts", () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const { unmount } = render(<DemoVideo src="/intro/clip-1" label="Demo" />);
    expect(pause).not.toHaveBeenCalled();
    unmount();
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
