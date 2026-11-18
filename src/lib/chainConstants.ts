/**
 * Chain limits shared by the runner and the canvas UI. Kept in a neutral
 * module so UI code never has to import from `chainRunner/executors/**`.
 */

/** Deepest Loop-in-Loop nesting a single graph may run; mirrors the canvas `onConnect` cap. */
export const MAX_LOOP_NESTING_DEPTH = 3;

/** Upper bound on sub-chain nesting depth (distinct from `MAX_SCHEDULER_DEPTH`, which also bounds Loop nesting). */
export const MAX_SUBCHAIN_DEPTH = 5;

/** Nodes the scheduler dispatches in parallel when no `concurrency` is given; also the Settings default. */
export const DEFAULT_CHAIN_CONCURRENCY = 4;

/** Maximum requests a single API-picker multi-select may add to the canvas at once. */
export const PICKER_SELECTION_CAP = 100;

/** Canvas grid cell size in px; node positions are multiples of this when snap-to-grid is on. */
export const GRID_STEP = 16;

/** Below this zoom level Success/Fail edge labels are hidden to avoid clutter. */
export const EDGE_LABEL_MIN_ZOOM = 0.6;

/** Pointer travel (px) above which a right-button gesture counts as a pan, not a click. */
export const PAN_CLICK_TOLERANCE_PX = 4;
