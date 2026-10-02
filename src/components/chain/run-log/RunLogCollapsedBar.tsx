"use client";

import {
  CheckCircle2,
  ChevronUp,
  CircleSlash,
  Loader2,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment } from "react";
import { RelativeTime } from "@/components/chain/RelativeTime";
import type { RunSummary } from "@/lib/chainRunHistory";
import {
  formatDuration,
  getRunStatusDisplay,
  type RunCountKind,
  type RunStatusTone,
  summarizeRun,
} from "@/lib/chainRunSummary";
import { cn } from "@/lib/utils";

const COUNT_LABEL_KEYS = {
  passed: "runLogCountPassed",
  failed: "runLogCountFailed",
  skipped: "runLogCountSkipped",
  stopped: "runLogCountStopped",
} as const satisfies Record<RunCountKind, string>;

/** Each tone has a darker light-theme shade and a 400 dark-theme shade; both clear 4.5:1 on their surface. */
export const TONE_TEXT_CLASSES = {
  success: "text-emerald-700 dark:text-emerald-400",
  danger: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
  info: "text-sky-700 dark:text-sky-400",
} as const satisfies Record<RunStatusTone, string>;

const LAST_RUN_KEYS = {
  passed: "runLogCollapsedLastRunPassed",
  failed: "runLogCollapsedLastRunFailed",
  stopped: "runLogCollapsedLastRunStopped",
} as const;

const TONE_BAR_CLASSES = {
  success: "",
  danger: "bg-red-500/10",
  warning: "bg-amber-500/10",
  info: "",
} as const satisfies Record<RunStatusTone, string>;

/**
 * Secondary text colour per bar tint. `text-muted-foreground` drops below 4.5:1 on the 10% red/amber
 * tints in the light theme (4.18 / 4.47), so tinted bars use foreground/70 (>= 7.2:1 light, >= 8.7:1 dark).
 */
export const TONE_SECONDARY_CLASSES = {
  success: "text-muted-foreground",
  danger: "text-foreground/70",
  warning: "text-foreground/70",
  info: "text-muted-foreground",
} as const satisfies Record<RunStatusTone, string>;

type StatusIconKey = "passed" | "failed" | "stopped" | "running";

/** Stopped uses a different glyph from failed so the two never rely on colour alone. */
const STATUS_ICONS = {
  passed: CheckCircle2,
  failed: XCircle,
  stopped: CircleSlash,
  running: Loader2,
} as const satisfies Record<StatusIconKey, LucideIcon>;

export type RunLogCollapsedBarProps = {
  /** Latest run, or null when the chain has never run. */
  run: Pick<
    RunSummary,
    "status" | "counts" | "startedAt" | "finishedAt"
  > | null;
  /** Step progress of the live run; used only while `run.status` is "running". */
  progress?: { done: number; total: number };
  /** Shared tick from `useRelativeNow`. */
  now: number;
  /** Id of the dock panel this bar expands. */
  panelId: string;
  onExpand: () => void;
};

const BASE_CLASSES =
  "flex h-full w-full min-w-0 items-center gap-1 border-t border-border px-3 text-left text-xs " +
  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/** Decorative divider; the button's aria-label carries the equivalent punctuation. */
function Separator({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn("shrink-0", className)}>
      {" · "}
    </span>
  );
}

export function RunLogCollapsedBar({
  run,
  progress,
  now,
  panelId,
  onExpand,
}: RunLogCollapsedBarProps) {
  const t = useTranslations("chain");
  const format = useFormatter();
  const display = run ? getRunStatusDisplay(run) : null;
  const tone = display?.tone;
  const muted = TONE_SECONDARY_CLASSES[tone ?? "success"];
  const StatusIcon = display ? STATUS_ICONS[display.word] : null;
  const segments =
    run && display ? buildSegments(run, display, progress, t) : null;
  const relative =
    run && display?.word !== "running" && Number.isFinite(run.startedAt)
      ? format.relativeTime(run.startedAt, now)
      : undefined;
  const labelParts = segments
    ? [...segments.map((s) => s.text), relative]
    : [t("runLogNoRunsYet")];
  const ariaLabel = [t("runLogTitle"), ...labelParts.filter(Boolean)].join(
    ", ",
  );

  return (
    <button
      type="button"
      data-testid="run-log-strip"
      aria-label={ariaLabel}
      aria-expanded={false}
      aria-controls={panelId}
      onClick={onExpand}
      className={cn(BASE_CLASSES, tone && TONE_BAR_CLASSES[tone])}
    >
      {StatusIcon && tone ? (
        <StatusIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            TONE_TEXT_CLASSES[tone],
            display?.word === "running" && "animate-spin",
          )}
        />
      ) : null}
      <span className="shrink-0 font-medium text-foreground">
        {t("runLogTitle")}
      </span>
      {segments ? (
        <>
          {segments.map((s) => (
            <Fragment key={s.id}>
              <Separator className={muted} />
              <span className={s.className}>{s.text}</span>
            </Fragment>
          ))}
          {run && relative ? (
            <>
              <Separator className={muted} />
              <RelativeTime
                timestamp={run.startedAt}
                now={now}
                className={cn("min-w-0 shrink-[3] truncate", muted)}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Separator className={muted} />
          <span className={cn("min-w-0 truncate", muted)}>
            {t("runLogNoRunsYet")}
          </span>
        </>
      )}
      <ChevronUp aria-hidden className={cn("ml-auto size-4 shrink-0", muted)} />
    </button>
  );
}

type Segment = { id: string; text: string; className: string };
type Translate = ReturnType<typeof useTranslations<"chain">>;

/** Segments between the title and the relative time; shrink priority is time, then duration, then counts. */
function buildSegments(
  run: NonNullable<RunLogCollapsedBarProps["run"]>,
  display: NonNullable<ReturnType<typeof getRunStatusDisplay>>,
  progress: RunLogCollapsedBarProps["progress"],
  t: Translate,
): Segment[] {
  const statusClass = TONE_TEXT_CLASSES[display.tone];
  const muted = TONE_SECONDARY_CLASSES[display.tone];
  if (display.word === "running") {
    return [
      {
        id: "status",
        text: progress
          ? t("runLogCollapsedRunning", progress)
          : t("runLogCollapsedStatusRunning"),
        className: cn("min-w-0 truncate", statusClass),
      },
    ];
  }
  const { buckets, durationMs } = summarizeRun(run);
  const counts =
    buckets.length > 0
      ? buckets
          .map(({ kind, count }) => t(COUNT_LABEL_KEYS[kind], { count }))
          .join(", ")
      : t("runLogZeroSteps");
  const segments: Segment[] = [
    {
      id: "status",
      text: t(LAST_RUN_KEYS[display.word]),
      className: cn("shrink-0 font-medium", statusClass),
    },
    {
      id: "counts",
      text: counts,
      className: cn("min-w-0 shrink truncate", muted),
    },
  ];
  if (durationMs !== undefined) {
    segments.push({
      id: "duration",
      text: formatDuration(durationMs),
      className: cn("min-w-0 shrink-[2] truncate", muted),
    });
  }
  return segments;
}
