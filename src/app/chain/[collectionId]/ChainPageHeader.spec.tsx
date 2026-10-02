/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainPageHeader } from "./ChainPageHeader";

vi.mock("@/components/chain/run-log/useOpenRun", () => ({
  useOpenRun: () => vi.fn(),
}));

afterEach(cleanup);

const baseProps = {
  chainId: "chain-1",
  chainTitle: "My Chain",
  nodeCount: 2,
  edgeCount: 1,
  runBlockReason: null,
  hasRunResult: true,
  isRunning: false,
  isDockOpen: false,
  onToggleDock: vi.fn(),
  onClearNodes: vi.fn(),
  onClearRunResults: vi.fn(),
  onClearEdges: vi.fn(),
  onStop: vi.fn(),
  onRun: vi.fn(),
};

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId("chain-more-actions-btn"));
  return user;
}

describe("ChainPageHeader", () => {
  it.each([
    [0, "No nodes"],
    [1, "1 node"],
    [3, "3 nodes"],
  ])("renders the node count for %i nodes", (nodeCount, text) => {
    render(<ChainPageHeader {...baseProps} nodeCount={nodeCount} />);
    expect(screen.getByTestId("chain-request-count")).toHaveTextContent(text);
  });

  it("mounts the last-run status", () => {
    render(<ChainPageHeader {...baseProps} />);
    expect(screen.getByTestId("chain-history-label")).toHaveTextContent(
      "Not yet run",
    );
  });

  it("omits the last-run status for an empty chain", () => {
    render(<ChainPageHeader {...baseProps} nodeCount={0} />);
    expect(screen.queryByTestId("chain-history-label")).not.toBeInTheDocument();
  });

  it("enables all clear items when idle with nodes, edges and results", async () => {
    render(<ChainPageHeader {...baseProps} />);
    await openMenu();
    for (const id of ["clear-nodes-btn", "clear-run-results-btn", "clear-edges-btn"]) {
      expect(await screen.findByTestId(id)).not.toHaveAttribute("data-disabled");
    }
  });

  it("disables each clear item for its empty state", async () => {
    render(
      <ChainPageHeader
        {...baseProps}
        nodeCount={0}
        edgeCount={0}
        hasRunResult={false}
      />,
    );
    await openMenu();
    for (const id of ["clear-nodes-btn", "clear-run-results-btn", "clear-edges-btn"]) {
      expect(await screen.findByTestId(id)).toHaveAttribute("data-disabled");
    }
  });

  it("disables every clear item while running", async () => {
    render(<ChainPageHeader {...baseProps} isRunning />);
    await openMenu();
    for (const id of ["clear-nodes-btn", "clear-run-results-btn", "clear-edges-btn"]) {
      expect(await screen.findByTestId(id)).toHaveAttribute("data-disabled");
    }
  });

  it("fires onClearNodes once, only after confirming the dialog", async () => {
    const onClearNodes = vi.fn();
    render(<ChainPageHeader {...baseProps} onClearNodes={onClearNodes} />);
    const user = await openMenu();
    await user.click(await screen.findByTestId("clear-nodes-btn"));
    expect(onClearNodes).not.toHaveBeenCalled();
    const dialog = await screen.findByTestId("clear-nodes-dialog");
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, clear nodes" }));
    expect(onClearNodes).toHaveBeenCalledTimes(1);
  });

  it("does not call onClearNodes when the dialog is cancelled", async () => {
    const onClearNodes = vi.fn();
    render(<ChainPageHeader {...baseProps} onClearNodes={onClearNodes} />);
    const user = await openMenu();
    await user.click(await screen.findByTestId("clear-nodes-btn"));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(onClearNodes).not.toHaveBeenCalled();
  });

  it("calls onClearRunResults and onClearEdges from their items", async () => {
    const onClearRunResults = vi.fn();
    const onClearEdges = vi.fn();
    render(
      <ChainPageHeader
        {...baseProps}
        onClearRunResults={onClearRunResults}
        onClearEdges={onClearEdges}
      />,
    );
    const user = await openMenu();
    await user.click(await screen.findByTestId("clear-run-results-btn"));
    expect(onClearRunResults).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId("chain-more-actions-btn"));
    await user.click(await screen.findByTestId("clear-edges-btn"));
    expect(onClearEdges).toHaveBeenCalledTimes(1);
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

  it("enables Run when nothing blocks it", () => {
    render(<ChainPageHeader {...baseProps} />);
    expect(screen.getByTestId("run-chain-btn")).toBeEnabled();
  });

  it.each([
    "empty",
    "cycle",
    "invalidMerge",
    "unpairedLoop",
    "unresolvedCollect",
    "loopNesting",
    "invalidSubChain",
  ] as const)(
    "disables Run and Run-with-inputs when blocked by %s",
    (runBlockReason) => {
      render(
        <ChainPageHeader
          {...baseProps}
          runBlockReason={runBlockReason}
          startInputs={[]}
          onRunWithInputs={vi.fn()}
        />,
      );
      expect(screen.getByTestId("run-chain-btn")).toBeDisabled();
      expect(screen.getByTestId("run-with-inputs-btn")).toBeDisabled();
    },
  );
});
