/** @vitest-environment happy-dom */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_APP_ID } from "./constants";
import type { BackupData, BackupEnvelope } from "./schema";

const reconcileMock = vi.hoisted(() => vi.fn());
const broadcastMock = vi.hoisted(() => vi.fn());

vi.mock("./reconcile", () => ({ reconcileAfterRestore: reconcileMock }));
vi.mock("./broadcast", () => ({ broadcastRestore: broadcastMock }));

type Importer = typeof import("./importer");
type Exporter = typeof import("./exporter");
type IdbModule = typeof import("../idb");
type Rec = Record<string, unknown>;

/** Fresh module graph over a fresh database, so cached connections never leak between tests. */
async function load() {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const importer: Importer = await import("./importer");
  const exporter: Exporter = await import("./exporter");
  const idb: IdbModule = await import("../idb");
  return { importer, exporter, idb };
}

async function seed(
  idb: IdbModule,
  store: Parameters<IdbModule["runInTransaction"]>[0][number],
  records: Rec[],
) {
  const db = await idb.getLooseDB();
  for (const record of records) await db.put(store, record);
}

function envelope(
  data: BackupData,
  sections: BackupEnvelope["sections"],
): BackupEnvelope {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: 1,
    idbVersion: 6,
    exportedAt: "2026-01-01T00:00:00.000Z",
    appVersion: "0.0.0",
    includesSecrets: false,
    sections,
    data,
  };
}

beforeEach(() => {
  localStorage.clear();
  reconcileMock.mockReset();
  broadcastMock.mockReset();
  reconcileMock.mockResolvedValue({ closedTabs: 2, danglingCount: 1 });
});

