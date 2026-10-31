// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareBackup, toBackupBlob } from "@/lib/backup/exporter";
import { restoreBackup } from "@/lib/backup/importer";
import type { BackupEnvelope } from "@/lib/backup/schema";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import {
  backupOptionsFor,
  backupTools,
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
}));
vi.mock("@/lib/backup/importer", () => ({ restoreBackup: vi.fn() }));
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
