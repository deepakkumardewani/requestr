import { MAX_SUBCHAIN_DEPTH } from "@/lib/chainConstants";
import { tryParseJson } from "@/lib/chainJson";
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
import { SYNTHETIC_RESPONSE_DEFAULTS } from "@/types/chain";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorInfo,
  chainError,
} from "../errorCodes";
import { nestUpdate } from "../nesting";
import { SEQUENTIAL_CONCURRENCY } from "../scheduler";
import type { NodeUpdateData } from "../stepRecording";
import {
  ERROR_KIND,
  type ErrorKind,
  type OnUpdateFn,
  type RunChainFn,
  type RunChainOptions,
  type RunOptions,
} from "../types";

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
  subChainBlocks?: SubChainBlock[];
  startBlock?: StartBlock;
};

type NestedStepError = Pick<
  NodeUpdateData,
  "error" | "errorCode" | "errorParams"
>;

/**
 * Keeps the nested step's own kind so the run log classifies it accurately.
 * Depth-exceeded is dropped: it marks only the block that hit the limit, so
 * ancestors re-raising it would each look like a fresh depth violation.
 */
function reraisedKind(kind: ErrorKind | undefined): ErrorKind {
  if (!kind || kind === SUBCHAIN_DEPTH_EXCEEDED_KIND) return ERROR_KIND.GENERIC;
  return kind;
}

/** Re-raises a failed nested step's error on the Sub-chain block, keeping its code. */
function stepFailure(
  step: NestedStepError | undefined,
): Pick<ChainErrorInfo, "error"> & Partial<ChainErrorInfo> {
  if (step?.errorCode) return chainError(step.errorCode, step.errorParams);
  if (step?.error) return { error: step.error };
  return chainError(CHAIN_ERROR_CODE.SUBCHAIN_FAILED);
}

