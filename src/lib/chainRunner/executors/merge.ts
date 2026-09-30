import type { ChainNodeState, MergeBlock } from "@/types/chain";
import type { ExecutionContext, NodeExecutor } from "../types";

/**
 * Fan-in rule for a Merge block: whether it must be skipped given the final
 * states of its upstream branches.
 * - `"all"` requires every upstream branch to have passed; any non-passed
 *   input (failed or skipped) collapses the Merge to skipped.
 * - `"any"` requires at least one upstream branch to have passed.
 * Exported so the scheduler's `shouldSkipNode` can reuse this single source
 * of truth instead of duplicating the fan-in rule.
 */
export function shouldSkipMerge(
  mode: MergeBlock["mode"],
  upstreamStates: Array<{ state: ChainNodeState } | undefined>,
): boolean {
  const anyPassed = upstreamStates.some((s) => s?.state === "passed");
  const allPassed =
    upstreamStates.length > 0 &&
    upstreamStates.every((s) => s?.state === "passed");
  return mode === "all" ? !allPassed : !anyPassed;
}

/**
 * Execute a merge node in the chain.
 * By the time the scheduler dispatches this executor, `shouldSkipMerge` has
 * already determined the fan-in rule is satisfied (every incoming edge's
 * source has resolved — Kahn's algorithm only drops the Merge's in-degree
 * to 0 once all predecessors finish), so Merge has no extraction work of
 * its own: it simply joins the branches by marking itself passed.
 */
export const mergeExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  const { nodeId, runState, onUpdate } = context;

  onUpdate(nodeId, "running", {});
  runState[nodeId] = { state: "passed", extractedValues: {} };
  onUpdate(nodeId, "passed", { extractedValues: {} });

  return true;
};
