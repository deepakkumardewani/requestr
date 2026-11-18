"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  RelativeNowProvider,
  useRelativeNowValue,
} from "@/components/chain/RelativeNowProvider";
import type { RunSummary } from "@/lib/chainRunHistory";
import {
  DEFAULT_RUN_LOG_HEIGHT,
  MIN_RUN_LOG_HEIGHT,
  useUIStore,
} from "@/stores/useUIStore";
import { RunLogCollapsedBar } from "./RunLogCollapsedBar";
import { RunLogHeader } from "./RunLogHeader";
import { RunLogResizeHandle } from "./RunLogResizeHandle";
import { RunLogSplit } from "./RunLogSplit";

/** Collapsed-strip height in px. */
const COLLAPSED_HEIGHT = 32;
/** Max dock height as a fraction of viewport height. */
const MAX_HEIGHT_RATIO = 0.6;

type RunLogDockProps = {
  /** Whether a run is currently in flight — drives auto-open. */
  isRunning: boolean;
  /** Total run count for this chain, shown in the header. */
  runCount: number;
  /** Most recent run (live or historical) — drives the collapsed bar's summary. */
  latestRun?: RunSummary | null;
  onClearAll: () => void;
  /** Runs list, shown in the left column of a wide dock. */
  list: React.ReactNode;
  /** Compact run picker that replaces `list` when the dock is narrow. */
  runSelect?: React.ReactNode;
  /** Summary header of the selected run, rendered above the steps. */
  summary?: React.ReactNode;
  /** Steps timeline (owns the filter tabs and search). */
  steps: React.ReactNode;
  detail: React.ReactNode;
};

function maxDockHeight(): number {
  return typeof window === "undefined"
    ? Number.POSITIVE_INFINITY
    : window.innerHeight * MAX_HEIGHT_RATIO;
}

function clampHeight(height: number): number {
  return Math.min(Math.max(height, MIN_RUN_LOG_HEIGHT), maxDockHeight());
}

type CollapsedBarWithNowProps = {
  latestRun: RunSummary | null;
  panelId: string;
  onExpand: () => void;
};

/** The only dock part that reads the tick, so a tick never re-renders the expanded body. */
function CollapsedBarWithNow({
  latestRun,
  panelId,
  onExpand,
}: CollapsedBarWithNowProps) {
  const now = useRelativeNowValue();
  return (
    <RunLogCollapsedBar
      run={latestRun}
      now={now}
      panelId={panelId}
      onExpand={onExpand}
    />
  );
}

export function RunLogDock({
  isRunning,
  runCount,
  latestRun = null,
  onClearAll,
  list,
  runSelect,
  summary,
  steps,
  detail,
}: RunLogDockProps) {
  const t = useTranslations("chain");
  const panelId = useId();
  const storedHeight = useUIStore((s) => s.chainRunLogHeight);
  const autoOpen = useUIStore((s) => s.chainRunLogAutoOpen);
  // Single source of truth — the page header toggle writes the same flag.
  const collapsed = useUIStore((s) => s.chainRunLogCollapsed);
  const setChainRunLogHeight = useUIStore((s) => s.setChainRunLogHeight);
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
  const expand = useCallback(() => setCollapsed(false), [setCollapsed]);

  return (
    <RelativeNowProvider>
      <section
        id={panelId}
        aria-label={t("runLogTitle")}
        data-testid="run-log-dock"
        className="flex shrink-0 flex-col border-t border-border bg-card"
        style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
      >
        {collapsed ? (
          <CollapsedBarWithNow
            latestRun={latestRun}
            panelId={panelId}
            onExpand={expand}
          />
        ) : (
          <>
            <RunLogResizeHandle
              height={height}
              minHeight={MIN_RUN_LOG_HEIGHT}
              maxHeight={maxDockHeight()}
              onPreview={setDragHeight}
              onCommit={setChainRunLogHeight}
            />
            <RunLogHeader
              runCount={runCount}
              collapsed={false}
              onToggleCollapsed={toggleCollapsed}
              onClearAll={onClearAll}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <RunLogSplit
                list={list}
                runSelect={runSelect}
                steps={
                  <div className="flex h-full min-h-0 flex-col">
                    {summary}
                    <div className="min-h-0 flex-1">{steps}</div>
                  </div>
                }
                detail={detail}
              />
            </div>
          </>
        )}
      </section>
    </RelativeNowProvider>
  );
}
