import type { DiffKind, DiffNode } from "@/lib/jsonDiff";

export interface CompareRow {
  path: string;
  key: string;
  kind: DiffKind;
  depth: number;
  /** Shown after the key; empty for an object or array that opens a branch. */
  value: string;
  /** The left-hand value, set only when a leaf changed. */
  previous?: string;
}

/** Same markers as the app's diff tree. */
export const DIFF_MARKERS: Record<DiffKind, string> = {
  added: "+",
  removed: "-",
  changed: "~",
  unchanged: " ",
};

function formatValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

function leafRow(node: DiffNode, depth: number): CompareRow {
  const base = { path: node.path, key: node.key, kind: node.kind, depth };
  if (node.kind === "removed")
    return { ...base, value: formatValue(node.leftValue) };
  if (node.kind === "changed") {
    return {
      ...base,
      value: formatValue(node.rightValue),
      previous: formatValue(node.leftValue),
    };
  }
  return { ...base, value: formatValue(node.rightValue) };
}

/** Flattens a diff tree into indented rows, depth first, the way it reads. */
export function flattenDiff(
  nodes: readonly DiffNode[],
  depth = 0,
): CompareRow[] {
  return nodes.flatMap((node) => {
    if (node.children === null) return [leafRow(node, depth)];
    const open: CompareRow = {
      path: node.path,
      key: node.key,
      kind: node.kind,
      depth,
      value: "",
    };
    return [open, ...flattenDiff(node.children, depth + 1)];
  });
}
