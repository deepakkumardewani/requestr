import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { migrateChainsToV5, MigrationError } from "@/lib/chainMigration";
import type {
  Chain,
  DelayNodeConfig,
  StartBlock,
  SubChainBlock,
} from "@/types/chain";
import {
  allNodeIds,
  getNode,
  hasStartBlock,
  persistChain,
  useChainStore,
} from "./useChainStore";
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
    useChainStore.setState({ chains: {}, hydrated: false, history: {} });
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
        store === "chains" ? [seedChain()] : [],
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
      new MigrationError("id collision", { id: "x" }),
    );
    await expect(useChainStore.getState().hydrate()).rejects.toBeInstanceOf(
      MigrationError,
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
    useChainStore.getState().ensureCollectionChain("col-1", "Renamed elsewhere");
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
    const delayBlock: DelayNodeConfig = { id: "delay-1", type: "delay", delayMs: 10 };
    const chain: Chain = { ...seedChain(), blocks: [delayBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });
    useChainStore.getState().removeNode(CHAIN_ID, "delay-1");
    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([]);
  });

  it("duplicateNode copies a block with a new id and returns it", () => {
    const delayBlock: DelayNodeConfig = { id: "delay-1", type: "delay", delayMs: 10 };
    const chain: Chain = { ...seedChain(), blocks: [delayBlock] };
    useChainStore.setState({ chains: { [CHAIN_ID]: chain } });

    const newId = useChainStore.getState().duplicateNode(CHAIN_ID, "delay-1");

    expect(newId).not.toBeNull();
    expect(newId).not.toBe("delay-1");
    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toEqual({ ...delayBlock, id: newId });
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
      referencedChain,
    );
  });

  it("upsertBlock inserts then updates a block by id", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const block: DelayNodeConfig = { id: "delay-1", type: "delay", delayMs: 10 };
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

    const secondStart: StartBlock = { id: "start-2", type: "start", inputs: [] };
    useChainStore.getState().upsertBlock(CHAIN_ID, secondStart);

    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([
      startBlock,
    ]);
    expect(toast.error).toHaveBeenCalledWith(
      "Only one Start block is allowed per chain",
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

    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toEqual([
      updated,
    ]);
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
      "Only one Start block is allowed per chain",
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

  it("updateNodePosition sets the position for a node", () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    useChainStore.getState().updateNodePosition(CHAIN_ID, "req-1", {
      x: 10,
      y: 20,
    });
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodePositions["req-1"],
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
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"],
    ).toHaveLength(1);

    useChainStore.getState().deleteNodeAssertions(CHAIN_ID, "req-1");
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"],
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
    expect(useChainStore.getState().chains[CHAIN_ID].envPromotions).toEqual(
      [],
    );
  });

  it("rapid position updates coalesce into a single debounced IDB write", async () => {
    useChainStore.setState({ chains: { [CHAIN_ID]: seedChain() } });
    const db = makeDb();
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore.getState().updateNodePosition(CHAIN_ID, "req-1", { x: 1, y: 1 });
    useChainStore.getState().updateNodePosition(CHAIN_ID, "req-1", { x: 2, y: 2 });
    useChainStore.getState().updateNodePosition(CHAIN_ID, "req-1", { x: 3, y: 3 });

    await vi.runAllTimersAsync();

    expect(db.put).toHaveBeenCalledTimes(1);
    expect(db.put).toHaveBeenCalledWith(
      "chains",
      expect.objectContaining({
        nodePositions: { "req-1": { x: 3, y: 3 } },
      }),
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
    const db = makeDb({ put: vi.fn(async () => { throw new Error("disk full"); }) });
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useChainStore.getState().renameChain(CHAIN_ID, "Will fail");
    await vi.runAllTimersAsync();

    expect(toast.error).toHaveBeenCalledWith(
      "Failed to save chain",
      expect.objectContaining({ description: "disk full" }),
    );
  });

  it("actions on an unknown chain id create a standalone chain on the fly", () => {
    useChainStore.getState().addRequestNode("brand-new", "req-1");
    expect(useChainStore.getState().chains["brand-new"].scope).toBe(
      "standalone",
    );
  });

  it("allNodeIds combines request ids and block ids", () => {
    const chain: Chain = {
      ...seedChain(),
      nodeIds: ["req-1"],
      blocks: [{ id: "delay-1", type: "delay", delayMs: 10 }],
    };
    expect(allNodeIds(chain)).toEqual(["req-1", "delay-1"]);
  });

  it("getNode resolves a block by id or returns undefined", () => {
    const block: DelayNodeConfig = { id: "delay-1", type: "delay", delayMs: 10 };
    const chain: Chain = { ...seedChain(), blocks: [block] };
    expect(getNode(chain, "delay-1")).toEqual(block);
    expect(getNode(chain, "missing")).toBeUndefined();
  });

  describe("detectSubchainCycle", () => {
    it("detects a direct self-reference", () => {
      const chainA: Chain = {
        ...seedChain("chain-a"),
        blocks: [
          {
            id: "sub-1",
            type: "subchain",
            chainId: "chain-a",
            inputBindings: {},
          },
        ],
      };
      useChainStore.setState({ chains: { "chain-a": chainA } });
      expect(useChainStore.getState().detectSubchainCycle("chain-a")).toBe(
        true,
      );
    });

    it("detects a transitive A -> B -> A reference", () => {
      const chainA: Chain = {
        ...seedChain("chain-a"),
        blocks: [
          {
            id: "sub-1",
            type: "subchain",
            chainId: "chain-b",
            inputBindings: {},
          },
        ],
      };
      const chainB: Chain = {
        ...seedChain("chain-b"),
        blocks: [
          {
            id: "sub-2",
            type: "subchain",
            chainId: "chain-a",
            inputBindings: {},
          },
        ],
      };
      useChainStore.setState({
        chains: { "chain-a": chainA, "chain-b": chainB },
      });
      expect(useChainStore.getState().detectSubchainCycle("chain-a")).toBe(
        true,
      );
      expect(useChainStore.getState().detectSubchainCycle("chain-b")).toBe(
        true,
      );
    });

    it("returns false when there is no cycle", () => {
      const chainA: Chain = {
        ...seedChain("chain-a"),
        blocks: [
          {
            id: "sub-1",
            type: "subchain",
            chainId: "chain-b",
            inputBindings: {},
          },
        ],
      };
      const chainB: Chain = seedChain("chain-b");
      useChainStore.setState({
        chains: { "chain-a": chainA, "chain-b": chainB },
      });
      expect(useChainStore.getState().detectSubchainCycle("chain-a")).toBe(
        false,
      );
    });
  });
});
