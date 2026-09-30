"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RunStatus, RunSummary, RunTrigger } from "@/lib/chainRunHistory";
import { cn, formatDuration } from "@/lib/utils";
import { StateIcon } from "../nodes/nodeStateStyles";

/** Stable keys for the skeleton rows shown while `runsLoading` is true. */
const LOADING_SKELETON_ROW_KEYS = [
  "run-log-skeleton-row-1",
  "run-log-skeleton-row-2",
  "run-log-skeleton-row-3",
];

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
  onSelectRun: (runId: string) => void;
  onRerun: (run: RunSummary) => void;
  onDeleteRun: (runId: string) => void;
  onClearAll: () => void;
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

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function formatRelativeTime(
  timestampMs: number,
  nowMs: number,
  t: Translator,
): string {
  const deltaSeconds = Math.round((nowMs - timestampMs) / 1000);
  if (deltaSeconds < 5) return t("runLogTimeJustNow");
  if (deltaSeconds < 60)
    return t("runLogTimeSecondsAgo", { seconds: deltaSeconds });
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60)
    return t("runLogTimeMinutesAgo", { minutes: deltaMinutes });
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return t("runLogTimeHoursAgo", { hours: deltaHours });
  const deltaDays = Math.round(deltaHours / 24);
  return t("runLogTimeDaysAgo", { days: deltaDays });
}

type RunRowProps = {
  run: RunSummary;
  isLive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRerun: () => void;
  onDelete: () => void;
};

function RunRow({
  run,
  isLive,
  isSelected,
  onSelect,
  onRerun,
  onDelete,
}: RunRowProps) {
  const t = useTranslations("chain");
  const [menuOpen, setMenuOpen] = useState(false);
  const { counts } = run;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
      className={cn(
        "flex items-center gap-2 border-b border-border px-2 py-1.5 text-xs",
        isSelected ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <StateIcon state={STATUS_ICON_STATE[run.status]} size="h-3.5 w-3.5" />
      <span className="text-muted-foreground">
        {isLive
          ? t("runLogLiveLabel")
          : formatRelativeTime(run.startedAt, Date.now(), t)}
      </span>
      <span className="text-foreground">
        {t("runLogCounts", {
          passed: counts.passed,
          failed: counts.failed,
          skipped: counts.skipped,
        })}
      </span>
      {run.finishedAt && (
        <span className="text-muted-foreground">
          {formatDuration(run.finishedAt - run.startedAt)}
        </span>
      )}
      <Badge variant="outline" className="ml-auto">
        {t(TRIGGER_KEY[run.trigger])}
      </Badge>

      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("runLogRowMenu")}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </Button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
              onClick={() => {
                setMenuOpen(false);
                onRerun();
              }}
            >
              {t("runLogRerun")}
            </button>
            <button
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-xs text-destructive hover:bg-muted"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              {t("runLogDeleteRun")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RunsListSkeleton() {
  return (
    <div
      data-testid="run-log-skeleton"
      className="flex flex-col gap-2 p-2"
      aria-hidden
    >
      {LOADING_SKELETON_ROW_KEYS.map((key) => (
        <Skeleton key={key} className="h-6 w-full" />
      ))}
    </div>
  );
}

type RunsListErrorProps = { message: string; onRetry?: () => void };

function RunsListError({ message, onRetry }: RunsListErrorProps) {
  const t = useTranslations("chain");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
      <span>{t("runLogLoadError", { message })}</span>
      {onRetry && (
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function RunsList({
  runs,
  activeRun,
  selectedRunId,
  runsLoading = false,
  runsError = null,
  onRetryLoad,
  onSelectRun,
  onRerun,
  onDeleteRun,
  onClearAll,
}: RunsListProps) {
  const t = useTranslations("chain");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const sortedRuns = [...runs].sort((a, b) => b.startedAt - a.startedAt);
  const isEmpty = sortedRuns.length === 0 && !activeRun;

  if (runsLoading) {
    return <RunsListSkeleton />;
  }

  if (runsError) {
    return <RunsListError message={runsError} onRetry={onRetryLoad} />;
  }

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        {t("runLogEmpty")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-border px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setConfirmClearOpen(true)}
        >
          {t("runLogClearAll")}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeRun && (
          <RunRow
            key={activeRun.id}
            run={activeRun}
            isLive
            isSelected={selectedRunId === activeRun.id}
            onSelect={() => onSelectRun(activeRun.id)}
            onRerun={() => onRerun(activeRun)}
            onDelete={() => onDeleteRun(activeRun.id)}
          />
        )}
        {sortedRuns.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            isLive={false}
            isSelected={selectedRunId === run.id}
            onSelect={() => onSelectRun(run.id)}
            onRerun={() => onRerun(run)}
            onDelete={() => onDeleteRun(run.id)}
          />
        ))}
      </div>

      <ConfirmDeleteDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title={t("runLogClearAllConfirmTitle")}
        description={t("runLogClearAllConfirmDescription")}
        confirmLabel={t("runLogClearAll")}
        onConfirm={() => {
          setConfirmClearOpen(false);
          onClearAll();
        }}
      />
    </div>
  );
}