describe("planMerge", () => {
  it("adds everything when the workspace is empty", async () => {
    const { importer } = await load();
    const plan = importer.planMerge(
      {},
      {
        collections: [{ id: "c1", name: "API" }],
        requests: [{ id: "r1", collectionId: "c1", name: "Get" }],
      },
    );
    expect(plan.lists.collections).toEqual([{ id: "c1", name: "API" }]);
    expect(plan.lists.requests).toHaveLength(1);
    expect(plan.counts).toEqual({ added: 2, skipped: 0, kept: 0 });
  });

  it("skips identical records so importing twice adds nothing", async () => {
    const { importer } = await load();
    const data: BackupData = {
      collections: [{ id: "c1", name: "API", updatedAt: 1 }],
      history: [{ id: "h1", url: "u" }],
    };
    const plan = importer.planMerge(data, {
      collections: [{ id: "c1", name: "API", updatedAt: 500 }],
      history: [{ id: "h1", url: "u" }],
    });
    expect(plan.counts).toEqual({ added: 0, skipped: 2, kept: 0 });
  });

  it("renames a colliding collection and re-points its children with no orphans", async () => {
    const { importer } = await load();
    const existing: BackupData = {
      collections: [{ id: "c1", name: "Mine" }],
      folders: [{ id: "f1", collectionId: "c1", parentFolderId: null, name: "Mine F" }],
    };
    const incoming: BackupData = {
      collections: [{ id: "c1", name: "Theirs" }],
      folders: [
        { id: "f2", collectionId: "c1", parentFolderId: null, name: "F2" },
        { id: "f3", collectionId: "c1", parentFolderId: "f2", name: "F3" },
      ],
      requests: [{ id: "r2", collectionId: "c1", folderId: "f2", name: "Get" }],
      chainConfigs: [{ collectionId: "c1", requestIds: ["r2"] }],
    };
    const plan = importer.planMerge(existing, incoming);
    const [collection] = plan.lists.collections as Rec[];
    expect(collection.name).toBe("Theirs (imported)");
    expect(collection.id).not.toBe("c1");

    const newId = collection.id;
    const folders = plan.lists.folders as Rec[];
    expect(folders.map((f) => f.collectionId)).toEqual([newId, newId]);
    const requests = plan.lists.requests as Rec[];
    expect(requests[0].collectionId).toBe(newId);
    expect((plan.lists.chainConfigs as Rec[])[0].collectionId).toBe(newId);

    // Every reference resolves inside existing + added.
    const collectionIds = new Set(["c1", newId]);
    const folderIds = new Set(["f1", ...folders.map((f) => f.id)]);
    for (const folder of folders) {
      expect(collectionIds.has(folder.collectionId as string)).toBe(true);
      if (folder.parentFolderId) {
        expect(folderIds.has(folder.parentFolderId as string)).toBe(true);
      }
    }
    expect(folderIds.has(requests[0].folderId as string)).toBe(true);
  });

  it("orders folders parent-first even when the child is listed first", async () => {
    const { importer } = await load();
    const plan = importer.planMerge(
      { collections: [{ id: "c1", name: "Mine" }] },
      {
        collections: [{ id: "c1", name: "Theirs" }],
        folders: [
          { id: "child", collectionId: "c1", parentFolderId: "parent" },
          { id: "parent", collectionId: "c1", parentFolderId: null },
        ],
      },
    );
    expect((plan.lists.folders as Rec[]).map((f) => f.id)).toEqual([
      "parent",
      "child",
    ]);
  });

  it("remaps sub-chain references after renaming the chain they point at", async () => {
    const { importer } = await load();
    const plan = importer.planMerge(
      { chains: [{ id: "sub", name: "Mine" }] },
      {
        chains: [
          { id: "top", name: "Top", blocks: [{ type: "subchain", chainId: "sub" }, { type: "request" }] },
          { id: "sub", name: "Theirs", blocks: [] },
        ],
      },
    );
    const chains = plan.lists.chains as Rec[];
    const renamedSub = chains.find((c) => c.name === "Theirs (imported)") as Rec;
    const top = chains.find((c) => c.id === "top") as Rec;
    expect(chains[0].id).toBe(renamedSub.id);
    expect((top.blocks as Rec[])[0].chainId).toBe(renamedSub.id);
  });

  it("handles chains without a blocks array", async () => {
    const { importer } = await load();
    const plan = importer.planMerge({}, { chains: [{ id: "x", name: "X" }] });
    expect(plan.lists.chains).toEqual([{ id: "x", name: "X" }]);
  });

  it("never renames history or chain runs and keeps both records on a collision", async () => {
    const { importer } = await load();
    const plan = importer.planMerge(
      { history: [{ id: "h1", name: "mine", url: "a" }] },
      { history: [{ id: "h1", name: "mine", url: "b" }] },
    );
    const [added] = plan.lists.history as Rec[];
    expect(added.name).toBe("mine");
    expect(added.id).not.toBe("h1");
    expect(plan.counts.kept).toBe(1);
  });

  it("marks restored relay changes as blocked so they cannot be undone", async () => {
    const { importer } = await load();
    const plan = importer.planMerge(
      {},
      {
        relayChanges: [
          { id: "ch1", threadId: "t", status: "applied" },
          { id: "ch2", threadId: "t", status: "pending" },
        ],
      },
    );
    expect((plan.lists.relayChanges as Rec[]).map((c) => c.status)).toEqual([
      "blocked",
      "blocked",
    ]);
  });

  it("only touches sections present in the incoming data", async () => {
    const { importer } = await load();
    const plan = importer.planMerge({ collections: [{ id: "c" }] }, { environments: [] });
    expect(Object.keys(plan.lists)).toEqual(["environments"]);
  });

  describe("settings", () => {
    it("takes incoming settings when none exist locally", async () => {
      const { importer } = await load();
      const plan = importer.planMerge({ settings: {} }, { settings: { theme: "dark" } });
      expect(plan.settings).toEqual({ theme: "dark" });
      expect(importer.planMerge({}, { settings: { theme: "dark" } }).settings).toEqual({
        theme: "dark",
      });
    });

    it("keeps existing values and adds only absent keys", async () => {
      const { importer } = await load();
      const plan = importer.planMerge(
        { settings: { theme: "dark" } },
        { settings: { theme: "light", zoom: 2 } },
      );
      expect(plan.settings).toEqual({ theme: "dark", zoom: 2 });
    });

    it("plans no write when existing settings already cover the incoming ones", async () => {
      const { importer } = await load();
      const plan = importer.planMerge(
        { settings: { theme: "dark", zoom: 1 } },
        { settings: { theme: "light" } },
      );
      expect(plan.settings).toBeNull();
    });

    it("plans no write for missing or empty incoming settings", async () => {
      const { importer } = await load();
      expect(importer.planMerge({ settings: { a: 1 } }, {}).settings).toBeNull();
      expect(importer.planMerge({ settings: { a: 1 } }, { settings: {} }).settings).toBeNull();
    });

    it("remaps ids inside incoming settings", async () => {
      const { importer } = await load();
      const plan = importer.planMerge(
        { collections: [{ id: "c1", name: "Mine" }] },
        { collections: [{ id: "c1", name: "Theirs" }], settings: { lastCollection: "c1" } },
      );
      const [collection] = plan.lists.collections as Rec[];
      expect(plan.settings).toEqual({ lastCollection: collection.id });
    });
  });

  describe("preferences", () => {
    it("keeps existing keys and adds only absent ones", async () => {
      const { importer } = await load();
      const plan = importer.planMerge(
        { preferences: { requestly_active_env_id: "mine" } },
        { preferences: { requestly_active_env_id: "theirs", rq_collapsed_folders: "[]" } },
      );
      expect(plan.preferences).toEqual({ rq_collapsed_folders: "[]" });
    });

    it("remaps ids in preference values and tolerates missing sections", async () => {
      const { importer } = await load();
      const plan = importer.planMerge(
        { environments: [{ id: "e1", name: "Mine" }] },
        {
          environments: [{ id: "e1", name: "Theirs" }],
          preferences: { requestly_active_env_id: "e1" },
        },
      );
      const [env] = plan.lists.environments as Rec[];
      expect(plan.preferences).toEqual({ requestly_active_env_id: env.id });
      expect(importer.planMerge({}, {}).preferences).toEqual({});
    });
  });
});

