/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConceptC } from "./ConceptC";

const mocks = vi.hoisted(() => ({ reduced: false }));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mocks.reduced,
}));

const TICK_MS = 2200;
const status = () => screen.getByTestId("hero-c-status");

describe("ConceptC", () => {
  beforeEach(() => {
    mocks.reduced = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the headline and a CTA to the app", () => {
    render(<ConceptC />);
    expect(
      screen.getByRole("heading", { level: 1, name: /send the request/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the app/i })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("starts on 200 OK and cycles through the status codes, wrapping around", () => {
    render(<ConceptC />);
    expect(status()).toHaveTextContent("200 OK");
    const expected = ["201 Created", "404 Not Found", "500 Server Error", "200 OK"];
    for (const text of expected) {
      act(() => {
        vi.advanceTimersByTime(TICK_MS);
      });
      expect(status()).toHaveTextContent(text);
    }
  });

  it("does not advance before the interval elapses", () => {
    render(<ConceptC />);
    act(() => {
      vi.advanceTimersByTime(TICK_MS - 1);
    });
    expect(status()).toHaveTextContent("200 OK");
  });

  it("stops ticking after unmount", () => {
    const { unmount } = render(<ConceptC />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stays on a static 200 OK under reduced motion and starts no timer", () => {
    mocks.reduced = true;
    render(<ConceptC />);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(TICK_MS * 5);
    });
    expect(status()).toHaveTextContent("200 OK");
  });
});
