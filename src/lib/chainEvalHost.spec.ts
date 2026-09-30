import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  emitMessage(data: unknown) {
    this.listeners.message.forEach((h) => h({ data }));
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
    expect(result).toEqual({ error: `Evaluation timed out (${EVAL_TIMEOUT_MS}ms)` });
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
});
