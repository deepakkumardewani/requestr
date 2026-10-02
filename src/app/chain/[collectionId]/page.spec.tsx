/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MigrationError } from "@/lib/chainMigration";
import * as chainRunner from "@/lib/chainRunner";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { CollectionModel, RequestModel } from "@/types";
import type { Chain, ChainBlock } from "@/types/chain";
import ChainPage from "./page";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// The page now mounts CommandPalette + KeyboardShortcutsModal directly
// (mirroring MainLayout, since MainLayout itself only wraps the /app route)
// — both call useRouter/next-intl hooks that need an app-router context.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const canvasFocusApi = { fitNodes: vi.fn(), showNode: vi.fn() };

vi.mock("@/components/chain/canvas/ChainCanvas", () => ({
  ChainCanvas: (props: Record<string, unknown>) => (
    <div
      data-testid="chain-canvas-mock"
      data-run-shortcut={props.onRunChain ? "defined" : "undefined"}
      data-run-state-count={Object.keys(props.runState as object).length}
    >
      <button
        type="button"
        data-testid="mock-register-focus"
        onClick={() =>
          (props.onCanvasFocusReady as (api: unknown) => void)(canvasFocusApi)
        }
      >
        Register focus
      </button>
      <button
        type="button"
        data-testid="mock-open-picker"
        onClick={() => (props.onAddApiClick as () => void)()}
      >
        Open picker
      </button>
      <button
        type="button"
        data-testid="mock-delete-req"
        onClick={() => (props.onDeleteNode as (id: string) => void)("req-1")}
      >
        Delete node
      </button>
      <button
        type="button"
        data-testid="mock-add-edge"
        onClick={() =>
          (props.onUpsertEdge as (e: unknown) => void)({
            id: "edge-1",
            sourceRequestId: "req-1",
            targetRequestId: "req-2",
            injections: [],
          })
        }
      >
        Add edge
      </button>
      <button
        type="button"
        data-testid="mock-delete-edge"
        onClick={() => (props.onDeleteEdge as (id: string) => void)("edge-1")}
      >
        Delete edge
      </button>
      <button
        type="button"
        data-testid="mock-run-up-to"
        onClick={() => (props.onRunUpTo as (id: string) => void)("req-1")}
      >
        Run up to
      </button>
      <button
        type="button"
        data-testid="mock-run-from-here"
        onClick={() => (props.onRunFromHere as (id: string) => void)("req-1")}
      >
        Run from here
      </button>
      <button
        type="button"
        data-testid="mock-run-node"
        onClick={() => (props.onRunNode as (id: string) => void)("req-1")}
      >
        Run node
      </button>
    </div>
  ),
}));

const stepDetailProps: { current: Record<string, unknown> | null } = {
  current: null,
};

vi.mock("@/components/chain/run-log/StepDetail", () => ({
  StepDetail: (props: Record<string, unknown>) => {
    stepDetailProps.current = props;
    return <div data-testid="step-detail-mock" />;
  },
}));

vi.mock("@/components/chain/dialogs/ApiPickerDialog", () => ({
  ApiPickerDialog: ({
    open,
    chainId,
    onNodesAdded,
    onShowOnCanvas,
  }: {
    open: boolean;
    chainId: string;
    onNodesAdded?: (ids: string[]) => void;
    onShowOnCanvas?: (id: string) => void;
  }) =>
    open ? (
      <div data-testid="api-picker-mock">
        <button type="button" data-testid="picker-fire-added" onClick={() => onNodesAdded?.(["a", "b"])}>
          Added
        </button>
        <button type="button" data-testid="picker-fire-show" onClick={() => onShowOnCanvas?.("a")}>
          Show
        </button>
        <button
          type="button"
          data-testid="picker-add-req-2"
          onClick={() =>
            useChainStore
              .getState()
              .addRequestNodes(chainId, [{ id: "req-2" }], { x: 0, y: 0 })
          }
        >
          Pick req 2
        </button>
      </div>
    ) : null,
}));

