import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SUBCHAIN_DEPTH } from "@/lib/chainConstants";
import type { RequestModel, ResponseData } from "@/types";
import type { ChainEdge, ChainRunState, SubChainBlock } from "@/types/chain";
import type { OnUpdateFn } from "../types";
import type { RunOptions } from "../types";
import type { ReferencedChainGraph, SubchainExecutorContext } from "./subchain";

const runChainMock = vi.fn();

import { SUBCHAIN_DEPTH_EXCEEDED_KIND, subchainExecutor } from "./subchain";

function buildChain(overrides: Partial<ReferencedChainGraph> = {}): ReferencedChainGraph {
  return {
    requests: [],
    edges: [],
    ...overrides,
  };
}

function buildBlock(overrides: Partial<SubChainBlock> = {}): SubChainBlock {
  return {
    id: "sub-1",
    type: "subchain",
    chainId: "chain-2",
    inputBindings: {},
    ...overrides,
  };
}

function buildContext(
  overrides: Partial<SubchainExecutorContext> = {},
): SubchainExecutorContext {
  return {
    nodeId: "sub-1",
    subChainBlock: buildBlock(),
    chain: buildChain(),
    incomingEdges: [] as ChainEdge[],
    runState: {} as ChainRunState,
    onUpdate: vi.fn(),
    options: { signal: new AbortController().signal },
    runChain: runChainMock,
    ...overrides,
  };
}

describe("subchainExecutor input bindings", () => {
  beforeEach(() => {
    runChainMock.mockReset();
    runChainMock.mockResolvedValue(undefined);
  });

  it("resolves bindings via the shared namespace with chainInputs > aliasValues > env precedence", async () => {
    const options: RunOptions = {
      signal: new AbortController().signal,
      chainInputs: { fromInput: "input-value", shadowed: "input-wins" },
      aliasValues: {
        nonAdjacentAlias: "alias-value",
        shadowed: "alias-loses-to-input",
      },
      resolveVariables: (text: string) =>
        text.replace(/\{\{envVar\}\}/g, "env-value"),
    };

    const block = buildBlock({
      inputBindings: {
        a: "{{fromInput}}",
        b: "{{envVar}}",
        c: "{{nonAdjacentAlias}}",
        d: "{{shadowed}}",
      },
    });

    const context = buildContext({ subChainBlock: block, options });
    await subchainExecutor(context);

    expect(runChainMock).toHaveBeenCalledTimes(1);
    const startOverrides = runChainMock.mock.calls[0][0].startOverrides;
    expect(startOverrides).toEqual({
      a: "input-value",
      b: "env-value",
      c: "alias-value",
      d: "input-wins",
    });
  });
});

function buildResponse(body: string): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    body,
    duration: 0,
    size: body.length,
    url: "https://api.example.com",
    method: "GET",
    timestamp: 0,
  };
}

const requestOf = (id: string) => ({ id }) as RequestModel;

