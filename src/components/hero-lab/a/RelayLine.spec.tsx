/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionMock = vi.hoisted(() => vi.fn());
vi.mock("../useHeroMotion", () => ({ useHeroMotion: motionMock }));

import { RELAY_PROMPT, RelayLine } from "./RelayLine";

const TYPING_INTERVAL_MS = 40;

describe("RelayLine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motionMock.mockReturnValue({ reduced: false, animate: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows an idle hint before any response exists", () => {
    render(<RelayLine responseStatus={null} />);
    expect(screen.getByText(/Send the request/)).toBeTruthy();
    expect(screen.queryByTestId("hero-a-relay")).toBeNull();
  });

  it("types the prompt character by character, then shows the passing assertion", () => {
    render(<RelayLine responseStatus={200} />);
    expect(screen.getByTestId("hero-a-relay").textContent).toBe("Relay");
    expect(screen.queryByTestId("hero-a-assertion")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(TYPING_INTERVAL_MS * 3);
    });
    expect(screen.getByTestId("hero-a-relay").textContent).toBe(
      "Relay" + RELAY_PROMPT.slice(0, 3),
    );
    expect(screen.queryByTestId("hero-a-assertion")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(TYPING_INTERVAL_MS * (RELAY_PROMPT.length + 2));
    });
    expect(screen.getByTestId("hero-a-relay").textContent).toBe(
      "Relay" + RELAY_PROMPT,
    );
    expect(screen.getByTestId("hero-a-assertion").textContent).toContain(
      "passed",
    );
  });

  it("shows a failed assertion when the status differs", () => {
    render(<RelayLine responseStatus={404} />);
    act(() => {
      vi.advanceTimersByTime(TYPING_INTERVAL_MS * (RELAY_PROMPT.length + 2));
    });
    expect(screen.getByTestId("hero-a-assertion").textContent).toContain(
      "failed",
    );
  });

  it("renders the finished static state at once with reduced motion", () => {
    motionMock.mockReturnValue({ reduced: true, animate: false });
    render(<RelayLine responseStatus={200} />);
    expect(screen.getByTestId("hero-a-relay").textContent).toBe(
      "Relay" + RELAY_PROMPT,
    );
    expect(screen.getByTestId("hero-a-assertion")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets typing when the response goes away", () => {
    const { rerender } = render(<RelayLine responseStatus={200} />);
    act(() => {
      vi.advanceTimersByTime(TYPING_INTERVAL_MS * 5);
    });
    rerender(<RelayLine responseStatus={null} />);
    expect(screen.queryByTestId("hero-a-relay")).toBeNull();
    rerender(<RelayLine responseStatus={200} />);
    expect(screen.getByTestId("hero-a-relay").textContent).toBe("Relay");
  });
});
