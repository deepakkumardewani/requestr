import { describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import type {
  Chain,
  ChainRunState,
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { createBlockNodeBuilder } from "./blockNodeFactory";
import { buildAllNodes, type NodeBuildContext } from "./chainNodeBuilders";

const handler = () => vi.fn();

function req(overrides: Partial<RequestModel> = {}): RequestModel {
  return {
    id: "req-1",
    collectionId: "col-1",
    name: "Get user",
    method: "GET",
    url: "https://x.test/{{userId}}",
    params: [{ id: "p", key: "q", value: "{{page}}", enabled: true }],
    headers: [{ id: "h", key: "Auth", value: "{{token}}", enabled: true }],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function chain(id: string, overrides: Partial<Chain> = {}): Chain {
  return {
    id,
    scope: "standalone",
    schemaVersion: 5,
    name: `Chain ${id}`,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
    ...overrides,
  } as Chain;
}

function makeCtx(overrides: Partial<NodeBuildContext> = {}): NodeBuildContext {
  const runState: ChainRunState = overrides.runState ?? {};
  return {
    build: createBlockNodeBuilder({
      runState,
      nodePositions: {},
      keyboardFocusNodeId: null,
      chainErrorMessage: (_c, _p, fallback = "") => fallback,
      nodeCache: (_id, _deps, build) => build(),
    }),
    chainId: "host",
    chains: {},
    collections: [],
    requests: [],
    delayNodes: [],
    conditionNodes: [],
    displayNodes: [],
    evaluateNodes: [],
    validateNodes: [],
    mergeNodes: [],
    loopNodes: [],
    collectNodes: [],
    subChainNodes: [],
    startBlock: null,
    chainEdges: [],
    runState,
    declaredNamespace: { chainInputs: {}, aliasValues: {} },
    resolveVariables: (t) => t,
    onClickNode: handler(),
    onDeleteNode: handler(),
    onEditRequest: handler(),
    onUpdateDelay: handler(),
    onConfigureNode: handler(),
    onConfigureConditionNode: handler(),
    onConfigureEvaluateNode: handler(),
    onConfigureValidateNode: handler(),
    onConfigureMergeNode: handler(),
    onConfigureLoopNode: handler(),
    onConfigureCollectNode: handler(),
    onConfigureSubChainNode: handler(),
    onChangeSubChainReference: handler(),
    ...overrides,
  };
}

const delay: DelayNodeConfig = { id: "d1", type: "delay", delayMs: 500 };
const condition: ConditionNodeConfig = {
  id: "c1",
  type: "condition",
  variable: "{{role}}",
  branches: [{ id: "b1", label: "admin", expression: "== 'admin'" }],
};
const display: DisplayBlock = {
  id: "disp1",
  type: "display",
  sourceJsonPath: "$.a",
  targetField: "header",
  targetKey: "X",
};
const evaluate: EvaluateBlock = {
  id: "e1",
  type: "evaluate",
  code: "return 1",
  outputAlias: "out",
};
const validate: ValidateBlock = {
  id: "v1",
  type: "validate",
  schema: "{}",
  sourceJsonPath: "$.x",
};
const merge: MergeBlock = { id: "m1", type: "merge", mode: "all" };
const loop: LoopBlock = {
  id: "l1",
  type: "loop",
  sourceJsonPath: "$.items",
  itemAlias: "item",
  maxIterations: 7,
};
const collect: CollectBlock = { id: "col1", type: "collect", loopId: "l1" };
const start: StartBlock = {
  id: "s1",
  type: "start",
  inputs: [{ key: "k", source: "literal", value: "v" }] as never,
};

describe("buildAllNodes", () => {
  it("returns no nodes for an empty chain", () => {
    expect(buildAllNodes(makeCtx())).toEqual([]);
  });

  it("orders nodes Start first and then by block type", () => {
    const ctx = makeCtx({
      startBlock: start,
      requests: [req()],
      delayNodes: [delay],
      conditionNodes: [condition],
      displayNodes: [display],
      evaluateNodes: [evaluate],
      validateNodes: [validate],
      mergeNodes: [merge],
      loopNodes: [loop],
      collectNodes: [collect],
      subChainNodes: [
        { id: "sc1", type: "subchain", chainId: "x", inputBindings: {} },
      ],
    });

    expect(buildAllNodes(ctx).map((n) => n.id)).toEqual([
      "s1",
      "req-1",
      "d1",
      "c1",
      "disp1",
      "e1",
      "v1",
      "m1",
      "l1",
      "col1",
      "sc1",
    ]);
  });

  it("omits the Start node when the chain has no Start block", () => {
    const nodes = buildAllNodes(makeCtx({ requests: [req()] }));

    expect(nodes.some((n) => n.type === "startNode")).toBe(false);
  });

  it("builds a start node carrying its inputs and handlers", () => {
    const ctx = makeCtx({ startBlock: start });

    const [node] = buildAllNodes(ctx);

    expect(node.type).toBe("startNode");
    expect(node.data).toMatchObject({
      nodeId: "s1",
      inputs: start.inputs,
      onDeleteNode: ctx.onDeleteNode,
      onConfigureNode: ctx.onConfigureNode,
    });
  });

  it("builds delay, merge, validate, evaluate and loop nodes with their config fields", () => {
    const ctx = makeCtx({
      delayNodes: [delay],
      mergeNodes: [merge],
      validateNodes: [validate],
      evaluateNodes: [evaluate],
      loopNodes: [loop],
    });

    const byId = Object.fromEntries(
      buildAllNodes(ctx).map((n) => [n.id, n.data]),
    );

    expect(byId.d1).toMatchObject({ delayMs: 500, onUpdateDelay: ctx.onUpdateDelay });
    expect(byId.m1).toMatchObject({ mode: "all", onConfigureNode: ctx.onConfigureMergeNode });
    expect(byId.v1).toMatchObject({ sourceJsonPath: "$.x", onConfigureNode: ctx.onConfigureValidateNode });
    expect(byId.e1).toMatchObject({ outputAlias: "out", onConfigureNode: ctx.onConfigureEvaluateNode });
    expect(byId.l1).toMatchObject({ itemAlias: "item", maxIterations: 7, onConfigureNode: ctx.onConfigureLoopNode });
  });

  it("builds a collect node bound to its loop", () => {
    const ctx = makeCtx({ collectNodes: [collect] });

    expect(buildAllNodes(ctx)[0].data).toMatchObject({
      loopId: "l1",
      onConfigureNode: ctx.onConfigureCollectNode,
    });
  });
});

describe("buildAllNodes - api nodes", () => {
  it("carries request identity and last-run results from the run state", () => {
    const response = { status: 200 } as never;
    const ctx = makeCtx({
      requests: [req()],
      runState: {
        "req-1": {
          state: "passed",
          extractedValues: { t: "1" },
          response,
          errorKind: "network" as never,
          unresolvedVars: [],
        },
      },
    });

    const [node] = buildAllNodes(ctx);

    expect(node.type).toBe("chainNode");
    expect(node.data).toMatchObject({
      requestId: "req-1",
      name: "Get user",
      method: "GET",
      state: "passed",
      response,
      errorKind: "network",
      extractedValues: { t: "1" },
      onClickNode: ctx.onClickNode,
      onEditRequest: ctx.onEditRequest,
    });
  });

  it("dry-run resolves unresolved variables before the first run", () => {
    const ctx = makeCtx({
      requests: [req()],
      resolveVariables: (t) => t.replace("{{token}}", "T"),
    });

    const [node] = buildAllNodes(ctx);

    expect(node.data.unresolvedVars).toEqual(
      expect.arrayContaining(["userId", "page"]),
    );
    expect(node.data.unresolvedVars).not.toContain("token");
  });

  it("prefers the run state's unresolved vars over a dry-run", () => {
    const ctx = makeCtx({
      requests: [req()],
      runState: {
        "req-1": { state: "failed", extractedValues: {}, unresolvedVars: ["only"] },
      },
    });

    const [node] = buildAllNodes(ctx);

    expect(node.data.unresolvedVars).toEqual(["only"]);
    expect(node.data.variableFooterResolvedNames).not.toContain("only");
    expect(node.data.variableFooterResolvedNames).toEqual(
      expect.arrayContaining(["userId", "page", "token"]),
    );
  });

  it("scans url, header, param and body text for footer variable references", () => {
    const ctx = makeCtx({
      requests: [
        req({ body: { type: "json", content: '{"a":"{{bodyVar}}"}' } }),
      ],
      runState: {
        "req-1": { state: "idle", extractedValues: {}, unresolvedVars: [] },
      },
    });

    const [node] = buildAllNodes(ctx);

    expect(node.data.variableFooterResolvedNames).toEqual(
      expect.arrayContaining(["userId", "token", "page", "bodyVar"]),
    );
  });
});

describe("buildAllNodes - condition nodes", () => {
  it("exposes the active branch and the declared names as resolved variables", () => {
    const ctx = makeCtx({
      conditionNodes: [condition],
      runState: { c1: { state: "passed", extractedValues: {}, activeBranchId: "b1" } },
      declaredNamespace: { chainInputs: { in1: "x" }, aliasValues: { al: "y" } },
    });

    const [node] = buildAllNodes(ctx);

    expect(node.data).toMatchObject({
      variable: "{{role}}",
      branches: condition.branches,
      activeBranchId: "b1",
      variableFooterResolvedNames: ["in1", "al"],
    });
  });
});

describe("buildAllNodes - display nodes", () => {
  const response = { status: 200 } as never;
  const edge = (src: string) => ({
    id: "e",
    sourceRequestId: src,
    targetRequestId: "disp1",
    injections: [],
  });

  it("passes the upstream request's response as the display source", () => {
    const ctx = makeCtx({
      displayNodes: [display],
      requests: [req()],
      chainEdges: [edge("req-1")],
      runState: { "req-1": { state: "passed", extractedValues: {}, response } },
    });

    const node = buildAllNodes(ctx).find((n) => n.id === "disp1");

    expect(node?.data).toMatchObject({ sourceResponse: response, config: display });
  });

  it("leaves the source response undefined when nothing feeds the display", () => {
    const ctx = makeCtx({ displayNodes: [display], requests: [req()] });

    expect(buildAllNodes(ctx)[1].data.sourceResponse).toBeUndefined();
  });

  it("leaves the source response undefined when the upstream is not an API request", () => {
    const ctx = makeCtx({
      displayNodes: [display],
      requests: [req()],
      chainEdges: [edge("ghost")],
    });

    expect(buildAllNodes(ctx).find((n) => n.id === "disp1")?.data.sourceResponse).toBeUndefined();
  });
});

describe("buildAllNodes - sub-chain nodes", () => {
  const sub = (chainId: string): SubChainBlock => ({
    id: "sc1",
    type: "subchain",
    chainId,
    inputBindings: {},
  });
  const runnable = (id: string, extra: Partial<Chain> = {}) =>
    chain(id, {
      blocks: [{ id: "r", type: "history" } as never],
      nodeIds: ["r"],
      ...extra,
    });

  it("shows the referenced chain's name and marks a valid reference", () => {
    const ctx = makeCtx({
      subChainNodes: [sub("child")],
      chains: { child: runnable("child", { name: "Child" }) },
    });

    expect(buildAllNodes(ctx)[0].data).toMatchObject({
      chainId: "child",
      chainName: "Child",
      isInvalid: false,
      onChangeReference: ctx.onChangeSubChainReference,
      onConfigureNode: ctx.onConfigureSubChainNode,
    });
  });

  it("uses the collection's current name for a collection-scoped chain", () => {
    const ctx = makeCtx({
      subChainNodes: [sub("col-9")],
      collections: [{ id: "col-9", name: "Renamed" } as never],
      chains: { "col-9": runnable("col-9", { scope: "collection", name: "Stale" }) },
    });

    expect(buildAllNodes(ctx)[0].data.chainName).toBe("Renamed");
  });

  it("flags a missing referenced chain as invalid with no name", () => {
    const ctx = makeCtx({ subChainNodes: [sub("gone")] });

    expect(buildAllNodes(ctx)[0].data).toMatchObject({
      chainName: undefined,
      isInvalid: true,
    });
  });

  it("flags a reference that would cycle back to the host chain as invalid", () => {
    const ctx = makeCtx({
      chainId: "host",
      subChainNodes: [sub("child")],
      chains: {
        child: runnable("child", {
          blocks: [
            { id: "back", type: "subchain", chainId: "host", inputBindings: {} },
          ],
        }),
        host: runnable("host"),
      },
    });

    expect(buildAllNodes(ctx)[0].data.isInvalid).toBe(true);
  });
});
