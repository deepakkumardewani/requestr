import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type NodeMouseHandler,
  Panel,
  ReactFlow,
  type ReactFlowProps,
  SelectionMode,
} from "@xyflow/react";
import {
  type Dispatch,
  type SetStateAction,
  useSyncExternalStore,
} from "react";
import { GRID_STEP } from "@/lib/chainConstants";
import type { RunStep } from "@/lib/chainRunHistory";
import { useUIStore } from "@/stores/useUIStore";
import type { ChainBlock, ChainNodeState } from "@/types/chain";
import { FLOW_NODE_TYPES, type GhostBlockType } from "../blockRegistry";
import { AutoLayoutControl, type LayoutNode } from "./AutoLayoutControl";
import { BlockMenu } from "./BlockMenu";
import { type CanvasFocusApi, CanvasFocusBridge } from "./CanvasFocusBridge";
import { ConnectionFeedback } from "./ConnectionFeedback";
import { DeletableEdge } from "./DeletableEdge";
import { GhostPlacementHandler } from "./GhostPlacementHandler";
import { FIT_VIEW_OPTIONS } from "./hooks/useAutoLayout";
import type { PanelOpeners } from "./hooks/useCanvasPanels";
import type { SyncSource } from "./hooks/useRunSelectionSync";
import { RunSelectionSyncBridge } from "./RunSelectionSyncBridge";
import { SnapToggle } from "./SnapToggle";
import { UndoRedoPanel } from "./UndoRedoPanel";
import type { AddBlockFn } from "./useAddBlock";

const EDGE_TYPES = {
  deletable: DeletableEdge,
};

const CYCLE_EDGE_COLOR = "#ef4444"; // red-500
const CYCLE_EDGE_STROKE_WIDTH = 2.5;

const MINIMAP_COLORS: Record<ChainNodeState, string> = {
  idle: "var(--viz-state-idle)",
  running: "var(--viz-state-running)",
  passed: "var(--viz-state-passed)",
  failed: "var(--viz-state-failed)",
  skipped: "var(--viz-state-skipped)",
  aborted: "var(--viz-state-failed)",
};

