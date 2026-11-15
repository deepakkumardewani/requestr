"use client";

import { motion, useInView } from "motion/react";
import { useId, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { diffJson, filterDiffToChangesOnly } from "@/lib/jsonDiff";
import { cn } from "@/lib/utils";
import { type CompareRow, DIFF_MARKERS, flattenDiff } from "./compareRows";
import { DemoFrame } from "./DemoFrame";

const IN_VIEW_AMOUNT = 0.3;
const ROW_STAGGER_S = 0.05;
const ROW_DURATION_S = 0.3;
const INDENT_REM = 1;
const LEFT = {
  id: 42,
  name: "Ada Lovelace",
  plan: "free",
  address: { city: "London", zip: "N1" },
  tags: ["beta"],
};
const RIGHT = {
  id: 42,
  name: "Ada Lovelace",
  plan: "pro",
  address: { city: "London", zip: "N1 9GU" },
  tags: ["beta"],
  seats: 5,
};
const DIFF = diffJson(LEFT, RIGHT);
const KIND_TEXT: Record<CompareRow["kind"], string> = {
  added: "text-[var(--method-get)]",
  removed: "text-[var(--method-delete)]",
  changed: "text-[var(--method-put)]",
  unchanged: "text-muted-foreground",
};
const KIND_GROUND: Record<CompareRow["kind"], string> = {
  added: "bg-[var(--method-get)]/10",
  removed: "bg-[var(--method-delete)]/10",
  changed: "bg-[var(--method-put)]/10",
  unchanged: "",
};
const STATS = [
  { kind: "added", label: "added" },
  { kind: "removed", label: "removed" },
  { kind: "changed", label: "changed" },
] as const;

function RowText({ row }: { row: CompareRow }) {
  return (
    <>
      <span aria-hidden="true" className="w-4 shrink-0 select-none">
        {DIFF_MARKERS[row.kind]}
      </span>
      <span className="text-foreground/90">
        {row.key}
        {row.value ? ":" : ""}
      </span>
      {row.previous ? (
        <span className="line-through opacity-60">{row.previous}</span>
      ) : null}
      {row.previous ? <span aria-hidden="true">→</span> : null}
      <span className="truncate">{row.value}</span>
      <span className="sr-only">({row.kind})</span>
    </>
  );
}

function StatsBar() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-4 py-2.5 font-mono text-xs">
      <span className="text-muted-foreground">What changed</span>
      {STATS.map((stat) => (
        <span key={stat.kind} className={KIND_TEXT[stat.kind]}>
          {DIFF.stats[stat.kind]} {stat.label}
        </span>
      ))}
    </p>
  );
}

/** Two versions of a user payload, diffed with the app's comparison code. */
export function CompareDemo() {
  const frameRef = useRef<HTMLElement>(null);
  const inView = useInView(frameRef, { amount: IN_VIEW_AMOUNT, once: true });
  const reduced = useReducedMotion();
  const [changesOnly, setChangesOnly] = useState(false);
  const switchId = useId();
  const rows = useMemo(
    () =>
      flattenDiff(
        changesOnly ? filterDiffToChangesOnly(DIFF.nodes) : DIFF.nodes,
      ),
    [changesOnly],
  );
  const shown = reduced || inView;

  return (
    <DemoFrame
      label="JSON compare example"
      title="compare · v1 → v2"
      frameRef={frameRef}
      controls={
        <label
          htmlFor={switchId}
          className="inline-flex cursor-pointer items-center gap-2 font-mono text-xs text-muted-foreground"
        >
          <input
            id={switchId}
            type="checkbox"
            role="switch"
            aria-checked={changesOnly}
            checked={changesOnly}
            onChange={(event) => setChangesOnly(event.target.checked)}
            className="size-4 accent-[var(--landing-accent)]"
          />
          Changes only
        </label>
      }
    >
      <StatsBar />
      <ul
        aria-label="Differences"
        className="h-[17rem] overflow-hidden p-3 font-mono text-xs leading-6"
      >
        {rows.map((row, index) => (
          <motion.li
            key={row.path}
            initial={false}
            animate={shown ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={{
              delay: reduced ? 0 : index * ROW_STAGGER_S,
              duration: ROW_DURATION_S,
            }}
            style={{ paddingLeft: `${row.depth * INDENT_REM}rem` }}
            className={cn(
              "flex min-w-0 gap-2 rounded px-2",
              KIND_TEXT[row.kind],
              KIND_GROUND[row.kind],
            )}
          >
            <RowText row={row} />
          </motion.li>
        ))}
      </ul>
    </DemoFrame>
  );
}
