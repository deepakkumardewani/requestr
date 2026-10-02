"use client";

import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  clampDetailRatio,
  clampListWidth,
  DEFAULT_RUN_LOG_DETAIL_RATIO,
  DEFAULT_RUN_LOG_LIST_WIDTH,
  MAX_RUN_LOG_DETAIL_RATIO,
  MAX_RUN_LOG_LIST_WIDTH,
  MIN_RUN_LOG_DETAIL_RATIO,
  MIN_RUN_LOG_LIST_WIDTH,
} from "@/lib/runLogLayout";
import { useUIStore } from "@/stores/useUIStore";
import { ResizeSeparator } from "./RunLogResizeHandle";

/** Detail ratio is exposed to the separator as a percentage. */
const PERCENT = 100;
/** Below this dock width the runs list collapses into a `RunSelect`. */
export const NARROW_DOCK_BREAKPOINT_PX = 560;
/** Pixel extent assumed before the first layout measurement. */
const FALLBACK_EXTENT_PX = 400;

type RunLogSplitProps = {
  list: React.ReactNode;
  /** Replaces the list (and its separator) when the dock is narrow. */
  runSelect?: React.ReactNode;
  steps: React.ReactNode;
  detail: React.ReactNode;
};

type Size = { width: number; height: number };

function useElementSize(ref: React.RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * Run-log body: runs list | (steps over detail), with a draggable column
 * divider and a row divider. Live values stay local during a drag and reach
 * the persisted store only on pointer-up.
 */
export function RunLogSplit({
  list,
  runSelect,
  steps,
  detail,
}: RunLogSplitProps) {
  const t = useTranslations("chain");
  const containerRef = useRef<HTMLDivElement>(null);
  const detailAreaRef = useRef<HTMLDivElement>(null);
  const dockSize = useElementSize(containerRef);
  const detailAreaSize = useElementSize(detailAreaRef);

  const storedWidth = useUIStore((s) => s.chainRunLogListWidth);
  const storedRatio = useUIStore((s) => s.chainRunLogDetailRatio);
  const setListWidth = useUIStore((s) => s.setChainRunLogListWidth);
  const setDetailRatio = useUIStore((s) => s.setChainRunLogDetailRatio);

  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [livePercent, setLivePercent] = useState<number | null>(null);

  const dockWidth = dockSize.width > 0 ? dockSize.width : undefined;
  const listWidth = clampListWidth(liveWidth ?? storedWidth, dockWidth);
  const listMax = clampListWidth(MAX_RUN_LOG_LIST_WIDTH, dockWidth);
  const detailPercent = livePercent ?? clampDetailRatio(storedRatio) * PERCENT;

  // Width 0 means not yet measured; stay on the wide layout until then.
  const isNarrow =
    runSelect != null &&
    dockSize.width > 0 &&
    dockSize.width < NARROW_DOCK_BREAKPOINT_PX;

  const detailUnitsPerPixel = useCallback(
    () => PERCENT / (detailAreaSize.height || FALLBACK_EXTENT_PX),
    [detailAreaSize.height],
  );

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full">
      {!isNarrow && (
        <>
          <div
            className="min-h-0 shrink-0 overflow-hidden"
            style={{ width: listWidth }}
          >
            {list}
          </div>
          <ResizeSeparator
            orientation="vertical"
            label={t("runLogResizeList")}
            value={listWidth}
            min={MIN_RUN_LOG_LIST_WIDTH}
            max={listMax}
            defaultValue={DEFAULT_RUN_LOG_LIST_WIDTH}
            onPreview={setLiveWidth}
            onCommit={(width) => setListWidth(width, dockWidth)}
          />
        </>
      )}
      <div ref={detailAreaRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isNarrow && runSelect}
        <div
          className="min-h-0 overflow-auto"
          style={{ flex: `${PERCENT - detailPercent} 1 0%` }}
        >
          {steps}
        </div>
        <ResizeSeparator
          orientation="horizontal"
          label={t("runLogResizeDetail")}
          value={detailPercent}
          min={MIN_RUN_LOG_DETAIL_RATIO * PERCENT}
          max={MAX_RUN_LOG_DETAIL_RATIO * PERCENT}
          defaultValue={DEFAULT_RUN_LOG_DETAIL_RATIO * PERCENT}
          getUnitsPerPixel={detailUnitsPerPixel}
          onPreview={setLivePercent}
          onCommit={(percent) => setDetailRatio(percent / PERCENT)}
        />
        <div
          className="min-h-0 overflow-auto"
          style={{ flex: `${detailPercent} 1 0%` }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
}
