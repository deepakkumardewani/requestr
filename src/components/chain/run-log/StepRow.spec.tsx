/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { getStepRowId, StepRow } from "./StepRow";

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "s1",
    nodeId: "n1",
    nodeType: "delay",
    label: "Wait a bit",
    state: "passed",
    startedAt: 0,
    durationMs: 250,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

function renderRow(
  props: Partial<React.ComponentProps<typeof StepRow>> = {},
) {
  const onSelect = vi.fn();
  render(
    <StepRow
      step={makeStep()}
      index={0}
      isSelected={false}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect, row: screen.getByRole("option") };
}

describe("StepRow", () => {
  it("renders the 1-based index, label and formatted duration", () => {
    renderRow({ index: 2 });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Wait a bit")).toBeInTheDocument();
    expect(screen.getByText("250 ms")).toBeInTheDocument();
  });

  it("exposes a stable id and data-step-id for aria-activedescendant", () => {
    const { row } = renderRow();
    expect(row).toHaveAttribute("id", getStepRowId("s1"));
    expect(row).toHaveAttribute("data-step-id", "s1");
  });

  it("reflects selection via aria-selected", () => {
    const { row } = renderRow({ isSelected: true });
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("calls onSelect with the step id on click", () => {
    const { onSelect, row } = renderRow();
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("shows the method badge only for api steps that have a request", () => {
    cleanup();
    renderRow({
      step: makeStep({
        nodeType: "api",
        request: { method: "POST" } as RunStep["request"],
      }),
    });
    expect(screen.getByText("POST")).toBeInTheDocument();

    cleanup();
    renderRow({ step: makeStep({ nodeType: "api" }) });
    expect(screen.queryByText("POST")).not.toBeInTheDocument();
  });

  it("renders the lane dot only when showLane is set, numbered 1-based", () => {
    renderRow({ lane: 1, showLane: true });
    expect(screen.getByTestId("step-lane-1")).toHaveAttribute(
      "aria-label",
      "Lane 2",
    );

    cleanup();
    renderRow({ lane: 1 });
    expect(screen.queryByTestId("step-lane-1")).not.toBeInTheDocument();
  });

  it("cycles lane colours when lanes exceed the palette", () => {
    renderRow({ lane: 4, showLane: true });
    expect(screen.getByTestId("step-lane-4")).toHaveClass("bg-sky-500");
  });

  it("indents nested rows", () => {
    const { row } = renderRow({ nested: true });
    expect(row).toHaveClass("pl-8");
  });

  it("falls back to a generic icon for an unknown node type", () => {
    renderRow({
      step: makeStep({ nodeType: "mystery" as RunStep["nodeType"] }),
    });
    expect(screen.getByText("Wait a bit")).toBeInTheDocument();
  });
});
