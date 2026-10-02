"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { RelativeTime } from "@/components/chain/RelativeTime";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RunSummary } from "@/lib/chainRunHistory";
import {
  canRerun,
  formatDuration,
  resolveAnchorLabel,
} from "@/lib/chainRunSummary";

type RunSummaryHeaderProps = {
  run: RunSummary;
  /** Label of the run's anchor node; undefined when the node was deleted. */
  anchorLabel?: string;
  /** Ids of nodes currently on the canvas, used by `canRerun`. */
  liveNodeIds: ReadonlySet<string>;
  /** Starts the same subset again; the owner selects the new live run. */
  onRerun: (run: RunSummary) => void;
};

/** The summary header phrases the fallback as a full "From …" label. */
const HEADER_DELETED_ANCHOR_KEY = "runLogFromDeletedNode";
const DELETED_ANCHOR_KEY = "runLogDeletedNode";
const META_SEPARATOR = " · ";
const TIME_PLACEHOLDER = "\u0000";

function RunSummaryHeaderInner({
  run,
  anchorLabel,
  liveNodeIds,
  onRerun,
}: RunSummaryHeaderProps) {
  const t = useTranslations("chain");
  const anchor = resolveAnchorLabel(
    run,
    run.anchorNodeId === undefined || anchorLabel === undefined
      ? {}
      : { [run.anchorNodeId]: anchorLabel },
  );
  const anchorKey =
    anchor.key === DELETED_ANCHOR_KEY ? HEADER_DELETED_ANCHOR_KEY : anchor.key;
  const isLive = run.status === "running";
  const rerunnable = canRerun(run, liveNodeIds);
  const disabled = !rerunnable || isLive;
  // RelativeTime is a component, so split the ICU string around a sentinel.
  const [before, after = ""] = t("runLogStartedAt", {
    time: TIME_PLACEHOLDER,
  }).split(TIME_PLACEHOLDER);
  const durationMs =
    run.finishedAt === undefined
      ? undefined
      : Math.max(0, run.finishedAt - run.startedAt);

  const rerunButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => onRerun(run)}
    >
      <RotateCcw aria-hidden className="h-3.5 w-3.5" />
      {t("runLogRerun")}
    </Button>
  );

  return (
    <div
      data-testid="run-summary-header"
      className="flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-1 whitespace-nowrap text-sm">
        <span className="truncate font-medium">
          {t(anchorKey, anchor.values)}
        </span>
        <span aria-hidden className="text-muted-foreground">
          {META_SEPARATOR}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {before}
          <RelativeTime timestamp={run.startedAt} />
          {after}
        </span>
        {durationMs !== undefined && (
          <span className="shrink-0 text-muted-foreground">
            {META_SEPARATOR}
            {formatDuration(durationMs)}
          </span>
        )}
        <span className="shrink-0 text-muted-foreground">
          {META_SEPARATOR}
          {t("runLogStepCount", { count: run.steps.length })}
        </span>
      </div>
      {!rerunnable ? (
        <Tooltip>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button can't take focus, so its tooltip needs a focusable wrapper */}
          <TooltipTrigger render={<span tabIndex={0} className="shrink-0" />}>
            {rerunButton}
          </TooltipTrigger>
          <TooltipContent>{t("runLogRerunDisabledNodeGone")}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="shrink-0">{rerunButton}</span>
      )}
    </div>
  );
}

export const RunSummaryHeader = memo(RunSummaryHeaderInner);
