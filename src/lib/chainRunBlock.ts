/** Why a chain cannot be run right now, in priority order (first match wins). */
export type RunBlockReason =
  | "empty"
  | "cycle"
  | "invalidMerge"
  | "unpairedLoop"
  | "unresolvedCollect"
  | "loopNesting"
  | "invalidSubChain";

export type RunBlockers = {
  requestCount: number;
  hasCycle: boolean;
  hasInvalidMerge: boolean;
  hasUnpairedLoop: boolean;
  hasUnresolvedCollect: boolean;
  hasLoopNestingViolation: boolean;
  hasInvalidSubChain: boolean;
};

// Ordered so the most fundamental problem is reported first. New validation
// is added as another entry here.
const RUN_BLOCKERS: ReadonlyArray<{
  reason: RunBlockReason;
  isBlocked: (blockers: RunBlockers) => boolean;
}> = [
  { reason: "empty", isBlocked: (b) => b.requestCount === 0 },
  { reason: "cycle", isBlocked: (b) => b.hasCycle },
  { reason: "invalidMerge", isBlocked: (b) => b.hasInvalidMerge },
  { reason: "unpairedLoop", isBlocked: (b) => b.hasUnpairedLoop },
  { reason: "unresolvedCollect", isBlocked: (b) => b.hasUnresolvedCollect },
  { reason: "loopNesting", isBlocked: (b) => b.hasLoopNestingViolation },
  { reason: "invalidSubChain", isBlocked: (b) => b.hasInvalidSubChain },
];

/** Single source of truth for the Run button and the Run shortcut; null means runnable. */
export function getRunBlockReason(
  blockers: RunBlockers,
): RunBlockReason | null {
  return RUN_BLOCKERS.find((b) => b.isBlocked(blockers))?.reason ?? null;
}
