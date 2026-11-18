import { describe, expect, it, vi } from "vitest";
import type { ChainRunState } from "@/types/chain";
import type { ExecutionContext } from "../types";
import { mergeExecutor, shouldSkipMerge } from "./merge";

function buildContext(runState: ChainRunState = {}): ExecutionContext {
  return {
    nodeId: "merge-1",
    incomingEdges: [],
    runState,
    requestMap: new Map(),
    displayNodeMap: new Map(),
    delayNodeMap: new Map(),
    conditionNodeMap: new Map(),
    onUpdate: vi.fn(),
    options: { signal: new AbortController().signal },
  };
}

describe("shouldSkipMerge", () => {
  it("mode 'all' — every input passed → not skipped", () => {
    expect(
      shouldSkipMerge("all", [{ state: "passed" }, { state: "passed" }]),
    ).toBe(false);
  });

  it("mode 'all' — one input failed → skipped", () => {
    expect(
      shouldSkipMerge("all", [{ state: "passed" }, { state: "failed" }]),
    ).toBe(true);
  });

  it("mode 'all' — one input skipped → skipped (collapse case)", () => {
    expect(
      shouldSkipMerge("all", [{ state: "passed" }, { state: "skipped" }]),
    ).toBe(true);
  });

  it("mode 'all' — no inputs → skipped", () => {
    expect(shouldSkipMerge("all", [])).toBe(true);
  });

  it("mode 'any' — at least one passed → not skipped", () => {
    expect(
      shouldSkipMerge("any", [{ state: "skipped" }, { state: "passed" }]),
    ).toBe(false);
  });

  it("mode 'any' — none passed → skipped (collapse case)", () => {
    expect(
      shouldSkipMerge("any", [{ state: "skipped" }, { state: "failed" }]),
    ).toBe(true);
  });

  it("mode 'any' — no inputs → skipped", () => {
    expect(shouldSkipMerge("any", [])).toBe(true);
  });

  it("treats an unresolved (undefined) upstream state as not passed", () => {
    expect(shouldSkipMerge("any", [undefined])).toBe(true);
    expect(shouldSkipMerge("all", [undefined, { state: "passed" }])).toBe(
      true,
    );
  });
});

describe("mergeExecutor", () => {
  it("marks the node running then passed with no extracted values", async () => {
    const runState: ChainRunState = {};
    const context = buildContext(runState);

    const result = await mergeExecutor(context);

    expect(result).toBe(true);
    expect(runState["merge-1"]).toEqual({
      state: "passed",
      extractedValues: {},
    });
    expect(context.onUpdate).toHaveBeenNthCalledWith(1, "merge-1", "running", {});
    expect(context.onUpdate).toHaveBeenNthCalledWith(2, "merge-1", "passed", {
      extractedValues: {},
    });
  });
});
