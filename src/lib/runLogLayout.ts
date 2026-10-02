/** Layout bounds for the run-log dock's resizable panes (list | steps | detail). */
export const DEFAULT_RUN_LOG_LIST_WIDTH = 288;
export const MIN_RUN_LOG_LIST_WIDTH = 200;
export const MAX_RUN_LOG_LIST_WIDTH = 420;
/** The run list may never take more than this share of the dock's width. */
export const MAX_RUN_LOG_LIST_DOCK_SHARE = 0.5;

export const DEFAULT_RUN_LOG_DETAIL_RATIO = 0.5;
export const MIN_RUN_LOG_DETAIL_RATIO = 0.25;
export const MAX_RUN_LOG_DETAIL_RATIO = 0.75;

/** Keyboard resize step in px (arrow keys on a resize handle). */
export const RUN_LOG_RESIZE_STEP = 16;

/**
 * Clamps the run-list width to 200..420px, further capped at 50% of the dock
 * when `dockWidth` is known. The minimum always wins so a tiny dock never
 * yields an unusably narrow list. Non-finite input falls back to the default.
 */
export function clampListWidth(width: number, dockWidth?: number): number {
  if (!Number.isFinite(width)) return DEFAULT_RUN_LOG_LIST_WIDTH;
  const dockCap =
    dockWidth !== undefined && Number.isFinite(dockWidth)
      ? dockWidth * MAX_RUN_LOG_LIST_DOCK_SHARE
      : Infinity;
  const max = Math.max(
    MIN_RUN_LOG_LIST_WIDTH,
    Math.min(MAX_RUN_LOG_LIST_WIDTH, dockCap),
  );
  return Math.min(max, Math.max(MIN_RUN_LOG_LIST_WIDTH, width));
}

/** Clamps the detail pane's share of the steps+detail area to 0.25..0.75. */
export function clampDetailRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_RUN_LOG_DETAIL_RATIO;
  return Math.min(
    MAX_RUN_LOG_DETAIL_RATIO,
    Math.max(MIN_RUN_LOG_DETAIL_RATIO, ratio),
  );
}
