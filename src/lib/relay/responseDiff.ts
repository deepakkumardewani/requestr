import type { ResponseData } from "@/types";
import {
  DEFAULT_REDACT_CONTEXT,
  type RedactContext,
  redactDeep,
  redactHeaders,
  redactValue,
} from "./redact";
import { DIFF_ENTRIES_MAX } from "./tools/schemas";

/**
 * Structural comparison of two stored responses (FR-194). Both sides are
 * redacted before they are compared, so a secret can neither appear in the
 * output nor be inferred from "changed" markers; every part is capped.
 */

export const DIFF_VALUE_MAX_CHARS = 200;
const DIFF_MAX_DEPTH = 12;
const ROOT_PATH = "$";

type Comparable = Pick<ResponseData, "status" | "headers" | "body">;

export type ValueChange = {
  path: string;
  change: "added" | "removed" | "changed";
  a?: string;
  b?: string;
};

export type ResponseDiff = {
  identical: boolean;
  status: { a: number; b: number } | null;
  headers: ValueChange[];
  body: ValueChange[];
  /** True when any part had more differences than the cap. */
  truncated: boolean;
};

const clip = (value: string) =>
  value.length > DIFF_VALUE_MAX_CHARS
    ? `${value.slice(0, DIFF_VALUE_MAX_CHARS)}…`
    : value;

const show = (value: unknown) =>
  clip(typeof value === "string" ? value : (JSON.stringify(value) ?? "null"));

const isContainer = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

function childPath(parent: string, key: string, isArray: boolean) {
  return isArray ? `${parent}[${key}]` : `${parent}.${key}`;
}

function compareValues(
  a: unknown,
  b: unknown,
  path: string,
  depth: number,
  out: ValueChange[],
): void {
  if (isContainer(a) && isContainer(b) && depth < DIFF_MAX_DEPTH) {
    const isArray = Array.isArray(a) && Array.isArray(b);
    if (Array.isArray(a) !== Array.isArray(b)) {
      out.push({ path, change: "changed", a: show(a), b: show(b) });
      return;
    }
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      const next = childPath(path, key, isArray);
      if (!(key in right)) {
        out.push({ path: next, change: "removed", a: show(left[key]) });
      } else if (!(key in left)) {
        out.push({ path: next, change: "added", b: show(right[key]) });
      } else {
        compareValues(left[key], right[key], next, depth + 1, out);
      }
    }
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({ path, change: "changed", a: show(a), b: show(b) });
  }
}

function parseJson(text: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null;
  }
}

function diffBody(a: string, b: string, context: RedactContext) {
  const left = parseJson(a);
  const right = parseJson(b);
  const out: ValueChange[] = [];
  if (left && right) {
    compareValues(
      redactDeep(left.value, context),
      redactDeep(right.value, context),
      ROOT_PATH,
      0,
      out,
    );
  } else if (a !== b) {
    out.push({
      path: ROOT_PATH,
      change: "changed",
      a: clip(redactValue(a, context)),
      b: clip(redactValue(b, context)),
    });
  }
  return out;
}

function diffHeaders(
  a: Record<string, string>,
  b: Record<string, string>,
  context: RedactContext,
) {
  const lower = (headers: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(redactHeaders(headers, context)).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
  const out: ValueChange[] = [];
  compareValues(lower(a), lower(b), "", 0, out);
  return out.map((entry) => ({ ...entry, path: entry.path.slice(1) }));
}

const cap = (entries: ValueChange[]) => entries.slice(0, DIFF_ENTRIES_MAX);

export function diffResponses(
  a: Comparable,
  b: Comparable,
  context: RedactContext = DEFAULT_REDACT_CONTEXT,
): ResponseDiff {
  const headers = diffHeaders(a.headers, b.headers, context);
  const body = diffBody(a.body, b.body, context);
  const status = a.status === b.status ? null : { a: a.status, b: b.status };
  return {
    identical: !status && headers.length === 0 && body.length === 0,
    status,
    headers: cap(headers),
    body: cap(body),
    truncated:
      headers.length > DIFF_ENTRIES_MAX || body.length > DIFF_ENTRIES_MAX,
  };
}
