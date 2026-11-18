/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupSection } from "./constants";
import type { BackupEnvelope } from "./schema";

type ReplaceModule = typeof import("./replace");
type IdbModule = typeof import("@/lib/idb");

const ONBOARDING_KEY = "rq_onboarding_complete";
const ENV_KEY = "requestly_active_env_id";

/** Fresh module graph over a fresh database, so cached connections never leak between tests. */
async function load(): Promise<{ replace: ReplaceModule; idb: IdbModule }> {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const idb = await import("@/lib/idb");
  const replace = await import("./replace");
  return { replace, idb };
}

function envelope(
  sections: BackupSection[],
  data: BackupEnvelope["data"],
): BackupEnvelope {
  return {
    app: "requestr-backup",
    schemaVersion: 1,
    idbVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    appVersion: "0.0.0",
    includesSecrets: false,
    sections,
    data,
  };
}

async function seed(
  idb: IdbModule,
  store: string,
  records: unknown[],
): Promise<void> {
  const db = await idb.getLooseDB();
  for (const record of records) await db.put(store, record);
}

async function idsIn(idb: IdbModule, store: string): Promise<string[]> {
  const db = await idb.getLooseDB();
  const all = (await db.getAll(store)) as { id: string }[];
  return all.map((record) => record.id).sort();
}

