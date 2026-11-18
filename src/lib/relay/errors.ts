/**
 * Relay error taxonomy (FR-70). Only these codes ever cross the server/client
 * boundary: provider messages, status text, headers and env var names are
 * dropped in `mapProviderError` (FR-62).
 */
export const RELAY_ERROR_CODES = [
  "relay_unavailable",
  "rate_limited",
  "offline",
  "context_too_long",
  "tool_failed",
  "aborted",
  "not_configured",
] as const;

export type RelayErrorCode = (typeof RELAY_ERROR_CODES)[number];

/**
 * Raised on the client when the step cap ends a turn, never by the server, so it
 * stays out of the wire taxonomy above (HH-L23).
 */
export const STEP_CAP_ERROR_CODE = "step_cap";

/** Every code the error bubble can show: wire codes plus client-only ones. */
export type RelayDisplayErrorCode = RelayErrorCode | typeof STEP_CAP_ERROR_CODE;

/** What the error bubble offers the user to recover. */
export type RelayRecoveryAction =
  | "retry"
  | "retry_after_countdown"
  | "retry_when_online"
  | "edit_message"
  | "continue"
  | "none";

type RelayErrorMeta = {
  /** Key under the `relay` i18n namespace. */
  messageKey: string;
  action: RelayRecoveryAction;
};

export const RELAY_ERROR_META: Record<RelayDisplayErrorCode, RelayErrorMeta> = {
  relay_unavailable: { messageKey: "errors.relayUnavailable", action: "retry" },
  rate_limited: {
    messageKey: "errors.rateLimited",
    action: "retry_after_countdown",
  },
  offline: { messageKey: "errors.offline", action: "retry_when_online" },
  context_too_long: {
    messageKey: "errors.contextTooLong",
    action: "edit_message",
  },
  tool_failed: { messageKey: "errors.toolFailed", action: "retry" },
  aborted: { messageKey: "errors.aborted", action: "none" },
  not_configured: { messageKey: "errors.notConfigured", action: "none" },
  [STEP_CAP_ERROR_CODE]: { messageKey: "errors.stepCap", action: "continue" },
};

/** The user message Continue sends to let the model pick the work back up (HH-L23). */
export const STEP_CAP_CONTINUE_PROMPT = "Continue";

export type MappedRelayError = {
  code: RelayErrorCode;
  retryAfterSeconds?: number;
};

/** An error as the chat surface shows it; may carry a client-only code. */
export type RelayDisplayError = Omit<MappedRelayError, "code"> & {
  code: RelayDisplayErrorCode;
};

export class RelayError extends Error {
  readonly code: RelayErrorCode;
  readonly retryAfterSeconds?: number;

  constructor({ code, retryAfterSeconds }: MappedRelayError) {
    super(code);
    this.name = "RelayError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRelayErrorCode(value: unknown): value is RelayErrorCode {
  return (
    typeof value === "string" &&
    (RELAY_ERROR_CODES as readonly string[]).includes(value)
  );
}

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_PAYLOAD_TOO_LARGE = 413;
/** Wrong key or unknown model: a server configuration problem (SPIKE B). */
const CONFIG_STATUSES: readonly number[] = [400, 401, 403, 404];
/** Provider-side codes that mean the prompt exceeded the context window. */
const CONTEXT_CODES: readonly string[] = [
  "context_length_exceeded",
  "context_too_long",
  "string_above_max_length",
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readStatus(err: Record<string, unknown>): number | undefined {
  const status = err.statusCode ?? err.status;
  return typeof status === "number" ? status : undefined;
}

/** Looks only at structured `code`/`type` fields, never at message text. */
function hasContextCode(err: Record<string, unknown>): boolean {
  const data = asRecord(err.data);
  const inner = asRecord(data?.error) ?? data;
  return [inner?.code, inner?.type].some(
    (value) => typeof value === "string" && CONTEXT_CODES.includes(value),
  );
}

function readRetryAfterSeconds(
  err: Record<string, unknown>,
): number | undefined {
  const headers = asRecord(err.responseHeaders);
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  const seconds = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * Maps any thrown provider/transport value to a Relay code. Unknown shapes
 * default to `relay_unavailable`. 429, 402 and context-too-long were not
 * reproducible in SPIKE B, so they are mapped by status and structured code.
 */
export function mapProviderError(err: unknown): MappedRelayError {
  if (err instanceof RelayError) {
    return { code: err.code, retryAfterSeconds: err.retryAfterSeconds };
  }
  const record = asRecord(err);
  if (!record) return { code: "relay_unavailable" };
  if (record.name === "AbortError") return { code: "aborted" };

  const status = readStatus(record);
  if (status === HTTP_TOO_MANY_REQUESTS) {
    return {
      code: "rate_limited",
      retryAfterSeconds: readRetryAfterSeconds(record),
    };
  }
  if (status === HTTP_PAYLOAD_TOO_LARGE || hasContextCode(record)) {
    return { code: "context_too_long" };
  }
  if (status !== undefined && CONFIG_STATUSES.includes(status)) {
    return { code: "not_configured" };
  }
  return { code: "relay_unavailable" };
}

type ParsedClientError = MappedRelayError | null;

function fromRecord(value: unknown): ParsedClientError {
  const record = asRecord(value);
  if (!record || !isRelayErrorCode(record.error)) return null;
  const seconds = record.retryAfterSeconds;
  return {
    code: record.error,
    retryAfterSeconds:
      typeof seconds === "number" && seconds > 0 ? seconds : undefined,
  };
}

/**
 * Recovers a Relay code from what the AI SDK client throws: either the bare
 * code (stream `onError`) or the JSON body of a non-2xx response. Anything
 * else returns null so the caller can fall back by transport state.
 */
export function parseRelayErrorMessage(message: string): ParsedClientError {
  const trimmed = message.trim();
  if (isRelayErrorCode(trimmed)) return { code: trimmed };
  try {
    return fromRecord(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

/**
 * Every registered tool name is snake_case. Matching the shape, not the registry,
 * keeps the tool schemas out of the app shell's static imports (NFR-2).
 */
const TOOL_NAME_SHAPE_PATTERN = /\b[a-z]+(?:_[a-z]+)+\b/;

/**
 * Tool failure text safe to show (BUG-03): text that names a tool
 * (any snake_case identifier) is dropped so the caller falls back to its plain-language label.
 */
export function toUserFacingToolError(
  text: string | undefined,
): string | undefined {
  if (text === undefined) return undefined;
  return TOOL_NAME_SHAPE_PATTERN.test(text) ? undefined : text;
}

/** Result recorded for a call that never returned: nothing is known about what it did (HH-L03). */
export const TOOL_INTERRUPTED_ERROR =
  "interrupted before it finished; the outcome is unknown";
/** Result recorded for an approved call the page closed on: it may have applied (HH-M22). */
export const TOOL_MAYBE_APPLIED_ERROR =
  "interrupted while running; it may have applied";

export type ToolInterruption = "unknown" | "maybe_applied";

/** Which interruption a stored tool result records, or null for any other result. */
export function readToolInterruption(output: unknown): ToolInterruption | null {
  if (typeof output !== "object" || output === null) return null;
  const { ok, error } = output as { ok?: unknown; error?: unknown };
  if (ok !== false) return null;
  if (error === TOOL_MAYBE_APPLIED_ERROR) return "maybe_applied";
  return error === TOOL_INTERRUPTED_ERROR ? "unknown" : null;
}
