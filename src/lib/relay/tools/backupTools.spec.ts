// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectBackupData, prepareBackup, toBackupBlob } from "@/lib/backup/exporter";
import { restoreBackup } from "@/lib/backup/importer";
import type { BackupData, BackupEnvelope } from "@/lib/backup/schema";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import {
  backupOptionsFor,
  backupTools,
  diffImport,
  stageImportFile,
  unstageImportFile,
} from "./backupTools";
import {
  APPROVAL_REQUIRED,
  createRegistry,
  executeTool,
  grantApproval,
  previewConfirmation,
} from "./registry";

const hydrate = vi.hoisted(() => ({
  collections: vi.fn(async () => {}),
  environments: vi.fn(async () => {}),
  chains: vi.fn(async () => {}),
  settings: vi.fn(async () => {}),
}));

vi.mock("@/lib/backup/exporter", () => ({
  prepareBackup: vi.fn(),
  toBackupBlob: vi.fn(),
  collectBackupData: vi.fn(async () => ({})),
}));
vi.mock("@/lib/backup/importer", () => ({ restoreBackup: vi.fn() }));
const idb = vi.hoisted(() => ({
  deleted: [] as [string, string][],
  settings: { theme: "dark", locale: "fr" } as Record<string, unknown> | undefined,
  put: vi.fn(),
}));
vi.mock("@/lib/idb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/idb")>()),
  getLooseDB: async () => ({
    delete: async (store: string, key: string) => {
      idb.deleted.push([store, key]);
    },
    get: async () => idb.settings,
    put: idb.put,
  }),
}));
vi.mock("@/stores/useCollectionsStore", () => ({
  useCollectionsStore: { getState: () => ({ hydrate: hydrate.collections }) },
}));
vi.mock("@/stores/useEnvironmentsStore", () => ({
  useEnvironmentsStore: { getState: () => ({ hydrate: hydrate.environments }) },
}));
vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => ({ hydrate: hydrate.chains }) },
}));
vi.mock("@/stores/useSettingsStore", () => ({
  useSettingsStore: { getState: () => ({ hydrate: hydrate.settings }) },
}));

const registry = createRegistry(backupTools);
const envelope = { app: "requestr" } as unknown as BackupEnvelope;
const BLOB = new Blob(["{}"]);

function setup() {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
    environments: [
      { id: "e1", name: "Prod", variables: [], createdAt: 1, updatedAt: 1 },
    ],
  });
  const run = (name: string, input: unknown, approved = true) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      approval: approved ? grantApproval() : undefined,
    });
  return { ...fake, run };
}

const exportInput = {
  sections: ["collections"],
  collectionIds: null,
  environmentIds: null,
  chainIds: null,
  includeSecrets: null,
};

let clicked: HTMLAnchorElement[];

beforeEach(() => {
  vi.clearAllMocks();
  clicked = [];
  vi.mocked(prepareBackup).mockResolvedValue({
    envelope: { exportedAt: "2026-03-04T10:20:30.000Z", includesSecrets: false },
    estimate: { counts: { collections: 1 } },
  } as never);
  vi.mocked(toBackupBlob).mockReturnValue(BLOB);
  vi.mocked(restoreBackup).mockResolvedValue({
    added: 3,
    skipped: 1,
    kept: 2,
    closedTabs: 0,
  } as never);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});

describe("backupOptionsFor", () => {
  it("[success] leaves secrets out unless the model asked for them", () => {
    expect(backupOptionsFor(exportInput as never)).toEqual({
      sections: ["collections"],
      includeSecrets: false,
    });
    expect(
      backupOptionsFor({ ...exportInput, includeSecrets: false } as never).includeSecrets,
    ).toBe(false);
    expect(
      backupOptionsFor({ ...exportInput, includeSecrets: true } as never).includeSecrets,
    ).toBe(true);
  });

  it("[success] carries only the selections that were given", () => {
    expect(
      backupOptionsFor({
        ...exportInput,
        collectionIds: ["c1"],
        environmentIds: ["e1"],
        chainIds: ["ch1"],
      } as never).selection,
    ).toEqual({ collectionIds: ["c1"], environmentIds: ["e1"], chainIds: ["ch1"] });
    expect(
      backupOptionsFor({ ...exportInput, chainIds: ["ch1"] } as never).selection,
    ).toEqual({ chainIds: ["ch1"] });
  });
});

