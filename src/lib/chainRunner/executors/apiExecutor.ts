import { evaluateAllAssertions } from "@/lib/chainAssertions";
import { registerEdgeAlias } from "@/lib/chainValueNamespace";
import { runRequest } from "@/lib/requestRunner";
import { resolveHttpRequestTemplate } from "@/lib/resolveRequest";
import type { ExecutionContext, NodeExecutor } from "../types";
import {
  applyInjection,
  extractJsonPath,
  InjectionError,
  isExtractionEdge,
} from "../utils";

/**
 * Execute an API request node in the chain.
 * Handles extraction from upstream nodes, injection, and request execution.
 */
export const apiExecutor: NodeExecutor = async (context: ExecutionContext) => {
  const {
    nodeId,
    request,
    incomingEdges,
    runState,
    displayNodeMap,
    onUpdate,
    options,
  } = context;

  if (!request) return false;

  onUpdate(nodeId, "running", {});

  // Only extract from non-routing edges
  const extractionEdges = incomingEdges.filter(isExtractionEdge);
  let mutatedRequest = request;
  const extractedValues: Record<string, string | null> = {};
  let injectionError: string | null = null;

  const { envPromotions, onPromoteToEnv } = options;

  for (const edge of extractionEdges) {
    const srcState = runState[edge.sourceRequestId];
    const sourceIsDisplay = displayNodeMap.has(edge.sourceRequestId);
    const displayCfg = displayNodeMap.get(edge.sourceRequestId);

    // DisplayNode edges use the display node's single injection config
    const injections = displayCfg
      ? [
          {
            sourceJsonPath: displayCfg.sourceJsonPath,
            targetField: displayCfg.targetField,
            targetKey: displayCfg.targetKey,
          },
        ]
      : (edge.injections ?? []);

    // An edge with no injections carries no data requirement — e.g. a plain
    // control-flow edge from a source with no response of its own (Start,
    // Merge — a pure fan-in gate — or any future control-flow block), or a
    // follow-on API edge with no extraction configured. There is nothing to
    // extract, so no upstream response is needed to proceed.
    if (injections.length === 0) {
      continue;
    }

    const sourceResponse = sourceIsDisplay ? null : srcState?.response;
    if (!sourceIsDisplay && !sourceResponse) {
      extractedValues[edge.id] = null;
      continue;
    }

    let edgeHadFailure = false;

    for (const injection of injections) {
      let extracted: string | null;
      if (sourceIsDisplay) {
        extracted = srcState?.extractedValues?.[edge.sourceRequestId] ?? null;
      } else {
        extracted = sourceResponse
          ? extractJsonPath(sourceResponse.body, injection.sourceJsonPath)
          : null;
      }

      // Key per injection so we can track individual failures
      const valueKey = `${edge.id}:${injection.sourceJsonPath}`;
      extractedValues[valueKey] = extracted;
      // Keep the top-level edge key for backward compat with failure check
      if (extracted === null) {
        edgeHadFailure = true;
      }

      if (extracted !== null) {
        // Publish into the shared value namespace (tier 2) under the
        // injection's targetKey — the alias name a downstream `{{name}}`
        // template can reference, per the single-namespace spec.
        registerEdgeAlias(
          options.aliasValues,
          edge.id,
          injection.targetKey,
          extracted,
        );
        try {
          mutatedRequest = applyInjection(
            mutatedRequest,
            injection,
            extracted,
            displayCfg?.targetUrl ?? edge.targetUrl,
          );
          const promotion = envPromotions?.find((p) => p.edgeId === edge.id);
          if (promotion) {
            onPromoteToEnv?.(promotion.envId, promotion.envVarName, extracted);
          }
        } catch (err) {
          if (err instanceof InjectionError) {
            injectionError = err.message;
            break;
          }
          throw err;
        }
      }
    }

    if (injectionError) {
      break;
    }

    if (edgeHadFailure) {
      extractedValues[edge.id] = null;
    }
  }

  // If injection failed, mark node as failed and skip request
  if (injectionError) {
    onUpdate(nodeId, "failed", {
      extractedValues,
      error: injectionError,
      errorKind: "injection",
    });
    runState[nodeId] = {
      state: "failed",
      extractedValues,
      error: injectionError,
    };
    return true;
  }

  // If any extraction failed, skip this node
  const extractionFailed = extractionEdges.some(
    (e) => extractedValues[e.id] === null,
  );

  if (extractionFailed && extractionEdges.length > 0) {
    const errMsg = "Could not extract value from source response";
    onUpdate(nodeId, "skipped", {
      extractedValues,
      error: errMsg,
      errorKind: "extraction",
    });
    runState[nodeId] = { state: "skipped", extractedValues, error: errMsg };
    return true;
  }

  try {
    // Resolve environment variables in the request
    const { resolvedRequest, unresolvedVars } = options.resolveVariables
      ? resolveHttpRequestTemplate(
          {
            url: mutatedRequest.url,
            headers: mutatedRequest.headers,
            params: mutatedRequest.params,
            body: mutatedRequest.body,
            globalHeaders: [],
            globalBaseUrl: "",
          },
          options.resolveVariables,
          options.chainInputs,
          options.aliasValues,
        )
      : {
          resolvedRequest: {
            url: mutatedRequest.url,
            headers: mutatedRequest.headers,
            body: mutatedRequest.body,
          },
          unresolvedVars: [],
        };

    const response = await runRequest(
      {
        method: mutatedRequest.method,
        url: resolvedRequest.url,
        headers: resolvedRequest.headers,
        body: resolvedRequest.body,
        auth: mutatedRequest.auth,
      },
      options.signal,
    );

    const httpPassed = response.status >= 200 && response.status < 300;
    const errorMsg = httpPassed
      ? undefined
      : `HTTP ${response.status} ${response.statusText}`;

    const assertions = options.nodeAssertions?.[nodeId] ?? [];
    const assertionResults =
      assertions.length > 0
        ? evaluateAllAssertions(assertions, response)
        : undefined;

    const assertionsFailed = assertionResults?.some((r) => !r.passed) ?? false;
    const state = httpPassed && !assertionsFailed ? "passed" : "failed";

    const finalError =
      errorMsg ??
      (assertionsFailed ? "One or more assertions failed" : undefined);
    const errorKind =
      state === "passed"
        ? undefined
        : errorMsg
          ? "network"
          : assertionsFailed
            ? "assertion"
            : undefined;

    runState[nodeId] = {
      state,
      extractedValues,
      response,
      error: finalError,
      assertionResults,
      unresolvedVars,
    };
    onUpdate(nodeId, state, {
      response,
      extractedValues,
      error: finalError,
      errorKind,
      assertionResults,
      unresolvedVars,
    });
  } catch (err) {
    const isAborted = options.signal.aborted;
    const error = isAborted
      ? "Run stopped"
      : err instanceof Error
        ? err.message
        : "Request failed";
    const state = isAborted ? "aborted" : "failed";
    const errorKind = isAborted ? undefined : "network";
    runState[nodeId] = { state, extractedValues, error };
    onUpdate(nodeId, state, { extractedValues, error, errorKind });
  }

  return true;
};
