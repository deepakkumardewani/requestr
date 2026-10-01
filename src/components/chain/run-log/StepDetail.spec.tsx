/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("shows expected and actual for a failed assertion from the step's snapshot", () => {
    render(
      <StepDetail
        step={makeStep({
          state: "failed",
          error: "One or more assertions failed",
          errorKind: "assertion",
          assertions: [
            {
              id: "as-1",
              source: "status",
              operator: "eq",
              expectedValue: "200",
              enabled: true,
            },
          ],
          assertionResults: [
            { assertionId: "as-1", passed: false, actual: "500" },
          ],
        })}
      />,
    );
    return userEvent
      .setup()
      .click(screen.getByRole("tab", { name: "Assertions" }))
      .then(() => {
        expect(screen.getByText(/Status Code/)).toBeInTheDocument();
        expect(screen.getByText("200")).toBeInTheDocument();
        expect(screen.getByText("500")).toBeInTheDocument();
      });
  });

  it("offers promote-to-env in the Extracted tab when handlers are passed", async () => {
    const step = makeStep({
      extractedValues: { "edge-1:$.data.token": "abc123" },
    });
    const { rerender } = render(<StepDetail step={step} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Extracted" }));
    expect(
      screen.queryByTitle("Promote to environment variable"),
    ).not.toBeInTheDocument();

    rerender(
      <StepDetail
        step={step}
        onSavePromotion={vi.fn()}
        onRemovePromotion={vi.fn()}
        promotableEdgeIds={new Set(["edge-1"])}
      />,
    );
    expect(
      screen.getByTitle("Promote to environment variable"),
    ).toBeInTheDocument();
  });

  it("hides promote-to-env for edges outside the open chain (nested steps)", async () => {
    render(
      <StepDetail
        step={makeStep({
          extractedValues: { "other-chain-edge:$.id": "1" },
        })}
        onSavePromotion={vi.fn()}
        onRemovePromotion={vi.fn()}
        promotableEdgeIds={new Set(["edge-1"])}
      />,
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "Extracted" }));
    expect(
      screen.queryByTitle("Promote to environment variable"),
    ).not.toBeInTheDocument();
  });

  it("names the error kind in the Error tab", async () => {
    render(
      <StepDetail
        step={makeStep({
          state: "failed",
          error: "Could not extract",
          errorKind: "extraction",
        })}
      />,
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "Error" }));
    expect(screen.getByText(/Extraction error/)).toBeInTheDocument();
  });

  it("shows the resolved request URL in the Input tab", () => {
    render(
      <StepDetail
        step={makeStep({
          request: {
            method: "GET",
            url: "https://api.test/users/42",
            headers: {},
          },
        })}
      />,
    );
    expect(screen.getByText("https://api.test/users/42")).toBeInTheDocument();
  });

  it("shows the recorded Condition variable and value in the Input tab", () => {
    render(
      <StepDetail
        step={makeStep({
          nodeType: "condition",
          inputs: { condition: { variable: "{{role}}", value: "admin" } },
        })}
      />,
    );
    expect(screen.getByText("{{role}}")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows the configured Delay, not the measured duration, in the Input tab", () => {
    render(
      <StepDetail
        step={makeStep({
          nodeType: "delay",
          durationMs: 2010,
          inputs: { delayMs: 2000 },
        })}
      />,
    );
    expect(screen.getByText("2.00 s")).toBeInTheDocument();
  });

  it("shows the Loop source and item count in the Input tab", () => {
    render(
      <StepDetail
        step={makeStep({
          nodeType: "loop",
          inputs: {
            loop: { sourceJsonPath: "$.items", itemAlias: "item", itemCount: 3 },
          },
        })}
      />,
    );
    expect(screen.getByText("$.items")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders alias-collision warnings above the tabs", () => {
    render(
      <StepDetail
        step={makeStep({
          warnings: [
            {
              kind: "alias-collision",
              alias: "id",
              previousOwner: { kind: "edge", id: "e1" },
              owner: { kind: "display", id: "d1" },
            },
          ],
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Alias id overwrote the value written by an edge",
    );
  });

  it("renders loop-truncated and loop-iterations-failed warnings", () => {
    render(
      <StepDetail
        step={makeStep({
          warnings: [
            { kind: "loop-truncated", executed: 2, total: 5 },
            { kind: "loop-iterations-failed", failed: 1, total: 2 },
          ],
        })}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Ran only the first 2 of 5 items");
    expect(alert).toHaveTextContent("1 of 2 iterations failed");
  });

  it("renders no alert when the step has no warnings", () => {
    render(<StepDetail step={makeStep()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
