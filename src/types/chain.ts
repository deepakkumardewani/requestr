import type { ErrorKind } from "@/lib/chainRunner/types";
import type {
  AuthConfig,
  BodyConfig,
  HttpMethod,
  KVPair,
  ResponseData,
} from "@/types";

/** Single source of truth for node/block type discriminators — do not add new string literals elsewhere. */
export const CHAIN_NODE_TYPES = [
  "api",
  "delay",
  "condition",
  "display",
  "start",
  "evaluate",
  "validate",
  "merge",
  "loop",
  "collect",
  "subchain",
] as const;

export type ChainNodeType = (typeof CHAIN_NODE_TYPES)[number];

export type DelayNodeConfig = {
  id: string;
  type: "delay";
  delayMs: number; // e.g. 2000
};

export type ConditionBranch = {
  id: string;
  label: string; // e.g. "admin", "else"
  expression: string; // e.g. "== 'admin'", empty string for else branch
};

export type ConditionNodeConfig = {
  id: string;
  type: "condition";
  variable: string; // e.g. "{{role}}"
  branches: ConditionBranch[];
};

export type DisplayBlock = {
  id: string;
  type: "display";
  sourceJsonPath: string; // e.g. "$.data.token"
  targetField: "url" | "path" | "header" | "body";
  targetKey: string; // header name, URL param, or body JSONPath
  targetUrl?: string; // optional URL override for path injections
};

/** Where a chain input's effective value comes from when no override is supplied. */
export type ChainInputSource = "literal" | "env";

/** A single named input a chain accepts from its Start block. */
export type ChainInput = {
  key: string;
  defaultValue: string;
  source: ChainInputSource;
  /** Set only when `source === "env"` — the environment variable to read the default from. */
  envVarKey?: string;
};

export type StartBlock = {
  id: string;
  type: "start";
  inputs: ChainInput[];
};

export type ChainInjection = {
  sourceJsonPath: string; // e.g. "$.data.token"
  targetField: "url" | "path" | "header" | "body";
  targetKey: string; // header name, URL param name, or body JSONPath
};

/** Branch IDs with special semantics recognized by the runner (e.g. condition "else"). */
export const RESERVED_BRANCH_IDS = ["else"] as const;

export type ReservedBranchId = (typeof RESERVED_BRANCH_IDS)[number];

export type ChainEdge = {
  id: string;
  sourceRequestId: string;
  targetRequestId: string;
  /** Shared URL template for path injections — contains :paramName placeholders. */
  targetUrl?: string;
  /** One or more extraction→injection mappings for this dependency. */
  injections: ChainInjection[];
  /** Set on edges originating from a condition node — identifies the branch handle. */
  branchId?: ReservedBranchId | (string & {});
};

/** Coerce a legacy flat-shaped edge (pre-injections array) to the current shape. */
export function migrateEdge(
  raw: Omit<ChainEdge, "injections"> & {
    sourceJsonPath?: string;
    targetField?: string;
    targetKey?: string;
    injections?: ChainInjection[];
  },
): ChainEdge {
  if (raw.injections?.length) return raw as ChainEdge;
  return {
    id: raw.id,
    sourceRequestId: raw.sourceRequestId,
    targetRequestId: raw.targetRequestId,
    targetUrl: raw.targetUrl,
    branchId: raw.branchId,
    injections: [
      {
        sourceJsonPath: raw.sourceJsonPath ?? "$.value",
        targetField: (raw.targetField ??
          "header") as ChainInjection["targetField"],
        targetKey: raw.targetKey ?? "value",
      },
    ],
  };
}

/** Snapshot of a history-sourced node — not tied to any saved collection request. */
export type ChainHistoryNode = {
  id: string; // stable node ID within the chain
  historyEntryId: string; // original history entry ID (informational; snapshot is authoritative)
  name: string; // derived from URL path last segment
  method: HttpMethod;
  url: string;
  params: KVPair[];
  headers: KVPair[];
  auth: AuthConfig;
  body: BodyConfig;
};

export type AssertionOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "lt"
  | "exists"
  | "not_exists"
  | "matches_regex";

export const ASSERTION_OPERATOR_LABELS: Record<AssertionOperator, string> = {
  eq: "equals",
  neq: "not equals",
  contains: "contains",
  not_contains: "not contains",
  gt: "greater than",
  lt: "less than",
  exists: "exists",
  not_exists: "not exists",
  matches_regex: "matches regex",
};

export type ChainAssertion = {
  id: string;
  source: "status" | "jsonpath" | "header" | "schema";
  sourcePath?: string; // JSONPath expression or header name
  operator: AssertionOperator;
  expectedValue?: string; // not required for exists/not_exists
  enabled: boolean;
  /** JSON-Schema document (as a string) used when `source` is `"schema"`. */
  schema?: string;
};

