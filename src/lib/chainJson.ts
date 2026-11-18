import { JSONPath } from "jsonpath-plus";
import { parseJsonSafe } from "@/lib/jsonDiff";

/** Values `JSONPath` accepts as its `json` input. */
type JsonPathInput = null | boolean | number | string | object;

function isJsonPathInput(value: unknown): value is JsonPathInput {
  return (
    value === null ||
    ["boolean", "number", "string", "object"].includes(typeof value)
  );
}

/** True for a non-null, non-array object. */
export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses `text` as JSON, returning `fallback` when it isn't valid JSON (an empty
 * or whitespace-only string counts as invalid, like `JSON.parse`). A literal
 * `null` body still parses to `null`, not the fallback.
 */
export function tryParseJson<F>(text: string, fallback: F): unknown | F {
  if (!text.trim()) return fallback;
  const { value, error } = parseJsonSafe(text);
  return error === null ? value : fallback;
}

/** Parses `text` as JSON and returns it only when it is an object or array; otherwise `null`. */
export function parseJsonObject(text: string): object | null {
  const parsed = tryParseJson(text, null);
  return typeof parsed === "object" && parsed !== null ? parsed : null;
}

export type JsonPathFailureReason =
  | "invalidJson"
  | "invalidJsonPath"
  | "noMatch";

export type JsonPathResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: JsonPathFailureReason };

/**
 * Queries an already-parsed document and says *why* it failed, so callers that
 * surface errors (Validate) can tell a bad document, a bad path and an empty
 * result apart. A matched literal `null` is a success, not `noMatch`.
 */
export function queryJsonPath(parsed: unknown, path: string): JsonPathResult {
  if (!isJsonPathInput(parsed)) return { ok: false, reason: "invalidJson" };
  let matches: unknown;
  try {
    matches = JSONPath({ path, json: parsed, wrap: true });
  } catch {
    // jsonpath-plus throws on a malformed expression; that is the user's path, not a bug.
    return { ok: false, reason: "invalidJsonPath" };
  }
  if (!Array.isArray(matches) || matches.length === 0) {
    return { ok: false, reason: "noMatch" };
  }
  return { ok: true, value: matches[0] };
}

/**
 * First value matched by `path` in an already-parsed document, or `undefined`
 * when nothing matches, the path is invalid or the input can't be queried.
 * Use `queryJsonPath` when the failure reason matters.
 */
export function firstJsonPathMatch(parsed: unknown, path: string): unknown {
  const result = queryJsonPath(parsed, path);
  return result.ok ? result.value : undefined;
}

/** Pretty-prints valid JSON with 2-space indent; returns `text` unchanged when it isn't valid JSON. */
export function prettyPrintJson(text: string): string {
  if (!text.trim()) return text;
  const { value, error } = parseJsonSafe(text);
  return error === null ? JSON.stringify(value, null, 2) : text;
}