describe("restoreBackup (merge)", () => {
  it("writes added records, keeps existing ones and returns the summary", async () => {
    const { importer, idb } = await load();
    await seed(idb, "collections", [{ id: "c1", name: "Mine" }]);
    const summary = await importer.restoreBackup(
      envelope(
        { collections: [{ id: "c1", name: "Theirs" }, { id: "c2", name: "New" }] },
        ["collections"],
      ),
      "merge",
    );
    const db = await idb.getLooseDB();
    const all = (await db.getAll("collections")) as Rec[];
    expect(all.map((c) => c.name).sort()).toEqual(["Mine", "New", "Theirs (imported)"]);
    expect(summary).toEqual({
      mode: "merge",
      added: 2,
      skipped: 0,
      kept: 1,
      closedTabs: 2,
      danglingCount: 1,
    });
    expect(broadcastMock).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a second identical merge adds nothing", async () => {
    const { importer, idb } = await load();
    await seed(idb, "collections", [{ id: "c1", name: "Mine" }]);
    const file = envelope({ collections: [{ id: "c1", name: "Theirs" }] }, ["collections"]);
    await importer.restoreBackup(file, "merge");
    const second = await importer.restoreBackup(file, "merge");
    const db = await idb.getLooseDB();
    expect(await db.count("collections")).toBe(2);
    expect(second).toMatchObject({ added: 0, skipped: 1, kept: 0 });
  });

  it("stores merged relay changes as blocked", async () => {
    const { importer, idb } = await load();
    await importer.restoreBackup(
      envelope({ relayChanges: [{ id: "ch1", threadId: "t", status: "applied" }] }, [
        "relayThreads",
      ]),
      "merge",
    );
    const db = await idb.getLooseDB();
    expect(((await db.get("relay_changes", "ch1")) as Rec).status).toBe("blocked");
  });

  it("writes new settings and preferences, keeping existing preferences", async () => {
    const { importer, idb } = await load();
    localStorage.setItem("requestly_active_env_id", "mine");
    await importer.restoreBackup(
      envelope(
        {
          settings: { theme: "dark" },
          preferences: { requestly_active_env_id: "theirs", rq_collapsed_folders: "[]" },
        },
        ["settings", "preferences"],
      ),
      "merge",
    );
    const db = await idb.getLooseDB();
    expect(await db.get("settings", "app")).toEqual({ theme: "dark" });
    expect(localStorage.getItem("requestly_active_env_id")).toBe("mine");
    expect(localStorage.getItem("rq_collapsed_folders")).toBe("[]");
    expect(localStorage.getItem("rq_onboarding_complete")).toBe("true");
  });

  it("skips the preference keys the caller names, such as the approval mode, and writes the rest", async () => {
    const { importer } = await load();
    await importer.restoreBackup(
      envelope(
        {
          preferences: {
            rq_relay_permission_mode: "auto",
            rq_collapsed_folders: "[]",
          },
        },
        ["preferences"],
      ),
      "merge",
      { skipPreferenceKeys: ["rq_relay_permission_mode"] },
    );
    expect(localStorage.getItem("rq_relay_permission_mode")).toBeNull();
    expect(localStorage.getItem("rq_collapsed_folders")).toBe("[]");
  });

  it("applies the approval mode from a backup when no key is skipped", async () => {
    const { importer } = await load();
    await importer.restoreBackup(
      envelope({ preferences: { rq_relay_permission_mode: "auto" } }, ["preferences"]),
      "merge",
    );
    expect(localStorage.getItem("rq_relay_permission_mode")).toBe("auto");
  });

  it("writes nothing, not even preferences, when there is nothing to add", async () => {
    const { importer } = await load();
    const summary = await importer.restoreBackup(envelope({ collections: [] }, ["collections"]), "merge");
    expect(summary).toMatchObject({ added: 0, skipped: 0, kept: 0 });
    expect(localStorage.getItem("rq_onboarding_complete")).toBeNull();
  });

  it("leaves preferences alone when the transaction fails", async () => {
    const { importer, idb } = await load();
    await seed(idb, "collections", [{ id: "c1" }]);
    const file = envelope(
      {
        collections: [{ id: "c2", name: "New" }],
        preferences: { rq_collapsed_folders: "[]" },
      },
      ["collections", "settings", "preferences"],
    );
    const db = await idb.getLooseDB();
    vi.spyOn(db, "transaction").mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(importer.restoreBackup(file, "merge")).rejects.toThrow("boom");
    expect(localStorage.getItem("rq_collapsed_folders")).toBeNull();
    expect(broadcastMock).not.toHaveBeenCalled();
  });
});

