import { resolveDelay } from "@/lib/chainControlFlow";
import { CHAIN_ERROR_CODE, chainError } from "../errorCodes";
import type { ExecutionContext, NodeExecutor } from "../types";

/**
 * Execute a delay node in the chain.
 */
export const delayExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  const { nodeId, runState, delayNodeMap, onUpdate, options } = context;
  const delayNode = delayNodeMap.get(nodeId);

  if (!delayNode) return false;

  const inputs = { delayMs: delayNode.delayMs };
  onUpdate(nodeId, "running", {});
  try {
    await resolveDelay(delayNode, options.signal);
    runState[nodeId] = { state: "passed", extractedValues: {} };
    onUpdate(nodeId, "passed", { inputs });
  } catch {
    // Abort semantics (spec, Phase 2): the node in flight when Stop is
    // pressed ends `aborted`, never `skipped` — `skipped` is reserved for
    // nodes that never started.
    const isAborted = options.signal.aborted;
    const state = isAborted ? "aborted" : "failed";
    const failure = chainError(
      isAborted
        ? CHAIN_ERROR_CODE.RUN_STOPPED
        : CHAIN_ERROR_CODE.DELAY_INTERRUPTED,
    );
    runState[nodeId] = { state, extractedValues: {}, error: failure.error };
    onUpdate(nodeId, state, { ...failure, inputs });
  }

  return true;
};
