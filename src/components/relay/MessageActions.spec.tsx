/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRelayTelemetrySink } from "@/lib/relay/telemetry";
import { MessageActions } from "./MessageActions";

const writeText = vi.fn();
const sink = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  setRelayTelemetrySink(sink);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  sink.mockReset();
  setRelayTelemetrySink(null);
  vi.restoreAllMocks();
});

describe("MessageActions", () => {
  it("copies the markdown as-is and shows the copied label, then resets", async () => {
    render(<MessageActions markdown={"# Title\n\n- **bold** item"} />);
    const copy = screen.getByTestId("relay-copy-message");
    expect(copy).toHaveAttribute("aria-label", "actions.copy");

    await act(async () => {
      fireEvent.click(copy);
    });
    expect(writeText).toHaveBeenCalledWith("# Title\n\n- **bold** item");
    expect(copy).toHaveAttribute("aria-label", "copied");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(copy).toHaveAttribute("aria-label", "actions.copy");
  });

  it("restarts the reset window when copied twice", async () => {
    render(<MessageActions markdown="x" />);
    const copy = screen.getByTestId("relay-copy-message");
    await act(async () => {
      fireEvent.click(copy);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      fireEvent.click(copy);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(copy).toHaveAttribute("aria-label", "copied");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(copy).toHaveAttribute("aria-label", "actions.copy");
  });

  it("logs and keeps the copy label when the clipboard rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    writeText.mockRejectedValue(new Error("denied"));
    render(<MessageActions markdown="x" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("relay-copy-message"));
    });
    expect(screen.getByTestId("relay-copy-message")).toHaveAttribute("aria-label", "actions.copy");
    expect(error).toHaveBeenCalledWith("[relay] copy message failed", expect.any(Error));
  });

  it("shows Regenerate only when a handler is given, and calls it", () => {
    const { rerender } = render(<MessageActions markdown="x" />);
    expect(screen.queryByTestId("relay-regenerate")).toBeNull();
    const onRegenerate = vi.fn();
    rerender(<MessageActions markdown="x" onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByTestId("relay-regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("offers only Copy and Regenerate, with no rating buttons", () => {
    render(<MessageActions markdown="x" onRegenerate={() => {}} />);
    const group = screen.getByRole("group", { name: "actions.label" });
    expect(
      within(group).getAllByRole("button").map((b) => b.dataset.testid),
    ).toEqual(["relay-copy-message", "relay-regenerate"]);
    expect(sink).not.toHaveBeenCalled();
  });

  it("is a labelled group", () => {
    render(<MessageActions markdown="x" />);
    expect(screen.getByRole("group", { name: "actions.label" })).toBeTruthy();
  });

  it("clears the reset timer on unmount", async () => {
    const { unmount } = render(<MessageActions markdown="x" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("relay-copy-message"));
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
