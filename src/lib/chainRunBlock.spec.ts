import { describe, expect, it } from "vitest";
import { countRunnableNodes, getRunBlockReason } from "./chainRunBlock";

const OK = {
  runnableNodeCount: 2,
  hasCycle: false,
  hasInvalidMerge: false,
  hasUnpairedLoop: false,
  hasUnresolvedCollect: false,
  hasLoopNestingViolation: false,
  hasInvalidSubChain: false,
};

describe("getRunBlockReason", () => {
  it("returns null when the chain is runnable", () => {
    expect(getRunBlockReason(OK)).toBeNull();
  });

  it.each([
    [{ runnableNodeCount: 0 }, "empty"],
    [{ hasCycle: true }, "cycle"],
    [{ hasInvalidMerge: true }, "invalidMerge"],
    [{ hasUnpairedLoop: true }, "unpairedLoop"],
    [{ hasUnresolvedCollect: true }, "unresolvedCollect"],
    [{ hasLoopNestingViolation: true }, "loopNesting"],
    [{ hasInvalidSubChain: true }, "invalidSubChain"],
  ] as const)("reports %j as %s", (patch, reason) => {
    expect(getRunBlockReason({ ...OK, ...patch })).toBe(reason);
  });

  it("prioritises empty over cycle over invalid merge", () => {
    expect(
      getRunBlockReason({
        ...OK,
        runnableNodeCount: 0,
        hasCycle: true,
        hasInvalidMerge: true,
      })
    ).toBe("empty");
    expect(
      getRunBlockReason({ ...OK, hasCycle: true, hasInvalidMerge: true })
    ).toBe("cycle");
  });

  it("reports Loop/Collect/Sub-chain problems after merge, in order", () => {
    expect(
      getRunBlockReason({ ...OK, hasInvalidMerge: true, hasUnpairedLoop: true })
    ).toBe("invalidMerge");
    expect(
      getRunBlockReason({
        ...OK,
        hasLoopNestingViolation: true,
        hasInvalidSubChain: true,
      })
    ).toBe("loopNesting");
  });
});

describe("countRunnableNodes", () => {
  it("is zero for an empty chain", () => {
    expect(countRunnableNodes(0, [])).toBe(0);
  });

  it("ignores a Start-only chain", () => {
    expect(countRunnableNodes(0, [{ type: "start" }])).toBe(0);
  });

  it("counts a single Delay block as runnable", () => {
    expect(countRunnableNodes(0, [{ type: "delay" }])).toBe(1);
  });

  it("counts requests and skips Start and history blocks", () => {
    expect(
      countRunnableNodes(2, [
        { type: "start" },
        { type: "history" },
        { type: "merge" },
      ])
    ).toBe(3);
  });

  it("reports empty for Start-only and not-blocked for a lone Delay", () => {
    const base = { ...OK };
    expect(
      getRunBlockReason({
        ...base,
        runnableNodeCount: countRunnableNodes(0, [{ type: "start" }]),
      })
    ).toBe("empty");
    expect(
      getRunBlockReason({
        ...base,
        runnableNodeCount: countRunnableNodes(0, [{ type: "delay" }]),
      })
    ).toBeNull();
  });
});
