import { JSONPath } from "jsonpath-plus";
import { resolveInNamespace } from "@/lib/chainValueNamespace";
import { validateSchema } from "@/lib/schemaValidator";
import type { ExecutionContext, NodeExecutor } from "../types";
import { isExtractionEdge } from "../utils";

const MAX_REPORTED_ERRORS = 3;

/**
 * Resolves the value to validate: the whole parsed body when `sourceJsonPath` is empty,
 * otherwise the first match for that path. Returns `undefined` when the body isn't valid
 * JSON or the path matches nothing — AJV then reports a type-mismatch error, which is
 * the correct outcome (there is nothing to sensibly validate).
 */
function resolveTarget(body: string, sourceJsonPath: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }

  if (!sourceJsonPath.trim()) return parsed;

  try {
    const result = JSONPath({
      path: sourceJsonPath,
      json: parsed as object,
      wrap: true,
    });
    return Array.isArray(result) && result.length > 0 ? result[0] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Execute a "validate" node: validates the direct upstream node's response (or a JSONPath
 * of it) against the block's JSON Schema. Fails with at most the first three errors.
 */
export const validateExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  const {
    nodeId,
    incomingEdges,
    runState,
    validateNodeMap,
    onUpdate,
    options,
  } = context;

  const block = validateNodeMap?.get(nodeId);
  if (!block) return false;

  onUpdate(nodeId, "running", {});

  const upstreamEdge = incomingEdges.find(isExtractionEdge);
  const upstreamResponse = upstreamEdge
    ? runState[upstreamEdge.sourceRequestId]?.response
    : undefined;

  if (!upstreamResponse) {
    const error = "No upstream response to validate";
    runState[nodeId] = { state: "failed", extractedValues: {}, error };
    onUpdate(nodeId, "failed", { error, errorKind: "extraction" });
    return true;
  }

  const sourceJsonPath = resolveInNamespace(block.sourceJsonPath, {
    chainInputs: options.chainInputs,
    aliasValues: options.aliasValues,
    resolveVariables: options.resolveVariables,
  });
  const target = resolveTarget(upstreamResponse.body, sourceJsonPath);
  const result = await validateSchema(target, block.schema);

  if (result.valid) {
    runState[nodeId] = {
      state: "passed",
      extractedValues: {},
      response: upstreamResponse,
    };
    onUpdate(nodeId, "passed", { response: upstreamResponse });
    return true;
  }

  const error = result.errors
    .slice(0, MAX_REPORTED_ERRORS)
    .map((e) => `${e.path}: ${e.message}`)
    .join("; ");

  runState[nodeId] = { state: "failed", extractedValues: {}, error };
  onUpdate(nodeId, "failed", { error, errorKind: "generic" });
  return true;
};
