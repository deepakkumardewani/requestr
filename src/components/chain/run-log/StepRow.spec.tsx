/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { getHttpStatusClass, getStepRowId, StepRow } from "./StepRow";

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

function renderRow(props: Partial<React.ComponentProps<typeof StepRow>> = {}) {
  const onSelect = vi.fn();
  render(
    <StepRow
      step={makeStep()}
      index={0}
      isSelected={false}
      onSelect={onSelect}
      {...props}
    />
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
      "Lane 2"
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

  it("shows the type icon with a type label for non-API steps and none for API rows", () => {
    renderRow();
    expect(screen.getByTestId("step-type-icon")).toBeInTheDocument();
    expect(screen.getByLabelText("Delay")).toBeInTheDocument();

    cleanup();
    renderRow({
      step: makeStep({
        nodeType: "api",
        request: { method: "GET" } as RunStep["request"],
      }),
    });
    expect(screen.queryByTestId("step-type-icon")).not.toBeInTheDocument();
  });

  it("colors the HTTP status by class and omits it without a response", () => {
    expect(getHttpStatusClass(200)).toBe("text-emerald-500");
    expect(getHttpStatusClass(404)).toBe("text-amber-500");
    expect(getHttpStatusClass(503)).toBe("text-destructive");
    expect(getHttpStatusClass(302)).toBe("text-muted-foreground");

    renderRow({
      step: makeStep({ response: { status: 404 } as RunStep["response"] }),
    });
    expect(screen.getByTestId("step-http-status")).toHaveTextContent("404");
    expect(screen.getByTestId("step-http-status")).toHaveClass(
      "text-amber-500"
    );

    cleanup();
    renderRow();
    expect(screen.queryByTestId("step-http-status")).not.toBeInTheDocument();
  });

  it("renders a clamped error line for failed steps and opens the Error tab on click", () => {
    const onOpenError = vi.fn();
    const { onSelect, row } = renderRow({
      step: makeStep({ state: "failed", error: "Boom happened" }),
      onOpenError,
    });
    const line = screen.getByTestId("step-error-line");
    expect(line).toHaveTextContent("Boom happened");
    expect(line).toHaveClass("line-clamp-1");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith("s1");
    expect(onOpenError).toHaveBeenCalledWith("s1");
  });

  it("falls back to the assertion count when a failed step has no error text", () => {
    renderRow({
      step: makeStep({
        state: "failed",
        assertionResults: [
          { assertionId: "a", passed: false, actual: null },
          { assertionId: "b", passed: false, actual: null },
          { assertionId: "c", passed: true, actual: null },
        ],
      }),
    });
    expect(screen.getByTestId("step-error-line")).toHaveTextContent(
      "2 assertions failed"
    );
  });

  it("shows no error line for passed steps, or failed steps with nothing to report", () => {
    const onOpenError = vi.fn();
    const { row } = renderRow({
      step: makeStep({ state: "failed" }),
      onOpenError,
    });
    expect(screen.queryByTestId("step-error-line")).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(onOpenError).not.toHaveBeenCalled();

    cleanup();
    renderRow({ step: makeStep({ state: "passed", error: "stale" }) });
    expect(screen.queryByTestId("step-error-line")).not.toBeInTheDocument();
  });

  it("shows the Node removed chip only when the node is gone", () => {
    renderRow({ nodeRemoved: true });
    expect(screen.getByText("Node removed")).toBeInTheDocument();

    cleanup();
    renderRow();
    expect(screen.queryByText("Node removed")).not.toBeInTheDocument();
  });

  it("does not re-render when re-rendered with identical props", () => {
    const step = makeStep();
    const onSelect = vi.fn();
    const props = { step, index: 0, isSelected: false, onSelect };
    const { rerender } = render(<StepRow {...props} />);
    const before = screen.getByRole("option");
    rerender(<StepRow {...props} />);
    expect(screen.getByRole("option")).toBe(before);
  });
});
