import { countRunnableNodes } from "@/lib/chainRunBlock";
import type { Chain, ChainEdge, SubChainBlock } from "@/types/chain";

type ChainMap = Record<string, Chain>;

/**
 * True when `target` is `from` itself or is reachable from `from` by following
 * Sub-chain block references. Cycle-safe: each chain is visited once.
 */
export function reaches(
  chains: ChainMap,
  from: string,
  target: string,
): boolean {
  const visited = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const block of chains[current]?.blocks ?? []) {
      if (block.type === "subchain") stack.push(block.chainId);
    }
  }
  return false;
}

/** A child that exists but has no request and no runnable block cannot be run. */
function childHasNothingRunnable(child: Chain): boolean {
  return (
    countRunnableNodes(child.nodeIds?.length ?? 0, child.blocks ?? []) === 0
  );
}

/**
 * A Sub-chain reference hosted by `hostChainId` is invalid when it is unset,
 * points at a deleted chain, reaches back to the host, or names a child with
 * nothing runnable. The picker refuses the same missing and cyclic picks.
 */
export function isSubChainReferenceInvalid(
  chains: ChainMap,
  hostChainId: string,
  targetChainId: string,
): boolean {
  if (!targetChainId || !(targetChainId in chains)) return true;
  if (reaches(chains, targetChainId, hostChainId)) return true;
  return childHasNothingRunnable(chains[targetChainId]);
}

/** IDs of every Sub-chain block in the host chain whose reference is invalid. */
export function getInvalidSubChainNodeIds(
  chains: ChainMap,
  hostChainId: string,
  subChainBlocks: SubChainBlock[],
): string[] {
  return subChainBlocks
    .filter((b) => isSubChainReferenceInvalid(chains, hostChainId, b.chainId))
    .map((b) => b.id);
}

/**
 * Injection target keys (aliases) produced anywhere upstream of `nodeId`,
 * not just by its direct incoming edges — the runner resolves any alias set
 * earlier in the run. Cycle-safe; conditional-branch edges carry no aliases.
 */
export function getUpstreamAliases(
  edges: ChainEdge[],
  nodeId: string,
): string[] {
  const aliases = new Set<string>();
  const visited = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.targetRequestId !== current) continue;
      stack.push(edge.sourceRequestId);
      if (edge.branchId) continue;
      for (const inj of edge.injections ?? []) aliases.add(inj.targetKey);
    }
  }
  return [...aliases];
}
