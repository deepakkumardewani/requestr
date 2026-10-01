import type { ChainBlock } from "@/types/chain";

/** Narrows `blocks` to those matching `type`. */
export function blocksOfType<T extends ChainBlock>(
  blocks: readonly ChainBlock[],
  type: T["type"],
): T[] {
  return blocks.filter((b): b is T => b.type === type);
}

/** Type guard factory: `blocks.filter(isBlockOfType("loop"))` yields `LoopBlock[]`. */
export function isBlockOfType<K extends ChainBlock["type"]>(type: K) {
  return (block: ChainBlock): block is Extract<ChainBlock, { type: K }> =>
    block.type === type;
}
