import { describe, expect, it } from "vitest";
import {
  type LegacyChainConfig,
  type LegacyStandaloneChain,
  MigrationError,
  migrateChainsToV5,
} from "./chainMigration";
import type { Chain } from "@/types/chain";

type StoredRecord = Record<string, unknown> & {
  id?: string;
  collectionId?: string;
  schemaVersion?: number;
};

/** The fake implements only the idb surface the migration touches, so the cast is confined here. */
function asMigrationDb(db: unknown): Parameters<typeof migrateChainsToV5>[0] {
  return db as Parameters<typeof migrateChainsToV5>[0];
}

/** Minimal in-memory fake of the subset of the idb API `chainMigration.ts` uses. */
function createFakeDb(seed: {
  chainConfigs?: Array<LegacyChainConfig & { schemaVersion?: number }>;
  chains?: Array<(LegacyStandaloneChain | Chain) & { schemaVersion?: number }>;
}) {
  const stores: Record<string, Map<string, StoredRecord>> = {
    chainConfigs: new Map((seed.chainConfigs ?? []).map((c) => [c.collectionId, c])),
    chains: new Map((seed.chains ?? []).map((c) => [c.id, c])),
  };

  return {
    async getAll(storeName: string) {
      return Array.from(stores[storeName].values());
    },
    transaction(storeNames: string[], _mode: "readwrite") {
      let aborted = false;
      const tx = {
        objectStore(name: string) {
          return {
            async get(key: string) {
              return stores[name].get(key);
            },
            async put(value: StoredRecord) {
              if (aborted) throw new Error("transaction aborted");
              const key = (name === "chainConfigs" ? value.collectionId : value.id) as string;
              stores[name].set(key, value);
            },
          };
        },
        abort() {
          aborted = true;
        },
        get done() {
          return Promise.resolve();
        },
      };
      return tx;
    },
    _stores: stores,
  };
}

