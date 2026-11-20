import {
  type ErrorRecord,
  MAX_ERROR_FRAMES_LENGTH,
  MAX_ERROR_MESSAGE_LENGTH,
} from "@/lib/analytics/events";

/**
 * Neutral error record (R26). Built from an error plus where it was caught;
 * nothing else (component props, component stack, breadcrumbs) is accepted,
 * so none of it can leak.
 */
export type ScrubbedError = ErrorRecord;
export type ErrorSource = ErrorRecord["source"];

/*
 * Fail-closed by design: a denylist of "sensitive-looking" text can never be
 * complete (engines echo request bodies verbatim, across newlines and cut off
 * mid-quote). So a message survives only when it matches a known engine
 * template, and is then rebuilt from the template's literal text: every slot
 * becomes REDACTED and only digits (JSON positions, React error codes) are
 * copied over. Anything else is reduced to the error name plus WITHHELD.
 */

const REDACTED = "[redacted]";
const WITHHELD = "[message withheld]";
/** Bounds regex work on hostile or huge messages. */
const MAX_INPUT_LENGTH = 2000;
const FALLBACK_ERROR_TYPE = "Error";
const NON_ERROR_MESSAGE = "Non-Error value thrown";

const SLOT_TOKEN = "{slot}";
const NUMBER_TOKEN = "{n}";
/** A quoted run (V8 may add `...` when it truncates the echo) or one bare word. */
const SLOT_SOURCE =
  "(?:\\.\\.\\.)?(?:\"[^\"]*\"|'[^']*'|`[^`]*`|[^\\s\"'`]+)(?:\\.\\.\\.)?";
const NUMBER_SOURCE = "(\\d{1,10})";
const JSON_LINE_COLUMN_SUFFIX = ` (line ${NUMBER_TOKEN} column ${NUMBER_TOKEN})`;

const withLineColumn = (template: string): string[] => [
  template,
  template + JSON_LINE_COLUMN_SUFFIX,
];

/** Engine message templates (V8, JavaScriptCore, SpiderMonkey, React, webpack). */
const SAFE_MESSAGE_TEMPLATES: readonly string[] = [
  NON_ERROR_MESSAGE,
  `Unexpected token ${SLOT_TOKEN}, ${SLOT_TOKEN} is not valid JSON`,
  `Unexpected token ${SLOT_TOKEN} in JSON at position ${NUMBER_TOKEN}`,
  "Unexpected end of JSON input",
  ...withLineColumn(
    `Unexpected non-whitespace character after JSON at position ${NUMBER_TOKEN}`,
  ),
  ...withLineColumn(`Unterminated string in JSON at position ${NUMBER_TOKEN}`),
  ...withLineColumn(
    `Expected property name or '}' in JSON at position ${NUMBER_TOKEN}`,
  ),
  ...withLineColumn(
    `Expected ',' or '}' after property value in JSON at position ${NUMBER_TOKEN}`,
  ),
  ...withLineColumn(
    `Expected ',' or ']' after array element in JSON at position ${NUMBER_TOKEN}`,
  ),
  ...withLineColumn(
    `Bad control character in string literal in JSON at position ${NUMBER_TOKEN}`,
  ),
  `JSON Parse error: Unexpected identifier ${SLOT_TOKEN}`,
  `JSON Parse error: Unrecognized token ${SLOT_TOKEN}`,
  "JSON Parse error: Unexpected EOF",
  "JSON Parse error: Unable to parse JSON string",
  `JSON.parse: unexpected character at line ${NUMBER_TOKEN} column ${NUMBER_TOKEN} of the JSON data`,
  `JSON.parse: unexpected end of data at line ${NUMBER_TOKEN} column ${NUMBER_TOKEN} of the JSON data`,
  `Cannot read properties of undefined (reading ${SLOT_TOKEN})`,
  `Cannot read properties of null (reading ${SLOT_TOKEN})`,
  `Cannot set properties of undefined (setting ${SLOT_TOKEN})`,
  `Cannot set properties of null (setting ${SLOT_TOKEN})`,
  `${SLOT_TOKEN} is not an object (evaluating ${SLOT_TOKEN})`,
  `${SLOT_TOKEN} is not a function`,
  `${SLOT_TOKEN} is not a constructor`,
  `${SLOT_TOKEN} is not iterable`,
  `${SLOT_TOKEN} is not defined`,
  `${SLOT_TOKEN} is undefined`,
  `${SLOT_TOKEN} is null`,
  `Can't find variable: ${SLOT_TOKEN}`,
  `Cannot access ${SLOT_TOKEN} before initialization`,
  `${SLOT_TOKEN} has already been declared`,
  // Browsers hide cross-origin script errors behind this fixed text.
  "Script error.",
  "Assignment to constant variable.",
  "Invalid array length",
  "Invalid time value",
  "Maximum call stack size exceeded",
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
  "The user aborted a request.",
  "The operation was aborted.",
  "signal is aborted without reason",
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications.",
  `Loading chunk ${SLOT_TOKEN} failed.`,
  `Loading chunk ${SLOT_TOKEN} failed.\n(error: ${SLOT_TOKEN})`,
  `Loading chunk ${SLOT_TOKEN} failed.\n(timeout: ${SLOT_TOKEN})`,
  `Loading CSS chunk ${SLOT_TOKEN} failed.\n(${SLOT_TOKEN})`,
  `Minified React error #${NUMBER_TOKEN}; visit ${SLOT_TOKEN} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`,
];

