import { useMemo } from "react";
import {
  getUnpairedLoopNodeIds,
  getUnresolvedCollectNodeIds,
  hasLoopNestingViolation,
} from "@/components/chain/canvas/hooks/useChainConnect";
import {
  findLoopsWhoseBodyMissesCollect,
  findLoopsWithUnconnectedBody,
} from "@/lib/chainRunner/loopBody";
import { getInvalidSubChainNodeIds } from "@/lib/subChainGraph";
import { useChainStore } from "@/stores/useChainStore";
import type {
  Chain,
  CollectBlock,
  LoopBlock,
  SubChainBlock,
} from "@/types/chain";

export type ChainStructureValidation = {
  unpairedLoopIds: string[];
  unresolvedCollectIds: string[];
  hasLoopNesting: boolean;
  /** Loops whose body handle has no edge (the runner hard-fails these). */
  loopsWithUnconnectedBodyIds: string[];
  /** Loops whose body never reaches the paired Collect (the runner hard-fails these). */
  loopsWhoseBodyMissesCollectIds: string[];
  invalidSubChainIds: string[];
};

/**
 * Loop / Collect / Sub-chain validators for the open chain. Recomputed only
 * when the chain's blocks/edges or another chain's Sub-chain references change.
 */
export function useChainStructureValidation(
  chainId: string,
  chain: Chain | undefined,
): ChainStructureValidation {
  const chains = useChainStore((s) => s.chains);
  const blocks = chain?.blocks;
  const edges = chain?.edges;

  return useMemo(() => {
    const allBlocks = blocks ?? [];
    const subChainBlocks = allBlocks.filter(
      (b): b is SubChainBlock => b.type === "subchain",
    );
    const loopNodes = allBlocks.filter(
      (b): b is LoopBlock => b.type === "loop",
    );
    const collectNodes = allBlocks.filter(
      (b): b is CollectBlock => b.type === "collect",
    );
    return {
      unpairedLoopIds: getUnpairedLoopNodeIds(allBlocks),
      unresolvedCollectIds: getUnresolvedCollectNodeIds(allBlocks),
      hasLoopNesting: hasLoopNestingViolation(allBlocks, edges ?? []),
      loopsWithUnconnectedBodyIds: findLoopsWithUnconnectedBody(
        loopNodes,
        edges ?? [],
      ),
      loopsWhoseBodyMissesCollectIds: findLoopsWhoseBodyMissesCollect(
        loopNodes,
        collectNodes,
        edges ?? [],
      ),
      invalidSubChainIds: getInvalidSubChainNodeIds(
        chains,
        chainId,
        subChainBlocks,
      ),
    };
  }, [blocks, edges, chains, chainId]);
}
