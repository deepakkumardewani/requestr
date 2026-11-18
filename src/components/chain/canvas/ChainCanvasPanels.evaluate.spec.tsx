/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainEdge, ChainRunState, EvaluateBlock } from "@/types/chain";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { ChainCanvasPanels } from "./ChainCanvasPanels";

vi.mock("../panels/SubChainConfigPanel", () => ({
  SubChainConfigPanel: ({
    referencedChainName,
    chainEdges,
  }: {
    referencedChainName?: string;
    chainEdges?: { id: string }[];
  }) => (
    <div data-testid="subchain-panel">
      {referencedChainName}
      <span data-testid="subchain-edge-ids">
        {(chainEdges ?? []).map((e) => e.id).join(",")}
      </span>
    </div>
  ),
}));

vi.mock("../panels/EvaluateConfigPanel", () => ({
  EvaluateConfigPanel: ({
    testInput,
    chainBlocks,
    chainEdges,
  }: {
    testInput: unknown;
    chainBlocks?: unknown[];
    chainEdges?: unknown[];
  }) => (
    <div
      data-testid="evaluate-panel"
      data-chain-counts={`${chainBlocks?.length}/${chainEdges?.length}`}
    >
      {JSON.stringify(testInput)}
    </div>
  ),
}));

const runState: ChainRunState = {
  api: {
    state: "passed",
    extractedValues: {},
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: '{"token":"abc"}',
      duration: 0,
      size: 0,
      url: "",
      method: "GET",
      timestamp: 0,
    },
  },
};
const edges = [
  { id: "e1", sourceRequestId: "api", targetRequestId: "eval", injections: [] },
] as ChainEdge[];
const evaluateNode: EvaluateBlock = {
  id: "eval",
  type: "evaluate",
  code: "return 1",
  outputAlias: "out",
};

afterEach(cleanup);

describe("ChainCanvasPanels evaluate wiring", () => {
  it("passes last-run data for the node's incoming edges to the Evaluate panel", async () => {
    const props = {
      contextMenu: null,
      requests: [],
      chainEdges: edges,
      runState,
      blocks: [evaluateNode],
      panelIds: {
        condition: null,
        start: null,
        evaluate: "eval",
        validate: null,
        merge: null,
        loop: null,
        collect: null,
        subchain: null,
      },
      arrowPanel: { open: false, edgeId: null, displayNodeId: null },
    } as unknown as Parameters<typeof ChainCanvasPanels>[0];

    render(<ChainCanvasPanels {...props} />);

    const panel = await screen.findByTestId("evaluate-panel");
    expect(JSON.parse(panel.textContent ?? "")).toEqual({
      data: { response: { token: "abc" } },
      inputs: {},
      env: {},
    });
  });
});

describe("ChainCanvasPanels evaluate alias wiring", () => {
  it("passes the whole chain's blocks and edges to the Evaluate panel", async () => {
    const props = {
      contextMenu: null,
      requests: [],
      chainEdges: edges,
      runState,
      blocks: [evaluateNode],
      panelIds: {
        condition: null,
        start: null,
        evaluate: "eval",
        validate: null,
        merge: null,
        loop: null,
        collect: null,
        subchain: null,
      },
      arrowPanel: { open: false, edgeId: null, displayNodeId: null },
    } as unknown as Parameters<typeof ChainCanvasPanels>[0];

    render(<ChainCanvasPanels {...props} />);

    expect(await screen.findByTestId("evaluate-panel")).toHaveAttribute(
      "data-chain-counts",
      "1/1",
    );
  });
});

describe("ChainCanvasPanels sub-chain wiring", () => {
  it("passes every host-chain edge (not only incoming) to the sub-chain panel", async () => {
    const hostEdges = [
      { id: "up", sourceRequestId: "a", targetRequestId: "b", injections: [] },
      { id: "in", sourceRequestId: "b", targetRequestId: "sc-1", injections: [] },
    ] as ChainEdge[];
    const props = {
      contextMenu: null,
      requests: [],
      chainEdges: hostEdges,
      runState: {},
      blocks: [
        { id: "sc-1", type: "subchain", chainId: "col-9", inputBindings: {} },
      ],
      panelIds: {
        condition: null,
        start: null,
        evaluate: null,
        validate: null,
        merge: null,
        loop: null,
        collect: null,
        subchain: "sc-1",
      },
      arrowPanel: { open: false, edgeId: null, displayNodeId: null },
    } as unknown as Parameters<typeof ChainCanvasPanels>[0];

    render(<ChainCanvasPanels {...props} />);

    expect(await screen.findByTestId("subchain-edge-ids")).toHaveTextContent(
      "up,in",
    );
  });

  it("shows the renamed collection name for a referenced collection chain", async () => {
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
    const props = {
      contextMenu: null,
      requests: [],
      chainEdges: [],
      runState: {},
      blocks: [
        { id: "sc-1", type: "subchain", chainId: "col-9", inputBindings: {} },
      ],
      panelIds: {
        condition: null,
        start: null,
        evaluate: null,
        validate: null,
        merge: null,
        loop: null,
        collect: null,
        subchain: "sc-1",
      },
      arrowPanel: { open: false, edgeId: null, displayNodeId: null },
    } as unknown as Parameters<typeof ChainCanvasPanels>[0];

    render(<ChainCanvasPanels {...props} />);

    expect(await screen.findByTestId("subchain-panel")).toHaveTextContent(
      "Renamed",
    );
  });
});
