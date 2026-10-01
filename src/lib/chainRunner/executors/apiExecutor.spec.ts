import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerAlias, registerEdgeAlias } from "@/lib/chainValueNamespace";
import type { RequestModel, ResponseData } from "@/types";
import type { ChainEdge, ChainRunState } from "@/types/chain";
import type { ExecutionContext } from "../types";
import { apiExecutor } from "./apiExecutor";

const runRequestMock = vi.fn();
vi.mock("@/lib/requestRunner", () => ({
  runRequest: (...args: unknown[]) => runRequestMock(...args),
}));

function response(body: unknown, status = 200): ResponseData {
  return {
    status,
    statusText: "OK",
    headers: {},
    body: JSON.stringify(body),
    duration: 0,
    size: 0,
    url: "",
    method: "GET",
    timestamp: 0,
  };
}

const request = {
  id: "api2",
  name: "Second",
  method: "GET",
  url: "https://api.test/x",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
} as unknown as RequestModel;

function run(aliasValues: Record<string, string>) {
  const edge: ChainEdge = {
    id: "e2",
    sourceRequestId: "api1",
    targetRequestId: "api2",
    injections: [
      { sourceJsonPath: "$.id", targetField: "header", targetKey: "id" },
    ],
  };
  const runState: ChainRunState = {
    api1: { state: "passed", extractedValues: {}, response: response({ id: 7 }) },
  };
  const onUpdate = vi.fn();
  const context = {
    nodeId: "api2",
    request,
    incomingEdges: [edge],
    runState,
    displayNodeMap: new Map(),
    onUpdate,
    options: { signal: new AbortController().signal, aliasValues },
  } as unknown as ExecutionContext;
  return { promise: apiExecutor(context), onUpdate };
}

describe("apiExecutor alias collisions", () => {
  beforeEach(() => runRequestMock.mockReset());

  it("records a warning on the step when its injection alias was written by another edge", async () => {
    runRequestMock.mockResolvedValue(response({}));
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "e1", "id", "old");

    const { promise, onUpdate } = run(aliasValues);
    await promise;

    expect(onUpdate).toHaveBeenLastCalledWith(
      "api2",
      "passed",
      expect.objectContaining({
        warnings: [
          {
            kind: "alias-collision",
            alias: "id",
            previousOwner: { kind: "edge", id: "e1" },
            owner: { kind: "edge", id: "e2" },
          },
        ],
      }),
    );
  });

  it("does not flag the alias its Display source already published", async () => {
    runRequestMock.mockResolvedValue(response({}));
    const aliasValues: Record<string, string> = {};
    registerAlias(aliasValues, "id", "7", {
      owner: { kind: "display", id: "disp1" },
    });
    const edge: ChainEdge = {
      id: "e3",
      sourceRequestId: "disp1",
      targetRequestId: "api2",
      injections: [],
    };
    const onUpdate = vi.fn();
    const context = {
      nodeId: "api2",
      request,
      incomingEdges: [edge],
      runState: { disp1: { state: "passed", extractedValues: { disp1: "7" } } },
      displayNodeMap: new Map([
        [
          "disp1",
          { sourceJsonPath: "$.id", targetField: "header", targetKey: "id" },
        ],
      ]),
      onUpdate,
      options: { signal: new AbortController().signal, aliasValues },
    } as unknown as ExecutionContext;

    await apiExecutor(context);

    expect(onUpdate.mock.lastCall?.[1]).toBe("passed");
    expect(onUpdate.mock.lastCall?.[2].warnings).toBeUndefined();
    expect(aliasValues["e3:id"]).toBe("7");
  });

  it("attaches no warnings without a collision", async () => {
    runRequestMock.mockResolvedValue(response({}));
    const { promise, onUpdate } = run({});
    await promise;
    expect(onUpdate.mock.lastCall?.[2].warnings).toBeUndefined();
  });
});

describe("apiExecutor abort guard", () => {
  beforeEach(() => runRequestMock.mockReset());

  it("records an aborted step without sending or promoting when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const onUpdate = vi.fn();
    const onPromoteToEnv = vi.fn();
    const runState: ChainRunState = {};
    await apiExecutor({
      nodeId: "api2",
      request,
      incomingEdges: [],
      runState,
      displayNodeMap: new Map(),
      onUpdate,
      options: {
        signal: controller.signal,
        aliasValues: {},
        onPromoteToEnv,
      },
    } as unknown as ExecutionContext);

    expect(runRequestMock).not.toHaveBeenCalled();
    expect(onPromoteToEnv).not.toHaveBeenCalled();
    expect(runState.api2).toMatchObject({ state: "aborted", error: "Run stopped" });
    expect(onUpdate).toHaveBeenCalledWith(
      "api2",
      "aborted",
      expect.objectContaining({ errorCode: "runStopped" }),
    );
  });
});
