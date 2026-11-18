import type { Edge, Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useChainStore } from "@/stores/useChainStore";
import type { CollectBlock } from "@/types/chain";
import { FIT_VIEW_OPTIONS, useAutoLayout } from "./useAutoLayout";
import { useNudge } from "./useNudge";

type UseChainCanvasShortcutsParams = {
  chainId: string;
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  collectNodes: CollectBlock[];
  /** True while focus is inside the canvas wrapper (see `useCanvasFocusWithin`). */
  canvasFocused: boolean;
  hasClipboard: boolean;
  isRunning: boolean;
  /** Ids of API request nodes — they live outside `Chain.blocks`, so they duplicate through `onDuplicateApiNode`. */
  apiNodeIds: ReadonlySet<string>;
  onDuplicateApiNode?: (requestId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  /** Omitted when running is not currently allowed (same rule as the Run button). */
  onRunChain?: () => void;
  /** Omitted when nothing is running. */
  onStopChain?: () => void;
  onCopySelection: () => void;
  onPasteSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenBlockMenu: () => void;
  onDeleteSelection: () => void;
  /** Opens the Find node dialog (⌘/Ctrl+F while the canvas has focus). */
  onOpenFindNode: () => void;
};

/** Selected ids, minus Collect blocks whose Loop is also selected (duplicating the Loop already clones its Collect). */
function selectedDuplicableIds(
  nodes: Node[],
  collectNodes: CollectBlock[],
): string[] {
  const selected = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
  const pairedCollectIds = new Set(
    collectNodes.filter((c) => selected.has(c.loopId)).map((c) => c.id),
  );
  return [...selected].filter((id) => !pairedCollectIds.has(id));
}

/** Wires every chain-canvas keyboard binding to canvas actions. */
export function useChainCanvasShortcuts({
  chainId,
  nodes,
  edges,
  setNodes,
  collectNodes,
  canvasFocused,
  hasClipboard,
  isRunning,
  apiNodeIds,
  onDuplicateApiNode,
  onDuplicateBlock,
  onUpdateNodePosition,
  onRunChain,
  onStopChain,
  onCopySelection,
  onPasteSelection,
  onUndo,
  onRedo,
  onOpenBlockMenu,
  onDeleteSelection,
  onOpenFindNode,
}: UseChainCanvasShortcutsParams) {
  const { fitView } = useReactFlow();
  const autoLayout = useAutoLayout({
    chainId,
    nodes,
    edges,
    setNodes,
    onUpdateNodePosition,
  });

  const nudge = useNudge({ chainId, nodes, setNodes, disabled: isRunning });

  // With a selection `F` frames just those nodes; otherwise the whole graph.
  const handleFitView = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    fitView(
      selected.length > 0
        ? { ...FIT_VIEW_OPTIONS, nodes: selected.map(({ id }) => ({ id })) }
        : FIT_VIEW_OPTIONS,
    );
  }, [fitView, nodes]);

  const handleSelectAll = useCallback(() => {
    setNodes((prev) => prev.map((node) => ({ ...node, selected: true })));
  }, [setNodes]);

  const handleDuplicateSelection = useCallback(() => {
    if (isRunning) return;
    const ids = selectedDuplicableIds(nodes, collectNodes);
    if (ids.length === 0) return;
    const store = useChainStore.getState();
    // Batched so a multi-select duplicate is a single undo entry.
    store.pauseHistory(chainId);
    for (const id of ids) {
      if (apiNodeIds.has(id)) onDuplicateApiNode?.(id);
      else onDuplicateBlock(id);
    }
    store.resumeHistory(chainId);
  }, [
    isRunning,
    nodes,
    collectNodes,
    chainId,
    apiNodeIds,
    onDuplicateApiNode,
    onDuplicateBlock,
  ]);

  const handlers = useMemo(
    () => ({
      onRunChain,
      onStopChain,
      onCopySelection,
      onPasteSelection,
      onUndo,
      onRedo,
      onOpenBlockMenu,
      onDeleteSelection,
      onDuplicateSelection: handleDuplicateSelection,
      onSelectAll: handleSelectAll,
      // Layout moves nodes; block it while a run is animating the graph.
      onAutoLayoutChain: isRunning ? undefined : autoLayout,
      onFitViewChain: handleFitView,
      onFindNode: onOpenFindNode,
    }),
    [
      onRunChain,
      onStopChain,
      onCopySelection,
      onPasteSelection,
      onUndo,
      onRedo,
      onOpenBlockMenu,
      onDeleteSelection,
      handleDuplicateSelection,
      handleSelectAll,
      isRunning,
      autoLayout,
      handleFitView,
      onOpenFindNode,
    ],
  );

  useKeyboardShortcuts(handlers, {
    canvasFocused,
    hasClipboard,
    hasSelection: nodes.some((n) => n.selected),
  });

  return { nudge };
}
