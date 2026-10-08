import { MAX_LOOP_NESTING_DEPTH } from "@/lib/chainConstants";
import { firstJsonPathMatch, tryParseJson } from "@/lib/chainJson";
import type { StepInputs, StepWarning } from "@/lib/chainRunHistory";
import {
  compactWarnings,
  isReservedAlias,
  isValidLoopAlias,
} from "@/lib/chainValueNamespace";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  ChainNodeState,
  ChainRunState,
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
import {
  LOOP_MAX_ITERATIONS_CAP,
  SYNTHETIC_RESPONSE_DEFAULTS,
} from "@/types/chain";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorInfo,
  chainError,
} from "../errorCodes";
import { findLoopBodyTerminalIds, loopBodyGraphNodeIds } from "../loopBody";
import { nestUpdate } from "../nesting";
import { SEQUENTIAL_CONCURRENCY } from "../scheduler";
import {
  ERROR_KIND,
  type ErrorKind,
  type ExecutionContext,
  MAX_SCHEDULER_DEPTH,
  type OnUpdateFn,
  type RunChainFn,
  type RunChainOptions,
  type RunOptions,
} from "../types";
import { isExtractionEdge } from "../utils";

/** `ErrorKind` recorded on `LOOP_DEPTH_EXCEEDED_ERROR`. */
export const LOOP_DEPTH_EXCEEDED_KIND: ErrorKind = "loop_depth_exceeded";

export { isReservedAlias };

/** Key `collect.<collectBlock.id>`'s aggregated array is exposed under downstream. */
export function collectValueKey(collectBlockId: string): string {
  return `collect.${collectBlockId}`;
}

/**
 * The subgraph running between a Loop's `body` handle and its paired
 * Collect. Mirrors `runChain`'s own parameter shape so it can be forwarded
 * straight through to a nested `runChain` call per iteration.
 */
export type LoopBodyGraph = {
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
  /** Body nodes Collect gathers; derived from the body's leaves when omitted. */
  terminalNodeIds?: string[];
};

/** Per-terminal-node snapshot recorded into a Collect's aggregated array for one iteration. */
export type LoopIterationResult = Record<
  string,
  {
    state: ChainNodeState;
    response?: unknown;
    extractedValues?: Record<string, string | null>;
    error?: string;
  }
>;

export type LoopExecutorContext = {
  nodeId: string; // the Loop block's own id
  loopBlock: LoopBlock;
  collectBlock: CollectBlock;
  body: LoopBodyGraph;
  incomingEdges: ChainEdge[];
  runState: ChainRunState;
  onUpdate: OnUpdateFn;
  options: RunOptions;
  /** Injected `runChain`, invoked once per iteration (avoids a runner <-> executor import cycle). */
  runChain: RunChainFn;
  schedulerDepth?: number;
  /** Loop bodies already enclosing this Loop within its graph (0 = outermost). */
  loopDepth?: number;
  /** Forwarded to each iteration's `runChain` so Sub-chain blocks in the body resolve. */
  resolveSubChainGraph?: RunChainOptions["resolveSubChainGraph"];
};

/** Resolves the array to iterate over: `sourceJsonPath` applied to the upstream response body. */
function resolveLoopItems(
  responseBody: string,
  sourceJsonPath: string,
): unknown[] | null {
  const parsed = tryParseJson(responseBody, undefined);
  const matched = firstJsonPathMatch(parsed, sourceJsonPath);
  return Array.isArray(matched) ? matched : null;
}

/**
 * Substitutes `{{itemAlias}}` and `{{index}}` placeholders in a string with
 * this iteration's values, leaving every other `{{var}}` placeholder
 * untouched for the nested run's own `resolveVariables` to resolve.
 */
function substituteLoopVars(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? vars[key] : match,
  );
}

/**
 * Wraps the run's env resolver so this iteration's loop vars resolve through
 * the same `resolveVariables` seam every node already uses (not just request
 * text). Loop vars are applied first, so they shadow an env var of the same
 * name; chain inputs and aliases are resolved by the caller before this runs.
 */
function withIterationVars(
  base: ((text: string) => string) | undefined,
  vars: Record<string, string>,
): (text: string) => string {
  return (text) => {
    const substituted = substituteLoopVars(text, vars);
    return base ? base(substituted) : substituted;
  };
}