const COL_ID = "col-1";

const collection: CollectionModel = {
  id: COL_ID,
  name: "Chain collection",
  createdAt: 1,
  updatedAt: 1,
};

const baseRequest = (id: string, name: string): RequestModel => ({
  id,
  collectionId: COL_ID,
  name,
  method: "GET",
  url: "https://chain.test",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

function makeChain(nodeIds: string[], edges: Chain["edges"] = []): Chain {
  return {
    id: COL_ID,
    scope: "collection",
    schemaVersion: 5,
    collectionId: COL_ID,
    name: collection.name,
    createdAt: 1,
    blocks: [],
    nodeIds,
    edges,
    nodePositions: {},
  };
}

function seedCollectionChain(
  nodeIds: string[],
  edges: Chain["edges"] = [],
) {
  useCollectionsStore.setState({
    collections: [collection],
    requests: [baseRequest("req-1", "R1"), baseRequest("req-2", "R2")],
  });
  useChainStore.setState({
    chains: { [COL_ID]: makeChain(nodeIds, edges) },
    hydrated: true,
  });
}

function resetAllStores() {
  useCollectionsStore.setState({ collections: [], requests: [] });
  useChainStore.setState({ chains: {}, hydrated: false });
  useHistoryStore.setState({ entries: [] });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
}

async function renderChainPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ChainPage params={Promise.resolve({ collectionId: COL_ID })} />
      </Suspense>,
    );
  });
}

async function clickMenuItem(testId: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByTestId("chain-more-actions-btn"));
  await user.click(await screen.findByTestId(testId));
  return user;
}

