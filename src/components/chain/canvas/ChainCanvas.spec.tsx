/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import { ChainCanvas } from "./ChainCanvas";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@xyflow/react", () => {
  const React = require("react") as typeof import("react");
  const fitView = () => {};
  const screenToFlowPosition = (p: { x: number; y: number }) => ({
    x: p.x,
    y: p.y,
  });
  return {
    BackgroundVariant: { Dots: "dots", Lines: "lines", Cross: "cross" },
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useReactFlow: () => ({ fitView, screenToFlowPosition }),
    ReactFlow: ({
      nodes,
      onConnect,
      children,
    }: {
      nodes: Array<{
        id: string;
        type?: string;
        data?: {
          requestId?: string;
          onClickNode?: (id: string) => void;
          name?: string;
        };
      }>;
      onConnect?: (c: {
        source: string;
        target: string;
        sourceHandle?: string | null;
      }) => void;
      children?: ReactNode;
    }) => (
      <div data-testid="mock-react-flow">
        {nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            data-testid={`rf-node-${n.id}`}
            onClick={() => {
              if (
                n.type === "chainNode" &&
                n.data?.onClickNode &&
                n.data.requestId
              ) {
                n.data.onClickNode(n.data.requestId);
              }
            }}
          >
            {n.data?.name ?? n.id}
          </button>
        ))}
        <button
          type="button"
          data-testid="rf-connect-default"
          onClick={() =>
            onConnect?.({
              source: "req-1",
              target: "req-2",
              sourceHandle: null,
            })
          }
        >
          Connect default
        </button>
        <button
          type="button"
          data-testid="rf-connect-success"
          onClick={() =>
            onConnect?.({
              source: "req-1",
              target: "req-2",
              sourceHandle: "success",
            })
          }
        >
          Connect success
        </button>
        {children}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Panel: ({ children }: { children?: ReactNode }) => (
      <div data-testid="rf-panel">{children}</div>
    ),
    useNodesState: (initial: unknown) => {
      const [nodes, setNodes] = React.useState(initial);
      const onNodesChange = React.useCallback(() => {}, []);
      return [nodes, setNodes, onNodesChange];
    },
    useEdgesState: (initial: unknown) => {
      const [edges, setEdges] = React.useState(initial);
      const onEdgesChange = React.useCallback(() => {}, []);
      return [edges, setEdges, onEdgesChange];
    },
    addEdge: (params: Record<string, unknown>, eds: unknown[]) => [
      ...eds,
      params,
    ],
  };
});

const COL = "col-1";