/** Body nodes (of any type) whose outputs Collect gathers each iteration. */
function terminalNodeIdsOf(body: LoopBodyGraph): string[] {
  if (body.terminalNodeIds) return body.terminalNodeIds;
  return findLoopBodyTerminalIds(loopBodyGraphNodeIds(body), "", body.edges);
}

/** The Loop step's recorded inputs; `itemCount` is omitted until the source resolves to an array. */
function loopInputs(loopBlock: LoopBlock, itemCount?: number): StepInputs {
  return {
    loop: {
      sourceJsonPath: loopBlock.sourceJsonPath,
      itemAlias: loopBlock.itemAlias,
      ...(itemCount === undefined ? {} : { itemCount }),
    },
  };
}

type LoopEndOptions = {
  context: Pick<ExecutionContext, "nodeId" | "runState" | "onUpdate">;
  collectBlockId: string;
  state: "failed" | "aborted";
  failure: ChainErrorInfo;
  errorKind?: ErrorKind;
  inputs: StepInputs;
};

/** Ends a Loop early and skips its paired Collect so downstream nodes don't wait on it. */
function failLoop({
  context: { nodeId, runState, onUpdate },
  collectBlockId,
  state,
  failure,
  errorKind,
  inputs,
}: LoopEndOptions): void {
  runState[nodeId] = { state, extractedValues: {}, error: failure.error };
  onUpdate(nodeId, state, { ...failure, errorKind, inputs });
  runState[collectBlockId] = {
    state: "skipped",
    extractedValues: {},
    error: failure.error,
  };
  onUpdate(collectBlockId, "skipped", failure);
}

type DepthFailure = { failure: ChainErrorInfo; errorKind: ErrorKind };

/** Why a Loop at this depth may not run, or undefined when it may. */
function loopDepthFailure(
  schedulerDepth: number,
  loopDepth: number,
): DepthFailure | undefined {
  if (schedulerDepth + 1 > MAX_SCHEDULER_DEPTH) {
    return {
      failure: chainError(CHAIN_ERROR_CODE.SCHEDULER_DEPTH_EXCEEDED),
      errorKind: ERROR_KIND.GENERIC,
    };
  }
  if (loopDepth + 1 > MAX_LOOP_NESTING_DEPTH) {
    return {
      failure: chainError(CHAIN_ERROR_CODE.LOOP_DEPTH_EXCEEDED),
      errorKind: LOOP_DEPTH_EXCEEDED_KIND,
    };
  }
  return undefined;
}

type ConfigFailure = DepthFailure;

/**
 * The executor validates itself because the panel is not the only writer
 * (imports, migrations, undo snapshots): `slice(0, -1)` would silently drop
 * the last item and `NaN` would run nothing. Values above the cap are clamped
 * by `planIterations` rather than rejected.
 */
function loopConfigFailure(loopBlock: LoopBlock): ConfigFailure | undefined {
  if (!isValidLoopAlias(loopBlock.itemAlias)) {
    return {
      failure: chainError(CHAIN_ERROR_CODE.LOOP_INVALID_ALIAS, {
        alias: loopBlock.itemAlias,
      }),
      errorKind: ERROR_KIND.GENERIC,
    };
  }
  if (
    !Number.isInteger(loopBlock.maxIterations) ||
    loopBlock.maxIterations < 1
  ) {
    return {
      failure: chainError(CHAIN_ERROR_CODE.LOOP_INVALID_MAX_ITERATIONS, {
        value: String(loopBlock.maxIterations),
      }),
      errorKind: ERROR_KIND.GENERIC,
    };
  }
  return undefined;
}

/** What will run, and how much was cut; `truncated > 0` raises the `loop-truncated` warning. */
export type LoopPlan = { items: unknown[]; total: number; truncated: number };

export function planIterations(
  items: unknown[],
  loopBlock: LoopBlock,
): LoopPlan {
  const cap = Math.min(loopBlock.maxIterations, LOOP_MAX_ITERATIONS_CAP);
  const planned = items.slice(0, cap);
  return {
    items: planned,
    total: items.length,
    truncated: items.length - planned.length,
  };
}

/** Finds the Collect paired with a Loop; the first match wins, so pairing must stay 1:1. */
export function collectByLoopId<T extends { loopId: string }>(
  collects: T[],
  loopId: string,
): T | undefined {
  return collects.find((c) => c.loopId === loopId);
}

