import { describe, expect, it, vi } from "vitest";
import type { ChainEdge, ChainRunState, MergeBlock } from "@/types/chain";
import { CHAIN_ERROR_CODE, chainError } from "./errorCodes";
import { createScheduler } from "./scheduler";

const edge = (source: string, target: string): ChainEdge => ({
  id: `${source}->${target}`,
  sourceRequestId: source,
  targetRequestId: target,
  injections: [],
});

const passed: ChainRunState[string] = { state: "passed", extractedValues: {} };

type Setup = {
  ids: string[];
  edges?: ChainEdge[];
  mergeNodes?: MergeBlock[];
};

function setup({ ids, edges = [], mergeNodes = [] }: Setup) {
  const runState: ChainRunState = {};
  const onUpdate = vi.fn();
  const scheduler = createScheduler({
    ids,
    edges,
    mergeNodes,
    runState,
    onUpdate,
  });
  return { scheduler, runState, onUpdate };
}

/** Drains the scheduler, recording each node as passed and advancing its dependants. */
async function drainAll(
  { scheduler, runState }: ReturnType<typeof setup>,
  concurrency = 1,
  signal: AbortSignal = new AbortController().signal,
): Promise<string[]> {
  const order: string[] = [];
  await scheduler.drain(
    async (id) => {
      order.push(id);
      runState[id] = passed;
      scheduler.advance(id);
    },
    { signal, concurrency },
  );
  return order;
}

describe("createScheduler dependency ordering", () => {
  it("dispatches nodes with no dependencies first and dependants only after", async () => {
    const env = setup({
      ids: ["a", "b", "c"],
      edges: [edge("a", "b"), edge("b", "c")],
    });

    expect(await drainAll(env)).toEqual(["a", "b", "c"]);
  });

  it("holds a fan-in node until every predecessor has advanced", async () => {
    const env = setup({
      ids: ["a", "b", "join"],
      edges: [edge("a", "join"), edge("b", "join")],
    });

    expect(await drainAll(env)).toEqual(["a", "b", "join"]);
  });

  it("never dispatches a node whose predecessor is never advanced", async () => {
    const env = setup({ ids: ["a", "b"], edges: [edge("a", "b")] });
    const ran: string[] = [];

    await env.scheduler.drain(
      async (id) => {
        ran.push(id);
        env.runState[id] = passed;
      },
      { signal: new AbortController().signal, concurrency: 2 },
    );

    expect(ran).toEqual(["a"]);
  });

  it("does not enqueue an already-recorded dependant on advance", async () => {
    const env = setup({ ids: ["a", "b"], edges: [edge("a", "b")] });
    env.runState.b = passed;

    expect(await drainAll(env)).toEqual(["a"]);
  });

  it("stops dispatching further nodes once the signal aborts mid-run", async () => {
    const env = setup({
      ids: ["a", "b", "c"],
      edges: [edge("a", "b"), edge("b", "c")],
    });
    const controller = new AbortController();
    const ran: string[] = [];

    await env.scheduler.drain(
      async (id) => {
        ran.push(id);
        env.runState[id] = passed;
        env.scheduler.advance(id);
        controller.abort();
      },
      { signal: controller.signal, concurrency: 1 },
    );

    expect(ran).toEqual(["a"]);
  });

  it("runs independent roots in parallel up to the concurrency limit", async () => {
    const env = setup({ ids: ["a", "b", "c"] });
    let active = 0;
    let peak = 0;

    await env.scheduler.drain(
      async (id) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        env.runState[id] = passed;
        active -= 1;
      },
      { signal: new AbortController().signal, concurrency: 2 },
    );

    expect(peak).toBe(2);
  });
});

describe("createScheduler skip propagation", () => {
  it("skips a node whose incoming edge source was skipped", () => {
    const { scheduler, runState } = setup({
      ids: ["a", "b"],
      edges: [edge("a", "b")],
    });
    runState.a = { state: "skipped", extractedValues: {} };

    expect(scheduler.shouldSkipNode("b", [edge("a", "b")])).toBe(true);
  });

  it("does not skip a node whose incoming sources passed", () => {
    const { scheduler, runState } = setup({
      ids: ["a", "b"],
      edges: [edge("a", "b")],
    });
    runState.a = passed;

    expect(scheduler.shouldSkipNode("b", [edge("a", "b")])).toBe(false);
  });

  it("does not skip a root node with no incoming edges", () => {
    const { scheduler } = setup({ ids: ["a"] });

    expect(scheduler.shouldSkipNode("a", [])).toBe(false);
  });

  it("records a skipped node with its error and notifies onUpdate", () => {
    const { scheduler, runState, onUpdate } = setup({ ids: ["a"] });
    const failure = chainError(CHAIN_ERROR_CODE.RUN_STOPPED);

    scheduler.markSkipped("a", failure);

    expect(onUpdate).toHaveBeenCalledWith("a", "skipped", failure);
    expect(runState.a).toEqual({
      state: "skipped",
      extractedValues: {},
      error: failure.error,
    });
  });
});

