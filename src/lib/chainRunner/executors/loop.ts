import { JSONPath } from "jsonpath-plus";
import { isReservedAlias } from "@/lib/chainValueNamespace";
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
  ValidateBlock,
} from "@/types/chain";
import { MAX_SCHEDULER_DEPTH, runChain } from "../../chainRunner";
import type { OnUpdateFn, RunOptions } from "../types";
import { isExtractionEdge } from "../utils";

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
};

/** Per-terminal-node snapshot recorded into a Collect's aggregated array for one iteration. */
export type LoopIterationResult = Record<
  string,
  {
    state: string;
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
  schedulerDepth?: number;
};

/** Resolves the array to iterate over: `sourceJsonPath` applied to the upstream response body. */
function resolveLoopItems(
  responseBody: string,
  sourceJsonPath: string,
): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return null;
  }

  try {
    const matches = JSONPath({
      path: sourceJsonPath,
      json: parsed as object,
      wrap: true,
    });
    const matched =
      Array.isArray(matches) && matches.length > 0 ? matches[0] : undefined;
    return Array.isArray(matched) ? matched : null;
  } catch {
    return null;
  }
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

/** Deep-clones `requests`, substituting loop `vars` into url/headers/params/body. */
function substituteLoopVarsInRequests(
  requests: RequestModel[],
  vars: Record<string, string>,
): RequestModel[] {
  return requests.map((request) => {
    const cloned = JSON.parse(JSON.stringify(request)) as RequestModel;
    cloned.url = substituteLoopVars(cloned.url, vars);
    cloned.headers = cloned.headers.map((h) => ({
      ...h,
      value: substituteLoopVars(h.value, vars),
    }));
    cloned.params = cloned.params.map((p) => ({
      ...p,
      value: substituteLoopVars(p.value, vars),
    }));
    if (cloned.body?.content) {
      cloned.body = {
        ...cloned.body,
        content: substituteLoopVars(cloned.body.content, vars),
      };
    }
    return cloned;
  });
}

/** IDs of body nodes with no outgoing edge within the body subgraph — their outputs are what Collect gathers. */
function terminalRequestIds(body: LoopBodyGraph): string[] {
  const hasOutgoing = new Set(body.edges.map((e) => e.sourceRequestId));
  return body.requests.map((r) => r.id).filter((id) => !hasOutgoing.has(id));
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
 */
export async function loopExecutor(
  context: LoopExecutorContext,
): Promise<boolean> {
  const {
    nodeId,
    loopBlock,
    collectBlock,
    body,
    incomingEdges,
    runState,
    onUpdate,
    options,
    schedulerDepth = 0,
  } = context;

  onUpdate(nodeId, "running", {});

  if (schedulerDepth + 1 > MAX_SCHEDULER_DEPTH) {
    const error = "Scheduler depth exceeded — loop nesting too deep";
    runState[nodeId] = { state: "failed", extractedValues: {}, error };
    onUpdate(nodeId, "failed", { error, errorKind: "generic" });
    runState[collectBlock.id] = {
      state: "skipped",
      extractedValues: {},
      error,
    };
    onUpdate(collectBlock.id, "skipped", { error });
    return true;
  }

  const upstreamEdge = incomingEdges.find(isExtractionEdge);
  const upstreamResponse = upstreamEdge
    ? runState[upstreamEdge.sourceRequestId]?.response
    : undefined;

  if (!upstreamResponse) {
    const error = "No upstream response to iterate over";
    runState[nodeId] = { state: "failed", extractedValues: {}, error };
    onUpdate(nodeId, "failed", { error, errorKind: "extraction" });
    runState[collectBlock.id] = {
      state: "skipped",
      extractedValues: {},
      error,
    };
    onUpdate(collectBlock.id, "skipped", { error });
    return true;
  }

  const items = resolveLoopItems(
    upstreamResponse.body,
    loopBlock.sourceJsonPath,
  );
  if (items === null) {
    const error = `sourceJsonPath "${loopBlock.sourceJsonPath}" did not resolve to an array`;
    runState[nodeId] = { state: "failed", extractedValues: {}, error };
    onUpdate(nodeId, "failed", { error, errorKind: "extraction" });
    runState[collectBlock.id] = {
      state: "skipped",
      extractedValues: {},
      error,
    };
    onUpdate(collectBlock.id, "skipped", { error });
    return true;
  }

  const cappedItems = items.slice(0, loopBlock.maxIterations);
  const terminalIds = terminalRequestIds(body);
  const collected: LoopIterationResult[] = [];
  let aborted = false;

  for (let index = 0; index < cappedItems.length; index += 1) {
    if (options.signal.aborted) {
      aborted = true;
      break;
    }

    const item = cappedItems[index];
    const iterationRunState: ChainRunState = {};
    const iterationVars: Record<string, string> = {
      [loopBlock.itemAlias]:
        typeof item === "string" ? item : JSON.stringify(item),
      index: String(index),
    };
    const iterationRequests = substituteLoopVarsInRequests(
      body.requests,
      iterationVars,
    );

    const iterationOnUpdate: OnUpdateFn = (stepNodeId, state, data) => {
      onUpdate(stepNodeId, state, {
        ...data,
        parentStepId: nodeId,
        iteration: index,
      });
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
      iterationOnUpdate(stepNodeId, state, data);
    };

    await runChain(
      iterationRequests,
      body.edges,
      trackingOnUpdate,
      options.signal,
      body.nodeAssertions,
      body.delayNodes,
      body.conditionNodes,
      undefined,
      undefined,
      body.displayNodes,
      options.resolveVariables,
      undefined,
      undefined,
      body.evaluateNodes,
      body.validateNodes,
      options.envVars,
      body.mergeNodes,
      1, // sequential within an iteration — iterations themselves are sequential too
      schedulerDepth + 1,
    );

    const iterationResult: LoopIterationResult = {};
    for (const id of terminalIds) {
      const step = iterationRunState[id];
      if (!step) continue;
      iterationResult[id] = {
        state: step.state,
        response: step.response,
        extractedValues: step.extractedValues,
        error: step.error,
      };
    }
    collected.push(iterationResult);

    if (options.signal.aborted) {
      aborted = true;
      break;
    }
  }

  if (aborted) {
    const error = "Run stopped";
    runState[nodeId] = { state: "aborted", extractedValues: {}, error };
    onUpdate(nodeId, "aborted", { error });
    runState[collectBlock.id] = {
      state: "skipped",
      extractedValues: {},
      error,
    };
    onUpdate(collectBlock.id, "skipped", { error });
    return true;
  }

  runState[nodeId] = { state: "passed", extractedValues: {} };
  onUpdate(nodeId, "passed", { extractedValues: {} });

  const collectedJson = JSON.stringify(collected);
  const collectExtractedValues = {
    [collectValueKey(collectBlock.id)]: collectedJson,
  };
  // The collected array is also surfaced as a synthetic `response.body` so a
  // downstream node's ordinary extraction edge (isExtractionEdge, `apiExecutor`)
  // can JSONPath into it exactly like any other upstream response — no
  // separate "collect-aware" injection path needed downstream.
  const collectResponse = {
    status: 200,
    statusText: "OK",
    headers: {},
    body: collectedJson,
    duration: 0,
    size: collectedJson.length,
    url: "",
    method: "GET" as const,
    timestamp: Date.now(),
  };
  runState[collectBlock.id] = {
    state: "passed",
    extractedValues: collectExtractedValues,
    response: collectResponse,
  };
  onUpdate(collectBlock.id, "passed", {
    extractedValues: collectExtractedValues,
    response: collectResponse,
  });

  return true;
}
