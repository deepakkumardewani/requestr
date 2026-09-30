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
export const executorMap: Record<string, NodeExecutor | undefined> = {
  // API/request node (default type for RequestModel)
  api: apiExecutor,
  history: apiExecutor, // history is an alias for api
  delay: delayExecutor,
  condition: conditionExecutor,
  display: displayExecutor,
  start: startNodeExecutor,
  evaluate: evaluateExecutor,
  validate: validateExecutor,
  merge: mergeExecutor,
};

/**
 * Get the executor for a given block type.
 * `blockType` undefined falls back to `apiExecutor` (backward compat for
 * plain API nodes, which have no explicit block type). Any other,
 * genuinely unregistered block type throws instead of silently degrading
 * into `apiExecutor` — a mismatch there would run the wrong request rather
 * than surface the missing-executor bug.
 */
export function getExecutor(blockType: string | undefined): NodeExecutor {
  if (blockType === undefined) return apiExecutor;
  const executor = executorMap[blockType];
  if (!executor) {
    throw new Error(`No executor registered for block type "${blockType}"`);
  }
  return executor;
}
