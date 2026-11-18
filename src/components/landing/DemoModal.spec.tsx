/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoModal } from "./DemoModal";

function Harness({ onChange }: { onChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        trigger
      </button>
      <DemoModal
        open={open}
        onOpenChange={(next) => {
          onChange?.(next);
          setOpen(next);
        }}
        src="/intro/clip-1"
      />
    </>
  );
}

describe("DemoModal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mounts no dialog and no video while closed", () => {
    const { baseElement } = render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(baseElement.querySelector("video")).toBeNull();
  });

  it("shows the title, description and video source when opened", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Watch the demo")).toBeInTheDocument();
    expect(
      screen.getByText(/Relay working in the real app/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Requestr demo recording")).toHaveAttribute(
      "poster",
      "/intro/clip-1.webp",
    );
  });

  it("shows an explicit Play button, requests metadata only and does not autoplay", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    const video = await screen.findByLabelText("Requestr demo recording");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).not.toHaveAttribute("autoplay");
    expect(play).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps the Play button when play is rejected", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new Error("blocked"),
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await user.click(await screen.findByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("closes on Escape, pauses the video and returns focus to the trigger", async () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "trigger" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pause).toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("hides Play once playback starts and shows it again on pause and end", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    const video = await screen.findByLabelText("Requestr demo recording");
    expect(video).not.toHaveAttribute("controls");
    fireEvent.play(video);
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
    fireEvent.pause(video);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    fireEvent.play(video);
    fireEvent.ended(video);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("lists webm then mp4 sources and no captions track by default", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    const video = await screen.findByLabelText("Requestr demo recording");
    const sources = [...video.querySelectorAll("source")].map((s) => [
      s.getAttribute("src"),
      s.getAttribute("type"),
    ]);
    expect(sources).toEqual([
      ["/intro/clip-1.webm", "video/webm"],
      ["/intro/clip-1.mp4", "video/mp4"],
    ]);
    expect(video.querySelector("track")).toBeNull();
  });

  it("renders a captions track and a custom poster when provided", async () => {
    render(
      <DemoModal
        open
        onOpenChange={() => {}}
        src="/intro/clip-1"
        poster="/intro/custom.webp"
        captionsSrc="/intro/clip-1.vtt"
      />,
    );
    const video = await screen.findByLabelText("Requestr demo recording");
    expect(video).toHaveAttribute("poster", "/intro/custom.webp");
    expect(video.querySelector("track")).toHaveAttribute(
      "src",
      "/intro/clip-1.vtt",
    );
  });

  it("traps Tab focus inside the open dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    const dialog = await screen.findByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
