"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { RunStep } from "@/lib/chainRunHistory";
import { getRunLogEmptyKind } from "@/lib/chainRunSummary";
import { cn } from "@/lib/utils";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { NestedSteps } from "./NestedSteps";
import {
  countSteps,
  matchesFilter,
  RunFilterTabs,
  type StepFilter,
} from "./RunFilterTabs";
import { RunLogEmptyState } from "./RunLogEmptyState";
import { getStepRowId, StepRow } from "./StepRow";
import { matchesSearch } from "./stepSearch";

/** Rows above this count are virtualized; below it they render directly. */
const VIRTUALIZE_THRESHOLD = 50;
/** Fixed row height in px, used for both virtualized sizing and scroll math. */
const ROW_HEIGHT = 30;
/** Run-level inputs this component does not own; fixed so only the step kinds are decided here. */
const PRESENT: readonly unknown[] = [true];

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
  /** Ids of nodes still on the canvas; a step whose node is absent shows a "Node removed" chip. */
  liveNodeIds?: ReadonlySet<string>;
};

/** `matched` plus every ancestor (via `parentStepId`) of a matched step, without duplicates. */
function withAncestors(steps: RunStep[], matched: RunStep[]): RunStep[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const visible = new Map(matched.map((step) => [step.id, step]));
  for (const step of matched) {
    let parentId = step.parentStepId;
    while (parentId !== undefined && !visible.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      visible.set(parent.id, parent);
      parentId = parent.parentStepId;
    }
  }
  return [...visible.values()];
}

export function StepsTimeline({
  steps,
  onCollapseDock,
  liveNodeIds,
}: StepsTimelineProps) {
  const t = useTranslations("chain");
  const selectedStepId = useChainRunStore((s) => s.selectedStepId);
  const selectStep = useChainRunStore((s) => s.selectStep);

  const isNodeRemoved = (step: RunStep) =>
    liveNodeIds !== undefined && !liveNodeIds.has(step.nodeId);

  const [filter, setFilter] = useState<StepFilter>("all");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => countSteps(steps), [steps]);
  // A tab whose steps disappeared (e.g. a new run) would show an empty list
  // with no tab to explain it, so derive the effective filter instead of storing a stale one.
  const activeFilter: StepFilter =
    filter === "all" || counts[filter] > 0 ? filter : "all";

  const matchedSteps = useMemo(
    () =>
      steps.filter(
        (step) =>
          matchesFilter(step, activeFilter) && matchesSearch(step, search),
      ),
    [steps, activeFilter, search],
  );

  // Nested steps render only beneath their parent, so a match whose ancestors
  // were filtered out would be orphaned and invisible. Keep the ancestor chain
  // of every match so e.g. the Failed tab can still reach a failed iteration.
  const filteredSteps = useMemo(
    () =>
      withAncestors(steps, matchedSteps).sort(
        (a, b) => a.startedAt - b.startedAt,
      ),
    [steps, matchedSteps],
  );

  // Lanes come from the unfiltered top-level steps: filtering must not reshuffle
  // lanes, and nested sub-steps overlap their parent so they would invent fake parallelism.
  const lanes = useMemo(
    () =>
      assignLanes(
        steps
          .filter((step) => !step.parentStepId)
          .sort((a, b) => a.startedAt - b.startedAt),
      ),
    [steps],
  );
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
  const handleSelect = useCallback(
    (stepId: string) => selectStep(stepId, "timeline"),
    [selectStep],
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

  // Nested rows only exist in the DOM while their group is expanded (that
  // state lives in NestedSteps), so the rendered options are the visible rows.
  // The virtualized branch never nests, so the flat list is exact there.
  const getVisibleStepIds = useCallback((): string[] => {
    if (shouldVirtualize) return filteredSteps.map((step) => step.id);
    const options =
      scrollRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    return Array.from(options ?? [], (el) => el.dataset.stepId ?? "");
  }, [shouldVirtualize, filteredSteps]);

  const selectAndReveal = useCallback(
    (stepIds: string[], index: number) => {
      handleSelect(stepIds[index]);
      if (shouldVirtualize) {
        virtualizer.scrollToIndex(index);
        return;
      }
      document
        .getElementById(getStepRowId(stepIds[index]))
        ?.scrollIntoView?.({ block: "nearest" });
    },
    [handleSelect, shouldVirtualize, virtualizer],
  );

  // Selection can come from outside the list (the summary header's failure
  // link), so reveal the selected row whenever it changes.
  useEffect(() => {
    if (!selectedStepId) return;
    const index = filteredSteps.findIndex((step) => step.id === selectedStepId);
    if (index === -1) return;
    if (shouldVirtualize) {
      virtualizer.scrollToIndex(index);
      return;
    }
    document
      .getElementById(getStepRowId(selectedStepId))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedStepId]); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyKind = getRunLogEmptyKind({
    runs: PRESENT,
    selectedRun: true,
    steps,
    filteredSteps,
    selectedStep: true,
    loading: false,
    error: null,
  });

  const clearFilters = useCallback(() => {
    setFilter("all");
    setSearch("");
  }, []);

  // Esc peels back one layer: an active filter first, then the dock itself.
  const handleEscape = useCallback(() => {
    if (activeFilter !== "all" || search !== "") {
      clearFilters();
      return;
    }
    onCollapseDock?.();
  }, [activeFilter, search, onCollapseDock, clearFilters]);

  // Bound to the listbox only, so typing/arrows/Esc in the search input keep
  // their native behavior and never change selection or collapse the dock.
  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleEscape();
        return;
      }
      const stepIds = getVisibleStepIds();
      if (stepIds.length === 0) return;
      const currentIndex = stepIds.indexOf(selectedStepId ?? "");

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectAndReveal(
          stepIds,
          Math.min(currentIndex + 1, stepIds.length - 1),
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selectAndReveal(stepIds, Math.max(currentIndex - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        selectAndReveal(stepIds, Math.max(currentIndex, 0));
      }
    },
    [getVisibleStepIds, selectedStepId, selectAndReveal, handleEscape],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <RunFilterTabs
          counts={counts}
          value={activeFilter}
          onChange={setFilter}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            handleEscape();
          }}
          placeholder={t("runLogSearchPlaceholder")}
          aria-label={t("runLogSearchPlaceholder")}
          className="ml-auto h-6 w-48 text-xs"
        />
        <span role="status" aria-live="polite" className="sr-only">
          {t("runLogStepCount", { count: matchedSteps.length })}
        </span>
      </div>

      {emptyKind ? (
        <RunLogEmptyState kind={emptyKind} onClearFilter={clearFilters} />
      ) : (
        <div
          ref={scrollRef}
          role="listbox"
          tabIndex={0}
          aria-label={t("runLogTitle")}
          aria-activedescendant={
            selectedStepId ? getStepRowId(selectedStepId) : undefined
          }
          onKeyDown={handleListKeyDown}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
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
                      nodeRemoved={isNodeRemoved(step)}
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
                  nodeRemoved={isNodeRemoved(step)}
                />
                <NestedSteps
                  parent={step}
                  steps={filteredSteps}
                  selectedStepId={selectedStepId}
                  onSelect={handleSelect}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