type Preflight =
  | { failure: ChainErrorInfo; errorKind: ErrorKind }
  | { plan: LoopPlan };

/** Every check that must pass before any iteration starts. */
function preflight(context: LoopExecutorContext): Preflight {
  const { loopBlock, incomingEdges, runState } = context;
  const earlyFailure =
    loopDepthFailure(context.schedulerDepth ?? 0, context.loopDepth ?? 0) ??
    loopConfigFailure(loopBlock);
  if (earlyFailure) return earlyFailure;

  const upstreamEdge = incomingEdges.find(isExtractionEdge);
  const upstreamResponse = upstreamEdge
    ? runState[upstreamEdge.sourceRequestId]?.response
    : undefined;
  if (!upstreamResponse) {
    return {
      failure: chainError(CHAIN_ERROR_CODE.LOOP_NO_UPSTREAM),
      errorKind: ERROR_KIND.EXTRACTION,
    };
  }
  const items = resolveLoopItems(
    upstreamResponse.body,
    loopBlock.sourceJsonPath,
  );
  if (items === null) {
    return {
      failure: chainError(CHAIN_ERROR_CODE.LOOP_SOURCE_NOT_ARRAY, {
        path: loopBlock.sourceJsonPath,
      }),
      errorKind: ERROR_KIND.EXTRACTION,
    };
  }
  return { plan: planIterations(items, loopBlock) };
}

type IterationOutcome = {
  result: LoopIterationResult;
  /** Any body step failed, not just a terminal: a failed upstream step leaves terminals skipped. */
  failed: boolean;
};

/** Runs one body iteration and returns its terminal nodes' snapshot. */
async function runIteration(
  context: LoopExecutorContext,
  iteration: { item: unknown; index: number },
): Promise<IterationOutcome> {
  const {
    nodeId,
    loopBlock,
    body,
    onUpdate,
    options,
    schedulerDepth = 0,
  } = context;
  const { item, index } = iteration;
  const iterationRunState: ChainRunState = {};
  const vars: Record<string, string> = {
    [loopBlock.itemAlias]:
      typeof item === "string" ? item : JSON.stringify(item),
    index: String(index),
  };

  // Mirror `runChain`'s onUpdate contract locally so terminal outputs can
  // be read back after the nested run resolves (runChain itself returns
  // void and keeps its runState private).
  const trackingOnUpdate: OnUpdateFn = (stepNodeId, state, data) => {
    iterationRunState[stepNodeId] = {
      state,
      extractedValues: data.extractedValues ?? {},
      response: data.response,
      error: data.error,
      errorKind: data.errorKind,
      assertionResults: data.assertionResults,
      activeBranchId: data.activeBranchId,
      unresolvedVars: data.unresolvedVars,
    };
    onUpdate(
      stepNodeId,
      state,
      nestUpdate(data, { parentStepId: nodeId, iteration: index }),
    );
  };

  await context.runChain({
    requests: body.requests,
    edges: body.edges,
    onUpdate: trackingOnUpdate,
    signal: options.signal,
    nodeAssertions: body.nodeAssertions,
    delayNodes: body.delayNodes,
    conditionNodes: body.conditionNodes,
    displayNodes: body.displayNodes,
    evaluateNodes: body.evaluateNodes,
    validateNodes: body.validateNodes,
    mergeNodes: body.mergeNodes,
    loopNodes: body.loopNodes,
    collectNodes: body.collectNodes,
    subChainBlocks: body.subChainBlocks,
    resolveSubChainGraph: context.resolveSubChainGraph,
    resolveVariables: withIterationVars(options.resolveVariables, vars),
    envVars: options.envVars,
    // Sequential within an iteration — iterations themselves are sequential too.
    concurrency: SEQUENTIAL_CONCURRENCY,
    schedulerDepth: schedulerDepth + 1,
    loopDepth: (context.loopDepth ?? 0) + 1,
  });

  const result: LoopIterationResult = {};
  for (const id of terminalNodeIdsOf(body)) {
    const step = iterationRunState[id];
    if (!step) continue;
    result[id] = {
      state: step.state,
      response: step.response,
      extractedValues: step.extractedValues,
      error: step.error,
    };
  }
  const failed = Object.values(iterationRunState).some(
    (step) => step.state === "failed",
  );
  return { result, failed };
}

