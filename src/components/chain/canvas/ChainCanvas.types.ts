import type { SyncSource } from "@/components/chain/canvas/hooks/useRunSelectionSync";
import type { RunStep } from "@/lib/chainRunHistory";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainBlock,
  ChainEdge,
  ChainNodeType,
  ChainRunState,
  EnvPromotion,
} from "@/types/chain";

export type ContextMenuState = {
  x: number;
  y: number;
  nodeId: string;
  nodeType: ChainNodeType;
};

export type ChainCanvasProps = {
  chainId: string;
  requests: RequestModel[];
  edges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  nodeAssertions: Record<string, ChainAssertion[]>;
  runState: ChainRunState;
  isRunning: boolean;
  /** Every block of the chain; per-type views are derived from it via the block registry. */
  blocks: ChainBlock[];
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
  /** ⌘/Ctrl+Enter. Omit while running is not allowed (cycle, invalid Merge, already running) — same rule as the Run button. */
  onRunChain?: () => void;
  /** ⌘/Ctrl+. — omit when nothing is running. */
  onStopChain?: () => void;
  onRunUpTo: (requestId: string) => void;
  onRunFromHere: (requestId: string) => void;
  onAddAfterNode: (requestId: string) => void;
  /** Inserts or replaces any block (Start, Delay, Condition, Display, Evaluate, ...). */
  onUpsertBlock: (block: ChainBlock) => void;
  onRemoveConditionNode: (nodeId: string) => void;
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
