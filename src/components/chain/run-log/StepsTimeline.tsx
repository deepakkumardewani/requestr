"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RunStep } from "@/lib/chainRunHistory";
import { cn } from "@/lib/utils";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { StepRow } from "./StepRow";

type StepFilter = "all" | "passed" | "failed" | "skipped";

/** Rows above this count are virtualized; below it they render directly. */
const VIRTUALIZE_THRESHOLD = 50;
/** Fixed row height in px, used for both virtualized sizing and scroll math. */
const ROW_HEIGHT = 30;

const FILTER_KEY: Record<StepFilter, string> = {
  all: "runLogFilterAll",
  passed: "runLogFilterPassed",
  failed: "runLogFilterFailed",
  skipped: "runLogFilterSkipped",
};

const FILTERS: StepFilter[] = ["all", "passed", "failed", "skipped"];

function matchesFilter(step: RunStep, filter: StepFilter): boolean {
  if (filter === "all") return true;
  if (filter === "failed")
    return step.state === "failed" || step.state === "aborted";
  return step.state === filter;
}

/**
 * Assigns each step a lane number using greedy interval scheduling: steps
 * whose [startedAt, startedAt + durationMs) ranges overlap (i.e. ran in
 * parallel) get distinct lanes; sequential steps share lane 0.
 * `steps` must already be sorted by `startedAt` ascending.
 */
export function assignLanes(steps: RunStep[]): Map<string, number> {
  const laneEndTimes: number[] = [];
  const lanes = new Map<string, number>();

  for (const step of steps) {
    const end = step.startedAt + step.durationMs;
    let laneIndex = laneEndTimes.findIndex(
      (endTime) => endTime <= step.startedAt,
    );
    if (laneIndex === -1) {
      laneIndex = laneEndTimes.length;
      laneEndTimes.push(end);
    } else {
      laneEndTimes[laneIndex] = end;
    }
    lanes.set(step.id, laneIndex);
  }

  return lanes;
}

type StepsTimelineProps = {
  steps: RunStep[];
  /** Called when Esc is pressed with a row focused — collapses the parent dock. */
  onCollapseDock?: () => void;
};

