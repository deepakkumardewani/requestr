"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader2, OctagonMinus, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, type ReactNode } from "react";
import { RelativeTime } from "@/components/chain/RelativeTime";
import type { RunSummary } from "@/lib/chainRunHistory";
import {
  formatDuration,
  formatRunCounts,
  getRunStatusDisplay,
  type RunCountKind,
  type RunStatusTone,
  resolveAnchorLabel,
} from "@/lib/chainRunSummary";
import { cn } from "@/lib/utils";

type RunCardProps = {
  run: RunSummary;
  selected: boolean;
  /**
   * Label of the run's anchor node (undefined when deleted). A primitive so a
   * rebuilt label map upstream never breaks this card's memoization.
   */
  anchorLabel?: string;
  onSelect: (runId: string) => void;
  /** Row menu trigger (owned by RunsList); never rendered for a live run. */
  menu?: ReactNode;
};

const TONE_TEXT = {
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
} as const satisfies Record<RunStatusTone, string>;

const TONE_INDICATOR = {
  success: "bg-emerald-500",
  danger: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-sky-500",
} as const satisfies Record<RunStatusTone, string>;

const STATUS_ICONS = {
  passed: CheckCircle2,
  failed: XCircle,
  stopped: OctagonMinus,
  running: Loader2,
} as const satisfies Record<string, LucideIcon>;

const COUNT_KEYS = {
  passed: "runLogCountPassed",
  failed: "runLogCountFailed",
  skipped: "runLogCountSkipped",
  stopped: "runLogCountStopped",
} as const satisfies Record<RunCountKind, string>;

const COUNT_SEPARATOR = ", ";
const META_SEPARATOR = " · ";

function RunCardInner({
  run,
  selected,
  anchorLabel,
  onSelect,
  menu,
}: RunCardProps) {
  const t = useTranslations("chain");
  const display = getRunStatusDisplay(run);
  const isLive = run.status === "running";
  const StatusIcon = STATUS_ICONS[display.word];
  const anchor = resolveAnchorLabel(
    run,
    run.anchorNodeId === undefined || anchorLabel === undefined
      ? {}
      : { [run.anchorNodeId]: anchorLabel },
  );
  const triggerLabel = t(anchor.key, anchor.values);
  const buckets = formatRunCounts(run.counts);
  const countsText = buckets
    .map((bucket) => t(COUNT_KEYS[bucket.kind], { count: bucket.count }))
    .join(COUNT_SEPARATOR);
  const hasNoSteps = buckets.length === 0 && !isLive;
  const durationMs =
    run.finishedAt === undefined
      ? undefined
      : Math.max(0, run.finishedAt - run.startedAt);

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-current={selected ? "true" : undefined}
      data-run-id={run.id}
      className={cn(
        "group relative h-14 rounded-md transition-colors",
        selected ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      {selected && (
        <span
          aria-hidden
          data-testid="run-card-indicator"
          className={cn(
            "absolute inset-y-1 left-0 w-0.5 rounded-full",
            TONE_INDICATOR[display.tone],
          )}
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(run.id)}
        className="flex h-full w-full min-w-0 flex-col justify-center gap-0.5 rounded-md py-1.5 pl-3 pr-9 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2">
          <StatusIcon
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              TONE_TEXT[display.tone],
              isLive && "animate-spin",
            )}
          />
          <span className="sr-only">{t(display.key)}</span>
          <span
            title={triggerLabel}
            className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium"
          >
            {triggerLabel}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1 whitespace-nowrap pl-5.5 text-xs text-muted-foreground">
          <span className="truncate">
            {hasNoSteps
              ? t("runLogZeroSteps")
              : countsText || t("runLogLiveLabel")}
          </span>
          <span aria-hidden>{META_SEPARATOR}</span>
          <RelativeTime timestamp={run.startedAt} className="shrink-0" />
          {durationMs !== undefined && (
            <span className="shrink-0">
              {META_SEPARATOR}
              {formatDuration(durationMs)}
            </span>
          )}
        </span>
      </button>
      {menu && !isLive && (
        <div
          data-testid="run-card-menu"
          className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {menu}
        </div>
      )}
    </div>
  );
}

/** Re-renders only when its run, selection or anchor label change; the time
 * element owns its own tick. */
export const RunCard = memo(RunCardInner);
