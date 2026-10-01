"use client";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RunSummary } from "@/lib/chainRunHistory";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RUN_LOG_HEIGHT,
  MIN_RUN_LOG_HEIGHT,
  useUIStore,
} from "@/stores/useUIStore";
import { StateIcon } from "../nodes/nodeStateStyles";
import { RunLogResizeHandle } from "./RunLogResizeHandle";
import { STATUS_ICON_STATE, TRIGGER_KEY } from "./RunsList";

/** Collapsed-strip height in px. */
const COLLAPSED_HEIGHT = 32;
/** Max dock height as a fraction of viewport height. */
const MAX_HEIGHT_RATIO = 0.6;

type RunLogDockProps = {
  /** Whether a run is currently in flight — drives auto-open. */
  isRunning: boolean;
  /** Total run count for this chain, shown next to the title. */
  runCount: number;
  /** Most recent run (live or historical) — drives the collapsed strip's summary. */
  latestRun?: RunSummary | null;
  children: React.ReactNode;
};

function maxDockHeight(): number {
  return typeof window === "undefined"
    ? Number.POSITIVE_INFINITY
    : window.innerHeight * MAX_HEIGHT_RATIO;
}

function clampHeight(height: number): number {
  return Math.min(Math.max(height, MIN_RUN_LOG_HEIGHT), maxDockHeight());
}

export function RunLogDock({
  isRunning,
  runCount,
  latestRun = null,
  children,
}: RunLogDockProps) {
  const t = useTranslations("chain");
  const storedHeight = useUIStore((s) => s.chainRunLogHeight);
  const autoOpen = useUIStore((s) => s.chainRunLogAutoOpen);
  // Single source of truth — the page header toggle writes the same flag.
  const collapsed = useUIStore((s) => s.chainRunLogCollapsed);
  const setChainRunLogHeight = useUIStore((s) => s.setChainRunLogHeight);
  const setChainRunLogAutoOpen = useUIStore((s) => s.setChainRunLogAutoOpen);
  const setCollapsed = useUIStore((s) => s.setChainRunLogCollapsed);

  const [dragHeight, setDragHeight] = useState<number | null>(null);
  // Seeded `false` so a dock mounted mid-run still treats the run as a fresh start.
  const wasRunningRef = useRef(false);

  // Auto-open the dock the moment a run starts, honoring the persisted preference.
  useEffect(() => {
    if (!wasRunningRef.current && isRunning && autoOpen) {
      setCollapsed(false);
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, autoOpen, setCollapsed]);

  const height = clampHeight(
    dragHeight ?? storedHeight ?? DEFAULT_RUN_LOG_HEIGHT,
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  return (
    <div
      data-testid="run-log-dock"
      className="flex shrink-0 flex-col border-t border-border bg-card"
      style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
    >
      {!collapsed && (
        <RunLogResizeHandle
          height={height}
          minHeight={MIN_RUN_LOG_HEIGHT}
          maxHeight={maxDockHeight()}
          onPreview={setDragHeight}
          onCommit={setChainRunLogHeight}
        />
      )}

      <div
        data-testid="run-log-strip"
        className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3"
      >
        {collapsed && latestRun ? (
          <div
            className="flex min-w-0 items-center gap-2"
            role="status"
            aria-label={t("runLogCollapsedSummary", {
              total: latestRun.steps.length,
              passed: latestRun.counts.passed,
              failed: latestRun.counts.failed,
              skipped: latestRun.counts.skipped,
            })}
          >
            <StateIcon
              state={STATUS_ICON_STATE[latestRun.status]}
              size="h-3.5 w-3.5"
            />
            <span className="truncate text-xs text-foreground">
              {t(TRIGGER_KEY[latestRun.trigger])}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("runLogCounts", {
                passed: latestRun.counts.passed,
                failed: latestRun.counts.failed,
                skipped: latestRun.counts.skipped,
              })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t("runLogTitle")}
            </span>
            <span className="text-xs text-muted-foreground">({runCount})</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("runLogMoreOptions")}
                  />
                }
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem
                  checked={autoOpen}
                  onCheckedChange={(checked) =>
                    setChainRunLogAutoOpen(Boolean(checked))
                  }
                >
                  {t("runLogAutoOpenLabel")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={collapsed ? t("runLogExpand") : t("runLogCollapse")}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className={cn("min-h-0 flex-1 overflow-hidden")}>{children}</div>
      )}
    </div>
  );
}
