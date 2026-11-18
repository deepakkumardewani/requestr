"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { RunStep } from "@/lib/chainRunHistory";

export type StepFilter = "all" | "passed" | "failed" | "skipped";

export type StepFilterCounts = Record<StepFilter, number>;

const FILTERS: StepFilter[] = ["all", "passed", "failed", "skipped"];

const FILTER_COUNT_KEY: Record<StepFilter, string> = {
  all: "runLogFilterAllCount",
  passed: "runLogFilterPassedCount",
  failed: "runLogFilterFailedCount",
  skipped: "runLogFilterSkippedCount",
};

/** Failed includes aborted: both are "something went wrong" for triage. */
export function matchesFilter(step: RunStep, filter: StepFilter): boolean {
  if (filter === "all") return true;
  if (filter === "failed")
    return step.state === "failed" || step.state === "aborted";
  return step.state === filter;
}

/** Counts reflect the whole run, independent of the text search. */
export function countSteps(steps: RunStep[]): StepFilterCounts {
  const counts: StepFilterCounts = {
    all: steps.length,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
  for (const step of steps) {
    if (matchesFilter(step, "passed")) counts.passed += 1;
    else if (matchesFilter(step, "failed")) counts.failed += 1;
    else if (matchesFilter(step, "skipped")) counts.skipped += 1;
  }
  return counts;
}

type RunFilterTabsProps = {
  counts: StepFilterCounts;
  value: StepFilter;
  onChange: (filter: StepFilter) => void;
};

export function RunFilterTabs({ counts, value, onChange }: RunFilterTabsProps) {
  const t = useTranslations("chain");
  // Zero-count tabs are noise; "All" always stays as the reset target.
  const visible = FILTERS.filter((f) => f === "all" || counts[f] > 0);

  return (
    <div className="flex items-center gap-1">
      {visible.map((f) => (
        <Button
          key={f}
          type="button"
          data-testid={`run-filter-tab-${f}`}
          variant={value === f ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={value === f}
          onClick={() => onChange(f)}
        >
          {t(FILTER_COUNT_KEY[f], { count: counts[f] })}
        </Button>
      ))}
    </div>
  );
}
