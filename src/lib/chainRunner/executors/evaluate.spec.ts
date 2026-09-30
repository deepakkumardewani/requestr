import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResponseData } from "@/types";
import type { ChainEdge, ChainRunState, EvaluateBlock } from "@/types/chain";
import type { RunOptions } from "../types";
import { evaluateExecutor } from "./evaluate";

const runInWorkerMock = vi.fn();

vi.mock("@/lib/chainEvalHost", () => ({
  runInWorker: (...args: unknown[]) => runInWorkerMock(...args),
}));

function buildResponse(body: unknown): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    body: JSON.stringify(body),
    duration: 0,
    size: 0,
    url: "https://api.example.com",
    method: "GET",
    timestamp: Date.now(),
  };
}

function buildBlock(overrides: Partial<EvaluateBlock> = {}): EvaluateBlock {
  return {
    id: "eval-1",
    type: "evaluate",
    code: "return data.response.token",
    outputAlias: "token",
    ...overrides,
  };
}

function buildContext({
  edges = [],
  runState = {},
  options = { signal: new AbortController().signal },
}: {
  edges?: ChainEdge[];
  runState?: ChainRunState;
  options?: RunOptions;
} = {}) {
  return {
    nodeId: "eval-1",
    incomingEdges: edges,
    runState,
    requestMap: new Map(),
    displayNodeMap: new Map(),
    delayNodeMap: new Map(),
    conditionNodeMap: new Map(),
    evaluateNodeMap: new Map([["eval-1", buildBlock()]]),
    onUpdate: vi.fn(),
    options,
  };
}

describe("evaluateExecutor", () => {
  beforeEach(() => {
    runInWorkerMock.mockReset();
  });

  it("returns false when the node isn't in evaluateNodeMap", async () => {
    const context = buildContext();
    context.evaluateNodeMap = new Map();
    const result = await evaluateExecutor(context);
    expect(result).toBe(false);
    expect(runInWorkerMock).not.toHaveBeenCalled();
  });

  it("builds data from the direct upstream response and publishes the result under a synthetic response", async () => {
    const runState: ChainRunState = {
      "api-1": {
        state: "passed",
        extractedValues: {},
        response: buildResponse({ token: "abc123" }),
      },
    };
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "api-1",
        targetRequestId: "eval-1",
        injections: [
          {
            sourceJsonPath: "$.token",
            targetField: "header",
            targetKey: "token",
          },
        ],
      },
    ];
    runInWorkerMock.mockResolvedValue({ output: "abc123" });

    const context = buildContext({ edges, runState });
    const result = await evaluateExecutor(context);

    expect(result).toBe(true);
    expect(runInWorkerMock).toHaveBeenCalledWith({
      code: "return data.response.token",
      data: { token: "abc123", response: { token: "abc123" } },
      inputs: {},
      env: {},
    });
    expect(context.onUpdate).toHaveBeenCalledWith("eval-1", "running", {});
    expect(runState["eval-1"].state).toBe("passed");
    expect(runState["eval-1"].response?.body).toBe(JSON.stringify("abc123"));
  });

  it("fails the node with the evaluation error message", async () => {
    runInWorkerMock.mockResolvedValue({ error: "ReferenceError: x is not defined" });

    const context = buildContext();
    const result = await evaluateExecutor(context);

    expect(result).toBe(true);
    expect(runState(context).state).toBe("failed");
    expect(runState(context).error).toBe("ReferenceError: x is not defined");
    expect(context.onUpdate).toHaveBeenCalledWith("eval-1", "failed", {
      error: "ReferenceError: x is not defined",
      errorKind: "generic",
    });
  });

  it("passes chainInputs and envVars through to the worker", async () => {
    runInWorkerMock.mockResolvedValue({ output: 1 });

    const context = buildContext({
      options: {
        signal: new AbortController().signal,
        chainInputs: { userId: "42" },
        envVars: { API_KEY: "secret" },
      },
    });
    await evaluateExecutor(context);

    expect(runInWorkerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: { userId: "42" },
        env: { API_KEY: "secret" },
      }),
    );
  });

  function runState(context: ReturnType<typeof buildContext>) {
    return context.runState[context.nodeId];
  }
});
