/**
 * Pure evaluation logic for "evaluate" chain blocks. Runs with `new Function`, shadowing
 * network/storage globals as parameters (defence in depth). The real lockdown of the
 * worker global lives in chainEvalLockdown.ts and is applied by chainEvalWorker.ts, since
 * parameter shadowing alone is bypassable via `globalThis.fetch`.
 * Best-effort only, not a hard boundary: dynamic `import("https://...")` cannot be blocked
 * by neutralising globals, and no CSP (`connect-src 'none'`) or null-origin sandbox is
 * enforced, so a determined script may still reach the network.
 * Kept side-effect free and framework-agnostic so it is unit-testable in plain node
 * without mocking `Worker` — the worker/host layers (chainEvalWorker.ts, chainEvalHost.ts)
 * are thin wrappers around this function.
 */

import { BLOCKED_GLOBALS } from "@/lib/chainEvalLockdown";

export type EvaluateInput = {
  code: string;
  data: unknown;
  inputs: Record<string, string>;
  env: Record<string, string>;
};

export type EvaluateResult = { output: unknown } | { error: string };

/** Host -> worker message: the input plus an id used to correlate the response. */
export type EvaluateRequest = EvaluateInput & { id: number };

/** Worker -> host message echoing the request id. */
export type EvaluateResponse = { id: number; result: EvaluateResult };

const ARGUMENT_NAMES = ["data", "inputs", "env"] as const;
const PARAMETER_NAMES = [...ARGUMENT_NAMES, ...BLOCKED_GLOBALS];

/**
 * Prefers treating `code` as a single expression; falls back to a statement body when
 * that does not compile (explicit `return`, multiple statements). Trying the compile
 * beats sniffing for the substring "return", which misfires on `data.return_url` and
 * comments. The newline before `)` keeps a trailing `// comment` from swallowing it.
 */
function compileUserCode(code: string): (...args: unknown[]) => unknown {
  try {
    return new Function(...PARAMETER_NAMES, `return (${code}\n);`) as (
      ...args: unknown[]
    ) => unknown;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return new Function(...PARAMETER_NAMES, code) as (
      ...args: unknown[]
    ) => unknown;
  }
}

/** Evaluates `code` with `data`, `inputs`, and `env` bound as arguments. */
export function evaluateInSandbox({
  code,
  data,
  inputs,
  env,
}: EvaluateInput): EvaluateResult {
  try {
    const output = compileUserCode(code)(data, inputs, env);
    return { output };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
