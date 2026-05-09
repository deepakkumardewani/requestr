/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Virtualizer needs real DOM layout — mock it to render all items synchronously
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: (i: number) => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * estimateSize(i),
        size: estimateSize(i),
        key: i,
        lane: 0,
        end: (i + 1) * estimateSize(i),
        measureElement: () => undefined,
      })),
    getTotalSize: () => count * 22,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
  }),
}));

import React from "react";
import { TimingWaterfall } from "./TimingWaterfall";
import type { TimingData } from "@/types";

afterEach(cleanup);

function makeTiming(overrides: Partial<TimingData> = {}): TimingData {
  return {
    dns: 5,
    tcp: 10,
    tls: 15,
    ttfb: 20,
    download: 10,
    total: 60,
    ...overrides,
  };
}

describe("TimingWaterfall — bottleneck detection", () => {
  it("does NOT highlight TTFB when it is below 80% of total", () => {
    render(<TimingWaterfall timing={makeTiming({ ttfb: 20, total: 60 })} />);
    expect(screen.queryByText("bottleneck")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("timing-row[data-bottleneck]"),
    ).not.toBeInTheDocument();
  });

  it("highlights TTFB when it is above 80% of total time", () => {
    // ttfb = 85 of total 100 → 85% > 80% threshold
    render(
      <TimingWaterfall
        timing={makeTiming({ ttfb: 85, dns: 5, tcp: 5, tls: 0, download: 5, total: 100 })}
      />,
    );
    expect(screen.getByText("bottleneck")).toBeInTheDocument();
  });

  it("marks the bottleneck row with data-bottleneck attribute", () => {
    render(
      <TimingWaterfall
        timing={makeTiming({ ttfb: 85, dns: 5, tcp: 5, tls: 0, download: 5, total: 100 })}
      />,
    );
    const rows = screen.getAllByTestId("timing-row");
    // data-bottleneck={true} renders as attribute "true" (boolean coerced to string)
    const ttfbRow = rows.find((r) => r.hasAttribute("data-bottleneck"));
    expect(ttfbRow).toBeDefined();
  });

  it("does NOT mark any row as bottleneck when TTFB is exactly 80%", () => {
    // Exactly 80% — threshold is strictly >80%, so not highlighted
    render(
      <TimingWaterfall
        timing={makeTiming({ ttfb: 80, dns: 10, tcp: 5, tls: 0, download: 5, total: 100 })}
      />,
    );
    expect(screen.queryByText("bottleneck")).not.toBeInTheDocument();
  });

  it("renders all 5 timing segments as rows", () => {
    render(<TimingWaterfall timing={makeTiming()} />);
    const rows = screen.getAllByTestId("timing-row");
    expect(rows).toHaveLength(5);
  });

  it("renders timing labels for each segment", () => {
    render(<TimingWaterfall timing={makeTiming()} />);
    expect(screen.getByText("DNS")).toBeInTheDocument();
    expect(screen.getByText("TCP")).toBeInTheDocument();
    expect(screen.getByText("TLS")).toBeInTheDocument();
    // TTFB label is inside a span along with potential bottleneck span
    expect(screen.getByText(/TTFB/)).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("shows N/A for null timing segments", () => {
    render(<TimingWaterfall timing={makeTiming({ tls: null as unknown as number })} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
