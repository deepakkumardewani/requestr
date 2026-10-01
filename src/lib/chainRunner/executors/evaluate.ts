import { type EvaluateFailure, runInWorker } from "@/lib/chainEvalHost";
import {
  compactWarnings,
  registerAlias,
  registerEdgeAlias,
} from "@/lib/chainValueNamespace";
import type { ResponseData } from "@/types";
import { SYNTHETIC_RESPONSE_DEFAULTS } from "@/types/chain";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorInfo,
  chainError,
} from "../errorCodes";
import { buildEvaluateData } from "../evaluateData";
import { ERROR_KIND, type ExecutionContext, type NodeExecutor } from "../types";

/** Host failures carry a code; user-code exceptions are data and stay verbatim. */
function evaluateFailure({
  error,
  errorCode,
  errorParams,
}: EvaluateFailure): Pick<ChainErrorInfo, "error"> & Partial<ChainErrorInfo> {
  return errorCode ? chainError(errorCode, errorParams) : { error };
}

type Collisions = ReturnType<typeof registerAlias>[];

/** Marks the node failed in runState and notifies the UI. */
function publishFailure({
  context,
  failure,
  collisions,
}: {
  context: ExecutionContext;
  failure: ReturnType<typeof evaluateFailure>;
  collisions: Collisions;
}): void {
  const { nodeId, runState, onUpdate } = context;
  runState[nodeId] = {
    state: "failed",
    extractedValues: {},
    error: failure.error,
  };
  onUpdate(nodeId, "failed", {
    ...failure,
    errorKind: ERROR_KIND.GENERIC,
    warnings: compactWarnings(collisions),
  });
}

/**
 * Publishes the evaluated result into the shared value namespace (tier 2) under
 * the block's outputAlias, then records it as a synthetic response.
 */
function publishSuccess({
  context,
  outputAlias,
  output,
  collisions,
}: {
  context: ExecutionContext;
  outputAlias: string;
  output: unknown;
  collisions: Collisions;
}): void {
  const { nodeId, runState, onUpdate, options } = context;
  const outputForNamespace =
    typeof output === "string" ? output : JSON.stringify(output);
  collisions.push(
    registerAlias(options.aliasValues, outputAlias, outputForNamespace, {
      owner: { kind: "evaluate", id: nodeId },
    }),
  );

  const syntheticResponse: ResponseData = {
    ...SYNTHETIC_RESPONSE_DEFAULTS,
    headers: {},
    body: JSON.stringify(output),
    timestamp: Date.now(),
  };
  runState[nodeId] = {
    state: "passed",
    extractedValues: {},
    response: syntheticResponse,
  };
  onUpdate(nodeId, "passed", {
    response: syntheticResponse,
    warnings: compactWarnings(collisions),
  });
}

/**
 * Execute an "evaluate" node: runs the block's JS in the sandboxed worker with
 * `data` built from the direct upstream node's response (parsed JSON when possible)
 * plus that edge's aliased injection values, and publishes the return value as a
 * synthetic response so downstream injections/conditions can extract from it exactly
 * like an API node's response — `body` is the JSON-stringified evaluation result.
 */
export const evaluateExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  const {
    nodeId,
    incomingEdges,
    runState,
    evaluateNodeMap,
    onUpdate,
    options,
  } = context;

  const block = evaluateNodeMap?.get(nodeId);
  if (!block) return false;

  onUpdate(nodeId, "running", {});

  const { input, extractions } = buildEvaluateData({
    incomingEdges,
    runState,
    chainInputs: options.chainInputs,
    envVars: options.envVars,
  });
  const collisions = extractions.map(({ edgeId, targetKey, value }) =>
    registerEdgeAlias(options.aliasValues, edgeId, targetKey, value),
  );

  const result = await runInWorker({ code: block.code, ...input });

  // An undefined output cannot be serialised or registered, so the alias would be
  // silently absent while the node reports "passed"; fail loudly instead.
  if ("error" in result || result.output === undefined) {
    const failure =
      "error" in result
        ? evaluateFailure(result)
        : chainError(CHAIN_ERROR_CODE.EVALUATE_UNDEFINED_OUTPUT);
    publishFailure({ context, failure, collisions });
    return true;
  }

  publishSuccess({
    context,
    outputAlias: block.outputAlias,
    output: result.output,
    collisions,
  });
  return true;
};
