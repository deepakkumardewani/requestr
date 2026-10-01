/** @vitest-environment happy-dom */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useChainStore } from "@/stores/useChainStore";
import type { RequestModel } from "@/types";
import type { ChainEdge } from "@/types/chain";
import { useChainNodes } from "./useChainNodes";

// The global next-intl mock returns a fresh `t` each render, which would make the
// real hook's callback (a memo dependency) unstable and re-render forever.
vi.mock("@/hooks/useChainErrorMessage", () => {
  const chainErrorMessage = (
    _code: string | undefined,
    _params: unknown,
    fallback = "",
  ) => fallback;
  return { useChainErrorMessage: () => chainErrorMessage };
});

// Explicit imports (no vitest globals) mean testing-library's auto-cleanup
// detection doesn't fire — without this, hooks rendered in earlier tests stay
// mounted and subscribed to the real useChainStore, so a later test's
// `setState` re-renders every stale instance too.
afterEach(cleanup);

const COL = "col-1";

function req(overrides: Partial<RequestModel> = {}): RequestModel {
  return {
    id: "req-1",
    collectionId: COL,
    name: "Get user",
    method: "GET",
    url: "https://example.test/{{userId}}",
    params: [{ id: "p1", key: "limit", value: "10", enabled: true }],
    headers: [
      { id: "h1", key: "Authorization", value: "Bearer {{token}}", enabled: true },
    ],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const noop = () => {};

describe("useChainNodes — variable footer wiring", () => {
  it("derives the node's referenced and resolved variable names from its raw fields", () => {
    const { result } = renderHook(() =>
      useChainNodes({
        chainId: "chain-1",
        requests: [req()],
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
        nodePositions: {},
        runState: {},
        keyboardFocusNodeId: null,
        onClickNode: noop,
        onDeleteNode: noop,
        onEditRequest: noop,
        onUpdateDelay: noop,
        onConfigureNode: noop,
        onConfigureEvaluateNode: noop,
        onConfigureValidateNode: noop,
        onConfigureMergeNode: noop,
        onConfigureLoopNode: noop,
        onConfigureCollectNode: noop,
        onConfigureSubChainNode: noop,
        onChangeSubChainReference: noop,
        // Only `userId` resolves right now — `token` does not.
        resolveVariables: (text: string) =>
          text.replace("{{userId}}", "42"),
      }),
    );

    const [node] = result.current.nodes as unknown as {
      data: {
        variableFooterTexts: string[];
        variableFooterResolvedNames: string[];
      };
    }[];

    expect(node.data.variableFooterTexts).toEqual(
      expect.arrayContaining([
        "https://example.test/{{userId}}",
        "Bearer {{token}}",
      ]),
    );
    expect(node.data.variableFooterResolvedNames).toEqual(["userId"]);
  });
});

describe("useChainNodes — pre-run unresolved pill", () => {
  function renderNodes(chainEdges: ChainEdge[], request: RequestModel) {
    const { result } = renderHook(() =>
      useChainNodes({
        chainId: "chain-1",
        requests: [request],
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
        chainEdges,
        nodePositions: {},
        runState: {},
        keyboardFocusNodeId: null,
        onClickNode: noop,
        onDeleteNode: noop,
        onEditRequest: noop,
        onUpdateDelay: noop,
        onConfigureNode: noop,
        onConfigureEvaluateNode: noop,
        onConfigureValidateNode: noop,
        onConfigureMergeNode: noop,
        onConfigureLoopNode: noop,
        onConfigureCollectNode: noop,
        onConfigureSubChainNode: noop,
        onChangeSubChainReference: noop,
        resolveVariables: (text: string) => text,
      }),
    );
    const [node] = result.current.nodes as unknown as {
      data: { unresolvedVars?: string[] };
    }[];
    return node.data.unresolvedVars;
  }

  const upstreamEdge: ChainEdge = {
    id: "e1",
    sourceRequestId: "req-0",
    targetRequestId: "req-1",
    injections: [
      { sourceJsonPath: "$.id", targetField: "url", targetKey: "userId" },
    ],
  };

  it("does not flag a variable an upstream edge will define, but still flags unknown ones", () => {
    expect(renderNodes([upstreamEdge], req())).toEqual(["token"]);
  });

  it("flags every variable when nothing upstream defines it", () => {
    expect(renderNodes([], req())).toEqual(["userId", "token"]);
  });
});

describe("useChainNodes — subchain wiring", () => {
  function baseParams(
    overrides: Partial<Parameters<typeof useChainNodes>[0]> = {},
  ): Parameters<typeof useChainNodes>[0] {
    return {
      chainId: "chain-1",
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
      nodePositions: {},
      runState: {},
      keyboardFocusNodeId: null,
      onClickNode: noop,
      onDeleteNode: noop,
      onEditRequest: noop,
      onUpdateDelay: noop,
      onConfigureNode: noop,
      onConfigureEvaluateNode: noop,
      onConfigureValidateNode: noop,
      onConfigureMergeNode: noop,
      onConfigureLoopNode: noop,
      onConfigureCollectNode: noop,
      onConfigureSubChainNode: noop,
      onChangeSubChainReference: noop,
      resolveVariables: (text: string) => text,
      ...overrides,
    };
  }

  it("labels a sub-chain node with the renamed collection name", () => {
    useCollectionsStore.setState({
      collections: [
        { id: "col-9", name: "Renamed", createdAt: 0, updatedAt: 0 },
      ],
    });
    useChainStore.setState({
      chains: {
        "col-9": {
          id: "col-9",
          scope: "collection",
          schemaVersion: 5,
          collectionId: "col-9",
          name: "Stale",
          createdAt: 0,
          blocks: [],
          nodeIds: [],
          edges: [],
          nodePositions: {},
        },
      },
    });
    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          subChainNodes: [
            { id: "sc-1", type: "subchain", chainId: "col-9", inputBindings: {} },
          ],
        }),
      ),
    );
    const node = result.current.nodes.find((n) => n.id === "sc-1") as unknown as {
      data: { chainName?: string };
    };
    expect(node.data.chainName).toBe("Renamed");
  });

  it("builds a subchainNode with an empty/deleted reference marked invalid", () => {
    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          subChainNodes: [
            { id: "sc-1", type: "subchain", chainId: "", inputBindings: {} },
          ],
        }),
      ),
    );

    const node = result.current.nodes.find((n) => n.id === "sc-1") as unknown as {
      type: string;
      data: { isInvalid?: boolean; chainId: string };
    };

    expect(node.type).toBe("subchainNode");
    expect(node.data.isInvalid).toBe(true);
    expect(node.data.chainId).toBe("");
  });

  it("builds a subchainNode marked invalid on direct self-reference", () => {
    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          chainId: "chain-1",
          subChainNodes: [
            {
              id: "sc-self",
              type: "subchain",
              chainId: "chain-1",
              inputBindings: {},
            },
          ],
        }),
      ),
    );

    const node = result.current.nodes.find(
      (n) => n.id === "sc-self",
    ) as unknown as { data: { isInvalid?: boolean } };

    expect(node.data.isInvalid).toBe(true);
  });

  it("builds a subchainNode marked invalid when the reference transitively loops back", () => {
    // chain-1 (this chain) -> sc-1 references chain-2, which itself contains a
    // subchain block pointing back to chain-1 — a transitive cycle.
    useChainStore.setState({
      chains: {
        "chain-2": {
          id: "chain-2",
          scope: "standalone",
          schemaVersion: 5,
          name: "Chain Two",
          blocks: [
            {
              id: "back-ref",
              type: "subchain",
              chainId: "chain-1",
              inputBindings: {},
            },
          ],
          nodeIds: [],
          edges: [],
          nodePositions: {},
        },
      },
    });

    try {
      const { result } = renderHook(() =>
        useChainNodes(
          baseParams({
            chainId: "chain-1",
            subChainNodes: [
              {
                id: "sc-1",
                type: "subchain",
                chainId: "chain-2",
                inputBindings: {},
              },
            ],
          }),
        ),
      );

      const node = result.current.nodes.find(
        (n) => n.id === "sc-1",
      ) as unknown as { data: { isInvalid?: boolean; chainName?: string } };

      expect(node.data.isInvalid).toBe(true);
      expect(node.data.chainName).toBe("Chain Two");
    } finally {
      useChainStore.setState({ chains: {} });
    }
  });
});

