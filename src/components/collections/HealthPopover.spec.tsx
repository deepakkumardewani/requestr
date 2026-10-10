/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Popover } from "@/components/ui/popover";
import type { HealthMetrics } from "@/types";
import { HealthPopoverContent } from "./HealthPopover";

const METRICS: HealthMetrics = {
  successRate: 60,
  p50: 120.5,
  p95: 300,
  lastStatus: 200,
  entryCount: 5,
};

type Overrides = Partial<{
  metrics: HealthMetrics;
  recentTimes: number[];
  statusCounts: { success: number; clientError: number; serverError: number };
  onViewHistory: () => void;
}>;

function renderPopover(overrides: Overrides = {}) {
  const onViewHistory = overrides.onViewHistory ?? vi.fn();
  render(
    <Popover open>
      <HealthPopoverContent
        metrics={overrides.metrics ?? METRICS}
        recentTimes={overrides.recentTimes ?? [100, 120, 140]}
        statusCounts={
          overrides.statusCounts ?? {
            success: 3,
            clientError: 1,
            serverError: 1,
          }
        }
        onViewHistory={onViewHistory}
      />
    </Popover>,
  );
  return { onViewHistory };
}

afterEach(cleanup);

describe("HealthPopoverContent", () => {
  it("shows the header with the number of requests sampled", () => {
    renderPopover();
    expect(screen.getByText("Request Health")).toBeInTheDocument();
    expect(screen.getByText("Last 5 requests")).toBeInTheDocument();
  });

  it("shows success rate, p50 and p95, trimming trailing zeros from durations", () => {
    renderPopover();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("120.5ms")).toBeInTheDocument();
    expect(screen.getByText("300ms")).toBeInTheDocument();
  });

  it("shows only the status buckets that have requests", () => {
    renderPopover({
      statusCounts: { success: 4, clientError: 0, serverError: 1 },
    });
    expect(screen.getByText(/2xx/)).toHaveTextContent("4 2xx");
    expect(screen.getByText(/5xx/)).toHaveTextContent("1 5xx");
    expect(screen.queryByText(/4xx/)).toBeNull();
  });

  it("hides the status breakdown when no responses were counted", () => {
    renderPopover({
      statusCounts: { success: 0, clientError: 0, serverError: 0 },
    });
    expect(screen.queryByText("Status breakdown")).toBeNull();
  });

  it("shows the response time trend only with at least two samples", () => {
    renderPopover({ recentTimes: [100] });
    expect(screen.queryByText("Response time trend")).toBeNull();
  });

  it("shows the response time trend with two or more samples", () => {
    renderPopover({ recentTimes: [100, 200] });
    expect(screen.getByText("Response time trend")).toBeInTheDocument();
  });

  it('calls onViewHistory when "View in History" is clicked', async () => {
    const user = userEvent.setup();
    const { onViewHistory } = renderPopover();

    await user.click(screen.getByRole("button", { name: /view in history/i }));

    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });
});
