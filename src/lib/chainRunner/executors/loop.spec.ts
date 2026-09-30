import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
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

import { runRequest } from "@/lib/requestRunner";
import type { RunOptions } from "../types";
import {
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
