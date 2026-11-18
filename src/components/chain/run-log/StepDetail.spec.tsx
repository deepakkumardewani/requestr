/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { StepDetail } from "./StepDetail";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

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

  it("defaults to the Output tab as selected for a passed step", () => {
    render(<StepDetail step={makeStep()} />);
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("persists the selected tab while the same step remains selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StepDetail step={makeStep()} />);
    await user.click(screen.getByRole("tab", { name: "Input" }));
    rerender(<StepDetail step={makeStep({ durationMs: 500 })} />);
    expect(screen.getByRole("tab", { name: "Input" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("resets to the default tab when a different step is selected", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<StepDetail step={makeStep({ id: "step-1" })} />);
    await user.click(screen.getByRole("tab", { name: "Input" }));
    expect(screen.getByRole("tab", { name: "Input" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    rerender(<StepDetail step={makeStep({ id: "step-2" })} />);
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute(
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

  it("shows the resolved request URL in the Input tab", async () => {
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
    await userEvent.click(screen.getByRole("tab", { name: "Input" }));
    expect(screen.getByText("https://api.test/users/42")).toBeInTheDocument();
  });

  it("shows the recorded Condition variable and value in the Input tab", async () => {
    render(
      <StepDetail
        step={makeStep({
          nodeType: "condition",
          inputs: { condition: { variable: "{{role}}", value: "admin" } },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Input" }));
    expect(screen.getByText("{{role}}")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows the configured Delay, not the measured duration, in the Input tab", async () => {
    render(
      <StepDetail
        step={makeStep({
          nodeType: "delay",
          durationMs: 2010,
          inputs: { delayMs: 2000 },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Input" }));
    expect(screen.getByText("2.00 s")).toBeInTheDocument();
  });

  it("shows the Loop source and item count in the Input tab", async () => {
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
    await userEvent.click(screen.getByRole("tab", { name: "Input" }));
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

  describe("copy, auto-select and placeholder", () => {
    const response = {
      status: 200,
      statusText: "OK",
      headers: {},
      body: '{"raw":true}',
      duration: 10,
      size: 12,
      url: "https://example.com",
      method: "GET" as const,
      timestamp: 0,
    };

    it("shows the noStepSelected empty state when no step is selected", () => {
      render(<StepDetail />);
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(
        screen.getByText("Select a step to see its request and response"),
      ).toBeInTheDocument();
    });

    it("auto-selects the Error tab for a failed step and Output for a passed one", () => {
      const { unmount } = render(
        <StepDetail step={makeStep({ state: "failed", error: "boom" })} />,
      );
      expect(screen.getByRole("tab", { name: "Error" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      unmount();
      render(<StepDetail step={makeStep()} />);
      expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("defaults to Input for a step with no result yet", () => {
      render(<StepDetail step={makeStep({ state: "running" })} />);
      expect(screen.getByRole("tab", { name: "Input" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("copies the raw response body from the Output tab and announces it", async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, "writeText");
      render(<StepDetail step={makeStep({ response })} />);
      await user.click(screen.getByRole("tab", { name: "Input" }));
      expect(
        screen.queryByRole("button", { name: "Copy response" }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Output" }));
      await user.click(screen.getByRole("button", { name: "Copy response" }));
      expect(writeText).toHaveBeenCalledWith('{"raw":true}');
      expect(await screen.findByRole("status")).toHaveTextContent("Copied");
      expect(toastSuccess).toHaveBeenCalledWith("Copied");
    });

    it("copies the error from the Error tab", async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, "writeText");
      render(
        <StepDetail step={makeStep({ state: "failed", error: "boom" })} />,
      );
      await user.click(screen.getByRole("button", { name: "Copy error" }));
      expect(writeText).toHaveBeenCalledWith("boom");
      expect(await screen.findByRole("status")).toHaveTextContent("Copied");
    });
  });
});