describe("subchainExecutor nested run outcomes", () => {
  beforeEach(() => {
    runChainMock.mockReset();
    runChainMock.mockResolvedValue(undefined);
  });

  it("fails with SUBCHAIN_DEPTH_EXCEEDED without running the nested chain at MAX_SUBCHAIN_DEPTH", async () => {
    const context = buildContext({ schedulerDepth: MAX_SUBCHAIN_DEPTH });
    await subchainExecutor(context);

    expect(runChainMock).not.toHaveBeenCalled();
    expect(context.runState["sub-1"].state).toBe("failed");
    expect(context.runState["sub-1"].errorKind).toBe(
      SUBCHAIN_DEPTH_EXCEEDED_KIND,
    );
    expect(context.onUpdate).toHaveBeenLastCalledWith(
      "sub-1",
      "failed",
      expect.objectContaining({
        errorCode: "subchainDepthExceeded",
        errorKind: SUBCHAIN_DEPTH_EXCEEDED_KIND,
      }),
    );
  });

  it("still runs at depth MAX_SUBCHAIN_DEPTH - 1 and nests one level deeper", async () => {
    await subchainExecutor(
      buildContext({ schedulerDepth: MAX_SUBCHAIN_DEPTH - 1 }),
    );
    expect(runChainMock.mock.calls[0][0].schedulerDepth).toBe(
      MAX_SUBCHAIN_DEPTH,
    );
  });

  it("forwards the parent loop depth to the nested run so loop limits hold across the boundary", async () => {
    await subchainExecutor(buildContext({ loopDepth: 2 }));
    expect(runChainMock.mock.calls[0][0].loopDepth).toBe(2);
  });

  it("defaults the nested loop depth to 0 when the parent is not inside a loop", async () => {
    await subchainExecutor(buildContext());
    expect(runChainMock.mock.calls[0][0].loopDepth).toBe(0);
  });

  it("marks the block aborted when the signal aborts during the nested run", async () => {
    const controller = new AbortController();
    runChainMock.mockImplementation(async () => controller.abort());
    const context = buildContext({
      options: { signal: controller.signal },
    });
    await subchainExecutor(context);

    expect(context.runState["sub-1"].state).toBe("aborted");
    expect(context.onUpdate).toHaveBeenLastCalledWith(
      "sub-1",
      "aborted",
      expect.objectContaining({ errorCode: "runStopped" }),
    );
  });

  it("propagates a failed terminal step's typed error and exposes its outputs", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("r1", "failed", {
        error: "HTTP 500",
        errorCode: "httpStatus",
        errorParams: { status: 500 },
        response: buildResponse("{}"),
      });
    });
    const context = buildContext({
      chain: buildChain({ requests: [requestOf("r1")] }),
    });
    await subchainExecutor(context);

    expect(context.runState["sub-1"].state).toBe("failed");
    expect(context.onUpdate).toHaveBeenLastCalledWith(
      "sub-1",
      "failed",
      expect.objectContaining({
        errorCode: "httpStatus",
        errorParams: { status: 500 },
      }),
    );
  });

  it("fails the block when an intermediate (non-terminal) step failed", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("first", "failed", {
        error: "boom",
        errorKind: "network",
      });
      onUpdate("last", "passed", { response: buildResponse("{}") });
    });
    const context = buildContext({
      chain: buildChain({
        requests: [requestOf("first"), requestOf("last")],
        edges: [
          { id: "e", sourceRequestId: "first", targetRequestId: "last", injections: [] },
        ],
      }),
    });
    await subchainExecutor(context);

    expect(context.runState["sub-1"].state).toBe("failed");
    expect(context.onUpdate).toHaveBeenLastCalledWith(
      "sub-1",
      "failed",
      expect.objectContaining({ error: "boom", errorKind: "network" }),
    );
  });

  it("exposes a non-request terminal block's response under sub.<id>", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("r1", "passed", { response: buildResponse("{}") });
      onUpdate("eval-1", "passed", { response: buildResponse('{"v":1}') });
    });
    const context = buildContext({
      chain: buildChain({
        requests: [requestOf("r1")],
        evaluateNodes: [{ id: "eval-1" } as never],
        edges: [
          { id: "e", sourceRequestId: "r1", targetRequestId: "eval-1", injections: [] },
        ],
      }),
    });
    await subchainExecutor(context);

    expect(context.runState["sub-1"].extractedValues).toEqual({
      "sub.sub-1.eval-1": '{"v":1}',
    });
  });

  it("falls back to SUBCHAIN_FAILED when the failed terminal step has no error", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("r1", "failed", {});
    });
    const context = buildContext({
      chain: buildChain({ requests: [requestOf("r1")] }),
    });
    await subchainExecutor(context);

    expect(context.onUpdate).toHaveBeenLastCalledWith(
      "sub-1",
      "failed",
      expect.objectContaining({ errorCode: "subchainFailed" }),
    );
  });

  it("exposes terminal outputs as sub.<id>.<alias> values and a synthetic JSON body", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("first", "passed", { response: buildResponse('{"x":0}') });
      onUpdate("last", "passed", { response: buildResponse('{"token":"t"}') });
    });
    const context = buildContext({
      chain: buildChain({
        requests: [requestOf("first"), requestOf("last")],
        edges: [
          {
            id: "e",
            sourceRequestId: "first",
            targetRequestId: "last",
            injections: [],
          },
        ],
      }),
    });
    await subchainExecutor(context);

    const step = context.runState["sub-1"];
    expect(step.state).toBe("passed");
    expect(step.extractedValues).toEqual({ "sub.sub-1.last": '{"token":"t"}' });
    expect(JSON.parse(step.response?.body ?? "")).toEqual({
      last: { token: "t" },
    });
  });

  it("keeps a non-JSON terminal body as a raw string in the synthetic body", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("r1", "passed", { response: buildResponse("plain text") });
    });
    const context = buildContext({
      chain: buildChain({ requests: [requestOf("r1")] }),
    });
    await subchainExecutor(context);

    const step = context.runState["sub-1"];
    expect(step.state).toBe("passed");
    expect(step.extractedValues["sub.sub-1.r1"]).toBe("plain text");
    expect(JSON.parse(step.response?.body ?? "")).toEqual({ r1: "plain text" });
  });

  it("re-tags nested step updates with the Sub-chain block as parentStepId", async () => {
    runChainMock.mockImplementation(async ({ onUpdate }: { onUpdate: OnUpdateFn }) => {
      onUpdate("r1", "running", {});
    });
    const context = buildContext({
      chain: buildChain({ requests: [requestOf("r1")] }),
    });
    await subchainExecutor(context);

    expect(context.onUpdate).toHaveBeenCalledWith(
      "r1",
      "running",
      expect.objectContaining({ parentStepId: "sub-1" }),
    );
  });
});
