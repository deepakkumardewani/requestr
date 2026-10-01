import { useCallback, useEffect, useRef, useState } from "react";
import type { RunStep } from "@/lib/chainRunHistory";

type UseCanvasSelectionParams = {
  runSteps?: RunStep[];
  selectedStepId: string | null;
};

/** Which node is selected/focused and whether its details or edit panel is open. */
export function useCanvasSelection({
  runSteps,
  selectedStepId,
}: UseCanvasSelectionParams) {
  const [nodeDetailOpen, setNodeDetailOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [keyboardFocusNodeId, setKeyboardFocusNodeId] = useState<string | null>(
    null,
  );
  const [editRequestId, setEditRequestId] = useState<string | null>(null);

  // Filled in by `RunSelectionSyncBridge` (rendered inside ReactFlow) — selects
  // the clicked node's latest run-log step, tagged with source "canvas".
  const canvasNodeClickRef = useRef<(nodeId: string) => void>(() => {});
  const registerCanvasNodeClick = useCallback(
    (fn: (nodeId: string) => void) => {
      canvasNodeClickRef.current = fn;
    },
    [],
  );

  const clickNode = useCallback((nodeId: string) => {
    setKeyboardFocusNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setNodeDetailOpen(true);
    canvasNodeClickRef.current(nodeId);
  }, []);

  // Keyboard Escape closes the details but keeps the focus ring where it was.
  const closeDetails = useCallback(() => {
    setNodeDetailOpen(false);
    setSelectedNodeId(null);
  }, []);

  const closeDetailsAndClearFocus = useCallback(() => {
    closeDetails();
    setKeyboardFocusNodeId(null);
  }, [closeDetails]);

  const clearKeyboardFocus = useCallback(
    () => setKeyboardFocusNodeId(null),
    [],
  );
  const closeEditRequest = useCallback(() => setEditRequestId(null), []);

  // Highlights the node for a timeline-driven step selection, whether or not
  // a run is currently selected — no-op if the step's run has no such node.
  useEffect(() => {
    if (!selectedStepId || !runSteps) return;
    const step = runSteps.find((s) => s.id === selectedStepId);
    if (step) setKeyboardFocusNodeId(step.nodeId);
  }, [selectedStepId, runSteps]);

  return {
    nodeDetailOpen,
    selectedNodeId,
    keyboardFocusNodeId,
    editRequestId,
    setKeyboardFocusNodeId,
    setEditRequestId,
    clickNode,
    closeDetails,
    closeDetailsAndClearFocus,
    clearKeyboardFocus,
    closeEditRequest,
    registerCanvasNodeClick,
  };
}
