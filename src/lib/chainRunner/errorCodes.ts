/**
 * Typed error codes emitted by the chain runner. Executors never decide what
 * the user reads: they record a code (+ interpolation params) and the UI layer
 * translates it (`useChainErrorMessage`). Each value doubles as the message key
 * under `errors.chain.runError` in `messages/<locale>/errors.json`.
 */
export const CHAIN_ERROR_CODE = {
  RUN_STOPPED: "runStopped",
  DELAY_INTERRUPTED: "delayInterrupted",
  NO_BRANCH_MATCHED: "noBranchMatched",
  UPSTREAM_SKIPPED: "upstreamSkipped",
  MERGE_ALREADY_RESOLVED: "mergeAlreadyResolved",
  MERGE_LANE_FAILED: "mergeLaneFailed",
  CIRCULAR_DEPENDENCY: "circularDependency",
  LOOP_BODY_UNCONNECTED: "loopBodyUnconnected",
  LOOP_NO_PAIRED_COLLECT: "loopNoPairedCollect",
  COLLECT_NO_LOOP_RESULT: "collectNoLoopResult",
  LOOP_DEPTH_EXCEEDED: "loopDepthExceeded",
  LOOP_NO_UPSTREAM: "loopNoUpstream",
  LOOP_SOURCE_NOT_ARRAY: "loopSourceNotArray",
  LOOP_INVALID_MAX_ITERATIONS: "loopInvalidMaxIterations",
  LOOP_INVALID_ALIAS: "loopInvalidAlias",
  SCHEDULER_DEPTH_EXCEEDED: "schedulerDepthExceeded",
  SUBCHAIN_DEPTH_EXCEEDED: "subchainDepthExceeded",
  SUBCHAIN_FAILED: "subchainFailed",
  SUBCHAIN_REFERENCE_UNRESOLVED: "subchainReferenceUnresolved",
  INJECTION_BODY_NOT_JSON: "injectionBodyNotJson",
  INJECTION_BODY_TYPE_UNSUPPORTED: "injectionBodyTypeUnsupported",
  EXTRACTION_FAILED: "extractionFailed",
  EVALUATE_UNDEFINED_OUTPUT: "evaluateUndefinedOutput",
  EVALUATE_TIMEOUT: "evaluateTimeout",
  EVALUATE_TERMINATED: "evaluateTerminated",
  VALIDATE_NO_UPSTREAM: "validateNoUpstream",
  VALIDATE_INVALID_JSON: "validateInvalidJson",
  VALIDATE_INVALID_JSON_PATH: "validateInvalidJsonPath",
  VALIDATE_NO_MATCH: "validateNoMatch",
  VALIDATE_INVALID_SCHEMA_JSON: "validateInvalidSchemaJson",
  VALIDATE_INVALID_SCHEMA: "validateInvalidSchema",
  DISPLAY_NO_SOURCE: "displayNoSource",
  DISPLAY_NO_PATH: "displayNoPath",
  DISPLAY_EXTRACT_FAILED: "displayExtractFailed",
  HTTP_STATUS: "httpStatus",
  ASSERTIONS_FAILED: "assertionsFailed",
  REQUEST_FAILED: "requestFailed",
} as const;

export type ChainErrorCode =
  (typeof CHAIN_ERROR_CODE)[keyof typeof CHAIN_ERROR_CODE];

/** Values interpolated into the translated message (paths, limits, statuses). */
export type ChainErrorParams = Record<string, string | number>;

/**
 * English text recorded next to the code so consumers that do not translate
 * yet, and run history persisted before codes existed, still show a message.
 * `{name}` placeholders are filled from the params.
 */
const FALLBACK_MESSAGES: Record<ChainErrorCode, string> = {
  runStopped: "Run stopped",
  delayInterrupted: "Delay interrupted",
  noBranchMatched: "No branch matched",
  upstreamSkipped: "Dependency failed or skipped upstream",
  mergeAlreadyResolved:
    "Merge already resolved on an earlier branch (any mode)",
  mergeLaneFailed: "Merge failed because an upstream lane failed",
  circularDependency: "Circular dependency detected",
  loopBodyUnconnected: "Loop body is not connected",
  loopNoPairedCollect: "Loop has no paired Collect",
  collectNoLoopResult: "Collect has no paired Loop result",
  loopDepthExceeded: "Loop nesting exceeded the maximum depth",
  loopNoUpstream: "No upstream response to iterate over",
  loopSourceNotArray: 'sourceJsonPath "{path}" did not resolve to an array',
  loopInvalidMaxIterations:
    "Max iterations must be a whole number of at least 1 (got {value})",
  loopInvalidAlias:
    'Item alias "{alias}" must use only letters, digits or underscores and cannot be "index"',
  schedulerDepthExceeded: "Scheduler depth exceeded — loop nesting too deep",
  subchainDepthExceeded: "Sub-chain nesting exceeded the maximum depth",
  subchainFailed: "Sub-chain run failed",
  subchainReferenceUnresolved: "Sub-chain reference could not be resolved",
  injectionBodyNotJson: "Body is not JSON",
  injectionBodyTypeUnsupported:
    "Body injection needs a JSON body; change the request body type to JSON",
  extractionFailed: "Could not extract value from source response",
  evaluateUndefinedOutput:
    "Evaluate returned undefined - add a return statement",
  evaluateTimeout: "Evaluation timed out ({ms}ms)",
  evaluateTerminated:
    "Evaluation cancelled: the evaluation worker was restarted",
  validateNoUpstream: "No upstream response to validate",
  validateInvalidJson: "Upstream response body is not valid JSON",
  validateInvalidJsonPath: 'Invalid JSONPath "{path}"',
  validateNoMatch: 'JSONPath "{path}" matched nothing in the upstream response',
  validateInvalidSchemaJson: "Schema is not valid JSON: {detail}",
  validateInvalidSchema: "Schema is invalid: {detail}",
  displayNoSource: "No response from source node",
  displayNoPath: "Display node has no extraction path configured",
  displayExtractFailed: 'Could not extract "{path}" from source response',
  httpStatus: "HTTP {status} {statusText}",
  assertionsFailed: "One or more assertions failed",
  requestFailed: "Request failed",
};

/** What an executor spreads into `onUpdate` data: the code plus its English fallback. */
export type ChainErrorInfo = {
  error: string;
  errorCode: ChainErrorCode;
  errorParams?: ChainErrorParams;
};

export function formatFallbackMessage(
  code: ChainErrorCode,
  params?: ChainErrorParams,
): string {
  return FALLBACK_MESSAGES[code].replace(/\{(\w+)\}/g, (placeholder, name) =>
    name in (params ?? {}) ? String(params?.[name]) : placeholder,
  );
}

export function chainError(
  code: ChainErrorCode,
  params?: ChainErrorParams,
): ChainErrorInfo {
  return {
    error: formatFallbackMessage(code, params),
    errorCode: code,
    ...(params && { errorParams: params }),
  };
}

const CHAIN_ERROR_CODES = new Set<string>(Object.values(CHAIN_ERROR_CODE));

export function isChainErrorCode(value: unknown): value is ChainErrorCode {
  return typeof value === "string" && CHAIN_ERROR_CODES.has(value);
}
