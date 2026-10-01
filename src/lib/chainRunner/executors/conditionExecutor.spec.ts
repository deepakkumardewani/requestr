import { describe, expect, it, vi } from "vitest";
import { registerEdgeAlias } from "@/lib/chainValueNamespace";
import type {
  ChainEdge,
  ChainRunState,
  ConditionNodeConfig,
} from "@/types/chain";
import type { ExecutionContext } from "../types";
import { conditionExecutor } from "./conditionExecutor";

const node = (expression: string): ConditionNodeConfig =>
  ({
    id: "c1",
    variable: "id",
    branches: [{ id: "b1", label: "B", expression }],
  }) as unknown as ConditionNodeConfig;

function run(aliasValues: Record<string, string>, expression = "== 7") {
  const edge: ChainEdge = {
    id: "e2",
    sourceRequestId: "api",
    targetRequestId: "c1",
    injections: [
      { sourceJsonPath: "$.id", targetField: "header", targetKey: "id" },
    ],
  };
  const runState = {
    api: {
      state: "passed",
      extractedValues: {},
      response: { body: JSON.stringify({ id: 7 }) },
    },
  } as unknown as ChainRunState;
  const onUpdate = vi.fn();
  const promise = conditionExecutor({
    nodeId: "c1",
    incomingEdges: [edge],
    runState,
    conditionNodeMap: new Map([["c1", node(expression)]]),
    onUpdate,
    options: { signal: new AbortController().signal, aliasValues },
  } as unknown as ExecutionContext);
  return { promise, onUpdate };
}

const collision = {
  kind: "alias-collision",
  alias: "id",
  previousOwner: { kind: "edge", id: "e1" },
  owner: { kind: "edge", id: "e2" },
};

describe("conditionExecutor alias collisions", () => {
  it("records the warning on a passing step", async () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "e1", "id", "old");
    const { promise, onUpdate } = run(aliasValues);
    await promise;
    expect(onUpdate).toHaveBeenLastCalledWith(
      "c1",
      "passed",
      expect.objectContaining({ warnings: [collision] }),
    );
  });

  it("records the warning when no branch matches", async () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "e1", "id", "old");
    const { promise, onUpdate } = run(aliasValues, "== 999");
    await promise;
    expect(onUpdate).toHaveBeenLastCalledWith(
      "c1",
      "failed",
      expect.objectContaining({ error: "No branch matched", warnings: [collision] }),
    );
  });

  it("attaches no warnings without a collision", async () => {
    const { promise, onUpdate } = run({});
    await promise;
    expect(onUpdate.mock.lastCall?.[2].warnings).toBeUndefined();
  });
});

describe("conditionExecutor abort guard", () => {
  it("does not evaluate once the run is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const onUpdate = vi.fn();
    const runState = {} as ChainRunState;
    await conditionExecutor({
      nodeId: "c1",
      incomingEdges: [],
      runState,
      conditionNodeMap: new Map([["c1", node("== 7")]]),
      onUpdate,
      options: { signal: controller.signal, aliasValues: {} },
    } as unknown as ExecutionContext);

    expect(runState.c1).toMatchObject({ state: "aborted", error: "Run stopped" });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      "c1",
      "aborted",
      expect.objectContaining({ errorCode: "runStopped" }),
    );
  });
});

describe("conditionExecutor edge handling", () => {
  function runEdges(edges: ChainEdge[], runState: ChainRunState, known = true) {
    const onUpdate = vi.fn();
    const promise = conditionExecutor({
      nodeId: "c1",
      incomingEdges: edges,
      runState,
      conditionNodeMap: new Map(known ? [["c1", node("== 7")]] : []),
      onUpdate,
      options: { signal: new AbortController().signal, aliasValues: {} },
    } as unknown as ExecutionContext);
    return { promise, onUpdate };
  }

  const dataEdge = (overrides: Partial<ChainEdge> = {}): ChainEdge => ({
    id: "e1",
    sourceRequestId: "api",
    targetRequestId: "c1",
    injections: [
      { sourceJsonPath: "$.id", targetField: "header", targetKey: "id" },
    ],
    ...overrides,
  });

  it("returns false when the node is not a condition node", async () => {
    const { promise, onUpdate } = runEdges([], {} as ChainRunState, false);
    expect(await promise).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("records a null value for an edge whose source has no response", async () => {
    const { promise, onUpdate } = runEdges([dataEdge()], {} as ChainRunState);
    await promise;
    expect(onUpdate).toHaveBeenLastCalledWith(
      "c1",
      "failed",
      expect.objectContaining({ error: "No branch matched" }),
    );
  });

  it("ignores routing edges that carry a branchId", async () => {
    const runState = {
      api: {
        state: "passed",
        extractedValues: {},
        response: { body: JSON.stringify({ id: 7 }) },
      },
    } as unknown as ChainRunState;
    const { promise, onUpdate } = runEdges(
      [dataEdge({ branchId: "b1" })],
      runState,
    );
    await promise;
    expect(onUpdate).toHaveBeenLastCalledWith(
      "c1",
      "failed",
      expect.objectContaining({ error: "No branch matched" }),
    );
  });
});
