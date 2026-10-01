"use client";

import "@xyflow/react/dist/style.css";
import type { EdgeMouseHandler } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";
import { groupBlocks } from "@/lib/chainRunner/runGraph";
import { generateId } from "@/lib/utils";
import { SubChainPicker } from "../dialogs/SubChainPicker";
import { CanvasEmptyState } from "./CanvasEmptyState";
import type { ChainCanvasProps } from "./ChainCanvas.types";
import { ChainCanvasFlow } from "./ChainCanvasFlow";
import { ChainCanvasPanels } from "./ChainCanvasPanels";
import { GhostNode } from "./GhostNode";
import { useCanvasCommands } from "./hooks/useCanvasCommands";
import { useCanvasFocusWithin } from "./hooks/useCanvasFocusWithin";
import { useCanvasKeyboardNav } from "./hooks/useCanvasKeyboardNav";
import { useCanvasPanels } from "./hooks/useCanvasPanels";
import { useCanvasSelection } from "./hooks/useCanvasSelection";
import { useChainConnect } from "./hooks/useChainConnect";
import { useChainEdges } from "./hooks/useChainEdges";
import { useChainNodes } from "./hooks/useChainNodes";
import { useFlowHandlers } from "./hooks/useFlowHandlers";
import { useGhostPlacement } from "./hooks/useGhostPlacement";
import { useNodeInteractions } from "./hooks/useNodeInteractions";

