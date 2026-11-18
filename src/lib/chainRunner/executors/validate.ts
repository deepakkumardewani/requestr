import {
  type JsonPathFailureReason,
  queryJsonPath,
  tryParseJson,
} from "@/lib/chainJson";
import { resolveInNamespace } from "@/lib/chainValueNamespace";
import { type SchemaProblem, validateSchema } from "@/lib/schemaValidator";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorCode,
  type ChainErrorInfo,
  chainError,
} from "../errorCodes";
import { ERROR_KIND, type ExecutionContext, type NodeExecutor } from "../types";
import { isExtractionEdge } from "../utils";

const MAX_REPORTED_ERRORS = 3;

// Distinguishes "not JSON" from a legitimate literal `null` body.
const INVALID_JSON = Symbol("invalid-json");

type ResolvedTarget =
  | { ok: true; value: unknown }
  | { ok: false; failure: ChainErrorInfo };

const JSON_PATH_FAILURE_CODE: Record<JsonPathFailureReason, ChainErrorCode> = {
  invalidJson: CHAIN_ERROR_CODE.VALIDATE_INVALID_JSON,
  invalidJsonPath: CHAIN_ERROR_CODE.VALIDATE_INVALID_JSON_PATH,
  noMatch: CHAIN_ERROR_CODE.VALIDATE_NO_MATCH,
};

/**
 * Resolves the value to validate: the whole parsed body when `sourceJsonPath` is empty,
 * otherwise the first match for that path. Fails with a specific typed error when the
 * body isn't JSON, the path is malformed or the path matches nothing, so the user sees
 * the real cause rather than a schema type-mismatch on `undefined`.
 */
function resolveTarget(body: string, sourceJsonPath: string): ResolvedTarget {
  const parsed = tryParseJson(body, INVALID_JSON);
  if (parsed === INVALID_JSON) {
    return {
      ok: false,
      failure: chainError(CHAIN_ERROR_CODE.VALIDATE_INVALID_JSON),
    };
  }
  if (!sourceJsonPath.trim()) return { ok: true, value: parsed };

  const result = queryJsonPath(parsed, sourceJsonPath);
  if (result.ok) return result;
  return {
    ok: false,
    failure: chainError(JSON_PATH_FAILURE_CODE[result.reason], {
      path: sourceJsonPath,
    }),
  };
}

function failNode(
  { nodeId, runState, onUpdate }: ExecutionContext,
  failure: ChainErrorInfo,
): true {
  runState[nodeId] = {
    state: "failed",
    extractedValues: {},
    error: failure.error,
  };
  onUpdate(nodeId, "failed", { ...failure, errorKind: ERROR_KIND.EXTRACTION });
  return true;
}

const SCHEMA_PROBLEM_CODE: Record<SchemaProblem["kind"], ChainErrorCode> = {
  invalidSchemaJson: CHAIN_ERROR_CODE.VALIDATE_INVALID_SCHEMA_JSON,
  invalidSchema: CHAIN_ERROR_CODE.VALIDATE_INVALID_SCHEMA,
};

function schemaProblemError({ kind, detail }: SchemaProblem): ChainErrorInfo {
  return chainError(SCHEMA_PROBLEM_CODE[kind], { detail });
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
    return failNode(context, chainError(CHAIN_ERROR_CODE.VALIDATE_NO_UPSTREAM));
  }

  const sourceJsonPath = resolveInNamespace(block.sourceJsonPath, {
    chainInputs: options.chainInputs,
    aliasValues: options.aliasValues,
    resolveVariables: options.resolveVariables,
  });
  const target = resolveTarget(upstreamResponse.body, sourceJsonPath);
  if (!target.ok) return failNode(context, target.failure);

  const result = await validateSchema(target.value, block.schema);
  if (result.schemaProblem) {
    return failNode(context, schemaProblemError(result.schemaProblem));
  }

  if (result.valid) {
    const shown =
      typeof target.value === "string"
        ? target.value
        : JSON.stringify(target.value);
    const pathKey = sourceJsonPath.trim() || "$";
    const extractedValues: Record<string, string | null> = {
      [`${nodeId}:${pathKey}`]: shown,
    };
    runState[nodeId] = {
      state: "passed",
      extractedValues,
      response: upstreamResponse,
    };
    onUpdate(nodeId, "passed", { response: upstreamResponse, extractedValues });
    return true;
  }

  const shown = result.errors.slice(0, MAX_REPORTED_ERRORS);
  const hidden = result.errors.length - shown.length;
  const error =
    shown.map((e) => `${e.path}: ${e.message}`).join("; ") +
    (hidden > 0 ? ` (+${hidden} more)` : "");

  runState[nodeId] = { state: "failed", extractedValues: {}, error };
  onUpdate(nodeId, "failed", { error, errorKind: ERROR_KIND.GENERIC });
  return true;
};
