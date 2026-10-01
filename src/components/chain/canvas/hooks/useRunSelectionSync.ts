import { useCallback, useEffect, useRef } from "react";
import type { RunStep } from "@/lib/chainRunHistory";

export type SyncSource = "canvas" | "timeline" | null;

export type UseRunSelectionSyncOptions = {
  /** Steps of the currently selected run, in execution order. */
  steps: RunStep[];
  /** Currently selected step id, if any. */
  selectedStepId: string | null;
  /** Which side last drove the selection — guards against re-triggering the other side. */
  syncSource: SyncSource;
  /** Selects a step and records which side drove it. */
  selectStep: (stepId: string | null, source?: SyncSource) => void;
  /** Pans/zooms the canvas onto the given node — typically React Flow's `fitView`. */
  fitView: (nodeId: string) => void;
};

export type UseRunSelectionSyncResult = {
  /** Wire to the canvas's node click handler — selects that node's latest step. */
  onCanvasNodeClick: (nodeId: string) => void;
};

/**
 * Two-way sync between the run-log's step selection and the canvas.
 *
 * - Selecting a step (source `"timeline"`) pans the canvas to that step's node.
 * - Clicking a canvas node (via `onCanvasNodeClick`) selects that node's latest
 *   step in the current run, tagged with source `"canvas"`.
 *
 * `syncSource` guards each direction: only a `"timeline"`-sourced selection
 * triggers `fitView`, so a canvas click never bounces back into another pan.
 */
export function useRunSelectionSync({
  steps,
  selectedStepId,
  syncSource,
  selectStep,
  fitView,
}: UseRunSelectionSyncOptions): UseRunSelectionSyncResult {
  // Read through a ref so a live run appending steps (new array per step)
  // doesn't re-fire the pan effect while the selection is unchanged.
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (syncSource !== "timeline" || !selectedStepId) return;
    const step = stepsRef.current.find((s) => s.id === selectedStepId);
    if (!step) return;
    fitView(step.nodeId);
  }, [syncSource, selectedStepId, fitView]);

  const onCanvasNodeClick = useCallback(
    (nodeId: string) => {
      const latestStep = [...steps]
        .reverse()
        .find((step) => step.nodeId === nodeId);
      if (!latestStep) return;
      selectStep(latestStep.id, "canvas");
    },
    [steps, selectStep],
  );

  return { onCanvasNodeClick };
}
