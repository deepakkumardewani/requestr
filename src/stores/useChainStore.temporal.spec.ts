import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { migrateChainsToV5 } from "@/lib/chainMigration";
import {
  CHAIN_NODE_TYPES,
  type Chain,
  type ChainBlock,
  type ChainNodeType,
} from "@/types/chain";
import { persistChain, useChainStore } from "./useChainStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

vi.mock("@/lib/chainMigration", () => ({
  migrateChainsToV5: vi.fn(),
  MigrationError: class MigrationError extends Error {},
}));

const CHAIN_ID = "chain-1";

function seedChain(): Chain {
  return {
    id: CHAIN_ID,
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

describe("useChainStore — temporal (undo/redo)", () => {
  beforeEach(() => {
    useChainStore.setState({
      chains: { [CHAIN_ID]: seedChain() },
      hydrated: true,
      history: {},
    });
    vi.mocked(getDB).mockReturnValue(undefined as never);
    vi.mocked(migrateChainsToV5).mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await persistChain.flush();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("has no history entries for a freshly loaded chain", () => {
    expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();
  });

  it("addRequestNode is undoable and redoable", () => {
    const { addRequestNode, undo, redo } = useChainStore.getState();
    addRequestNode(CHAIN_ID, "req-1");
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
      "req-1",
    ]);

    undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([]);

    redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
      "req-1",
    ]);
  });

  it("removeNode (delete) is undoable and redoable", () => {
    const store = useChainStore.getState();
    store.addRequestNode(CHAIN_ID, "req-1");
    store.removeNode(CHAIN_ID, "req-1");
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([]);

    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
      "req-1",
    ]);

    store.redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([]);
  });

  it("removeNodes deletes several nodes as ONE undo entry", () => {
    const store = useChainStore.getState();
    for (const id of ["r1", "r2", "r3"]) store.addRequestNode(CHAIN_ID, id);
    store.removeNodes(CHAIN_ID, ["r1", "r2", "r3"]);
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([]);

    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
      "r1",
      "r2",
      "r3",
    ]);
  });

  it("undo after a rename does not silently restore the old name", () => {
    const store = useChainStore.getState();
    store.addRequestNode(CHAIN_ID, "r1");
    store.renameChain(CHAIN_ID, "Renamed");
    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].name).toBe("Test chain");
    store.redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].name).toBe("Renamed");

    store.addRequestNode(CHAIN_ID, "r2");
    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].name).toBe("Renamed");
  });

  it("duplicateNode on a Loop creates Loop + rebound Collect in one undo entry", () => {
    const store = useChainStore.getState();
    store.upsertBlock(CHAIN_ID, {
      id: "loop-1",
      type: "loop",
      sourceJsonPath: "$.items",
      itemAlias: "item",
      maxIterations: 10,
    });
    store.upsertBlock(CHAIN_ID, { id: "collect-1", type: "collect", loopId: "loop-1" });
    const newLoopId = store.duplicateNode(CHAIN_ID, "loop-1");

    const blocks = useChainStore.getState().chains[CHAIN_ID].blocks;
    expect(blocks).toHaveLength(4);
    const newCollect = blocks.find(
      (b) => b.type === "collect" && b.id !== "collect-1",
    );
    expect(newCollect).toMatchObject({ loopId: newLoopId });

    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toHaveLength(2);
  });

  it("upsertEdge (connect) is undoable and redoable", () => {
    const store = useChainStore.getState();
    const edge = {
      id: "edge-1",
      sourceRequestId: "req-1",
      targetRequestId: "req-2",
      injections: [],
    };
    store.upsertEdge(CHAIN_ID, edge);
    expect(useChainStore.getState().chains[CHAIN_ID].edges).toEqual([edge]);

    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].edges).toEqual([]);

    store.redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].edges).toEqual([edge]);
  });

  it("updateNodePosition (move) is undoable and redoable", () => {
    const store = useChainStore.getState();
    store.updateNodePosition(CHAIN_ID, "req-1", { x: 10, y: 20 });
    expect(useChainStore.getState().chains[CHAIN_ID].nodePositions).toEqual({
      "req-1": { x: 10, y: 20 },
    });

    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodePositions).toEqual(
      {},
    );

    store.redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodePositions).toEqual({
      "req-1": { x: 10, y: 20 },
    });
  });

  it("upsertNodeAssertions (config edit) is undoable and redoable", () => {
    const store = useChainStore.getState();
    const assertions = [
      {
        id: "a-1",
        source: "status" as const,
        operator: "eq" as const,
        expectedValue: "200",
        enabled: true,
      },
    ];
    store.upsertNodeAssertions(CHAIN_ID, "req-1", assertions);
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"],
    ).toEqual(assertions);

    store.undo(CHAIN_ID);
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"],
    ).toBeUndefined();

    store.redo(CHAIN_ID);
    expect(
      useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.["req-1"],
    ).toEqual(assertions);
  });

  it("a paused-then-resumed drag produces exactly one history entry", () => {
    const store = useChainStore.getState();
    store.pauseHistory(CHAIN_ID);
    store.updateNodePosition(CHAIN_ID, "req-1", { x: 1, y: 1 });
    store.updateNodePosition(CHAIN_ID, "req-1", { x: 2, y: 2 });
    store.updateNodePosition(CHAIN_ID, "req-1", { x: 3, y: 3 });
    // Mid-drag: no history entry recorded yet.
    expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();

    store.resumeHistory(CHAIN_ID);
    expect(useChainStore.getState().history[CHAIN_ID]?.past).toHaveLength(1);

    store.undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID].nodePositions).toEqual(
      {},
    );
  });

  it("resumeHistory is a no-op if pauseHistory was never called", () => {
    const store = useChainStore.getState();
    store.resumeHistory(CHAIN_ID);
    expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();
  });

  it("undo/redo on a chain with no history is a no-op", () => {
    const store = useChainStore.getState();
    const before = useChainStore.getState().chains[CHAIN_ID];
    store.undo(CHAIN_ID);
    store.redo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID]).toEqual(before);
  });

  it("history is never included in the persisted chain payload", async () => {
    const put = vi.fn(async () => undefined);
    vi.mocked(getDB).mockReturnValue(
      Promise.resolve({ put, delete: vi.fn() } as never),
    );
    const store = useChainStore.getState();
    store.addRequestNode(CHAIN_ID, "req-1");
    await persistChain.flush(CHAIN_ID);

    expect(put).toHaveBeenCalledTimes(1);
    const [, persisted] = put.mock.calls[0] as unknown as [string, Chain];
    expect(persisted).not.toHaveProperty("history");
  });

  it("deleting a node cascades its edges, positions, and assertions in one undoable step", () => {
    const store = useChainStore.getState();
    store.addRequestNode(CHAIN_ID, "req-1");
    store.addRequestNode(CHAIN_ID, "req-2");
    store.upsertEdge(CHAIN_ID, {
      id: "edge-1",
      sourceRequestId: "req-1",
      targetRequestId: "req-2",
      injections: [],
    });
    store.updateNodePosition(CHAIN_ID, "req-1", { x: 5, y: 5 });
    store.upsertNodeAssertions(CHAIN_ID, "req-1", [
      {
        id: "a-1",
        source: "status",
        operator: "eq",
        expectedValue: "200",
        enabled: true,
      },
    ]);
    const entriesBefore = useChainStore.getState().history[CHAIN_ID]?.past
      .length;

    store.removeNode(CHAIN_ID, "req-1");
    const afterDelete = useChainStore.getState().chains[CHAIN_ID];
    expect(afterDelete.nodeIds).toEqual(["req-2"]);
    expect(afterDelete.edges).toEqual([]);
    expect(afterDelete.nodePositions["req-1"]).toBeUndefined();
    expect(afterDelete.nodeAssertions?.["req-1"]).toBeUndefined();
    // The cascading delete is exactly one history entry.
    expect(useChainStore.getState().history[CHAIN_ID]?.past.length).toBe(
      (entriesBefore ?? 0) + 1,
    );

    store.undo(CHAIN_ID);
    const restored = useChainStore.getState().chains[CHAIN_ID];
    expect(restored.nodeIds).toEqual(["req-1", "req-2"]);
    expect(restored.edges).toEqual([
      { id: "edge-1", sourceRequestId: "req-1", targetRequestId: "req-2", injections: [] },
    ]);
    expect(restored.nodePositions["req-1"]).toEqual({ x: 5, y: 5 });
    expect(restored.nodeAssertions?.["req-1"]).toHaveLength(1);

    store.redo(CHAIN_ID);
    const redone = useChainStore.getState().chains[CHAIN_ID];
    expect(redone.nodeIds).toEqual(["req-2"]);
    expect(redone.edges).toEqual([]);
  });

  it("undo and redo flush the pending debounced write immediately", async () => {
    const put = vi.fn(async () => undefined);
    vi.mocked(getDB).mockReturnValue(
      Promise.resolve({ put, delete: vi.fn() } as never),
    );
    const store = useChainStore.getState();
    store.addRequestNode(CHAIN_ID, "req-1");
    store.undo(CHAIN_ID);
    // undo() calls persistChain.flush(chainId) synchronously after the set() —
    // awaiting a microtask lets the in-flight flush promise settle.
    await Promise.resolve();
    await Promise.resolve();
    expect(put).toHaveBeenCalled();
  });

  it("hydrating a chain does not create a history entry (first undo after load is a no-op)", async () => {
    const chain = seedChain();
    const put = vi.fn(async () => undefined);
    vi.mocked(getDB).mockReturnValue(
      Promise.resolve({
        put,
        delete: vi.fn(),
        getAll: vi.fn(async (store: string) =>
          store === "chains" ? [chain] : [],
        ),
      } as never),
    );
    useChainStore.setState({ chains: {}, hydrated: false, history: {} });

    await useChainStore.getState().hydrate();

    expect(useChainStore.getState().chains[CHAIN_ID]).toBeDefined();
    expect(useChainStore.getState().history[CHAIN_ID]).toBeUndefined();

    const before = useChainStore.getState().chains[CHAIN_ID];
    useChainStore.getState().undo(CHAIN_ID);
    expect(useChainStore.getState().chains[CHAIN_ID]).toEqual(before);
  });

  it("undo/redo on one chain never touches another chain's history (per-chain scoping covers chain switch)", () => {
    const OTHER_ID = "chain-2";
    useChainStore.setState((state) => ({
      chains: { ...state.chains, [OTHER_ID]: { ...seedChain(), id: OTHER_ID } },
    }));
    const store = useChainStore.getState();
    store.addRequestNode(CHAIN_ID, "req-1");
    store.addRequestNode(OTHER_ID, "req-a");

    store.undo(OTHER_ID);
    expect(useChainStore.getState().chains[OTHER_ID].nodeIds).toEqual([]);
    // The other chain's history is untouched by an undo on this one.
    expect(useChainStore.getState().chains[CHAIN_ID].nodeIds).toEqual([
      "req-1",
    ]);
  });

  describe("per-block-type undo coverage (CHAIN_NODE_TYPES facet matrix)", () => {
    function makeBlock(type: ChainNodeType, id: string): ChainBlock | null {
      switch (type) {
        case "delay":
          return { id, type: "delay", delayMs: 1000 };
        case "condition":
          return {
            id,
            type: "condition",
            variable: "{{role}}",
            branches: [{ id: "else", label: "else", expression: "" }],
          };
        case "display":
          return {
            id,
            type: "display",
            sourceJsonPath: "$.data.token",
            targetField: "header",
            targetKey: "Authorization",
          };
        case "start":
          return {
            id,
            type: "start",
            inputs: [{ key: "token", defaultValue: "abc", source: "literal" }],
          };
        case "evaluate":
          return {
            id,
            type: "evaluate",
            code: "return data.response.token;",
            outputAlias: "token",
          };
        case "validate":
          return {
            id,
            type: "validate",
            schema: '{"type":"object"}',
            sourceJsonPath: "$.data.token",
          };
        case "merge":
          return { id, type: "merge", mode: "any" };
        case "loop":
          return {
            id,
            type: "loop",
            sourceJsonPath: "$.data.items",
            itemAlias: "item",
            maxIterations: 100,
          };
        case "collect":
          return { id, type: "collect", loopId: "loop-1" };
        case "subchain":
          return {
            id,
            type: "subchain",
            chainId: "other-chain",
            inputBindings: { token: "{{req-1.token}}" },
          };
        case "api":
          // API nodes are request references (`nodeIds`), not `blocks` — exercised
          // separately below via addRequestNode/removeNode.
          return null;
        default:
          return null;
      }
    }

    it("covers every block type in CHAIN_NODE_TYPES", () => {
      expect(new Set(CHAIN_NODE_TYPES)).toEqual(
        new Set([
          "api",
          "delay",
          "condition",
          "display",
          "start",
          "evaluate",
          "validate",
          "merge",
          "loop",
          "collect",
          "subchain",
        ]),
      );
    });

    for (const type of CHAIN_NODE_TYPES) {
      if (type === "api") {
        it(`api: add / delete / config-edit each undo and redo cleanly`, () => {
          const store = useChainStore.getState();
          store.addRequestNode(CHAIN_ID, "req-api");
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeIds,
          ).toContain("req-api");
          store.undo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeIds,
          ).not.toContain("req-api");
          store.redo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeIds,
          ).toContain("req-api");

          store.upsertNodeAssertions(CHAIN_ID, "req-api", [
            {
              id: "a-api",
              source: "status",
              operator: "eq",
              expectedValue: "200",
              enabled: true,
            },
          ]);
          store.undo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.[
              "req-api"
            ],
          ).toBeUndefined();
          store.redo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeAssertions?.[
              "req-api"
            ],
          ).toHaveLength(1);

          store.removeNode(CHAIN_ID, "req-api");
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeIds,
          ).not.toContain("req-api");
          store.undo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeIds,
          ).toContain("req-api");
          store.redo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].nodeIds,
          ).not.toContain("req-api");
        });
        continue;
      }

      it(`${type}: add / delete / duplicate / config-edit each undo and redo cleanly`, () => {
        const store = useChainStore.getState();
        const id = `${type}-1`;
        const block = makeBlock(type, id);
        if (!block) throw new Error(`no block fixture for ${type}`);

        // add
        store.upsertBlock(CHAIN_ID, block);
        expect(
          useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
        ).toContain(id);
        store.undo(CHAIN_ID);
        expect(
          useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
        ).not.toContain(id);
        store.redo(CHAIN_ID);
        expect(
          useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
        ).toContain(id);

        // config-edit
        const edited: ChainBlock =
          block.type === "delay"
            ? { ...block, delayMs: 2000 }
            : block.type === "condition"
              ? { ...block, variable: "{{env}}" }
              : block.type === "display"
                ? { ...block, targetKey: "X-Token" }
                : block.type === "start"
                  ? {
                      ...block,
                      inputs: [
                        { key: "renamed", defaultValue: "abc", source: "literal" },
                      ],
                    }
                  : block.type === "evaluate"
                    ? { ...block, outputAlias: "renamedToken" }
                    : block.type === "validate"
                      ? { ...block, sourceJsonPath: "$.data.id" }
                      : block.type === "merge"
                        ? { ...block, mode: "all" }
                        : block.type === "loop"
                          ? { ...block, maxIterations: 5 }
                          : block.type === "collect"
                            ? { ...block, loopId: "loop-2" }
                            : block.type === "subchain"
                              ? { ...block, chainId: "other-chain-2" }
                              : block;
        store.upsertBlock(CHAIN_ID, edited);
        store.undo(CHAIN_ID);
        expect(
          useChainStore
            .getState()
            .chains[CHAIN_ID].blocks.find((b) => b.id === id),
        ).toEqual(block);
        store.redo(CHAIN_ID);
        expect(
          useChainStore
            .getState()
            .chains[CHAIN_ID].blocks.find((b) => b.id === id),
        ).toEqual(edited);

        // duplicate — refused for "start": at most one Start block per chain.
        if (type === "start") {
          const dupId = store.duplicateNode(CHAIN_ID, id);
          expect(dupId).toBeNull();
          expect(
            useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
          ).toEqual([id]);
        } else {
          const dupId = store.duplicateNode(CHAIN_ID, id);
          expect(dupId).not.toBeNull();
          expect(
            useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
          ).toContain(dupId);
          store.undo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
          ).not.toContain(dupId);
          store.redo(CHAIN_ID);
          expect(
            useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
          ).toContain(dupId);
        }

        // delete
        store.removeNode(CHAIN_ID, id);
        expect(
          useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
        ).not.toContain(id);
        store.undo(CHAIN_ID);
        expect(
          useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
        ).toContain(id);
        store.redo(CHAIN_ID);
        expect(
          useChainStore.getState().chains[CHAIN_ID].blocks.map((b) => b.id),
        ).not.toContain(id);
      });
    }
  });

  describe("assertion edit coalescing", () => {
    // The coalescing run is module state and useFakeTimers rewinds the clock each
    // test, so pin every test to a later instant than the previous one.
    let clock = Date.now();
    beforeEach(() => {
      clock += 60_000;
      vi.setSystemTime(clock);
    });

    const edit = (n: number) =>
      useChainStore
        .getState()
        .upsertNodeAssertions(CHAIN_ID, "req-1", [
          { id: "a", source: "status", operator: "eq", expectedValue: String(n), enabled: true },
        ]);

    it("collapses rapid edits to the same node into one undo entry", () => {
      edit(1);
      vi.advanceTimersByTime(100);
      edit(2);
      vi.advanceTimersByTime(100);
      edit(3);
      expect(useChainStore.getState().history[CHAIN_ID].past).toHaveLength(1);

      useChainStore.getState().undo(CHAIN_ID);
      expect(useChainStore.getState().chains[CHAIN_ID].nodeAssertions).toBeUndefined();
    });

    it("starts a new undo entry after the coalescing window elapses", () => {
      edit(1);
      vi.advanceTimersByTime(5000);
      edit(2);
      expect(useChainStore.getState().history[CHAIN_ID].past).toHaveLength(2);
    });

    it("does not coalesce across an intervening different mutation", () => {
      edit(1);
      useChainStore.getState().addRequestNode(CHAIN_ID, "req-2");
      edit(2);
      expect(useChainStore.getState().history[CHAIN_ID].past).toHaveLength(3);
    });

    it("does not coalesce edits to different nodes", () => {
      edit(1);
      useChainStore.getState().upsertNodeAssertions(CHAIN_ID, "req-2", []);
      expect(useChainStore.getState().history[CHAIN_ID].past).toHaveLength(2);
    });
  });
});
