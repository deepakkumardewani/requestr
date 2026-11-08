/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
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
      screen.getByText(/real app running a request chain/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Requestr demo recording")).toHaveAttribute(
      "poster",
      "/intro/clip-1.webp",
    );
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

  it("closes via the close button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
