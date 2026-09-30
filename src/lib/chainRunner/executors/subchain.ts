import { resolveInNamespace } from "@/lib/chainValueNamespace";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  ChainRunState,
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { runChain } from "../../chainRunner";
import type { ErrorKind, OnUpdateFn, RunOptions } from "../types";

/** Upper bound on sub-chain nesting depth (distinct from `MAX_SCHEDULER_DEPTH`, which also bounds Loop nesting). */
export const MAX_SUBCHAIN_DEPTH = 5;

/** Error message recorded when a sub-chain call would nest past `MAX_SUBCHAIN_DEPTH`. */
export const SUBCHAIN_DEPTH_EXCEEDED_ERROR =
  "Sub-chain nesting exceeded the maximum depth";

/** `ErrorKind` recorded on `SUBCHAIN_DEPTH_EXCEEDED_ERROR`. */
export const SUBCHAIN_DEPTH_EXCEEDED_KIND: ErrorKind =
  "subchain_depth_exceeded";

/** Key `sub.<subChainBlock.id>.<alias>`'s value is exposed under downstream. */
export function subValueKey(subChainBlockId: string, alias: string): string {
  return `sub.${subChainBlockId}.${alias}`;
}

/**
 * Graph of the referenced chain — mirrors `runChain`'s own parameter shape
 * so it can be forwarded straight through to a nested `runChain` call.
 */
export type ReferencedChainGraph = {
  requests: RequestModel[];
  edges: ChainEdge[];
  nodeAssertions?: Record<string, ChainAssertion[]>;
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  displayNodes?: DisplayBlock[];
  evaluateNodes?: EvaluateBlock[];
  validateNodes?: ValidateBlock[];
  mergeNodes?: MergeBlock[];
  loopNodes?: LoopBlock[];
  collectNodes?: CollectBlock[];
  startBlock?: StartBlock;
};

export type SubchainExecutorContext = {
  nodeId: string; // the SubChain block's own id
  subChainBlock: SubChainBlock;
  chain: ReferencedChainGraph;
  incomingEdges: ChainEdge[];
  runState: ChainRunState;
  onUpdate: OnUpdateFn;
  options: RunOptions;
  schedulerDepth?: number;
};

/**
 * Resolves a `SubChainBlock`'s `inputBindings` into the referenced chain's
 * Start-block overrides. Each binding is template text resolved through the
 * shared value namespace (spec, `chainValueNamespace.ts`): chain inputs →
 * extracted aliases → environment, so a binding can reference a chain
 * input, any alias already in `options.aliasValues` (including non-adjacent
 * ones set earlier in the run, not just an incoming edge's), or an env
 * variable — not only values produced by this SubChain node's own incoming
 * edges.
 */
function resolveInputBindings(
  bindings: Record<string, string>,
  options: RunOptions,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, binding] of Object.entries(bindings)) {
    resolved[key] = resolveInNamespace(binding, {
      chainInputs: options.chainInputs,
      aliasValues: options.aliasValues,
      resolveVariables: options.resolveVariables,
    });
  }
  return resolved;
}

/** IDs of body requests with no outgoing edge within the referenced chain — their outputs become `sub.<id>.<alias>`. */
function terminalRequestIds(chain: ReferencedChainGraph): string[] {
  const hasOutgoing = new Set(chain.edges.map((e) => e.sourceRequestId));
  return chain.requests.map((r) => r.id).filter((id) => !hasOutgoing.has(id));
}

/**
 * Execute a `subchain` node: runs the referenced chain via a nested
 * `runChain` call, one depth level deeper than the calling scheduler,
 * bounded by `MAX_SUBCHAIN_DEPTH`. Every step of the nested run is
 * re-tagged with `parentStepId` (this SubChain step's own id) so the run
 * log can nest them (P9.8). The referenced chain's Start-block inputs are
 * bound via `inputBindings` (literal values or `{{upstreamAlias}}`
 * references). Terminal request outputs are exposed under the reserved
 * `sub.<id>.<alias>` namespace — both in `extractedValues` and as a
 * synthetic `response.body` JSON object so a downstream extraction edge
 * can JSONPath into `$.<alias>` exactly like any other upstream response.
 */
