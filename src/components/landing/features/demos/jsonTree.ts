export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface TreeEntry {
  key: string;
  path: string;
  value: JsonValue;
}

export function isBranch(
  value: JsonValue,
): value is JsonValue[] | { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null;
}

/** A collapsed branch shows its size, as the visualizer's nodes do: {3} or [2]. */
export function branchSummary(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (isBranch(value)) return `{${Object.keys(value).length}}`;
  return JSON.stringify(value);
}

/** The children of a branch, each with a JSONPath-style path for its key. */
export function childEntries(
  value: JsonValue,
  parentPath: string,
): TreeEntry[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: String(index),
      path: `${parentPath}[${index}]`,
      value: item,
    }));
  }
  if (!isBranch(value)) return [];
  return Object.entries(value).map(([key, item]) => ({
    key,
    path: `${parentPath}.${key}`,
    value: item,
  }));
}
