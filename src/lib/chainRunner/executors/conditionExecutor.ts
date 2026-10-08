import {
  evaluateCondition,
  resolveConditionVariable,
} from "@/lib/chainControlFlow";
import type { StepWarning } from "@/lib/chainRunHistory";
import {
  buildNamespaceObject,
  compactWarnings,
  registerEdgeAlias,
} from "@/lib/chainValueNamespace";
import { CHAIN_ERROR_CODE, chainError } from "../errorCodes";
import type { ExecutionContext, NodeExecutor } from "../types";
import { extractJsonPath, recordIfAborted } from "../utils";

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
  if (recordIfAborted(context)) return true;

  onUpdate(nodeId, "running", {});

  // Extract values from non-routing incoming edges and publish each into the
  // shared value namespace (tier 2) under its alias, per the single-namespace
  // spec, so `node.variable` resolves through the same namespace as request
  // templates and injections rather than a condition-local map.
  const extractedValues: Record<string, string | null> = {};
  const aliasWarnings: Array<StepWarning | undefined> = [];
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
      aliasWarnings.push(
        registerEdgeAlias(
          options.aliasValues,
          edge.id,
          injection.targetKey,
          extracted,
        ),
      );
    }
  }

  const warnings = compactWarnings(aliasWarnings);
  const varValues = buildNamespaceObject(options);
  const varName = resolveConditionVariable(conditionNode.variable);
  const unresolvedVars =
    varName && !Object.hasOwn(varValues, varName) ? [varName] : [];
  const inputs = {
    condition: {
      variable: conditionNode.variable,
      // Same lookup `evaluateCondition` performs, so the recorded value is what was tested.
      value: varValues[varName] ?? "",
    },
  };
  const winningBranchId = evaluateCondition(conditionNode, varValues);

  if (winningBranchId === null) {
    const failure = chainError(CHAIN_ERROR_CODE.NO_BRANCH_MATCHED);
    runState[nodeId] = {
      state: "failed",
      extractedValues,
      error: failure.error,
    };
    onUpdate(nodeId, "failed", {
      ...failure,
      inputs,
      warnings,
      unresolvedVars,
    });
  } else {
    runState[nodeId] = {
      state: "passed",
      extractedValues,
      activeBranchId: winningBranchId,
    };
    onUpdate(nodeId, "passed", {
      extractedValues,
      activeBranchId: winningBranchId,
      inputs,
      warnings,
      unresolvedVars,
    });
  }

  return true;
};
