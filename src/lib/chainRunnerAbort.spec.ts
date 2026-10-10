import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import {
  type ChainEdge,
  type ChainNodeState,
  LOOP_BODY_HANDLE_ID,
} from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({ runRequest: vi.fn() }));
vi.mock("@/lib/chainEvalHost", () => ({ runInWorker: vi.fn() }));

import { runInWorker } from "@/lib/chainEvalHost";
import { runRequest } from "@/lib/requestRunner";
import { InvalidConcurrencyError, runChain } from "./chainRunner";
import { CHAIN_ERROR_CODE } from "./chainRunner/errorCodes";
import type { RunChainOptions } from "./chainRunner/types";

const request = (id: string): RequestModel =>
  ({
    id,
    collectionId: "c",
    name: id,
    method: "GET",
    url: `https://api.test/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "json", content: "{}" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  }) as RequestModel;

const edge: ChainEdge = {
  id: "e1",
  sourceRequestId: "a",
  targetRequestId: "b",
  injections: [
    { sourceJsonPath: "$.id", targetField: "header", targetKey: "x" },
  ],
};

describe("runChain abort handling", () => {
  it("sends nothing and promotes nothing when aborted before start", async () => {
    const controller = new AbortController();
    controller.abort();
    const onUpdate = vi.fn();
    const onPromoteToEnv = vi.fn();

    await runChain({
      requests: [request("a"), request("b")],
      edges: [edge],
      onUpdate,
      signal: controller.signal,
      envPromotions: [{ edgeId: "e1", envId: "env", envVarName: "V" }],
      onPromoteToEnv,
    });

    expect(runRequest).not.toHaveBeenCalled();
    expect(onPromoteToEnv).not.toHaveBeenCalled();
    for (const [, state, data] of onUpdate.mock.calls) {
      expect(["aborted", "skipped"]).toContain(state);
      expect(data).toMatchObject({ errorCode: CHAIN_ERROR_CODE.RUN_STOPPED });
    }
    expect(onUpdate.mock.calls.some(([id]) => id === "b")).toBe(true);
  });
});

const response = (body = "{}") => ({
  status: 200,
  statusText: "OK",
  headers: {},
  body,
  duration: 1,
  size: body.length,
  url: "",
  method: "GET" as const,
  timestamp: 0,
});

/** Request ids whose network call never completes on its own; it rejects only when the run is aborted. */
function hangRequests(hungIds: string[], started: string[] = []) {
  vi.mocked(runRequest).mockImplementation((req, signal) => {
    const id = req.url.split("/").pop() ?? "";
    started.push(id);
    if (!hungIds.includes(id)) return Promise.resolve(response());
    return new Promise((_, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  });
  return started;
}

type Harness = {
  states: Record<string, ChainNodeState>;
  codes: Record<string, string | undefined>;
  stop: AbortController;
  start: (options: Partial<RunChainOptions>) => Promise<void>;
};

/** Collects each node's last non-running state and error code; `start` kicks off a run on `stop.signal`. */
function harness(): Harness {
  const states: Harness["states"] = {};
  const codes: Harness["codes"] = {};
  const stop = new AbortController();
  const start: Harness["start"] = (options) =>
    runChain({
      requests: [],
      edges: [],
      onUpdate: (id, state, data) => {
        if (data.parentStepId !== undefined || state === "running") return;
        states[id] = state;
        codes[id] = data.errorCode;
      },
      signal: stop.signal,
      ...options,
    });
  return { states, codes, stop, start };
}

const startedCount = (started: string[], n: number) =>
  vi.waitFor(() => expect(started.length).toBeGreaterThanOrEqual(n));

describe("runChain abort mid-flight with parallel nodes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("records every in-flight request as aborted when Stop is pressed at concurrency 3", async () => {
    const started = hangRequests(["a", "b", "c"]);
    const { states, codes, stop, start } = harness();

    const running = start({
      requests: [request("a"), request("b"), request("c")],
      concurrency: 3,
    });
    await startedCount(started, 3);
    stop.abort();
    await running;

    expect(states).toEqual({ a: "aborted", b: "aborted", c: "aborted" });
    expect(codes.a).toBe(CHAIN_ERROR_CODE.RUN_STOPPED);
  });

  it("aborts the in-flight requests and skips the ones the concurrency limit never started", async () => {
    const started = hangRequests(["a", "b", "c", "d"]);
    const { states, codes, stop, start } = harness();

    const running = start({
      requests: [request("a"), request("b"), request("c"), request("d")],
      concurrency: 2,
    });
    await startedCount(started, 2);
    stop.abort();
    await running;

    expect(started).toEqual(["a", "b"]);
    expect(states).toEqual({
      a: "aborted",
      b: "aborted",
      c: "skipped",
      d: "skipped",
    });
    expect(codes.c).toBe(CHAIN_ERROR_CODE.RUN_STOPPED);
  });

  it("does not start downstream requests after a parallel sibling is aborted", async () => {
    const started = hangRequests(["slow"]);
    const { states, stop, start } = harness();

    const running = start({
      requests: [request("fast"), request("slow"), request("after")],
      edges: [
        { ...edge, id: "e1", sourceRequestId: "slow", targetRequestId: "after" },
      ],
      concurrency: 2,
    });
    await startedCount(started, 2);
    stop.abort();
    await running;

    expect(started).not.toContain("after");
    expect(states.after).toBe("skipped");
    expect(states.slow).toBe("aborted");
  });

  it("does not promote env values from a request aborted in flight", async () => {
    const started = hangRequests(["a", "b"]);
    const onPromoteToEnv = vi.fn();
    const { stop, start } = harness();

    const running = start({
      requests: [request("a"), request("b")],
      edges: [edge],
      envPromotions: [{ edgeId: "e1", envId: "env", envVarName: "V" }],
      onPromoteToEnv,
      concurrency: 2,
    });
    await startedCount(started, 1);
    stop.abort();
    await running;

    expect(onPromoteToEnv).not.toHaveBeenCalled();
  });

  it("aborts an in-flight Delay alongside an in-flight request", async () => {
    const started = hangRequests(["a"]);
    const { states, stop, start } = harness();

    const running = start({
      requests: [request("a")],
      delayNodes: [{ id: "wait", type: "delay", delayMs: 60_000 }],
      concurrency: 2,
    });
    await startedCount(started, 1);
    stop.abort();
    await running;

    expect(states).toMatchObject({ a: "aborted", wait: "aborted" });
  });

  it("skips Condition, Display, Validate and Merge nodes queued behind an aborted request", async () => {
    const started = hangRequests(["a"]);
    const { states, codes, stop, start } = harness();
    const link = (id: string, to: string): ChainEdge => ({
      ...edge,
      id,
      sourceRequestId: "a",
      targetRequestId: to,
    });

    const running = start({
      requests: [request("a")],
      edges: [
        link("e-cond", "cond"),
        link("e-disp", "disp"),
        link("e-val", "val"),
        link("e-merge", "merge"),
      ],
      conditionNodes: [
        {
          id: "cond",
          type: "condition",
          variable: "{{x}}",
          branches: [{ id: "else", label: "else", expression: "" }],
        },
      ],
      displayNodes: [
        {
          id: "disp",
          type: "display",
          sourceJsonPath: "$.id",
          targetField: "header",
          targetKey: "x",
        },
      ],
      validateNodes: [
        { id: "val", type: "validate", schema: "{}", sourceJsonPath: "$.id" },
      ],
      mergeNodes: [{ id: "merge", type: "merge", mode: "all" }],
      concurrency: 4,
    });
    await startedCount(started, 1);
    stop.abort();
    await running;

    for (const id of ["cond", "disp", "val", "merge"]) {
      expect(states[id]).toBe("skipped");
      expect(codes[id]).toBe(CHAIN_ERROR_CODE.RUN_STOPPED);
    }
    expect(states.a).toBe("aborted");
  });

  it("lets an in-flight Evaluate finish its worker call (characterization) and never starts its dependants after Stop", async () => {
    const started = hangRequests(["a"]);
    let finishWorker!: () => void;
    vi.mocked(runInWorker).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishWorker = () => resolve({ output: "1" });
        }),
    );
    const { states, stop, start } = harness();

    const running = start({
      requests: [request("a"), request("after")],
      edges: [{ ...edge, id: "e-ev", sourceRequestId: "ev", targetRequestId: "after" }],
      evaluateNodes: [
        { id: "ev", type: "evaluate", code: "return 1", outputAlias: "v" },
      ],
      concurrency: 2,
    });
    await vi.waitFor(() => expect(runInWorker).toHaveBeenCalled());
    await startedCount(started, 1);
    stop.abort();
    finishWorker();
    await running;

    expect(started).not.toContain("after");
    expect(states.after).toBe("skipped");
    expect(states.a).toBe("aborted");
    // Characterization: the evaluate executor ignores the abort signal, so an
    // in-flight Evaluate settles "passed" rather than "aborted" (reported as a finding).
    expect(states.ev).toBe("passed");
  });
});

describe("runChain abort inside nested Loop and Sub-chain runs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const loopBlock = {
    id: "loop",
    type: "loop" as const,
    sourceJsonPath: "$.items",
    itemAlias: "item",
    maxIterations: 100,
  };
  const loopEdge = (source: string, target: string, branchId?: string): ChainEdge => ({
    ...edge,
    id: `${source}->${target}`,
    sourceRequestId: source,
    targetRequestId: target,
    branchId,
  });

  it("aborts the Loop mid-iteration, skips its Collect and starts no further iteration", async () => {
    const started: string[] = [];
    vi.mocked(runRequest).mockImplementation((req, signal) => {
      const id = req.url.split("/").pop() ?? "";
      started.push(id);
      if (id === "upstream") {
        return Promise.resolve(response(JSON.stringify({ items: ["a", "b", "c"] })));
      }
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    const { states, stop, start } = harness();

    const running = start({
      requests: [request("upstream"), request("body")],
      edges: [
        loopEdge("upstream", "loop"),
        loopEdge("loop", "body", LOOP_BODY_HANDLE_ID),
      ],
      loopNodes: [loopBlock],
      collectNodes: [{ id: "collect", type: "collect", loopId: "loop" }],
      concurrency: 4,
    });
    await vi.waitFor(() => expect(started).toContain("body"));
    stop.abort();
    await running;

    expect(started.filter((id) => id === "body")).toHaveLength(1);
    expect(states.loop).toBe("aborted");
    expect(states.collect).toBe("skipped");
  });

  it("aborts a Sub-chain whose nested request is in flight, in parallel with a top-level request", async () => {
    const started = hangRequests(["outer", "inner"]);
    const { states, stop, start } = harness();

    const running = start({
      requests: [request("outer")],
      subChainBlocks: [
        { id: "sub", type: "subchain", chainId: "ref", inputBindings: {} },
      ],
      resolveSubChainGraph: () => ({ requests: [request("inner")], edges: [] }),
      concurrency: 2,
    });
    await startedCount(started, 2);
    stop.abort();
    await running;

    expect(states.outer).toBe("aborted");
    expect(states.sub).toBe("aborted");
  });
});

describe("runChain concurrency guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runRequest).mockResolvedValue(response());
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["fractional", 2.5],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("rejects %s concurrency without sending anything", async (_label, concurrency) => {
    const { start } = harness();

    await expect(
      start({ requests: [request("a")], concurrency }),
    ).rejects.toBeInstanceOf(InvalidConcurrencyError);

    expect(runRequest).not.toHaveBeenCalled();
  });

  it("runs the chain at the minimum valid concurrency of 1", async () => {
    const { states, start } = harness();

    await start({ requests: [request("a")], concurrency: 1 });

    expect(states.a).toBe("passed");
  });

  it("falls back to the default concurrency when none is given", async () => {
    const { states, start } = harness();

    await start({ requests: [request("a"), request("b")] });

    expect(states).toEqual({ a: "passed", b: "passed" });
  });
});