describe("ChainPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(chainRunner, "runChain").mockResolvedValue(undefined);
    resetAllStores();
    useChainRunStore.setState({ runs: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("derives the page title from the collection name, not the stored copy", async () => {
    seedCollectionChain(["req-1"]);
    await renderChainPage();
    expect(
      await screen.findByRole("heading", { name: collection.name }),
    ).toBeInTheDocument();

    await act(async () => {
      useCollectionsStore.setState({
        collections: [{ ...collection, name: "Renamed Collection" }],
      });
    });

    expect(
      screen.getByRole("heading", { name: "Renamed Collection" }),
    ).toBeInTheDocument();
  });

  it("hands the picker the chain id so confirmed adds land on this chain", async () => {
    seedCollectionChain(["req-1"]);
    await renderChainPage();

    fireEvent.click(await screen.findByTestId("mock-open-picker"));
    fireEvent.click(screen.getByTestId("picker-add-req-2"));

    await waitFor(() => {
      const ids = useChainStore.getState().chains[COL_ID]?.nodeIds ?? [];
      expect(ids).toContain("req-2");
    });
  });

  it("routes picker adds and Show on canvas to the canvas focus api", async () => {
    seedCollectionChain(["req-1"]);
    await renderChainPage();

    fireEvent.click(await screen.findByTestId("mock-register-focus"));
    fireEvent.click(screen.getByTestId("mock-open-picker"));
    fireEvent.click(screen.getByTestId("picker-fire-added"));
    expect(canvasFocusApi.fitNodes).toHaveBeenCalledWith(["a", "b"]);
    fireEvent.click(screen.getByTestId("picker-fire-show"));
    expect(canvasFocusApi.showNode).toHaveBeenCalledWith("a");
  });

  it("removes a node from the chain graph when delete is invoked", async () => {
    seedCollectionChain(["req-1"]);
    await renderChainPage();

    fireEvent.click(await screen.findByTestId("mock-delete-req"));

    await waitFor(() => {
      expect(useChainStore.getState().chains[COL_ID]?.nodeIds).toEqual([]);
    });
  });

  it("creates and deletes edges via canvas callbacks", async () => {
    seedCollectionChain(["req-1", "req-2"]);
    await renderChainPage();

    fireEvent.click(await screen.findByTestId("mock-add-edge"));

    await waitFor(() => {
      expect(useChainStore.getState().chains[COL_ID]?.edges).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId("mock-delete-edge"));

    await waitFor(() => {
      expect(useChainStore.getState().chains[COL_ID]?.edges).toEqual([]);
    });
  });

  it("runs the full chain when Run Chain is clicked", async () => {
    seedCollectionChain(["req-1"]);
    await renderChainPage();

    fireEvent.click(await screen.findByRole("button", { name: /run chain/i }));

    await waitFor(() => {
      expect(chainRunner.runChain).toHaveBeenCalled();
    });
  });

  it("surfaces a circular dependency error from partial run", async () => {
    const { toast } = await import("sonner");
    const spy = vi
      .spyOn(chainRunner, "buildExecutionOrder")
      .mockImplementation(() => {
        throw new chainRunner.CircularDependencyError();
      });

    seedCollectionChain(["req-1", "req-2"]);
    await renderChainPage();

    fireEvent.click(await screen.findByTestId("mock-run-up-to"));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "This chain has a circular dependency. Remove the cycle to run.",
      );
    });

    spy.mockRestore();
  });

  it.each(["mock-run-up-to", "mock-run-from-here", "mock-run-node"])(
    "%s is blocked with a toast while the chain has a cycle",
    async (testId) => {
      const { toast } = await import("sonner");
      vi.mocked(toast.error).mockClear();
      const runSpy = vi.mocked(chainRunner.runChain);
      runSpy.mockClear();
      const edge = (id: string, from: string, to: string) => ({
        id,
        sourceRequestId: from,
        targetRequestId: to,
        injections: [],
      });
      seedCollectionChain(["req-1", "req-2"], [
        edge("e1", "req-1", "req-2"),
        edge("e2", "req-2", "req-1"),
      ]);
      await renderChainPage();

      fireEvent.click(await screen.findByTestId(testId));

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
      });
      expect(runSpy).not.toHaveBeenCalled();
    },
  );

  it("asks for confirmation before clearing edges and does nothing on cancel", async () => {
    seedCollectionChain(["req-1", "req-2"], [
      {
        id: "edge-1",
        sourceRequestId: "req-1",
        targetRequestId: "req-2",
        injections: [],
      },
    ]);
    await renderChainPage();

    await clickMenuItem("clear-edges-btn");

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).not.toHaveTextContent("can't be undone");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /cancel/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog"),
      ).not.toBeInTheDocument();
    });
    expect(useChainStore.getState().chains[COL_ID]?.edges).toHaveLength(1);
  });

  it("clears edges only after confirming the dialog", async () => {
    seedCollectionChain(["req-1", "req-2"], [
      {
        id: "edge-1",
        sourceRequestId: "req-1",
        targetRequestId: "req-2",
        injections: [],
      },
    ]);
    await renderChainPage();

    await clickMenuItem("clear-edges-btn");
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /yes, clear edges/i }),
    );

    await waitFor(() => {
      expect(useChainStore.getState().chains[COL_ID]?.edges).toEqual([]);
    });
  });

  describe("Always-mounted canvas", () => {
    it("renders the canvas for a chain with zero nodes", async () => {
      seedCollectionChain([]);
      await renderChainPage();
      expect(await screen.findByTestId("chain-canvas-mock")).toBeInTheDocument();
    });

    it("renders the canvas for a chain whose only node is a Delay block", async () => {
      seedCollectionChain([]);
      useChainStore.setState({
        chains: {
          [COL_ID]: {
            ...makeChain([]),
            blocks: [{ id: "delay-1", type: "delay", delayMs: 500 }],
          },
        },
      });
      await renderChainPage();
      expect(await screen.findByTestId("chain-canvas-mock")).toBeInTheDocument();
    });
  });

  describe("Clear nodes and run results", () => {
    const RUN_ID = "run-keep";
    const seedHistory = () =>
      useChainRunStore.setState({
        runs: {
          [COL_ID]: [
            {
              id: RUN_ID,
              chainId: COL_ID,
              startedAt: 1,
              finishedAt: 2,
              status: "passed",
              trigger: "full",
              counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
              bytes: 0,
              schemaVersion: 1,
              steps: [],
            } as never,
          ],
        },
      });
    const runStateCount = () =>
      screen.getByTestId("chain-canvas-mock").getAttribute("data-run-state-count");

    it("clears nodes and badges after confirming, keeps run history, and undo restores", async () => {
      seedCollectionChain(["req-1", "req-2"]);
      seedHistory();
      await renderChainPage();
      fireEvent.click(await screen.findByRole("button", { name: /run chain/i }));
      await waitFor(() => expect(runStateCount()).not.toBe("0"));

      const user = await clickMenuItem("clear-nodes-btn");
      expect(useChainStore.getState().chains[COL_ID]?.nodeIds).toHaveLength(2);
      await user.click(
        within(await screen.findByTestId("clear-nodes-dialog")).getByRole(
          "button",
          { name: /yes, clear nodes/i },
        ),
      );

      await waitFor(() => {
        expect(useChainStore.getState().chains[COL_ID]?.nodeIds).toEqual([]);
      });
      expect(
        useChainRunStore.getState().runs[COL_ID]?.map((r) => r.id),
      ).toContain(RUN_ID);
      // The canvas stays mounted at zero nodes (it owns the empty overlay).
      expect(screen.getByTestId("chain-canvas-mock")).toBeInTheDocument();
      expect(runStateCount()).toBe("0");

      await act(async () => {
        useChainStore.getState().undo(COL_ID);
      });
      expect(useChainStore.getState().chains[COL_ID]?.nodeIds).toHaveLength(2);
      expect(await screen.findByTestId("chain-history-label")).toHaveTextContent(
        "Last run",
      );
      expect(runStateCount()).toBe("0");
    });

    it("leaves nodes untouched when the dialog is cancelled", async () => {
      seedCollectionChain(["req-1", "req-2"]);
      await renderChainPage();

      const user = await clickMenuItem("clear-nodes-btn");
      await user.click(
        within(await screen.findByTestId("clear-nodes-dialog")).getByRole(
          "button",
          { name: /cancel/i },
        ),
      );

      await waitFor(() => {
        expect(screen.queryByTestId("clear-nodes-dialog")).not.toBeInTheDocument();
      });
      expect(useChainStore.getState().chains[COL_ID]?.nodeIds).toHaveLength(2);
    });

    it("clears run badges without touching nodes via Clear run results", async () => {
      seedCollectionChain(["req-1", "req-2"]);
      await renderChainPage();
      fireEvent.click(await screen.findByRole("button", { name: /run chain/i }));
      await waitFor(() => expect(runStateCount()).not.toBe("0"));

      await clickMenuItem("clear-run-results-btn");

      await waitFor(() => expect(runStateCount()).toBe("0"));
      expect(useChainStore.getState().chains[COL_ID]?.nodeIds).toHaveLength(2);
    });

    it("disables the clear items while a run is in progress", async () => {
      seedCollectionChain(["req-1"]);
      vi.mocked(chainRunner.runChain).mockImplementation(
        () => new Promise<void>(() => {}),
      );
      await renderChainPage();
      fireEvent.click(await screen.findByRole("button", { name: /run chain/i }));

      const user = userEvent.setup();
      await user.click(await screen.findByTestId("chain-more-actions-btn"));
      for (const id of ["clear-nodes-btn", "clear-run-results-btn", "clear-edges-btn"]) {
        expect(await screen.findByTestId(id)).toHaveAttribute("data-disabled");
      }
    });
  });

  describe("Run shortcut gating", () => {
    const runShortcutAttr = () =>
      screen.getByTestId("chain-canvas-mock").getAttribute("data-run-shortcut");

    it("passes a Run shortcut handler to the canvas when Run is allowed", async () => {
      seedCollectionChain(["req-1"]);
      await renderChainPage();

      await screen.findByTestId("chain-canvas-mock");
      expect(runShortcutAttr()).toBe("defined");
    });

    it("passes no Run shortcut handler to the canvas when Run is blocked", async () => {
      // An unpaired Loop blocks Run while the canvas is still rendered.
      seedCollectionChain(["req-1"]);
      useChainStore.setState((state) => ({
        chains: {
          ...state.chains,
          [COL_ID]: {
            ...state.chains[COL_ID],
            blocks: [
              {
                id: "l1",
                type: "loop",
                sourceJsonPath: "$.items",
                itemAlias: "item",
                maxIterations: 10,
              },
            ],
          },
        },
      }));
      await renderChainPage();

      await screen.findByTestId("chain-canvas-mock");
      expect(screen.getByTestId("run-chain-btn")).toBeDisabled();
      expect(runShortcutAttr()).toBe("undefined");
    });
  });

  describe("Cycle detection", () => {
    it("disables Run for a cycle through Merge/Loop blocks and lists only cycle nodes", async () => {
      const edge = (id: string, from: string, to: string) => ({
        id,
        sourceRequestId: from,
        targetRequestId: to,
        injections: [],
      });
      seedCollectionChain(
        ["req-1", "req-2"],
        [
          edge("e1", "req-1", "m1"),
          edge("e2", "m1", "l1"),
          edge("e3", "l1", "m1"),
          edge("e4", "l1", "req-2"),
        ],
      );
      useChainStore.setState((state) => ({
        chains: {
          ...state.chains,
          [COL_ID]: {
            ...state.chains[COL_ID],
            blocks: [
              { id: "m1", type: "merge", mode: "all" },
              {
                id: "l1",
                type: "loop",
                sourceJsonPath: "$.items",
                itemAlias: "item",
                maxIterations: 10,
              },
              { id: "c1", type: "collect", loopId: "l1" },
            ],
          },
        },
      }));
      await renderChainPage();

      const banner = await screen.findByText(/Circular dependency detected/i);
      expect(banner.textContent).toContain("Merge → Loop");
      expect(banner.textContent).not.toContain("R1");
      expect(banner.textContent).not.toContain("R2");
      expect(screen.getByTestId("run-chain-btn")).toBeDisabled();
    });
  });

  describe("Loop / Collect / Sub-chain validation", () => {
    const loop = (id: string): ChainBlock => ({
      id,
      type: "loop",
      sourceJsonPath: "$.items",
      itemAlias: "item",
      maxIterations: 10,
    });
    const collect = (id: string, loopId: string): ChainBlock => ({
      id,
      type: "collect",
      loopId,
    });
    const sub = (id: string, chainId: string): ChainBlock => ({
      id,
      type: "subchain",
      chainId,
      inputBindings: {},
    });
    const body = (id: string, from: string, to: string) => ({
      id,
      sourceRequestId: from,
      targetRequestId: to,
      branchId: "body",
      injections: [],
    });

    function seedWithBlocks(
      blocks: ChainBlock[],
      edges: Chain["edges"] = [],
      others: Record<string, Chain> = {},
    ) {
      seedCollectionChain(["req-1"], edges);
      useChainStore.setState({
        chains: { ...useChainStore.getState().chains, ...others },
      });
      useChainStore.setState((state) => ({
        chains: {
          ...state.chains,
          [COL_ID]: { ...state.chains[COL_ID], blocks },
        },
      }));
    }

    const otherChain = (id: string, blocks: ChainBlock[]): Chain => ({
      ...makeChain([]),
      id,
      collectionId: id,
      blocks,
    });

    it.each([
      ["unpaired Loop", [loop("l1")], {}, /without a paired Collect/i],
      [
        "unresolved Collect",
        [collect("c1", "ghost")],
        {},
        /non-existent Loop/i,
      ],
      [
        "deleted Sub-chain reference",
        [sub("s1", "deleted")],
        {},
        /Sub-chain reference is invalid/i,
      ],
      [
        "self Sub-chain reference",
        [sub("s1", COL_ID)],
        {},
        /Sub-chain reference is invalid/i,
      ],
      [
        "transitive Sub-chain reference",
        [sub("s1", "other")],
        { other: otherChain("other", [sub("s2", COL_ID)]) },
        /Sub-chain reference is invalid/i,
      ],
    ] as const)(
      "shows a banner and disables Run for %s",
      async (_label, blocks, others, message) => {
        seedWithBlocks([...blocks] as ChainBlock[], [], others);
        await renderChainPage();

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(screen.getByTestId("run-chain-btn")).toBeDisabled();
      },
    );

    it("shows a banner and disables Run for depth-4 Loop nesting", async () => {
      seedWithBlocks(
        ["l1", "l2", "l3", "l4"].flatMap((id) => [
          loop(id),
          collect(`c-${id}`, id),
        ]),
        [body("e1", "l1", "l2"), body("e2", "l2", "l3"), body("e3", "l3", "l4")],
      );
      await renderChainPage();

      expect(await screen.findByText(/nesting exceeds maximum/i)).toBeInTheDocument();
      expect(screen.getByTestId("run-chain-btn")).toBeDisabled();
    });

    it("clears the banner and re-enables Run once the graph is fixed", async () => {
      seedWithBlocks([loop("l1")]);
      await renderChainPage();
      expect(await screen.findByText(/without a paired Collect/i)).toBeInTheDocument();

      act(() => {
        useChainStore.setState((state) => ({
          chains: {
            ...state.chains,
            [COL_ID]: {
              ...state.chains[COL_ID],
              blocks: [loop("l1"), collect("c1", "l1")],
            },
          },
        }));
      });

      await waitFor(() => {
        expect(screen.queryByText(/without a paired Collect/i)).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("run-chain-btn")).toBeEnabled();
    });
  });

  describe("step-detail promotion wiring", () => {
    const EDGE = {
      id: "edge-1",
      sourceRequestId: "req-1",
      targetRequestId: "req-2",
      injections: [],
    };

    function seedSelectedStep() {
      useChainRunStore.setState({
        activeRun: {
          id: "run-1",
          chainId: COL_ID,
          startedAt: 1,
          status: "passed",
          trigger: "full",
          counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
          bytes: 0,
          schemaVersion: 1,
          steps: [
            {
              id: "step-1",
              nodeId: "req-1",
              nodeType: "api",
              label: "R1",
              state: "passed",
              startedAt: 1,
              durationMs: 1,
              extractedValues: {},
              unresolvedVars: [],
            },
          ],
        },
        selectedRunId: "run-1",
        selectedStepId: "step-1",
      });
    }

    beforeEach(() => {
      stepDetailProps.current = null;
    });

    it("passes promote handlers and only the open chain's edge ids", async () => {
      seedCollectionChain(["req-1", "req-2"], [EDGE]);
      seedSelectedStep();
      await renderChainPage();

      await screen.findByTestId("step-detail-mock");
      const props = stepDetailProps.current;
      expect(props?.onSavePromotion).toBeTypeOf("function");
      expect(props?.onRemovePromotion).toBeTypeOf("function");
      expect([...(props?.promotableEdgeIds as Set<string>)]).toEqual([
        "edge-1",
      ]);
    });

    it("omits promote handlers when the chain is opened read-only", async () => {
      seedCollectionChain(["req-1", "req-2"], [EDGE]);
      seedSelectedStep();
      const hydrate = vi
        .spyOn(useChainStore.getState(), "hydrate")
        .mockRejectedValueOnce(new MigrationError("bad chain"));
      useChainStore.setState({ hydrate });
      await renderChainPage();

      fireEvent.click(await screen.findByRole("button", { name: "Open in read-only mode" }));

      await screen.findByTestId("step-detail-mock");
      expect(stepDetailProps.current?.onSavePromotion).toBeUndefined();
      expect(stepDetailProps.current?.onRemovePromotion).toBeUndefined();
    });
  });
});
