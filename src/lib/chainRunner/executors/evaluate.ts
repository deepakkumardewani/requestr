import { runInWorker } from "@/lib/chainEvalHost";
import { registerAlias, registerEdgeAlias } from "@/lib/chainValueNamespace";
import type { ResponseData } from "@/types";
import type { ExecutionContext, NodeExecutor } from "../types";
import { extractJsonPath, isExtractionEdge } from "../utils";

/** Parses a response body as JSON when possible; falls back to the raw string. */
function parseResponseBody(response: ResponseData | undefined): unknown {
  if (!response) return undefined;
  try {
    return JSON.parse(response.body);
  } catch {
    return response.body;
  }
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

  const extractionEdges = incomingEdges.filter(isExtractionEdge);
  const upstreamEdge = extractionEdges[0];
  const upstreamResponse = upstreamEdge
    ? runState[upstreamEdge.sourceRequestId]?.response
    : undefined;

  const aliasedValues: Record<string, string | null> = {};
  for (const edge of extractionEdges) {
    const srcResponse = runState[edge.sourceRequestId]?.response;
    for (const injection of edge.injections ?? []) {
      const extracted = srcResponse
        ? extractJsonPath(srcResponse.body, injection.sourceJsonPath)
        : null;
      aliasedValues[injection.targetKey] = extracted;
      registerEdgeAlias(
        options.aliasValues,
        edge.id,
        injection.targetKey,
        extracted,
      );
    }
  }

  const data = {
    ...aliasedValues,
    response: parseResponseBody(upstreamResponse),
  };

  const result = await runInWorker({
    code: block.code,
    data,
    inputs: options.chainInputs ?? {},
    env: options.envVars ?? {},
  });

  if ("error" in result) {
    runState[nodeId] = {
      state: "failed",
      extractedValues: {},
      error: result.error,
    };
    onUpdate(nodeId, "failed", { error: result.error, errorKind: "generic" });
    return true;
  }

  // Publish the evaluated result into the shared value namespace (tier 2)
  // under the block's outputAlias, per the single-namespace spec.
  const outputForNamespace =
    typeof result.output === "string"
      ? result.output
      : JSON.stringify(result.output);
  registerAlias(options.aliasValues, block.outputAlias, outputForNamespace);

  const syntheticResponse: ResponseData = {
    status: 200,
    statusText: "OK",
    headers: {},
    body: JSON.stringify(result.output),
    duration: 0,
    size: 0,
    url: "",
    method: "GET",
    timestamp: Date.now(),
  };

  runState[nodeId] = {
    state: "passed",
    extractedValues: {},
    response: syntheticResponse,
  };
  onUpdate(nodeId, "passed", { response: syntheticResponse });

  return true;
};
