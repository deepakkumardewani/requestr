/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchDemoButton } from "./WatchDemoButton";

describe("WatchDemoButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the button without mounting a dialog or any video source", () => {
    const { baseElement } = render(<WatchDemoButton />);
    expect(
      screen.getByRole("button", { name: /watch the demo/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(baseElement.querySelector("video")).toBeNull();
    expect(baseElement.querySelector("source")).toBeNull();
  });

  it("opens the dialog with the demo clip after a click", async () => {
    const user = userEvent.setup();
    render(<WatchDemoButton />);
    await user.click(screen.getByRole("button", { name: /watch the demo/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const video = screen.getByLabelText("Requestr demo recording");
    expect(video.querySelector("source")).toHaveAttribute(
      "src",
      "/intro/clip-1.webm",
    );
  });

  it("closes on Escape, pauses the video and refocuses the button", async () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    render(<WatchDemoButton />);
    const button = screen.getByRole("button", { name: /watch the demo/i });
    await user.click(button);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pause).toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it("can reopen after closing", async () => {
    const user = userEvent.setup();
    render(<WatchDemoButton />);
    const button = screen.getByRole("button", { name: /watch the demo/i });
    await user.click(button);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await user.click(button);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
