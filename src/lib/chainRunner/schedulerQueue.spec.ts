import { describe, expect, it, vi } from "vitest";
import type { ChainRunState } from "@/types/chain";
import { dispatchReady, drainQueue, type QueueState } from "./schedulerQueue";

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function buildState(
  ready: string[],
  runState: ChainRunState = {},
): QueueState {
  return { readyQueue: [...ready], inFlight: new Map(), runState };
}

const recorded: ChainRunState[string] = {
  state: "passed",
  extractedValues: {},
};

describe("dispatchReady", () => {
  it("starts no more nodes than the concurrency limit allows", () => {
    const state = buildState(["a", "b", "c"]);
    const processNode = vi.fn((_id: string) => new Promise<void>(() => {}));

    dispatchReady(state, processNode, 2);

    expect(processNode.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
    expect([...state.inFlight.keys()]).toEqual(["a", "b"]);
    expect(state.readyQueue).toEqual(["c"]);
  });

  it("drops queued nodes that already have a recorded state without running them", () => {
    const state = buildState(["a", "b", "c"], { b: recorded });
    const processNode = vi.fn((_id: string) => new Promise<void>(() => {}));

    dispatchReady(state, processNode, 5);

    expect(processNode.mock.calls.map(([id]) => id)).toEqual(["a", "c"]);
    expect(state.readyQueue).toEqual([]);
  });

  it("does not count a skipped recorded node against the concurrency limit", () => {
    const state = buildState(["a", "b", "c"], { a: recorded });
    const processNode = vi.fn((_id: string) => new Promise<void>(() => {}));

    dispatchReady(state, processNode, 1);

    expect(processNode.mock.calls.map(([id]) => id)).toEqual(["b"]);
  });

  it("dispatches nothing when the limit is already saturated", () => {
    const state = buildState(["b"]);
    state.inFlight.set("a", new Promise<void>(() => {}));
    const processNode = vi.fn(async () => {});

    dispatchReady(state, processNode, 1);

    expect(processNode).not.toHaveBeenCalled();
    expect(state.readyQueue).toEqual(["b"]);
  });

  it("dispatches in FIFO order", () => {
    const state = buildState(["x", "y", "z"]);
    const processNode = vi.fn((_id: string) => new Promise<void>(() => {}));

    dispatchReady(state, processNode, 3);

    expect(processNode.mock.calls.map(([id]) => id)).toEqual(["x", "y", "z"]);
  });

  it("removes a node from in-flight once its processing settles", async () => {
    const state = buildState(["a"]);
    const gate = deferred();

    dispatchReady(state, () => gate.promise, 1);
    expect(state.inFlight.has("a")).toBe(true);
    gate.resolve();
    await gate.promise;
    await Promise.resolve();

    expect(state.inFlight.size).toBe(0);
  });

  it("dispatches nothing when concurrency is zero", () => {
    const state = buildState(["a"]);
    const processNode = vi.fn(async () => {});

    dispatchReady(state, processNode, 0);

    expect(processNode).not.toHaveBeenCalled();
    expect(state.readyQueue).toEqual(["a"]);
  });
});

describe("drainQueue", () => {
  it("runs every queued node to completion", async () => {
    const state = buildState(["a", "b", "c"]);
    const ran: string[] = [];

    await drainQueue(
      state,
      async (id) => {
        ran.push(id);
      },
      { signal: new AbortController().signal, concurrency: 2 },
    );

    expect(ran).toEqual(["a", "b", "c"]);
    expect(state.inFlight.size).toBe(0);
  });

  it("never exceeds the concurrency limit while draining", async () => {
    const state = buildState(["a", "b", "c", "d", "e"]);
    let active = 0;
    let peak = 0;

    await drainQueue(
      state,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        await Promise.resolve();
        active -= 1;
      },
      { signal: new AbortController().signal, concurrency: 2 },
    );

    expect(peak).toBe(2);
  });

  it("runs strictly one node at a time at concurrency 1", async () => {
    const state = buildState(["a", "b", "c"]);
    let active = 0;
    let peak = 0;

    await drainQueue(
      state,
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
      },
      { signal: new AbortController().signal, concurrency: 1 },
    );

    expect(peak).toBe(1);
  });

  it("starts nothing when the signal is already aborted", async () => {
    const state = buildState(["a", "b"]);
    const processNode = vi.fn(async () => {});
    const controller = new AbortController();
    controller.abort();

    await drainQueue(state, processNode, {
      signal: controller.signal,
      concurrency: 4,
    });

    expect(processNode).not.toHaveBeenCalled();
    expect(state.readyQueue).toEqual(["a", "b"]);
  });

  it("stops dispatching after abort but waits for the node already in flight", async () => {
    const state = buildState(["a", "b", "c"]);
    const controller = new AbortController();
    const gate = deferred();
    const started: string[] = [];

    const draining = drainQueue(
      state,
      (id) => {
        started.push(id);
        return gate.promise;
      },
      { signal: controller.signal, concurrency: 1 },
    );
    controller.abort();
    gate.resolve();
    await draining;

    expect(started).toEqual(["a"]);
    expect(state.readyQueue).toEqual(["b", "c"]);
    expect(state.inFlight.size).toBe(0);
  });

  it("picks up nodes enqueued by a running node", async () => {
    const state = buildState(["a"]);
    const ran: string[] = [];

    await drainQueue(
      state,
      async (id) => {
        ran.push(id);
        if (id === "a") state.readyQueue.push("b");
      },
      { signal: new AbortController().signal, concurrency: 1 },
    );

    expect(ran).toEqual(["a", "b"]);
  });

  it("resolves immediately for an empty queue", async () => {
    const state = buildState([]);

    await expect(
      drainQueue(state, vi.fn(), {
        signal: new AbortController().signal,
        concurrency: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