export type SubchainExecutorContext = {
  nodeId: string; // the SubChain block's own id
  subChainBlock: SubChainBlock;
  chain: ReferencedChainGraph;
  incomingEdges: ChainEdge[];
  runState: ChainRunState;
  onUpdate: OnUpdateFn;
  options: RunOptions;
  /** Injected `runChain` (avoids a runner <-> executor import cycle). */
  runChain: RunChainFn;
  schedulerDepth?: number;
  /** Loop nesting depth of the parent run; forwarded so loop limits hold across the Sub-chain boundary. */
  loopDepth?: number;
  /** Forwarded to the nested `runChain` so Sub-chain blocks inside the referenced chain resolve. */
  resolveSubChainGraph?: RunChainOptions["resolveSubChainGraph"];
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

/** Ids of every block the referenced chain runs (requests and all non-request blocks). */
function chainBlockIds(chain: ReferencedChainGraph): string[] {
  return [
    ...chain.requests,
    ...(chain.delayNodes ?? []),
    ...(chain.conditionNodes ?? []),
    ...(chain.displayNodes ?? []),
    ...(chain.evaluateNodes ?? []),
    ...(chain.validateNodes ?? []),
    ...(chain.mergeNodes ?? []),
    ...(chain.loopNodes ?? []),
    ...(chain.collectNodes ?? []),
    ...(chain.subChainBlocks ?? []),
  ].map((block) => block.id);
}

/** Ids of blocks with no outgoing edge within the referenced chain — their outputs become `sub.<id>.<alias>`. */
function terminalBlockIds(blockIds: string[], chain: ReferencedChainGraph) {
  const hasOutgoing = new Set(chain.edges.map((e) => e.sourceRequestId));
  return blockIds.filter((id) => !hasOutgoing.has(id));
}

/** Terminal outputs keyed for downstream lookup, plus the same values as one JSON object. */
function collectTerminalOutputs(options: {
  nestedRunState: ChainRunState;
  terminalIds: string[];
  subChainBlockId: string;
}) {
  const { nestedRunState, terminalIds, subChainBlockId } = options;
  const extractedValues: Record<string, string | null> = {};
  const responseBody: Record<string, unknown> = {};
  for (const id of terminalIds) {
    const response = nestedRunState[id]?.response;
    if (!response) continue;
    extractedValues[subValueKey(subChainBlockId, id)] = response.body;
    responseBody[id] = tryParseJson(response.body, response.body);
  }
  return { extractedValues, responseBody };
}

function buildSyntheticResponse(responseBody: Record<string, unknown>) {
  const body = JSON.stringify(responseBody);
  return {
    ...SYNTHETIC_RESPONSE_DEFAULTS,
    headers: {},
    body,
    size: body.length,
    timestamp: Date.now(),
  };
}

/** Records a terminal non-passing state on the block's run state and reports it. */
function finishNode(
  context: SubchainExecutorContext,
  state: "failed" | "aborted",
  update: NodeUpdateData,
): true {
  context.runState[context.nodeId] = {
    state,
    extractedValues: update.extractedValues ?? {},
    error: update.error,
    errorKind: update.errorKind,
  };
  context.onUpdate(context.nodeId, state, update);
  return true;
}

/**
 * Runs the referenced chain one depth level deeper, re-tagging every step with
 * this block as `parentStepId` and recording each step's outcome locally.
 */
async function runNestedChain(context: SubchainExecutorContext) {
  const {
    nodeId,
    subChainBlock,
    chain,
    onUpdate,
    options,
    runChain,
    schedulerDepth = 0,
    loopDepth = 0,
    resolveSubChainGraph,
  } = context;
  const nestedRunState: ChainRunState = {};
  // `ChainRunState` holds only the English text; keep each step's code so a
  // failed step's typed error can be re-raised on this block.
  const nestedErrors = new Map<string, NestedStepError>();

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
    nestedErrors.set(stepNodeId, {
      error: data.error,
      errorCode: data.errorCode,
      errorParams: data.errorParams,
    });
    onUpdate(stepNodeId, state, nestUpdate(data, { parentStepId: nodeId }));
  };

  await runChain({
    requests: chain.requests,
    edges: chain.edges,
    onUpdate: trackingOnUpdate,
    signal: options.signal,
    nodeAssertions: chain.nodeAssertions,
    delayNodes: chain.delayNodes,
    conditionNodes: chain.conditionNodes,
    displayNodes: chain.displayNodes,
    resolveVariables: options.resolveVariables,
    startBlock: chain.startBlock,
    startOverrides: resolveInputBindings(subChainBlock.inputBindings, options),
    evaluateNodes: chain.evaluateNodes,
    validateNodes: chain.validateNodes,
    envVars: options.envVars,
    mergeNodes: chain.mergeNodes,
    concurrency: SEQUENTIAL_CONCURRENCY,
    schedulerDepth: schedulerDepth + 1,
    loopDepth,
    loopNodes: chain.loopNodes,
    collectNodes: chain.collectNodes,
    subChainBlocks: chain.subChainBlocks,
    resolveSubChainGraph,
  });

  return { nestedRunState, nestedErrors };
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
    return finishNode(context, "failed", {
      ...chainError(CHAIN_ERROR_CODE.SUBCHAIN_DEPTH_EXCEEDED),
      errorKind: SUBCHAIN_DEPTH_EXCEEDED_KIND,
    });
  }

  const { nestedRunState, nestedErrors } = await runNestedChain(context);

  if (options.signal.aborted) {
    return finishNode(
      context,
      "aborted",
      chainError(CHAIN_ERROR_CODE.RUN_STOPPED),
    );
  }

  // Any failed block fails the Sub-chain, not just terminal ones — otherwise an
  // intermediate failure is hidden behind a "passed" block.
  const blockIds = chainBlockIds(chain);
  const failedId = blockIds.find(
    (id) => nestedRunState[id]?.state === "failed",
  );
  const { extractedValues, responseBody } = collectTerminalOutputs({
    nestedRunState,
    terminalIds: terminalBlockIds(blockIds, chain),
    subChainBlockId: subChainBlock.id,
  });

  if (failedId !== undefined) {
    return finishNode(context, "failed", {
      extractedValues,
      ...stepFailure(nestedErrors.get(failedId)),
      errorKind: reraisedKind(nestedRunState[failedId]?.errorKind),
    });
  }

  const response = buildSyntheticResponse(responseBody);
  runState[nodeId] = { state: "passed", extractedValues, response };
  onUpdate(nodeId, "passed", { extractedValues, response });
  return true;
}
