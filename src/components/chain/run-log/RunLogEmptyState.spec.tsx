/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/en/chain.json";
import { RunLogEmptyState } from "./RunLogEmptyState";

afterEach(cleanup);

function renderState(props: React.ComponentProps<typeof RunLogEmptyState>) {
  return render(<RunLogEmptyState {...props} />);
}

describe("RunLogEmptyState", () => {
  it("renders skeleton rows while loading", () => {
    const { container } = renderState({ kind: "loading" });
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("shows the error with a working Retry", async () => {
    const onRetry = vi.fn();
    renderState({ kind: "error", errorMessage: "boom", onRetry });
    expect(screen.getByRole("alert").textContent).toContain("boom");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("noRuns: Run flow is enabled and fires when runnable", async () => {
    const onRunFlow = vi.fn();
    renderState({ kind: "noRuns", runBlockReason: null, onRunFlow });
    expect(screen.getByText("No runs yet")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Run flow" }));
    expect(onRunFlow).toHaveBeenCalledTimes(1);
  });

  it("noRuns: Run flow is disabled with the blocker reason as tooltip", () => {
    const onRunFlow = vi.fn();
    const { container } = renderState({
      kind: "noRuns",
      runBlockReason: "cycle",
      onRunFlow,
    });
    const button = screen.getByRole("button", { name: "Run flow" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      container.querySelector(`[title="${messages.resolveCycleToRun}"]`),
    ).toBeTruthy();
  });

  it("noSteps shows the no-steps message", () => {
    renderState({ kind: "noSteps" });
    expect(screen.getByText("This run recorded no steps.")).toBeTruthy();
  });

  it("filtered shows the message and Clear filter fires", async () => {
    const onClearFilter = vi.fn();
    renderState({ kind: "filtered", onClearFilter });
    expect(screen.getByText("No steps match this filter.")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Clear filter" }),
    );
    expect(onClearFilter).toHaveBeenCalledTimes(1);
  });

  it("noStepSelected shows the right-pane placeholder", () => {
    renderState({ kind: "noStepSelected" });
    expect(screen.getByRole("status").textContent).toBe(
      messages.runLogSelectStepPrompt,
    );
  });
});
