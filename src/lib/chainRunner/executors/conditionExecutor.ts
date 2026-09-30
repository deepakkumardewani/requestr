import { evaluateCondition } from "@/lib/chainControlFlow";
import {
  buildNamespaceObject,
  registerEdgeAlias,
} from "@/lib/chainValueNamespace";
import type { ExecutionContext, NodeExecutor } from "../types";
import { extractJsonPath } from "../utils";

/**
 * Execute a condition node in the chain.
 * Evaluates the condition and sets the active branch ID.
 */
export const conditionExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  const {
    nodeId,
    incomingEdges,
    runState,
    conditionNodeMap,
    onUpdate,
    options,
  } = context;

  const conditionNode = conditionNodeMap.get(nodeId);
  if (!conditionNode) return false;

  onUpdate(nodeId, "running", {});

  // Extract values from non-routing incoming edges and publish each into the
  // shared value namespace (tier 2) under its alias, per the single-namespace
  // spec, so `node.variable` resolves through the same namespace as request
  // templates and injections rather than a condition-local map.
  const extractedValues: Record<string, string | null> = {};
  for (const edge of incomingEdges) {
    if (edge.branchId) continue; // routing edge — no extraction needed
    const srcState = runState[edge.sourceRequestId];
    const response = srcState?.response;
    if (!response) {
      extractedValues[edge.id] = null;
      continue;
    }
    // For condition nodes, use the first injection's path to extract the variable to test
    const injection = edge.injections?.[0];
    const extracted = injection
      ? extractJsonPath(response.body, injection.sourceJsonPath)
      : null;
    extractedValues[edge.id] = extracted;
    if (injection) {
      registerEdgeAlias(
        options.aliasValues,
        edge.id,
        injection.targetKey,
        extracted,
      );
    }
  }

  const varValues = buildNamespaceObject(options);
  const winningBranchId = evaluateCondition(conditionNode, varValues);

  if (winningBranchId === null) {
    const error = "No branch matched";
    runState[nodeId] = { state: "failed", extractedValues, error };
    onUpdate(nodeId, "failed", { error });
  } else {
    runState[nodeId] = {
      state: "passed",
      extractedValues,
      activeBranchId: winningBranchId,
    };
    onUpdate(nodeId, "passed", {
      extractedValues,
      activeBranchId: winningBranchId,
    });
  }

  return true;
};
