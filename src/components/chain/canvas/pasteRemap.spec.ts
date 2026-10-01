import { describe, expect, it } from "vitest";
import type { ChainBlock } from "@/types/chain";
import { remapPastedBlock } from "./pasteRemap";

const loop: ChainBlock = {
  id: "loop-1",
  type: "loop",
  sourceJsonPath: "$.items",
  itemAlias: "item",
  maxIterations: 10,
};
const collect: ChainBlock = { id: "collect-1", type: "collect", loopId: "loop-1" };

describe("remapPastedBlock", () => {
  it("rebinds a pasted Collect to the pasted Loop", () => {
    const idMap = new Map([
      ["loop-1", "loop-2"],
      ["collect-1", "collect-2"],
    ]);
    expect(remapPastedBlock(collect, "collect-2", idMap)).toEqual({
      id: "collect-2",
      type: "collect",
      loopId: "loop-2",
    });
    expect(remapPastedBlock(loop, "loop-2", idMap).id).toBe("loop-2");
  });

  it("keeps the original loopId when only the Collect was copied", () => {
    const idMap = new Map([["collect-1", "collect-2"]]);
    expect(remapPastedBlock(collect, "collect-2", idMap)).toMatchObject({
      id: "collect-2",
      loopId: "loop-1",
    });
  });
});
