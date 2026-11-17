// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChangeLog, createMemoryChangeStorage } from "./changeLog";
import { createFakeStoreAccess } from "./storeAccess";
import { createMemoryWorkspaceWriter } from "./testing/changeLogTestKit";

const idb = vi.hoisted(() => ({
  deleted: [] as [string, string][],
  record: undefined as Record<string, unknown> | undefined,
  put: vi.fn(),
  hydrate: vi.fn(),
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn().mockRejectedValue(new Error("no idb in tests")),
  getLooseDB: async () => ({
    delete: async (store: string, key: string) => {
      idb.deleted.push([store, key]);
    },
    get: async () => idb.record,
    put: idb.put,
  }),
}));
vi.mock("@/stores/useSettingsStore", () => ({
  useSettingsStore: { getState: () => ({ hydrate: idb.hydrate }) },
}));
vi.mock("@/lib/hub", () => ({
  announceSlugChange: vi.fn(),
  unmarkSlugImported: vi.fn(),
}));

const origin = { threadId: "t", turnId: "u", toolCallId: "c" };

type Extras = {
  addedRows?: { store: string; key: string }[];
  addedSettingKeys?: string[];
  addedPreferenceKeys?: string[];
};

async function importThenUndo(extras: Extras) {
  const fake = createFakeStoreAccess({ collections: [], requests: [] });
  const writer = createMemoryWorkspaceWriter(fake.state);
  const log = createChangeLog({
    store: fake.access,
    writer,
    storage: createMemoryChangeStorage(),
  });
  const applied = await log.apply(origin, {
    entity: "backup",
    entityId: "k1",
    action: "created",
    summary: "Merged the backup",
    before: { added: [], overwritten: [], ...extras },
    mutate: () => undefined,
  });
  if (!applied.ok) throw new Error("apply failed");
  return log.undo(applied.change.id);
}

describe("backup import undo: rows beyond the entity lists", () => {
  beforeEach(() => {
    idb.deleted.length = 0;
    idb.record = undefined;
    idb.put.mockClear();
    idb.hydrate.mockClear();
    localStorage.clear();
  });

  it("removes added preference keys without opening the database", async () => {
    localStorage.setItem("pref-a", "1");
    localStorage.setItem("keep", "1");
    expect((await importThenUndo({ addedPreferenceKeys: ["pref-a"] })).ok).toBe(true);
    expect(localStorage.getItem("pref-a")).toBeNull();
    expect(localStorage.getItem("keep")).toBe("1");
    expect(idb.deleted).toEqual([]);
  });

  it("deletes added history and thread rows", async () => {
    const rows = [
      { store: "history", key: "h1" },
      { store: "relay_threads", key: "t9" },
    ];
    expect((await importThenUndo({ addedRows: rows })).ok).toBe(true);
    expect(idb.deleted).toEqual([
      ["history", "h1"],
      ["relay_threads", "t9"],
    ]);
    expect(idb.put).not.toHaveBeenCalled();
  });

  it("drops only the added settings keys and rehydrates the settings store", async () => {
    idb.record = { theme: "dark", locale: "fr", sslVerify: false };
    expect((await importThenUndo({ addedSettingKeys: ["locale"] })).ok).toBe(true);
    expect(idb.put).toHaveBeenCalledWith(
      "settings",
      { theme: "dark", sslVerify: false },
      "app",
    );
    expect(idb.hydrate).toHaveBeenCalledTimes(1);
  });

  it("leaves settings alone when there is no stored settings record", async () => {
    idb.record = undefined;
    expect((await importThenUndo({ addedSettingKeys: ["locale"] })).ok).toBe(true);
    expect(idb.put).not.toHaveBeenCalled();
    expect(idb.hydrate).not.toHaveBeenCalled();
  });

  it("reports failed when the cleanup throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    idb.record = { locale: "fr" };
    idb.put.mockRejectedValueOnce(new Error("quota"));
    expect(await importThenUndo({ addedSettingKeys: ["locale"] })).toEqual({
      ok: false,
      reason: "failed",
    });
    error.mockRestore();
  });
});