describe("restoreBackup (replace)", () => {
  it("replaces the section and reports the incoming record count", async () => {
    const { importer, idb } = await load();
    await seed(idb, "collections", [{ id: "old", name: "Old" }]);
    const summary = await importer.restoreBackup(
      envelope(
        {
          collections: [{ id: "n1", name: "N1" }, { id: "n2", name: "N2" }],
          settings: { theme: "dark" },
        },
        ["collections", "settings"],
      ),
      "replace",
    );
    const db = await idb.getLooseDB();
    expect(((await db.getAll("collections")) as Rec[]).map((c) => c.id)).toEqual(["n1", "n2"]);
    expect(summary).toEqual({
      mode: "replace",
      added: 2,
      skipped: 0,
      kept: 0,
      closedTabs: 2,
      danglingCount: 1,
    });
    expect(broadcastMock).toHaveBeenCalledTimes(1);
  });
});

describe("round trip", () => {
  async function exportJson(exporter: Exporter, sections: BackupEnvelope["sections"]) {
    const prepared = await exporter.prepareBackup(
      { sections, includeSecrets: true },
      new Date("2026-02-02T00:00:00.000Z"),
    );
    return JSON.parse(await exporter.toBackupBlob(prepared).text()) as BackupEnvelope;
  }

  it("export(import(export(x))) equals export(x) for a workspace with collisions", async () => {
    const { importer, exporter, idb } = await load();
    await seed(idb, "collections", [{ id: "c1", name: "Mine" }]);
    await seed(idb, "requests", [{ id: "r1", collectionId: "c1", name: "Get" }]);
    const sections = ["collections"] as BackupEnvelope["sections"];
    const file = envelope(
      {
        collections: [{ id: "c1", name: "Theirs" }],
        requests: [{ id: "r9", collectionId: "c1", name: "Other" }],
      },
      sections,
    );
    await importer.restoreBackup(file, "merge");
    const first = await exportJson(exporter, sections);

    await importer.restoreBackup(first, "merge");
    const second = await exportJson(exporter, sections);

    expect(first.data.collections).toHaveLength(2);
    expect(first.data.requests).toHaveLength(2);
    expect(second).toEqual(first);
  });
});