export async function subchainExecutor(
  context: SubchainExecutorContext,
): Promise<boolean> {
  const {
    nodeId,
    subChainBlock,
    chain,
    runState,
    onUpdate,
    options,
    schedulerDepth = 0,
  } = context;

  onUpdate(nodeId, "running", {});

  if (schedulerDepth + 1 > MAX_SUBCHAIN_DEPTH) {
    runState[nodeId] = {
      state: "failed",
      extractedValues: {},
      error: SUBCHAIN_DEPTH_EXCEEDED_ERROR,
      errorKind: SUBCHAIN_DEPTH_EXCEEDED_KIND,
    };
    onUpdate(nodeId, "failed", {
      error: SUBCHAIN_DEPTH_EXCEEDED_ERROR,
      errorKind: SUBCHAIN_DEPTH_EXCEEDED_KIND,
    });
    return true;
  }

  const startOverrides = resolveInputBindings(
    subChainBlock.inputBindings,
    options,
  );

  const nestedRunState: ChainRunState = {};

  const trackingOnUpdate: OnUpdateFn = (stepNodeId, state, data) => {
    nestedRunState[stepNodeId] = {
      state,
      extractedValues: data.extractedValues ?? {},
      response: data.response,
      error: data.error,
      errorKind: data.errorKind,
      assertionResults: data.assertionResults,
      activeBranchId: data.activeBranchId,
      unresolvedVars: data.unresolvedVars,
    };
    onUpdate(stepNodeId, state, { ...data, parentStepId: nodeId });
  };

  await runChain(
    chain.requests,
    chain.edges,
    trackingOnUpdate,
    options.signal,
    chain.nodeAssertions,
    chain.delayNodes,
    chain.conditionNodes,
    undefined,
    undefined,
    chain.displayNodes,
    options.resolveVariables,
    chain.startBlock,
    startOverrides,
    chain.evaluateNodes,
    chain.validateNodes,
    options.envVars,
    chain.mergeNodes,
    1,
    schedulerDepth + 1,
    chain.loopNodes,
    chain.collectNodes,
  );

  if (options.signal.aborted) {
    const error = "Run stopped";
    runState[nodeId] = { state: "aborted", extractedValues: {}, error };
    onUpdate(nodeId, "aborted", { error });
    return true;
  }

  const terminalIds = terminalRequestIds(chain);
  const failedTerminal = terminalIds
    .map((id) => nestedRunState[id])
    .find((step) => step?.state === "failed");

  const subExtractedValues: Record<string, string | null> = {};
  const responseBody: Record<string, unknown> = {};
  for (const id of terminalIds) {
    const step = nestedRunState[id];
    if (!step?.response) continue;
    subExtractedValues[subValueKey(subChainBlock.id, id)] = step.response.body;
    try {
      responseBody[id] = JSON.parse(step.response.body);
    } catch {
      responseBody[id] = step.response.body;
    }
  }

  if (failedTerminal) {
    const error = failedTerminal.error ?? "Sub-chain run failed";
    runState[nodeId] = {
      state: "failed",
      extractedValues: subExtractedValues,
      error,
    };
    onUpdate(nodeId, "failed", {
      extractedValues: subExtractedValues,
      error,
      errorKind: "generic",
    });
    return true;
  }

  const bodyJson = JSON.stringify(responseBody);
  const syntheticResponse = {
    status: 200,
    statusText: "OK",
    headers: {},
    body: bodyJson,
    duration: 0,
    size: bodyJson.length,
    url: "",
    method: "GET" as const,
    timestamp: Date.now(),
  };

  runState[nodeId] = {
    state: "passed",
    extractedValues: subExtractedValues,
    response: syntheticResponse,
  };
  onUpdate(nodeId, "passed", {
    extractedValues: subExtractedValues,
    response: syntheticResponse,
  });

  return true;
}
