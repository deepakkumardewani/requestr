import type { Page } from "@playwright/test";
import { openChain } from "../../fixtures/chainE2eHelpers";
import { expect, test } from "../../fixtures/qa";
import { countIdbRecords } from "../../fixtures/qaHelpers";

const BACKUP_APP_ID = "requestr-backup";
const SCHEMA_VERSION = 1;
const NEWER_SCHEMA_VERSION = 99;
const EXPORTED_AT = "2026-03-04T10:30:00.000Z";
const SEED_COLLECTION_ID = "qa-collection-1";
const SEED_COLLECTION_NAME = "QA Collection";
const RELOAD_TIMEOUT_MS = 15_000;
const COLLECTION_LISTS = {
  folders: [],
  requests: [],
  chainConfigs: [],
};

type Section = "collections" | "environments" | "chains";

const uid = () => Math.random().toString(36).slice(2, 8);

function collection(id: string, name: string, description = "") {
  return { id, name, description, createdAt: 1700000000000, updatedAt: 1700000000000 };
}

function envelope(
  sections: Section[],
  data: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    idbVersion: 6,
    exportedAt: EXPORTED_AT,
    appVersion: "0.0.0-e2e",
    includesSecrets: false,
    sections,
    data,
    ...overrides,
  };
}

async function openImportDialog(page: Page) {
  await page.goto("/settings");
  await page.getByTestId("nav-data").click();
  await page.getByTestId("backup-import-btn").click();
  await expect(page.getByTestId("backup-import-dialog")).toBeVisible();
}

async function feedFile(page: Page, name: string, content: unknown) {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  await page.getByTestId("backup-file-input").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
}

const importError = (page: Page) => page.getByTestId("backup-import-error");
const dialog = (page: Page) => page.getByTestId("backup-import-dialog");