const MOUSE_PAN_BUTTONS = [1, 2]; // middle and right
const MULTI_SELECT_KEYS = ["Shift", "Meta", "Control"];
const SNAP_GRID: [number, number] = [GRID_STEP, GRID_STEP];
const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribeCoarsePointer(onChange: () => void) {
  const mql = window.matchMedia(COARSE_POINTER_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True on touch-primary devices, where drag must pan rather than box-select. */
function useCoarsePointer() {
  return useSyncExternalStore(
    subscribeCoarsePointer,
    () => window.matchMedia(COARSE_POINTER_QUERY).matches,
    () => false,
  );
}

function minimapNodeColor(node: Node) {
  const state = (node.data as { state?: ChainNodeState })?.state ?? "idle";
  return MINIMAP_COLORS[state];
}

type ChainCanvasFlowProps = {
  chainId: string;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReactFlowProps["onNodesChange"];
  onEdgesChange: ReactFlowProps["onEdgesChange"];
  onConnect: ReactFlowProps["onConnect"];
  isValidConnection?: ReactFlowProps["isValidConnection"];
  onNodeDragStart: (evt: React.MouseEvent, node: Node) => void;
  onNodeDragStop: (evt: React.MouseEvent, node: Node) => void;
  onNodeContextMenu: NodeMouseHandler;
  onSelectionContextMenu: NonNullable<ReactFlowProps["onSelectionContextMenu"]>;
  onNodeDoubleClick: NodeMouseHandler;
  onPaneClick: () => void;
  onEdgeClick?: ReactFlowProps["onEdgeClick"];
  isRunning: boolean;
  flowColorMode: "light" | "dark";
  onAddBlock: AddBlockFn;
  hasStartNode: boolean;
  onPaneContextMenu: ReactFlowProps["onPaneContextMenu"];
  onMoveStart?: ReactFlowProps["onMoveStart"];
  onMoveEnd?: ReactFlowProps["onMoveEnd"];
  onConnectEnd: ReactFlowProps["onConnectEnd"];
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  pendingNodeType: GhostBlockType | null;
  cursorPos: { x: number; y: number };
  onUpsertBlock: (block: ChainBlock) => void;
  panelOpeners: PanelOpeners;
  onOpenSubChainPicker: (nodeId: string) => void;
  onClearPending: () => void;
  cycleEdgeId?: string;
  runSteps?: RunStep[];
  selectedStepId?: string | null;
  syncSource?: SyncSource;
  onSelectStep?: (stepId: string | null, source?: SyncSource) => void;
  onCanvasNodeClickReady?: (fn: (nodeId: string) => void) => void;
  onCanvasFocusReady?: (api: CanvasFocusApi) => void;
};

/** The React Flow canvas itself: nodes, edges, background/controls/minimap, and the block/layout panel. */
export function ChainCanvasFlow({
  chainId,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onNodeDragStart,
  onNodeDragStop,
  onNodeContextMenu,
  onSelectionContextMenu,
  onNodeDoubleClick,
  onPaneClick,
  onEdgeClick,
  isRunning,
  flowColorMode,
  onAddBlock,
  hasStartNode,
  onPaneContextMenu,
  onMoveStart,
  onMoveEnd,
  onConnectEnd,
  onUpdateNodePosition,
  setNodes,
  pendingNodeType,
  cursorPos,
  onUpsertBlock,
  panelOpeners,
  onOpenSubChainPicker,
  onClearPending,
  cycleEdgeId,
  runSteps,
  selectedStepId = null,
  syncSource = null,
  onSelectStep,
  onCanvasNodeClickReady,
  onCanvasFocusReady,
}: ChainCanvasFlowProps) {
  const snapToGrid = useUIStore((s) => s.snapToGrid);
  const isCoarsePointer = useCoarsePointer();
  // Highlight the cycle edge in red
  const highlightedEdges = edges.map((edge) =>
    edge.id === cycleEdgeId
      ? {
          ...edge,
          style: {
            ...edge.style,
            stroke: CYCLE_EDGE_COLOR,
            strokeWidth: CYCLE_EDGE_STROKE_WIDTH,
          },
        }
      : edge,
  );
  return (
    <ReactFlow
      className="chain-canvas-react-flow"
      nodes={nodes}
      edges={highlightedEdges}
      nodeTypes={FLOW_NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onNodeContextMenu={onNodeContextMenu}
      onSelectionContextMenu={onSelectionContextMenu}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      onPaneContextMenu={onPaneContextMenu}
      onMoveStart={onMoveStart}
      onMoveEnd={onMoveEnd}
      // Mouse: left-drag marquee-selects, middle/right-drag pans. Touch keeps
      // one-finger pan since a selection box needs a second pointer.
      selectionOnDrag={!isCoarsePointer}
      panOnDrag={isCoarsePointer ? true : MOUSE_PAN_BUTTONS}
      selectionMode={SelectionMode.Partial}
      multiSelectionKeyCode={MULTI_SELECT_KEYS}
      snapToGrid={snapToGrid}
      snapGrid={SNAP_GRID}
      onConnectEnd={onConnectEnd}
      onEdgeClick={onEdgeClick}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      deleteKeyCode={["Backspace", "Delete"]}
      proOptions={{ hideAttribution: true }}
      colorMode={flowColorMode}
    >
      <Background
        color="var(--chain-canvas-dots-color)"
        gap={24}
        variant={BackgroundVariant.Dots}
      />
      <Controls
        className="!bg-card !border-border !rounded-lg"
        showInteractive={!isRunning}
      >
        <SnapToggle />
      </Controls>
      <ConnectionFeedback />
      {/* An empty minimap is just a blank box that crowds the empty-state overlay. */}
      {nodes.length > 0 && (
        <MiniMap
          nodeColor={minimapNodeColor}
          className="!bg-card !border-border !rounded-lg"
          maskColor="var(--chain-minimap-mask-bg)"
        />
      )}

      <Panel position="top-left" className="m-3 flex gap-2">
        <BlockMenu
          disabled={isRunning}
          hasStartNode={hasStartNode}
          onAddBlock={onAddBlock}
        />
        <UndoRedoPanel chainId={chainId} />
        <AutoLayoutControl
          chainId={chainId}
          nodes={nodes}
          edges={edges}
          disabled={isRunning}
          onUpdateNodePosition={onUpdateNodePosition}
          setNodes={
            setNodes as React.Dispatch<React.SetStateAction<LayoutNode[]>>
          }
        />
      </Panel>

      <GhostPlacementHandler
        pendingNodeType={pendingNodeType}
        cursorPos={cursorPos}
        onUpsertDelayNode={onUpsertBlock}
        onUpsertConditionNode={onUpsertBlock}
        onUpsertDisplayNode={onUpsertBlock}
        onUpsertEvaluateNode={onUpsertBlock}
        onUpsertValidateNode={onUpsertBlock}
        onUpsertMergeNode={onUpsertBlock}
        onUpsertLoopNode={onUpsertBlock}
        onUpsertCollectNode={onUpsertBlock}
        onUpsertSubChainNode={onUpsertBlock}
        onUpdateNodePosition={onUpdateNodePosition}
        onOpenConditionPanel={panelOpeners.condition}
        onOpenEvaluatePanel={panelOpeners.evaluate}
        onOpenValidatePanel={panelOpeners.validate}
        onOpenMergePanel={panelOpeners.merge}
        onOpenLoopPanel={panelOpeners.loop}
        onOpenCollectPanel={panelOpeners.collect}
        onOpenSubChainPicker={onOpenSubChainPicker}
        onClearPending={onClearPending}
      />

      {onCanvasFocusReady && (
        <CanvasFocusBridge onCanvasFocusReady={onCanvasFocusReady} />
      )}

      {onSelectStep && onCanvasNodeClickReady && (
        <RunSelectionSyncBridge
          steps={runSteps ?? []}
          selectedStepId={selectedStepId}
          syncSource={syncSource}
          selectStep={onSelectStep}
          onCanvasNodeClickReady={onCanvasNodeClickReady}
        />
      )}
    </ReactFlow>
  );
}
