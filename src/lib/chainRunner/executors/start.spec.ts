import { describe, expect, it, vi } from "vitest";
import type { ChainRunState, StartBlock } from "@/types/chain";
import { startExecutor } from "./start";

function buildStartBlock(overrides: Partial<StartBlock> = {}): StartBlock {
  return {
    id: "start-1",
    type: "start",
    inputs: [
      { key: "token", defaultValue: "default-token", source: "literal" },
      { key: "userId", defaultValue: "1", source: "literal" },
    ],
    ...overrides,
  };
}

describe("startExecutor", () => {
  it("emits every input's default value into the extracted-values map", () => {
    const runState: ChainRunState = {};
    const onUpdate = vi.fn();

    const resolvedInputs = startExecutor({
      nodeId: "start-1",
      startBlock: buildStartBlock(),
      runState,
      onUpdate,
    });

    expect(resolvedInputs).toEqual({ token: "default-token", userId: "1" });
    expect(runState["start-1"]).toEqual({
      state: "passed",
      extractedValues: { token: "default-token", userId: "1" },
    });
  });

  it("lets an override win over the input's default", () => {
    const runState: ChainRunState = {};
    const onUpdate = vi.fn();

    const resolvedInputs = startExecutor({
      nodeId: "start-1",
      startBlock: buildStartBlock(),
      overrides: { token: "abc" },
      runState,
      onUpdate,
    });

    expect(resolvedInputs).toEqual({ token: "abc", userId: "1" });
    expect(runState["start-1"].extractedValues).toEqual({
      token: "abc",
      userId: "1",
    });
  });

  it("records nothing extra when the Start block has no inputs", () => {
    const runState: ChainRunState = {};
    const onUpdate = vi.fn();

    const resolvedInputs = startExecutor({
      nodeId: "start-1",
      startBlock: buildStartBlock({ inputs: [] }),
      runState,
      onUpdate,
    });

    expect(resolvedInputs).toEqual({});
    expect(runState["start-1"].extractedValues).toEqual({});
  });

  it("notifies running then passed", () => {
    const runState: ChainRunState = {};
    const onUpdate = vi.fn();

    startExecutor({
      nodeId: "start-1",
      startBlock: buildStartBlock(),
      runState,
      onUpdate,
    });

    expect(onUpdate).toHaveBeenNthCalledWith(1, "start-1", "running", {});
    expect(onUpdate).toHaveBeenNthCalledWith(2, "start-1", "passed", {
      extractedValues: { token: "default-token", userId: "1" },
    });
  });

  it("ignores override keys that don't match any declared input", () => {
    const runState: ChainRunState = {};
    const onUpdate = vi.fn();

    const resolvedInputs = startExecutor({
      nodeId: "start-1",
      startBlock: buildStartBlock(),
      overrides: { unknownKey: "value" },
      runState,
      onUpdate,
    });

    expect(resolvedInputs).toEqual({ token: "default-token", userId: "1" });
  });
});
