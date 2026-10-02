"use client";

import "@xyflow/react/dist/style.css";
import type { EdgeMouseHandler } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { groupBlocks } from "@/lib/chainRunner/runGraph";
import { useChainStore } from "@/stores/useChainStore";
import { SubChainPicker } from "../dialogs/SubChainPicker";
import { AnchoredBlockMenu } from "./BlockMenu";
import { CanvasBanner } from "./CanvasBanner";
import { CanvasEmptyState } from "./CanvasEmptyState";
import type { ChainCanvasProps } from "./ChainCanvas.types";
import { ChainCanvasFlow } from "./ChainCanvasFlow";
import { ChainCanvasPanels } from "./ChainCanvasPanels";
import { FindNodeDialog } from "./FindNodeDialog";
import { GhostNode } from "./GhostNode";
import { useAlignSelection } from "./hooks/useAlignSelection";
import { useCanvasCommands } from "./hooks/useCanvasCommands";
import { useCanvasFocusWithin } from "./hooks/useCanvasFocusWithin";
import { useCanvasKeyboardNav } from "./hooks/useCanvasKeyboardNav";
import { useCanvasPanels } from "./hooks/useCanvasPanels";
import { useCanvasSelection } from "./hooks/useCanvasSelection";
import { useChainConnect } from "./hooks/useChainConnect";
import { useChainEdges } from "./hooks/useChainEdges";
import { useChainNodes } from "./hooks/useChainNodes";
import { useConnectEnd } from "./hooks/useConnectEnd";
import { useFlowHandlers } from "./hooks/useFlowHandlers";
import { useGhostPlacement } from "./hooks/useGhostPlacement";
import { useNodeInteractions } from "./hooks/useNodeInteractions";
import { usePaneMenu } from "./hooks/usePaneMenu";
import { useAddBlock } from "./useAddBlock";

/** Provides the React Flow context so shortcut handlers (fit view, auto-layout) can use `useReactFlow` outside the `<ReactFlow>` tree. */
const subscribeNoop = () => () => {};

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
  onCanvasFocusReady,
}: ChainCanvasProps) {
  const t = useTranslations("chain");
  const { resolvedTheme } = useTheme();
  const {
    wrapperRef,
    focused: canvasFocused,
    focusProps,
  } = useCanvasFocusWithin();
  // Without this guard the empty overlay flashes while the chain is still loading.
  const chainsHydrated = useChainStore((s) => s.hydrated);
  // The server cannot know the resolved theme; reading it before hydration
  // finishes would mismatch the server markup (the canvas now mounts at 0 nodes too).
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const flowColorMode = isClient && resolvedTheme === "dark" ? "dark" : "light";

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

  const addBlock = useAddBlock({
    chainId,
    hasStartBlock: Boolean(startBlock),
    onOpenApiPicker: onAddApiClick,
    onEnterGhostMode: ghost.setPendingNodeType,
    panelOpeners: openers,
    onOpenSubChainPicker: panels.setSubChainPickerNodeId,
  });
  const paneMenu = usePaneMenu({ disabled: isRunning });
  const onConnectEnd = useConnectEnd({
    chainEdges,
    disabled: isRunning,
    openMenu: paneMenu.openMenu,
  });
  const { closeMenu } = paneMenu;
  const handlePaneMenuClose = useCallback(() => {
    closeMenu();
    wrapperRef.current?.focus();
  }, [closeMenu, wrapperRef]);

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
  const arrange = useAlignSelection({ chainId, nodes, setNodes });

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

  const { duplicateBlock, nudge, findNode } = useCanvasCommands({
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
    onNudge: nudge,
  });

  // Selecting from Find leaves exactly that node selected and keyboard-focused.
  const { setKeyboardFocusNodeId } = selection;
  const handleFindSelect = useCallback(
    (nodeId: string) => {
      setNodes((prev) =>
        prev.map((node) => ({ ...node, selected: node.id === nodeId })),
      );
      setKeyboardFocusNodeId(nodeId);
    },
    [setNodes, setKeyboardFocusNodeId],
  );

  // Start is the only node: nothing runnable yet, so hint instead of the full overlay.
  const isStartOnly = Boolean(startBlock) && nodes.length === 1;

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

      {chainsHydrated && nodes.length === 0 && (
        <CanvasEmptyState
          onAddApi={() => onAddApiClick()}
          onAddBlock={addBlock}
        />
      )}

      {chainsHydrated && isStartOnly && (
        // Bottom-centered pill: a full-width top strip would cover the toolbar the user needs next.
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <div className="max-w-xl overflow-hidden rounded-lg border border-border shadow-sm [&>*]:border-b-0">
            <CanvasBanner type="start-only" />
          </div>
        </div>
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
        onSelectionContextMenu={interactions.onSelectionContextMenu}
        onNodeDoubleClick={interactions.onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        isRunning={isRunning}
        flowColorMode={flowColorMode}
        onAddBlock={addBlock}
        hasStartNode={Boolean(startBlock)}
        onPaneContextMenu={paneMenu.onPaneContextMenu}
        onMoveStart={paneMenu.onMoveStart}
        onMoveEnd={paneMenu.onMoveEnd}
        onConnectEnd={onConnectEnd}
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
        onCanvasFocusReady={onCanvasFocusReady}
        onCanvasNodeClickReady={selection.registerCanvasNodeClick}
      />

      {paneMenu.menu && (
        <AnchoredBlockMenu
          anchor={paneMenu.menu.anchor}
          position={paneMenu.menu.position}
          connectFrom={paneMenu.menu.connectFrom}
          hasStartNode={Boolean(startBlock)}
          hideWithoutTargetHandle={Boolean(paneMenu.menu.connectFrom)}
          onAddBlock={addBlock}
          onClose={handlePaneMenuClose}
        />
      )}

      <FindNodeDialog
        open={findNode.open}
        onOpenChange={findNode.onOpenChange}
        nodes={nodes}
        onSelectNode={handleFindSelect}
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
        selectedCount={arrange.selectedCount}
        onAlign={arrange.align}
        onDistribute={arrange.distribute}
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
