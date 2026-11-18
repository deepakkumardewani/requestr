import { evaluateAllAssertions } from "@/lib/chainAssertions";
import type { SerialisedRequest, StepWarning } from "@/lib/chainRunHistory";
import { compactWarnings, registerEdgeAlias } from "@/lib/chainValueNamespace";
import { runRequest } from "@/lib/requestRunner";
import { resolveHttpRequestTemplate } from "@/lib/resolveRequest";
import { CHAIN_ERROR_CODE, chainError } from "../errorCodes";
import { serialiseHttpRequest } from "../stepRecording";
import { ERROR_KIND, type ExecutionContext, type NodeExecutor } from "../types";
import {
  applyInjection,
  extractJsonPath,
  InjectionError,
  isExtractionEdge,
  recordIfAborted,
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
  if (recordIfAborted(context)) return true;

  onUpdate(nodeId, "running", {});

  // Only extract from non-routing edges
  const extractionEdges = incomingEdges.filter(isExtractionEdge);
  // Copy fields injections rewrite so a run does not persist them onto the saved request.
  let mutatedRequest = {
    ...request,
    headers: request.headers.map((header) => ({ ...header })),
    params: request.params.map((param) => ({ ...param })),
    body: { ...request.body },
  };
  const extractedValues: Record<string, string | null> = {};
  let injectionError: InjectionError | null = null;
  const aliasWarnings: Array<StepWarning | undefined> = [];

  const { envPromotions, onPromoteToEnv } = options;
  // Written only after this node returns a response. An abort during the
  // request must not publish the value (the run never finished).
  const pendingPromotions: Array<{
    envId: string;
    envVarName: string;
    value: string;
  }> = [];

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
        aliasWarnings.push(
          registerEdgeAlias(
            options.aliasValues,
            edge.id,
            injection.targetKey,
            extracted,
            // A Display block already published this alias as its own; the
            // edge out of it re-applies the same value, not a competing write.
            sourceIsDisplay
              ? { owner: { kind: "display", id: edge.sourceRequestId } }
              : undefined,
          ),
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
            pendingPromotions.push({
              envId: promotion.envId,
              envVarName: promotion.envVarName,
              value: extracted,
            });
          }
        } catch (err) {
          if (err instanceof InjectionError) {
            injectionError = err;
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
    const failure = chainError(injectionError.code);
    onUpdate(nodeId, "failed", {
      extractedValues,
      ...failure,
      errorKind: "injection",
      warnings: compactWarnings(aliasWarnings),
    });
    runState[nodeId] = {
      state: "failed",
      extractedValues,
      error: failure.error,
    };
    return true;
  }

  // An extraction miss fails the target (consistent with Validate, Loop and Display) so the run cannot end Passed.
  const extractionFailed = extractionEdges.some(
    (e) => extractedValues[e.id] === null,
  );

  if (extractionFailed && extractionEdges.length > 0) {
    const failure = chainError(CHAIN_ERROR_CODE.EXTRACTION_FAILED);
    onUpdate(nodeId, "failed", {
      extractedValues,
      ...failure,
      errorKind: ERROR_KIND.EXTRACTION,
      warnings: compactWarnings(aliasWarnings),
    });
    runState[nodeId] = {
      state: "failed",
      extractedValues,
      error: failure.error,
    };
    return true;
  }

  // Hoisted so a network failure still records what was attempted.
  let sentRequest: SerialisedRequest | undefined;
  const assertions = options.nodeAssertions?.[nodeId] ?? [];

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

    sentRequest = serialiseHttpRequest({
      method: mutatedRequest.method,
      url: resolvedRequest.url,
      headers: resolvedRequest.headers,
      body: resolvedRequest.body?.content,
    });

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

    if (!options.signal.aborted) {
      for (const promotion of pendingPromotions) {
        onPromoteToEnv?.(
          promotion.envId,
          promotion.envVarName,
          promotion.value,
        );
      }
    }

    const httpPassed = response.status >= 200 && response.status < 300;
    const httpFailure = httpPassed
      ? undefined
      : chainError(CHAIN_ERROR_CODE.HTTP_STATUS, {
          status: response.status,
          statusText: response.statusText,
        });

    const assertionResults =
      assertions.length > 0
        ? evaluateAllAssertions(assertions, response)
        : undefined;

    const assertionsFailed = assertionResults?.some((r) => !r.passed) ?? false;
    const state = httpPassed && !assertionsFailed ? "passed" : "failed";

    const finalFailure =
      httpFailure ??
      (assertionsFailed
        ? chainError(CHAIN_ERROR_CODE.ASSERTIONS_FAILED)
        : undefined);
    const errorKind =
      state === "passed"
        ? undefined
        : httpFailure
          ? "network"
          : assertionsFailed
            ? "assertion"
            : undefined;

    runState[nodeId] = {
      state,
      extractedValues,
      response,
      error: finalFailure?.error,
      assertionResults,
      unresolvedVars,
    };
    onUpdate(nodeId, state, {
      response,
      extractedValues,
      ...finalFailure,
      errorKind,
      assertionResults,
      assertions: assertionResults ? assertions : undefined,
      request: sentRequest,
      unresolvedVars,
      warnings: compactWarnings(aliasWarnings),
    });
  } catch (err) {
    const isAborted = options.signal.aborted;
    // Network `err.message` is third-party data, so only the fallbacks are typed.
    const failure =
      !isAborted && err instanceof Error
        ? { error: err.message }
        : chainError(
            isAborted
              ? CHAIN_ERROR_CODE.RUN_STOPPED
              : CHAIN_ERROR_CODE.REQUEST_FAILED,
          );
    const state = isAborted ? "aborted" : "failed";
    const errorKind = isAborted ? undefined : "network";
    runState[nodeId] = { state, extractedValues, error: failure.error };
    onUpdate(nodeId, state, {
      extractedValues,
      ...failure,
      errorKind,
      request: sentRequest,
      warnings: compactWarnings(aliasWarnings),
    });
  }

  return true;
};