describe("export_backup", () => {
  it("[success] downloads a dated file and answers with counts only", async () => {
    const { run } = setup();
    const out = await run("export_backup", exportInput);
    expect(out).toEqual({
      ok: true,
      data: {
        summary: "Downloaded a backup",
        fileName: "requestr-backup-2026-03-04.json",
        counts: { collections: 1 },
        includesSecrets: false,
      },
    });
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("requestr-backup-2026-03-04.json");
    expect(clicked[0].href).toBe("blob:test");
    expect(URL.createObjectURL).toHaveBeenCalledWith(BLOB);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("[success] passes secrets and selection through to the exporter", async () => {
    const { run } = setup();
    await run("export_backup", {
      ...exportInput,
      collectionIds: ["c1"],
      includeSecrets: true,
    });
    expect(prepareBackup).toHaveBeenCalledWith({
      sections: ["collections"],
      includeSecrets: true,
      selection: { collectionIds: ["c1"] },
    });
  });

  it("[success] ignores the permission mode: it asks even in skip mode", async () => {
    const { store, write } = setup();
    const out = await executeTool(registry, "export_backup", exportInput, {
      store,
      redact: DEFAULT_REDACT_CONTEXT,
      write,
      permissionMode: "skip",
    });
    expect(out).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(prepareBackup).not.toHaveBeenCalled();
  });

  it("[invalid] does nothing without approval", async () => {
    const { run } = setup();
    expect(await run("export_backup", exportInput, false)).toEqual({
      ok: false,
      error: APPROVAL_REQUIRED,
    });
    expect(clicked).toHaveLength(0);
  });

  it("[invalid] rejects an empty section list and an unknown id", async () => {
    const { run } = setup();
    expect((await run("export_backup", { ...exportInput, sections: [] })).ok).toBe(false);
    expect(
      await run("export_backup", { ...exportInput, collectionIds: ["nope"] }),
    ).toEqual({ ok: false, error: "collection not found: nope" });
    expect(
      await run("export_backup", { ...exportInput, environmentIds: ["nope"] }),
    ).toEqual({ ok: false, error: "environment not found: nope" });
    expect(
      await run("export_backup", { ...exportInput, chainIds: ["nope"] }),
    ).toEqual({ ok: false, error: "chain not found: nope" });
    expect(prepareBackup).not.toHaveBeenCalled();
  });

  it("[success] resolves known ids to their names on the card", () => {
    const { store } = setup();
    const preview = previewConfirmation(
      registry,
      "export_backup",
      { ...exportInput, sections: ["collections", "environments"], includeSecrets: true },
      store,
    );
    expect(preview).toMatchObject({
      severity: "danger",
      targets: ["collections", "environments"],
      count: 2,
    });
    expect(
      previewConfirmation(registry, "export_backup", exportInput, store)?.severity,
    ).toBe("caution");
  });
});

describe("import_backup", () => {
  const callOf = (toolCallId: string) => {
    const { store, write } = setup();
    return {
      store,
      redact: DEFAULT_REDACT_CONTEXT,
      approval: grantApproval(),
      write: { ...write, origin: { ...write.origin, toolCallId } },
    };
  };

  it("[success] merges the staged file, protects the approval mode, and refreshes the stores", async () => {
    stageImportFile("call-a", envelope);
    const out = await executeTool(registry, "import_backup", {}, callOf("call-a"));
    expect(out).toEqual({
      ok: true,
      data: {
        summary: "Merged the backup: 3 added, 1 already there",
        added: 3,
        skipped: 1,
        kept: 2,
        closedTabs: 0,
      },
    });
    expect(restoreBackup).toHaveBeenCalledWith(envelope, "merge", {
      skipPreferenceKeys: ["rq_relay_permission_mode"],
    });
    for (const fn of Object.values(hydrate)) expect(fn).toHaveBeenCalledTimes(1);
  });

  it("[success] never echoes the file's content to the model", async () => {
    stageImportFile("call-b", { ...envelope, data: { secret: "hunter2" } } as never);
    const out = await executeTool(registry, "import_backup", {}, callOf("call-b"));
    expect(JSON.stringify(out)).not.toContain("hunter2");
  });

  it("[invalid] reports no file when none was staged, and restores nothing", async () => {
    const out = await executeTool(registry, "import_backup", {}, callOf("call-c"));
    expect(out).toEqual({ ok: false, error: "no backup file was chosen" });
    expect(restoreBackup).not.toHaveBeenCalled();
    expect(hydrate.collections).not.toHaveBeenCalled();
  });

  it("[invalid] reports no file when the call has no write origin", async () => {
    const { store } = setup();
    const out = await executeTool(registry, "import_backup", {}, {
      store,
      redact: DEFAULT_REDACT_CONTEXT,
      approval: grantApproval(),
    });
    expect(out).toEqual({ ok: false, error: "no backup file was chosen" });
  });

  it("[invalid] uses a staged file once, and not after it was unstaged", async () => {
    stageImportFile("call-d", envelope);
    await executeTool(registry, "import_backup", {}, callOf("call-d"));
    const again = await executeTool(registry, "import_backup", {}, callOf("call-d"));
    expect(again.ok).toBe(false);

    stageImportFile("call-e", envelope);
    unstageImportFile("call-e");
    const gone = await executeTool(registry, "import_backup", {}, callOf("call-e"));
    expect(gone).toEqual({ ok: false, error: "no backup file was chosen" });
    expect(restoreBackup).toHaveBeenCalledTimes(1);
  });

  it("[invalid] rejects any input, so a mode cannot be chosen", async () => {
    stageImportFile("call-f", envelope);
    const out = await executeTool(registry, "import_backup", { mode: "replace" }, callOf("call-f"));
    expect(out.ok).toBe(false);
    expect(restoreBackup).not.toHaveBeenCalled();
    unstageImportFile("call-f");
  });

  it("[invalid] asks first, even in skip mode", async () => {
    stageImportFile("call-g", envelope);
    const ctx = callOf("call-g");
    const out = await executeTool(registry, "import_backup", {}, {
      ...ctx,
      approval: undefined,
      permissionMode: "skip",
    });
    expect(out).toEqual({ ok: false, error: APPROVAL_REQUIRED });
    expect(restoreBackup).not.toHaveBeenCalled();
    unstageImportFile("call-g");
  });

  it("[success] describes itself as a change needing approval", () => {
    const { store } = setup();
    expect(previewConfirmation(registry, "import_backup", {}, store)).toMatchObject({
      action: "change",
      severity: "caution",
      count: 0,
    });
  });
});

describe("diffImport", () => {
  const col = (id: string, name = id) => ({ id, name, createdAt: 1, updatedAt: 1 });

  it("lists new ids as added and changed ids as overwritten with their old record", () => {
    const before = { collections: [col("c1", "Old")] } as unknown as BackupData;
    const after = {
      collections: [col("c1", "New"), col("c2")],
      environments: [{ id: "e1", name: "E", variables: [] }],
    } as unknown as BackupData;
    expect(diffImport(before, after)).toMatchObject({
      added: [
        { kind: "collection", id: "c2" },
        { kind: "environment", id: "e1" },
      ],
      overwritten: [{ kind: "collection", record: col("c1", "Old") }],
    });
  });

  it("ignores records the merge left as they were and lists the file does not carry", () => {
    const same = { collections: [col("c1")], requests: [{ id: "r1" }] } as unknown as BackupData;
    const none = {
      added: [],
      overwritten: [],
      addedRows: [],
      addedSettingKeys: [],
      addedPreferenceKeys: [],
    };
    expect(diffImport(same, structuredClone(same))).toEqual(none);
    expect(diffImport({} as BackupData, {} as BackupData)).toEqual(none);
  });

  it("lists the rows, settings keys and preferences a merge wrote beyond the entity lists", () => {
    const before = {
      chainConfigs: [{ collectionId: "c1" }],
      history: [{ id: "h1" }],
      settings: { theme: "dark" },
      preferences: { a: "1" },
    } as unknown as BackupData;
    const after = {
      chainConfigs: [{ collectionId: "c1" }, { collectionId: "c2" }],
      history: [{ id: "h1" }, { id: "h2" }],
      chainRuns: [{ id: "run1" }],
      relayThreads: [{ id: "t1" }],
      relayChanges: [{ id: "x1" }],
      settings: { theme: "dark", locale: "fr" },
      preferences: { a: "1", b: "2" },
    } as unknown as BackupData;
    expect(diffImport(before, after)).toMatchObject({
      addedRows: [
        { store: "chainConfigs", key: "c2" },
        { store: "history", key: "h2" },
        { store: "chainRuns", key: "run1" },
        { store: "relay_threads", key: "t1" },
        { store: "relay_changes", key: "x1" },
      ],
      addedSettingKeys: ["locale"],
      addedPreferenceKeys: ["b"],
    });
  });

  it("treats a missing settings or preferences block as empty on either side", () => {
    const empty = {} as unknown as BackupData;
    const filled = {
      settings: { theme: "dark" },
      preferences: { a: "1" },
    } as unknown as BackupData;
    expect(diffImport(empty, filled)).toMatchObject({
      addedSettingKeys: ["theme"],
      addedPreferenceKeys: ["a"],
    });
    expect(diffImport(filled, empty)).toMatchObject({
      addedSettingKeys: [],
      addedPreferenceKeys: [],
    });
  });

  it("covers folders, requests and chains", () => {
    const after = {
      folders: [{ id: "f1" }],
      requests: [{ id: "r1" }],
      chains: [{ id: "ch1" }],
    } as unknown as BackupData;
    expect(diffImport({} as BackupData, after).added).toEqual([
      { kind: "folder", id: "f1" },
      { kind: "request", id: "r1" },
      { kind: "chain", id: "ch1" },
    ]);
  });
});

describe("import_backup as one undoable change (HH-M11)", () => {
  const col = (id: string, name: string) => ({ id, name, createdAt: 1, updatedAt: 1 });
  const req = (id: string, collectionId: string) => ({
    id,
    collectionId,
    folderId: null,
    name: id,
    method: "GET",
    url: "https://api.test",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
  });

  /** The merge overwrites c1 (existing id) and adds c2 with its request r9. */
  function importSetup() {
    const fake = createFakeWriteContext({
      collections: [col("c1", "Mine")],
      requests: [req("r1", "c1")],
    } as never);
    const beforeData = { collections: [col("c1", "Mine")], requests: [req("r1", "c1")] };
    const afterData = {
      collections: [col("c1", "From file"), col("c2", "Imported")],
      requests: [req("r1", "c1"), req("r9", "c2")],
    };
    vi.mocked(collectBackupData)
      .mockResolvedValueOnce(beforeData as never)
      .mockResolvedValueOnce(afterData as never);
    vi.mocked(restoreBackup).mockImplementation((async () => {
      fake.writer.put("collection", col("c1", "From file"));
      fake.writer.put("collection", col("c2", "Imported"));
      fake.writer.put("request", req("r9", "c2"));
      return { added: 2, skipped: 0, kept: 0, closedTabs: 0 };
    }) as never);
    const run = (toolCallId: string) =>
      executeTool(registry, "import_backup", {}, {
        store: fake.store,
        redact: DEFAULT_REDACT_CONTEXT,
        approval: grantApproval(),
        write: { ...fake.write, origin: { ...fake.write.origin, toolCallId } },
      });
    return { ...fake, run };
  }

  it("records exactly one change for the whole import", async () => {
    const { run, log } = importSetup();
    stageImportFile("imp-1", envelope);
    const out = (await run("imp-1")) as { ok: true; data: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.data).toMatchObject({
      summary: "Merged the backup: 2 added, 0 already there",
      added: 2,
      skipped: 0,
      kept: 0,
      closedTabs: 0,
    });
    expect(out.data.changeId).toEqual(expect.any(String));
    expect(Object.keys(out.data).filter((key) => /^changeIds?$/.test(key))).toEqual(["changeId"]);
    expect(await log.load(out.data.changeId as string)).toMatchObject({
      entity: "backup",
      action: "created",
      status: "applied",
    });
  });

  it("Undo removes exactly the merged entities and restores the overwritten one", async () => {
    const { run, log, state } = importSetup();
    stageImportFile("imp-2", envelope);
    const out = (await run("imp-2")) as { data: { changeId: string } };
    expect(state.collections.map((c) => c.name)).toEqual(["From file", "Imported"]);

    expect((await log.undo(out.data.changeId)).ok).toBe(true);
    expect(state.collections).toEqual([col("c1", "Mine")]);
    expect(state.requests).toEqual([req("r1", "c1")]);
  });

  it("Undo leaves an entity the user kept editing after the import", async () => {
    const { run, log, state, writer } = importSetup();
    stageImportFile("imp-3", envelope);
    const out = (await run("imp-3")) as { data: { changeId: string } };
    writer.put("collection", col("c2", "Renamed since"));

    const result = await log.undo(out.data.changeId);
    expect(result).toEqual({ ok: false, reason: "edited" });
    expect(state.collections.map((c) => c.name)).toEqual(["From file", "Renamed since"]);
  });

  it("Undo also removes the chain configs, history, runs, threads, settings and preferences the import added", async () => {
    idb.deleted.length = 0;
    idb.put.mockClear();
    idb.settings = { theme: "dark", locale: "fr" };
    localStorage.setItem("pref-b", "2");
    const { run, log } = importSetup();
    vi.mocked(collectBackupData).mockReset();
    vi.mocked(collectBackupData)
      .mockResolvedValueOnce({ settings: { theme: "dark" }, preferences: {} } as never)
      .mockResolvedValueOnce({
        chainConfigs: [{ collectionId: "c2" }],
        history: [{ id: "h2" }],
        chainRuns: [{ id: "run1" }],
        relayThreads: [{ id: "t1" }],
        settings: { theme: "dark", locale: "fr" },
        preferences: { "pref-b": "2" },
      } as never);
    stageImportFile("imp-5", envelope);
    const out = (await run("imp-5")) as { data: { changeId: string } };

    expect((await log.undo(out.data.changeId)).ok).toBe(true);
    expect(idb.deleted).toEqual([
      ["chainConfigs", "c2"],
      ["history", "h2"],
      ["chainRuns", "run1"],
      ["relay_threads", "t1"],
    ]);
    expect(idb.put).toHaveBeenCalledWith("settings", { theme: "dark" }, "app");
    expect(localStorage.getItem("pref-b")).toBeNull();
  });

  it("an import that changes nothing records no change", async () => {
    const { run } = importSetup();
    vi.mocked(collectBackupData).mockReset();
    vi.mocked(collectBackupData).mockResolvedValue({} as never);
    stageImportFile("imp-4", envelope);
    const out = (await run("imp-4")) as { ok: true; data: Record<string, unknown> };
    expect(out.ok).toBe(true);
    expect(out.data).not.toHaveProperty("changeId");
  });
});
