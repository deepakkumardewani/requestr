"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RelativeTime } from "@/components/chain/RelativeTime";
import { useOpenRun } from "@/components/chain/run-log/useOpenRun";
import { useRelativeNow } from "@/hooks/useRelativeNow";
import type { RunCountKind } from "@/lib/chainRunSummary";
import {
  selectLatestRunSummary,
  useChainRunStore,
} from "@/stores/useChainRunStore";

const FRESH_RUN_WINDOW_MS = 60_000;

const COUNT_LABEL_KEYS = {
  passed: "runLogCountPassed",
  failed: "runLogCountFailed",
  skipped: "runLogCountSkipped",
  stopped: "runLogCountStopped",
} as const satisfies Record<RunCountKind, string>;

const COUNT_STYLES: Record<RunCountKind, string> = {
  passed: "text-emerald-400",
  failed: "text-red-400",
  skipped: "text-zinc-400",
  stopped: "text-amber-400",
};

type LastRunStatusProps = {
  chainId: string;
  /** Total nodes on the canvas; the status is hidden for an empty chain. */
  nodeCount: number;
  /** True while a live run is in progress. */
  isRunning: boolean;
};

export function LastRunStatus({
  chainId,
  nodeCount,
  isRunning,
}: LastRunStatusProps) {
  const t = useTranslations("chain");
  const openRun = useOpenRun();
  const summary = useChainRunStore(selectLatestRunSummary(chainId));
  const isFresh =
    summary !== null && Date.now() - summary.finishedAt < FRESH_RUN_WINDOW_MS;
  const now = useRelativeNow(undefined, { isFresh });

  if (nodeCount === 0) return null;

  if (!summary) {
    return (
      <span
        data-testid="chain-history-label"
        className="text-xs text-muted-foreground"
      >
        {isRunning ? <RunningIndicator /> : t("headerNotYetRun")}
      </span>
    );
  }

  const showCounts = !isRunning;
  const countsText = summary.buckets
    .map(({ kind, count }) => t(COUNT_LABEL_KEYS[kind], { count }))
    .join(", ");

  return (
    <button
      type="button"
      data-testid="chain-history-label"
      aria-label={t("headerOpenLastRun")}
      onClick={() => openRun(summary.runId)}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span>{t("headerLastRun")}</span>
      {isRunning && <RunningIndicator />}
      {showCounts && (
        <>
          <span aria-hidden="true">·</span>
          {summary.buckets.length === 0 ? (
            <span>{t("headerLastRunNoSteps")}</span>
          ) : (
            <span
              className="flex items-center gap-2"
              title={t("headerLastRunCounts", { counts: countsText })}
            >
              {summary.buckets.map(({ kind, count }) => (
                <span
                  key={kind}
                  data-testid={`chain-${kind}-count`}
                  className={COUNT_STYLES[kind]}
                >
                  {t(COUNT_LABEL_KEYS[kind], { count })}
                </span>
              ))}
            </span>
          )}
        </>
      )}
      <span aria-hidden="true">·</span>
      <RelativeTime timestamp={summary.finishedAt} now={now} />
    </button>
  );
}

function RunningIndicator() {
  const t = useTranslations("chain");
  return (
    <span
      data-testid="chain-running-indicator"
      className="flex items-center gap-1"
    >
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      {t("runLogCollapsedStatusRunning")}
    </span>
  );
}
