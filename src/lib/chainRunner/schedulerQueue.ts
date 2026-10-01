import type { ChainRunState } from "@/types/chain";

export type ProcessNode = (nodeId: string) => Promise<void>;

export type QueueState = {
  readyQueue: string[];
  inFlight: Map<string, Promise<void>>;
  runState: ChainRunState;
};

export type DrainOptions = {
  signal: AbortSignal;
  concurrency: number;
};

/** Starts queued nodes until `concurrency` are in flight; already-recorded nodes are dropped. */
export function dispatchReady(
  { readyQueue, inFlight, runState }: QueueState,
  processNode: ProcessNode,
  concurrency: number,
): void {
  while (readyQueue.length > 0 && inFlight.size < concurrency) {
    const nodeId = readyQueue.shift();
    if (nodeId === undefined) break;
    if (runState[nodeId] !== undefined) continue;
    const promise = processNode(nodeId).finally(() => {
      inFlight.delete(nodeId);
    });
    inFlight.set(nodeId, promise);
  }
}

/** Dispatches and awaits until nothing is queued or in flight; an aborted signal stops new dispatches. */
export async function drainQueue(
  state: QueueState,
  processNode: ProcessNode,
  { signal, concurrency }: DrainOptions,
): Promise<void> {
  const { readyQueue, inFlight } = state;
  while (readyQueue.length > 0 || inFlight.size > 0) {
    if (!signal.aborted) dispatchReady(state, processNode, concurrency);
    if (inFlight.size === 0) break;
    await Promise.race(inFlight.values());
  }
}
