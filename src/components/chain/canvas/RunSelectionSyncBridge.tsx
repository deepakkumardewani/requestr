"use client";

import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect } from "react";
import type { RunStep } from "@/lib/chainRunHistory";
import {
  type SyncSource,
  useRunSelectionSync,
} from "./hooks/useRunSelectionSync";

type RunSelectionSyncBridgeProps = {
  steps: RunStep[];
  selectedStepId: string | null;
  syncSource: SyncSource;
  selectStep: (stepId: string | null, source?: SyncSource) => void;
  /** Registers the canvas-click handler with the parent so it can wire it to node clicks. */
  onCanvasNodeClickReady: (fn: (nodeId: string) => void) => void;
};

/**
 * Bridges the run-log's step selection to the canvas. Must be rendered as a
 * descendant of `<ReactFlow>` so it can call `useReactFlow` for panning.
 */
export function RunSelectionSyncBridge({
  steps,
  selectedStepId,
  syncSource,
  selectStep,
  onCanvasNodeClickReady,
}: RunSelectionSyncBridgeProps) {
  const { fitView } = useReactFlow();

  const fitViewToNode = useCallback(
    (nodeId: string) => fitView({ nodes: [{ id: nodeId }], duration: 300 }),
    [fitView],
  );

  const { onCanvasNodeClick } = useRunSelectionSync({
    steps,
    selectedStepId,
    syncSource,
    selectStep,
    fitView: fitViewToNode,
  });

  useEffect(() => {
    onCanvasNodeClickReady(onCanvasNodeClick);
  }, [onCanvasNodeClick, onCanvasNodeClickReady]);

  return null;
}
