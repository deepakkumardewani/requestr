/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelativeNowProvider } from "./RelativeNowProvider";
import { RelativeTime } from "./RelativeTime";

vi.mock("next-intl", () => ({
  useFormatter: () => ({
    relativeTime: (date: number, now: number) =>
      `${Math.round((now - date) / 1000)}s ago`,
    dateTime: (date: number) => `ABS:${new Date(date).toISOString()}`,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement<{ dateTime: string; className?: string }>;
    children: React.ReactNode;
  }) => <render.type {...render.props}>{children}</render.type>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
}));

const TIMESTAMP = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("RelativeTime", () => {
  afterEach(cleanup);

  it("renders a <time> with a valid ISO dateTime and relative text", () => {
    render(<RelativeTime timestamp={TIMESTAMP} now={TIMESTAMP + 30_000} />);

    const el = screen.getByText("30s ago");
    expect(el.tagName).toBe("TIME");
    expect(el).toHaveAttribute("datetime", "2026-01-01T12:00:00.000Z");
  });

  it("shows the absolute time in the tooltip", () => {
    render(<RelativeTime timestamp={TIMESTAMP} now={TIMESTAMP + 1000} />);

    expect(screen.getByTestId("tooltip")).toHaveTextContent(
      "ABS:2026-01-01T12:00:00.000Z"
    );
  });

  it("re-renders when the shared now changes", () => {
    const { rerender } = render(
      <RelativeTime timestamp={TIMESTAMP} now={TIMESTAMP + 30_000} />
    );
    rerender(<RelativeTime timestamp={TIMESTAMP} now={TIMESTAMP + 60_000} />);

    expect(screen.getByText("60s ago")).toBeInTheDocument();
  });

  it("renders nothing for a non-finite timestamp", () => {
    const { container } = render(
      <RelativeTime timestamp={Number.NaN} now={TIMESTAMP} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shares ONE interval across many instances and advances them all", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    try {
      vi.setSystemTime(TIMESTAMP + 30_000);
      render(
        <RelativeNowProvider>
          {Array.from({ length: 50 }, (_, i) => (
            <RelativeTime key={i} timestamp={TIMESTAMP} />
          ))}
        </RelativeNowProvider>
      );
      expect(screen.getAllByText("30s ago")).toHaveLength(50);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getAllByText("60s ago")).toHaveLength(50);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    } finally {
      setIntervalSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("prefers an explicit `now` prop over the provider", () => {
    render(
      <RelativeNowProvider>
        <RelativeTime timestamp={TIMESTAMP} now={TIMESTAMP + 5_000} />
      </RelativeNowProvider>
    );
    expect(screen.getByText("5s ago")).toBeInTheDocument();
  });

  it("throws a descriptive error with neither `now` nor a provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<RelativeTime timestamp={TIMESTAMP} />)).toThrow(
        /RelativeNowProvider/
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
