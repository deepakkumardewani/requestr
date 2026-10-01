import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainRunState,
  CollectBlock,
  LoopBlock,
} from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({
  runRequest: vi.fn(),
}));

vi.mock("@/lib/chainEvalHost", () => ({
  runInWorker: vi.fn(),
}));

import { MAX_LOOP_NESTING_DEPTH } from "@/lib/chainConstants";
import { LOOP_MAX_ITERATIONS_CAP } from "@/types/chain";
import { runRequest } from "@/lib/requestRunner";
import { runChain } from "../../chainRunner";
import type { RunOptions } from "../types";
import {
  planIterations,
  collectValueKey,
  isReservedAlias,
  loopExecutor,
  type LoopExecutorContext,
} from "./loop";

function rq(id: string, overrides?: Partial<RequestModel>): RequestModel {
  return {
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
    ...overrides,
  };
}

function buildLoopBlock(overrides: Partial<LoopBlock> = {}): LoopBlock {
  return {
    id: "loop-1",
    type: "loop",
    sourceJsonPath: "$.items",
    itemAlias: "item",
    maxIterations: 100,
    ...overrides,
  };
}

function buildCollectBlock(overrides: Partial<CollectBlock> = {}): CollectBlock {
  return { id: "collect-1", type: "collect", loopId: "loop-1", ...overrides };
}

function buildOptions(signal?: AbortSignal): RunOptions {
  return { signal: signal ?? new AbortController().signal, chainInputs: {} };
}

function buildContext(
  overrides: Partial<LoopExecutorContext> = {},
): LoopExecutorContext {
  const runState: ChainRunState = {
    upstream: {
      state: "passed",
      extractedValues: {},
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ items: ["a", "b", "c"] }),
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      },
    },
  };

  return {
    nodeId: "loop-1",
    loopBlock: buildLoopBlock(),
    collectBlock: buildCollectBlock(),
    body: { requests: [rq("body-1")], edges: [] },
    incomingEdges: [
      {
        id: "e-upstream",
        sourceRequestId: "upstream",
        targetRequestId: "loop-1",
        injections: [],
      },
    ],
    runState,
    onUpdate: vi.fn(),
    options: buildOptions(),
    runChain,
    ...overrides,
  };
}

describe("isReservedAlias", () => {
  it("rejects aliases in the reserved collect./sub. namespaces", () => {
    expect(isReservedAlias("collect.foo")).toBe(true);
    expect(isReservedAlias("sub.bar")).toBe(true);
  });

  it("allows ordinary aliases", () => {
    expect(isReservedAlias("item")).toBe(false);
    expect(isReservedAlias("collection")).toBe(false); // no trailing dot
  });
});

describe("loopExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs each iteration through the injected runChain", async () => {
    const injectedRunChain = vi.fn().mockResolvedValue(undefined);

    await loopExecutor(buildContext({ runChain: injectedRunChain }));

    expect(injectedRunChain).toHaveBeenCalledTimes(3);
    expect(injectedRunChain.mock.calls[0][0]).toMatchObject({
      schedulerDepth: 1,
      loopDepth: 1,
    });
  });

  it("runs one iteration per item, tagging each sub-step with parentStepId/iteration", async () => {
    vi.mocked(runRequest).mockImplementation(async () => {
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      };
    });

    const context = buildContext({
      body: {
        requests: [rq("body-1")],
        edges: [],
      },
    });

    const result = await loopExecutor(context);

    expect(result).toBe(true);
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(3);

    const onUpdate = context.onUpdate as ReturnType<typeof vi.fn>;
    const bodyUpdates = onUpdate.mock.calls.filter(
      (call) => call[0] === "body-1" && call[1] === "passed",
    );
    expect(bodyUpdates).toHaveLength(3);
    expect(bodyUpdates.map((call) => call[2].iteration)).toEqual([0, 1, 2]);
    expect(
      bodyUpdates.every((call) => call[2].parentStepId === "loop-1"),
    ).toBe(true);
    expect(context.runState["loop-1"]).toEqual({
      state: "passed",
      extractedValues: {},
    });
    expect(context.runState["collect-1"].state).toBe("passed");
    const collected = JSON.parse(
      context.runState["collect-1"].extractedValues[
        collectValueKey("collect-1")
      ] as string,
    );
    expect(collected).toHaveLength(3);
  });

  it("exposes {{item}} and {{index}} per iteration to the body request", async () => {
    const urls: string[] = [];
    vi.mocked(runRequest).mockImplementation(async (req) => {
      urls.push(req.url);
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: req.url,
        method: "GET",
        timestamp: 0,
      };
    });

    const context = buildContext({
      body: {
        requests: [rq("body-1", { url: "https://api.test/{{item}}/{{index}}" })],
        edges: [],
      },
      options: {
        ...buildOptions(),
        resolveVariables: (text: string) => text,
      },
    });

    await loopExecutor(context);

    expect(urls).toEqual([
      "https://api.test/a/0",
      "https://api.test/b/1",
      "https://api.test/c/2",
    ]);
  });

  it("caps execution at maxIterations", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const context = buildContext({
      loopBlock: buildLoopBlock({ maxIterations: 2 }),
      body: { requests: [rq("body-1")], edges: [] },
    });

    await loopExecutor(context);

    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2);
    const collected = JSON.parse(
      context.runState["collect-1"].extractedValues[
        collectValueKey("collect-1")
      ] as string,
    );
    expect(collected).toHaveLength(2);
  });

  it("aborts: Loop ends aborted, Collect ends skipped, no further iteration starts", async () => {
    const controller = new AbortController();
    let calls = 0;
    vi.mocked(runRequest).mockImplementation(async () => {
      calls += 1;
      if (calls === 1) controller.abort();
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      };
    });

    const context = buildContext({
      options: buildOptions(controller.signal),
      body: { requests: [rq("body-1")], edges: [] },
    });

    await loopExecutor(context);

    expect(context.runState["loop-1"].state).toBe("aborted");
    expect(context.runState["collect-1"].state).toBe("skipped");
    // Only the first iteration's request (which triggered the abort) ran.
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("fails the loop and skips collect when the upstream has no response", async () => {
    const context = buildContext({
      runState: {},
    });

    await loopExecutor(context);

    expect(context.runState["loop-1"].state).toBe("failed");
    expect(context.runState["collect-1"].state).toBe("skipped");
    expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
  });

  it("fails the loop when sourceJsonPath does not resolve to an array", async () => {
    const context = buildContext({
      loopBlock: buildLoopBlock({ sourceJsonPath: "$.notAnArray" }),
      runState: {
        upstream: {
          state: "passed",
          extractedValues: {},
          response: {
            status: 200,
            statusText: "OK",
            headers: {},
            body: JSON.stringify({ notAnArray: "oops" }),
            duration: 1,
            size: 2,
            url: "",
            method: "GET",
            timestamp: 0,
          },
        },
      },
    });

    await loopExecutor(context);

    expect(context.runState["loop-1"].state).toBe("failed");
    expect(context.runState["collect-1"].state).toBe("skipped");
  });
});

