import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResponseData } from "@/types";
import type { ChainEdge, ChainRunState, EvaluateBlock } from "@/types/chain";
import type { RunOptions } from "../types";
import { registerEdgeAlias } from "@/lib/chainValueNamespace";
import { CHAIN_ERROR_CODE } from "../errorCodes";
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

  it("records a warning on the step, rather than silently overwriting, an outputAlias another producer already wrote", async () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "e9", "token", "from-edge");
    runInWorkerMock.mockResolvedValue({ output: "from-eval" });

    const context = buildContext({
      options: { signal: new AbortController().signal, aliasValues },
    });
    await evaluateExecutor(context);

    expect(aliasValues.token).toBe("from-eval");
    expect(context.onUpdate).toHaveBeenLastCalledWith(
      "eval-1",
      "passed",
      expect.objectContaining({
        warnings: [
          {
            kind: "alias-collision",
            alias: "token",
            previousOwner: { kind: "edge", id: "e9" },
            owner: { kind: "evaluate", id: "eval-1" },
          },
        ],
      }),
    );
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

  it("fails the node when the evaluation returns undefined", async () => {
    runInWorkerMock.mockResolvedValue({ output: undefined });

    const context = buildContext();
    await evaluateExecutor(context);

    const message = "Evaluate returned undefined - add a return statement";
    expect(runState(context).state).toBe("failed");
    expect(runState(context).error).toBe(message);
    expect(context.onUpdate).toHaveBeenCalledWith("eval-1", "failed", {
      error: message,
      errorCode: CHAIN_ERROR_CODE.EVALUATE_UNDEFINED_OUTPUT,
      errorKind: "generic",
    });
  });

  it("records the host's typed code for timeouts but keeps user-code errors verbatim", async () => {
    runInWorkerMock.mockResolvedValueOnce({
      error: "Evaluation timed out (5000ms)",
      errorCode: CHAIN_ERROR_CODE.EVALUATE_TIMEOUT,
      errorParams: { ms: 5000 },
    });
    const timedOut = buildContext();
    await evaluateExecutor(timedOut);
    expect(timedOut.onUpdate).toHaveBeenCalledWith(
      "eval-1",
      "failed",
      expect.objectContaining({
        errorCode: CHAIN_ERROR_CODE.EVALUATE_TIMEOUT,
        errorParams: { ms: 5000 },
      }),
    );

    runInWorkerMock.mockResolvedValueOnce({ error: "x is not defined" });
    const thrown = buildContext();
    await evaluateExecutor(thrown);
    const [, , data] = vi.mocked(thrown.onUpdate).mock.calls.at(-1) ?? [];
    expect(data?.error).toBe("x is not defined");
    expect(data?.errorCode).toBeUndefined();
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
