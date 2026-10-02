"use client";

import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { RelativeNowProvider } from "@/components/chain/RelativeNowProvider";
import type { RunBlockReason } from "@/lib/chainRunBlock";
import type { RunStatus, RunSummary, RunTrigger } from "@/lib/chainRunHistory";
import {
  canRerun,
  formatDuration,
  getRunLogEmptyKind,
  resolveAnchorLabel,
} from "@/lib/chainRunSummary";
import { cn } from "@/lib/utils";
import {
  RUN_DELETE_UNDO_MS,
  useChainRunStore,
} from "@/stores/useChainRunStore";
import { RunCard } from "./RunCard";
import { RunCardMenu } from "./RunCardMenu";
import { RunLogEmptyState } from "./RunLogEmptyState";

type RunsListProps = {
  runs: RunSummary[];
  activeRun: RunSummary | null;
  selectedRunId: string | null;
  /** True while the initial run history is loading from storage. */
  runsLoading?: boolean;
  /** Set when loading the run history failed. */
  runsError?: string | null;
  /** Retries loading the run history after `runsError`. */
  onRetryLoad?: () => void;
  /**
   * Labels of the nodes currently on the canvas, keyed by node id. Drives
   * anchor labels and Re-run enablement; omit when node state is unknown
   * (every run is then re-runnable).
   */
  nodeLabels?: Record<string, string>;
  onSelectRun: (runId: string) => void;
  onRerun: (run: RunSummary) => void;
  onDeleteRun: (runId: string) => void;
  /** Why Run is blocked (from `getRunBlockReason`); null when runnable. */
  runBlockReason?: RunBlockReason | null;
  /** Starts a full run; backs the "Run flow" button of the empty state. */
  onRunFlow?: () => void;
};

export const STATUS_ICON_STATE: Record<
  RunStatus,
  "running" | "passed" | "failed"
> = {
  running: "running",
  passed: "passed",
  failed: "failed",
  stopped: "failed",
};

export const TRIGGER_KEY: Record<RunTrigger, string> = {
  full: "runLogTriggerFull",
  upTo: "runLogTriggerUpTo",
  fromHere: "runLogTriggerFromHere",
  single: "runLogTriggerSingle",
};

/**
 * Only loading / error / noRuns are decidable from the list's own data; the
 * step-level inputs are fixed non-empty so `getRunLogEmptyKind` stays the one
 * source of truth for those three states.
 */
const NON_EMPTY: readonly unknown[] = [true];

const OPTION_SELECTOR = '[role="option"]';
const LIST_PADDING_AND_GAP = "flex flex-col gap-0.5 p-1";
const SUMMARY_SEPARATOR = " · ";

function optionButton(option: Element | undefined): HTMLElement | null {
  return option?.querySelector<HTMLElement>("button") ?? null;
}

function focusOption(option: Element | undefined) {
  optionButton(option)?.focus();
}

function runSummaryText(
  run: RunSummary,
  t: ReturnType<typeof useTranslations>,
  nodeLabels: Record<string, string> | undefined,
): string {
  const anchor = resolveAnchorLabel(run, nodeLabels ?? {});
  const { passed, failed, skipped, aborted } = run.counts;
  const parts = [
    t(anchor.key, anchor.values),
    t("runLogCollapsedSummary", {
      total: passed + failed + skipped + aborted,
      passed,
      failed,
      skipped,
    }),
  ];
  if (run.finishedAt !== undefined) {
    parts.push(formatDuration(Math.max(0, run.finishedAt - run.startedAt)));
  }
  return parts.join(SUMMARY_SEPARATOR);
}

/** Moves focus between options; returns true when the key was handled. */
function handleNavigationKey(key: string, list: HTMLElement, current: Element) {
  const options = Array.from(list.querySelectorAll(OPTION_SELECTOR));
  const index = options.indexOf(current);
  const targets: Record<string, number> = {
    ArrowDown: Math.min(index + 1, options.length - 1),
    ArrowUp: Math.max(index - 1, 0),
    Home: 0,
    End: options.length - 1,
  };
  if (!(key in targets)) return false;
  focusOption(options[targets[key]]);
  return true;
}