describe("replaceBackup", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("clears the stores of a section in the file and writes the incoming records", async () => {
    const { replace, idb } = await load();
    await seed(idb, "environments", [{ id: "old-1" }, { id: "old-2" }]);

    await replace.replaceBackup(
      envelope(["environments"], { environments: [{ id: "new-1" }] }),
    );

    expect(await idsIn(idb, "environments")).toEqual(["new-1"]);
  });

  it("empties a section that is in the file but has no records", async () => {
    const { replace, idb } = await load();
    await seed(idb, "chains", [{ id: "c-1" }]);

    await replace.replaceBackup(envelope(["chains"], {}));

    expect(await idsIn(idb, "chains")).toEqual([]);
  });

  it("leaves sections that are not in the file untouched", async () => {
    const { replace, idb } = await load();
    await seed(idb, "environments", [{ id: "env-keep" }]);
    await seed(idb, "chains", [{ id: "chain-old" }]);

    await replace.replaceBackup(
      envelope(["chains"], { chains: [{ id: "chain-new" }] }),
    );

    expect(await idsIn(idb, "environments")).toEqual(["env-keep"]);
    expect(await idsIn(idb, "chains")).toEqual(["chain-new"]);
  });

  it("replaces every store a multi-store section owns", async () => {
    const { replace, idb } = await load();
    await seed(idb, "collections", [{ id: "col-old" }]);
    await seed(idb, "requests", [{ id: "req-old" }]);

    await replace.replaceBackup(
      envelope(["collections"], {
        collections: [{ id: "col-new" }],
        requests: [{ id: "req-new-1" }, { id: "req-new-2" }],
      }),
    );

    expect(await idsIn(idb, "collections")).toEqual(["col-new"]);
    expect(await idsIn(idb, "requests")).toEqual(["req-new-1", "req-new-2"]);
  });

  it("replaces the settings record and writes preferences after the commit", async () => {
    const { replace, idb } = await load();
    await seed(idb, "settings", []);
    const db = await idb.getLooseDB();
    await db.put("settings", { theme: "old" }, "app");
    localStorage.setItem(ENV_KEY, "env-old");

    await replace.replaceBackup(
      envelope(["settings", "preferences"], {
        settings: { theme: "new" },
        preferences: { [ENV_KEY]: "env-new", not_allowed: "x" },
      }),
    );

    expect(await db.get("settings", "app")).toEqual({ theme: "new" });
    expect(localStorage.getItem(ENV_KEY)).toBe("env-new");
    expect(localStorage.getItem("not_allowed")).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("true");
  });

  it("deletes the settings record when the file carries empty settings", async () => {
    const { replace, idb } = await load();
    const db = await idb.getLooseDB();
    await db.put("settings", { theme: "old" }, "app");

    await replace.replaceBackup(envelope(["settings"], { settings: {} }));

    expect(await db.get("settings", "app")).toBeUndefined();
  });

  it("rolls every section back and leaves preferences alone when a write fails", async () => {
    const { replace, idb } = await load();
    await seed(idb, "environments", [{ id: "env-old" }]);
    await seed(idb, "collections", [{ id: "col-old" }]);
    localStorage.setItem(ENV_KEY, "env-old");

    // Abort the transaction right after the writes are queued, as a failed
    // request or a quota error would.
    const put = IDBObjectStore.prototype.put;
    let aborted = false;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const request = put.apply(this, args);
      if (!aborted) {
        aborted = true;
        queueMicrotask(() => this.transaction.abort());
      }
      return request;
    });
    const failing = envelope(["environments", "collections", "preferences"], {
      environments: [{ id: "env-new" }],
      collections: [{ id: "col-new" }],
      preferences: { [ENV_KEY]: "env-new" },
    });

    try {
      await expect(replace.replaceBackup(failing)).rejects.toThrow();
    } finally {
      vi.restoreAllMocks();
    }

    expect(await idsIn(idb, "environments")).toEqual(["env-old"]);
    expect(await idsIn(idb, "collections")).toEqual(["col-old"]);
    expect(localStorage.getItem(ENV_KEY)).toBe("env-old");
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("rejects, rolls back and leaves preferences alone when a queued put throws synchronously", async () => {
    const { replace, idb } = await load();
    await seed(idb, "environments", [{ id: "env-old" }]);
    localStorage.setItem(ENV_KEY, "env-old");
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new Error("put exploded");
    });
    const failing = envelope(["environments", "preferences"], {
      environments: [{ id: "env-new" }],
      preferences: { [ENV_KEY]: "env-new" },
    });

    try {
      await expect(replace.replaceBackup(failing)).rejects.toThrow(
        "put exploded",
      );
      // Let any rolled-back request surface as an unhandled rejection.
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      process.off("unhandledRejection", unhandled);
      vi.restoreAllMocks();
    }

    expect(unhandled).not.toHaveBeenCalled();
    expect(await idsIn(idb, "environments")).toEqual(["env-old"]);
    expect(localStorage.getItem(ENV_KEY)).toBe("env-old");
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("writes preferences when the file has only preferences and no store is touched", async () => {
    const { replace, idb } = await load();
    await seed(idb, "environments", [{ id: "env-keep" }]);

    await replace.replaceBackup(
      envelope(["preferences"], { preferences: { [ENV_KEY]: "env-9" } }),
    );

    expect(localStorage.getItem(ENV_KEY)).toBe("env-9");
    expect(await idsIn(idb, "environments")).toEqual(["env-keep"]);
  });

  it("rejects when IndexedDB is unavailable", async () => {
    vi.resetModules();
    const replace = await import("./replace");
    vi.stubGlobal("window", undefined);

    await expect(
      replace.replaceBackup(envelope(["chains"], {})),
    ).rejects.toThrow();
  });
});

describe("countReplaceDeletes", () => {
  it("counts the primary store of each section and skips preferences", async () => {
    const { replace, idb } = await load();
    await seed(idb, "collections", [{ id: "a" }, { id: "b" }]);
    await seed(idb, "chains", [{ id: "c" }]);
    await seed(idb, "requests", [{ id: "r" }]);

    const counts = await replace.countReplaceDeletes([
      "collections",
      "chains",
      "environments",
      "preferences",
    ]);

    expect(counts).toEqual({ collections: 2, chains: 1, environments: 0 });
  });

  it("counts settings as one record when present and zero when absent", async () => {
    const { replace, idb } = await load();
    expect(await replace.countReplaceDeletes(["settings"])).toEqual({
      settings: 0,
    });

    const db = await idb.getLooseDB();
    await db.put("settings", { theme: "x" }, "app");

    expect(await replace.countReplaceDeletes(["settings"])).toEqual({
      settings: 1,
    });
  });
});
