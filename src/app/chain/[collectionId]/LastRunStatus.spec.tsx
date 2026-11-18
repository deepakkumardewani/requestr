/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunCounts, RunSummary } from "@/lib/chainRunHistory";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { LastRunStatus } from "./LastRunStatus";

const openRun = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({
    relativeTime: () => "REL",
    dateTime: () => "ABSOLUTE",
  }),
}));

vi.mock("@/components/chain/run-log/useOpenRun", () => ({
  useOpenRun: () => openRun,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement<Record<string, unknown>>;
    children: React.ReactNode;
  }) => <render.type {...render.props}>{children}</render.type>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
}));

const CHAIN_ID = "chain-1";

function seedRun(counts: Partial<RunCounts>, extra: Partial<RunSummary> = {}) {
  const run: RunSummary = {
    id: "run-1",
    chainId: CHAIN_ID,
    startedAt: 1_000,
    finishedAt: 2_000,
    status: "passed",
    trigger: "full",
    counts: { passed: 0, failed: 0, skipped: 0, aborted: 0, ...counts },
    bytes: 0,
    schemaVersion: 1,
    steps: [],
    ...extra,
  } as RunSummary;
  useChainRunStore.setState({ runs: { [CHAIN_ID]: [run] } });
}

function renderStatus(nodeCount = 2, isRunning = false) {
  return render(
    <LastRunStatus
      chainId={CHAIN_ID}
      nodeCount={nodeCount}
      isRunning={isRunning}
    />,
  );
}

describe("LastRunStatus", () => {
  beforeEach(() => {
    openRun.mockClear();
    useChainRunStore.setState({ runs: {} });
  });
  afterEach(cleanup);

  it("renders nothing at 0 nodes", () => {
    seedRun({ passed: 1 });
    const { container } = renderStatus(0);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Not yet run' when there are no runs", () => {
    renderStatus();
    expect(screen.getByTestId("chain-history-label")).toHaveTextContent(
      "headerNotYetRun",
    );
  });

  it("hides zero buckets and keeps testids for non-zero ones", () => {
    seedRun({ passed: 3, failed: 1 });
    renderStatus();
    expect(screen.getByTestId("chain-passed-count")).toBeInTheDocument();
    expect(screen.getByTestId("chain-failed-count")).toBeInTheDocument();
    expect(screen.queryByTestId("chain-skipped-count")).toBeNull();
    expect(screen.getByTestId("chain-history-label")).toHaveTextContent(
      "headerLastRun",
    );
  });

  it("shows 'No steps recorded' for an all-zero run", () => {
    seedRun({});
    renderStatus();
    expect(screen.getByText("headerLastRunNoSteps")).toBeInTheDocument();
    expect(screen.queryByTestId("chain-passed-count")).toBeNull();
  });

  it("opens the latest run on click", () => {
    seedRun({ passed: 1 });
    renderStatus();
    fireEvent.click(screen.getByRole("button", { name: "headerOpenLastRun" }));
    expect(openRun).toHaveBeenCalledExactlyOnceWith("run-1");
  });

  it("hides counts and shows the running indicator during a live run", () => {
    seedRun({ passed: 2 });
    renderStatus(2, true);
    expect(screen.queryByTestId("chain-passed-count")).toBeNull();
    expect(screen.getByTestId("chain-running-indicator")).toBeInTheDocument();
  });

  it("shows only the running indicator for a live first run", () => {
    renderStatus(2, true);
    expect(screen.getByTestId("chain-running-indicator")).toBeInTheDocument();
    expect(screen.queryByText("headerNotYetRun")).toBeNull();
  });

  it("still shows counts when the run's anchor node was deleted", () => {
    seedRun({ failed: 1 }, { anchorNodeId: "deleted-node", trigger: "single" });
    renderStatus(1);
    expect(screen.getByTestId("chain-failed-count")).toBeInTheDocument();
  });

  it("exposes the absolute time in the tooltip", () => {
    seedRun({ passed: 1 });
    renderStatus();
    expect(screen.getByTestId("tooltip")).toHaveTextContent("ABSOLUTE");
  });

  it("shows a stopped bucket for an aborted-only run", () => {
    seedRun({ aborted: 2 }, { status: "stopped" });
    renderStatus();
    expect(screen.getByTestId("chain-stopped-count")).toBeInTheDocument();
  });
});
