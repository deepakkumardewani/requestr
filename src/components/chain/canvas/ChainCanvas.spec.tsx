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
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { RequestModel } from "@/types";
import { useChainStore } from "@/stores/useChainStore";
import { useUIStore } from "@/stores/useUIStore";
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

const flowProps: { current: Record<string, unknown> } = { current: {} };

vi.mock("@xyflow/react", () => {
  const React = require("react") as typeof import("react");
  const fitView = () => {};
  const screenToFlowPosition = (p: { x: number; y: number }) => ({
    x: p.x,
    y: p.y,
  });
  return {
    SelectionMode: { Partial: "partial", Full: "full" },
    useConnection: () => false,
    ControlButton: () => null,
    BackgroundVariant: { Dots: "dots", Lines: "lines", Cross: "cross" },
    Handle: () => null,
    ReactFlowProvider: ({ children }: { children?: ReactNode }) => children,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useReactFlow: () => ({ fitView, screenToFlowPosition }),
    useStoreApi: () => ({
      getState: () => ({ width: 800, height: 600, transform: [0, 0, 1] }),
    }),
    ReactFlow: ({
      nodes,
      onConnect,
      onNodeContextMenu,
      onPaneContextMenu,
      onConnectEnd,
      children,
      ...rest
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
      onPaneContextMenu?: (e: ReactMouseEvent) => void;
      onConnectEnd?: (
        e: MouseEvent,
        state: {
          fromNode: { id: string } | null;
          fromHandle: { id: string | null; type: string } | null;
          toNode: { id: string } | null;
        },
      ) => void;
      children?: ReactNode;
    } & Record<string, unknown>) => {
      flowProps.current = rest;
      return (
      <div data-testid="mock-react-flow">
        <div
          data-testid="rf-pane"
          onContextMenu={(e) => onPaneContextMenu?.(e)}
        />
        <button
          type="button"
          data-testid="rf-connect-end-empty"
          onClick={(e) =>
            onConnectEnd?.(e.nativeEvent, {
              fromNode: { id: "loop-1" },
              fromHandle: { id: "body", type: "source" },
              toNode: null,
            })
          }
        >
          Drop on empty
        </button>
        <button
          type="button"
          data-testid="rf-connect-end-node"
          onClick={(e) =>
            onConnectEnd?.(e.nativeEvent, {
              fromNode: { id: "loop-1" },
              fromHandle: { id: "body", type: "source" },
              toNode: { id: "req-2" },
            })
          }
        >
          Drop on node
        </button>
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
      );
    },
    Background: () => null,
    Controls: () => null,
    MiniMap: () => <div data-testid="rf-minimap" />,
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

  describe("empty overlay and start-only banner", () => {
    const START_BLOCK: ChainBlock = { id: "start-1", type: "start", inputs: [] };
    const DELAY_BLOCK: ChainBlock = {
      id: "delay-1",
      type: "delay",
      delayMs: 1000,
    };

    function renderCanvas(
      props: { requests?: RequestModel[]; blocks?: ChainBlock[] } = {},
    ) {
      const ui = (p: typeof props) => (
        <ChainCanvas
          requests={p.requests ?? []}
          edges={[]}
          nodePositions={{}}
          nodeAssertions={{}}
          runState={{}}
          isRunning={false}
          {...defaultCallbacks}
          blocks={p.blocks ?? []}
        />
      );
      const view = render(ui(props));
      return { ...view, update: (p: typeof props) => view.rerender(ui(p)) };
    }

    afterEach(() => {
      useChainStore.setState({ hydrated: true });
    });

    it("renders no overlay or banner while the chain is still loading", () => {
      useChainStore.setState({ hydrated: false });
      renderCanvas();
      expect(screen.queryByTestId("chain-empty-state")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("canvas-banner-start-only"),
      ).not.toBeInTheDocument();
    });

    it("shows the overlay with zero nodes once hydrated and wires Add API", () => {
      useChainStore.setState({ hydrated: true });
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

      expect(screen.getByTestId("chain-empty-state")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("empty-add-api-btn"));
      expect(onAddApiClick).toHaveBeenCalledTimes(1);
      expect(onAddApiClick).toHaveBeenCalledWith();
    });

    it("routes the Add Start block button through the shared add-block command", () => {
      useChainStore.setState({ hydrated: true });
      const original = useChainStore.getState().addBlockWithEdge;
      const addBlockWithEdge = vi.fn();
      useChainStore.setState({ addBlockWithEdge });
      onTestFinished(() => useChainStore.setState({ addBlockWithEdge: original }));
      renderCanvas();
      fireEvent.click(screen.getByTestId("empty-add-start-btn"));
      expect(addBlockWithEdge).toHaveBeenCalledWith(
        "chain-1",
        expect.objectContaining({ type: "start" }),
        expect.objectContaining({ position: expect.any(Object) }),
      );
    });

    it("hides the minimap while the canvas has no nodes and shows it otherwise", () => {
      useChainStore.setState({ hydrated: true });
      const { update } = renderCanvas();
      expect(screen.queryByTestId("rf-minimap")).not.toBeInTheDocument();
      update({ requests: [req("req-1", "R1")] });
      expect(screen.getByTestId("rf-minimap")).toBeInTheDocument();
    });

    it("shows the banner and no overlay when Start is the only node", () => {
      useChainStore.setState({ hydrated: true });
      renderCanvas({ blocks: [START_BLOCK] });
      expect(screen.getByTestId("canvas-banner-start-only")).toBeInTheDocument();
      expect(screen.queryByTestId("chain-empty-state")).not.toBeInTheDocument();
    });

    it("removes the banner once a runnable node exists", () => {
      useChainStore.setState({ hydrated: true });
      const { update } = renderCanvas({ blocks: [START_BLOCK] });
      update({ blocks: [START_BLOCK, DELAY_BLOCK] });
      expect(
        screen.queryByTestId("canvas-banner-start-only"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("chain-empty-state")).not.toBeInTheDocument();
    });

    it("shows neither overlay nor banner for a Delay-only chain", () => {
      useChainStore.setState({ hydrated: true });
      renderCanvas({ blocks: [DELAY_BLOCK] });
      expect(screen.queryByTestId("chain-empty-state")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("canvas-banner-start-only"),
      ).not.toBeInTheDocument();
    });

    it("hides the overlay once a request node exists", () => {
      useChainStore.setState({ hydrated: true });
      renderCanvas({ requests: [req("req-1", "R1")] });
      expect(screen.queryByTestId("chain-empty-state")).not.toBeInTheDocument();
    });
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

describe("ChainCanvas pointer and snap wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ snapToGrid: false });
  });

  afterEach(() => {
    cleanup();
  });

  function renderCanvas() {
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
  }

  it("wires marquee selection, right/middle pan and partial selection", () => {
    renderCanvas();
    expect(flowProps.current.selectionOnDrag).toBe(true);
    expect(flowProps.current.panOnDrag).toEqual([1, 2]);
    expect(flowProps.current.selectionMode).toBe("partial");
    expect(flowProps.current.multiSelectionKeyCode).toContain("Shift");
  });

  it("enables snapGrid of 16 only when the preference is on", () => {
    renderCanvas();
    expect(flowProps.current.snapToGrid).toBe(false);
    cleanup();
    useUIStore.setState({ snapToGrid: true });
    renderCanvas();
    expect(flowProps.current.snapToGrid).toBe(true);
    expect(flowProps.current.snapGrid).toEqual([16, 16]);
  });

  it("suppresses the pane menu after a right-drag but not a click", () => {
    renderCanvas();
    const move = flowProps.current as {
      onMoveStart: (e: unknown) => void;
      onMoveEnd: (e: unknown) => void;
    };
    act(() => {
      move.onMoveStart({ clientX: 0, clientY: 0 });
      move.onMoveEnd({ clientX: 40, clientY: 0 });
    });
    fireEvent.contextMenu(screen.getByTestId("rf-pane"));
    expect(screen.queryByTestId("pane-block-menu")).not.toBeInTheDocument();

    // The suppression is one-shot: a later plain right-click opens the menu.
    act(() => {
      move.onMoveStart({ clientX: 5, clientY: 5 });
      move.onMoveEnd({ clientX: 7, clientY: 5 });
    });
    fireEvent.contextMenu(screen.getByTestId("rf-pane"));
    expect(screen.getByTestId("pane-block-menu")).toBeInTheDocument();
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

  describe("pane menu and connection drop", () => {
    const loopBlock: LoopBlock = {
      id: "loop-1",
      type: "loop",
      sourceJsonPath: "",
      itemAlias: "item",
      maxIterations: 10,
    };

    function renderCanvas(
      overrides: Partial<React.ComponentProps<typeof ChainCanvas>> = {},
    ) {
      const chain: Chain = {
        id: "chain-1",
        scope: "standalone",
        schemaVersion: 5,
        name: "Chain",
        createdAt: 0,
        blocks: [loopBlock],
        nodeIds: [],
        edges: [],
        nodePositions: {},
      };
      useChainStore.setState({
        chains: { "chain-1": chain },
        hydrated: true,
        history: {},
      });
      return render(
        <ChainCanvas
          requests={[]}
          edges={[]}
          nodePositions={{}}
          nodeAssertions={{}}
          runState={{}}
          isRunning={false}
          {...defaultCallbacks}
          blocks={[loopBlock]}
          {...overrides}
        />,
      );
    }

    it("pane right-click opens the block menu at the cursor and prevents the native menu", async () => {
      renderCanvas();
      const event = fireEvent.contextMenu(screen.getByTestId("rf-pane"), {
        clientX: 40,
        clientY: 50,
      });

      expect(event).toBe(false); // preventDefault was called
      expect(await screen.findByTestId("pane-block-menu")).toBeInTheDocument();
    });

    it("pane menu does not open while a run is in progress", () => {
      renderCanvas({ isRunning: true });
      fireEvent.contextMenu(screen.getByTestId("rf-pane"));
      expect(screen.queryByTestId("pane-block-menu")).not.toBeInTheDocument();
    });

    it("choosing a block from the pane menu places it directly at the position", async () => {
      renderCanvas();
      fireEvent.contextMenu(screen.getByTestId("rf-pane"), {
        clientX: 40,
        clientY: 50,
      });
      fireEvent.click(await screen.findByTestId("block-menu-item-delay"));

      const chain = useChainStore.getState().chains["chain-1"];
      const delay = chain.blocks.find((b) => b.type === "delay");
      expect(delay).toBeDefined();
      expect(chain.nodePositions[delay!.id]).toEqual({ x: 40, y: 50 });
    });

    it("the request entry passes the position to the picker intent", async () => {
      const onAddApiClick = vi.fn();
      renderCanvas({ onAddApiClick });
      fireEvent.contextMenu(screen.getByTestId("rf-pane"), {
        clientX: 12,
        clientY: 34,
      });
      fireEvent.click(await screen.findByTestId("block-menu-item-api"));

      expect(onAddApiClick).toHaveBeenCalledWith({
        position: { x: 12, y: 34 },
        pendingConnection: undefined,
      });
    });

    it("dropping a connection on empty space opens a menu without Start and adds node + edge", async () => {
      renderCanvas();
      fireEvent.click(screen.getByTestId("rf-connect-end-empty"));

      expect(await screen.findByTestId("pane-block-menu")).toBeInTheDocument();
      expect(
        screen.queryByTestId("block-menu-item-start"),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("block-menu-item-delay"));
      const chain = useChainStore.getState().chains["chain-1"];
      expect(chain.edges).toHaveLength(1);
      expect(chain.edges[0]).toMatchObject({
        sourceRequestId: "loop-1",
        branchId: "body",
      });
    });

    it("Escape on the connect-drop menu creates nothing", async () => {
      renderCanvas();
      fireEvent.click(screen.getByTestId("rf-connect-end-empty"));
      await screen.findByTestId("pane-block-menu");

      fireEvent.keyDown(screen.getByTestId("block-menu-search"), {
        key: "Escape",
      });

      await waitFor(() =>
        expect(screen.queryByTestId("pane-block-menu")).not.toBeInTheDocument(),
      );
      const chain = useChainStore.getState().chains["chain-1"];
      expect(chain.edges).toHaveLength(0);
      expect(chain.blocks).toHaveLength(1);
    });

    it("a drop onto a node does not open the menu", () => {
      renderCanvas();
      fireEvent.click(screen.getByTestId("rf-connect-end-node"));
      expect(screen.queryByTestId("pane-block-menu")).not.toBeInTheDocument();
    });

    it("a drop from a Loop handle that is already used opens no menu", () => {
      renderCanvas({
        edges: [
          {
            id: "e1",
            sourceRequestId: "loop-1",
            targetRequestId: "x",
            injections: [],
            branchId: "body",
          },
        ],
      });
      fireEvent.click(screen.getByTestId("rf-connect-end-empty"));
      expect(screen.queryByTestId("pane-block-menu")).not.toBeInTheDocument();
    });

    it("node right-click still opens the node menu, not the pane menu", async () => {
      renderCanvas();
      fireEvent.contextMenu(screen.getByTestId("rf-node-loop-1"));
      expect(await screen.findByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
      expect(screen.queryByTestId("pane-block-menu")).not.toBeInTheDocument();
    });
  });
});
