import type { RequestModel, ResponseData } from "@/types";
import type {
  AssertionResult,
  ChainAssertion,
  ChainEdge,
  ChainNodeState,
  ChainRunState,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EnvPromotion,
  EvaluateBlock,
  StartBlock,
  ValidateBlock,
} from "@/types/chain";

/**
 * Kind of error that occurred during node execution.
 * Used to differentiate error messages and UI presentation.
 */
export type ErrorKind =
  | "extraction" // JSONPath extraction from upstream response failed
  | "injection" // Applying extracted value to request target field failed
  | "network" // HTTP request failed or network error
  | "assertion" // One or more assertions evaluated false
  | "subchain_depth_exceeded" // Sub-chain nesting exceeded MAX_SUBCHAIN_DEPTH
  | "generic"; // Other/unknown error

/**
 * Callback for notifying run state changes.
 */
export type OnUpdateFn = (
  nodeId: string,
  state: ChainNodeState,
  data: {
    response?: ResponseData;
    extractedValues?: Record<string, string | null>;
    error?: string;
    errorKind?: ErrorKind;
    assertionResults?: AssertionResult[];
    activeBranchId?: string;
    unresolvedVars?: string[];
    /** Set on loop-body iteration updates: the Loop step id this sub-step nests under. */
    parentStepId?: string;
    /** Set on loop-body iteration updates: the zero-based iteration index. */
    iteration?: number;
  },
) => void;

/**
 * Runtime options for chain execution.
 */
export type RunOptions = {
  signal: AbortSignal;
  nodeAssertions?: Record<string, ChainAssertion[]>;
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  envPromotions?: EnvPromotion[];
  onPromoteToEnv?: (envId: string, varName: string, value: string) => void;
  displayNodes?: DisplayBlock[];
  resolveVariables?: (text: string) => string;
  /** Run-time override values for the Start block's inputs, keyed by `ChainInput.key`. */
  startOverrides?: Record<string, string>;
  /**
   * Chain input values resolved by the Start block, keyed by `ChainInput.key`.
   * Mutated in place by the start executor as the run progresses so every
   * node executed after Start — via the same shared `options` object — sees
   * the resolved values without threading a separate parameter through.
   */
  chainInputs?: Record<string, string>;
  /**
   * Environment variables exposed to `evaluate` blocks as the sandbox's `env`
   * argument. Full wiring from the active environment happens in the Phase 6
   * runner-integration task; until then this defaults to `{}`.
   */
  envVars?: Record<string, string>;
  /**
   * Shared value-namespace tier 2 (spec, single definition): extracted-alias
   * values produced by edges, Display blocks, Evaluate `outputAlias`, and
   * Collect, keyed by user-facing alias. Mutated in place by executors as the
   * run progresses — mirroring `chainInputs` — so every node executed after
   * an extraction sees the alias via the same shared `options` object without
   * threading a separate parameter through. See `chainValueNamespace.ts`.
   */
  aliasValues?: Record<string, string>;
};

/**
 * Context passed to each node executor.
 */
export type ExecutionContext = {
  nodeId: string;
  request?: RequestModel;
  incomingEdges: ChainEdge[];
  runState: ChainRunState;
  requestMap: Map<string, RequestModel>;
  displayNodeMap: Map<string, DisplayBlock>;
  delayNodeMap: Map<string, DelayNodeConfig>;
  conditionNodeMap: Map<string, ConditionNodeConfig>;
  evaluateNodeMap?: Map<string, EvaluateBlock>;
  validateNodeMap?: Map<string, ValidateBlock>;
  startBlock?: StartBlock;
  onUpdate: OnUpdateFn;
  options: RunOptions;
};

/**
 * Executes a single node in the chain.
 * Returns true if execution completed (passed/failed),
 * false if the node was skipped due to upstream issues.
 */
export type NodeExecutor = (context: ExecutionContext) => Promise<boolean>;
