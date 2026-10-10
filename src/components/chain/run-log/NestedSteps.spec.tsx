/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { NestedSteps } from "./NestedSteps";

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "s1",
    nodeId: "n1",
    nodeType: "delay",
    label: "Step",
    state: "passed",
    startedAt: 0,
    durationMs: 10,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

function renderNested(
  steps: RunStep[],
  props: Partial<React.ComponentProps<typeof NestedSteps>> = {},
) {
  const onSelect = vi.fn();
  render(
    <NestedSteps
      parent={makeStep({ id: "loop", nodeType: "loop", label: "Loop" })}
      steps={steps}
      selectedStepId={null}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect };
}

describe("NestedSteps", () => {
  it("renders nothing when the parent has no child steps", () => {
    renderNested([makeStep({ id: "other", parentStepId: "someone-else" })]);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("groups loop children per iteration, ordered by iteration number with 1-based labels and counts", () => {
    renderNested([
      makeStep({ id: "b", parentStepId: "loop", iteration: 1, startedAt: 2 }),
      makeStep({ id: "a1", parentStepId: "loop", iteration: 0, startedAt: 1 }),
      makeStep({ id: "a2", parentStepId: "loop", iteration: 0, startedAt: 3 }),
    ]);

    const toggles = screen.getAllByRole("button");
    expect(toggles.map((el) => el.getAttribute("data-testid"))).toEqual([
      "iteration-toggle-loop-0",
      "iteration-toggle-loop-1",
    ]);
    expect(toggles[0]).toHaveTextContent("Iteration 1");
    expect(toggles[0]).toHaveTextContent("2");
    expect(toggles[1]).toHaveTextContent("Iteration 2");
    expect(toggles[1]).toHaveTextContent("1");
  });

  it("keeps groups collapsed by default and reveals child rows when a group is toggled", () => {
    renderNested([
      makeStep({ id: "a1", label: "First", parentStepId: "loop", iteration: 0 }),
    ]);
    const toggle = screen.getByTestId("iteration-toggle-loop-0");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("First")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("First")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });

  it("expands one iteration without expanding its siblings", () => {
    renderNested([
      makeStep({ id: "a", label: "In zero", parentStepId: "loop", iteration: 0 }),
      makeStep({ id: "b", label: "In one", parentStepId: "loop", iteration: 1 }),
    ]);

    fireEvent.click(screen.getByTestId("iteration-toggle-loop-1"));

    expect(screen.getByText("In one")).toBeInTheDocument();
    expect(screen.queryByText("In zero")).not.toBeInTheDocument();
  });

  it("renders sub-chain children (no iteration) as one flat group sorted by start time", () => {
    renderNested(
      [
        makeStep({ id: "late", label: "Late", parentStepId: "sub", startedAt: 9 }),
        makeStep({ id: "early", label: "Early", parentStepId: "sub", startedAt: 1 }),
      ],
      { parent: makeStep({ id: "sub", nodeType: "subchain", label: "Sub" }) },
    );

    const toggle = screen.getByTestId("subchain-toggle-sub");
    expect(toggle).toHaveTextContent("Sub-chain steps");
    expect(toggle).toHaveTextContent("2");
    fireEvent.click(toggle);

    const rows = screen.getAllByRole("option");
    expect(rows.map((r) => r.getAttribute("data-step-id"))).toEqual([
      "early",
      "late",
    ]);
  });

  it("calls onSelect with the step id when a nested row is clicked and marks the selected row", () => {
    const { onSelect } = renderNested(
      [makeStep({ id: "kid", label: "Kid", parentStepId: "loop", iteration: 0 })],
      { selectedStepId: "kid" },
    );
    fireEvent.click(screen.getByTestId("iteration-toggle-loop-0"));

    const row = screen.getByRole("option");
    expect(row).toHaveAttribute("aria-selected", "true");
    fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledWith("kid");
  });

  it("recurses so a sub-chain inside a loop iteration nests its own group", () => {
    renderNested([
      makeStep({
        id: "inner",
        nodeType: "subchain",
        label: "Inner",
        parentStepId: "loop",
        iteration: 0,
      }),
      makeStep({ id: "leaf", label: "Leaf", parentStepId: "inner", startedAt: 5 }),
    ]);

    fireEvent.click(screen.getByTestId("iteration-toggle-loop-0"));
    expect(screen.getByText("Inner")).toBeInTheDocument();
    expect(screen.queryByText("Leaf")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("subchain-toggle-inner"));

    expect(screen.getByText("Leaf")).toBeInTheDocument();
  });

  it("indents nested groups by 12px per depth level", () => {
    renderNested(
      [makeStep({ id: "a", parentStepId: "loop", iteration: 0 })],
      { depth: 2 },
    );

    const group = screen.getByTestId("iteration-toggle-loop-0").parentElement;
    expect(group).toHaveStyle({ paddingLeft: "24px" });
  });
});
