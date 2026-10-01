import { useMemo } from "react";
import { useActiveEnvVars } from "@/hooks/useActiveEnvVars";
import {
  buildEvaluateData,
  type EvaluateSandboxInput,
} from "@/lib/chainRunner/evaluateData";
import type { ChainEdge, ChainRunState, StartBlock } from "@/types/chain";

type Options = {
  nodeId: string | null;
  edges: ChainEdge[];
  runState: ChainRunState;
  startBlock: StartBlock | null;
  envVars: Record<string, string>;
};

/** Chain inputs as the last run resolved them (recorded on the Start step). */
function lastRunChainInputs(
  runState: ChainRunState,
  startBlock: StartBlock | null,
): Record<string, string> {
  const extracted = startBlock ? runState[startBlock.id]?.extractedValues : {};
  const inputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(extracted ?? {})) {
    if (value !== null) inputs[key] = value;
  }
  return inputs;
}

/**
 * Builds the `{ data, inputs, env }` the Evaluate panel's "Test with last run"
 * evaluates against, from the last run's per-node state. Returns undefined when
 * no node is open.
 */
export function buildEvaluateTestInput({
  nodeId,
  edges,
  runState,
  startBlock,
  envVars,
}: Options): EvaluateSandboxInput | undefined {
  if (!nodeId) return undefined;
  return buildEvaluateData({
    incomingEdges: edges.filter((e) => e.targetRequestId === nodeId),
    runState,
    chainInputs: lastRunChainInputs(runState, startBlock),
    envVars,
  }).input;
}

export function useEvaluateTestInput(
  options: Omit<Options, "envVars">,
): EvaluateSandboxInput | undefined {
  const envVars = useActiveEnvVars();
  const { nodeId, edges, runState, startBlock } = options;
  return useMemo(
    () =>
      buildEvaluateTestInput({ nodeId, edges, runState, startBlock, envVars }),
    [nodeId, edges, runState, startBlock, envVars],
  );
}
