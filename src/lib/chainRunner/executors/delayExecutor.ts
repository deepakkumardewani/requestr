import { resolveDelay } from "@/lib/chainControlFlow";
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

  onUpdate(nodeId, "running", {});
  try {
    await resolveDelay(delayNode, options.signal);
    runState[nodeId] = { state: "passed", extractedValues: {} };
    onUpdate(nodeId, "passed", {});
  } catch {
    // Abort semantics (spec, Phase 2): the node in flight when Stop is
    // pressed ends `aborted`, never `skipped` — `skipped` is reserved for
    // nodes that never started.
    const isAborted = options.signal.aborted;
    const state = isAborted ? "aborted" : "failed";
    const error = isAborted ? "Run stopped" : "Delay interrupted";
    runState[nodeId] = { state, extractedValues: {}, error };
    onUpdate(nodeId, state, { error });
  }

  return true;
};
