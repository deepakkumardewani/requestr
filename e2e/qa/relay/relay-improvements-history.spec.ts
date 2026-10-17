import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../../src/lib/idbSchema";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes, type RelayScript } from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const SEEDED_ENTRY_COUNT = 7;
const HAR_VERSION = "1.2";
const FILENAME_JSON = /^requestr-history-\d{4}-\d{2}-\d{2}\.json$/;
const FILENAME_HAR = /^requestr-history-\d{4}-\d{2}-\d{2}\.har$/;
const HISTORY_STORE = "history";

const historyItems = (page: Page) => page.getByTestId("history-item");
const actionsButton = (page: Page) => page.getByTestId("history-actions-btn");

const calls = (...items: { toolName: string; input: unknown }[]) =>
  ({ kind: "clientTools", calls: items }) satisfies RelayScript;

async function openHistory(page: Page) {
  await page.goto(WORKSPACE_PATH);
  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("history-list")).toBeVisible();
}

async function openHistoryWithEntries(page: Page) {
  await openHistory(page);
  await expect(historyItems(page)).toHaveCount(SEEDED_ENTRY_COUNT);
}

async function openExportSubmenu(page: Page) {
  await actionsButton(page).click();
  await page.getByTestId("history-export-trigger").click();
}

async function exportAs(page: Page, format: "json" | "har"): Promise<Download> {
  await openExportSubmenu(page);
  const download = page.waitForEvent("download");
  await page.getByTestId(`history-export-${format}`).click();
  return download;
}

async function readDownload(download: Download): Promise<unknown> {
  const filePath = await download.path();
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function clearViaMenu(page: Page) {
  await actionsButton(page).click();
  await page.getByTestId("history-clear-all").click();
  await expect(page.getByTestId("clear-history-dialog")).toBeVisible();
}

async function clearHistoryStore(page: Page) {
  await page.evaluate(
    ({ dbName, store }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: HISTORY_STORE },
  );
}

test.describe("History menu, export and clear", () => {
  test("[REL-HIST-01] the ⋯ menu lists Export (JSON, HAR) and a red Clear all", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    await openHistoryWithEntries(page);

    await actionsButton(page).click();
    await expect(page.getByTestId("history-export-trigger")).toBeVisible();
    await expect(page.getByTestId("history-clear-all")).toBeVisible();
    await expect(page.getByTestId("history-clear-all")).toHaveAttribute(
      "data-variant",
      "destructive",
    );

    await page.getByTestId("history-export-trigger").click();
    await expect(page.getByTestId("history-export-json")).toBeVisible();
    await expect(page.getByTestId("history-export-har")).toBeVisible();
  });

  test("[REL-HIST-02] JSON export downloads requestr-history-<date>.json and HAR export parses with log.version 1.2", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
  }) => {
    await openHistoryWithEntries(page);

    const jsonDownload = await exportAs(page, "json");
    expect(jsonDownload.suggestedFilename()).toMatch(FILENAME_JSON);
    const json = (await readDownload(jsonDownload)) as { entries?: unknown[] };
    const jsonEntries = Array.isArray(json) ? json : json.entries;
    expect(jsonEntries).toHaveLength(SEEDED_ENTRY_COUNT);

    const harDownload = await exportAs(page, "har");
    expect(harDownload.suggestedFilename()).toMatch(FILENAME_HAR);
    const har = (await readDownload(harDownload)) as {
      log: { version: string; entries: unknown[] };
    };
    expect(har.log.version).toBe(HAR_VERSION);
    expect(har.log.entries).toHaveLength(SEEDED_ENTRY_COUNT);
  });

  test("[REL-HIST-03] Clear all shows the count; Cancel keeps entries and Confirm clears them", { tag: ["@qa", "@critical"] }, async ({
    seededPage: page,
  }) => {
    await openHistoryWithEntries(page);

    await clearViaMenu(page);
    await expect(page.getByTestId("clear-history-body")).toContainText(
      String(SEEDED_ENTRY_COUNT),
    );
    await page.getByTestId("clear-history-cancel").click();
    await expect(page.getByTestId("clear-history-dialog")).toBeHidden();
    await expect(historyItems(page)).toHaveCount(SEEDED_ENTRY_COUNT);

    await clearViaMenu(page);
    await page.getByTestId("clear-history-confirm").click();
    await expect(page.getByTestId("clear-history-dialog")).toBeHidden();
    await expect(historyItems(page)).toHaveCount(0);
  });

  test("[REL-HIST-04] chat clear_history needs the ConfirmCard and export_history downloads a file", { tag: ["@qa", "@high"] }, async ({
    seededPage: page,
  }) => {
    await installRelayRoutes(page, [
      calls({ toolName: "export_history", input: { format: "json" } }),
      { kind: "text", text: "Exported your history." },
      calls({ toolName: "clear_history", input: {} }),
      { kind: "text", text: "History cleared." },
    ]);
    await openHistoryWithEntries(page);
    await openRelay(page);

    const download = page.waitForEvent("download");
    await sendMessage(page, "export my history");
    expect((await download).suggestedFilename()).toMatch(FILENAME_JSON);
    await expect(page.getByTestId("relay-confirm-card")).toHaveCount(0);
    await expect(
      page.getByTestId("relay-message-assistant").last(),
    ).toContainText("Exported your history.");

    await sendMessage(page, "clear my history");
    await expect(page.getByTestId("relay-confirm-card")).toBeVisible();
    await expect(historyItems(page)).toHaveCount(SEEDED_ENTRY_COUNT);

    await page.getByTestId("relay-confirm-approve").click();
    await expect(historyItems(page)).toHaveCount(0);
  });

  test("[REL-HIST-05] with no history entries the menu still opens and Export produces a file with zero entries", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
  }) => {
    await openHistoryWithEntries(page);
    await clearHistoryStore(page);
    await page.reload();
    await page.getByTestId("sidebar-tab-history").click();
    await expect(historyItems(page)).toHaveCount(0);

    const download = await exportAs(page, "json");
    expect(download.suggestedFilename()).toMatch(FILENAME_JSON);
    const json = (await readDownload(download)) as { entries?: unknown[] };
    expect(Array.isArray(json) ? json : json.entries).toHaveLength(0);
  });

  test("[REL-HIST-06] after Confirm clear, a reload still shows an empty history", { tag: ["@qa", "@medium"] }, async ({
    seededPage: page,
  }) => {
    await openHistoryWithEntries(page);
    await clearViaMenu(page);
    await page.getByTestId("clear-history-confirm").click();
    await expect(historyItems(page)).toHaveCount(0);

    await page.reload();
    await page.getByTestId("sidebar-tab-history").click();
    await expect(page.getByTestId("history-list")).toBeVisible();
    await expect(historyItems(page)).toHaveCount(0);
  });
});
