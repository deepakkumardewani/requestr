"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DiffKind, DiffNode } from "@/lib/jsonDiff";

const KIND_STYLES: Record<DiffKind, string> = {
  added: "bg-emerald-500/10 text-emerald-400",
  removed: "bg-red-500/10 text-red-400",
  changed: "bg-amber-500/10 text-amber-400",
  unchanged: "text-muted-foreground",
};

const KIND_PREFIX: Record<DiffKind, string> = {
  added: "+ ",
  removed: "- ",
  changed: "~ ",
  unchanged: "  ",
};

function formatValue(value: unknown): string {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") return Array.isArray(value) ? "[…]" : "{…}";
  return String(value);
}

type DiffNodeRowProps = {
  node: DiffNode;
  depth: number;
};

function DiffNodeRow({ node, depth }: DiffNodeRowProps) {
  const hasChildren = node.children !== null && node.children.length > 0;
  // Collapse unchanged containers by default so real edits stay easy to scan.
  const [expanded, setExpanded] = useState(
    () => !(node.kind === "unchanged" && hasChildren),
  );
  const indentPx = depth * 16;

  // Skip rendering unchanged leaf nodes to reduce noise — only show structure
  if (node.kind === "unchanged" && !hasChildren) return null;

  const rowStyle = KIND_STYLES[node.kind];
  const prefix = KIND_PREFIX[node.kind];

  return (
    <div>
      <div
        className={`flex items-baseline gap-1 rounded px-2 py-0.5 font-mono text-xs ${rowStyle}`}
        style={{ paddingLeft: `${indentPx + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mr-0.5 shrink-0 opacity-60 hover:opacity-100"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="mr-0.5 w-3 shrink-0 select-none text-[10px] opacity-50">
            {prefix.trim() || ""}
          </span>
        )}

        {/* Key */}
        <span className="shrink-0 opacity-80">{node.key}:</span>

        {/* Value display */}
        {!hasChildren && (
          <span className="ml-1 break-all">
            {node.kind === "changed" ? (
              <>
                <span className="text-red-400 line-through opacity-70">
                  {formatValue(node.leftValue)}
                </span>
                <span className="mx-1 opacity-50">→</span>
                <span className="text-emerald-400">
                  {formatValue(node.rightValue)}
                </span>
              </>
            ) : node.kind === "removed" ? (
              <span>{formatValue(node.leftValue)}</span>
            ) : node.kind === "added" ? (
              <span>{formatValue(node.rightValue)}</span>
            ) : null}
          </span>
        )}

        {/* Object/array summary for collapsed nodes */}
        {hasChildren && !expanded && (
          <span className="ml-1 opacity-50">
            {Array.isArray(node.leftValue ?? node.rightValue) ? "[…]" : "{…}"}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children?.map((child) => (
            <DiffNodeRow key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

type DiffTreeProps = {
  nodes: DiffNode[];
};

export function DiffTree({ nodes }: DiffTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        No differences found — the two JSON values are identical
      </div>
    );
  }

  return (
    <div className="overflow-auto p-2" data-testid="diff-tree">
      {nodes.map((node) => (
        <DiffNodeRow key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
