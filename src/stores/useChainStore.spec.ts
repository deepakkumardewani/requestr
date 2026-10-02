import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { STACK_GAP_Y } from "@/lib/nodePlacement";
import { migrateChainsToV5, MigrationError } from "@/lib/chainMigration";
import type {
  Chain,
  CollectBlock,
  DelayNodeConfig,
  EvaluateBlock,
  LoopBlock,
  StartBlock,
  SubChainBlock,
} from "@/types/chain";
import {
  getNode,
  mutateChain,
  hasStartBlock,
  persistChain,
  useChainStore,
} from "./useChainStore";
import { useChainRunStore } from "./useChainRunStore";
import { useSettingsStore } from "./useSettingsStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

vi.mock("@/lib/chainMigration", () => ({
  migrateChainsToV5: vi.fn(),
  MigrationError: class MigrationError extends Error {
    context?: Record<string, unknown>;
    constructor(message: string, context?: Record<string, unknown>) {
      super(message);
      this.name = "MigrationError";
      this.context = context;
    }
  },
}));

function makeDb(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getAll: vi.fn(async (store: string) => {
      if (store === "collections") return [];
      if (store === "chains") return [];
      return [];
    }),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    ...overrides,
  };
}

const CHAIN_ID = "chain-1";

function seedChain(chainId = CHAIN_ID): Chain {
  return {
    id: chainId,
    scope: "standalone",
    schemaVersion: 5,
    name: "Test chain",
    createdAt: 0,
    blocks: [],
    nodeIds: [],
    edges: [],
    nodePositions: {},
  };
}

