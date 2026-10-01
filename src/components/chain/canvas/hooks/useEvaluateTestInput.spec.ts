/** @vitest-environment happy-dom */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { ChainEdge, ChainRunState, StartBlock } from "@/types/chain";
import { buildEvaluateTestInput, useEvaluateTestInput } from "./useEvaluateTestInput";

const runState: ChainRunState = {
  api: {
    state: "passed",
    extractedValues: {},
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: '{"id":7}',
      duration: 0,
      size: 0,
      url: "",
      method: "GET",
      timestamp: 0,
    },
  },
  start: { state: "passed", extractedValues: { x: "1", y: null } },
};
const edges = [
  { id: "e1", sourceRequestId: "api", targetRequestId: "eval", injections: [] },
  { id: "e2", sourceRequestId: "api", targetRequestId: "other", injections: [] },
] as ChainEdge[];
const startBlock = { id: "start", type: "start", inputs: [] } as StartBlock;

describe("buildEvaluateTestInput", () => {
  it("builds data, chain inputs and env from the last run", () => {
    expect(
      buildEvaluateTestInput({
        nodeId: "eval",
        edges,
        runState,
        startBlock,
        envVars: { host: "h" },
      }),
    ).toEqual({
      data: { response: { id: 7 } },
      inputs: { x: "1" },
      env: { host: "h" },
    });
  });

  it("returns undefined when no node is open", () => {
    expect(
      buildEvaluateTestInput({
        nodeId: null,
        edges,
        runState,
        startBlock,
        envVars: {},
      }),
    ).toBeUndefined();
  });
});

describe("useEvaluateTestInput", () => {
  afterEach(cleanup);

  it("is undefined with no open node", () => {
    const { result } = renderHook(() =>
      useEvaluateTestInput({ nodeId: null, edges, runState, startBlock }),
    );
    expect(result.current).toBeUndefined();
  });

  it("builds the test input for the open node using the active environment", () => {
    useEnvironmentsStore.setState({
      activeEnvId: "env",
      environments: [
        {
          id: "env",
          name: "Env",
          variables: [{ key: "host", initialValue: "h", currentValue: "" }],
        },
      ] as never,
    });
    const { result } = renderHook(() =>
      useEvaluateTestInput({ nodeId: "eval", edges, runState, startBlock }),
    );
    expect(result.current).toEqual({
      data: { response: { id: 7 } },
      inputs: { x: "1" },
      env: { host: "h" },
    });
  });
});