export function StepsTimeline({ steps, onCollapseDock }: StepsTimelineProps) {
  const t = useTranslations("chain");
  const selectedStepId = useChainRunStore((s) => s.selectedStepId);
  const selectStep = useChainRunStore((s) => s.selectStep);

  const [filter, setFilter] = useState<StepFilter>("all");
  const [search, setSearch] = useState("");

  const filteredSteps = useMemo(() => {
    const query = search.trim().toLowerCase();
    return steps
      .filter(
        (step) =>
          matchesFilter(step, filter) &&
          (query === "" || step.label.toLowerCase().includes(query)),
      )
      .sort((a, b) => a.startedAt - b.startedAt);
  }, [steps, filter, search]);

  const lanes = useMemo(() => assignLanes(filteredSteps), [filteredSteps]);
  const hasParallelLanes = useMemo(
    () => Array.from(lanes.values()).some((lane) => lane > 0),
    [lanes],
  );

  // Loop-iteration sub-steps (P8.8) nest under their Loop step instead of
  // appearing as their own top-level rows — grouped by iteration index so
  // every iteration renders as its own expandable group.
  const topLevelSteps = useMemo(
    () => filteredSteps.filter((step) => !step.parentStepId),
    [filteredSteps],
  );
  const hasNestedSteps = useMemo(
    () => filteredSteps.some((step) => step.parentStepId !== undefined),
    [filteredSteps],
  );
  const iterationsByLoop = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const step of filteredSteps) {
      if (step.parentStepId === undefined || step.iteration === undefined) {
        continue;
      }
      const iterations = map.get(step.parentStepId) ?? [];
      if (!iterations.includes(step.iteration)) iterations.push(step.iteration);
      map.set(step.parentStepId, iterations);
    }
    for (const iterations of map.values()) iterations.sort((a, b) => a - b);
    return map;
  }, [filteredSteps]);
  const childStepsFor = useCallback(
    (loopStepId: string, iteration: number) =>
      filteredSteps
        .filter(
          (step) =>
            step.parentStepId === loopStepId && step.iteration === iteration,
        )
        .sort((a, b) => a.startedAt - b.startedAt),
    [filteredSteps],
  );
  const [expandedIterations, setExpandedIterations] = useState<Set<string>>(
    new Set(),
  );
  const toggleIteration = useCallback((key: string) => {
    setExpandedIterations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Sub-chain nested steps (P9.8): the nested run's steps carry `parentStepId`
  // but no `iteration` (that's Loop-only), so they nest directly under their
  // SubChain step as one flat expandable group instead of per-iteration.
  const subChainStepsFor = useCallback(
    (subChainStepId: string) =>
      filteredSteps
        .filter(
          (step) =>
            step.parentStepId === subChainStepId &&
            step.iteration === undefined,
        )
        .sort((a, b) => a.startedAt - b.startedAt),
    [filteredSteps],
  );
  const [expandedSubChains, setExpandedSubChains] = useState<Set<string>>(
    new Set(),
  );
  const toggleSubChain = useCallback((stepId: string) => {
    setExpandedSubChains((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (stepId: string) => selectStep(stepId, "timeline"),
    [selectStep],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (filteredSteps.length === 0) return;
      const currentIndex = filteredSteps.findIndex(
        (s) => s.id === selectedStepId,
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next =
          filteredSteps[Math.min(currentIndex + 1, filteredSteps.length - 1)];
        handleSelect(next.id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        handleSelect(filteredSteps[prevIndex].id);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (currentIndex >= 0) handleSelect(filteredSteps[currentIndex].id);
        else handleSelect(filteredSteps[0].id);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCollapseDock?.();
      }
    },
    [filteredSteps, selectedStepId, handleSelect, onCollapseDock],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  // Nested loop-iteration groups render outside the virtualizer's flat
  // index model, so a run containing any Loop falls back to plain rendering.
  const shouldVirtualize =
    filteredSteps.length > VIRTUALIZE_THRESHOLD && !hasNestedSteps;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? filteredSteps.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f}
              type="button"
              variant={filter === f ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {t(FILTER_KEY[f])}
            </Button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("runLogSearchPlaceholder")}
          aria-label={t("runLogSearchPlaceholder")}
          className="ml-auto h-6 w-48 text-xs"
        />
      </div>

      {filteredSteps.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
          {t("runLogStepsEmpty")}
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="listbox"
          className={cn("min-h-0 flex-1 overflow-y-auto")}
        >
          {shouldVirtualize ? (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const step = filteredSteps[virtualItem.index];
                return (
                  <div
                    key={step.id}
                    style={{
                      position: "absolute",
                      top: virtualItem.start,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <StepRow
                      step={step}
                      index={virtualItem.index}
                      isSelected={step.id === selectedStepId}
                      onSelect={handleSelect}
                      lane={lanes.get(step.id) ?? 0}
                      showLane={hasParallelLanes}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            topLevelSteps.map((step, index) => (
              <div key={step.id}>
                <StepRow
                  step={step}
                  index={index}
                  isSelected={step.id === selectedStepId}
                  onSelect={handleSelect}
                  lane={lanes.get(step.id) ?? 0}
                  showLane={hasParallelLanes}
                />
                {(iterationsByLoop.get(step.id) ?? []).map((iteration) => {
                  const groupKey = `${step.id}:${iteration}`;
                  const isExpanded = expandedIterations.has(groupKey);
                  const children = childStepsFor(step.id, iteration);
                  return (
                    <div key={groupKey}>
                      <button
                        type="button"
                        data-testid={`iteration-toggle-${step.id}-${iteration}`}
                        aria-expanded={isExpanded}
                        onClick={() => toggleIteration(groupKey)}
                        className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-2 py-1 pl-6 text-left text-xs text-muted-foreground hover:bg-muted/50"
                      >
                        {isExpanded ? (
                          <ChevronDown
                            className="size-3 shrink-0"
                            aria-hidden
                          />
                        ) : (
                          <ChevronRight
                            className="size-3 shrink-0"
                            aria-hidden
                          />
                        )}
                        <span>Iteration {iteration + 1}</span>
                        <span className="ml-auto tabular-nums">
                          {children.length}
                        </span>
                      </button>
                      {isExpanded &&
                        children.map((child, childIndex) => (
                          <StepRow
                            key={child.id}
                            step={child}
                            index={childIndex}
                            isSelected={child.id === selectedStepId}
                            onSelect={handleSelect}
                            nested
                          />
                        ))}
                    </div>
                  );
                })}
                {(() => {
                  const subChainChildren = subChainStepsFor(step.id);
                  if (subChainChildren.length === 0) return null;
                  const isSubChainExpanded = expandedSubChains.has(step.id);
                  return (
                    <div>
                      <button
                        type="button"
                        data-testid={`subchain-toggle-${step.id}`}
                        aria-expanded={isSubChainExpanded}
                        onClick={() => toggleSubChain(step.id)}
                        className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-2 py-1 pl-6 text-left text-xs text-muted-foreground hover:bg-muted/50"
                      >
                        {isSubChainExpanded ? (
                          <ChevronDown
                            className="size-3 shrink-0"
                            aria-hidden
                          />
                        ) : (
                          <ChevronRight
                            className="size-3 shrink-0"
                            aria-hidden
                          />
                        )}
                        <span>{t("runLogSubChainSteps")}</span>
                        <span className="ml-auto tabular-nums">
                          {subChainChildren.length}
                        </span>
                      </button>
                      {isSubChainExpanded &&
                        subChainChildren.map((child, childIndex) => (
                          <StepRow
                            key={child.id}
                            step={child}
                            index={childIndex}
                            isSelected={child.id === selectedStepId}
                            onSelect={handleSelect}
                            nested
                          />
                        ))}
                    </div>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