describe("useChainStore", () => {
  beforeEach(() => {
    useChainStore.setState({
      chains: {},
      hydrated: false,
      history: {},
      pausedHistory: {},
    });
    useSettingsStore.setState({ chainMigrationV5: false } as never);
    vi.mocked(getDB).mockReturnValue(Promise.resolve(makeDb() as never));
    vi.mocked(migrateChainsToV5).mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Drain any writes left pending by a test that didn't flush explicitly —
    // otherwise they leak into the next test via the module-level debounce maps.
    await persistChain.flush();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("hydrate() runs migration once and loads chains into state", async () => {
    const db = makeDb({
      getAll: vi.fn(async (store: string) =>
        store === "chains" ? [seedChain()] : []
      ),
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useChainStore.getState().hydrate();

    expect(migrateChainsToV5).toHaveBeenCalledTimes(1);
    expect(useChainStore.getState().hydrated).toBe(true);
    expect(useChainStore.getState().chains[CHAIN_ID]).toEqual(seedChain());
    expect(useSettingsStore.getState().chainMigrationV5).toBe(true);
  });

  it("hydrate() skips migration when chainMigrationV5 is already true", async () => {
    useSettingsStore.setState({ chainMigrationV5: true } as never);
    await useChainStore.getState().hydrate();
    expect(migrateChainsToV5).not.toHaveBeenCalled();
  });

  it("hydrate() surfaces a MigrationError to the caller", async () => {
    vi.mocked(migrateChainsToV5).mockRejectedValue(
      new MigrationError("id collision", { id: "x" })
    );
    await expect(useChainStore.getState().hydrate()).rejects.toBeInstanceOf(
      MigrationError
    );
    expect(useChainStore.getState().hydrated).toBe(true);
  });

  it("hydrate() toasts on a non-migration load failure without throwing", async () => {
    vi.mocked(migrateChainsToV5).mockRejectedValue(new Error("boom"));
    await useChainStore.getState().hydrate();
    expect(toast.error).toHaveBeenCalled();
    expect(useChainStore.getState().hydrated).toBe(true);
  });

  it("hydrate() is a no-op resolving hydrated:true when there is no DB", async () => {
    vi.mocked(getDB).mockReturnValue(null);
    await useChainStore.getState().hydrate();
    expect(useChainStore.getState().hydrated).toBe(true);
  });

  it("ensureCollectionChain creates a chain once, keyed by collectionId", () => {
    useChainStore.getState().ensureCollectionChain("col-1", "My Collection");
    useChainStore
      .getState()
      .ensureCollectionChain("col-1", "Renamed elsewhere");
    const chain = useChainStore.getState().chains["col-1"];
    expect(chain.scope).toBe("collection");
    expect(chain.collectionId).toBe("col-1");
    expect(chain.name).toBe("My Collection");
  });

  it("createChain generates an id and stores a standalone chain", () => {
    const id = useChainStore.getState().createChain("New chain");
    const chain = useChainStore.getState().chains[id];
    expect(chain.scope).toBe("standalone");
    expect(chain.name).toBe("New chain");
  });

  it("renameChain updates the name of an existing chain", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().renameChain(CHAIN_ID, "Renamed");
    expect(useChainStore.getState().chains[CHAIN_ID].name).toBe("Renamed");
  });

  it("deleteChain removes the chain from state and cancels pending persistence", async () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().renameChain(CHAIN_ID, "About to delete");
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore.getState().deleteChain(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID]).toBeUndefined();

    await vi.runAllTimersAsync();
    expect(db.delete).toHaveBeenCalledWith("chains", CHAIN_ID);
    expect(db.put).not.toHaveBeenCalled();
  });

  it("deleteChain purges the chain's run history via useChainRunStore", async () => {
    const { useChainRunStore } = await import("./useChainRunStore");
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainRunStore.setState({
      runs: {
        [CHAIN_ID]: [
          {
            id: "run-1",
            chainId: CHAIN_ID,
            startedAt: 0,
            status: "passed",
            trigger: "full",
            counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
            bytes: 10,
            schemaVersion: 1,
            steps: [],
          },
        ],
      },
      activeRun: {
        id: "run-2",
        chainId: CHAIN_ID,
        startedAt: 0,
        status: "running",
        trigger: "full",
        counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
        bytes: 0,
        schemaVersion: 1,
        steps: [],
      },
    });

    useChainStore.getState().deleteChain(CHAIN_ID);
    await vi.runAllTimersAsync();

    expect(useChainRunStore.getState().runs[CHAIN_ID]).toBeUndefined();
    expect(useChainRunStore.getState().activeRun).toBeNull();
  });

  it("deleteChain drops the chain's undo history", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-1");
    expect(useChainStore.getState().history[CHAIN_ID]).toBeDefined();

    useChainStore.getState().deleteChain(CHAIN_ID);

    expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();
  });

  it("hydrate() keeps history for unchanged chains and clears it for changed ones", async () => {
    const other = seedChain("chain-2");
    useChainStore.setState({
      chains: { [CHAIN_ID]: seedChain(), "chain-2": other },
    });
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-1");
    useChainStore.getState().addRequestNode("chain-2", "req-2");
    const inMemory = useChainStore.getState().chains;
    const db = makeDb({
      getAll: vi.fn(async (store: string) =>
        store === "chains"
          ? [inMemory[CHAIN_ID], { ...inMemory["chain-2"], nodeIds: [] }]
          : []
      ),
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));
    useSettingsStore.setState({ chainMigrationV5: true } as never);
    // Persist so hydrate's flush + read sees the same chains map reference.
    await useChainStore.getState().hydrate();

    expect(useChainStore.getState().history[CHAIN_ID]).toBeDefined();
    expect(useChainStore.getState().history["chain-2"]).toBeUndefined();
  });

  describe("addRequestNodes", () => {
    const ORIGIN = { x: 100, y: 50 };

    beforeEach(() => {
      useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    });

    it("adds nodes in order at staggered positions and returns their ids", () => {
      const added = useChainStore
        .getState()
        .addRequestNodes(CHAIN_ID, [{ id: "a" }, { id: "b" }], ORIGIN);
      const chain = useChainStore.getState().chains[CHAIN_ID];
      expect(added).toEqual(["a", "b"]);
      expect(chain.nodeIds).toEqual(["a", "b"]);
      expect(chain.nodePositions.a).toEqual(ORIGIN);
      expect(chain.nodePositions.b).toEqual({ x: 100, y: 50 + STACK_GAP_Y });
    });

    it("skips ids already in the chain or repeated in the selection", () => {
      useChainStore.getState().addRequestNode(CHAIN_ID, "a");
      const added = useChainStore
        .getState()
        .addRequestNodes(
          CHAIN_ID,
          [{ id: "a" }, { id: "b" }, { id: "b" }],
          ORIGIN,
        );
      expect(added).toEqual(["b"]);
      expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
        "a",
        "b",
      ]);
    });

    it("connects the pending connection to the first added node only", () => {
      const added = useChainStore
        .getState()
        .addRequestNodes(CHAIN_ID, [{ id: "a" }, { id: "b" }], ORIGIN, {
          nodeId: "src",
        });
      const { edges } = useChainStore.getState().chains[CHAIN_ID];
      expect(added).toEqual(["a", "b"]);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        sourceRequestId: "src",
        targetRequestId: "a",
      });
    });

    it("returns [] and leaves the chain untouched when nothing is new", () => {
      expect(
        useChainStore.getState().addRequestNodes(CHAIN_ID, [], ORIGIN),
      ).toEqual([]);
      expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();
    });

    it("returns [] for an unknown chain", () => {
      expect(
        useChainStore.getState().addRequestNodes("nope", [{ id: "a" }], ORIGIN),
      ).toEqual([]);
    });
  });

  it("addRequestNode appends a request id once", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-1");
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-1");
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
      "req-1",
    ]);
  });

  it("removeNode cascades edges, positions, assertions and env promotions", () => {
    const chain: Chain = {
      ...seedChain(),
      nodeIds: ["req-1", "req-2"],
      edges: [
        {
          id: "edge-1",
          sourceRequestId: "req-1",
          targetRequestId: "req-2",
          injections: [],
        },
      ],
      nodePositions: { "req-1": { x: 0, y: 0 }, "req-2": { x: 100, y: 0 } },
      nodeAssertions: { "req-1": [] },
      envPromotions: [
        { edgeId: "edge-1", envId: "env-1", envVarName: "TOKEN" },
      ],
    };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });

    useChainStore.getState().removeNode(CHAIN_ID, "req-1");

    const updated = useChainStore.getState().chains[CHAIN_ID];
    expect(updated.nodeIds).toEqual(["req-2"]);
    expect(updated.edges).toEqual([]);
    expect(updated.nodePositions["req-1"]).toBeUndefined();
    expect(updated.nodeAssertions?.["req-1"]).toBeUndefined();
    expect(updated.envPromotions).toEqual([]);
  });

  it("removeNode also removes a matching block", () => {
    const delayBlock: DelayNodeConfig = {
      id: "delay-1",
      type: "delay",
      delayMs: 10,
    };
    const chain: Chain = { ...seedChain(), blocks: [delayBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().removeNode(CHAIN_ID, "delay-1");
    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([]);
  });

  it("duplicateNode copies a block with a new id and returns it", () => {
    const delayBlock: DelayNodeConfig = {
      id: "delay-1",
      type: "delay",
      delayMs: 10,
    };
    const chain: Chain = { ...seedChain(), blocks: [delayBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });

    const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "delay-1");

    expect(newId).not.toBeNull();
    expect(newId).not.toBe("delay-1");
    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({ ...delayBlock, id: newId });
  });

  it("duplicating a Collect directly blanks its loopId so it cannot shadow the original pairing", () => {
    const collect: CollectBlock = {
      id: "collect-1",
      type: "collect",
      loopId: "loop-1",
    };
    useChainStore.setState({
      chains: { [CHAIN_ID]: { ...seedChain(), blocks: [collect] } },
    });

    const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "collect-1");

    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks[1]).toEqual({ id: newId, type: "collect", loopId: "" });
    expect(blocks[0]).toEqual(collect);
  });

  it("duplicateNode returns null for an unknown chain or block", () => {
    expect(useChainStore.getState().duplicateNode("missing", "x")).toBeNull();
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    expect(useChainStore.getState().duplicateNode(CHAIN_ID, "x")).toBeNull();
  });

  it("duplicateNode copies a subchain block's reference, not the referenced chain", () => {
    const subchainBlock: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "referenced-chain",
      inputBindings: { foo: "{{bar}}" },
    };
    const chain: Chain = { ...seedChain(), blocks: [subchainBlock] };
    useChainStore.setState({
      chains: {
        [CHAIN_ID]: chain,
        "referenced-chain": seedChain("referenced-chain"),
      },
    });

    const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "sub-1");

    expect(newId).not.toBeNull();
    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({ ...subchainBlock, id: newId });
    // The referenced chain itself is untouched — only the reference was copied.
    expect(Object.keys(useChainStore.getState().chains)).toHaveLength(2);
  });

  it("removeNode removes a subchain block without touching the referenced chain", () => {
    const subchainBlock: SubChainBlock = {
      id: "sub-1",
      type: "subchain",
      chainId: "referenced-chain",
      inputBindings: {},
    };
    const chain: Chain = { ...seedChain(), blocks: [subchainBlock] };
    const referencedChain: Chain = seedChain("referenced-chain");
    useChainStore.setState({
      chains: { [CHAIN_ID]: chain, "referenced-chain": referencedChain },
    });

    useChainStore.getState().removeNode(CHAIN_ID, "sub-1");

    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([]);
    expect(useChainStore.getState().chains["referenced-chain"]).toEqual(
      referencedChain
    );
  });

  it("upsertBlock inserts then updates a block by id", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const block: DelayNodeConfig = {
      id: "delay-1",
      type: "delay",
      delayMs: 10,
    };
    useChainStore.getState().upsertBlock(CHAIN_ID, block);
    useChainStore.getState().upsertBlock(CHAIN_ID, { ...block, delayMs: 20 });
    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toEqual([{ ...block, delayMs: 20 }]);
  });

  it("hasStartBlock reports whether the chain already has a Start block", () => {
    const startBlock: StartBlock = { id: "start-1", type: "start", inputs: [] };
    expect(hasStartBlock(seedChain())).toBe(false);
    expect(hasStartBlock({ ...seedChain(), blocks: [startBlock] })).toBe(true);
  });

  it("upsertBlock refuses to insert a second Start block and toasts", () => {
    const startBlock: StartBlock = { id: "start-1", type: "start", inputs: [] };
    const chain: Chain = { ...seedChain(), blocks: [startBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });

    const secondStart: StartBlock = {
      id: "start-2",
      type: "start",
      inputs: [],
    };
    useChainStore.getState().upsertBlock(CHAIN_ID, secondStart);

    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([
      startBlock,
    ]);
    expect(toast.error).toHaveBeenCalledWith(
      "Only one Start block is allowed per chain"
    );
  });

  it("upsertBlock allows updating the existing Start block in place", () => {
    const startBlock: StartBlock = { id: "start-1", type: "start", inputs: [] };
    const chain: Chain = { ...seedChain(), blocks: [startBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });

    const updated: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "", source: "literal" }],
    };
    useChainStore.getState().upsertBlock(CHAIN_ID, updated);

    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([updated]);
  });

  it("duplicateNode refuses to duplicate a Start block and toasts", () => {
    const startBlock: StartBlock = { id: "start-1", type: "start", inputs: [] };
    const chain: Chain = { ...seedChain(), blocks: [startBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });

    const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "start-1");

    expect(newId).toBeNull();
    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([
      startBlock,
    ]);
    expect(toast.error).toHaveBeenCalledWith(
      "Only one Start block is allowed per chain"
    );
  });

  it("upsertEdge inserts then updates an edge by id", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const edge = {
      id: "edge-1",
      sourceRequestId: "req-1",
      targetRequestId: "req-2",
      injections: [],
    };
    useChainStore.getState().upsertEdge(CHAIN_ID, edge);
    useChainStore.getState().upsertEdge(CHAIN_ID, { ...edge, targetUrl: "x" });
    expect(useChainStore.getState().chains[CHAIN_ID].edges).toEqual([
      { ...edge, targetUrl: "x" },
    ]);
  });

  it("deleteEdge removes the edge and its env promotion", () => {
    const chain: Chain = {
      ...seedChain(),
      edges: [
        {
          id: "edge-1",
          sourceRequestId: "req-1",
          targetRequestId: "req-2",
          injections: [],
        },
      ],
      envPromotions: [
        { edgeId: "edge-1", envId: "env-1", envVarName: "TOKEN" },
      ],
    };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().deleteEdge(CHAIN_ID, "edge-1");
    const updated = useChainStore.getState().chains[CHAIN_ID];
    expect(updated.edges).toEqual([]);
    expect(updated.envPromotions).toEqual([]);
  });

  it("clearEdges empties the edges array", () => {
    const chain: Chain = {
      ...seedChain(),
      edges: [
        {
          id: "edge-1",
          sourceRequestId: "req-1",
          targetRequestId: "req-2",
          injections: [],
        },
      ],
    };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().clearEdges(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].edges).toEqual([]);
  });

  it("clearEdges also drops envPromotions", () => {
    const chain: Chain = {
      ...seedChain(),
      edges: [
        {
          id: "edge-1",
          sourceRequestId: "req-1",
          targetRequestId: "req-2",
          injections: [],
        },
      ],
      envPromotions: [{ edgeId: "edge-1", envId: "env", envVarName: "V" }],
    };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().clearEdges(CHAIN_ID);
    const updated = useChainStore.getState().chains[CHAIN_ID];
    expect(updated.edges).toEqual([]);
    expect(updated.envPromotions ?? []).toEqual([]);
  });

  it("clearEdges on a chain with no edges leaves the chain untouched", () => {
    const chain = seedChain();
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().clearEdges(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID]).toBe(chain);
  });

  it("clearNodes removes nodes, blocks, edges, positions, assertions and promotions", () => {
    const chain: Chain = {
      ...seedChain(),
      nodeIds: ["req-1", "req-2"],
      edges: [
        {
          id: "edge-1",
          sourceRequestId: "req-1",
          targetRequestId: "req-2",
          injections: [],
        },
      ],
      nodePositions: { "req-1": { x: 1, y: 2 }, "req-2": { x: 3, y: 4 } },
      nodeAssertions: { "req-1": [] },
      envPromotions: [{ edgeId: "edge-1", envId: "env", envVarName: "V" }],
    };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().clearNodes(CHAIN_ID);
    const updated = useChainStore.getState().chains[CHAIN_ID];
    expect(updated.nodeIds).toEqual([]);
    expect(updated.blocks).toEqual([]);
    expect(updated.edges).toEqual([]);
    expect(updated.nodePositions).toEqual({});
    expect(updated.nodeAssertions).toEqual({});
    expect(updated.envPromotions).toEqual([]);
  });

  it("clearNodes on an empty chain leaves the chain untouched", () => {
    const chain = seedChain();
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().clearNodes(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID]).toBe(chain);
  });

  describe("run-state pruning", () => {
    const badge = { state: "passed" as const, extractedValues: {} };
    const runChain = (): Chain => ({
      ...seedChain(),
      nodeIds: ["req-1", "req-2"],
    });
    const seedRun = () => {
      useChainStore.setState({ chains: { [CHAIN_ID]: runChain() } });
      useChainRunStore.setState({
        runState: { [CHAIN_ID]: { "req-1": badge, "req-2": badge } },
      });
    };
    const badgeIds = () =>
      Object.keys(useChainRunStore.getState().runState[CHAIN_ID] ?? {});

    afterEach(() => useChainRunStore.setState({ runState: {} }));

    it("removeNode drops that node's badge", () => {
      seedRun();
      useChainStore.getState().removeNode(CHAIN_ID, "req-1");
      expect(badgeIds()).toEqual(["req-2"]);
    });

    it("removeNodes drops every removed node's badge", () => {
      seedRun();
      useChainStore.getState().removeNodes(CHAIN_ID, ["req-1", "req-2"]);
      expect(badgeIds()).toEqual([]);
    });

    it("clearNodes drops all badges", () => {
      seedRun();
      useChainStore.getState().clearNodes(CHAIN_ID);
      expect(badgeIds()).toEqual([]);
    });

    it("undo of an add prunes the added node's badge", () => {
      useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
      useChainStore.getState().addRequestNode(CHAIN_ID, "req-9");
      useChainRunStore.setState({
        runState: { [CHAIN_ID]: { "req-9": badge } },
      });
      useChainStore.getState().undo(CHAIN_ID);
      expect(badgeIds()).toEqual([]);
    });

    it("undo of a delete restores the node as idle (no resurrected badge)", () => {
      seedRun();
      useChainStore.getState().removeNode(CHAIN_ID, "req-1");
      useChainStore.getState().undo(CHAIN_ID);
      expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toContain(
        "req-1"
      );
      expect(badgeIds()).toEqual(["req-2"]);
    });

    it("does not touch run state when a change prunes nothing", () => {
      seedRun();
      const before = useChainRunStore.getState().runState;
      useChainStore.getState().updateNodePosition(CHAIN_ID, "req-1", {
        x: 1,
        y: 1,
      });
      expect(useChainRunStore.getState().runState).toBe(before);
    });
  });

  it("updateNodePosition sets the position for a node", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().updateNodePosition(CHAIN_ID, "req-1", {
      x: 10,
      y: 20,
    });
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodePositions["req-1"]
    ).toEqual({ x: 10, y: 20 });
  });

  it("upsertNodeAssertions then deleteNodeAssertions round-trips", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().upsertNodeAssertions(CHAIN_ID, "req-1", [
      {
        id: "a1",
        source: "status",
        operator: "eq",
        expectedValue: "200",
        enabled: true,
      },
    ]);
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"]
    ).toHaveLength(1);

    useChainStore.getState().deleteNodeAssertions(CHAIN_ID, "req-1");
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"]
    ).toBeUndefined();
  });

  it("upsertEnvPromotion inserts then updates by edgeId, deleteEnvPromotion removes it", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().upsertEnvPromotion(CHAIN_ID, {
      edgeId: "edge-1",
      envId: "env-1",
      envVarName: "TOKEN",
    });
    useChainStore.getState().upsertEnvPromotion(CHAIN_ID, {
      edgeId: "edge-1",
      envId: "env-1",
      envVarName: "TOKEN2",
    });
    expect(useChainStore.getState().chains[CHAIN_ID].envPromotions).toEqual([
      { edgeId: "edge-1", envId: "env-1", envVarName: "TOKEN2" },
    ]);

    useChainStore.getState().deleteEnvPromotion(CHAIN_ID, "edge-1");
    expect(useChainStore.getState().chains[CHAIN_ID].envPromotions).toEqual([]);
  });

  it("rapid position updates coalesce into a single debounced IDB write", async () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore
      .getState()
      .updateNodePosition(CHAIN_ID, "req-1", { x: 1, y: 1 });
    useChainStore
      .getState()
      .updateNodePosition(CHAIN_ID, "req-1", { x: 2, y: 2 });
    useChainStore
      .getState()
      .updateNodePosition(CHAIN_ID, "req-1", { x: 3, y: 3 });

    await vi.runAllTimersAsync();

    expect(db.put).toHaveBeenCalledTimes(1);
    expect(db.put).toHaveBeenCalledWith(
      "chains",
      expect.objectContaining({
        nodePositions: { "req-1": { x: 3, y: 3 } },
      })
    );
  });

  it("persistChain.flush(chainId) writes immediately without waiting for the debounce", async () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore.getState().renameChain(CHAIN_ID, "Flushed");
    await persistChain.flush(CHAIN_ID);

    expect(db.put).toHaveBeenCalledTimes(1);
  });

  it("persistChain.flush() with no argument flushes every pending chain", async () => {
    useChainStore.setState({
      chains: { [CHAIN_ID]: seedChain(), other: seedChain("other") },
    });
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore.getState().renameChain(CHAIN_ID, "A");
    useChainStore.getState().renameChain("other", "B");
    await persistChain.flush();

    expect(db.put).toHaveBeenCalledTimes(2);
  });

  it("surfaces a toast when a persistence write rejects", async () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const db = makeDb({
      put: vi.fn(async () => {
        throw new Error("disk full");
      }),
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore.getState().renameChain(CHAIN_ID, "Will fail");
    await vi.runAllTimersAsync();

    expect(toast.error).toHaveBeenCalledWith(
      "Failed to save chain",
      expect.objectContaining({ description: "disk full" })
    );
  });

  it("actions on an unknown chain id are a no-op and create nothing", () => {
    const store = useChainStore.getState();
    store.addRequestNode("brand-new", "req-1");
    store.renameChain("brand-new", "x");
    store.updateNodePosition("brand-new", "n", { x: 1, y: 2 });
    store.upsertBlock("brand-new", { id: "d", type: "delay", delayMs: 1 });
    store.undo("brand-new");
    expect(useChainStore.getState().chains).toEqual({});
    expect(useChainStore.getState().history).toEqual({});
  });

  describe("mutateChain", () => {
    type MutableState = Pick<
      ReturnType<typeof useChainStore.getState>,
      "chains" | "hydrated" | "history" | "pausedHistory"
    >;
    const baseState = (): MutableState => ({
      chains: { [CHAIN_ID]: seedChain() },
      hydrated: true,
      history: {},
      pausedHistory: {},
    });

    it("returns the same state for a missing chain without creating one", () => {
      const state = baseState();
      const next = mutateChain(state, "missing", (c) => ({ ...c, name: "x" }));
      expect(next).toBe(state);
      expect(next.chains.missing).toBeUndefined();
    });

    it("returns the same state when fn returns the chain unchanged", () => {
      const state = baseState();
      expect(mutateChain(state, CHAIN_ID, (c) => c)).toBe(state);
    });

    it("records history by default and skips it when recordHistory is false", () => {
      const state = baseState();
      const recorded = mutateChain(state, CHAIN_ID, (c) => ({
        ...c,
        name: "a",
      }));
      expect(recorded.history[CHAIN_ID].past).toHaveLength(1);
      const unrecorded = mutateChain(
        state,
        CHAIN_ID,
        (c) => ({ ...c, name: "a" }),
        { recordHistory: false }
      );
      expect(unrecorded.chains[CHAIN_ID].name).toBe("a");
      expect(unrecorded.history[CHAIN_ID]).toBeUndefined();
    });

    it("skips history while the chain is paused", () => {
      const state = {
        ...baseState(),
        pausedHistory: { [CHAIN_ID]: {} as never },
      };
      const next = mutateChain(state, CHAIN_ID, (c) => ({ ...c, name: "a" }));
      expect(next.history[CHAIN_ID]).toBeUndefined();
    });
  });

  it("undo then redo restore and re-apply a mutation", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const store = useChainStore.getState();
    store.renameChain(CHAIN_ID, "Changed");
    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].name).toBe("Test chain");
    store.redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].name).toBe("Changed");
  });

  it("pause/resume keeps the paused snapshot in store state and commits one entry", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const store = useChainStore.getState();
    store.pauseHistory(CHAIN_ID);
    expect(useChainStore.getState().pausedHistory[CHAIN_ID]).toBeDefined();
    store.updateNodePosition(CHAIN_ID, "n", { x: 1, y: 1 });
    store.updateNodePosition(CHAIN_ID, "n", { x: 2, y: 2 });
    store.resumeHistory(CHAIN_ID);
    expect(useChainStore.getState().pausedHistory[CHAIN_ID]).toBeUndefined();
    expect(useChainStore.getState().history[CHAIN_ID].past).toHaveLength(1);
  });

  it("never toasts or schedules persistence from inside a set updater", async () => {
    const start: StartBlock = { id: "start-1", type: "start" } as StartBlock;
    useChainStore.setState({
      chains: { [CHAIN_ID]: { ...seedChain(), blocks: [start] } },
    });
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    let insideSet = false;
    const callsInsideSet: string[] = [];
    const realSetState = useChainStore.setState;
    const setSpy = vi.spyOn(useChainStore, "setState").mockImplementation(((
      ...args: Parameters<typeof realSetState>
    ) => {
      insideSet = true;
      try {
        return realSetState(...args);
      } finally {
        insideSet = false;
      }
    }) as never);
    vi.mocked(toast.error).mockImplementation((() => {
      if (insideSet) callsInsideSet.push("toast");
      return "" as never;
    }) as never);
    vi.mocked(getDB).mockImplementation((() => {
      if (insideSet) callsInsideSet.push("getDB");
      return Promise.resolve(db as never);
    }) as never);

    const store = useChainStore.getState();
    store.renameChain(CHAIN_ID, "Renamed");
    store.upsertBlock(CHAIN_ID, { id: "start-2", type: "start" } as StartBlock);
    await vi.runAllTimersAsync();
    setSpy.mockRestore();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(db.put).toHaveBeenCalled();
    expect(callsInsideSet).toEqual([]);
  });

  it("getNode resolves a block by id or returns undefined", () => {
    const block: DelayNodeConfig = {
      id: "delay-1",
      type: "delay",
      delayMs: 10,
    };
    const chain: Chain = { ...seedChain(), blocks: [block] };
    expect(getNode(chain, "delay-1")).toEqual(block);
    expect(getNode(chain, "missing")).toBeUndefined();
  });
});

