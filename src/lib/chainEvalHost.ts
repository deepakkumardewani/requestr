import type { EvaluateInput, EvaluateResult } from "@/lib/chainEval";

/** Hard cap on how long a single evaluate block may run before its worker is killed. */
export const EVAL_TIMEOUT_MS = 5000;

const TIMEOUT_ERROR = `Evaluation timed out (${EVAL_TIMEOUT_MS}ms)`;

// Module-level singleton, versioned so stale HMR closures can detect they're outdated
// and refuse to touch a worker instance they no longer own.
let worker: Worker | null = null;
let workerVersion = 0;

function createWorker(): Worker {
  return new Worker(new URL("./chainEvalWorker.ts", import.meta.url), {
    type: "module",
  });
}

function getWorker(): Worker {
  if (!worker) {
    worker = createWorker();
  }
  return worker;
}

/** Terminates and drops the current worker (if any). Safe to call multiple times. */
export function terminateChainEvalWorker(): void {
  worker?.terminate();
  worker = null;
  workerVersion += 1;
}

/**
 * Runs `input` in the sandboxed worker, enforcing {@link EVAL_TIMEOUT_MS}. On timeout the
 * worker is terminated and a fresh one is created for the next call, so a hung script
 * cannot block future evaluations.
 */
export function runInWorker(input: EvaluateInput): Promise<EvaluateResult> {
  const activeWorker = getWorker();
  const versionAtCallTime = workerVersion;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      // Only recycle the worker if nothing else already replaced it (e.g. unmount).
      if (workerVersion === versionAtCallTime) {
        terminateChainEvalWorker();
      }
      resolve({ error: TIMEOUT_ERROR });
    }, EVAL_TIMEOUT_MS);

    const handleMessage = (e: MessageEvent<EvaluateResult>) => {
      cleanup();
      resolve(e.data);
    };

    const handleError = (e: ErrorEvent) => {
      cleanup();
      resolve({ error: e.message });
    };

    function cleanup() {
      clearTimeout(timeoutId);
      activeWorker.removeEventListener("message", handleMessage);
      activeWorker.removeEventListener("error", handleError);
    }

    activeWorker.addEventListener("message", handleMessage);
    activeWorker.addEventListener("error", handleError);
    activeWorker.postMessage(input);
  });
}