/** Warnings the Loop step carries even though it passes; each is absent when it doesn't apply. */
function loopWarnings(
  plan: LoopPlan,
  failedIterations: number,
): StepWarning[] | undefined {
  return compactWarnings([
    plan.truncated > 0
      ? {
          kind: "loop-truncated",
          executed: plan.items.length,
          total: plan.total,
        }
      : undefined,
    failedIterations > 0
      ? {
          kind: "loop-iterations-failed",
          failed: failedIterations,
          total: plan.items.length,
        }
      : undefined,
  ]);
}

/**
 * The Collect's aggregated array is also surfaced as a synthetic
 * `response.body` so a downstream node's ordinary extraction edge can
 * JSONPath into it like any other upstream response.
 */
function buildCollectResult(
  collectBlockId: string,
  collected: LoopIterationResult[],
) {
  const collectedJson = JSON.stringify(collected);
  const extractedValues = { [collectValueKey(collectBlockId)]: collectedJson };
  const response = {
    ...SYNTHETIC_RESPONSE_DEFAULTS,
    headers: {},
    body: collectedJson,
    size: collectedJson.length,
    timestamp: Date.now(),
  };
  return { extractedValues, response };
}

/**
 * Execute a `loop` node: runs the body subgraph once per item from
 * `sourceJsonPath`, sequentially, via a nested `runChain` scheduler run per
 * iteration. Each iteration's updates are re-tagged with `parentStepId`
 * (this Loop's step id) and `iteration` (zero-based index) so the run log
 * can nest them. The paired Collect gathers each iteration's terminal node
 * outputs into an array exposed under the reserved `collect.<id>` key.
 *
 * Abort semantics (single abort semantic, per spec): the in-flight
 * iteration is cancelled by the shared `AbortSignal`, the Loop step ends
 * `aborted`, its Collect ends `skipped`, and no further iteration starts.
 * Failed iterations are recorded in Collect; the Loop itself still passes
 * (product decision) and carries a `loop-iterations-failed` warning, plus
 * `loop-truncated` when the cap cut the item list.
 */
export async function loopExecutor(
  context: LoopExecutorContext,
): Promise<boolean> {
  const { nodeId, loopBlock, collectBlock, runState, onUpdate, options } =
    context;
  onUpdate(nodeId, "running", {});

  const checked = preflight(context);
  if ("failure" in checked) {
    failLoop({
      context,
      collectBlockId: collectBlock.id,
      state: "failed",
      inputs: loopInputs(loopBlock),
      ...checked,
    });
    // Body nodes never enter the main scheduler, so a preflight failure
    // would otherwise leave them idle. Skip them before any iteration starts.
    for (const id of loopBodyGraphNodeIds(context.body)) {
      if (runState[id]) continue;
      runState[id] = {
        state: "skipped",
        extractedValues: {},
        error: checked.failure.error,
      };
      onUpdate(id, "skipped", checked.failure);
    }
    return true;
  }

  const { plan } = checked;
  const collected: LoopIterationResult[] = [];
  let failedIterations = 0;
  for (const [index, item] of plan.items.entries()) {
    if (options.signal.aborted) break;
    const outcome = await runIteration(context, { item, index });
    collected.push(outcome.result);
    if (outcome.failed) failedIterations += 1;
  }

  const inputs = loopInputs(loopBlock, plan.items.length);
  if (options.signal.aborted) {
    failLoop({
      context,
      collectBlockId: collectBlock.id,
      state: "aborted",
      failure: chainError(CHAIN_ERROR_CODE.RUN_STOPPED),
      inputs,
    });
    return true;
  }

  runState[nodeId] = { state: "passed", extractedValues: {} };
  onUpdate(nodeId, "passed", {
    extractedValues: {},
    inputs,
    warnings: loopWarnings(plan, failedIterations),
  });

  const result = buildCollectResult(collectBlock.id, collected);
  const collectedKey = collectValueKey(collectBlock.id);
  const collectedJson = result.extractedValues[collectedKey];
  if (options.aliasValues && collectedJson) {
    options.aliasValues[collectedKey] = collectedJson;
  }
  runState[collectBlock.id] = { state: "passed", ...result };
  onUpdate(collectBlock.id, "passed", result);
  return true;
}
