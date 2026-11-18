import type { ChainNodeType } from "@/types/chain";
import type { NodeExecutor } from "../types";
import { apiExecutor } from "./apiExecutor";
import { conditionExecutor } from "./conditionExecutor";
import { delayExecutor } from "./delayExecutor";
import { displayExecutor } from "./displayExecutor";
import { evaluateExecutor } from "./evaluate";
import { mergeExecutor } from "./merge";
import { startNodeExecutor } from "./start";
import { validateExecutor } from "./validate";

/**
 * Dispatcher map from block type to executor function.
 * When a new block type is added, register its executor here.
 */
export const executorMap: Partial<Record<ChainNodeType, NodeExecutor>> = {
  // API/request node (default type for RequestModel)
  api: apiExecutor,
  delay: delayExecutor,
  condition: conditionExecutor,
  display: displayExecutor,
  start: startNodeExecutor,
  evaluate: evaluateExecutor,
  validate: validateExecutor,
  merge: mergeExecutor,
};

/**
 * Get the executor for a given block type. Loop, Collect and Sub-chain have
 * no entry: the scheduler dispatches them itself because they re-enter it.
 * `blockType` undefined falls back to `apiExecutor` (backward compat for
 * plain API nodes, which have no explicit block type). Any other,
 * genuinely unregistered block type throws instead of silently degrading
 * into `apiExecutor` — a mismatch there would run the wrong request rather
 * than surface the missing-executor bug.
 */
export function getExecutor(
  blockType: ChainNodeType | undefined,
): NodeExecutor {
  if (blockType === undefined) return apiExecutor;
  const executor = executorMap[blockType];
  if (!executor) {
    throw new Error(`No executor registered for block type "${blockType}"`);
  }
  return executor;
}