/** Provides the React Flow context so shortcut handlers (fit view, auto-layout) can use `useReactFlow` outside the `<ReactFlow>` tree. */
export function ChainCanvas(props: ChainCanvasProps) {
  return (
    <ReactFlowProvider>
      <ChainCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ChainCanvasInner({
  chainId,
  requests,
  edges: chainEdges,
  nodePositions,
  nodeAssertions,
  runState,
  isRunning,
  blocks,
  cycleEdgeId,
  onAddApiClick,
  onDeleteNode,
  onDuplicateNode,
  onUpsertEdge,
  onDeleteEdge,
  onUpdateNodePosition,
  onUpsertNodeAssertions,
  onRunNode,
  onRunChain,
  onStopChain,
  onRunUpTo,
  onRunFromHere,
  onAddAfterNode,
  onUpsertBlock,
  onRemoveConditionNode,
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
  const t = useTranslations("chain");
  const { resolvedTheme } = useTheme();
  const {
    wrapperRef,
    focused: canvasFocused,
    focusProps,
  } = useCanvasFocusWithin();
  const flowColorMode = resolvedTheme === "dark" ? "dark" : "light";

  const views = useMemo(() => groupBlocks(blocks), [blocks]);
  const { delayNodes, conditionNodes, displayNodes, collectNodes, startBlock } =
    views;

  const selection = useCanvasSelection({ runSteps, selectedStepId });
  const panels = useCanvasPanels();
  const { openers } = panels;
  const ghost = useGhostPlacement();
  const interactions = useNodeInteractions({
    blocks,
    configureBlock: panels.configureBlock,
  });

  const handleUpdateDelay = useCallback(
    (id: string, delayMs: number) => {
      const node = delayNodes.find((n) => n.id === id);
      if (node) onUpsertBlock({ ...node, delayMs });
    },
    [delayNodes, onUpsertBlock],
  );

  const { edges, setEdges, onEdgesChange } = useChainEdges({
    chainEdges,
    conditionNodes,
    onDeleteEdge,
  });

  const handleAddStartClick = useCallback(() => {
    onUpsertBlock({ id: generateId(), type: "start", inputs: [] });
  }, [onUpsertBlock]);

  const { nodes, setNodes, onNodesChange } = useChainNodes({
    chainId,
    requests,
    ...views,
    chainEdges,
    nodePositions,
    runState,
    keyboardFocusNodeId: selection.keyboardFocusNodeId,
    onClickNode: selection.clickNode,
    onDeleteNode,
    onRunNode,
    onDuplicateNode,
    onEditRequest: selection.setEditRequestId,
    onUpdateDelay: handleUpdateDelay,
    onConfigureNode: openers.start,
    onConfigureEvaluateNode: openers.evaluate,
    onConfigureValidateNode: openers.validate,
    onConfigureMergeNode: openers.merge,
    onConfigureLoopNode: openers.loop,
    onConfigureCollectNode: openers.collect,
    onConfigureSubChainNode: openers.subchain,
    onChangeSubChainReference: panels.setSubChainPickerNodeId,
    onClickDisplayNode: panels.openDisplayConfig,
    resolveVariables,
  });

  const { onConnect } = useChainConnect({
    chainId,
    chainEdges,
    conditionNodes,
    delayNodes,
    displayNodes,
    onUpsertEdge,
    onDeleteEdge,
    setEdges,
  });

  const flowHandlers = useFlowHandlers({
    chainId,
    chainEdges,
    onEdgesChange,
    onDeleteEdge,
    onUpdateNodePosition,
  });

  const { duplicateBlock, openBlockMenu } = useCanvasCommands({
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
  });

  const { clearKeyboardFocus } = selection;
  const { closeContextMenu } = interactions;
  const onPaneClick = useCallback(() => {
    closeContextMenu();
    clearKeyboardFocus();
  }, [closeContextMenu, clearKeyboardFocus]);

  const { openEdgeConfig } = panels;
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => openEdgeConfig(edge.id),
    [openEdgeConfig],
  );

  const onCanvasKeyDown = useCanvasKeyboardNav({
    nodes,
    keyboardFocusNodeId: selection.keyboardFocusNodeId,
    setKeyboardFocusNodeId: selection.setKeyboardFocusNodeId,
    pendingNodeType: ghost.pendingNodeType,
    onClickNode: selection.clickNode,
    onConfigureNode: interactions.configureNode,
    onCloseDetails: selection.closeDetails,
  });

  const { selectedNodeId } = selection;
  const selectedRequest = requests.find((r) => r.id === selectedNodeId) ?? null;
  const canSaveBody = Boolean(
    selectedRequest && selectedRequest.collectionId !== "",
  );

  const pickerNodeId = panels.subChainPickerNodeId;
  const handleSubChainSelected = (selectedChainId: string) => {
    const node = views.subChainNodes.find((n) => n.id === pickerNodeId);
    if (node) onUpsertBlock({ ...node, chainId: selectedChainId });
    panels.setSubChainPickerNodeId(null);
  };

  return (
    <div
      ref={wrapperRef}
      role="application"
      aria-label={t("canvasAriaLabel")}
      tabIndex={0}
      className="relative h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      style={{ cursor: ghost.pendingNodeType ? "crosshair" : undefined }}
      onMouseMove={ghost.trackCursor}
      onKeyDown={onCanvasKeyDown}
      {...focusProps}
    >
      {ghost.pendingNodeType && (
        <GhostNode type={ghost.pendingNodeType} cursorPos={ghost.cursorPos} />
      )}

      {nodes.length === 0 && (
        <CanvasEmptyState
          onAddFromCollection={onAddApiClick}
          onAddBlock={openBlockMenu}
        />
      )}

      <ChainCanvasFlow
        chainId={chainId}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={flowHandlers.handleEdgesChange}
        onConnect={onConnect}
        isValidConnection={flowHandlers.isValidConnection}
        onNodeDragStart={flowHandlers.onNodeDragStart}
        onNodeDragStop={flowHandlers.onNodeDragStop}
        onNodeContextMenu={interactions.onNodeContextMenu}
        onNodeDoubleClick={interactions.onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        isRunning={isRunning}
        flowColorMode={flowColorMode}
        onAddApiClick={onAddApiClick}
        onEnterGhostMode={ghost.setPendingNodeType}
        hasStartNode={Boolean(startBlock)}
        onAddStartClick={handleAddStartClick}
        onUpdateNodePosition={onUpdateNodePosition}
        setNodes={setNodes}
        pendingNodeType={ghost.pendingNodeType}
        cursorPos={ghost.cursorPos}
        onUpsertBlock={onUpsertBlock}
        panelOpeners={openers}
        onOpenSubChainPicker={panels.setSubChainPickerNodeId}
        onClearPending={ghost.clearPending}
        cycleEdgeId={cycleEdgeId}
        runSteps={runSteps}
        selectedStepId={selectedStepId}
        syncSource={syncSource}
        onSelectStep={onSelectStep}
        onCanvasNodeClickReady={selection.registerCanvasNodeClick}
      />

      <ChainCanvasPanels
        contextMenu={interactions.contextMenu}
        onCloseContextMenu={closeContextMenu}
        onAddAfterNode={onAddAfterNode}
        onRunUpTo={onRunUpTo}
        onRunFromHere={onRunFromHere}
        onDeleteNode={onDeleteNode}
        onDuplicateBlock={duplicateBlock}
        onConfigureBlock={panels.configureBlock}
        onChangeSubChainReference={panels.setSubChainPickerNodeId}
        editRequestId={selection.editRequestId}
        requests={requests}
        onCloseEditRequest={selection.closeEditRequest}
        onSaveRequest={onSaveRequest}
        nodeDetailOpen={selection.nodeDetailOpen}
        onCloseDetails={selection.closeDetailsAndClearFocus}
        selectedRequest={selectedRequest}
        selectedState={selectedNodeId ? runState[selectedNodeId] : null}
        selectedNodeId={selectedNodeId}
        nodeAssertions={nodeAssertions}
        onUpsertNodeAssertions={onUpsertNodeAssertions}
        canSaveBody={canSaveBody}
        chainEdges={chainEdges}
        envPromotions={envPromotions}
        onSavePromotion={onSavePromotion}
        onRemovePromotion={onRemovePromotion}
        blocks={blocks}
        onUpsertBlock={onUpsertBlock}
        onRemoveConditionNode={onRemoveConditionNode}
        onRemoveStartBlock={onRemoveStartBlock}
        panelIds={panels.panelIds}
        onClosePanel={panels.closePanel}
        arrowPanel={panels.arrowPanel}
        onCloseArrowPanel={panels.closeArrowPanel}
        onUpsertEdge={onUpsertEdge}
        onDeleteEdge={onDeleteEdge}
        onRunSource={onRunNode}
        runState={runState}
      />

      <SubChainPicker
        open={pickerNodeId !== null}
        currentChainId={chainId}
        onClose={() => panels.setSubChainPickerNodeId(null)}
        onSelect={handleSubChainSelected}
      />
    </div>
  );
}
