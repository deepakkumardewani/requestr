import type { ChainRunState, StartBlock } from "@/types/chain";
import type { ExecutionContext, NodeExecutor, OnUpdateFn } from "../types";

export type StartExecutorInput = {
  nodeId: string;
  startBlock: StartBlock;
  /** Run-time override values, keyed by `ChainInput.key` — win over the input's default. */
  overrides?: Record<string, string>;
  runState: ChainRunState;
  onUpdate: OnUpdateFn;
};

/**
 * Executes a chain's Start block: resolves every declared input's effective
 * value (an override wins, otherwise the input's `defaultValue`) and records
 * them in the extracted-values map on the Start step before any downstream
 * node runs. Downstream nodes look up an input's value by its `key`.
 */
export function startExecutor({
  nodeId,
  startBlock,
  overrides = {},
  runState,
  onUpdate,
}: StartExecutorInput): Record<string, string> {
  onUpdate(nodeId, "running", {});

  const resolvedInputs: Record<string, string> = {};
  const extractedValues: Record<string, string | null> = {};

  for (const input of startBlock.inputs) {
    const value =
      input.key in overrides ? overrides[input.key] : input.defaultValue;
    resolvedInputs[input.key] = value;
    extractedValues[input.key] = value;
  }

  runState[nodeId] = { state: "passed", extractedValues };
  onUpdate(nodeId, "passed", { extractedValues });

  return resolvedInputs;
}

/**
 * `NodeExecutor`-shaped adapter so the dispatcher in `executors/index.ts`
 * can route "start" block types to `startExecutor` like every other node
 * type. Writes the resolved inputs into `context.options.chainInputs` —
 * mutating the shared `options` object, rather than returning a value — so
 * every downstream executor invoked afterwards via the same `options`
 * reference (see `chainRunner.ts`) sees the resolved values.
 */
export const startNodeExecutor: NodeExecutor = async (
  context: ExecutionContext,
) => {
  if (!context.startBlock) return false;

  const resolvedInputs = startExecutor({
    nodeId: context.nodeId,
    startBlock: context.startBlock,
    overrides: context.options.startOverrides,
    runState: context.runState,
    onUpdate: context.onUpdate,
  });

  context.options.chainInputs = resolvedInputs;
  return true;
};