describe("loopExecutor edge cases", () => {
  const okResponse: ResponseData = {
    status: 200,
    statusText: "OK",
    headers: {},
    body: "{}",
    duration: 1,
    size: 2,
    url: "",
    method: "GET",
    timestamp: 0,
  };

  function upstreamWith(body: unknown): ChainRunState {
    return {
      upstream: {
        state: "passed",
        extractedValues: {},
        response: { ...okResponse, body: JSON.stringify(body) },
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runRequest).mockResolvedValue(okResponse);
  });

  it("an empty array passes with an empty collected array and runs no iteration", async () => {
    const context = buildContext({ runState: upstreamWith({ items: [] }) });
    await loopExecutor(context);

    expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
    expect(context.runState["loop-1"].state).toBe("passed");
    expect(
      context.runState["collect-1"].extractedValues[collectValueKey("collect-1")],
    ).toBe("[]");
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "maxIterations = %s fails the Loop with a typed error and skips Collect",
    async (maxIterations) => {
      const context = buildContext({
        loopBlock: buildLoopBlock({ maxIterations }),
      });
      await loopExecutor(context);

      expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
      expect(context.runState["loop-1"].state).toBe("failed");
      expect(context.onUpdate).toHaveBeenCalledWith(
        "loop-1",
        "failed",
        expect.objectContaining({ errorCode: "loopInvalidMaxIterations" }),
      );
      expect(context.runState["collect-1"].state).toBe("skipped");
    },
  );

  it("clamps maxIterations above the cap instead of failing", async () => {
    const items = Array.from({ length: LOOP_MAX_ITERATIONS_CAP + 5 }, (_, i) => i);
    const context = buildContext({
      loopBlock: buildLoopBlock({ maxIterations: LOOP_MAX_ITERATIONS_CAP + 50 }),
    });
    context.runState.upstream.response = {
      ...context.runState.upstream.response!,
      body: JSON.stringify({ items }),
    };
    await loopExecutor(context);

    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(LOOP_MAX_ITERATIONS_CAP);
    expect(context.runState["loop-1"].state).toBe("passed");
  });

  it.each(["index", "my-var", "collect.x", ""])(
    "itemAlias %j fails the Loop with loopInvalidAlias",
    async (itemAlias) => {
      const context = buildContext({ loopBlock: buildLoopBlock({ itemAlias }) });
      await loopExecutor(context);

      expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
      expect(context.onUpdate).toHaveBeenCalledWith(
        "loop-1",
        "failed",
        expect.objectContaining({ errorCode: "loopInvalidAlias" }),
      );
    },
  );

  it("a failing iteration is recorded in Collect and the Loop still runs the remaining items", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({ ...okResponse, status: 500, statusText: "Err" })
      .mockResolvedValue(okResponse);
    const context = buildContext();
    await loopExecutor(context);

    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(3);
    const collected = JSON.parse(
      context.runState["collect-1"].extractedValues[
        collectValueKey("collect-1")
      ] as string,
    );
    expect(collected[0]["body-1"].state).toBe("failed");
    expect(collected[1]["body-1"].state).toBe("passed");
  });

  describe("step warnings", () => {
    function loopPassedUpdate(context: LoopExecutorContext) {
      const call = vi
        .mocked(context.onUpdate)
        .mock.calls.find(([id, state]) => id === "loop-1" && state === "passed");
      return call?.[2];
    }

    it("warns loop-truncated only when the cap cut items, and the Loop still passes", async () => {
      vi.mocked(runRequest).mockResolvedValue(okResponse);
      const truncated = buildContext({
        loopBlock: buildLoopBlock({ maxIterations: 2 }),
      });
      await loopExecutor(truncated);
      expect(loopPassedUpdate(truncated)?.warnings).toEqual([
        { kind: "loop-truncated", executed: 2, total: 3 },
      ]);
      expect(truncated.runState["loop-1"].state).toBe("passed");

      const full = buildContext();
      await loopExecutor(full);
      expect(loopPassedUpdate(full)?.warnings).toBeUndefined();
    });

    it("warns loop-iterations-failed with counts while the Loop stays passed", async () => {
      vi.mocked(runRequest)
        .mockResolvedValueOnce({ ...okResponse, status: 500, statusText: "Err" })
        .mockResolvedValue(okResponse);
      const context = buildContext();
      await loopExecutor(context);
      expect(loopPassedUpdate(context)?.warnings).toEqual([
        { kind: "loop-iterations-failed", failed: 1, total: 3 },
      ]);
      expect(context.runState["loop-1"].state).toBe("passed");
    });

    it("raises no warnings when every iteration passes", async () => {
      vi.mocked(runRequest).mockResolvedValue(okResponse);
      const context = buildContext();
      await loopExecutor(context);
      expect(loopPassedUpdate(context)?.warnings).toBeUndefined();
    });
  });

  it("resolves {{item}}/{{index}} through the resolver seam, shadowing an env var of the same name", async () => {
    const envResolver = vi.fn((text: string) =>
      text.replace("{{item}}", "ENV").replace("{{host}}", "h.test"),
    );
    const context = buildContext({
      options: { ...buildOptions(), resolveVariables: envResolver },
      body: {
        requests: [
          rq("body-1", {
            url: "https://{{host}}/{{item}}/{{index}}",
            headers: [
              { id: "h-item", key: "X-Item", value: "{{item}}", enabled: true },
            ],
          }),
        ],
        edges: [],
      },
    });
    await loopExecutor(context);

    const sent = vi.mocked(runRequest).mock.calls.map(([r]) => r);
    expect(sent.map((r) => r.url)).toEqual([
      "https://h.test/a/0",
      "https://h.test/b/1",
      "https://h.test/c/2",
    ]);
    expect(sent[0].headers.find((h) => h.key === "X-Item")?.value).toBe("a");
  });

  it("does not mutate the body's request templates", async () => {
    const template = rq("body-1", { url: "https://api.test/{{item}}" });
    const context = buildContext({ body: { requests: [template], edges: [] } });
    await loopExecutor(context);

    expect(template.url).toBe("https://api.test/{{item}}");
  });

  it("planIterations reports truncated and total counts", () => {
    expect(planIterations([1, 2, 3, 4], buildLoopBlock({ maxIterations: 3 }))).toEqual({
      items: [1, 2, 3],
      total: 4,
      truncated: 1,
    });
  });

  it("fails with the depth-exceeded kind when nested at MAX_LOOP_NESTING_DEPTH", async () => {
    const context = buildContext({ loopDepth: MAX_LOOP_NESTING_DEPTH });
    await loopExecutor(context);

    expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
    expect(context.runState["loop-1"].state).toBe("failed");
    expect(context.runState["loop-1"].errorKind).toBeUndefined();
    expect(context.runState["collect-1"].state).toBe("skipped");
    expect(context.onUpdate).toHaveBeenCalledWith(
      "loop-1",
      "failed",
      expect.objectContaining({ errorCode: "loopDepthExceeded" }),
    );
  });

  it("propagates loopDepth + 1 into each iteration so nesting is counted", async () => {
    const injected = vi.fn().mockResolvedValue(undefined);
    await loopExecutor(buildContext({ runChain: injected, loopDepth: 1 }));
    expect(injected.mock.calls[0][0]).toMatchObject({ loopDepth: 2 });
  });

  it("items are substituted into request bodies as JSON for object items", async () => {
    const context = buildContext({
      runState: upstreamWith({ items: [{ id: 7 }] }),
      body: {
        requests: [rq("body-1", { body: { type: "json", content: '{"v":{{item}}}' } })],
        edges: [],
      },
    });
    await loopExecutor(context);

    expect(vi.mocked(runRequest).mock.calls[0][0].body?.content).toBe(
      `{"v":${JSON.stringify({ id: 7 })}}`,
    );
  });
});