async function idbCollectionNames(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction("collections").objectStore("collections").getAll();
          req.onsuccess = () => {
            db.close();
            resolve((req.result as { name: string }[]).map((c) => c.name));
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

test.describe("Backup import @qa", () => {
  test("[REL-V2-BAKIMP-01] a non-JSON file shows \"This file is not valid JSON.\" and writes nothing", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const before = await countIdbRecords(page, "collections");
    expect(before).toBeGreaterThan(0);

    await feedFile(page, "notes.json", "this is { not json");

    await expect(importError(page)).toHaveText("This file is not valid JSON.");
    await expect(page.getByTestId("backup-preview")).toHaveCount(0);
    expect(await countIdbRecords(page, "collections")).toBe(before);
    await snap("01-invalid-json");
  });

  test("[REL-V2-BAKIMP-02] a Postman collection file shows the not-a-Requestr-backup message with a link to /import", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const postman = {
      info: {
        name: "Postman export",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [],
    };

    await feedFile(page, "postman.json", postman);

    await expect(importError(page)).toContainText(
      "This is not a Requestr backup. Use Import for Postman, Insomnia or OpenAPI files.",
    );
    const link = page.getByTestId("backup-import-link");
    await expect(link).toHaveText("Go to Import");
    await snap("02-foreign-file");
    await link.click();
    await expect(page).toHaveURL(/\/import$/);
  });

  test("[REL-V2-BAKIMP-03] a newer schemaVersion shows the update-the-app message", { tag: ["@qa", "@high"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);

    await feedFile(
      page,
      "newer.json",
      envelope(["collections"], { collections: [], ...COLLECTION_LISTS }, { schemaVersion: NEWER_SCHEMA_VERSION }),
    );

    await expect(importError(page)).toHaveText(
      "This backup was made by a newer version of Requestr (v99). Update the app to restore it.",
    );
    await expect(page.getByTestId("backup-preview")).toHaveCount(0);
    await snap("03-newer-version");
  });

  test("[REL-V2-BAKIMP-04] a damaged section shows \"The backup is damaged\" and writes nothing", { tag: ["@qa", "@high"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const before = await countIdbRecords(page, "collections");
    expect(before).toBeGreaterThan(0);
    const damaged = envelope(["collections"], {
      collections: [{ name: "No id here" }],
      ...COLLECTION_LISTS,
    });

    await feedFile(page, "damaged.json", damaged);

    await expect(importError(page)).toHaveText("The backup is damaged: Collections is invalid.");
    await expect(page.getByTestId("backup-restore-btn")).toHaveCount(0);
    expect(await countIdbRecords(page, "collections")).toBe(before);
    await snap("04-damaged-section");
  });

  test("[REL-V2-BAKIMP-05] a valid file shows the preview with counts, exportedAt and includesSecrets, and Merge is the default", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const id = uid();
    const valid = envelope(
      ["collections", "environments"],
      {
        collections: [collection(`bakimp5-a-${id}`, `A ${id}`), collection(`bakimp5-b-${id}`, `B ${id}`)],
        ...COLLECTION_LISTS,
        environments: [
          { id: `bakimp5-env-${id}`, name: `Env ${id}`, description: "", variables: [], createdAt: 1700000000000, updatedAt: 1700000000000 },
        ],
      },
      { includesSecrets: true },
    );

    await feedFile(page, "valid.json", valid);

    const preview = page.getByTestId("backup-preview");
    await expect(preview).toBeVisible();
    await expect(page.getByTestId("backup-preview-collections")).toContainText("2 items");
    await expect(page.getByTestId("backup-preview-environments")).toContainText("1 item");
    await expect(preview).toContainText(/Exported .*2026/);
    await expect(page.getByTestId("backup-preview-secrets")).toHaveText("Includes secret values");
    await expect(page.getByTestId("backup-mode-merge")).toBeChecked();
    await expect(page.getByTestId("backup-mode-replace")).not.toBeChecked();
    await snap("05-preview");
  });

  test("[REL-V2-BAKIMP-06] Merge of the same file twice changes nothing the second time and colliding records are kept as \" (imported)\"", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const id = uid();
    const newName = `BAKIMP06 New ${id}`;
    const file = envelope(["collections"], {
      collections: [
        collection(SEED_COLLECTION_ID, SEED_COLLECTION_NAME, `different description ${id}`),
        collection(`bakimp6-new-${id}`, newName),
      ],
      ...COLLECTION_LISTS,
    });
    const before = await countIdbRecords(page, "collections");
    expect(before).toBeGreaterThan(0);

    // First merge: both records are added; the id collision is stored next to the existing one.
    await feedFile(page, "merge.json", file);
    const firstLoad = page.waitForEvent("load", { timeout: RELOAD_TIMEOUT_MS });
    await page.getByTestId("backup-restore-btn").click();
    const summary = page.getByTestId("backup-summary");
    await expect(summary).toContainText("2 items added");
    await expect(summary).toContainText("1 item kept alongside your existing one");
    await snap("06-first-merge-summary");
    await firstLoad;

    const names = await idbCollectionNames(page);
    expect(names).toContain(newName);
    expect(names).toContain(`${SEED_COLLECTION_NAME} (imported)`);
    expect(names.filter((n) => n === SEED_COLLECTION_NAME)).toHaveLength(1);
    const afterFirst = await countIdbRecords(page, "collections");
    expect(afterFirst).toBe(before + 2);

    // Second merge of the same file: nothing new.
    await openImportDialog(page);
    await feedFile(page, "merge.json", file);
    await page.getByTestId("backup-restore-btn").click();
    await expect(page.getByTestId("backup-summary")).toContainText("2 identical items skipped");
    await expect(page.getByTestId("backup-summary")).toContainText("0 items added");
    await expect(page.getByTestId("backup-summary")).not.toContainText("kept alongside");
    expect(await countIdbRecords(page, "collections")).toBe(afterFirst);
    await snap("06-second-merge-summary");
  });

  test("[REL-V2-BAKIMP-07] Replace requires the confirmation that lists counts and Cancel changes nothing", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const id = uid();
    const file = envelope(["collections"], {
      collections: [collection(`bakimp7-${id}`, `BAKIMP07 ${id}`)],
      ...COLLECTION_LISTS,
    });
    const before = await countIdbRecords(page, "collections");
    expect(before).toBeGreaterThan(0);
    const namesBefore = await idbCollectionNames(page);

    await feedFile(page, "replace.json", file);
    await page.getByTestId("backup-mode-replace").check();
    await page.getByTestId("backup-restore-btn").click();

    const confirm = page.getByTestId("backup-replace-confirm");
    await expect(confirm).toBeVisible();
    await expect(page.getByTestId("backup-replace-count-collections")).toHaveText(
      `Collections: ${before} ${before === 1 ? "item" : "items"} will be deleted`,
    );
    await snap("07-replace-confirm");

    await confirm.getByRole("button", { name: "Cancel" }).click();

    await expect(confirm).toHaveCount(0);
    await expect(page.getByTestId("backup-preview")).toBeVisible();
    await expect(page.getByTestId("backup-summary")).toHaveCount(0);
    expect(await countIdbRecords(page, "collections")).toBe(before);
    expect(await idbCollectionNames(page)).toEqual(namesBefore);
  });

  test("[REL-V2-BAKIMP-08] Replace with a backup missing a request that a chain node references: the chain page renders the placeholder and the restore summary reports the dangling count", { tag: ["@qa", "@critical"] }, async ({ seededPage: page, snap }) => {
    await openImportDialog(page);
    const id = uid();
    const collectionId = `bakimp8-col-${id}`;
    const presentId = `bakimp8-req-${id}`;
    const goneId = `bakimp8-gone-${id}`;
    const chainId = `bakimp8-chain-${id}`;
    const request = {
      id: presentId,
      collectionId,
      folderId: null,
      name: `Present ${id}`,
      method: "GET",
      url: "https://api.qa-seed.test/users",
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    const chain = {
      id: chainId,
      scope: "standalone",
      schemaVersion: 5,
      name: `BAKIMP08 Chain ${id}`,
      createdAt: 1700000000000,
      blocks: [],
      nodeIds: [presentId, goneId],
      edges: [
        { id: `edge-${id}`, sourceRequestId: presentId, targetRequestId: goneId, targetUrl: "", injections: [] },
      ],
      nodePositions: { [presentId]: { x: 100, y: 100 }, [goneId]: { x: 450, y: 100 } },
    };
    const file = envelope(["collections", "chains"], {
      collections: [collection(collectionId, `BAKIMP08 ${id}`)],
      folders: [],
      requests: [request],
      chainConfigs: [],
      chains: [chain],
    });

    await feedFile(page, "dangling.json", file);
    await page.getByTestId("backup-mode-replace").check();
    await page.getByTestId("backup-restore-btn").click();
    await expect(page.getByTestId("backup-replace-confirm")).toBeVisible();
    const reloaded = page.waitForEvent("load", { timeout: RELOAD_TIMEOUT_MS });
    await page.getByTestId("backup-replace-confirm-btn").click();

    await expect(page.getByTestId("backup-summary-dangling")).toHaveText(
      "1 link points to an item that is missing.",
    );
    await snap("08-dangling-summary");
    await reloaded;

    await openChain(page, chainId);
    const missingNode = page.getByTestId(`chain-node-${goneId}`);
    await expect(missingNode).toContainText("Missing request");
    await expect(page.getByTestId(`chain-node-${presentId}`)).toBeVisible();
    await snap("08-chain-placeholder");
  });

  test("[REL-V2-BAKIMP-09] the Import page shows the \"Restore a Requestr backup\" card which opens the restore flow", { tag: ["@qa", "@medium"] }, async ({ seededPage: page, snap }) => {
    await page.goto("/import");

    const card = page.getByTestId("restore-backup-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: "Restore a Requestr backup" })).toBeVisible();
    await snap("09-restore-card");

    await page.getByTestId("restore-backup-btn").click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole("heading", { name: "Import backup" })).toBeVisible();
    await expect(page.getByTestId("backup-drop-zone")).toBeVisible();
    await snap("09-restore-dialog");
  });
});
