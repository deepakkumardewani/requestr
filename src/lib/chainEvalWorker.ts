import {
  type EvaluateRequest,
  type EvaluateResponse,
  evaluateInSandbox,
} from "@/lib/chainEval";
import { lockdownGlobals } from "@/lib/chainEvalLockdown";

// Runs before any user code can execute; postMessage/onmessage stay usable.
lockdownGlobals();

// Thin message plumbing only — all logic lives in chainEval.ts (unit-tested there).
// Excluded from coverage in vitest.config.ts for that reason.
self.onmessage = (e: MessageEvent<EvaluateRequest>) => {
  const { id, ...input } = e.data;
  const response: EvaluateResponse = { id, result: evaluateInSandbox(input) };
  postMessage(response);
};
