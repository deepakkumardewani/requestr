import type { SyncSource } from "@/components/chain/canvas/hooks/useRunSelectionSync";
import type { RunStep } from "@/lib/chainRunHistory";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  ChainRunState,
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EnvPromotion,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";

export type ContextMenuState = {
  x: number;
  y: number;
  nodeId: string;
  nodeType:
    | "api"
    | "delay"
    | "condition"
    | "display"
    | "evaluate"
    | "validate"
    | "merge"
    | "loop"
    | "collect"
    | "subchain";
};

export type ChainCanvasProps = {
  chainId: string;
  requests: RequestModel[];
  edges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  nodeAssertions: Record<string, ChainAssertion[]>;
  runState: ChainRunState;
  isRunning: boolean;
  delayNodes: DelayNodeConfig[];
  conditionNodes: ConditionNodeConfig[];
  cycleNodeIds?: string[];
  cycleEdgeId?: string;
  onAddApiClick: () => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode?: (requestId: string) => void;
  onUpsertEdge: (edge: ChainEdge) => void;
  onDeleteEdge: (edgeId: string) => void;
  onUpdateNodePosition: (nodeId: string, pos: { x: number; y: number }) => void;
  onUpsertNodeAssertions: (
    requestId: string,
    assertions: ChainAssertion[],
  ) => void;
  onRunNode?: (nodeId: string) => void;
  onRunUpTo: (requestId: string) => void;
  onRunFromHere: (requestId: string) => void;
  onAddAfterNode: (requestId: string) => void;
  onUpsertDelayNode: (node: DelayNodeConfig) => void;
  onUpsertConditionNode: (node: ConditionNodeConfig) => void;
  onRemoveConditionNode: (nodeId: string) => void;
  displayNodes: DisplayBlock[];
  onUpsertDisplayNode: (node: DisplayBlock) => void;
  evaluateNodes: EvaluateBlock[];
  onUpsertEvaluateNode: (node: EvaluateBlock) => void;
  validateNodes: ValidateBlock[];
  onUpsertValidateNode: (node: ValidateBlock) => void;
  mergeNodes: MergeBlock[];
  onUpsertMergeNode: (node: MergeBlock) => void;
  loopNodes: LoopBlock[];
  onUpsertLoopNode: (node: LoopBlock) => void;
  collectNodes: CollectBlock[];
  onUpsertCollectNode: (node: CollectBlock) => void;
  subChainNodes: SubChainBlock[];
  onUpsertSubChainNode: (node: SubChainBlock) => void;
  startBlock: StartBlock | null;
  onUpsertStartBlock: (node: StartBlock) => void;
  onRemoveStartBlock: (nodeId: string) => void;
  envPromotions?: EnvPromotion[];
  onSavePromotion?: (promotion: EnvPromotion) => void;
  onRemovePromotion?: (edgeId: string) => void;
  onSaveRequest: (id: string, patch: Partial<RequestModel>) => void;
  resolveVariables: (text: string) => string;
  /** Steps of the currently selected run — drives run-log <-> canvas selection sync. */
  runSteps?: RunStep[];
  /** Currently selected run-log step id. */
  selectedStepId?: string | null;
  /** Which side last drove the selection — guards against re-triggering the other side. */
  syncSource?: SyncSource;
  /** Selects a run-log step, tagging which side drove the selection. */
  onSelectStep?: (stepId: string | null, source?: SyncSource) => void;
};
