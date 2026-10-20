import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_RECENTS_CAP, RELAY_STORAGE_KEYS } from "@/lib/relay/constants";
import { useRelayRecentStore, type RelayRecentItem } from "./useRelayRecentStore";

let localStore: Record<string, string> = {};

function mockLocalStorage() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
  });
}

async function importWithStorage(data: Record<string, string>) {
  localStore = { ...data };
  mockLocalStorage();
  vi.resetModules();
  const module = await import("./useRelayRecentStore");
  return module.useRelayRecentStore;
}

beforeEach(() => {
  mockLocalStorage();
  useRelayRecentStore.setState({ items: [] });
});

afterEach(() => {
  for (const k of Object.keys(localStore)) delete localStore[k];
  vi.unstubAllGlobals();
});

describe("useRelayRecentStore", () => {
  it("starts with an empty recents list", () => {
    expect(useRelayRecentStore.getState().items).toEqual([]);
  });

  describe("import-time initialization", () => {
    it("reads and filters persisted items on import", async () => {
      const data = {
        [RELAY_STORAGE_KEYS.recent]: JSON.stringify([
          { kind: "request", id: "r1", name: "Get users" },
          { kind: "chain", id: "c1", name: "Checkout" },
        ]),
      };
      const store = await importWithStorage(data);
      expect(store.getState().items).toEqual([
        { kind: "request", id: "r1", name: "Get users" },
        { kind: "chain", id: "c1", name: "Checkout" },
      ]);
    });

    it("ignores stored items that are not valid RecentItem objects", async () => {
      const data = {
        [RELAY_STORAGE_KEYS.recent]: JSON.stringify([
          { kind: "request", id: "r1", name: "Get users" },
          null,
          { kind: "request", id: "r2" },
          { kind: "request" },
          { id: "r3", name: "No kind" },
          { kind: "request", id: "r4", name: "Valid again" },
        ]),
      };
      const store = await importWithStorage(data);
      expect(store.getState().items).toEqual([
        { kind: "request", id: "r1", name: "Get users" },
        { kind: "request", id: "r4", name: "Valid again" },
      ]);
    });

    it("treats non-array JSON as no recents", async () => {
      const data = {
        [RELAY_STORAGE_KEYS.recent]: JSON.stringify({
          kind: "request",
          id: "r1",
          name: "Object not array",
        }),
      };
      const store = await importWithStorage(data);
      expect(store.getState().items).toEqual([]);
    });

    it("treats empty string as no recents", async () => {
      const data = { [RELAY_STORAGE_KEYS.recent]: "" };
      const store = await importWithStorage(data);
      expect(store.getState().items).toEqual([]);
    });

    it("slices persisted items to the cap on read", async () => {
      const items: RelayRecentItem[] = Array.from({ length: 7 }, (_, i) => ({
        kind: "request",
        id: `r${i}`,
        name: `Request ${i}`,
      }));
      const data = {
        [RELAY_STORAGE_KEYS.recent]: JSON.stringify(items),
      };
      const store = await importWithStorage(data);
      expect(store.getState().items).toHaveLength(RELAY_RECENTS_CAP);
      expect(store.getState().items).toEqual(items.slice(0, RELAY_RECENTS_CAP));
    });

    it("logs a warning and returns empty list when getItem throws", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      vi.resetModules();
      const { useRelayRecentStore: store } = await import("./useRelayRecentStore");
      expect(store.getState().items).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        "[relay] reading recents failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.recent }),
      );
      warn.mockRestore();
    });

    it("handles undefined localStorage at import time", async () => {
      vi.stubGlobal("localStorage", undefined);
      vi.resetModules();
      const { useRelayRecentStore: store } = await import("./useRelayRecentStore");
      expect(store.getState().items).toEqual([]);
    });

    it("treats non-JSON data as no recents", async () => {
      const data = {
        [RELAY_STORAGE_KEYS.recent]: "not valid json {[",
      };
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const store = await importWithStorage(data);
      expect(store.getState().items).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        "[relay] reading recents failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.recent }),
      );
      warn.mockRestore();
    });
  });

  describe("recordRecent", () => {
    beforeEach(() => {
      useRelayRecentStore.setState({
        items: [
          { kind: "request", id: "r1", name: "Old request" },
          { kind: "chain", id: "c1", name: "Old chain" },
        ],
      });
    });

    it("adds a new item to the front", () => {
      const chip = { kind: "request" as const, id: "r2", label: "New request" };
      useRelayRecentStore.getState().recordRecent(chip);
      expect(useRelayRecentStore.getState().items).toEqual([
        { kind: "request", id: "r2", name: "New request" },
        { kind: "request", id: "r1", name: "Old request" },
        { kind: "chain", id: "c1", name: "Old chain" },
      ]);
    });

    it("moves an existing item to the front and deduplicates by kind and id", () => {
      const chip = { kind: "request" as const, id: "r1", label: "Updated request" };
      useRelayRecentStore.getState().recordRecent(chip);
      expect(useRelayRecentStore.getState().items).toEqual([
        { kind: "request", id: "r1", name: "Updated request" },
        { kind: "chain", id: "c1", name: "Old chain" },
      ]);
    });

    it("keeps the same kind and id with different labels", () => {
      const chip = { kind: "chain" as const, id: "c1", label: "New label" };
      useRelayRecentStore.getState().recordRecent(chip);
      expect(useRelayRecentStore.getState().items).toEqual([
        { kind: "chain", id: "c1", name: "New label" },
        { kind: "request", id: "r1", name: "Old request" },
      ]);
    });

    it("allows items with the same id but different kinds", () => {
      const chip = { kind: "chain" as const, id: "r1", label: "Chain with same id" };
      useRelayRecentStore.getState().recordRecent(chip);
      expect(useRelayRecentStore.getState().items).toEqual([
        { kind: "chain", id: "r1", name: "Chain with same id" },
        { kind: "request", id: "r1", name: "Old request" },
        { kind: "chain", id: "c1", name: "Old chain" },
      ]);
    });

    it("caps the list at RELAY_RECENTS_CAP items", () => {
      useRelayRecentStore.setState({
        items: Array.from({ length: RELAY_RECENTS_CAP }, (_, i) => ({
          kind: "request" as const,
          id: `r${i}`,
          name: `Request ${i}`,
        })),
      });
      const chip = {
        kind: "request" as const,
        id: "r-new",
        label: "Newest",
      };
      useRelayRecentStore.getState().recordRecent(chip);
      expect(useRelayRecentStore.getState().items).toHaveLength(RELAY_RECENTS_CAP);
      expect(useRelayRecentStore.getState().items[0]).toEqual({
        kind: "request",
        id: "r-new",
        name: "Newest",
      });
    });

    it("persists items to localStorage", () => {
      useRelayRecentStore.setState({ items: [] });
      const chip = { kind: "request" as const, id: "r1", label: "Request" };
      useRelayRecentStore.getState().recordRecent(chip);
      const stored = localStore[RELAY_STORAGE_KEYS.recent];
      expect(stored).toBe(JSON.stringify([{ kind: "request", id: "r1", name: "Request" }]));
    });

    it("persists names and ids only, not request bodies or values", () => {
      useRelayRecentStore.setState({ items: [] });
      const chip = { kind: "request" as const, id: "r1", label: "Request" };
      useRelayRecentStore.getState().recordRecent(chip);
      const stored = JSON.parse(localStore[RELAY_STORAGE_KEYS.recent]) as unknown[];
      expect(stored[0]).toEqual({ kind: "request", id: "r1", name: "Request" });
      expect(Object.keys(stored[0]!)).toEqual(["kind", "id", "name"]);
    });

    it("logs a warning and continues if setItem throws", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalSetItem = localStore;
      const mockStorage = {
        getItem: (k: string) => originalSetItem[k] ?? null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: (k: string) => {
          delete originalSetItem[k];
        },
      };
      vi.stubGlobal("localStorage", mockStorage);

      const chip = { kind: "request" as const, id: "r-new", label: "New" };
      useRelayRecentStore.getState().recordRecent(chip);
      expect(useRelayRecentStore.getState().items[0]).toEqual({
        kind: "request",
        id: "r-new",
        name: "New",
      });
      expect(warn).toHaveBeenCalledWith(
        "[relay] writing recents failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.recent }),
      );
      warn.mockRestore();
    });
  });

  describe("clear", () => {
    beforeEach(() => {
      useRelayRecentStore.setState({
        items: [
          { kind: "request", id: "r1", name: "Request" },
          { kind: "chain", id: "c1", name: "Chain" },
        ],
      });
      localStore[RELAY_STORAGE_KEYS.recent] = JSON.stringify(useRelayRecentStore.getState().items);
    });

    it("clears all items from the store", () => {
      useRelayRecentStore.getState().clear();
      expect(useRelayRecentStore.getState().items).toEqual([]);
    });

    it("clears the persisted list", () => {
      useRelayRecentStore.getState().clear();
      expect(localStore[RELAY_STORAGE_KEYS.recent]).toBe(JSON.stringify([]));
    });

    it("logs a warning and continues if setItem throws during clear", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalSetItem = localStore;
      const mockStorage = {
        getItem: (k: string) => originalSetItem[k] ?? null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: (k: string) => {
          delete originalSetItem[k];
        },
      };
      vi.stubGlobal("localStorage", mockStorage);

      useRelayRecentStore.getState().clear();
      expect(useRelayRecentStore.getState().items).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        "[relay] writing recents failed",
        expect.objectContaining({ key: RELAY_STORAGE_KEYS.recent }),
      );
      warn.mockRestore();
    });
  });
});
