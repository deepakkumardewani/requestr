/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStep, RunSummary } from "@/lib/chainRunHistory";
import * as chainRunner from "@/lib/chainRunner";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useChainStore } from "@/stores/useChainStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel } from "@/types";
import {
  CHAIN_SCHEMA_VERSION,
  type Chain,
  type ChainBlock,
  type ChainEdge,
  type CollectBlock,
  type ConditionNodeConfig,
  type DelayNodeConfig,
  type DisplayBlock,
  type EvaluateBlock,
  type LoopBlock,
  type MergeBlock,
  type StartBlock,
  type SubChainBlock,
  type ValidateBlock,
} from "@/types/chain";
import { type UseChainRunParams, useChainRun as useChainRunImpl } from "./useChainRun";

/** Fixture shape: blocks grouped by type, flattened into the hook's single `blocks` param. */
type GroupedRunParams = Omit<UseChainRunParams, "blocks"> & {
  delayNodes?: DelayNodeConfig[];
  conditionNodes?: ConditionNodeConfig[];
  displayNodes?: DisplayBlock[];
  evaluateNodes?: EvaluateBlock[];
  validateNodes?: ValidateBlock[];
  mergeNodes?: MergeBlock[];
  loopNodes?: LoopBlock[];
  collectNodes?: CollectBlock[];
  subChainNodes?: SubChainBlock[];
  startBlock?: StartBlock;
};

function useChainRun({
  delayNodes = [],
  conditionNodes = [],
  displayNodes = [],
  evaluateNodes = [],
  validateNodes = [],
  mergeNodes = [],
  loopNodes = [],
  collectNodes = [],
  subChainNodes = [],
  startBlock,
  ...rest
}: GroupedRunParams) {
  const blocks: ChainBlock[] = [
    ...delayNodes,
    ...conditionNodes,
    ...displayNodes,
    ...evaluateNodes,
    ...validateNodes,
    ...mergeNodes,
    ...loopNodes,
    ...collectNodes,
    ...subChainNodes,
    ...(startBlock ? [startBlock] : []),
  ];
  return useChainRunImpl({ ...rest, blocks });
}