describe("migrateChainsToV5", () => {
  it("migrates a legacy chainConfigs record into a v5 Chain with nodes, edges, and positions intact", async () => {
    const db = createFakeDb({
      chainConfigs: [
        {
          collectionId: "col-1",
          edges: [
            {
              id: "e1",
              sourceRequestId: "r1",
              targetRequestId: "r2",
              injections: [{ sourceJsonPath: "$.a", targetField: "header", targetKey: "X" }],
            },
          ],
          nodePositions: { r1: { x: 0, y: 0 } },
          nodeIds: ["r1", "r2"],
          delayNodes: [{ id: "d1", type: "delay", delayMs: 100 }],
        },
      ],
    });

    await migrateChainsToV5(asMigrationDb(db), new Map([["col-1", "My Collection"]]));

    const chain = db._stores.chains.get("col-1") as Chain;
    expect(chain.scope).toBe("collection");
    expect(chain.schemaVersion).toBe(5);
    expect(chain.name).toBe("My Collection");
    expect(chain.nodeIds).toEqual(["r1", "r2"]);
    expect(chain.edges).toHaveLength(1);
    expect(chain.nodePositions.r1).toEqual({ x: 0, y: 0 });
    expect(chain.blocks).toEqual([{ id: "d1", type: "delay", delayMs: 100 }]);

    const config = db._stores.chainConfigs.get("col-1");
    expect(config?.schemaVersion).toBe(5);
  });

  it("uses the fallback name when the collection name snapshot has no entry", async () => {
    const db = createFakeDb({
      chainConfigs: [{ collectionId: "col-2", edges: [], nodePositions: {} }],
    });
    await migrateChainsToV5(asMigrationDb(db), new Map());
    const chain = db._stores.chains.get("col-2") as Chain;
    expect(chain.name).toBe("Collection chain");
  });

  it("upgrades a legacy-shape standalone chains record in place", async () => {
    const db = createFakeDb({
      chains: [
        {
          id: "standalone-1",
          name: "My Chain",
          createdAt: 123,
          edges: [],
          nodePositions: {},
          nodeIds: ["r1"],
          historyNodes: [{ id: "h1", historyEntryId: "he1", name: "Req", method: "GET", url: "/x", params: [], headers: [], auth: { type: "none" }, body: { type: "none", content: "" } }],
        },
      ],
    });

    await migrateChainsToV5(asMigrationDb(db), new Map());

    const chain = db._stores.chains.get("standalone-1") as Chain;
    expect(chain.scope).toBe("standalone");
    expect(chain.schemaVersion).toBe(5);
    expect(chain.blocks).toEqual([
      { id: "h1", historyEntryId: "he1", name: "Req", method: "GET", url: "/x", params: [], headers: [], auth: { type: "none" }, body: { type: "none", content: "" }, type: "history" },
    ]);
  });

  it("throws MigrationError for a non-v5 record missing historyNodes", async () => {
    const db = createFakeDb({
      chains: [{ id: "bad-1", name: "Broken", createdAt: 1 } as unknown as LegacyStandaloneChain],
    });

    await expect(migrateChainsToV5(asMigrationDb(db), new Map())).rejects.toBeInstanceOf(MigrationError);
  });

  it("throws MigrationError for a non-v5 record with a non-string id", async () => {
    const db = createFakeDb({
      chains: [{ id: 42, name: "Broken", historyNodes: [] } as unknown as LegacyStandaloneChain],
    });

    await expect(migrateChainsToV5(asMigrationDb(db), new Map())).rejects.toBeInstanceOf(MigrationError);
  });

  it("is idempotent when run twice", async () => {
    const db = createFakeDb({
      chainConfigs: [{ collectionId: "col-1", edges: [], nodePositions: {}, nodeIds: [] }],
    });
    await migrateChainsToV5(asMigrationDb(db), new Map([["col-1", "A"]]));
    const firstChain = db._stores.chains.get("col-1");
    await migrateChainsToV5(asMigrationDb(db), new Map([["col-1", "A"]]));
    const secondChain = db._stores.chains.get("col-1");
    expect(secondChain).toEqual(firstChain);
  });

  it("throws MigrationError on an id collision with a standalone chain", async () => {
    const db = createFakeDb({
      chainConfigs: [{ collectionId: "shared-id", edges: [], nodePositions: {}, nodeIds: [] }],
      chains: [
        {
          id: "shared-id",
          name: "Standalone",
          createdAt: 1,
          edges: [],
          nodePositions: {},
          nodeIds: [],
          historyNodes: [],
        } as LegacyStandaloneChain,
      ],
    });

    await expect(
      migrateChainsToV5(asMigrationDb(db), new Map([["shared-id", "Collection"]])),
    ).rejects.toThrow(MigrationError);
  });

  it("throws on record 3 of 5, leaving records 1-2 migrated and 4-5 untouched", async () => {
    const configs = [1, 2, 3, 4, 5].map((n) => ({
      collectionId: `col-${n}`,
      edges: [],
      nodePositions: {},
      nodeIds: [],
    }));
    const db = createFakeDb({ chainConfigs: configs });

    // Force a collision on the 3rd record by pre-seeding a mismatched standalone chain.
    db._stores.chains.set("col-3", {
      id: "col-3",
      name: "Standalone",
      createdAt: 1,
      edges: [],
      nodePositions: {},
      nodeIds: [],
      historyNodes: [],
    });

    await expect(
      migrateChainsToV5(asMigrationDb(db), new Map()),
    ).rejects.toThrow(MigrationError);

    expect(db._stores.chainConfigs.get("col-1")?.schemaVersion).toBe(5);
    expect(db._stores.chainConfigs.get("col-2")?.schemaVersion).toBe(5);
    expect(db._stores.chainConfigs.get("col-3")?.schemaVersion).toBeUndefined();
    expect(db._stores.chainConfigs.get("col-4")?.schemaVersion).toBeUndefined();
    expect(db._stores.chainConfigs.get("col-5")?.schemaVersion).toBeUndefined();
  });
});
