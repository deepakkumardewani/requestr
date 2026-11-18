import type {
  SerialisedRequest,
  StepInputs,
  StepWarning,
} from "@/lib/chainRunHistory";
import type { RequestModel, ResponseData } from "@/types";
import type {
  AssertionResult,
  ChainAssertion,
  ChainEdge,
  ChainNodeState,
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
import type { ChainErrorCode, ChainErrorParams } from "./errorCodes";
import type { ReferencedChainGraph } from "./executors/subchain";

/**
 * Kind of error that occurred during node execution.
 * Used to differentiate error messages and UI presentation.
 */
export const ERROR_KINDS = [
  "extraction", // JSONPath extraction from upstream response failed
  "injection", // Applying extracted value to request target field failed
  "network", // HTTP request failed or network error
  "assertion", // One or more assertions evaluated false
  "subchain_depth_exceeded", // Sub-chain nesting exceeded MAX_SUBCHAIN_DEPTH
  "loop_depth_exceeded", // Loop nesting exceeded MAX_LOOP_NESTING_DEPTH
  "generic", // Other/unknown error
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** Named access to the error kinds so call sites never spell the string. */
export const ERROR_KIND = {
  EXTRACTION: "extraction",
  GENERIC: "generic",
} as const satisfies Record<string, ErrorKind>;

/**
 * One level of nesting an update passed through on its way out of a nested
 * `runChain` (a Loop iteration or a Sub-chain call). Frames accumulate
 * innermost-first, so `scope[0]` is the update's immediate parent.
 */
export type ScopeFrame = {
  /** Raw node id of the Loop / Sub-chain block that ran the nested chain. */
  parentStepId: string;
  /** Zero-based iteration index; Loop frames only. */
  iteration?: number;
};

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
    /** Typed code the UI translates; `error` is its English fallback. */
    errorCode?: ChainErrorCode;
    errorParams?: ChainErrorParams;
    errorKind?: ErrorKind;
    assertionResults?: AssertionResult[];
    /** The assertion definitions `assertionResults` were evaluated against. */
    assertions?: ChainAssertion[];
    activeBranchId?: string;
    unresolvedVars?: string[];
    /** The request as actually sent: variables resolved and extracted values injected. */
    request?: SerialisedRequest;
    /** Per-block-type inputs the block evaluated (see `StepInputs`). */
    inputs?: StepInputs;
    /** Non-fatal conditions raised while the block ran (e.g. an alias overwritten). */
    warnings?: StepWarning[];
    /** Set on loop-body iteration updates: the Loop step id this sub-step nests under. */
    parentStepId?: string;
    /** Set on loop-body iteration updates: the zero-based iteration index. */
    iteration?: number;
    /** Every enclosing Loop / Sub-chain frame, innermost first; makes step ids unique under nesting. */
    scope?: ScopeFrame[];
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
   * Active environment variables, supplied by `useChainRun`. Exposed to
   * `evaluate` blocks as the sandbox's `env` argument and read by Start
   * `source: "env"` inputs.
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
/**
 * Upper bound on nested scheduler invocations (e.g. a chain-of-chains style
 * embed) to prevent runaway recursion. Lives here (not in `chainRunner.ts`)
 * so executors can read it without importing the runner.
 */
export const MAX_SCHEDULER_DEPTH = 8;

/** Signature of `runChain`; executors receive it by injection so they never import the runner (which imports them). */
export type RunChainFn = (opts: RunChainOptions) => Promise<void>;

export type NodeExecutor = (context: ExecutionContext) => Promise<boolean>;

/**
 * Everything `runChain` needs. Replaces the former 23 positional parameters so
 * call sites name what they pass and new block types add a field, not an
 * argument slot every caller must fill with `undefined`.
 */
export type RunChainOptions = {
  requests: RequestModel[];
  edges: ChainEdge[];
  onUpdate: OnUpdateFn;
  signal: AbortSignal;
  nodeAssertions?: Record<string, ChainAssertion[]>;
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  displayNodes?: DisplayBlock[];
  evaluateNodes?: EvaluateBlock[];
  validateNodes?: ValidateBlock[];
  mergeNodes?: MergeBlock[];
  loopNodes?: LoopBlock[];
  collectNodes?: CollectBlock[];
  subChainBlocks?: SubChainBlock[];
  startBlock?: StartBlock;
  /** Run-time override values for the Start block's inputs, keyed by `ChainInput.key`. */
  startOverrides?: Record<string, string>;
  envPromotions?: EnvPromotion[];
  onPromoteToEnv?: (envId: string, varName: string, value: string) => void;
  resolveVariables?: (text: string) => string;
  envVars?: Record<string, string>;
  /** Nodes dispatched in parallel; defaults to `DEFAULT_CONCURRENCY`. */
  concurrency?: number;
  /** Nesting level of this scheduler run (0 = top level); guards runaway recursion. */
  schedulerDepth?: number;
  /** How many Loop bodies enclose this run within its own graph (0 = none); bounds Loop nesting. */
  loopDepth?: number;
  /** Resolves a `SubChainBlock.chainId` into the referenced chain's execution graph. Undefined when the reference cannot be resolved (e.g. it was deleted) — the node fails rather than throwing. */
  resolveSubChainGraph?: (chainId: string) => ReferencedChainGraph | undefined;
};