describe("createScheduler 'any' Merge", () => {
  const anyMerge: MergeBlock[] = [{ id: "m", type: "merge", mode: "any" }];
  const edges = [edge("fast", "m"), edge("slow", "m"), edge("m", "after")];

  it("fires the Merge as soon as one branch passes", async () => {
    const env = setup({
      ids: ["fast", "slow", "m", "after"],
      edges,
      mergeNodes: anyMerge,
    });
    env.runState.fast = passed;

    env.scheduler.fireMergesFedBy("fast");

    expect(env.runState.m?.state).toBe("passed");
    expect(env.onUpdate).toHaveBeenCalledWith("m", "running", {});
    expect(env.onUpdate).toHaveBeenCalledWith("m", "passed", {
      extractedValues: {},
    });
  });

  it("skips an unstarted lane that feeds only the fired Merge", () => {
    const env = setup({
      ids: ["fast", "slow", "m", "after"],
      edges,
      mergeNodes: anyMerge,
    });
    env.runState.fast = passed;

    env.scheduler.fireMergesFedBy("fast");

    expect(env.runState.slow?.state).toBe("skipped");
    expect(env.runState.slow?.error).toBe(
      chainError(CHAIN_ERROR_CODE.MERGE_ALREADY_RESOLVED).error,
    );
  });

  it("leaves a lane that also feeds another consumer running", () => {
    const env = setup({
      ids: ["fast", "slow", "m", "other"],
      edges: [...edges.slice(0, 2), edge("slow", "other")],
      mergeNodes: anyMerge,
    });
    env.runState.fast = passed;

    env.scheduler.fireMergesFedBy("fast");

    expect(env.runState.slow).toBeUndefined();
  });

  it("fires the Merge only once when a second branch also passes", () => {
    const env = setup({
      ids: ["fast", "slow", "m"],
      edges: edges.slice(0, 2),
      mergeNodes: anyMerge,
    });
    env.runState.fast = passed;
    env.scheduler.fireMergesFedBy("fast");
    env.onUpdate.mockClear();
    env.runState.slow = passed;

    env.scheduler.fireMergesFedBy("slow");

    expect(env.onUpdate).not.toHaveBeenCalled();
  });

  it("does not fire when the feeding node is not connected to the Merge", () => {
    const env = setup({
      ids: ["fast", "slow", "m", "x"],
      edges: edges.slice(0, 2),
      mergeNodes: anyMerge,
    });
    env.runState.x = passed;

    env.scheduler.fireMergesFedBy("x");

    expect(env.runState.m).toBeUndefined();
  });

  it("aborts an in-flight lane and records it skipped on settle", async () => {
    const env = setup({
      ids: ["fast", "slow", "m"],
      edges: edges.slice(0, 2),
      mergeNodes: anyMerge,
    });
    const scope = env.scheduler.openNodeScope(
      "slow",
      new AbortController().signal,
      env.onUpdate,
    );
    env.runState.fast = passed;
    let abortedAfterFire = false;

    await env.scheduler.drain(
      async (id) => {
        if (id !== "slow") return;
        // Yield so the scheduler registers this node as in flight before the Merge fires.
        await Promise.resolve();
        env.scheduler.fireMergesFedBy("fast");
        abortedAfterFire = scope.signal.aborted;
      },
      { signal: new AbortController().signal, concurrency: 2 },
    );

    expect(abortedAfterFire).toBe(true);
    expect(env.scheduler.settleNode("slow")).toBe(true);
    expect(env.runState.slow?.state).toBe("skipped");
  });

  it("settles an uncut lane without recording anything", () => {
    const env = setup({ ids: ["a"] });
    env.scheduler.openNodeScope("a", new AbortController().signal, vi.fn());

    expect(env.scheduler.settleNode("a")).toBe(false);
    expect(env.runState.a).toBeUndefined();
  });
});
