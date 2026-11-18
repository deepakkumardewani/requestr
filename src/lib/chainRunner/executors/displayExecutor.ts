import { compactWarnings, registerAlias } from "@/lib/chainValueNamespace";
import { CHAIN_ERROR_CODE, chainError } from "../errorCodes";
import type { ExecutionContext, NodeExecutor } from "../types";
import { extractJsonPath } from "../utils";

/**
 * Execute a display node in the chain.
 * Extracts a value and makes it available for downstream injection.
 */
export const displayExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  const { nodeId, incomingEdges, runState, displayNodeMap, onUpdate, options } =
    context;

  const displayNode = displayNodeMap.get(nodeId);
  if (!displayNode) return false;

  onUpdate(nodeId, "running", {});

  // Find the inbound edge to locate the source response
  const inboundEdge = incomingEdges[0];
  const sourceState = inboundEdge
    ? runState[inboundEdge.sourceRequestId]
    : undefined;
  const sourceResponse = sourceState?.response;

  if (!sourceResponse || !displayNode.sourceJsonPath) {
    const failure = chainError(
      !sourceResponse
        ? CHAIN_ERROR_CODE.DISPLAY_NO_SOURCE
        : CHAIN_ERROR_CODE.DISPLAY_NO_PATH,
    );
    runState[nodeId] = {
      state: "failed",
      extractedValues: {},
      error: failure.error,
    };
    onUpdate(nodeId, "failed", failure);
    return true;
  }

  const extracted = extractJsonPath(
    sourceResponse.body,
    displayNode.sourceJsonPath,
  );
  const extractedValues: Record<string, string | null> = {
    [nodeId]: extracted,
    // Detailed key (`id:$.path`) is what the run-log Extracted tab renders.
    [`${nodeId}:${displayNode.sourceJsonPath}`]: extracted,
  };

  if (extracted === null) {
    const failure = chainError(CHAIN_ERROR_CODE.DISPLAY_EXTRACT_FAILED, {
      path: displayNode.sourceJsonPath,
    });
    runState[nodeId] = {
      state: "failed",
      extractedValues,
      error: failure.error,
    };
    onUpdate(nodeId, "failed", { extractedValues, ...failure });
    return true;
  }

  // Publish into the shared value namespace (tier 2) under the display
  // block's targetKey — the alias name a downstream `{{name}}` template can
  // reference, per the single-namespace spec.
  const warnings = compactWarnings([
    registerAlias(options.aliasValues, displayNode.targetKey, extracted, {
      owner: { kind: "display", id: nodeId },
    }),
  ]);

  runState[nodeId] = { state: "passed", extractedValues };
  onUpdate(nodeId, "passed", { extractedValues, warnings });

  return true;
};
