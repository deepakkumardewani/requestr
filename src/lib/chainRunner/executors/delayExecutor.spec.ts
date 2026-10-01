import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainRunState, DelayNodeConfig } from "@/types/chain";
import { CHAIN_ERROR_CODE } from "../errorCodes";
import type { ExecutionContext } from "../types";
import { delayExecutor } from "./delayExecutor";

const DELAY_MS = 500;
const delayNode = { id: "d1", delayMs: DELAY_MS } as DelayNodeConfig;

function setup(controller = new AbortController()) {
  const runState: ChainRunState = {};
  const onUpdate = vi.fn();
  const context = {
    nodeId: "d1",
    runState,
    delayNodeMap: new Map([["d1", delayNode]]),
    onUpdate,
    options: { signal: controller.signal },
  } as unknown as ExecutionContext;
  return { context, runState, onUpdate, controller };
}

describe("delayExecutor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns false when the node is not a delay node", async () => {
    const { context, onUpdate } = setup();
    const result = await delayExecutor({
      ...context,
      delayNodeMap: new Map(),
    });
    expect(result).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("marks the node running, then passed with its delay input", async () => {
    const { context, runState, onUpdate } = setup();
    const promise = delayExecutor(context);
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(await promise).toBe(true);
    expect(onUpdate).toHaveBeenNthCalledWith(1, "d1", "running", {});
    expect(onUpdate).toHaveBeenLastCalledWith("d1", "passed", {
      inputs: { delayMs: DELAY_MS },
    });
    expect(runState.d1).toEqual({ state: "passed", extractedValues: {} });
  });

  it("ends aborted with RUN_STOPPED when stopped mid-delay", async () => {
    const { context, runState, onUpdate, controller } = setup();
    const promise = delayExecutor(context);
    controller.abort();

    expect(await promise).toBe(true);
    expect(runState.d1.state).toBe("aborted");
    expect(onUpdate).toHaveBeenLastCalledWith(
      "d1",
      "aborted",
      expect.objectContaining({ errorCode: CHAIN_ERROR_CODE.RUN_STOPPED }),
    );
  });

  it("ends aborted when the signal was already aborted before the delay started", async () => {
    const controller = new AbortController();
    controller.abort();
    const { context, runState } = setup(controller);

    await delayExecutor(context);

    expect(runState.d1.state).toBe("aborted");
  });
});
