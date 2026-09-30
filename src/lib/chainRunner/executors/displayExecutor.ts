import { registerAlias } from "@/lib/chainValueNamespace";
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
    const error = !sourceResponse
      ? "No response from source node"
      : "Display node has no extraction path configured";
    runState[nodeId] = { state: "failed", extractedValues: {}, error };
    onUpdate(nodeId, "failed", { error });
    return true;
  }

  const extracted = extractJsonPath(
    sourceResponse.body,
    displayNode.sourceJsonPath,
  );
  const extractedValues: Record<string, string | null> = {
    [nodeId]: extracted,
  };

  if (extracted === null) {
    const error = `Could not extract "${displayNode.sourceJsonPath}" from source response`;
    runState[nodeId] = { state: "failed", extractedValues, error };
    onUpdate(nodeId, "failed", { extractedValues, error });
    return true;
  }

  // Publish into the shared value namespace (tier 2) under the display
  // block's targetKey — the alias name a downstream `{{name}}` template can
  // reference, per the single-namespace spec.
  registerAlias(options.aliasValues, displayNode.targetKey, extracted);

  runState[nodeId] = { state: "passed", extractedValues };
  onUpdate(nodeId, "passed", { extractedValues });

  return true;
};
