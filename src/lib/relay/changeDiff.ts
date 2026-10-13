import { DEFAULT_REDACT_CONTEXT, REDACTED, redactDeep } from "./redact";

/**
 * Turns a stored change into the lines its card shows. Everything is redacted
 * first: before/after hold real stored entities, secret variables included.
 */

export const DIFF_ROWS_MAX = 20;
const HIDDEN_KEYS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "collectionId",
  "parentFolderId",
  "order",
]);
const VALUE_CHARS_MAX = 80;

export type DiffRow = {
  path: string;
  before: string | null;
  after: string | null;
};

export type ChangeDiff = { rows: DiffRow[]; hidden: number };

/** Secret variables keep their key but never their value, even in the user's own card. */
function hideSecretVariables(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hideSecretVariables);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const masked = record.isSecret === true;
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      masked && (key === "currentValue" || key === "initialValue")
        ? REDACTED
        : hideSecretVariables(item),
    ]),
  );
}

function label(item: unknown, index: number): string {
  const key = (item as { key?: unknown } | null)?.key;
  const name = (item as { name?: unknown } | null)?.name;
  if (typeof key === "string" && key) return key;
  if (typeof name === "string" && name) return name;
  return String(index);
}

/** The row's label already says its `key`, so repeating it would only add noise. */
function withoutLabelKey(item: unknown): unknown {
  if (item === null || typeof item !== "object" || Array.isArray(item))
    return item;
  const { key, ...rest } = item as Record<string, unknown>;
  return typeof key === "string" && key ? rest : item;
}

function shorten(text: string): string {
  return text.length > VALUE_CHARS_MAX
    ? `${text.slice(0, VALUE_CHARS_MAX)}...`
    : text;
}

/** Flattens to `path -> text`, naming list items by their key or name when they have one. */
function flatten(
  value: unknown,
  path: string,
  into: Map<string, string>,
): Map<string, string> {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(withoutLabelKey(item), `${path}[${label(item, index)}]`, into);
    });
    return into;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (!HIDDEN_KEYS.has(key))
        flatten(item, path ? `${path}.${key}` : key, into);
    }
    return into;
  }
  // null and undefined mean "absent": a created entity has no before.
  if (value !== undefined && value !== null) {
    into.set(path, shorten(String(value)));
  }
  return into;
}

function prepare(value: unknown): Map<string, string> {
  const safe = redactDeep(hideSecretVariables(value), DEFAULT_REDACT_CONTEXT);
  return flatten(safe, "", new Map());
}

/** Changed leaves only, in the order they first appear. */
export function buildChangeDiff(before: unknown, after: unknown): ChangeDiff {
  const old = prepare(before);
  const next = prepare(after);
  const paths = [...new Set([...old.keys(), ...next.keys()])];
  const rows = paths
    .filter((path) => old.get(path) !== next.get(path))
    .map((path) => ({
      path,
      before: old.get(path) ?? null,
      after: next.get(path) ?? null,
    }));
  return {
    rows: rows.slice(0, DIFF_ROWS_MAX),
    hidden: Math.max(0, rows.length - DIFF_ROWS_MAX),
  };
}