describe("useChainNodes — non-API node builders", () => {
  function baseParams(
    overrides: Partial<Parameters<typeof useChainNodes>[0]> = {},
  ): Parameters<typeof useChainNodes>[0] {
    return {
      chainId: "chain-1",
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
      nodePositions: {},
      runState: {},
      keyboardFocusNodeId: "focus-me",
      onClickNode: noop,
      onDeleteNode: noop,
      onEditRequest: noop,
      onUpdateDelay: noop,
      onConfigureNode: noop,
      onConfigureEvaluateNode: noop,
      onConfigureValidateNode: noop,
      onConfigureMergeNode: noop,
      onConfigureLoopNode: noop,
      onConfigureCollectNode: noop,
      onConfigureSubChainNode: noop,
      onChangeSubChainReference: noop,
      onClickDisplayNode: noop,
      resolveVariables: (text: string) => text,
      ...overrides,
    };
  }

  it("builds delay, condition, evaluate, validate, merge, loop, collect and start nodes with keyboard focus and error state", () => {
    const runState = {
      "focus-me": {
        state: "failed" as const,
        error: "boom",
        extractedValues: {},
      },
    };

    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          delayNodes: [{ id: "focus-me", type: "delay", delayMs: 500 }],
          runState,
        }),
      ),
    );

    const [delayNode] = result.current.nodes as unknown as {
      type: string;
      selected: boolean;
      data: { isKeyboardFocused: boolean; error?: string };
    }[];

    expect(delayNode.type).toBe("delayNode");
    expect(delayNode.selected).toBe(true);
    expect(delayNode.data.isKeyboardFocused).toBe(true);
    expect(delayNode.data.error).toBe("boom");
  });

  it("builds a conditionNode with active branch state", () => {
    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          conditionNodes: [
            {
              id: "cond-1",
              type: "condition",
              variable: "status",
              branches: [{ id: "b1", label: "ok", expression: "== 200" }],
            },
          ],
          runState: {
            "cond-1": {
              state: "passed",
              activeBranchId: "b1",
              extractedValues: {},
            },
          },
        }),
      ),
    );

    const node = result.current.nodes.find(
      (n) => n.id === "cond-1",
    ) as unknown as { data: { activeBranchId?: string } };
    expect(node.data.activeBranchId).toBe("b1");
  });

  it("builds a displayNode that resolves its inbound source response", () => {
    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          requests: [
            {
              id: "req-src",
              collectionId: COL,
              name: "Source",
              method: "GET",
              url: "https://example.test",
              params: [],
              headers: [],
              auth: { type: "none" },
              body: { type: "none", content: "" },
              preScript: "",
              postScript: "",
              createdAt: 1,
              updatedAt: 1,
            },
          ],
          displayNodes: [
            {
              id: "disp-1",
              type: "display",
              sourceJsonPath: "$",
              targetField: "header",
              targetKey: "X-Value",
            },
          ],
          chainEdges: [
            {
              id: "e1",
              sourceRequestId: "req-src",
              targetRequestId: "disp-1",
              injections: [],
            },
          ],
          runState: {
            "req-src": {
              state: "passed",
              extractedValues: {},
              response: {
                status: 200,
                statusText: "OK",
                headers: {},
                body: "",
                duration: 1,
                size: 0,
                url: "https://example.test",
                method: "GET",
                timestamp: 1,
              },
            },
          },
        }),
      ),
    );

    const node = result.current.nodes.find(
      (n) => n.id === "disp-1",
    ) as unknown as { data: { sourceResponse?: { status: number } } };
    expect(node.data.sourceResponse?.status).toBe(200);
  });

  it("builds evaluate, validate, merge, loop and collect nodes", () => {
    const { result } = renderHook(() =>
      useChainNodes(
        baseParams({
          evaluateNodes: [
            { id: "ev-1", type: "evaluate", outputAlias: "out", code: "" },
          ],
          validateNodes: [
            {
              id: "val-1",
              type: "validate",
              sourceJsonPath: "$",
              schema: "{}",
            },
          ],
          mergeNodes: [{ id: "mg-1", type: "merge", mode: "all" }],
          loopNodes: [
            {
              id: "lp-1",
              type: "loop",
              itemAlias: "item",
              maxIterations: 10,
              sourceJsonPath: "$",
            },
          ],
          collectNodes: [{ id: "cl-1", type: "collect", loopId: "lp-1" }],
        }),
      ),
    );

    const types = result.current.nodes.map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "evaluateNode",
        "validateNode",
        "mergeNode",
        "loopNode",
        "collectNode",
      ]),
    );
  });

  it("builds a startNode positioned above the canvas and reuses cached node objects when unrelated deps change", () => {
    const startBlock = { id: "start-1", type: "start" as const, inputs: [] };
    const params = baseParams({ startBlock, keyboardFocusNodeId: null });

    const { result, rerender } = renderHook(
      (p: Parameters<typeof useChainNodes>[0]) => useChainNodes(p),
      { initialProps: params },
    );

    const firstStartNode = result.current.nodes.find(
      (n) => n.id === "start-1",
    );
    expect(firstStartNode?.type).toBe("startNode");

    // Changes keyboardFocusNodeId to an unrelated id — forces the outer
    // useMemo to recompute, but the start block's own per-id deps
    // (nodePositions, runState, focus) are unchanged, so its cache must hit.
    rerender(baseParams({ startBlock, keyboardFocusNodeId: "some-other-id" }));

    const secondStartNode = result.current.nodes.find(
      (n) => n.id === "start-1",
    );
    expect(secondStartNode).toBe(firstStartNode);
  });
});
