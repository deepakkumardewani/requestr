import type { Page } from "@playwright/test";
import {
  type CapturedDownload,
  downloadCapture,
} from "../../fixtures/relayV2Helpers";
import { expect, test } from "../../fixtures/qa";

const SETTINGS_PATH = "/settings";
const BACKUP_APP_ID = "requestr-backup";
const ANON_ID_KEY = "rq_anon_id";
const ANON_ID_VALUE = "anon-bakexp-sentinel-3c9a";
const ALPHA_ID = "qa-v2bk-col-a";
const BETA_ID = "qa-v2bk-col-b";
const SECRET_SENTINELS = [
  "SECRET-BEARER-ALPHA-91f3",
  "SECRET-HEADER-ALPHA-4a7c",
  "SECRET-BASIC-ALPHA-22de",
  "SECRET-APIKEY-BETA-58b0",
  "SECRET-ENV-INIT-7d2e",
  "SECRET-ENV-CUR-7d2e",
];

type BackupFile = {
  app: string;
  includesSecrets: boolean;
  sections: string[];
  data: {
    collections?: { id: string }[];
    folders?: { id: string; collectionId: string }[];
    requests?: { id: string; collectionId: string }[];
    preferences?: Record<string, string>;
  };
};

async function openExportDialog(page: Page) {
  await page.goto(SETTINGS_PATH);
  await page.getByTestId("nav-data").click();
  await page.getByTestId("backup-export-btn").click();
  await expect(page.getByTestId("backup-export-dialog")).toBeVisible();
  await expect(page.getByTestId("backup-download-btn")).toBeEnabled();
}

function download(page: Page): Promise<CapturedDownload> {
  return downloadCapture(page, () =>
    page.getByTestId("backup-download-btn").click(),
  );
}

test.describe("Relay v2 backup export @qa", () => {
  test("[REL-V2-BAKEXP-01] Settings, Data shows Export backup and Import backup @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(SETTINGS_PATH);
    await page.getByTestId("nav-data").click();
    await expect(page.getByRole("heading", { name: "Data" })).toBeVisible();
    await expect(page.getByTestId("backup-export-btn")).toHaveText(
      /Export backup/,
    );
    await expect(page.getByTestId("backup-import-btn")).toHaveText(
      /Import backup/,
    );
    await snap("01-data-section");
  });

  test("[REL-V2-BAKEXP-02] exporting everything with secrets off downloads a file with app requestr-backup, includesSecrets false and every seeded secret sentinel blank @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openExportDialog(page);
    await expect(page.getByTestId("backup-secrets-toggle")).not.toBeChecked();
    await snap("02-export-secrets-off");

    const file = await download(page);
    const backup = file.json<BackupFile>();

    expect(file.filename).toMatch(/^requestr-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(backup.app).toBe(BACKUP_APP_ID);
    expect(backup.includesSecrets).toBe(false);
    // Non-vacuous: the seeded records are present, only their secrets are gone.
    expect(backup.data.requests?.map((r) => r.id)).toEqual(
      expect.arrayContaining(["qa-v2bk-req-a1", "qa-v2bk-req-b1"]),
    );
    for (const sentinel of SECRET_SENTINELS) {
      expect(file.text).not.toContain(sentinel);
    }
  });

  test("[REL-V2-BAKEXP-03] turning Include secret values on shows the warning and the downloaded file contains the sentinels with includesSecrets true @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await openExportDialog(page);
    await page.getByTestId("backup-secrets-toggle").click();
    await expect(page.getByTestId("backup-secrets-toggle")).toBeChecked();
    await expect(page.getByTestId("backup-secrets-warning")).toContainText(
      "Anyone with this file can read your secrets",
    );
    await expect(page.getByTestId("backup-secrets-warning")).toContainText(
      "Saved responses in history may also contain secrets",
    );
    await snap("03-export-secrets-on-warning");

    const file = await download(page);
    expect(file.json<BackupFile>().includesSecrets).toBe(true);
    for (const sentinel of SECRET_SENTINELS) {
      expect(file.text).toContain(sentinel);
    }
  });

  test("[REL-V2-BAKEXP-04] Choose mode with one collection selected exports only that collection with its folders and requests, and shows per-section counts before download @high", async ({
    seededPage: page,
    snap,
  }) => {
    await openExportDialog(page);
    await page.getByTestId("backup-mode-choose").click();

    const items = page.getByTestId("backup-items-collections");
    await expect(items).toBeVisible();
    const boxes = items.getByTestId(/^backup-item-collections-/);
    await expect(boxes.first()).toBeVisible();
    // Untick every collection except Alpha.
    for (const box of await boxes.all()) {
      const testId = await box.getAttribute("data-testid");
      if (testId !== `backup-item-collections-${ALPHA_ID}`) {
        await box.click();
        await expect(box).not.toBeChecked();
      }
    }
    await expect(
      page.getByTestId(`backup-item-collections-${ALPHA_ID}`),
    ).toBeChecked();
    await expect(page.getByTestId("backup-count-collections")).toBeVisible();
    await expect(page.getByTestId("backup-count-collections")).toHaveText(
      "1 item",
    );
    // Environments are not narrowed by the collection selection: the 4 from
    // the shared qa-seed harness plus this spec's 1 seeded environment.
    await expect(page.getByTestId("backup-count-environments")).toHaveText(
      "5 items",
    );
    // The export is re-prepared after each selection change.
    await expect(page.getByTestId("backup-download-btn")).toBeEnabled();
    await snap("04-choose-one-collection");

    const backup = (await download(page)).json<BackupFile>();
    expect(backup.data.collections?.map((c) => c.id)).toEqual([ALPHA_ID]);
    expect(backup.data.folders?.map((f) => f.id)).toEqual([
      "qa-v2bk-folder-a",
    ]);
    expect(backup.data.requests?.map((r) => r.id).sort()).toEqual([
      "qa-v2bk-req-a1",
      "qa-v2bk-req-a2",
    ]);
    expect(
      backup.data.requests?.some((r) => r.collectionId === BETA_ID),
    ).toBe(false);
  });

  test("[REL-V2-BAKEXP-05] Relay threads are unticked by default and show the conversations note @medium", async ({
    seededPage: page,
    snap,
  }) => {
    await openExportDialog(page);
    await page.getByTestId("backup-mode-choose").click();
    await expect(page.getByTestId("backup-section-collections")).toBeChecked();
    await expect(
      page.getByTestId("backup-section-relayThreads"),
    ).not.toBeChecked();
    await expect(page.getByTestId("backup-section-picker")).toContainText(
      "Conversations may contain values you shared with Relay.",
    );
    await snap("05-relay-threads-unticked");
  });

  test("[REL-V2-BAKEXP-06] the exported file does not include excluded preferences such as rq_anon_id @high", async ({
    seededPage: page,
    snap,
  }) => {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [ANON_ID_KEY, ANON_ID_VALUE],
    );
    await openExportDialog(page);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), ANON_ID_KEY),
    ).toBe(ANON_ID_VALUE);
    await snap("06-export-dialog");

    const file = await download(page);
    const backup = file.json<BackupFile>();
    // Non-vacuous: the preferences section is exported, just without the anon id.
    expect(backup.sections).toContain("preferences");
    expect(backup.data.preferences).toBeDefined();
    expect(file.text).not.toContain(ANON_ID_KEY);
    expect(file.text).not.toContain(ANON_ID_VALUE);
  });
});
