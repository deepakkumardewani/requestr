"use client";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { RunSummary } from "@/lib/chainRunHistory";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RUN_LOG_HEIGHT,
  MIN_RUN_LOG_HEIGHT,
  useUIStore,
} from "@/stores/useUIStore";
import { StateIcon } from "../nodes/nodeStateStyles";
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

function clampHeight(height: number): number {
  const max =
    typeof window === "undefined"
      ? Number.POSITIVE_INFINITY
      : window.innerHeight * MAX_HEIGHT_RATIO;
  return Math.min(Math.max(height, MIN_RUN_LOG_HEIGHT), max);
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
  const persistedCollapsed = useUIStore((s) => s.chainRunLogCollapsed);
  const setChainRunLogHeight = useUIStore((s) => s.setChainRunLogHeight);
  const setChainRunLogAutoOpen = useUIStore((s) => s.setChainRunLogAutoOpen);
  const setChainRunLogCollapsed = useUIStore((s) => s.setChainRunLogCollapsed);

  const [collapsed, setCollapsedState] = useState(persistedCollapsed);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Starts at `false` (not `isRunning`) so the effect below still fires when
  // this component is freshly mounted mid-run — which is exactly what
  // happens when the parent page mounts RunLogDock in response to a run
  // starting (see page.tsx's own auto-open effect). Seeding this ref from
  // `isRunning` would make that "already true at mount" look like no
  // transition occurred, leaving the persisted `collapsed` value (true by
  // default) in place and hiding the dock's contents right when a run start
  // should expand them.
  const wasRunningRef = useRef(false);

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      setChainRunLogCollapsed(next);
    },
    [setChainRunLogCollapsed],
  );

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

  const handleDragStart = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = height;

      function onMouseMove(moveEvent: MouseEvent) {
        const delta = startY - moveEvent.clientY;
        setDragHeight(clampHeight(startHeight + delta));
      }

      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        setDragHeight((current) => {
          if (current !== null) setChainRunLogHeight(current);
          return null;
        });
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [height, setChainRunLogHeight],
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
        <button
          type="button"
          aria-label={t("runLogResizeHandle")}
          onMouseDown={handleDragStart}
          className="h-1 w-full shrink-0 cursor-row-resize bg-transparent hover:bg-border"
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
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("runLogMoreOptions")}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-md border border-border bg-popover p-2 shadow-md">
                  <label className="flex items-center justify-between gap-2 text-xs text-foreground">
                    {t("runLogAutoOpenLabel")}
                    <Switch
                      size="sm"
                      checked={autoOpen}
                      onCheckedChange={(checked) =>
                        setChainRunLogAutoOpen(Boolean(checked))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
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
