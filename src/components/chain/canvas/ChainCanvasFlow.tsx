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
import type {
  ChainNodeState,
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { ChainNode } from "../nodes/ChainNode";
import { CollectNode } from "../nodes/CollectNode";
import { ConditionNode } from "../nodes/ConditionNode";
import { DelayNode } from "../nodes/DelayNode";
import { DisplayNode } from "../nodes/DisplayNode";
import { EvaluateNode } from "../nodes/EvaluateNode";
import { LoopNode } from "../nodes/LoopNode";
import { MergeNode } from "../nodes/MergeNode";
import { StartNode } from "../nodes/StartNode";
import { SubChainNode } from "../nodes/SubChainNode";
import { ValidateNode } from "../nodes/ValidateNode";
import { AutoLayoutControl, type LayoutNode } from "./AutoLayoutControl";
import { BlockMenu } from "./BlockMenu";
import { DeletableEdge } from "./DeletableEdge";
import { GhostPlacementHandler } from "./GhostPlacementHandler";
import type { SyncSource } from "./hooks/useRunSelectionSync";
import { RunSelectionSyncBridge } from "./RunSelectionSyncBridge";
import { UndoRedoPanel } from "./UndoRedoPanel";

const NODE_TYPES = {
  chainNode: ChainNode,
  delayNode: DelayNode,
  conditionNode: ConditionNode,
  displayNode: DisplayNode,
  startNode: StartNode,
  evaluateNode: EvaluateNode,
  validateNode: ValidateNode,
  mergeNode: MergeNode,
  loopNode: LoopNode,
  collectNode: CollectNode,
  subchainNode: SubChainNode,
};

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
  onEnterGhostMode: (
    type:
      | "delay"
      | "condition"
      | "display"
      | "evaluate"
      | "validate"
      | "merge"
      | "loop"
      | "collect"
      | "subchain"
      | null,
  ) => void;
  hasStartNode: boolean;
  onAddStartClick: () => void;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  pendingNodeType:
    | "delay"
    | "condition"
    | "display"
    | "evaluate"
    | "validate"
    | "merge"
    | "loop"
    | "collect"
    | "subchain"
    | null;
  cursorPos: { x: number; y: number };
  onUpsertDelayNode: (node: DelayNodeConfig) => void;
  onUpsertConditionNode: (node: ConditionNodeConfig) => void;
  onUpsertDisplayNode: (node: DisplayBlock) => void;
  onUpsertEvaluateNode: (node: EvaluateBlock) => void;
  onUpsertValidateNode: (node: ValidateBlock) => void;
  onUpsertMergeNode: (node: MergeBlock) => void;
  onUpsertLoopNode: (node: LoopBlock) => void;
  onUpsertCollectNode: (node: CollectBlock) => void;
  onUpsertSubChainNode: (node: SubChainBlock) => void;
  onOpenConditionPanel: (nodeId: string) => void;
  onOpenEvaluatePanel: (nodeId: string) => void;
  onOpenValidatePanel: (nodeId: string) => void;
  onOpenMergePanel: (nodeId: string) => void;
  onOpenLoopPanel: (nodeId: string) => void;
  onOpenCollectPanel: (nodeId: string) => void;
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
  onUpsertDelayNode,
  onUpsertConditionNode,
  onUpsertDisplayNode,
  onUpsertEvaluateNode,
  onUpsertValidateNode,
  onUpsertMergeNode,
  onUpsertLoopNode,
  onUpsertCollectNode,
  onUpsertSubChainNode,
  onOpenConditionPanel,
  onOpenEvaluatePanel,
  onOpenValidatePanel,
  onOpenMergePanel,
  onOpenLoopPanel,
  onOpenCollectPanel,
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
      nodeTypes={NODE_TYPES}
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
      fitViewOptions={{ padding: 0.2 }}
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
          onAddEvaluateClick={() => onEnterGhostMode("evaluate")}
          onAddValidateClick={() => onEnterGhostMode("validate")}
          onAddMergeClick={() => onEnterGhostMode("merge")}
          onAddLoopClick={() => onEnterGhostMode("loop")}
          onAddCollectClick={() => onEnterGhostMode("collect")}
          onAddSubChainClick={() => onEnterGhostMode("subchain")}
        />
        <UndoRedoPanel chainId={chainId} />
        <AutoLayoutControl
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
        onUpsertDelayNode={onUpsertDelayNode}
        onUpsertConditionNode={onUpsertConditionNode}
        onUpsertDisplayNode={onUpsertDisplayNode}
        onUpsertEvaluateNode={onUpsertEvaluateNode}
        onUpsertValidateNode={onUpsertValidateNode}
        onUpsertMergeNode={onUpsertMergeNode}
        onUpsertLoopNode={onUpsertLoopNode}
        onUpsertCollectNode={onUpsertCollectNode}
        onUpsertSubChainNode={onUpsertSubChainNode}
        onUpdateNodePosition={onUpdateNodePosition}
        onOpenConditionPanel={onOpenConditionPanel}
        onOpenEvaluatePanel={onOpenEvaluatePanel}
        onOpenValidatePanel={onOpenValidatePanel}
        onOpenMergePanel={onOpenMergePanel}
        onOpenLoopPanel={onOpenLoopPanel}
        onOpenCollectPanel={onOpenCollectPanel}
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
