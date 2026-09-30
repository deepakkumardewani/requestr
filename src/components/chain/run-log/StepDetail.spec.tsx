/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { StepDetail } from "./StepDetail";

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "step-1",
    nodeId: "node-1",
    nodeType: "api",
    label: "Fetch user",
    state: "passed",
    startedAt: Date.now(),
    durationMs: 120,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

describe("StepDetail", () => {
  it("renders four tabs for a passing step, without an Error tab", () => {
    render(<StepDetail step={makeStep()} />);
    expect(screen.getByRole("tab", { name: "Input" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Output" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Assertions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Extracted" })).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Error" }),
    ).not.toBeInTheDocument();
  });

  it("renders five tabs for a failed step, including Error", () => {
    render(
      <StepDetail
        step={makeStep({ state: "failed", error: "Request timed out" })}
      />,
    );
    expect(screen.getByRole("tab", { name: "Error" })).toBeInTheDocument();
  });

  it("defaults to the Input tab as selected", () => {
    render(<StepDetail step={makeStep()} />);
    expect(screen.getByRole("tab", { name: "Input" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("persists the selected tab while the same step remains selected", async () => {
    const user = userEvent.setup();
    render(<StepDetail step={makeStep()} />);
    await user.click(screen.getByRole("tab", { name: "Output" }));
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Input" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("resets to the Input tab when a different step is selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StepDetail step={makeStep({ id: "step-1" })} />);
    await user.click(screen.getByRole("tab", { name: "Output" }));
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    rerender(<StepDetail step={makeStep({ id: "step-2" })} />);
    expect(screen.getByRole("tab", { name: "Input" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
