"use client";

import { PanelBottom, Play, Square, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { RunWithInputsPopover } from "@/components/chain/dialogs/RunWithInputsPopover";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import type { RunBlockReason } from "@/lib/chainRunBlock";
import type { ChainInput } from "@/types/chain";

// "empty" needs no tooltip: the empty-state page already explains it.
const RUN_BLOCK_TITLE_KEYS = {
  cycle: "resolveCycleToRun",
  invalidMerge: "resolveMergeToRun",
  unpairedLoop: "resolveLoopToRun",
  unresolvedCollect: "resolveCollectToRun",
  loopNesting: "resolveLoopNestingToRun",
  invalidSubChain: "resolveSubChainToRun",
} as const satisfies Partial<Record<RunBlockReason, string>>;

/** Translation key explaining why Run is blocked; `undefined` when runnable or self-explanatory ("empty"). */
export function getRunBlockTitleKey(
  reason: RunBlockReason | null,
):
  | (typeof RUN_BLOCK_TITLE_KEYS)[keyof typeof RUN_BLOCK_TITLE_KEYS]
  | undefined {
  return reason && reason !== "empty"
    ? RUN_BLOCK_TITLE_KEYS[reason]
    : undefined;
}

type ChainPageHeaderProps = {
  chainTitle: string;
  requestCount: number;
  hasRunResult: boolean;
  isRunning: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  /** Why Run is disabled (from `getRunBlockReason`); null when the chain can run. */
  runBlockReason: RunBlockReason | null;
  /** Timestamp (ms) of the most recent recorded run, or undefined if the chain has never run. */
  lastRunAt?: number;
  isDockOpen: boolean;
  /** Start block's inputs, when the chain has a Start block. `undefined` hides "Run with inputs" entirely. */
  startInputs?: ChainInput[];
  onToggleDock: () => void;
  onClearEdges: () => void;
  onStop: () => void;
  onRun: () => void;
  /** Runs the chain with the given Start-input overrides. Only invoked when `startInputs` is defined. */
  onRunWithInputs?: (overrides: Record<string, string>) => void;
};

export function ChainPageHeader({
  chainTitle,
  requestCount,
  hasRunResult,
  isRunning,
  passedCount,
  failedCount,
  skippedCount,
  runBlockReason,
  lastRunAt,
  isDockOpen,
  startInputs,
  onToggleDock,
  onClearEdges,
  onStop,
  onRun,
  onRunWithInputs,
}: ChainPageHeaderProps) {
  const t = useTranslations("chain");
  const format = useFormatter();
  const runBlockTitleKey = getRunBlockTitleKey(runBlockReason);
  const historyLabel =
    lastRunAt === undefined
      ? t("notYetRun")
      : t("lastRun", { time: format.relativeTime(lastRunAt, Date.now()) });

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <h1 className="sr-only">{chainTitle}</h1>
      <AppBreadcrumb
        items={[
          { label: t("breadcrumbHome"), href: "/app" },
          { label: chainTitle },
        ]}
      />
      <span
        data-testid="chain-request-count"
        className="text-xs text-muted-foreground ml-2"
      >
        {t("headerRequestCount", { count: requestCount })}
      </span>

      <div className="flex-1" />

      <span
        data-testid="chain-history-label"
        className="text-xs text-muted-foreground"
      >
        {historyLabel}
      </span>

      {hasRunResult && !isRunning && (
        <div className="flex items-center gap-2 text-xs">
          {passedCount > 0 && (
            <span
              data-testid="chain-passed-count"
              className="flex items-center gap-0.5 text-emerald-400"
            >
              <span className="font-semibold">{passedCount}</span>{" "}
              {t("headerPassedLabel")}
            </span>
          )}
          {failedCount > 0 && (
            <span
              data-testid="chain-failed-count"
              className="flex items-center gap-0.5 text-red-400"
            >
              <span className="font-semibold">{failedCount}</span>{" "}
              {t("headerFailedLabel")}
            </span>
          )}
          {skippedCount > 0 && (
            <span
              data-testid="chain-skipped-count"
              className="flex items-center gap-0.5 text-zinc-400"
            >
              <span className="font-semibold">{skippedCount}</span>{" "}
              {t("headerSkippedLabel")}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          data-testid="toggle-run-log-btn"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          aria-pressed={isDockOpen}
          aria-label={
            isDockOpen ? t("toggleRunLogClose") : t("toggleRunLogOpen")
          }
          onClick={onToggleDock}
        >
          <PanelBottom className="h-3.5 w-3.5" />
        </Button>

        <Button
          data-testid="clear-edges-btn"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearEdges}
          disabled={isRunning}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("clearEdgesButton")}
        </Button>

        {startInputs !== undefined && onRunWithInputs && !isRunning && (
          <RunWithInputsPopover
            inputs={startInputs}
            disabled={runBlockReason !== null}
            onRun={onRunWithInputs}
          />
        )}

        {isRunning ? (
          <Button
            data-testid="stop-chain-btn"
            variant="destructive"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onStop}
          >
            <Square className="h-3 w-3 fill-current" />
            {t("stopChainButton")}
          </Button>
        ) : (
          <Button
            data-testid="run-chain-btn"
            size="sm"
            className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90"
            onClick={onRun}
            disabled={runBlockReason !== null}
            title={runBlockTitleKey ? t(runBlockTitleKey) : undefined}
          >
            <Play className="h-3 w-3 fill-current" />
            {t("runChainButton")}
          </Button>
        )}
      </div>
    </header>
  );
}
