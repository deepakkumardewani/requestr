"use client";

import { PanelBottom, Play, Square, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { RunWithInputsPopover } from "@/components/chain/dialogs/RunWithInputsPopover";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import type { ChainInput } from "@/types/chain";

type ChainPageHeaderProps = {
  chainTitle: string;
  requestCount: number;
  hasRunResult: boolean;
  isRunning: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  hasCycle?: boolean;
  hasInvalidMerge?: boolean;
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
  hasCycle,
  hasInvalidMerge,
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
  const historyLabel =
    lastRunAt === undefined
      ? t("notYetRun")
      : t("lastRun", { time: format.relativeTime(lastRunAt, Date.now()) });
  const disableRun = hasCycle || hasInvalidMerge;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <h1 className="sr-only">{chainTitle}</h1>
      <AppBreadcrumb
        items={[{ label: "Home", href: "/app" }, { label: chainTitle }]}
      />
      <span
        data-testid="chain-request-count"
        className="text-xs text-muted-foreground ml-2"
      >
        — {requestCount} request{requestCount !== 1 ? "s" : ""}
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
              <span className="font-semibold">{passedCount}</span> passed
            </span>
          )}
          {failedCount > 0 && (
            <span
              data-testid="chain-failed-count"
              className="flex items-center gap-0.5 text-red-400"
            >
              <span className="font-semibold">{failedCount}</span> failed
            </span>
          )}
          {skippedCount > 0 && (
            <span
              data-testid="chain-skipped-count"
              className="flex items-center gap-0.5 text-zinc-400"
            >
              <span className="font-semibold">{skippedCount}</span> skipped
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
          Clear edges
        </Button>

        {startInputs !== undefined && onRunWithInputs && !isRunning && (
          <RunWithInputsPopover
            inputs={startInputs}
            disabled={requestCount === 0 || disableRun}
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
            Stop
          </Button>
        ) : (
          <Button
            data-testid="run-chain-btn"
            size="sm"
            className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90"
            onClick={onRun}
            disabled={requestCount === 0 || disableRun}
            title={
              hasCycle
                ? t("resolveCycleToRun")
                : hasInvalidMerge
                  ? t("resolveMergeToRun")
                  : undefined
            }
          >
            <Play className="h-3 w-3 fill-current" />
            Run Chain
          </Button>
        )}
      </div>
    </header>
  );
}
