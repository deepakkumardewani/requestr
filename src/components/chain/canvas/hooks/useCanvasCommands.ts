import type { Edge, Node } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import { useChainStore } from "@/stores/useChainStore";
import type { RequestModel } from "@/types";
import type { ChainBlock, ChainEdge, CollectBlock } from "@/types/chain";
import { useCanvasClipboard } from "./useCanvasClipboard";
import { useChainCanvasShortcuts } from "./useChainCanvasShortcuts";

const BLOCK_MENU_TRIGGER_SELECTOR = '[data-testid="block-menu-trigger"]';

type UseCanvasCommandsOptions = {
  chainId: string;
  requests: RequestModel[];
  blocks: ChainBlock[];
  collectNodes: CollectBlock[];
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  chainEdges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  canvasFocused: boolean;
  isRunning: boolean;
  onDuplicateNode?: (requestId: string) => void;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  onRunChain?: () => void;
  onStopChain?: () => void;
};

/**
 * The canvas's keyboard-driven commands (clipboard, undo/redo, duplicate,
 * delete, block menu) wired to their shortcuts. Returns the two commands the
 * rest of the canvas also triggers from the UI.
 */
export function useCanvasCommands({
  chainId,
  requests,
  blocks,
  collectNodes,
  nodes,
  edges,
  setNodes,
  chainEdges,
  nodePositions,
  canvasFocused,
  isRunning,
  onDuplicateNode,
  onUpdateNodePosition,
  onRunChain,
  onStopChain,
}: UseCanvasCommandsOptions) {
  const { copySelection, pasteSelection, hasClipboard } = useCanvasClipboard({
    chainId,
    nodes,
    blocks,
    chainEdges,
    nodePositions,
  });

  const duplicateBlock = useCallback(
    (blockId: string) => {
      useChainStore.getState().duplicateNode(chainId, blockId);
    },
    [chainId],
  );

  const undo = useCallback(
    () => useChainStore.getState().undo(chainId),
    [chainId],
  );
  const redo = useCallback(
    () => useChainStore.getState().redo(chainId),
    [chainId],
  );

  // Reuses the BlockMenu trigger rather than duplicating its picker UI; the
  // trigger already renders inside this canvas via `ChainCanvasFlow`.
  const openBlockMenu = useCallback(() => {
    document
      .querySelector<HTMLButtonElement>(BLOCK_MENU_TRIGGER_SELECTOR)
      ?.click();
  }, []);

  const deleteSelection = useCallback(() => {
    const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
    // One store action so a multi-select delete is a single undo entry.
    useChainStore.getState().removeNodes(chainId, selectedIds);
  }, [nodes, chainId]);

  const apiNodeIds = useMemo(
    () => new Set(requests.map((r) => r.id)),
    [requests],
  );

  useChainCanvasShortcuts({
    chainId,
    nodes,
    edges,
    setNodes,
    collectNodes,
    canvasFocused,
    hasClipboard,
    isRunning,
    apiNodeIds,
    onDuplicateApiNode: onDuplicateNode,
    onDuplicateBlock: duplicateBlock,
    onUpdateNodePosition,
    onRunChain,
    onStopChain,
    onCopySelection: copySelection,
    onPasteSelection: pasteSelection,
    onUndo: undo,
    onRedo: redo,
    onOpenBlockMenu: openBlockMenu,
    onDeleteSelection: deleteSelection,
  });

  return { duplicateBlock, openBlockMenu };
}