export function RunsList({
  runs,
  activeRun,
  selectedRunId,
  runsLoading = false,
  runsError = null,
  onRetryLoad,
  nodeLabels,
  onSelectRun,
  onRerun,
  onDeleteRun,
  runBlockReason = null,
  onRunFlow,
}: RunsListProps) {
  const t = useTranslations("chain");
  const undoDeleteRun = useChainRunStore((s) => s.undoDeleteRun);
  const listRef = useRef<HTMLDivElement>(null);
  const refocusTopAfterRerun = useRef(false);

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => b.startedAt - a.startedAt),
    [runs],
  );
  const liveNodeIds = useMemo(
    () => (nodeLabels ? new Set(Object.keys(nodeLabels)) : undefined),
    [nodeLabels],
  );
  const topRunId = activeRun?.id ?? sortedRuns[0]?.id;

  // Re-run starts a new live run that lands at the top; wait for it to render
  // before moving focus there.
  useEffect(() => {
    if (!refocusTopAfterRerun.current) return;
    refocusTopAfterRerun.current = false;
    focusOption(listRef.current?.querySelector(OPTION_SELECTOR) ?? undefined);
  }, [topRunId]);

  const handleRerun = useCallback(
    (run: RunSummary) => {
      refocusTopAfterRerun.current = true;
      onRerun(run);
    },
    [onRerun],
  );

  const handleCopySummary = useCallback(
    (run: RunSummary) => {
      navigator.clipboard
        .writeText(runSummaryText(run, t, nodeLabels))
        .then(() => toast.success(t("runLogCopyCopied")))
        .catch((error: unknown) => {
          console.error("Failed to copy run summary", { runId: run.id, error });
        });
    },
    [t, nodeLabels],
  );

  const handleDelete = useCallback(
    (run: RunSummary) => {
      onDeleteRun(run.id);
      toast(t("runLogDeleteUndoToast"), {
        duration: RUN_DELETE_UNDO_MS,
        action: {
          label: t("runLogUndo"),
          onClick: () => undoDeleteRun(run.id),
        },
      });
    },
    [onDeleteRun, undoDeleteRun, t],
  );

  const menuFor = useCallback(
    (run: RunSummary) => (
      <RunCardMenu
        run={run}
        rerunEnabled={liveNodeIds ? canRerun(run, liveNodeIds) : true}
        onRerun={handleRerun}
        onCopySummary={handleCopySummary}
        onDelete={handleDelete}
      />
    ),
    [liveNodeIds, handleRerun, handleCopySummary, handleDelete],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    const option = (event.target as Element).closest(OPTION_SELECTOR);
    // Portaled menu content bubbles through React but is outside the option.
    if (!list || !option) return;
    if (handleNavigationKey(event.key, list, option)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Delete") return;
    const run = sortedRuns.find(
      (r) => r.id === option.getAttribute("data-run-id"),
    );
    if (!run) return; // The live run cannot be deleted.
    event.preventDefault();
    const siblings = Array.from(list.querySelectorAll(OPTION_SELECTOR));
    const index = siblings.indexOf(option);
    focusOption(siblings[index + 1] ?? siblings[index - 1]);
    handleDelete(run);
  };

  const emptyKind = getRunLogEmptyKind({
    runs: activeRun ? [activeRun, ...sortedRuns] : sortedRuns,
    selectedRun: true,
    steps: NON_EMPTY,
    filteredSteps: NON_EMPTY,
    selectedStep: true,
    loading: runsLoading,
    error: runsError,
  });

  if (emptyKind) {
    return (
      <div data-testid={`run-log-empty-${emptyKind}`} className="h-full">
        <RunLogEmptyState
          kind={emptyKind}
          runBlockReason={runBlockReason}
          errorMessage={runsError ?? ""}
          onRunFlow={onRunFlow}
          onRetry={onRetryLoad}
        />
      </div>
    );
  }

  const renderCard = (run: RunSummary) => (
    <RunCard
      key={run.id}
      run={run}
      selected={selectedRunId === run.id}
      anchorLabel={
        run.anchorNodeId === undefined
          ? undefined
          : nodeLabels?.[run.anchorNodeId]
      }
      onSelect={onSelectRun}
      menu={run.status === "running" ? undefined : menuFor(run)}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <RelativeNowProvider>
        {/* Keyboard handling lives on the listbox; each option's button is the focus target. */}
        <div
          ref={listRef}
          role="listbox"
          aria-label={t("runLogTitle")}
          onKeyDown={handleKeyDown}
          className={cn("min-h-0 flex-1 overflow-y-auto", LIST_PADDING_AND_GAP)}
        >
          {/* One keyed array so a live card keeps its DOM node (and focus) when its run finishes. */}
          {(activeRun ? [activeRun, ...sortedRuns] : sortedRuns).map(
            renderCard,
          )}
        </div>
      </RelativeNowProvider>
    </div>
  );
}
