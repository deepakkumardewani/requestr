"use client";

import { MoreHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type RunRowProps = {
  run: RunSummary;
  isLive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  /** Omitted for the live row: an in-flight run can be neither re-run nor deleted. */
  onRerun?: () => void;
  onDelete?: () => void;
};

type RunRowMenuProps = { onRerun: () => void; onDelete: () => void };

function RunRowMenu({ onRerun, onDelete }: RunRowMenuProps) {
  const t = useTranslations("chain");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("runLogRowMenu")}
          />
        }
      >
        <MoreHorizontal className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onRerun}>
          {t("runLogRerun")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          {t("runLogDeleteRun")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RunRow({
  run,
  isLive,
  isSelected,
  onSelect,
  onRerun,
  onDelete,
}: RunRowProps) {
  const t = useTranslations("chain");
  const format = useFormatter();
  const { counts } = run;

  // The select target and the menu are siblings: a button nested inside a
  // role=button row is invalid for assistive tech.
  return (
    <div
      className={cn(
        "flex items-center border-b border-border text-xs",
        isSelected ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected || undefined}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
      >
        <StateIcon state={STATUS_ICON_STATE[run.status]} size="h-3.5 w-3.5" />
        <span className="text-muted-foreground">
          {isLive
            ? t("runLogLiveLabel")
            : format.relativeTime(run.startedAt, Date.now())}
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
      </button>
      {!isLive && onRerun && onDelete && (
        <div className="px-2">
          <RunRowMenu onRerun={onRerun} onDelete={onDelete} />
        </div>
      )}
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
