import type { ChainInput, ChainRunState, StartBlock } from "@/types/chain";
import type { ExecutionContext, NodeExecutor, OnUpdateFn } from "../types";

/**
 * Effective value of a Start input. Env-sourced inputs read `envVarKey`
 * (falling back to the input's own `key`) from the active environment;
 * a missing env var falls back to `defaultValue`. Overrides are applied by
 * the caller and always win.
 */
export function resolveStartInputValue(
  input: ChainInput,
  envVars: Record<string, string> = {},
): string {
  if (input.source !== "env") return input.defaultValue;
  const envKey = input.envVarKey?.trim() || input.key;
  return Object.hasOwn(envVars, envKey) ? envVars[envKey] : input.defaultValue;
}

export type StartExecutorInput = {
  nodeId: string;
  startBlock: StartBlock;
  /** Run-time override values, keyed by `ChainInput.key` — win over the input's default. */
  overrides?: Record<string, string>;
  /** Active environment variables, consulted by `source: "env"` inputs. */
  envVars?: Record<string, string>;
  runState: ChainRunState;
  onUpdate: OnUpdateFn;
};

/**
 * Executes a chain's Start block: resolves every declared input's effective
 * value (override, then env value for `source: "env"`, then `defaultValue`) and records
 * them in the extracted-values map on the Start step before any downstream
 * node runs. Downstream nodes look up an input's value by its `key`.
 */
export function startExecutor({
  nodeId,
  startBlock,
  overrides = {},
  envVars,
  runState,
  onUpdate,
}: StartExecutorInput): Record<string, string> {
  onUpdate(nodeId, "running", {});

  const resolvedInputs: Record<string, string> = {};
  const extractedValues: Record<string, string | null> = {};

  for (const input of startBlock.inputs) {
    const value =
      input.key in overrides
        ? overrides[input.key]
        : resolveStartInputValue(input, envVars);
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
    envVars: context.options.envVars,
    runState: context.runState,
    onUpdate: context.onUpdate,
  });

  context.options.chainInputs = resolvedInputs;
  return true;
};
