import { describe, expect, it } from "vitest";
import type { ResponseData } from "@/types";
import type { ChainEdge, ChainRunState } from "@/types/chain";
import { buildEvaluateData } from "./evaluateData";

function response(body: string): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    body,
    duration: 0,
    size: 0,
    url: "",
    method: "GET",
    timestamp: 0,
  };
}

function edge(overrides: Partial<ChainEdge>): ChainEdge {
  return {
    id: "e1",
    sourceRequestId: "a",
    targetRequestId: "eval",
    injections: [],
    ...overrides,
  } as ChainEdge;
}

describe("buildEvaluateData", () => {
  it("parses the upstream response and aliases injected values", () => {
    const runState: ChainRunState = {
      a: {
        state: "passed",
        extractedValues: {},
        response: response('{"token":"t1"}'),
      },
    };
    const { input, extractions } = buildEvaluateData({
      incomingEdges: [
        edge({
          injections: [
            { sourceJsonPath: "$.token", targetKey: "tok" },
          ] as ChainEdge["injections"],
        }),
      ],
      runState,
      chainInputs: { userId: "42" },
      envVars: { host: "h" },
    });
    expect(input).toEqual({
      data: { tok: "t1", response: { token: "t1" } },
      inputs: { userId: "42" },
      env: { host: "h" },
    });
    expect(extractions).toEqual([
      { edgeId: "e1", targetKey: "tok", value: "t1" },
    ]);
  });

  it("falls back to the raw body when it is not JSON", () => {
    const { input } = buildEvaluateData({
      incomingEdges: [edge({})],
      runState: {
        a: { state: "passed", extractedValues: {}, response: response("plain") },
      },
    });
    expect(input.data).toEqual({ response: "plain" });
    expect(input.inputs).toEqual({});
    expect(input.env).toEqual({});
  });

  it("returns undefined response and null values with no upstream data", () => {
    const { input } = buildEvaluateData({
      incomingEdges: [
        edge({
          injections: [
            { sourceJsonPath: "$.x", targetKey: "x" },
          ] as ChainEdge["injections"],
        }),
      ],
      runState: {},
    });
    expect(input.data).toEqual({ x: null, response: undefined });
  });

  it("ignores non-extraction (condition branch) edges", () => {
    const { input } = buildEvaluateData({
      incomingEdges: [edge({ branchId: "branch-1" })],
      runState: {
        a: { state: "passed", extractedValues: {}, response: response("1") },
      },
    });
    expect(input.data).toEqual({ response: undefined });
  });
});