const CHAIN_ID = "chain-1";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Runs persist to IDB via useChainRunStore.finishRun; keep it a no-op here so
// these tests only assert the in-memory hook <-> store wiring.
vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function makeRequest(id: string): RequestModel {
  return {
    id,
    collectionId: "col-1",
    name: id,
    method: "GET",
    url: `https://example.com/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

const requests: RequestModel[] = [
  makeRequest("req-1"),
  makeRequest("req-2"),
  makeRequest("req-3"),
];

const edges: ChainEdge[] = [
  { id: "e1", sourceRequestId: "req-1", targetRequestId: "req-2", injections: [] },
  { id: "e2", sourceRequestId: "req-2", targetRequestId: "req-3", injections: [] },
];

function setup() {
  return renderHook(() =>
    useChainRun({
      chainId: CHAIN_ID,
      chainRequests: requests,
      edges,
      delayNodes: [],
      conditionNodes: [],
      displayNodes: [],
      onPromoteToEnv: vi.fn(),
    }),
  );
}

describe("useChainRun", () => {
  beforeEach(() => {
    vi.spyOn(chainRunner, "runChain").mockResolvedValue(undefined);
    useChainRunStore.setState({
      runs: {},
      activeRun: null,
      selectedRunId: null,
      selectedStepId: null,
      runsLoading: {},
      runsError: {},
      syncSource: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores node colors from the persisted run history on mount", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-1",
            chainId: CHAIN_ID,
            startedAt: 1,
            finishedAt: 2,
            status: "passed",
            trigger: "full",
            counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
            bytes: 10,
            schemaVersion: 1,
            steps: [
              {
                id: "step-1",
                nodeId: "req-1",
                nodeType: "api",
                label: "req-1",
                state: "passed",
                startedAt: 1,
                durationMs: 1,
                extractedValues: { foo: "bar" },
                unresolvedVars: [],
              },
            ],
          },
        ],
      },
    });

    const { result } = setup();

    await waitFor(() => {
      expect(result.current.runState["req-1"]?.state).toBe("passed");
    });
    expect(result.current.runState["req-1"]?.extractedValues).toEqual({
      foo: "bar",
    });
  });

  it("handleRun runs the full chain", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRun();
    });

    expect(chainRunner.runChain).toHaveBeenCalledWith({
      requests,
      edges,
      onUpdate: expect.any(Function),
      signal: expect.any(Object),
      envVars: {},
      nodeAssertions: undefined,
      delayNodes: [],
      conditionNodes: [],
      envPromotions: undefined,
      onPromoteToEnv: expect.any(Function),
      displayNodes: [],
      resolveVariables: undefined,
      startBlock: undefined,
      startOverrides: undefined,
      evaluateNodes: [],
      validateNodes: [],
      mergeNodes: [],
      concurrency: 4,
      loopNodes: [],
      collectNodes: [],
      subChainBlocks: [],
      resolveSubChainGraph: expect.any(Function),
    });
  });

  it("handleRun passes loopNodes, collectNodes, and mergeNodes through to runChain (P8.7 wiring)", async () => {
    const loopNodes = [
      {
        id: "loop-1",
        type: "loop" as const,
        sourceJsonPath: "$",
        itemAlias: "item",
        maxIterations: 10,
      },
    ];
    const collectNodes = [
      { id: "collect-1", type: "collect" as const, loopId: "loop-1" },
    ];
    const mergeNodes = [
      { id: "merge-1", type: "merge" as const, mode: "all" as const },
    ];
    const { result } = renderHook(() =>
      useChainRun({
        chainId: CHAIN_ID,
        chainRequests: requests,
        edges,
        delayNodes: [],
        conditionNodes: [],
        displayNodes: [],
        mergeNodes,
        loopNodes,
        collectNodes,
        onPromoteToEnv: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleRun();
    });

    const [call] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(call.collectNodes).toEqual(collectNodes);
    expect(call.loopNodes).toEqual(loopNodes);
    expect(call.mergeNodes).toEqual(mergeNodes);
  });

  it("handleRun passes the store's chainConcurrency through to runChain, and reacts to changes", async () => {
    const initialConcurrency = useUIStore.getState().chainConcurrency;

    useUIStore.getState().setChainConcurrency(1);
    const { result: firstRun } = setup();
    await act(async () => {
      await firstRun.current.handleRun();
    });
    expect(vi.mocked(chainRunner.runChain).mock.calls[0][0].concurrency).toBe(1);

    useUIStore.getState().setChainConcurrency(8);
    const { result: secondRun } = setup();
    await act(async () => {
      await secondRun.current.handleRun();
    });
    expect(vi.mocked(chainRunner.runChain).mock.calls[1][0].concurrency).toBe(8);

    useUIStore.getState().setChainConcurrency(initialConcurrency);
  });

  it("handleRun passes the Start block and override values through to runChain", async () => {
    const startBlock = {
      id: "start-1",
      type: "start" as const,
      inputs: [{ key: "token", defaultValue: "abc", source: "literal" as const }],
    };
    const { result } = renderHook(() =>
      useChainRun({
        chainId: CHAIN_ID,
        chainRequests: requests,
        edges,
        delayNodes: [],
        conditionNodes: [],
        displayNodes: [],
        onPromoteToEnv: vi.fn(),
        startBlock,
      }),
    );

    await act(async () => {
      await result.current.handleRun({ token: "override" });
    });

    expect(chainRunner.runChain).toHaveBeenCalledWith({
      requests,
      edges,
      onUpdate: expect.any(Function),
      signal: expect.any(Object),
      envVars: {},
      nodeAssertions: undefined,
      delayNodes: [],
      conditionNodes: [],
      envPromotions: undefined,
      onPromoteToEnv: expect.any(Function),
      displayNodes: [],
      resolveVariables: undefined,
      startBlock,
      startOverrides: { token: "override" },
      evaluateNodes: [],
      validateNodes: [],
      mergeNodes: [],
      concurrency: 4,
      loopNodes: [],
      collectNodes: [],
      subChainBlocks: [],
      resolveSubChainGraph: expect.any(Function),
    });
  });

  it("handleRunUpTo runs only the requested node and its ancestors", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("req-2");
    });

    const [{ requests: subsetRequests, edges: subsetEdges }] = vi.mocked(
      chainRunner.runChain,
    ).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-1", "req-2"]);
    expect(subsetEdges).toEqual([edges[0]]);
  });

  it("handleRunFromHere runs the requested node and its descendants", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunFromHere("req-2");
    });

    const [{ requests: subsetRequests, edges: subsetEdges }] = vi.mocked(
      chainRunner.runChain,
    ).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-2", "req-3"]);
    expect(subsetEdges).toEqual([edges[1]]);
  });

  it("surfaces a circular dependency error from handleRunUpTo", async () => {
    const { toast } = await import("sonner");
    vi.spyOn(chainRunner, "buildExecutionOrder").mockImplementation(() => {
      throw new chainRunner.CircularDependencyError();
    });

    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("req-1");
    });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "This chain has a circular dependency. Remove the cycle to run.",
      );
    });
    expect(chainRunner.runChain).not.toHaveBeenCalled();
  });

  it("handleRunSingleNode runs just that node with no edges", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunSingleNode("req-2");
    });

    expect(chainRunner.runChain).toHaveBeenCalledWith({
      requests: [requests[1]],
      edges: [],
      onUpdate: expect.any(Function),
      signal: expect.any(Object),
      envVars: {},
      resolveVariables: undefined,
    });
  });

  it("rerun re-executes the exact node subset a persisted run touched", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-1",
            chainId: CHAIN_ID,
            startedAt: 1,
            finishedAt: 2,
            status: "passed",
            trigger: "upTo",
            counts: { passed: 2, failed: 0, skipped: 0, aborted: 0 },
            bytes: 10,
            schemaVersion: 1,
            steps: [
              {
                id: "step-1",
                nodeId: "req-1",
                nodeType: "api",
                label: "req-1",
                state: "passed",
                startedAt: 1,
                durationMs: 1,
                extractedValues: {},
                unresolvedVars: [],
              },
              {
                id: "step-2",
                nodeId: "req-2",
                nodeType: "api",
                label: "req-2",
                state: "passed",
                startedAt: 2,
                durationMs: 1,
                extractedValues: {},
                unresolvedVars: [],
              },
            ],
          },
        ],
      },
    });

    const { result } = setup();

    await act(async () => {
      await result.current.rerun("run-1");
    });

    const [{ requests: subsetRequests, edges: subsetEdges }] = vi.mocked(
      chainRunner.runChain,
    ).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-1", "req-2"]);
    expect(subsetEdges).toEqual([edges[0]]);
  });

  it("rerun includes non-API node types matching the persisted run's steps", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-2",
            chainId: CHAIN_ID,
            startedAt: 1,
            finishedAt: 2,
            status: "passed",
            trigger: "upTo",
            counts: { passed: 9, failed: 0, skipped: 0, aborted: 0 },
            bytes: 10,
            schemaVersion: 1,
            steps: [
              "req-1",
              "delay-1",
              "cond-1",
              "disp-1",
              "eval-1",
              "val-1",
              "merge-1",
              "loop-1",
              "collect-1",
              "sub-1",
            ].map((nodeId, i) => ({
              id: `step-${i}`,
              nodeId,
              nodeType: "api" as const,
              label: nodeId,
              state: "passed" as const,
              startedAt: i,
              durationMs: 1,
              extractedValues: {},
              unresolvedVars: [],
            })),
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useChainRun({
        chainId: CHAIN_ID,
        chainRequests: requests,
        edges,
        delayNodes: [{ id: "delay-1", type: "delay", delayMs: 100 }],
        conditionNodes: [
          {
            id: "cond-1",
            type: "condition",
            variable: "{{role}}",
            branches: [{ id: "else", label: "else", expression: "" }],
          },
        ],
        displayNodes: [
          {
            id: "disp-1",
            type: "display",
            sourceJsonPath: "$.data.token",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
        evaluateNodes: [
          { id: "eval-1", type: "evaluate", outputAlias: "out", code: "" },
        ],
        validateNodes: [
          { id: "val-1", type: "validate", sourceJsonPath: "$", schema: "{}" },
        ],
        mergeNodes: [{ id: "merge-1", type: "merge", mode: "all" }],
        loopNodes: [
          {
            id: "loop-1",
            type: "loop",
            itemAlias: "item",
            maxIterations: 10,
            sourceJsonPath: "$",
          },
        ],
        collectNodes: [{ id: "collect-1", type: "collect", loopId: "loop-1" }],
        subChainNodes: [
          { id: "sub-1", type: "subchain", chainId: "other-chain", inputBindings: {} },
        ],
        onPromoteToEnv: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.rerun("run-2");
    });

    const [{ requests: subsetRequests }] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-1"]);
  });

  const persistedRun = (overrides: Partial<RunSummary>): RunSummary => ({
    id: "run-x",
    chainId: CHAIN_ID,
    startedAt: 1,
    finishedAt: 2,
    status: "passed",
    trigger: "upTo",
    counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
    bytes: 10,
    schemaVersion: 1,
    steps: [],
    ...overrides,
  });

  const step = (nodeId: string, extra: Partial<RunStep> = {}): RunStep => ({
    id: `step-${nodeId}-${extra.parentStepId ?? "top"}`,
    nodeId,
    nodeType: "api",
    label: nodeId,
    state: "passed",
    startedAt: 1,
    durationMs: 1,
    extractedValues: {},
    unresolvedVars: [],
    ...extra,
  });

  it("records the anchor node on up-to, from-here and single runs", async () => {
    const originalStartRun = useChainRunStore.getState().startRun;
    const startRunSpy = vi.fn(originalStartRun);
    useChainRunStore.setState({ startRun: startRunSpy });
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("req-2");
      await result.current.handleRunFromHere("req-2");
      await result.current.handleRunSingleNode("req-2");
    });
    useChainRunStore.setState({ startRun: originalStartRun });

    expect(startRunSpy.mock.calls.map(([, trigger, opts]) => [trigger, opts?.anchorNodeId])).toEqual([
      ["upTo", "req-2"],
      ["fromHere", "req-2"],
      ["single", "req-2"],
    ]);
  });

  it("rerun of an up-to run replays the slice from its anchor, not the step list", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          persistedRun({
            id: "run-anchor",
            trigger: "upTo",
            anchorNodeId: "req-2",
            // A nested child and a deleted node must not leak into the rerun.
            steps: [
              step("req-1"),
              step("req-2"),
              step("inner-loop-child", { parentStepId: "step-loop" }),
              step("deleted-node"),
            ],
          }),
        ],
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.rerun("run-anchor");
    });

    const [{ requests: subsetRequests }] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-1", "req-2"]);
  });

  it("rerun skips silently when the anchor node no longer exists", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          persistedRun({ id: "run-gone", trigger: "fromHere", anchorNodeId: "deleted" }),
        ],
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.rerun("run-gone");
    });

    expect(chainRunner.runChain).not.toHaveBeenCalled();
  });

  it("rerun of a single-node run re-runs just that node", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [persistedRun({ id: "run-single", trigger: "single", anchorNodeId: "req-3" })],
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.rerun("run-single");
    });

    const [{ requests: rerunRequests, edges: rerunEdges }] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(rerunRequests.map((r) => r.id)).toEqual(["req-3"]);
    expect(rerunEdges).toEqual([]);
  });

  it("rerun of a full run runs the whole chain again", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [persistedRun({ id: "run-full", trigger: "full", steps: [step("req-1")] })],
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.rerun("run-full");
    });

    const [{ requests: rerunRequests }] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(rerunRequests.map((r) => r.id)).toEqual(["req-1", "req-2", "req-3"]);
  });

  it("rerun of a legacy run without an anchor ignores nested steps", async () => {
    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          persistedRun({
            id: "run-legacy",
            trigger: "upTo",
            steps: [step("req-1"), step("req-3", { parentStepId: "step-loop" })],
          }),
        ],
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.rerun("run-legacy");
    });

    const [{ requests: subsetRequests }] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-1"]);
  });

  it("rerun does nothing for an unknown run id", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.rerun("missing-run");
    });

    expect(chainRunner.runChain).not.toHaveBeenCalled();
  });

  it("clearRunState resets runState to empty", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRun();
    });
    expect(Object.keys(result.current.runState).length).toBeGreaterThan(0);

    act(() => {
      result.current.clearRunState();
    });
    expect(result.current.runState).toEqual({});
  });

  it("handleRun seeds idle state for delay/condition/display nodes and applies onNodeUpdate callbacks", async () => {
    vi.mocked(chainRunner.runChain).mockImplementation(
      async ({ onUpdate: onNodeUpdate }) => {
        onNodeUpdate("delay-1", "passed", {
          extractedValues: { foo: "bar" },
          response: undefined,
          assertionResults: undefined,
          activeBranchId: "branch-a",
        });
      },
    );

    const { result } = renderHook(() =>
      useChainRun({
        chainId: CHAIN_ID,
        chainRequests: requests,
        edges,
        delayNodes: [
          { id: "delay-1", type: "delay", delayMs: 100 },
        ],
        conditionNodes: [
          {
            id: "cond-1",
            type: "condition",
            variable: "{{role}}",
            branches: [{ id: "else", label: "else", expression: "" }],
          },
        ],
        displayNodes: [
          {
            id: "display-1",
            type: "display",
            sourceJsonPath: "$.data.token",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
        evaluateNodes: [
          { id: "eval-1", type: "evaluate", outputAlias: "out", code: "" },
        ],
        validateNodes: [
          {
            id: "val-1",
            type: "validate",
            sourceJsonPath: "$",
            schema: "{}",
          },
        ],
        onPromoteToEnv: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleRun();
    });

    // Initial idle seeding for control-flow nodes (covers the delay/condition/display/evaluate/validate loops).
    expect(result.current.runState["cond-1"]).toBeDefined();
    expect(result.current.runState["eval-1"]).toBeDefined();
    expect(result.current.runState["val-1"]).toBeDefined();

    // onNodeUpdate callback applied real data into runState.
    expect(result.current.runState["delay-1"]).toEqual({
      state: "passed",
      extractedValues: { foo: "bar" },
      response: undefined,
      assertionResults: undefined,
      activeBranchId: "branch-a",
    });
  });

  it("runSliced includes delay/condition/display nodes in the sliced subset and applies onNodeUpdate", async () => {
    vi.mocked(chainRunner.runChain).mockImplementation(
      async ({ onUpdate: onNodeUpdate }) => {
        onNodeUpdate("cf-delay", "passed", {
          extractedValues: {},
          response: undefined,
        });
      },
    );

    const { result } = renderHook(() =>
      useChainRun({
        chainId: CHAIN_ID,
        chainRequests: requests,
        edges,
        delayNodes: [{ id: "cf-delay", type: "delay", delayMs: 50 }],
        conditionNodes: [
          {
            id: "cf-cond",
            type: "condition",
            variable: "{{role}}",
            branches: [{ id: "else", label: "else", expression: "" }],
          },
        ],
        displayNodes: [
          {
            id: "cf-display",
            type: "display",
            sourceJsonPath: "$.data.token",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
        evaluateNodes: [
          { id: "cf-eval", type: "evaluate", outputAlias: "out", code: "" },
        ],
        validateNodes: [
          {
            id: "cf-val",
            type: "validate",
            sourceJsonPath: "$",
            schema: "{}",
          },
        ],
        mergeNodes: [{ id: "cf-merge", type: "merge", mode: "all" }],
        loopNodes: [
          {
            id: "cf-loop",
            type: "loop",
            itemAlias: "item",
            maxIterations: 10,
            sourceJsonPath: "$",
          },
        ],
        collectNodes: [{ id: "cf-collect", type: "collect", loopId: "cf-loop" }],
        subChainNodes: [
          {
            id: "cf-subchain",
            type: "subchain",
            chainId: "other-chain",
            inputBindings: {},
          },
        ],
        onPromoteToEnv: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleRunUpTo("req-2");
    });

    const [{ requests: subsetRequests }] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(subsetRequests.map((r) => r.id)).toEqual(["req-1", "req-2"]);
    expect(result.current.runState["cf-delay"]?.state).toBe("passed");
  });

  it("handleRunUpTo is a no-op when the requested node is not part of the execution order", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("nonexistent-node");
    });

    expect(chainRunner.runChain).not.toHaveBeenCalled();
  });

  it("handleRunSingleNode applies onNodeUpdate data into runState on success", async () => {
    vi.mocked(chainRunner.runChain).mockImplementation(
      async ({ onUpdate: onNodeUpdate }) => {
        onNodeUpdate("req-1", "passed", {
          extractedValues: { x: "y" },
          response: undefined,
        });
      },
    );

    const { result } = setup();

    await act(async () => {
      await result.current.handleRunSingleNode("req-1");
    });

    expect(result.current.runState["req-1"]).toEqual({
      state: "passed",
      extractedValues: { x: "y" },
      response: undefined,
    });
  });

  it("handleRunSingleNode records assertionResults and activeBranchId through the shared onUpdate", async () => {
    const assertionResults = [
      { assertionId: "a1", passed: true, actual: "200" },
    ];
    vi.mocked(chainRunner.runChain).mockImplementation(
      async ({ onUpdate }) => {
        onUpdate("req-1", "passed", { assertionResults, activeBranchId: "b1" });
      },
    );

    const { result } = setup();

    await act(async () => {
      await result.current.handleRunSingleNode("req-1");
    });

    expect(result.current.runState["req-1"]?.assertionResults).toEqual(
      assertionResults,
    );
    expect(result.current.runState["req-1"]?.activeBranchId).toBe("b1");
  });

  it("handleRunSingleNode does nothing when the request cannot be found", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunSingleNode("unknown-request");
    });

    expect(chainRunner.runChain).not.toHaveBeenCalled();
    expect(result.current.runState["unknown-request"]).toBeUndefined();
  });

  it("handleRunSingleNode marks the node failed and logs when runChain rejects", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(chainRunner.runChain).mockRejectedValueOnce(
      new Error("boom"),
    );

    const { result } = setup();

    await act(async () => {
      await result.current.handleRunSingleNode("req-1");
    });

    expect(result.current.runState["req-1"]?.state).toBe("failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to run single node",
      expect.any(Error),
    );
  });

  it("handleStop aborts the in-flight run's controller", async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolveRun: () => void = () => {};
    vi.mocked(chainRunner.runChain).mockImplementation(
      ({ signal }) => {
        capturedSignal = signal;
        return new Promise((resolve) => {
          resolveRun = () => resolve(undefined);
        });
      },
    );

    const { result } = setup();

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.handleRun();
    });

    await waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.handleStop();
    });

    expect(capturedSignal?.aborted).toBe(true);

    resolveRun();
    await act(async () => {
      await runPromise;
    });
  });

  it("execute registers its AbortController with the run store via startRun", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(chainRunner.runChain).mockImplementation(async ({ signal }) => {
      capturedSignal = signal;
    });
    const startRunSpy = vi.spyOn(useChainRunStore.getState(), "startRun");
    useChainRunStore.setState({ startRun: startRunSpy });

    const { result } = setup();
    await act(async () => {
      await result.current.handleRun();
    });

    const controller = startRunSpy.mock.calls[0][2]?.abortController;
    expect(controller).toBeInstanceOf(AbortController);
    expect(controller?.signal).toBe(capturedSignal);
  });

  it("deleting the chain mid-run aborts the run without an error toast", async () => {
    const { toast } = await import("sonner");
    // Earlier tests leave calls on the shared mock; isolate this assertion.
    vi.mocked(toast.error).mockClear();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(chainRunner.runChain).mockImplementation(
      ({ signal }) =>
        new Promise((resolve) => {
          capturedSignal = signal;
          signal?.addEventListener("abort", () => resolve(undefined));
        }),
    );

    const { result } = setup();
    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.handleRun();
    });
    await waitFor(() => expect(capturedSignal).toBeDefined());

    await act(async () => {
      await useChainRunStore.getState().handleChainDeleted(CHAIN_ID);
      await runPromise;
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    expect(useChainRunStore.getState().activeRun).toBeNull();
  });

  it("ignores a second handleRun call while a run is already in progress", async () => {
    let resolveFirst: () => void = () => {};
    vi.mocked(chainRunner.runChain).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = () => resolve(undefined);
        }),
    );

    const { result } = setup();

    let firstRunPromise!: Promise<void>;
    act(() => {
      firstRunPromise = result.current.handleRun();
    });

    await waitFor(() => expect(result.current.isRunning).toBe(true));

    await act(async () => {
      await result.current.handleRun();
    });

    expect(chainRunner.runChain).toHaveBeenCalledTimes(1);

    resolveFirst();
    await act(async () => {
      await firstRunPromise;
    });
  });

  it("handleStop aborts a single-node run", async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolveRun: () => void = () => {};
    vi.mocked(chainRunner.runChain).mockImplementation(
      ({ signal }) => {
        capturedSignal = signal;
        return new Promise((resolve) => {
          resolveRun = () => resolve(undefined);
        });
      },
    );

    const { result } = setup();

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.handleRunSingleNode("req-1");
    });

    await waitFor(() => expect(capturedSignal).toBeDefined());
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.handleStop();
    });

    expect(capturedSignal?.aborted).toBe(true);

    resolveRun();
    await act(async () => {
      await runPromise;
    });
  });

  it("handleStop aborts an in-flight subset run (fake timers)", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(chainRunner.runChain).mockImplementation(
      ({ signal }) => {
        capturedSignal = signal;
        return new Promise((resolve) => {
          setTimeout(() => resolve(undefined), 5000);
        });
      },
    );

    const { result } = setup();

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.handleRunUpTo("req-2");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.handleStop();
    });

    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      await runPromise;
    });

    vi.useRealTimers();
  });

  it("handleRunSubset passes signal to runChain", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("req-2");
    });

    const [callArgs] = vi.mocked(chainRunner.runChain).mock.calls[0];
    expect(callArgs.signal).toEqual(expect.any(AbortSignal));
  });

  it("handleRunSingleNode sets isRunning and clears abortRef in finally", async () => {
    vi.mocked(chainRunner.runChain).mockResolvedValueOnce(undefined);

    const { result } = setup();

    expect(result.current.isRunning).toBe(false);

    await act(async () => {
      await result.current.handleRunSingleNode("req-1");
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("handleRun writes a complete RunSummary to the run store, keyed by chainId and trigger 'full'", async () => {
    vi.mocked(chainRunner.runChain).mockImplementation(
      async ({ onUpdate: onNodeUpdate }) => {
        onNodeUpdate("req-1", "passed", {
          extractedValues: { x: "y" },
          response: undefined,
        });
      },
    );

    const { result } = setup();

    await act(async () => {
      await result.current.handleRun();
    });

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs).toHaveLength(1);
    expect(runs[0].trigger).toBe("full");
    expect(runs[0].status).toBe("passed");
    expect(runs[0].steps).toHaveLength(1);
    expect(runs[0].steps[0]).toMatchObject({
      nodeId: "req-1",
      nodeType: "api",
      state: "passed",
      extractedValues: { x: "y" },
    });
    expect(useChainRunStore.getState().activeRun).toBeNull();
  });

  it("handleRunUpTo writes a run with trigger 'upTo'", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("req-2");
    });

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs).toHaveLength(1);
    expect(runs[0].trigger).toBe("upTo");
  });

  it("handleRunFromHere writes a run with trigger 'fromHere'", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunFromHere("req-2");
    });

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs).toHaveLength(1);
    expect(runs[0].trigger).toBe("fromHere");
  });

  it("handleRunSingleNode writes a run with trigger 'single'", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.handleRunSingleNode("req-1");
    });

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs).toHaveLength(1);
    expect(runs[0].trigger).toBe("single");
  });

  it("marks the run 'failed' when any node fails", async () => {
    vi.mocked(chainRunner.runChain).mockImplementation(
      async ({ onUpdate: onNodeUpdate }) => {
        onNodeUpdate("req-1", "failed", { error: "boom" });
      },
    );

    const { result } = setup();

    await act(async () => {
      await result.current.handleRun();
    });

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs[0].status).toBe("failed");
    expect(runs[0].counts.failed).toBe(1);
  });

  it.each([
    [
      "a circular dependency",
      () => new chainRunner.CircularDependencyError(["req-1", "req-2"]),
      "This chain has a circular dependency. Remove the cycle to run.",
    ],
    [
      "SchedulerDepthExceededError",
      () => new chainRunner.SchedulerDepthExceededError(),
      "The run failed unexpectedly. Check the run log for details.",
    ],
  ])(
    "records a run that throws %s as 'failed', toasts, and does not reject",
    async (_label, makeError, message) => {
      const { toast } = await import("sonner");
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(chainRunner.runChain).mockRejectedValueOnce(makeError());

      const { result } = setup();

      await act(async () => {
        await result.current.handleRun();
      });

      expect(useChainRunStore.getState().runs[CHAIN_ID][0].status).toBe(
        "failed",
      );
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(message);
      expect(result.current.isRunning).toBe(false);
    },
  );

  it("records a thrown error from handleRunUpTo as 'failed' instead of propagating", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(chainRunner.runChain).mockRejectedValueOnce(new Error("boom"));

    const { result } = setup();

    await act(async () => {
      await result.current.handleRunUpTo("req-2");
    });

    expect(useChainRunStore.getState().runs[CHAIN_ID][0].status).toBe("failed");
  });

  it("marks the run 'stopped' when aborted mid-run", async () => {
    let resolveRun: () => void = () => {};
    vi.mocked(chainRunner.runChain).mockImplementation(
      ({ signal }) => {
        return new Promise((resolve) => {
          resolveRun = () => resolve(undefined);
        });
      },
    );

    const { result } = setup();

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.handleRun();
    });

    await waitFor(() => expect(result.current.isRunning).toBe(true));

    act(() => {
      result.current.handleStop();
    });

    resolveRun();
    await act(async () => {
      await runPromise;
    });

    const runs = useChainRunStore.getState().runs[CHAIN_ID];
    expect(runs[0].status).toBe("stopped");
  });

  describe("sub-chain wiring (P9.8)", () => {
    const REFERENCED_CHAIN_ID = "chain-referenced";

    afterEach(() => {
      useChainStore.setState({ chains: {} });
      useCollectionsStore.setState({ requests: [] });
    });

    it("dispatches a subchain node and resolves the referenced chain's graph from the store", async () => {
      const referencedRequest = makeRequest("ref-req-1");
      useCollectionsStore.setState({ requests: [referencedRequest] });
      useChainStore.setState({
        chains: {
          [REFERENCED_CHAIN_ID]: {
            id: REFERENCED_CHAIN_ID,
            scope: "collection",
            schemaVersion: 5,
            name: "Referenced chain",
            blocks: [],
            nodeIds: [referencedRequest.id],
            edges: [],
            nodePositions: {},
          },
        },
      });

      const subChainNodes: SubChainBlock[] = [
        {
          id: "sub-1",
          type: "subchain",
          chainId: REFERENCED_CHAIN_ID,
          inputBindings: {},
        },
      ];

      const { result } = renderHook(() =>
        useChainRun({
          chainId: CHAIN_ID,
          chainRequests: requests,
          edges,
          delayNodes: [],
          conditionNodes: [],
          displayNodes: [],
          subChainNodes,
          onPromoteToEnv: vi.fn(),
        }),
      );

      await act(async () => {
        await result.current.handleRun();
      });

      const [call] = vi.mocked(chainRunner.runChain).mock.calls[0];
      expect(call.subChainBlocks).toEqual(subChainNodes);
      const resolveSubChainGraph = call.resolveSubChainGraph as (
        chainId: string,
      ) => { requests: RequestModel[] } | undefined;
      expect(typeof resolveSubChainGraph).toBe("function");

      const resolved = resolveSubChainGraph(REFERENCED_CHAIN_ID);
      expect(resolved?.requests).toEqual([referencedRequest]);
    });

    it("resolveSubChainGraph exposes the referenced chain's own Sub-chain blocks so nesting can continue", async () => {
      const nestedBlock: SubChainBlock = {
        id: "nested-sub",
        type: "subchain",
        chainId: "chain-c",
        inputBindings: {},
      };
      useChainStore.setState({
        chains: {
          [REFERENCED_CHAIN_ID]: {
            id: REFERENCED_CHAIN_ID,
            scope: "collection",
            schemaVersion: 5,
            name: "B",
            blocks: [nestedBlock],
            nodeIds: [],
            edges: [],
            nodePositions: {},
          },
        },
      });

      const { result } = setup();
      await act(async () => {
        await result.current.handleRun();
      });

      const [call] = vi.mocked(chainRunner.runChain).mock.calls[0];
      const resolved = call.resolveSubChainGraph?.(REFERENCED_CHAIN_ID);
      expect(resolved?.subChainBlocks).toEqual([nestedBlock]);
    });

    it("labels steps nested two Sub-chains deep from the innermost referenced chain, with unique ids", async () => {
      const hostSub: SubChainBlock = {
        id: "host-sub",
        type: "subchain",
        chainId: "chain-b",
        inputBindings: {},
      };
      const innerSub: SubChainBlock = {
        id: "inner-sub",
        type: "subchain",
        chainId: "chain-c",
        inputBindings: {},
      };
      const deepRequest = { ...makeRequest("deep-req"), name: "Deep request" };
      useCollectionsStore.setState({ requests: [deepRequest] });
      const chainDoc = (id: string, blocks: SubChainBlock[], nodeIds: string[]): Chain => ({
        id,
        scope: "collection" as const,
        schemaVersion: CHAIN_SCHEMA_VERSION,
        name: id,
        blocks,
        nodeIds,
        edges: [],
        nodePositions: {},
      });
      useChainStore.setState({
        chains: {
          "chain-b": chainDoc("chain-b", [innerSub], []),
          "chain-c": chainDoc("chain-c", [], ["deep-req"]),
        },
      });
      vi.mocked(chainRunner.runChain).mockImplementation(async (opts) => {
        opts.onUpdate("deep-req", "passed", {
          parentStepId: "inner-sub",
          scope: [{ parentStepId: "inner-sub" }, { parentStepId: "host-sub" }],
        });
      });

      const { result } = renderHook(() =>
        useChainRun({
          chainId: CHAIN_ID,
          chainRequests: requests,
          edges,
          delayNodes: [],
          conditionNodes: [],
          displayNodes: [],
          subChainNodes: [hostSub],
          onPromoteToEnv: vi.fn(),
        }),
      );
      await act(async () => {
        await result.current.handleRun();
      });

      const [step] = useChainRunStore.getState().runs[CHAIN_ID][0].steps;
      expect(step.label).toBe("Deep request");
      expect(step.id).toBe("deep-req::inner-sub::host-sub");
      expect(step.parentStepId).toBe("inner-sub::host-sub");
    });

    it("resolveSubChainGraph returns undefined for a deleted/unresolvable chain reference", async () => {
      const subChainNodes: SubChainBlock[] = [
        {
          id: "sub-1",
          type: "subchain",
          chainId: "does-not-exist",
          inputBindings: {},
        },
      ];

      const { result } = renderHook(() =>
        useChainRun({
          chainId: CHAIN_ID,
          chainRequests: requests,
          edges,
          delayNodes: [],
          conditionNodes: [],
          displayNodes: [],
          subChainNodes,
          onPromoteToEnv: vi.fn(),
        }),
      );

      await act(async () => {
        await result.current.handleRun();
      });

      const [call] = vi.mocked(chainRunner.runChain).mock.calls[0];
      const resolveSubChainGraph = call.resolveSubChainGraph as (
        chainId: string,
      ) => unknown;
      expect(resolveSubChainGraph("does-not-exist")).toBeUndefined();
    });
  });

  it("does not leak step start times across runs (skipped node in run 2 starts in run 2)", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      vi.mocked(chainRunner.runChain).mockImplementationOnce(async (opts) => {
        opts.onUpdate("req-1", "running", {});
        opts.onUpdate("req-1", "passed", {});
      });
      const { result } = setup();
      await act(async () => {
        await result.current.handleRun();
      });

      vi.setSystemTime(1_000_000);
      vi.mocked(chainRunner.runChain).mockImplementationOnce(async (opts) => {
        // Skipped nodes never emit "running".
        opts.onUpdate("req-1", "skipped", {});
      });
      await act(async () => {
        await result.current.handleRun();
      });

      const runs = useChainRunStore.getState().runs[CHAIN_ID];
      const latest = runs.reduce((a, b) => (b.startedAt > a.startedAt ? b : a));
      const skipped = latest.steps.find((step) => step.nodeId === "req-1");
      expect(skipped?.startedAt).toBe(1_000_000);
      expect(skipped?.durationMs).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("threads the active environment's variables into every run entry point", async () => {
    useEnvironmentsStore.setState({
      activeEnvId: "env-1",
      environments: [
        {
          id: "env-1",
          name: "Dev",
          variables: [
            {
              id: "v1",
              key: "TOKEN",
              initialValue: "init",
              currentValue: "live",
              isSecret: false,
            },
          ],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    });
    const { result } = setup();

    await act(async () => {
      await result.current.handleRun();
    });
    await act(async () => {
      await result.current.handleRunSingleNode("req-1");
    });

    const calls = vi.mocked(chainRunner.runChain).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [call] of calls) {
      expect(call.envVars).toEqual({ TOKEN: "live" });
    }
    useEnvironmentsStore.setState({ activeEnvId: null, environments: [] });
  });
});
