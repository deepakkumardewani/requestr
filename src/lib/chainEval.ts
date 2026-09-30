/**
 * Pure evaluation logic for "evaluate" chain blocks. Runs entirely with `new Function`,
 * so it has no access to DOM/fetch/storage APIs beyond what the host environment already
 * exposes to synchronous function scope (i.e. none, when instantiated inside a Worker).
 * Kept side-effect free and framework-agnostic so it is unit-testable in plain node
 * without mocking `Worker` — the worker/host layers (chainEvalWorker.ts, chainEvalHost.ts)
 * are thin wrappers around this function.
 */

export type EvaluateInput = {
  code: string;
  data: unknown;
  inputs: Record<string, string>;
  env: Record<string, string>;
};

export type EvaluateResult = { output: unknown } | { error: string };

/** Evaluates `code` with `data`, `inputs`, and `env` bound as arguments. */
export function evaluateInSandbox({
  code,
  data,
  inputs,
  env,
}: EvaluateInput): EvaluateResult {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "data",
      "inputs",
      "env",
      code.includes("return") ? code : `return (${code});`,
    );
    const output = fn(data, inputs, env);
    return { output };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
