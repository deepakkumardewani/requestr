/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { useRunSelectionSync } from "./useRunSelectionSync";

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: "step-1",
    nodeId: "node-1",
    nodeType: "api",
    label: "Get user",
    state: "passed",
    startedAt: 0,
    durationMs: 10,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

describe("useRunSelectionSync", () => {
  it("fitViews the step's node when selection came from the timeline", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: "s1",
        syncSource: "timeline",
        selectStep,
        fitView,
      }),
    );

    expect(fitView).toHaveBeenCalledWith("node-a");
  });

  it("pans exactly once when steps grow but the selection is unchanged", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const first = [makeStep({ id: "s1", nodeId: "node-a" })];

    const { rerender } = renderHook(
      ({ steps }) =>
        useRunSelectionSync({
          steps,
          selectedStepId: "s1",
          syncSource: "timeline",
          selectStep,
          fitView,
        }),
      { initialProps: { steps: first } },
    );
    rerender({ steps: [...first, makeStep({ id: "s2", nodeId: "node-b" })] });
    rerender({
      steps: [
        ...first,
        makeStep({ id: "s2", nodeId: "node-b" }),
        makeStep({ id: "s3", nodeId: "node-c" }),
      ],
    });

    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("does not fitView when selection came from the canvas", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: "s1",
        syncSource: "canvas",
        selectStep,
        fitView,
      }),
    );

    expect(fitView).not.toHaveBeenCalled();
  });

  it("does not fitView when there is no selected step or no sync source", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: null,
        syncSource: "timeline",
        selectStep,
        fitView,
      }),
    );

    expect(fitView).not.toHaveBeenCalled();
  });

  it("ignores a selected step id that no longer exists in steps", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: "missing",
        syncSource: "timeline",
        selectStep,
        fitView,
      }),
    );

    expect(fitView).not.toHaveBeenCalled();
  });

  it("onCanvasNodeClick selects the node's latest step tagged with source canvas", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [
      makeStep({ id: "s1", nodeId: "node-a", startedAt: 0 }),
      makeStep({ id: "s2", nodeId: "node-a", startedAt: 10 }),
      makeStep({ id: "s3", nodeId: "node-b", startedAt: 5 }),
    ];

    const { result } = renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: null,
        syncSource: null,
        selectStep,
        fitView,
      }),
    );

    result.current.onCanvasNodeClick("node-a");
    expect(selectStep).toHaveBeenCalledWith("s2", "canvas");
  });

  it("onCanvasNodeClick is a no-op when the node has no steps in this run", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    const { result } = renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: null,
        syncSource: null,
        selectStep,
        fitView,
      }),
    );

    result.current.onCanvasNodeClick("node-missing");
    expect(selectStep).not.toHaveBeenCalled();
  });

  it("a canvas-sourced selection does not re-trigger fitView on re-render", () => {
    const fitView = vi.fn();
    const selectStep = vi.fn();
    const steps = [
      makeStep({ id: "s1", nodeId: "node-a", startedAt: 0 }),
      makeStep({ id: "s2", nodeId: "node-b", startedAt: 10 }),
    ];

    type Props = { selectedStepId: string | null; syncSource: "canvas" | "timeline" | null };
    const { result, rerender } = renderHook(
      (props: Props) =>
        useRunSelectionSync({
          steps,
          selectedStepId: props.selectedStepId,
          syncSource: props.syncSource,
          selectStep,
          fitView,
        }),
      { initialProps: { selectedStepId: "s1", syncSource: "timeline" } as Props },
    );
    expect(fitView).toHaveBeenCalledTimes(1);

    result.current.onCanvasNodeClick("node-b");
    rerender({ selectedStepId: "s2", syncSource: "canvas" });

    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("selects the node as well as panning when selectNode is provided", () => {
    const fitView = vi.fn();
    const selectNode = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: "s1",
        syncSource: "timeline",
        selectStep: vi.fn(),
        fitView,
        selectNode,
        nodeExists: () => true,
      }),
    );

    expect(fitView).toHaveBeenCalledWith("node-a");
    expect(selectNode).toHaveBeenCalledWith("node-a");
  });

  it("does not pan or select but clears the selection when the node was deleted", () => {
    const fitView = vi.fn();
    const selectNode = vi.fn();
    const clearSelection = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: "s1",
        syncSource: "timeline",
        selectStep: vi.fn(),
        fitView,
        selectNode,
        nodeExists: () => false,
        clearSelection,
      }),
    );

    expect(fitView).not.toHaveBeenCalled();
    expect(selectNode).not.toHaveBeenCalled();
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it("does not select the node for a canvas-sourced selection", () => {
    const selectNode = vi.fn();
    const steps = [makeStep({ id: "s1", nodeId: "node-a" })];

    renderHook(() =>
      useRunSelectionSync({
        steps,
        selectedStepId: "s1",
        syncSource: "canvas",
        selectStep: vi.fn(),
        fitView: vi.fn(),
        selectNode,
        nodeExists: () => true,
      }),
    );

    expect(selectNode).not.toHaveBeenCalled();
  });
});
