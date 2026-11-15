"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DemoFrame } from "./DemoFrame";
import {
  branchSummary,
  childEntries,
  isBranch,
  type JsonValue,
} from "./jsonTree";
import { useDemoCycle } from "./useDemoCycle";

const CYCLE_MS = 1600;
const ROOT_PATH = "$";
const SAMPLE: JsonValue = {
  status: "ok",
  user: {
    id: 42,
    name: "Ada Lovelace",
    roles: ["admin", "billing"],
  },
  orders: [
    { id: "ord_1042", total: 129.5, paid: true },
    { id: "ord_1043", total: 18, paid: false },
  ],
  next: null,
};
/** Branches the autoplay opens, in order, before it folds them all again. */
const AUTO_OPEN = [
  "$.user",
  "$.user.roles",
  "$.orders",
  "$.orders[0]",
] as const;
const INDENT_REM = 1.1;

interface TreeProps {
  value: JsonValue;
  path: string;
  depth: number;
  open: ReadonlySet<string>;
  onToggle: (path: string) => void;
}

function TreeLevel({ value, path, depth, open, onToggle }: TreeProps) {
  return (
    <ul aria-label={depth === 0 ? "Response" : undefined}>
      {childEntries(value, path).map((entry) => {
        const branch = isBranch(entry.value);
        const expanded = open.has(entry.path);
        return (
          <li key={entry.path}>
            <button
              type="button"
              disabled={!branch}
              aria-expanded={branch ? expanded : undefined}
              onClick={() => onToggle(entry.path)}
              style={{ paddingLeft: `${depth * INDENT_REM + 0.5}rem` }}
              className="flex w-full items-center gap-1.5 rounded py-0.5 pr-2 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
            >
              <ChevronRightIcon
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  branch ? "" : "invisible",
                  expanded && "rotate-90",
                )}
              />
              <span className="text-[var(--method-post)]">{entry.key}</span>
              <span
                className={
                  branch ? "text-muted-foreground" : "text-[var(--method-get)]"
                }
              >
                {branch && expanded ? "" : branchSummary(entry.value)}
              </span>
            </button>
            {branch && expanded ? (
              <TreeLevel
                value={entry.value}
                path={entry.path}
                depth={depth + 1}
                open={open}
                onToggle={onToggle}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** A nested response you open branch by branch, the way the visualizer folds nodes. */
export function TreeDemo() {
  const cycle = useDemoCycle({
    count: AUTO_OPEN.length + 1,
    intervalMs: CYCLE_MS,
  });
  const [chosen, setChosen] = useState<ReadonlySet<string> | null>(null);
  // Reduced motion holds the fully opened state so there is something to read.
  const autoCount = cycle.reduced ? AUTO_OPEN.length : cycle.index;
  const open = chosen ?? new Set<string>(AUTO_OPEN.slice(0, autoCount));

  function toggle(path: string) {
    cycle.stop();
    const next = new Set(open);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setChosen(next);
  }

  return (
    <DemoFrame
      label="JSON visualizer example"
      title="visualize · response.json"
      frameRef={cycle.ref}
    >
      <div className="h-[23rem] overflow-y-auto p-3 font-mono text-xs leading-6">
        <TreeLevel
          value={SAMPLE}
          path={ROOT_PATH}
          depth={0}
          open={open}
          onToggle={toggle}
        />
      </div>
    </DemoFrame>
  );
}
