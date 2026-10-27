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

/** What the error bubble offers the user to recover. */
export type RelayRecoveryAction =
  | "retry"
  | "retry_after_countdown"
  | "retry_when_online"
  | "edit_message"
  | "none";

type RelayErrorMeta = {
  /** Key under the `relay` i18n namespace. */
  messageKey: string;
  action: RelayRecoveryAction;
};

export const RELAY_ERROR_META: Record<RelayErrorCode, RelayErrorMeta> = {
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
};

export type MappedRelayError = {
  code: RelayErrorCode;
  retryAfterSeconds?: number;
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
