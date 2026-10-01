import { describe, expect, it } from "vitest";
import type { ChainBlock, LoopBlock } from "@/types/chain";
import { blocksOfType, isBlockOfType } from "./chainBlocks";

const loop: LoopBlock = {
  id: "l1",
  type: "loop",
  sourceJsonPath: "$.items",
  itemAlias: "item",
  maxIterations: 10,
};
const blocks: ChainBlock[] = [
  { id: "d1", type: "delay", delayMs: 100 },
  loop,
  { id: "c1", type: "collect", loopId: "l1" },
];

describe("chainBlocks", () => {
  it("blocksOfType narrows by type", () => {
    expect(blocksOfType<LoopBlock>(blocks, "loop")).toEqual([loop]);
    expect(blocksOfType(blocks, "merge")).toEqual([]);
  });

  it("isBlockOfType works as a filter predicate", () => {
    expect(blocks.filter(isBlockOfType("collect")).map((b) => b.loopId)).toEqual([
      "l1",
    ]);
  });
});
