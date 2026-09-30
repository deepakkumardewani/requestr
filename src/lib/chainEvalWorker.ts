import { type EvaluateInput, evaluateInSandbox } from "@/lib/chainEval";

// Thin message plumbing only — all logic lives in chainEval.ts (unit-tested there).
// Excluded from coverage in vitest.config.ts for that reason.
self.onmessage = (e: MessageEvent<EvaluateInput>) => {
  postMessage(evaluateInSandbox(e.data));
};