export type AssertionResult = {
  assertionId: string;
  passed: boolean;
  actual: string | null;
};

export type EnvPromotion = {
  edgeId: string; // which edge's extracted value to promote
  envId: string; // target environment id
  envVarName: string; // key to write into the environment
};

/** Chain schema version this codebase writes/reads. */
export const CHAIN_SCHEMA_VERSION = 5;

export type ChainScope = "collection" | "standalone";

export type HistoryBlock = ChainHistoryNode & { type: "history" };
export type DelayBlock = DelayNodeConfig;
export type ConditionBlock = ConditionNodeConfig;

/** Runs arbitrary JS in a sandboxed worker and stores its return value under `outputAlias`. */
export type EvaluateBlock = {
  id: string;
  type: "evaluate";
  code: string;
  outputAlias: string; // key the evaluated result is exposed under for downstream nodes
};

/** Validates a JSON value (extracted via `sourceJsonPath`) against a JSON-Schema-like `schema`. */
export type ValidateBlock = {
  id: string;
  type: "validate";
  schema: string; // JSON-Schema document, stored as a JSON string
  sourceJsonPath: string; // e.g. "$.data.token"
};

/** Joins multiple upstream branches back into a single execution path before continuing. */
export type MergeBlock = {
  id: string;
  type: "merge";
  /** "all" waits for every upstream branch to complete; "any" continues once one completes. */
  mode: "any" | "all";
};

/** Default `LoopBlock.maxIterations` applied when a new Loop block is created. */
export const LOOP_MAX_ITERATIONS_DEFAULT = 100;
/** Upper bound a `LoopBlock.maxIterations` may be configured to. */
export const LOOP_MAX_ITERATIONS_CAP = 1000;

/**
 * Iterates over an array (extracted via `sourceJsonPath` from an upstream
 * response) executing its body subgraph once per item, sequentially,
 * exposing `{{itemAlias}}` and `{{index}}` to each iteration.
 */
export type LoopBlock = {
  id: string;
  type: "loop";
  sourceJsonPath: string; // e.g. "$.data.items"
  itemAlias: string; // variable name each iteration's item is exposed under
  maxIterations: number; // clamped to [1, LOOP_MAX_ITERATIONS_CAP]
};

/** Gathers a bound `LoopBlock`'s per-iteration terminal outputs into an array. */
export type CollectBlock = {
  id: string;
  type: "collect";
  loopId: string; // id of the LoopBlock this Collect is paired with
};

/** References another chain, running it inline with its own inputs bound from this chain. */
export type SubChainBlock = {
  id: string;
  type: "subchain";
  chainId: string; // id of the referenced Chain
  inputBindings: Record<string, string>; // ChainInput.key -> literal value or upstream alias
};

/** Union of every block kind a `Chain` can contain. Every member owns `id` and `type`. */
export type ChainBlock =
  | HistoryBlock
  | DelayBlock
  | ConditionBlock
  | DisplayBlock
  | StartBlock
  | EvaluateBlock
  | ValidateBlock
  | MergeBlock
  | LoopBlock
  | CollectBlock
  | SubChainBlock;

/** Unified chain record — replaces `ChainConfig` (collection) and `StandaloneChain` (standalone). */
export type Chain = {
  id: string;
  scope: ChainScope;
  schemaVersion: typeof CHAIN_SCHEMA_VERSION;
  /** Set only when `scope === "collection"`. */
  collectionId?: string;
  name: string;
  createdAt?: number;
  blocks: ChainBlock[];
  /** Explicit list of collection request IDs in this chain. */
  nodeIds: string[];
  edges: ChainEdge[];
  nodePositions: Record<string, { x: number; y: number }>;
  nodeAssertions?: Record<string, ChainAssertion[]>;
  envPromotions?: EnvPromotion[];
  /** Last-used override values for the Start block's inputs, keyed by `ChainInput.key`. */
  inputs?: Record<string, string>;
};

export type ChainNodeState =
  | "idle"
  | "running"
  | "passed"
  | "failed"
  | "skipped"
  | "aborted";

export type ChainRunState = Record<
  string,
  {
    state: ChainNodeState;
    extractedValues: Record<string, string | null>;
    response?: ResponseData;
    error?: string;
    errorKind?: ErrorKind;
    assertionResults?: AssertionResult[];
    /** For condition nodes: the winning branch ID after evaluation. */
    activeBranchId?: string;
    /** Unresolved environment variables still present after resolution. */
    unresolvedVars?: string[];
  }
>;