describe("useChainStore Loop/Collect pairing", () => {
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

  beforeEach(() => {
    useChainStore.setState({
      chains: {
        [CHAIN_ID]: {
          ...seedChain(),
          blocks: [loop, collect],
          nodeIds: [],
          nodePositions: {
            "loop-1": { x: 0, y: 0 },
            "collect-1": { x: 9, y: 0 },
          },
        },
      },
      hydrated: true,
      history: {},
      pausedHistory: {},
    });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(makeDb() as never));
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await persistChain.flush();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("removeNode on a Loop also removes its paired Collect and their positions", () => {
    useChainStore.getState().removeNode(CHAIN_ID, "loop-1");

    const updated = useChainStore.getState().chains[CHAIN_ID];
    expect(updated.blocks).toEqual([]);
    expect(updated.nodePositions).toEqual({});
  });

  it("duplicateNode on a Loop duplicates the paired Collect and rebinds it to the new Loop", () => {
    const newLoopId = useChainStore
      .getState()
      .duplicateNode(CHAIN_ID, "loop-1");

    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toHaveLength(4);
    const newCollect = blocks.find(
      (b): b is CollectBlock => b.type === "collect" && b.id !== "collect-1"
    );
    expect(newCollect?.loopId).toBe(newLoopId);
    expect(blocks.find((b) => b.id === "collect-1")).toEqual(collect);
  });

  it("removeNode on a lone Collect leaves its Loop in place (Loop is flagged unpaired by validation, not cascaded)", () => {
    useChainStore.getState().removeNode(CHAIN_ID, "collect-1");

    const ids = useChainStore
      .getState()
      .chains[CHAIN_ID].blocks.map((b) => b.id);
    expect(ids).toContain("loop-1");
    expect(ids).not.toContain("collect-1");
  });

  describe("persistence failure logging", () => {
    it("logs chain id and operation alongside the toast when a save fails", async () => {
      const error = new Error("quota");
      vi.mocked(getDB).mockReturnValue(
        Promise.resolve(
          makeDb({ put: vi.fn().mockRejectedValue(error) })
        ) as never
      );
      const spy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      useChainStore.getState().renameChain(CHAIN_ID, "renamed");
      await persistChain.flush(CHAIN_ID);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("chain"),
        expect.objectContaining({ chainId: CHAIN_ID, op: "save", error })
      );
      expect(toast.error).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("logs chain id and operation when a delete fails", async () => {
      const error = new Error("blocked");
      vi.mocked(getDB).mockReturnValue(
        Promise.resolve(
          makeDb({ delete: vi.fn().mockRejectedValue(error) })
        ) as never
      );
      const spy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      useChainStore.getState().deleteChain(CHAIN_ID);
      await vi.waitFor(() =>
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining("chain"),
          expect.objectContaining({ chainId: CHAIN_ID, op: "delete", error })
        )
      );
      spy.mockRestore();
    });
  });

  describe("duplicateNode alias uniqueness (CR-041-dup)", () => {
    const evaluate = (id: string, outputAlias: string): EvaluateBlock => ({
      id,
      type: "evaluate",
      code: "return 1",
      outputAlias,
    });

    function seedBlocks(blocks: Chain["blocks"]) {
      useChainStore.setState((state) => ({
        chains: {
          ...state.chains,
          [CHAIN_ID]: { ...state.chains[CHAIN_ID], blocks },
        },
      }));
    }

    const blocksNow = () => useChainStore.getState().chains[CHAIN_ID].blocks;

    it("duplicate Evaluate gets a unique outputAlias", () => {
      seedBlocks([evaluate("e1", "result")]);
      const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "e1");
      const dup = blocksNow().find((b) => b.id === newId) as EvaluateBlock;
      expect(dup.outputAlias).toBe("result_copy");
    });

    it("skips aliases already published by any producer", () => {
      seedBlocks([evaluate("e1", "result"), evaluate("e2", "result_copy")]);
      const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "e1");
      const dup = blocksNow().find((b) => b.id === newId) as EvaluateBlock;
      expect(dup.outputAlias).toBe("result_copy2");
    });

    it("duplicate Loop gets a unique itemAlias and its Collect is rebound", () => {
      const newLoopId = useChainStore
        .getState()
        .duplicateNode(CHAIN_ID, "loop-1");
      const blocks = blocksNow();
      const original = blocks.find((b) => b.id === "loop-1") as LoopBlock;
      const dup = blocks.find((b) => b.id === newLoopId) as LoopBlock;
      expect(dup.itemAlias).toBe(`${original.itemAlias}_copy`);
    });

    it("leaves a blank alias blank", () => {
      seedBlocks([evaluate("e1", "")]);
      const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "e1");
      const dup = blocksNow().find((b) => b.id === newId) as EvaluateBlock;
      expect(dup.outputAlias).toBe("");
    });
  });
});

