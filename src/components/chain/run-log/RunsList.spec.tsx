/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@/lib/chainRunHistory";
import { RunsList } from "./RunsList";

afterEach(cleanup);

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: "run-1",
    chainId: "chain-1",
    startedAt: Date.now() - 5000,
    finishedAt: Date.now(),
    status: "passed",
    trigger: "full",
    counts: { passed: 5, failed: 1, skipped: 2, aborted: 0 },
    bytes: 100,
    schemaVersion: 1,
    steps: [],
    ...overrides,
  };
}

describe("RunsList", () => {
  it("renders a loading skeleton while runsLoading is true, never the empty state", () => {
    render(
      <RunsList
        runs={[]}
        activeRun={null}
        selectedRunId={null}
        runsLoading
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId("run-log-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByText("No runs yet. Press ⌘↩ to run the chain."),
    ).not.toBeInTheDocument();
  });

  it("renders a retry row when runsError is set, never the empty state", async () => {
    const user = userEvent.setup();
    const onRetryLoad = vi.fn();
    render(
      <RunsList
        runs={[]}
        activeRun={null}
        selectedRunId={null}
        runsError="Database unavailable"
        onRetryLoad={onRetryLoad}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Couldn't load run history: Database unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No runs yet. Press ⌘↩ to run the chain."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("Retry"));
    expect(onRetryLoad).toHaveBeenCalled();
  });

  it("renders the empty state when there are no runs and no active run", () => {
    render(
      <RunsList
        runs={[]}
        activeRun={null}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No runs yet. Press ⌘↩ to run the chain."),
    ).toBeInTheDocument();
  });

  it("renders runs newest first with counts and trigger badge", () => {
    const older = makeRun({ id: "run-old", startedAt: Date.now() - 600_000 });
    const newer = makeRun({ id: "run-new", startedAt: Date.now() - 10_000 });
    render(
      <RunsList
        runs={[older, newer]}
        activeRun={null}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    const timeLabels = screen.getAllByText(/ago$/);
    // The newest run's relative time (seconds) renders before the older one's (minutes).
    expect(timeLabels[0]).toHaveTextContent(/seconds ago/);
    expect(timeLabels[1]).toHaveTextContent(/minutes ago/);
  });

  it("pins the live run at the top regardless of history order", () => {
    const finished = makeRun({ id: "run-finished", startedAt: Date.now() - 1000 });
    const live = makeRun({
      id: "run-live",
      status: "running",
      startedAt: Date.now(),
      finishedAt: undefined,
    });
    render(
      <RunsList
        runs={[finished]}
        activeRun={live}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText("Running…")).toBeInTheDocument();
  });

  it("offers no row menu (Re-run / Delete) on the live run", () => {
    const live = makeRun({
      id: "run-live",
      status: "running",
      finishedAt: undefined,
    });
    render(
      <RunsList
        runs={[]}
        activeRun={live}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Run options" })).toBeNull();
    expect(screen.queryByText("Re-run same subset")).toBeNull();
    expect(screen.queryByText("Delete run")).toBeNull();
  });

  it("calls onSelectRun when a row is clicked", () => {
    const onSelectRun = vi.fn();
    const run = makeRun();
    render(
      <RunsList
        runs={[run]}
        activeRun={null}
        selectedRunId={null}
        onSelectRun={onSelectRun}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("5 ✓ 1 ✗ 2 skipped"));
    expect(onSelectRun).toHaveBeenCalledWith("run-1");
  });

  it("never nests the row menu button inside another button", () => {
    render(
      <RunsList
        runs={[makeRun()]}
        activeRun={null}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    const menu = screen.getByLabelText("Run options");
    expect(menu.parentElement?.closest("button")).toBeNull();
  });

  it("row menu triggers re-run and delete callbacks", async () => {
    const user = userEvent.setup();
    const onRerun = vi.fn();
    const onDeleteRun = vi.fn();
    const run = makeRun();
    render(
      <RunsList
        runs={[run]}
        activeRun={null}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={onRerun}
        onDeleteRun={onDeleteRun}
        onClearAll={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Run options"));
    await user.click(screen.getByText("Re-run same subset"));
    expect(onRerun).toHaveBeenCalledWith(run);

    await user.click(screen.getByLabelText("Run options"));
    await user.click(screen.getByText("Delete run"));
    expect(onDeleteRun).toHaveBeenCalledWith("run-1");
  });

  it("clear all asks for confirmation before calling onClearAll", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(
      <RunsList
        runs={[makeRun()]}
        activeRun={null}
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRerun={vi.fn()}
        onDeleteRun={vi.fn()}
        onClearAll={onClearAll}
      />,
    );
    await user.click(screen.getByText("Clear all runs"));
    expect(screen.getByText("Clear all runs?")).toBeInTheDocument();
    expect(onClearAll).not.toHaveBeenCalled();

    const dialogButtons = screen.getAllByText("Clear all runs");
    await user.click(dialogButtons[dialogButtons.length - 1]);
    expect(onClearAll).toHaveBeenCalled();
  });
});