function req(id: string, name: string): RequestModel {
  return {
    id,
    collectionId: COL,
    name,
    method: "GET",
    url: `https://example.test/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
  };
}

const defaultCallbacks = {
  chainId: "chain-1",
  onAddApiClick: vi.fn(),
  onDeleteNode: vi.fn(),
  onUpsertEdge: vi.fn(),
  onDeleteEdge: vi.fn(),
  onUpdateNodePosition: vi.fn(),
  onUpsertNodeAssertions: vi.fn(),
  onRunUpTo: vi.fn(),
  onRunFromHere: vi.fn(),
  onAddAfterNode: vi.fn(),
  onUpsertDelayNode: vi.fn(),
  onUpsertConditionNode: vi.fn(),
  onRemoveConditionNode: vi.fn(),
  onUpsertDisplayNode: vi.fn(),
  startBlock: null,
  onUpsertStartBlock: vi.fn(),
  onRemoveStartBlock: vi.fn(),
  onSaveRequest: vi.fn(),
  resolveVariables: (text: string) => text,
  evaluateNodes: [],
  onUpsertEvaluateNode: vi.fn(),
  validateNodes: [],
  onUpsertValidateNode: vi.fn(),
  mergeNodes: [],
  onUpsertMergeNode: vi.fn(),
  loopNodes: [],
  onUpsertLoopNode: vi.fn(),
  collectNodes: [],
  onUpsertCollectNode: vi.fn(),
  subChainNodes: [],
  onUpsertSubChainNode: vi.fn(),
};

describe("ChainCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a control node for each API request from the store props", () => {
    render(
      <ChainCanvas
        requests={[req("req-1", "Alpha"), req("req-2", "Beta")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
      />,
    );

    expect(screen.getByTestId("rf-node-req-1").textContent).toContain("Alpha");
    expect(screen.getByTestId("rf-node-req-2").textContent).toContain("Beta");
  });

  it("opens node details when an API node is activated", async () => {
    render(
      <ChainCanvas
        requests={[req("req-1", "Alpha")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
      />,
    );

    fireEvent.click(screen.getByTestId("rf-node-req-1"));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /details/i })).toBeTruthy();
    });
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
  });

  it("calls onUpsertEdge when the canvas completes a default API-to-API connection", () => {
    const onUpsertEdge = vi.fn();
    render(
      <ChainCanvas
        requests={[req("req-1", "A"), req("req-2", "B")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
        onUpsertEdge={onUpsertEdge}
      />,
    );

    fireEvent.click(screen.getByTestId("rf-connect-default"));

    expect(onUpsertEdge).toHaveBeenCalledTimes(1);
    expect(onUpsertEdge.mock.calls[0][0]).toMatchObject({
      sourceRequestId: "req-1",
      targetRequestId: "req-2",
      injections: [],
      branchId: undefined,
    });
  });

  it("calls onUpsertEdge with success branch when connecting from the success handle", () => {
    const onUpsertEdge = vi.fn();
    render(
      <ChainCanvas
        requests={[req("req-1", "A"), req("req-2", "B")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
        onUpsertEdge={onUpsertEdge}
      />,
    );

    fireEvent.click(screen.getByTestId("rf-connect-success"));

    expect(onUpsertEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRequestId: "req-1",
        targetRequestId: "req-2",
        branchId: "success",
      }),
    );
  });

  it("invokes onAddApiClick when Block menu selects HTTP Request", async () => {
    const onAddApiClick = vi.fn();
    render(
      <ChainCanvas
        requests={[]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
        onAddApiClick={onAddApiClick}
      />,
    );

    fireEvent.click(screen.getByTestId("block-menu-trigger"));
    fireEvent.click(screen.getByRole("button", { name: /http request/i }));

    await waitFor(() => {
      expect(onAddApiClick).toHaveBeenCalled();
    });
  });

  it("shows the canvas empty state when there are no nodes and wires both buttons", () => {
    const onAddApiClick = vi.fn();
    render(
      <ChainCanvas
        requests={[]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
        onAddApiClick={onAddApiClick}
      />,
    );

    expect(screen.getByTestId("canvas-empty-state")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /add from collection/i }),
    );
    expect(onAddApiClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^add block$/i }));
    expect(screen.getByTestId("block-menu-trigger")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("hides the canvas empty state once a node exists", () => {
    render(
      <ChainCanvas
        requests={[req("req-1", "R1")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
      />,
    );

    expect(screen.queryByTestId("canvas-empty-state")).not.toBeInTheDocument();
  });

  it("closes node details when Escape is pressed on the canvas", async () => {
    const { container } = render(
      <ChainCanvas
        requests={[req("req-1", "Alpha")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
      />,
    );

    fireEvent.click(screen.getByTestId("rf-node-req-1"));
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /details/i })).toBeTruthy();
    });

    // Sheet open marks the canvas as aria-hidden; query the DOM node directly.
    const canvas = container.querySelector(
      '[aria-label="Request chain canvas. Use arrow keys to move between nodes, Enter to open details or configure, Escape to clear selection."]',
    );
    expect(canvas).toBeTruthy();
    fireEvent.keyDown(canvas as HTMLElement, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: /details/i })).toBeNull();
    });
  });

  it("disables the Block menu trigger while a chain run is in progress", () => {
    render(
      <ChainCanvas
        requests={[req("req-1", "A")]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning
        delayNodes={[]}
        conditionNodes={[]}
        displayNodes={[]}
        {...defaultCallbacks}
      />,
    );

    const blockBtn = screen.getByRole("button", { name: /block/i });
    expect(blockBtn).toMatchObject({ disabled: true });
  });
});
