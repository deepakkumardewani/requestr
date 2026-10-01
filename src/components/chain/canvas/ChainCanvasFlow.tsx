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
} from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import type { RunStep } from "@/lib/chainRunHistory";
import type { ChainBlock, ChainNodeState } from "@/types/chain";
import { FLOW_NODE_TYPES, type GhostBlockType } from "../blockRegistry";
import { AutoLayoutControl, type LayoutNode } from "./AutoLayoutControl";
import { BlockMenu } from "./BlockMenu";
import { DeletableEdge } from "./DeletableEdge";
import { GhostPlacementHandler } from "./GhostPlacementHandler";
import { FIT_VIEW_OPTIONS } from "./hooks/useAutoLayout";
import type { PanelOpeners } from "./hooks/useCanvasPanels";
import type { SyncSource } from "./hooks/useRunSelectionSync";
import { RunSelectionSyncBridge } from "./RunSelectionSyncBridge";
import { UndoRedoPanel } from "./UndoRedoPanel";

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
  onNodeDoubleClick: NodeMouseHandler;
  onPaneClick: () => void;
  onEdgeClick?: ReactFlowProps["onEdgeClick"];
  isRunning: boolean;
  flowColorMode: "light" | "dark";
  onAddApiClick: () => void;
  onEnterGhostMode: (type: GhostBlockType | null) => void;
  hasStartNode: boolean;
  onAddStartClick: () => void;
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
  onNodeDoubleClick,
  onPaneClick,
  onEdgeClick,
  isRunning,
  flowColorMode,
  onAddApiClick,
  onEnterGhostMode,
  hasStartNode,
  onAddStartClick,
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
}: ChainCanvasFlowProps) {
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
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
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
      />
      <MiniMap
        nodeColor={minimapNodeColor}
        className="!bg-card !border-border !rounded-lg"
        maskColor="var(--chain-minimap-mask-bg)"
      />

      <Panel position="top-left" className="m-3 flex gap-2">
        <BlockMenu
          disabled={isRunning}
          hasStartNode={hasStartNode}
          onAddApiClick={onAddApiClick}
          onEnterGhostMode={onEnterGhostMode}
          onAddStartClick={onAddStartClick}
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
