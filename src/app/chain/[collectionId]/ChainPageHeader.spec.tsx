/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainPageHeader } from "./ChainPageHeader";

afterEach(cleanup);

const baseProps = {
  chainTitle: "My Chain",
  requestCount: 2,
  hasRunResult: false,
  isRunning: false,
  passedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  isDockOpen: false,
  onToggleDock: vi.fn(),
  onClearEdges: vi.fn(),
  onStop: vi.fn(),
  onRun: vi.fn(),
};

describe("ChainPageHeader", () => {
  it("shows 'Not yet run' when there is no run history", () => {
    render(<ChainPageHeader {...baseProps} />);
    expect(screen.getByTestId("chain-history-label")).toHaveTextContent(
      "Not yet run",
    );
  });

  it("shows a relative-time label when a last run exists", () => {
    const lastRunAt = Date.now() - 2 * 60 * 1000;
    render(<ChainPageHeader {...baseProps} lastRunAt={lastRunAt} />);
    expect(screen.getByTestId("chain-history-label")).toHaveTextContent(
      "Last run",
    );
  });

  it("calls onToggleDock when the dock toggle button is clicked", () => {
    const onToggleDock = vi.fn();
    render(<ChainPageHeader {...baseProps} onToggleDock={onToggleDock} />);
    fireEvent.click(screen.getByTestId("toggle-run-log-btn"));
    expect(onToggleDock).toHaveBeenCalledTimes(1);
  });

  it("reflects the open/closed dock state in the toggle button's aria-label", () => {
    const { rerender } = render(
      <ChainPageHeader {...baseProps} isDockOpen={false} />,
    );
    expect(screen.getByTestId("toggle-run-log-btn")).toHaveAttribute(
      "aria-label",
      "Show run log",
    );

    rerender(<ChainPageHeader {...baseProps} isDockOpen={true} />);
    expect(screen.getByTestId("toggle-run-log-btn")).toHaveAttribute(
      "aria-label",
      "Hide run log",
    );
  });

  it("hides the 'Run with inputs' button when there is no Start block", () => {
    render(<ChainPageHeader {...baseProps} />);
    expect(
      screen.queryByTestId("run-with-inputs-btn"),
    ).not.toBeInTheDocument();
  });

  it("shows the 'Run with inputs' button when a Start block exists", () => {
    render(
      <ChainPageHeader
        {...baseProps}
        startInputs={[{ key: "token", defaultValue: "abc", source: "literal" }]}
        onRunWithInputs={vi.fn()}
      />,
    );
    expect(screen.getByTestId("run-with-inputs-btn")).toBeInTheDocument();
  });

  it("calls onRunWithInputs with the popover's overrides", async () => {
    const onRunWithInputs = vi.fn();
    render(
      <ChainPageHeader
        {...baseProps}
        startInputs={[{ key: "token", defaultValue: "abc", source: "literal" }]}
        onRunWithInputs={onRunWithInputs}
      />,
    );

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));
    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    expect(onRunWithInputs).toHaveBeenCalledWith({ token: "abc" });
  });
});
