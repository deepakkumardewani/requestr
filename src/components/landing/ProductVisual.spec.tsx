/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductVisual } from "./ProductVisual";

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe("ProductVisual", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the default GET request", () => {
    mockReducedMotion(false);
    render(<ProductVisual />);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("GET");
    expect(screen.getByText("200 OK")).toBeInTheDocument();
  });

  it("switches tabs with arrow keys", () => {
    mockReducedMotion(true);
    render(<ProductVisual />);

    const getTab = screen.getByRole("tab", { name: /GET/i });
    getTab.focus();
    fireEvent.keyDown(getTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("POST");
  });

  it("switches URL and response when changing tabs", () => {
    mockReducedMotion(true);
    render(<ProductVisual />);

    fireEvent.click(screen.getByRole("tab", { name: /POST/i }));
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("POST");
    expect(screen.getByText("201 Created")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /DELETE/i }));
    expect(screen.getByText("200 OK")).toBeInTheDocument();
  });

  it("cycles through at least three distinct responses on repeated Send clicks", () => {
    mockReducedMotion(true);
    render(<ProductVisual />);
    const send = screen.getByRole("button", { name: "Send" });

    fireEvent.click(send);
    expect(screen.getByText(/"Bob"/)).toBeInTheDocument();

    fireEvent.click(send);
    expect(screen.getByText("404 Not Found")).toBeInTheDocument();

    fireEvent.click(send);
    expect(screen.getByText("[]")).toBeInTheDocument();
  });

  it("shows loading overlay without hiding the current response", async () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    render(<ProductVisual />);

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText(/Waiting for response/)).toBeInTheDocument();
    expect(screen.getByText("200 OK")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText(/"Bob"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("keeps response panel height stable when switching tabs", () => {
    mockReducedMotion(true);
    const { container } = render(<ProductVisual />);
    const panel = container.querySelector('[data-testid="response-panel"]') as HTMLElement;
    const initialHeight = panel.offsetHeight;

    fireEvent.click(screen.getByRole("tab", { name: /POST/i }));
    expect(panel.offsetHeight).toBe(initialHeight);

    fireEvent.click(screen.getByRole("tab", { name: /DELETE/i }));
    expect(panel.offsetHeight).toBe(initialHeight);
  });

  it("keeps response panel height stable when cycling short responses", () => {
    mockReducedMotion(true);
    const { container } = render(<ProductVisual />);
    const panel = container.querySelector('[data-testid="response-panel"]') as HTMLElement;
    const initialHeight = panel.offsetHeight;
    const send = screen.getByRole("button", { name: "Send" });

    for (let i = 0; i < 3; i++) {
      fireEvent.click(send);
    }

    expect(screen.getByText("[]")).toBeInTheDocument();
    expect(panel.offsetHeight).toBe(initialHeight);
  });
});
