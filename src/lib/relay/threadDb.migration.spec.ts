/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDB_DB_NAME, IDB_STORES } from "@/lib/idbSchema";
import { RELAY_WORKSPACE_ID } from "./constants";

const PREVIOUS_VERSION = 5;
const RELAY_STORE_NAMES = ["relay_threads", "relay_changes"];

const COLLECTION = { id: "col-1", name: "Existing collection" };
const REQUEST = { id: "req-1", collectionId: "col-1", name: "Existing request" };
const HISTORY = { id: "h-1", timestamp: 42 };

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Builds the database exactly as the v5 app left it: every store except the relay ones. */
async function createVersion5Database(): Promise<void> {
  const opening = indexedDB.open(IDB_DB_NAME, PREVIOUS_VERSION);
  opening.onupgradeneeded = () => {
    const database = opening.result;
    for (const store of IDB_STORES) {
      if (RELAY_STORE_NAMES.includes(store.name)) continue;
      const objectStore = database.createObjectStore(
        store.name,
        store.keyPath ? { keyPath: store.keyPath } : undefined,
      );
      for (const index of store.indexes ?? []) {
        objectStore.createIndex(index.name, index.keyPath);
      }
    }
  };
  const database = await promisify(opening);
  const tx = database.transaction(["collections", "requests", "history"], "readwrite");
  tx.objectStore("collections").put(COLLECTION);
  tx.objectStore("requests").put(REQUEST);
  tx.objectStore("history").put(HISTORY);
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
  // An open v5 connection would block the upgrade, as in a real second tab.
  database.close();
}

beforeEach(() => {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
});

describe("IndexedDB v5 to v6 migration", () => {
  it("upgrades a v5 database without losing existing data", async () => {
    await createVersion5Database();
    const { getDB } = await import("@/lib/idb");

    const database = await getDB();

    expect(database?.version).toBe(6);
    expect(await database?.get("collections", COLLECTION.id)).toEqual(COLLECTION);
    expect(await database?.get("requests", REQUEST.id)).toEqual(REQUEST);
    expect(await database?.get("history", HISTORY.id)).toEqual(HISTORY);
    expect(await database?.getAllFromIndex("requests", "by-collection", "col-1")).toEqual([
      REQUEST,
    ]);
  });

  it("adds the relay stores with their keys and indexes", async () => {
    await createVersion5Database();
    const { getDB } = await import("@/lib/idb");

    const database = await getDB();
    const tx = database!.transaction(RELAY_STORE_NAMES as ["relay_threads", "relay_changes"]);

    expect(tx.objectStore("relay_threads").keyPath).toBe("id");
    expect(tx.objectStore("relay_threads").index("by-workspace").keyPath).toEqual([
      "workspaceId",
      "updatedAt",
    ]);
    expect(tx.objectStore("relay_changes").keyPath).toBe("id");
    expect(tx.objectStore("relay_changes").index("by-thread").keyPath).toBe("threadId");
  });

  it("lets threadDb create and read threads on the upgraded database", async () => {
    await createVersion5Database();
    const threadDb = await import("./threadDb");

    const { thread } = await threadDb.createThread({ workspaceId: RELAY_WORKSPACE_ID });

    expect((await threadDb.listThreads(RELAY_WORKSPACE_ID)).map((t) => t.id)).toEqual([
      thread.id,
    ]);
  });

  it("creates every store on a fresh install", async () => {
    const { getDB } = await import("@/lib/idb");

    const database = await getDB();

    expect([...(database?.objectStoreNames ?? [])].sort()).toEqual(
      IDB_STORES.map((store) => store.name).sort(),
    );
  });
});
