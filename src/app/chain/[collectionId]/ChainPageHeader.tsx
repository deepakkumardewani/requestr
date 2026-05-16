"use client";

import { Play, Square, Trash2 } from "lucide-react";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { Button } from "@/components/ui/button";

type ChainPageHeaderProps = {
  chainTitle: string;
  requestCount: number;
  hasRunResult: boolean;
  isRunning: boolean;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  onClearEdges: () => void;
  onStop: () => void;
  onRun: () => void;
};

export function ChainPageHeader({
  chainTitle,
  requestCount,
  hasRunResult,
  isRunning,
  passedCount,
  failedCount,
  skippedCount,
  onClearEdges,
  onStop,
  onRun,
}: ChainPageHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <h1 className="sr-only">{chainTitle}</h1>
      <AppBreadcrumb
        items={[{ label: "Home", href: "/" }, { label: chainTitle }]}
      />
      <span
        data-testid="chain-request-count"
        className="text-xs text-muted-foreground ml-2"
      >
        — {requestCount} request{requestCount !== 1 ? "s" : ""}
      </span>

      <div className="flex-1" />

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
            disabled={requestCount === 0}
          >
            <Play className="h-3 w-3 fill-current" />
            Run Chain
          </Button>
        )}
      </div>
    </header>
  );
}
