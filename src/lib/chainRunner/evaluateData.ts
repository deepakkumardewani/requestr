import type { EvaluateInput } from "@/lib/chainEval";
import { tryParseJson } from "@/lib/chainJson";
import type { ResponseData } from "@/types";
import type { ChainEdge, ChainRunState } from "@/types/chain";
import { extractJsonPath, isExtractionEdge } from "./utils";

/** The sandbox input an Evaluate node receives, minus its code. */
export type EvaluateSandboxInput = Omit<EvaluateInput, "code">;

/** One value pulled through an edge injection, so callers can publish it as an alias. */
export type EvaluateEdgeExtraction = {
  edgeId: string;
  targetKey: string;
  value: string | null;
};

export type BuildEvaluateDataOptions = {
  incomingEdges: ChainEdge[];
  runState: ChainRunState;
  chainInputs?: Record<string, string>;
  envVars?: Record<string, string>;
};

export type BuildEvaluateDataResult = {
  input: EvaluateSandboxInput;
  extractions: EvaluateEdgeExtraction[];
};

/** Parses a response body as JSON when possible; falls back to the raw string. */
function parseResponseBody(response: ResponseData | undefined): unknown {
  if (!response) return undefined;
  return tryParseJson(response.body, response.body);
}

/**
 * Builds the `{ data, inputs, env }` an Evaluate node runs with: `data` is the
 * direct upstream node's response (parsed JSON when possible) plus each incoming
 * edge's aliased injection values. Pure so the executor and the panel's
 * "Test with last run" share one definition.
 */
export function buildEvaluateData({
  incomingEdges,
  runState,
  chainInputs,
  envVars,
}: BuildEvaluateDataOptions): BuildEvaluateDataResult {
  const extractionEdges = incomingEdges.filter(isExtractionEdge);
  const upstreamEdge = extractionEdges[0];
  const upstreamResponse = upstreamEdge
    ? runState[upstreamEdge.sourceRequestId]?.response
    : undefined;

  const aliasedValues: Record<string, string | null> = {};
  const extractions: EvaluateEdgeExtraction[] = [];
  for (const edge of extractionEdges) {
    const srcResponse = runState[edge.sourceRequestId]?.response;
    for (const injection of edge.injections ?? []) {
      const value = srcResponse
        ? extractJsonPath(srcResponse.body, injection.sourceJsonPath)
        : null;
      aliasedValues[injection.targetKey] = value;
      extractions.push({
        edgeId: edge.id,
        targetKey: injection.targetKey,
        value,
      });
    }
  }

  return {
    input: {
      data: { ...aliasedValues, response: parseResponseBody(upstreamResponse) },
      inputs: chainInputs ?? {},
      env: envVars ?? {},
    },
    extractions,
  };
}
