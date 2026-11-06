"use client";

import { useMemo } from "react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeHealthMetrics,
  getEntriesForKey,
  HEALTH_WINDOW,
  healthKey,
} from "@/lib/healthMonitor";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HistoryEntry } from "@/types";
import { HealthPopoverContent } from "./HealthPopover";

const RECENT_TIMES_LIMIT = 20;

// Strips unnecessary trailing zeros: 120.00 → "120", 1.23 → "1.23"
function formatMs(ms: number): string {
  return `${Number(ms.toFixed(2))}ms`;
}

type DotColor = "green" | "amber" | "red";

function getDotColor(successRate: number): DotColor {
  if (successRate >= 95) return "green";
  if (successRate >= 80) return "amber";
  return "red";
}

const DOT_COLOR_CLASSES: Record<DotColor, string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
};

function countStatusBuckets(entries: HistoryEntry[]) {
  const window = entries.slice(0, HEALTH_WINDOW);
  return {
    success: window.filter((e) => e.status >= 200 && e.status < 300).length,
    clientError: window.filter((e) => e.status >= 400 && e.status < 500).length,
    serverError: window.filter((e) => e.status >= 500).length,
  };
}

type HealthDotProps = {
  method: string;
  url: string;
};

export function HealthDot({ method, url }: HealthDotProps) {
  const entries = useHistoryStore((s) => s.entries);
  const setHistoryFilter = useUIStore((s) => s.setHistoryFilter);

  const key = useMemo(() => healthKey(method, url), [method, url]);

  const matchedEntries = useMemo(
    () => getEntriesForKey(entries, key),
    [entries, key],
  );

  const metrics = useMemo(
    () => computeHealthMetrics(matchedEntries),
    [matchedEntries],
  );

  const recentTimes = useMemo(
    () => matchedEntries.slice(0, RECENT_TIMES_LIMIT).map((e) => e.duration),
    [matchedEntries],
  );

  const statusCounts = useMemo(
    () => countStatusBuckets(matchedEntries),
    [matchedEntries],
  );

  // Don't render until there's enough data
  if (!metrics) return null;

  const dotColor = getDotColor(metrics.successRate);
  const ariaLabel = `Last ${metrics.entryCount} requests · ${metrics.successRate}% success · p50 ${formatMs(metrics.p50)} · p95 ${formatMs(metrics.p95)} · Last: ${metrics.lastStatus}`;

  const dot = (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLOR_CLASSES[dotColor]}`}
      aria-hidden="true"
    />
  );

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Popover>
        <Tooltip>
          {/* render prop merges both Base UI triggers onto one <button> */}
          <TooltipTrigger
            render={
              <PopoverTrigger
                className="flex cursor-help items-center gap-1 rounded px-1 py-0.5 hover:bg-muted"
                aria-label={ariaLabel}
              >
                {dot}
                <span className="tabular-nums text-[10px] text-muted-foreground">
                  {metrics.successRate}%
                </span>
                <span className="tabular-nums text-[10px] text-muted-foreground">
                  {formatMs(metrics.p50)}
                </span>
              </PopoverTrigger>
            }
          />
          <TooltipContent side="top" className="flex flex-col gap-1 p-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLOR_CLASSES[dotColor]}`}
              />
              <span className="font-medium">
                {metrics.successRate}% success
              </span>
              <span className="text-background/60">·</span>
              <span className="text-background/70">
                {metrics.entryCount} requests
              </span>
            </div>
            <div className="flex gap-3 text-background/80">
              <span>
                p50{" "}
                <span className="font-medium text-background">
                  {formatMs(metrics.p50)}
                </span>
              </span>
              <span>
                p95{" "}
                <span className="font-medium text-background">
                  {formatMs(metrics.p95)}
                </span>
              </span>
            </div>
            <div className="text-background/70">
              Last:{" "}
              <span className="font-medium text-background">
                {metrics.lastStatus}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
        <HealthPopoverContent
          metrics={metrics}
          recentTimes={recentTimes}
          statusCounts={statusCounts}
          onViewHistory={() => setHistoryFilter(key)}
        />
      </Popover>
    </div>
  );
}