describe("useChainStore — addBlockWithEdge", () => {
  const delay = (id: string): DelayNodeConfig => ({
    id,
    type: "delay",
    delayMs: 100,
  });
  const loop = (id: string): LoopBlock => ({
    id,
    type: "loop",
    sourceJsonPath: "",
    itemAlias: "item",
    maxIterations: 10,
  });
  const chainNow = () => useChainStore.getState().chains[CHAIN_ID];

  beforeEach(() => {
    vi.mocked(getDB).mockReturnValue(undefined as never);
    useChainStore.setState({
      chains: { [CHAIN_ID]: { ...seedChain(), blocks: [loop("loop-1")] } },
      hydrated: true,
      history: {},
    });
  });

  it("adds block, position and edge together", () => {
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, delay("d1"), {
      connectFrom: { nodeId: "loop-1", handleId: "body" },
      position: { x: 5, y: 6 },
    });
    const chain = chainNow();
    expect(chain.blocks.map((b) => b.id)).toContain("d1");
    expect(chain.nodePositions.d1).toEqual({ x: 5, y: 6 });
    expect(chain.edges).toHaveLength(1);
    expect(chain.edges[0]).toMatchObject({
      sourceRequestId: "loop-1",
      targetRequestId: "d1",
      branchId: "body",
    });
  });

  it("omits branchId when the source handle is null", () => {
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, delay("d1"), {
      connectFrom: { nodeId: "loop-1", handleId: null },
    });
    expect(chainNow().edges[0].branchId).toBeUndefined();
  });

  it("seeds a routing injection for delay targets and fail branches", () => {
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, delay("d1"), {
      connectFrom: { nodeId: "req-1", handleId: "fail" },
    });
    expect(chainNow().edges[0].injections).toHaveLength(1);
  });

  it("seeds a routing injection when the source is a delay, display, or branched condition", () => {
    const seeded: Chain = {
      ...seedChain(),
      blocks: [
        delay("src-delay"),
        { id: "cond", type: "condition", variable: "{{x}}", branches: [] },
      ],
    };
    useChainStore.setState({ chains: { [CHAIN_ID]: seeded } });
    useChainStore.getState().addBlockWithEdge(
      CHAIN_ID,
      { id: "m1", type: "merge", mode: "all" },
      { connectFrom: { nodeId: "cond", handleId: "else" } },
    );
    useChainStore.getState().addBlockWithEdge(
      CHAIN_ID,
      { id: "m2", type: "merge", mode: "all" },
      { connectFrom: { nodeId: "src-delay" } },
    );
    expect(chainNow().edges.map((e) => e.injections.length)).toEqual([1, 1]);
  });

  it("leaves injections empty for a plain data edge", () => {
    useChainStore.getState().addBlockWithEdge(
      CHAIN_ID,
      { id: "m1", type: "merge", mode: "all" },
      { connectFrom: { nodeId: "req-1" } },
    );
    expect(chainNow().edges[0].injections).toEqual([]);
  });

  it("creates nothing when the Loop handle is already used", () => {
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, delay("d1"), {
      connectFrom: { nodeId: "loop-1", handleId: "body" },
    });
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, delay("d2"), {
      connectFrom: { nodeId: "loop-1", handleId: "body" },
    });
    expect(chainNow().blocks.map((b) => b.id)).not.toContain("d2");
    expect(chainNow().edges).toHaveLength(1);
  });

  it("adds a block with no edge when connectFrom is absent", () => {
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, delay("d1"));
    expect(chainNow().edges).toHaveLength(0);
    expect(chainNow().blocks.map((b) => b.id)).toContain("d1");
  });

  it("is a no-op for an unknown chain", () => {
    expect(() =>
      useChainStore.getState().addBlockWithEdge("nope", delay("d1")),
    ).not.toThrow();
  });

  it("refuses to connect into a Start block and enforces the Start limit", () => {
    const start: StartBlock = { id: "s1", type: "start", inputs: [] };
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, start, {
      connectFrom: { nodeId: "loop-1", handleId: "body" },
    });
    expect(chainNow().blocks.some((b) => b.type === "start")).toBe(false);
    useChainStore.getState().addBlockWithEdge(CHAIN_ID, start);
    useChainStore
      .getState()
      .addBlockWithEdge(CHAIN_ID, { ...start, id: "s2" });
    expect(chainNow().blocks.filter((b) => b.type === "start")).toHaveLength(1);
    expect(toast.error).toHaveBeenCalled();
  });

  it("addRequestNode with connectFrom adds node and edge; refused connection adds nothing", () => {
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-9", {
      connectFrom: { nodeId: "loop-1", handleId: "body" },
      position: { x: 1, y: 2 },
    });
    expect(chainNow().nodeIds).toContain("req-9");
    expect(chainNow().edges).toHaveLength(1);
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-10", {
      connectFrom: { nodeId: "loop-1", handleId: "body" },
    });
    expect(chainNow().nodeIds).not.toContain("req-10");
    useChainStore.getState().addRequestNode(CHAIN_ID, "req-9", {
      connectFrom: { nodeId: "loop-1", handleId: "done" },
    });
    expect(chainNow().edges).toHaveLength(1);
  });
});

