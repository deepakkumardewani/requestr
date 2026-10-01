import type { ChainBlock } from "@/types/chain";

/**
 * Clones a clipboard block under `newId`. A Collect is rebound to the pasted
 * Loop when that Loop is part of the same paste; when only the Collect was
 * copied, its `loopId` keeps pointing at the original Loop.
 */
export function remapPastedBlock(
  block: ChainBlock,
  newId: string,
  idMap: ReadonlyMap<string, string>,
): ChainBlock {
  if (block.type === "collect") {
    return {
      ...block,
      id: newId,
      loopId: idMap.get(block.loopId) ?? block.loopId,
    };
  }
  return { ...block, id: newId };
}
