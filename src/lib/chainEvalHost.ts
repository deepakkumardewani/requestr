import type {
  EvaluateInput,
  EvaluateRequest,
  EvaluateResponse,
  EvaluateResult,
} from "@/lib/chainEval";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorCode,
  type ChainErrorParams,
  chainError,
} from "@/lib/chainRunner/errorCodes";

/** Hard cap on how long a single evaluate block may run before its worker is killed. */
export const EVAL_TIMEOUT_MS = 5000;

/** A worker result that may carry a typed code for failures the host itself raises. */
export type EvaluateFailure = {
  error: string;
  errorCode?: ChainErrorCode;
  errorParams?: ChainErrorParams;
};

type HostResult = EvaluateResult | EvaluateFailure;

const TIMEOUT_FAILURE: EvaluateFailure = chainError(
  CHAIN_ERROR_CODE.EVALUATE_TIMEOUT,
  { ms: EVAL_TIMEOUT_MS },
);
const TERMINATED_FAILURE: EvaluateFailure = chainError(
  CHAIN_ERROR_CODE.EVALUATE_TERMINATED,
);

type PendingCall = {
  resolve: (result: HostResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

// Module-level singleton shared by every Evaluate node; created lazily.
let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, PendingCall>();

/** Settles and forgets every in-flight call. The worker is synchronous, so once it is
 *  killed or errors none of them can ever be answered. */
function settleAllPending(result: HostResult): void {
  for (const call of pending.values()) {
    clearTimeout(call.timeoutId);
    call.resolve(result);
  }
  pending.clear();
}

function settleOne(id: number, result: HostResult): void {
  const call = pending.get(id);
  if (!call) return;
  clearTimeout(call.timeoutId);
  pending.delete(id);
  call.resolve(result);
}

function createWorker(): Worker {
  const created = new Worker(new URL("./chainEvalWorker.ts", import.meta.url), {
    type: "module",
  });
  // One persistent listener pair per worker; responses are routed by request id.
  created.addEventListener("message", (e: MessageEvent<EvaluateResponse>) => {
    settleOne(e.data.id, e.data.result);
  });
  created.addEventListener("error", (e: ErrorEvent) => {
    if (worker === created) discardWorker();
    settleAllPending({ error: e.message });
  });
  return created;
}

function getWorker(): Worker {
  if (!worker) worker = createWorker();
  return worker;
}

function discardWorker(): void {
  worker?.terminate();
  worker = null;
}

/** Terminates and drops the current worker (if any), settling in-flight calls with an
 *  error. Safe to call multiple times; the next call lazily creates a fresh worker. */
export function terminateChainEvalWorker(): void {
  discardWorker();
  settleAllPending(TERMINATED_FAILURE);
}

/** Kills the worker after `id` timed out: that call gets the timeout error, every other
 *  in-flight call (blocked behind the same synchronous script) the terminated error. */
function handleTimeout(id: number): void {
  settleOne(id, TIMEOUT_FAILURE);
  terminateChainEvalWorker();
}

/**
 * Runs `input` in the sandboxed worker, enforcing {@link EVAL_TIMEOUT_MS}. Concurrent
 * calls are correlated by request id. On timeout the worker is terminated and a fresh
 * one is created for the next call, so a hung script cannot block future evaluations.
 */
export function runInWorker(input: EvaluateInput): Promise<HostResult> {
  const id = nextRequestId++;
  const activeWorker = getWorker();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => handleTimeout(id), EVAL_TIMEOUT_MS);
    pending.set(id, { resolve, timeoutId });
    const request: EvaluateRequest = { id, ...input };
    activeWorker.postMessage(request);
  });
}
