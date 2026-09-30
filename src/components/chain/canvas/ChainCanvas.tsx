"use client";

import "@xyflow/react/dist/style.css";
import type {
  Connection,
  Edge,
  EdgeMouseHandler,
  Node,
  NodeMouseHandler,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { generateId } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { useUIStore } from "@/stores/useUIStore";
import type { ChainBlock } from "@/types/chain";
import { SubChainPicker } from "../dialogs/SubChainPicker";
import { CanvasEmptyState } from "./CanvasEmptyState";
import type { ChainCanvasProps, ContextMenuState } from "./ChainCanvas.types";
import { ChainCanvasFlow } from "./ChainCanvasFlow";
import { ChainCanvasPanels } from "./ChainCanvasPanels";
import { GhostNode } from "./GhostNode";
import { useCanvasKeyboardNav } from "./hooks/useCanvasKeyboardNav";
import {
  isValidChainConnection,
  useChainConnect,
} from "./hooks/useChainConnect";
import { useChainEdges } from "./hooks/useChainEdges";
import { useChainNodes } from "./hooks/useChainNodes";

export function ChainCanvas({
  chainId,
  requests,
  edges: chainEdges,
  nodePositions,
  nodeAssertions,
  runState,
  isRunning,
  delayNodes,
  conditionNodes,
  cycleEdgeId,
  onAddApiClick,
  onDeleteNode,
  onDuplicateNode,
  onUpsertEdge,
  onDeleteEdge,
  onUpdateNodePosition,
  onUpsertNodeAssertions,
  onRunNode,
  onRunUpTo,
  onRunFromHere,
  onAddAfterNode,
  onUpsertDelayNode,
  onUpsertConditionNode,
  onRemoveConditionNode,
  displayNodes,
  onUpsertDisplayNode,
  evaluateNodes,
  onUpsertEvaluateNode,
  validateNodes,
  onUpsertValidateNode,
  mergeNodes,
  onUpsertMergeNode,
  loopNodes,
  onUpsertLoopNode,
  collectNodes,
  onUpsertCollectNode,
  subChainNodes,
  onUpsertSubChainNode,
  startBlock,
  onUpsertStartBlock,
  onRemoveStartBlock,
  envPromotions,
  onSavePromotion,
  onRemovePromotion,
  onSaveRequest,
  resolveVariables,
  runSteps,
  selectedStepId = null,
  syncSource = null,
  onSelectStep,
}: ChainCanvasProps) {
  const { resolvedTheme } = useTheme();
  const flowColorMode = resolvedTheme === "dark" ? "dark" : "light";

  const [nodeDetailOpen, setNodeDetailOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [conditionPanelNodeId, setConditionPanelNodeId] = useState<
    string | null
  >(null);

  const [startConfigPanelNodeId, setStartConfigPanelNodeId] = useState<
    string | null
  >(null);

  const [evaluatePanelNodeId, setEvaluatePanelNodeId] = useState<string | null>(
    null,
  );

  const [validatePanelNodeId, setValidatePanelNodeId] = useState<string | null>(
    null,
  );

  const [mergePanelNodeId, setMergePanelNodeId] = useState<string | null>(null);

  const [loopPanelNodeId, setLoopPanelNodeId] = useState<string | null>(null);

  const [collectPanelNodeId, setCollectPanelNodeId] = useState<string | null>(
    null,
  );

  const [subChainPanelNodeId, setSubChainPanelNodeId] = useState<string | null>(
    null,
  );

  const [subChainPickerNodeId, setSubChainPickerNodeId] = useState<
    string | null
  >(null);

  const [pendingNodeType, setPendingNodeType] = useState<
    | "delay"
    | "condition"
    | "display"
    | "evaluate"
    | "validate"
    | "merge"
    | "loop"
    | "collect"
    | "subchain"
    | null
  >(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [keyboardFocusNodeId, setKeyboardFocusNodeId] = useState<string | null>(
    null,
  );

  const [arrowConfigPanelOpen, setArrowConfigPanelOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedDisplayNodeId, setSelectedDisplayNodeId] = useState<
    string | null
  >(null);

  // Filled in by `RunSelectionSyncBridge` (rendered inside ReactFlow) — selects
  // the clicked node's latest run-log step, tagged with source "canvas".
  const canvasNodeClickRef = useRef<(nodeId: string) => void>(() => {});
  const registerCanvasNodeClick = useCallback(
    (fn: (nodeId: string) => void) => {
      canvasNodeClickRef.current = fn;
    },
    [],
  );

  const handleClickNode = useCallback((requestId: string) => {
    setKeyboardFocusNodeId(requestId);
    setSelectedNodeId(requestId);
    setNodeDetailOpen(true);
    canvasNodeClickRef.current(requestId);
  }, []);

  // Highlights the node for a timeline-driven step selection, whether or not
  // a run is currently selected — no-op if the step's run has no such node.
  useEffect(() => {
    if (!selectedStepId || !runSteps) return;
    const step = runSteps.find((s) => s.id === selectedStepId);
    if (step) setKeyboardFocusNodeId(step.nodeId);
  }, [selectedStepId, runSteps]);

  const handleEditRequest = useCallback((requestId: string) => {
    setEditRequestId(requestId);
  }, []);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedDisplayNodeId(null);
    setArrowConfigPanelOpen(true);
  }, []);

  // Memoized handler for React Flow's native onEdgeClick
  const onEdgeClickHandler: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      handleEdgeClick(edge.id);
    },
    [handleEdgeClick],
  );

  const handleDisplayNodeClick = useCallback((nodeId: string) => {
    setSelectedDisplayNodeId(nodeId);
    setSelectedEdgeId(null);
    setArrowConfigPanelOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setNodeDetailOpen(false);
    setSelectedNodeId(null);
  }, []);

  const handleUpdateDelay = useCallback(
    (id: string, delayMs: number) => {
      const node = delayNodes.find((n) => n.id === id);
      if (!node) return;
      onUpsertDelayNode({ ...node, delayMs });
    },
    [delayNodes, onUpsertDelayNode],
  );

  const { edges, setEdges, onEdgesChange } = useChainEdges({
    chainEdges,
    conditionNodes,
    onDeleteEdge,
  });

  const handleConfigureNode = useCallback((nodeId: string) => {
    // For now, open start config panel for start node (will be expanded later if needed)
    setStartConfigPanelNodeId(nodeId);
  }, []);

  const handleAddStartClick = useCallback(() => {
    onUpsertStartBlock({ id: generateId(), type: "start", inputs: [] });
  }, [onUpsertStartBlock]);

  const { nodes, setNodes, onNodesChange } = useChainNodes({
    chainId,
    requests,
    delayNodes,
    conditionNodes,
    displayNodes,
    evaluateNodes,
    validateNodes,
    mergeNodes,
    loopNodes,
    collectNodes,
    subChainNodes,
    startBlock,
    chainEdges,
    nodePositions,
    runState,
    keyboardFocusNodeId,
    onClickNode: handleClickNode,
    onDeleteNode,
    onRunNode,
    onDuplicateNode,
    onEditRequest: handleEditRequest,
    onUpdateDelay: handleUpdateDelay,
    onConfigureNode: handleConfigureNode,
    onConfigureEvaluateNode: setEvaluatePanelNodeId,
    onConfigureValidateNode: setValidatePanelNodeId,
    onConfigureMergeNode: setMergePanelNodeId,
    onConfigureLoopNode: setLoopPanelNodeId,
    onConfigureCollectNode: setCollectPanelNodeId,
    onConfigureSubChainNode: setSubChainPanelNodeId,
    onChangeSubChainReference: setSubChainPickerNodeId,
    onClickDisplayNode: handleDisplayNodeClick,
    resolveVariables,
  });

  const { onConnect, conditionNodeIds, delayNodeIds } = useChainConnect({
    chainEdges,
    conditionNodes,
    delayNodes,
    displayNodes,
    onUpsertEdge,
    onDeleteEdge,
    setEdges,
  });

  const isValidConnection = useCallback(
    (edgeOrConnection: Edge | Connection) =>
      isValidChainConnection(edgeOrConnection as Connection, chainEdges),
    [chainEdges],
  );

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // ESC cancels ghost placement
  useEffect(() => {
    if (!pendingNodeType) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPendingNodeType(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingNodeType]);

  const onNodeDragStart = useCallback(() => {
    useChainStore.getState().pauseHistory(chainId);
  }, [chainId]);

  const onNodeDragStop = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      onUpdateNodePosition(node.id, node.position as { x: number; y: number });
      useChainStore.getState().resumeHistory(chainId);
    },
    [onUpdateNodePosition, chainId],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          onDeleteEdge(change.id);
        }
      }
    },
    [onDeleteEdge, onEdgesChange],
  );

  const displayNodeIds = useMemo(
    () => new Set(displayNodes.map((n) => n.id)),
    [displayNodes],
  );

  const evaluateNodeIds = useMemo(
    () => new Set(evaluateNodes.map((n) => n.id)),
    [evaluateNodes],
  );

  const validateNodeIds = useMemo(
    () => new Set(validateNodes.map((n) => n.id)),
    [validateNodes],
  );

  const mergeNodeIds = useMemo(
    () => new Set(mergeNodes.map((n) => n.id)),
    [mergeNodes],
  );

  const loopNodeIds = useMemo(
    () => new Set(loopNodes.map((n) => n.id)),
    [loopNodes],
  );

  const collectNodeIds = useMemo(
    () => new Set(collectNodes.map((n) => n.id)),
    [collectNodes],
  );

  const subChainNodeIds = useMemo(
    () => new Set(subChainNodes.map((n) => n.id)),
    [subChainNodes],
  );

  // Copy/paste targets delay/condition/display blocks — the block kinds that
  // live entirely in `Chain.blocks` and can be reproduced with fresh ids in
  // any chain. API request nodes reference a `requestId` owned by the
  // collection/standalone request store, not the chain, so copying them
  // across chains is out of scope here (see P4.7 adaptation note in tasks).
  const clipboardCandidates = useMemo(
    () =>
      [
        ...delayNodes,
        ...conditionNodes,
        ...displayNodes,
        ...evaluateNodes,
        ...validateNodes,
      ] as ChainBlock[],
    [delayNodes, conditionNodes, displayNodes, evaluateNodes, validateNodes],
  );

  const chainClipboard = useUIStore((s) => s.chainClipboard);
  const setChainClipboard = useUIStore((s) => s.setChainClipboard);

  const handleCopySelection = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    );
    if (selectedIds.size === 0) return;
    const blocks = clipboardCandidates.filter((b) => selectedIds.has(b.id));
    if (blocks.length === 0) return;
    const internalEdges = chainEdges.filter(
      (e) =>
        selectedIds.has(e.sourceRequestId) &&
        selectedIds.has(e.targetRequestId),
    );
    const positions: Record<string, { x: number; y: number }> = {};
    for (const block of blocks) {
      positions[block.id] = nodePositions[block.id] ?? { x: 0, y: 0 };
    }
    setChainClipboard({ blocks, edges: internalEdges, positions });
  }, [
    nodes,
    clipboardCandidates,
    chainEdges,
    nodePositions,
    setChainClipboard,
  ]);

  const PASTE_OFFSET = 40;

  const handlePasteSelection = useCallback(() => {
    if (!chainClipboard || chainClipboard.blocks.length === 0) return;
    const idMap = new Map<string, string>();
    for (const block of chainClipboard.blocks)
      idMap.set(block.id, generateId());

    const store = useChainStore.getState();
    store.pauseHistory(chainId);
    for (const block of chainClipboard.blocks) {
      const newId = idMap.get(block.id);
      if (!newId) continue;
      store.upsertBlock(chainId, { ...block, id: newId } as ChainBlock);
      const pos = chainClipboard.positions[block.id] ?? { x: 0, y: 0 };
      store.updateNodePosition(chainId, newId, {
        x: pos.x + PASTE_OFFSET,
        y: pos.y + PASTE_OFFSET,
      });
    }
    for (const edge of chainClipboard.edges) {
      const newSource = idMap.get(edge.sourceRequestId);
      const newTarget = idMap.get(edge.targetRequestId);
      if (!newSource || !newTarget) continue;
      store.upsertEdge(chainId, {
        ...edge,
        id: generateId(),
        sourceRequestId: newSource,
        targetRequestId: newTarget,
      });
    }
    store.resumeHistory(chainId);
  }, [chainClipboard, chainId]);

  const handleUndo = useCallback(() => {
    useChainStore.getState().undo(chainId);
  }, [chainId]);

  const handleRedo = useCallback(() => {
    useChainStore.getState().redo(chainId);
  }, [chainId]);

  const handleOpenBlockMenu = useCallback(() => {
    document
      .querySelector<HTMLButtonElement>('[data-testid="block-menu-trigger"]')
      ?.click();
  }, []);

  const handleDeleteSelection = useCallback(() => {
    for (const node of nodes) {
      if (node.selected) onDeleteNode(node.id);
    }
  }, [nodes, onDeleteNode]);

  useKeyboardShortcuts(
    {
      onCopySelection: handleCopySelection,
      onPasteSelection: handlePasteSelection,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onOpenBlockMenu: handleOpenBlockMenu,
      onDeleteSelection: handleDeleteSelection,
    },
    {
      canvasFocused: true,
      hasSelection: nodes.some((n) => n.selected),
    },
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const nodeType = conditionNodeIds.has(node.id)
        ? "condition"
        : delayNodeIds.has(node.id)
          ? "delay"
          : displayNodeIds.has(node.id)
            ? "display"
            : evaluateNodeIds.has(node.id)
              ? "evaluate"
              : validateNodeIds.has(node.id)
                ? "validate"
                : mergeNodeIds.has(node.id)
                  ? "merge"
                  : loopNodeIds.has(node.id)
                    ? "loop"
                    : collectNodeIds.has(node.id)
                      ? "collect"
                      : subChainNodeIds.has(node.id)
                        ? "subchain"
                        : "api";
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeType,
      });
    },
    [
      conditionNodeIds,
      delayNodeIds,
      displayNodeIds,
      evaluateNodeIds,
      validateNodeIds,
      mergeNodeIds,
      loopNodeIds,
      collectNodeIds,
      subChainNodeIds,
    ],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_evt, node) => {
    if (node.type === "conditionNode") {
      setConditionPanelNodeId(node.id);
    } else if (node.type === "evaluateNode") {
      setEvaluatePanelNodeId(node.id);
    } else if (node.type === "validateNode") {
      setValidatePanelNodeId(node.id);
    } else if (node.type === "mergeNode") {
      setMergePanelNodeId(node.id);
    } else if (node.type === "loopNode") {
      setLoopPanelNodeId(node.id);
    } else if (node.type === "collectNode") {
      setCollectPanelNodeId(node.id);
    } else if (node.type === "subchainNode") {
      setSubChainPanelNodeId(node.id);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setKeyboardFocusNodeId(null);
  }, []);

  const onCanvasKeyDown = useCanvasKeyboardNav({
    nodes,
    keyboardFocusNodeId,
    setKeyboardFocusNodeId,
    pendingNodeType,
    onClickNode: handleClickNode,
    onConfigureNode: setConditionPanelNodeId,
    onCloseDetails: handleCloseDetails,
  });

  // The empty-state "Add block" affordance and the ⌘⇧K/`/` shortcuts all
  // reuse the existing BlockMenu trigger rather than duplicating its picker
  // UI — the trigger already renders inside this canvas via `ChainCanvasFlow`.
  const handleAddBlock = handleOpenBlockMenu;

  const selectedRequest = requests.find((r) => r.id === selectedNodeId) ?? null;
  const selectedState = selectedNodeId ? runState[selectedNodeId] : null;
  const canSaveBody = Boolean(
    selectedRequest && selectedRequest.collectionId !== "",
  );

  const conditionPanelNode =
    conditionPanelNodeId !== null
      ? (conditionNodes.find((n) => n.id === conditionPanelNodeId) ?? null)
      : null;

  return (
    <div
      role="application"
      aria-label="Request chain canvas. Use arrow keys to move between nodes, Enter to open details or configure, Escape to clear selection."
      tabIndex={0}
      className="relative h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      style={{ cursor: pendingNodeType ? "crosshair" : undefined }}
      onMouseMove={(e) => {
        if (pendingNodeType) setCursorPos({ x: e.clientX, y: e.clientY });
      }}
      onKeyDown={onCanvasKeyDown}
    >
      {pendingNodeType && (
        <GhostNode type={pendingNodeType} cursorPos={cursorPos} />
      )}

      {nodes.length === 0 && (
        <CanvasEmptyState
          onAddFromCollection={onAddApiClick}
          onAddBlock={handleAddBlock}
        />
      )}

      <ChainCanvasFlow
        chainId={chainId}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClickHandler}
        isRunning={isRunning}
        flowColorMode={flowColorMode}
        onAddApiClick={onAddApiClick}
        onEnterGhostMode={setPendingNodeType}
        hasStartNode={Boolean(startBlock)}
        onAddStartClick={handleAddStartClick}
        onUpdateNodePosition={onUpdateNodePosition}
        setNodes={setNodes}
        pendingNodeType={pendingNodeType}
        cursorPos={cursorPos}
        onUpsertDelayNode={onUpsertDelayNode}
        onUpsertConditionNode={onUpsertConditionNode}
        onUpsertDisplayNode={onUpsertDisplayNode}
        onUpsertEvaluateNode={onUpsertEvaluateNode}
        onUpsertValidateNode={onUpsertValidateNode}
        onUpsertMergeNode={onUpsertMergeNode}
        onUpsertLoopNode={onUpsertLoopNode}
        onUpsertCollectNode={onUpsertCollectNode}
        onUpsertSubChainNode={onUpsertSubChainNode}
        onOpenConditionPanel={setConditionPanelNodeId}
        onOpenEvaluatePanel={setEvaluatePanelNodeId}
        onOpenValidatePanel={setValidatePanelNodeId}
        onOpenMergePanel={setMergePanelNodeId}
        onOpenLoopPanel={setLoopPanelNodeId}
        onOpenCollectPanel={setCollectPanelNodeId}
        onOpenSubChainPicker={setSubChainPickerNodeId}
        onClearPending={() => setPendingNodeType(null)}
        cycleEdgeId={cycleEdgeId}
        runSteps={runSteps}
        selectedStepId={selectedStepId}
        syncSource={syncSource}
        onSelectStep={onSelectStep}
        onCanvasNodeClickReady={registerCanvasNodeClick}
      />

      <ChainCanvasPanels
        contextMenu={contextMenu}
        onCloseContextMenu={() => setContextMenu(null)}
        onAddAfterNode={onAddAfterNode}
        onRunUpTo={onRunUpTo}
        onRunFromHere={onRunFromHere}
        onDeleteNode={onDeleteNode}
        onOpenConditionPanel={setConditionPanelNodeId}
        onOpenDisplayNodeConfig={handleDisplayNodeClick}
        editRequestId={editRequestId}
        requests={requests}
        onCloseEditRequest={() => setEditRequestId(null)}
        onSaveRequest={onSaveRequest}
        nodeDetailOpen={nodeDetailOpen}
        onCloseDetails={() => {
          setNodeDetailOpen(false);
          setSelectedNodeId(null);
          setKeyboardFocusNodeId(null);
        }}
        selectedRequest={selectedRequest}
        selectedState={selectedState}
        selectedNodeId={selectedNodeId}
        nodeAssertions={nodeAssertions}
        onUpsertNodeAssertions={onUpsertNodeAssertions}
        canSaveBody={canSaveBody}
        chainEdges={chainEdges}
        envPromotions={envPromotions}
        onSavePromotion={onSavePromotion}
        onRemovePromotion={onRemovePromotion}
        conditionPanelNodeId={conditionPanelNodeId}
        conditionPanelNode={conditionPanelNode}
        onCloseConditionPanel={() => setConditionPanelNodeId(null)}
        onUpsertConditionNode={onUpsertConditionNode}
        onRemoveConditionNode={onRemoveConditionNode}
        arrowConfigPanelOpen={arrowConfigPanelOpen}
        selectedEdgeId={selectedEdgeId}
        selectedDisplayNodeId={selectedDisplayNodeId}
        onCloseArrowConfigPanel={() => {
          setArrowConfigPanelOpen(false);
          setSelectedEdgeId(null);
          setSelectedDisplayNodeId(null);
        }}
        onUpsertEdge={onUpsertEdge}
        onDeleteEdge={onDeleteEdge}
        displayNodes={displayNodes}
        onUpsertDisplayNode={onUpsertDisplayNode}
        startBlock={startBlock}
        startConfigPanelNodeId={startConfigPanelNodeId}
        onCloseStartConfigPanel={() => setStartConfigPanelNodeId(null)}
        onUpsertStartBlock={onUpsertStartBlock}
        onRemoveStartBlock={onRemoveStartBlock}
        onRunSource={onRunNode}
        runState={runState}
        evaluateNodes={evaluateNodes}
        evaluatePanelNodeId={evaluatePanelNodeId}
        onOpenEvaluatePanel={setEvaluatePanelNodeId}
        onCloseEvaluatePanel={() => setEvaluatePanelNodeId(null)}
        onUpsertEvaluateNode={onUpsertEvaluateNode}
        validateNodes={validateNodes}
        validatePanelNodeId={validatePanelNodeId}
        onOpenValidatePanel={setValidatePanelNodeId}
        onCloseValidatePanel={() => setValidatePanelNodeId(null)}
        onUpsertValidateNode={onUpsertValidateNode}
        mergeNodes={mergeNodes}
        mergePanelNodeId={mergePanelNodeId}
        onOpenMergePanel={setMergePanelNodeId}
        onCloseMergePanel={() => setMergePanelNodeId(null)}
        onUpsertMergeNode={onUpsertMergeNode}
        loopNodes={loopNodes}
        loopPanelNodeId={loopPanelNodeId}
        onOpenLoopPanel={setLoopPanelNodeId}
        onCloseLoopPanel={() => setLoopPanelNodeId(null)}
        onUpsertLoopNode={onUpsertLoopNode}
        collectNodes={collectNodes}
        collectPanelNodeId={collectPanelNodeId}
        onOpenCollectPanel={setCollectPanelNodeId}
        onCloseCollectPanel={() => setCollectPanelNodeId(null)}
        onUpsertCollectNode={onUpsertCollectNode}
        subChainNodes={subChainNodes}
        subChainPanelNodeId={subChainPanelNodeId}
        onOpenSubChainPanel={setSubChainPanelNodeId}
        onCloseSubChainPanel={() => setSubChainPanelNodeId(null)}
        onUpsertSubChainNode={onUpsertSubChainNode}
      />

      <SubChainPicker
        open={subChainPickerNodeId !== null}
        currentChainId={chainId}
        onClose={() => setSubChainPickerNodeId(null)}
        onSelect={(selectedChainId) => {
          const node = subChainNodes.find((n) => n.id === subChainPickerNodeId);
          if (node) onUpsertSubChainNode({ ...node, chainId: selectedChainId });
          setSubChainPickerNodeId(null);
        }}
      />
    </div>
  );
}
