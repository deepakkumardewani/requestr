import { describe, expect, it } from "vitest";
import { getRunBlockReason } from "./chainRunBlock";

const OK = {
  requestCount: 2,
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
    [{ requestCount: 0 }, "empty"],
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
      getRunBlockReason({ ...OK, requestCount: 0, hasCycle: true, hasInvalidMerge: true }),
    ).toBe("empty");
    expect(
      getRunBlockReason({ ...OK, hasCycle: true, hasInvalidMerge: true }),
    ).toBe("cycle");
  });

  it("reports Loop/Collect/Sub-chain problems after merge, in order", () => {
    expect(
      getRunBlockReason({ ...OK, hasInvalidMerge: true, hasUnpairedLoop: true }),
    ).toBe("invalidMerge");
    expect(
      getRunBlockReason({
        ...OK,
        hasLoopNestingViolation: true,
        hasInvalidSubChain: true,
      }),
    ).toBe("loopNesting");
  });
});