/** `error.name` is writable by any script, so only known names are reported. */
const SAFE_ERROR_TYPES: ReadonlySet<string> = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "EvalError",
  "URIError",
  "AggregateError",
  "DOMException",
  "AbortError",
  "TimeoutError",
  "NetworkError",
  "NotAllowedError",
  "NotFoundError",
  "NotSupportedError",
  "InvalidStateError",
  "QuotaExceededError",
  "SecurityError",
  "DataCloneError",
  "ChunkLoadError",
  "CircularDependencyError",
  "CurlParseError",
  "CurlToRequestError",
  "InjectionError",
  "InsomniaParseError",
  "MigrationError",
  "OpenApiParseError",
  "PostmanParseError",
  "RelayError",
  "SchedulerDepthExceededError",
  "SttRequestError",
]);

type TemplatePart =
  | { kind: "literal"; text: string }
  | { kind: "slot" }
  | { kind: "number" };
type MessageShape = { pattern: RegExp; parts: readonly TemplatePart[] };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTemplate(template: string): TemplatePart[] {
  return template
    .split(/(\{slot\}|\{n\})/)
    .filter((piece) => piece.length > 0)
    .map((piece): TemplatePart => {
      if (piece === SLOT_TOKEN) return { kind: "slot" };
      if (piece === NUMBER_TOKEN) return { kind: "number" };
      return { kind: "literal", text: piece };
    });
}

function partSource(part: TemplatePart): string {
  if (part.kind === "slot") return SLOT_SOURCE;
  if (part.kind === "number") return NUMBER_SOURCE;
  return escapeRegExp(part.text);
}

function compileShape(template: string): MessageShape {
  const parts = parseTemplate(template);
  // Anchored, no `m` flag: the whole message must be the template, nothing around it.
  return { pattern: new RegExp(`^${parts.map(partSource).join("")}$`), parts };
}

const SAFE_MESSAGE_SHAPES: readonly MessageShape[] =
  SAFE_MESSAGE_TEMPLATES.map(compileShape);

/** Rebuilds from literals only; captured numbers are digits by construction. */
function renderShape(
  parts: readonly TemplatePart[],
  numbers: string[],
): string {
  let numberIndex = 0;
  return parts
    .map((part) => {
      if (part.kind === "literal") return part.text;
      if (part.kind === "slot") return REDACTED;
      return numbers[numberIndex++];
    })
    .join("");
}

function safeType(name: string): string {
  return SAFE_ERROR_TYPES.has(name) ? name : FALLBACK_ERROR_TYPE;
}

function safeMessage(raw: string, type: string): string {
  const bounded = raw.slice(0, MAX_INPUT_LENGTH);
  for (const { pattern, parts } of SAFE_MESSAGE_SHAPES) {
    const match = pattern.exec(bounded);
    if (match) return renderShape(parts, match.slice(1));
  }
  return `${type}: ${WITHHELD}`;
}

/** Only plain script names survive; blob ids, uuids and token-like segments become `<anon>`. */
const SAFE_FRAME_FILE_PATTERN = /^[\w.-]+\.(?:m?js|tsx?)$/;
const ANONYMOUS_FRAME_FILE = "<anon>";

/** `file.js?v=1:12:34` -> `file.js:12`; function names and directories are dropped. */
const FRAME_LOCATION_PATTERN =
  /([^/\\\s()@?#:]+)(?:\?[^\s:]*)?:(\d+)(?::\d+)?\)?\s*$/;

/** V8 `at fn (file:1:2)` or JavaScriptCore/SpiderMonkey `fn@file:1:2` (`global code@…`). */
const ENGINE_FRAME_LINE_PATTERN = /^(?:at\s|[^@]*@\S)/;

/**
 * V8 stacks start with `Name: message`, and the message may span many lines
 * (JSON.parse echoes the body). Cutting at the first copy of the message drops
 * the whole header; JavaScriptCore/SpiderMonkey stacks have no header at all.
 */
function stackFrameLines(stack: string, message: string): string[] {
  const headerIndex = message ? stack.indexOf(message) : -1;
  const body =
    headerIndex === -1 ? stack : stack.slice(headerIndex + message.length);
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => ENGINE_FRAME_LINE_PATTERN.test(line));
}

function scrubFrames(stack: string | undefined, message: string): string {
  if (!stack) return "";
  const frames: string[] = [];
  for (const line of stackFrameLines(stack, message)) {
    const match = FRAME_LOCATION_PATTERN.exec(line);
    if (!match) continue;
    const file = SAFE_FRAME_FILE_PATTERN.test(match[1])
      ? match[1]
      : ANONYMOUS_FRAME_FILE;
    frames.push(`${file}:${match[2]}`);
  }
  return frames.join("\n").slice(0, MAX_ERROR_FRAMES_LENGTH);
}

function describeError(error: unknown): {
  message: string;
  type: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { message: error.message, type: error.name, stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error, type: FALLBACK_ERROR_TYPE };
  }
  return { message: NON_ERROR_MESSAGE, type: FALLBACK_ERROR_TYPE };
}

/**
 * Pure and fail-closed: the message is kept only as a known engine template with
 * every variable part replaced by `[redacted]`, otherwise it becomes
 * `<type>: [message withheld]`. The type must be a known error name, and stack
 * frames keep only `file:line`.
 */
export function scrubError(error: unknown, source: ErrorSource): ScrubbedError {
  const described = describeError(error);
  const type = safeType(described.type);
  return {
    message: safeMessage(described.message, type).slice(
      0,
      MAX_ERROR_MESSAGE_LENGTH,
    ),
    type,
    frames: scrubFrames(described.stack, described.message),
    source,
  };
}
