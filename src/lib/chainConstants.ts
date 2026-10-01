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
