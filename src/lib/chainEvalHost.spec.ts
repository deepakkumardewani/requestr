import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAIN_ERROR_CODE } from "./chainRunner/errorCodes";

// Minimal stand-in for the DOM/worker Worker API, driven manually per test.
class FakeWorker {
  static instances: FakeWorker[] = [];
  terminated = false;
  listeners: Record<string, Array<(e: unknown) => void>> = {
    message: [],
    error: [],
  };
  posted: unknown[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, handler: (e: unknown) => void) {
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (e: unknown) => void) {
    this.listeners[type] = this.listeners[type].filter((h) => h !== handler);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  terminate() {
    this.terminated = true;
  }

  // Emulates the real worker: echoes the id of the n-th posted request (default: latest).
  emitMessage(result: unknown, requestIndex = this.posted.length - 1) {
    const { id } = this.posted[requestIndex] as { id: number };
    this.listeners.message.forEach((h) => h({ data: { id, result } }));
  }
}

describe("chainEvalHost", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    FakeWorker.instances = [];
    // @ts-expect-error -- test stub, not a real Worker
    globalThis.Worker = FakeWorker;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves with the worker's result", async () => {
    const { runInWorker } = await import("@/lib/chainEvalHost");
    const promise = runInWorker({ code: "1", data: {}, inputs: {}, env: {} });
    const [instance] = FakeWorker.instances;
    instance.emitMessage({ output: 1 });
    await expect(promise).resolves.toEqual({ output: 1 });
  });

  it("reuses the same worker across calls", async () => {
    const { runInWorker } = await import("@/lib/chainEvalHost");
    const p1 = runInWorker({ code: "1", data: {}, inputs: {}, env: {} });
    FakeWorker.instances[0].emitMessage({ output: 1 });
    await p1;

    const p2 = runInWorker({ code: "2", data: {}, inputs: {}, env: {} });
    FakeWorker.instances[0].emitMessage({ output: 2 });
    await p2;

    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("terminates the worker and returns a timeout error when EVAL_TIMEOUT_MS elapses", async () => {
    const { runInWorker, EVAL_TIMEOUT_MS } = await import("@/lib/chainEvalHost");
    const promise = runInWorker({ code: "while(true){}", data: {}, inputs: {}, env: {} });

    await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS);

    const result = await promise;
    expect(result).toEqual(expect.objectContaining({
        errorCode: CHAIN_ERROR_CODE.EVALUATE_TIMEOUT,
        errorParams: { ms: EVAL_TIMEOUT_MS },
      }));
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });

  it("creates a fresh worker for the next call after a timeout", async () => {
    const { runInWorker, EVAL_TIMEOUT_MS } = await import("@/lib/chainEvalHost");
    const p1 = runInWorker({ code: "hang", data: {}, inputs: {}, env: {} });
    await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS);
    await p1;

    const p2 = runInWorker({ code: "1", data: {}, inputs: {}, env: {} });
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].emitMessage({ output: 1 });
    await expect(p2).resolves.toEqual({ output: 1 });
  });

  it("terminateChainEvalWorker terminates and drops the singleton", async () => {
    const { runInWorker, terminateChainEvalWorker } = await import(
      "@/lib/chainEvalHost"
    );
    const p1 = runInWorker({ code: "1", data: {}, inputs: {}, env: {} });
    FakeWorker.instances[0].emitMessage({ output: 1 });
    await p1;

    terminateChainEvalWorker();
    expect(FakeWorker.instances[0].terminated).toBe(true);

    const p2 = runInWorker({ code: "2", data: {}, inputs: {}, env: {} });
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].emitMessage({ output: 2 });
    await expect(p2).resolves.toEqual({ output: 2 });
  });

  it("resolves with an error when the worker emits an ErrorEvent", async () => {
    const { runInWorker } = await import("@/lib/chainEvalHost");
    const promise = runInWorker({ code: "1", data: {}, inputs: {}, env: {} });
    const [instance] = FakeWorker.instances;
    instance.listeners.error.forEach((h) => h({ message: "boom" }));
    await expect(promise).resolves.toEqual({ error: "boom" });
  });

  it("routes overlapping calls to their own results by id, even out of order", async () => {
    const { runInWorker } = await import("@/lib/chainEvalHost");
    const p1 = runInWorker({ code: "a", data: {}, inputs: {}, env: {} });
    const p2 = runInWorker({ code: "b", data: {}, inputs: {}, env: {} });
    const [instance] = FakeWorker.instances;

    instance.emitMessage({ output: "B" }, 1);
    instance.emitMessage({ output: "A" }, 0);

    await expect(p1).resolves.toEqual({ output: "A" });
    await expect(p2).resolves.toEqual({ output: "B" });
  });

  it("settles every pending call when one times out, then recreates the worker lazily", async () => {
    const { runInWorker, EVAL_TIMEOUT_MS } = await import("@/lib/chainEvalHost");
    const p1 = runInWorker({ code: "hang", data: {}, inputs: {}, env: {} });
    await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS - 1000);
    const p2 = runInWorker({ code: "b", data: {}, inputs: {}, env: {} });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(p1).resolves.toEqual({
      error: `Evaluation timed out (${EVAL_TIMEOUT_MS}ms)`,
      errorCode: CHAIN_ERROR_CODE.EVALUATE_TIMEOUT,
      errorParams: { ms: EVAL_TIMEOUT_MS },
    });
    await expect(p2).resolves.toEqual({
      error: "Evaluation cancelled: the evaluation worker was restarted",
      errorCode: CHAIN_ERROR_CODE.EVALUATE_TERMINATED,
    });
    expect(FakeWorker.instances).toHaveLength(1);

    const p3 = runInWorker({ code: "c", data: {}, inputs: {}, env: {} });
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].emitMessage({ output: "C" });
    await expect(p3).resolves.toEqual({ output: "C" });
    // Nothing left to fire: the late timer of p2 was cleared.
    await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS * 2);
  });

  it("ignores a response whose id is no longer pending", async () => {
    const { runInWorker, EVAL_TIMEOUT_MS } = await import("@/lib/chainEvalHost");
    const p1 = runInWorker({ code: "hang", data: {}, inputs: {}, env: {} });
    const [first] = FakeWorker.instances;
    await vi.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS);
    await p1;

    expect(() => first.emitMessage({ output: "late" }, 0)).not.toThrow();
  });

  it("keeps exactly one persistent message and error listener regardless of call count", async () => {
    const { runInWorker } = await import("@/lib/chainEvalHost");
    const calls = [1, 2, 3, 4].map((n) =>
      runInWorker({ code: String(n), data: {}, inputs: {}, env: {} }),
    );
    const [instance] = FakeWorker.instances;
    expect(instance.listeners.message).toHaveLength(1);
    expect(instance.listeners.error).toHaveLength(1);

    [0, 1, 2, 3].forEach((i) => instance.emitMessage({ output: i }, i));
    await Promise.all(calls);

    expect(instance.listeners.message).toHaveLength(1);
    expect(instance.listeners.error).toHaveLength(1);
  });

  it("settles all pending calls with the error message and recycles the worker on an ErrorEvent", async () => {
    const { runInWorker } = await import("@/lib/chainEvalHost");
    const p1 = runInWorker({ code: "a", data: {}, inputs: {}, env: {} });
    const p2 = runInWorker({ code: "b", data: {}, inputs: {}, env: {} });
    const [instance] = FakeWorker.instances;
    instance.listeners.error.forEach((h) => h({ message: "boom" }));

    await expect(p1).resolves.toEqual({ error: "boom" });
    await expect(p2).resolves.toEqual({ error: "boom" });
    expect(instance.terminated).toBe(true);
  });

  it("terminateChainEvalWorker settles in-flight calls instead of leaving them hanging", async () => {
    const { runInWorker, terminateChainEvalWorker } = await import(
      "@/lib/chainEvalHost"
    );
    const p1 = runInWorker({ code: "a", data: {}, inputs: {}, env: {} });
    terminateChainEvalWorker();
    await expect(p1).resolves.toEqual({
      error: "Evaluation cancelled: the evaluation worker was restarted",
      errorCode: CHAIN_ERROR_CODE.EVALUATE_TERMINATED,
    });
  });
});
