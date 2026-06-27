import type { IDBPDatabase } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDB_DB_NAME } from "./constants";

vi.mock("idb", () => ({
  openDB: vi.fn(() =>
    Promise.resolve({} as unknown as IDBPDatabase<Record<string, unknown>>),
  ),
}));

function defaultOpenDbImpl() {
  return Promise.resolve(
    {} as unknown as IDBPDatabase<Record<string, unknown>>,
  );
}

describe("getDB", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    const { openDB } = await import("idb");
    vi.mocked(openDB).mockImplementation(defaultOpenDbImpl as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when window is undefined", async () => {
    const { openDB } = await import("idb");
    const { getDB } = await import("./idb");
    expect(getDB()).toBeNull();
    expect(vi.mocked(openDB)).not.toHaveBeenCalled();
  });

  it("calls openDB with schema version when window is defined", async () => {
    vi.stubGlobal("window", {} as Window);
    const { openDB } = await import("idb");
    const { getDB } = await import("./idb");
    const p = getDB();
    expect(p).not.toBeNull();
    await p;
    expect(vi.mocked(openDB)).toHaveBeenCalledWith(
      IDB_DB_NAME,
      4,
      expect.objectContaining({
        upgrade: expect.any(Function),
      }),
    );
  });

  it("reuses the same promise on subsequent calls", async () => {
    vi.stubGlobal("window", {} as Window);
    const { getDB } = await import("./idb");
    const { openDB } = await import("idb");
    const a = getDB();
    const b = getDB();
    expect(a).toBe(b);
    await a;
    expect(vi.mocked(openDB)).toHaveBeenCalledTimes(1);
  });

  it("runs upgrade handler to create object stores and indexes", async () => {
    vi.stubGlobal("window", {} as Window);
    const { openDB } = await import("idb");
    const createdStores: string[] = [];
    const indexCalls: Array<[string, string]> = [];

    vi.mocked(openDB).mockImplementation(
      ((_name: string, _version: number, opts?: { upgrade?: (db: unknown) => void }) => {
        const present = new Set<string>();
        const db = {
          objectStoreNames: {
            contains: (name: string) => present.has(name),
          },
          createObjectStore: (name: string) => {
            present.add(name);
            createdStores.push(name);
            return {
              createIndex: (idx: string, keyPath: string) => {
                indexCalls.push([idx, keyPath]);
              },
            };
          },
        };
        opts?.upgrade?.(db);
        return Promise.resolve(
          {} as unknown as IDBPDatabase<Record<string, unknown>>,
        );
      }) as any
    );

    const { getDB } = await import("./idb");
    await getDB();
    expect(createdStores).toEqual([
      "collections",
      "requests",
      "folders",
      "environments",
      "history",
      "tabs",
      "settings",
      "chainConfigs",
      "chains",
    ]);
    expect(indexCalls).toContainEqual(["by-collection", "collectionId"]);
    expect(indexCalls).toContainEqual(["by-timestamp", "timestamp"]);
  });
});
