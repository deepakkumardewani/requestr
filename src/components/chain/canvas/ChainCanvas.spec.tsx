/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import { useChainStore } from "@/stores/useChainStore";
import type { Chain, ChainBlock, CollectBlock, LoopBlock } from "@/types/chain";
import { ChainCanvas } from "./ChainCanvas";

// The global next-intl mock returns a fresh `t` each render; the real hook's
// callback is a memo dependency, so keep it referentially stable here.
vi.mock("@/hooks/useChainErrorMessage", () => {
  const chainErrorMessage = (
    _code: string | undefined,
    _params: unknown,
    fallback = "",
  ) => fallback;
  return { useChainErrorMessage: () => chainErrorMessage };
});

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));

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
    ReactFlowProvider: ({ children }: { children?: ReactNode }) => children,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useReactFlow: () => ({ fitView, screenToFlowPosition }),
    ReactFlow: ({
      nodes,
      onConnect,
      onNodeContextMenu,
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
      onNodeContextMenu?: (
        e: ReactMouseEvent,
        node: { id: string },
      ) => void;
      children?: ReactNode;
    }) => (
      <div data-testid="mock-react-flow">
        {nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            data-testid={`rf-node-${n.id}`}
            onContextMenu={(e) => onNodeContextMenu?.(e, n)}
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
  onRemoveConditionNode: vi.fn(),
  onRemoveStartBlock: vi.fn(),
  onSaveRequest: vi.fn(),
  resolveVariables: (text: string) => text,
  blocks: [] as ChainBlock[],
  onUpsertBlock: vi.fn(),
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
        {...defaultCallbacks}
      />,
    );

    const blockBtn = screen.getByRole("button", { name: /block/i });
    expect(blockBtn).toMatchObject({ disabled: true });
  });

  it("context-menu Duplicate on a Loop routes to the store and creates a Loop + Collect pair", async () => {
    const loop: LoopBlock = {
      id: "loop-1",
      type: "loop",
      sourceJsonPath: "$.items",
      itemAlias: "item",
      maxIterations: 10,
    };
    const collect: CollectBlock = {
      id: "collect-1",
      type: "collect",
      loopId: "loop-1",
    };
    const chain: Chain = {
      id: "chain-1",
      scope: "standalone",
      schemaVersion: 5,
      name: "Chain",
      createdAt: 0,
      blocks: [loop, collect],
      nodeIds: [],
      edges: [],
      nodePositions: {},
    };
    useChainStore.setState({
      chains: { "chain-1": chain },
      hydrated: true,
      history: {},
    });

    render(
      <ChainCanvas
        requests={[]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        {...defaultCallbacks}
        blocks={[loop, collect]}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("rf-node-loop-1"));
    fireEvent.click(await screen.findByRole("menuitem", { name: /duplicate/i }));

    const blocks = useChainStore.getState().chains["chain-1"].blocks;
    expect(blocks).toHaveLength(4);
    const newLoop = blocks.find((b) => b.type === "loop" && b.id !== "loop-1");
    const newCollect = blocks.find(
      (b) => b.type === "collect" && b.id !== "collect-1",
    );
    expect(newCollect).toMatchObject({ loopId: newLoop?.id });
  });

  describe("keyboard shortcuts", () => {
    const LOOP: LoopBlock = {
      id: "loop-1",
      type: "loop",
      sourceJsonPath: "$.items",
      itemAlias: "item",
      maxIterations: 10,
    };
    const COLLECT: CollectBlock = {
      id: "collect-1",
      type: "collect",
      loopId: "loop-1",
    };

    function renderCanvas(extra: Record<string, unknown> = {}) {
      return render(
        <>
          <button type="button" data-testid="outside-focus">
            outside
          </button>
          <ChainCanvas
            requests={[]}
            edges={[]}
            nodePositions={{}}
            nodeAssertions={{}}
            runState={{}}
            isRunning={false}
            {...defaultCallbacks}
            blocks={[LOOP, COLLECT]}
            {...extra}
          />
        </>,
      );
    }

    function seedChain() {
      useChainStore.setState({
        chains: {
          "chain-1": {
            id: "chain-1",
            scope: "standalone",
            schemaVersion: 5,
            name: "Chain",
            createdAt: 0,
            blocks: [LOOP, COLLECT],
            nodeIds: [],
            edges: [],
            nodePositions: {},
          },
        },
        hydrated: true,
        history: {},
      });
    }

    it("runs and stops via Cmd+Enter / Cmd+. only while the canvas has focus", () => {
      const onRunChain = vi.fn();
      const onStopChain = vi.fn();
      renderCanvas({ onRunChain, onStopChain });

      fireEvent.keyDown(window, { key: "Enter", metaKey: true });
      expect(onRunChain).not.toHaveBeenCalled();

      act(() => screen.getByRole("application").focus());
      fireEvent.keyDown(window, { key: "Enter", metaKey: true });
      fireEvent.keyDown(window, { key: ".", metaKey: true });
      expect(onRunChain).toHaveBeenCalledTimes(1);
      expect(onStopChain).toHaveBeenCalledTimes(1);

      act(() => screen.getByTestId("outside-focus").focus());
      fireEvent.keyDown(window, { key: "Enter", metaKey: true });
      expect(onRunChain).toHaveBeenCalledTimes(1);
    });

    it("does not claim Cmd+Enter when no run handler is supplied (Run disabled)", () => {
      renderCanvas();
      act(() => screen.getByRole("application").focus());
      const notPrevented = fireEvent.keyDown(window, {
        key: "Enter",
        metaKey: true,
      });
      expect(notPrevented).toBe(true);
    });

    it("Cmd+A then Cmd+D duplicates the selection through the store as one undo entry", () => {
      seedChain();
      renderCanvas();
      act(() => screen.getByRole("application").focus());

      fireEvent.keyDown(window, { key: "a", metaKey: true });
      fireEvent.keyDown(window, { key: "d", metaKey: true });

      const { chains, history } = useChainStore.getState();
      // Collect is skipped because duplicating its Loop already clones it.
      expect(chains["chain-1"].blocks).toHaveLength(4);
      expect(history["chain-1"]?.past).toHaveLength(1);
    });

    it("does not delete or lay out when focus is outside the canvas", () => {
      seedChain();
      renderCanvas();
      act(() => screen.getByTestId("outside-focus").focus());
      fireEvent.keyDown(window, { key: "l" });
      fireEvent.keyDown(window, { key: "Delete" });
      expect(defaultCallbacks.onUpdateNodePosition).not.toHaveBeenCalled();
    });
  });
});

describe("ChainCanvas Start node context menu", () => {
  afterEach(cleanup);

  it("shows Start's own menu and Configure opens the Start config panel", async () => {
    render(
      <ChainCanvas
        requests={[]}
        edges={[]}
        nodePositions={{}}
        nodeAssertions={{}}
        runState={{}}
        isRunning={false}
        {...defaultCallbacks}
        blocks={[{ id: "start-1", type: "start", inputs: [] }]}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("rf-node-start-1"));

    expect(screen.queryByRole("menuitem", { name: /add api after/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /duplicate/i })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /run from here/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("menuitem", { name: /configure/i }));

    await waitFor(() => {
      expect(screen.getByTestId("start-config-add-input-btn")).toBeTruthy();
    });
  });
});
