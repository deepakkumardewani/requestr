import { BLOCK_REGISTRY } from "@/components/chain/blockRegistry";
import type { ChainBlock } from "@/types/chain";

/** Why a chain cannot be run right now, in priority order (first match wins). */
export type RunBlockReason =
  | "empty"
  | "cycle"
  | "invalidMerge"
  | "unpairedLoop"
  | "unresolvedCollect"
  | "loopNesting"
  | "loopBodyUnconnected"
  | "loopBodyMissesCollect"
  | "invalidSubChain"
  | "displayMultipleInputs";

export type RunBlockers = {
  runnableNodeCount: number;
  hasCycle: boolean;
  hasInvalidMerge: boolean;
  hasUnpairedLoop: boolean;
  hasUnresolvedCollect: boolean;
  hasLoopNestingViolation: boolean;
  hasLoopBodyUnconnected: boolean;
  hasLoopBodyMissesCollect: boolean;
  hasInvalidSubChain: boolean;
  hasMultiInboundDisplay: boolean;
};

// Ordered so the most fundamental problem is reported first. New validation
// is added as another entry here.
const RUN_BLOCKERS: ReadonlyArray<{
  reason: RunBlockReason;
  isBlocked: (blockers: RunBlockers) => boolean;
}> = [
  { reason: "empty", isBlocked: (b) => b.runnableNodeCount === 0 },
  { reason: "cycle", isBlocked: (b) => b.hasCycle },
  { reason: "invalidMerge", isBlocked: (b) => b.hasInvalidMerge },
  { reason: "unpairedLoop", isBlocked: (b) => b.hasUnpairedLoop },
  { reason: "unresolvedCollect", isBlocked: (b) => b.hasUnresolvedCollect },
  { reason: "loopNesting", isBlocked: (b) => b.hasLoopNestingViolation },
  {
    reason: "loopBodyUnconnected",
    isBlocked: (b) => b.hasLoopBodyUnconnected,
  },
  {
    reason: "loopBodyMissesCollect",
    isBlocked: (b) => b.hasLoopBodyMissesCollect,
  },
  { reason: "invalidSubChain", isBlocked: (b) => b.hasInvalidSubChain },
  {
    reason: "displayMultipleInputs",
    isBlocked: (b) => b.hasMultiInboundDisplay,
  },
];

/** Single source of truth for the Run button and the Run shortcut; null means runnable. */
export function getRunBlockReason(
  blockers: RunBlockers,
): RunBlockReason | null {
  return RUN_BLOCKERS.find((b) => b.isBlocked(blockers))?.reason ?? null;
}

/**
 * Nodes that actually execute: request nodes (api and history) plus runnable
 * blocks. Start only declares inputs, so a Start-only chain counts as empty.
 */
export function countRunnableNodes(
  requestNodeCount: number,
  blocks: ReadonlyArray<Pick<ChainBlock, "type">>,
): number {
  const runnableBlocks = blocks.filter(
    (b) =>
      b.type !== "history" &&
      b.type !== "start" &&
      BLOCK_REGISTRY[b.type].canRun,
  );
  return requestNodeCount + runnableBlocks.length;
}
