import type { Page } from "@playwright/test";
import { IDB_DB_NAME, IDB_VERSION } from "../../../src/lib/idbSchema";
import { expect, test } from "../../fixtures/qa";

const APP_PATH = "/app";
const COLLAPSED_FOLDERS_KEY = "rq_collapsed_folders";

const OPENAI_ID = "qa-p2sb-openai";
const OPENAI_FIRST_URL = "https://api.example.test/v1/oa/0";
const EMPTY_COLLECTION_ID = "qa-p2sb-empty";

/** Health metrics need >= 5 history entries for the same method + URL. */
const HEALTH_HISTORY_COUNT = 6;
const SHORT_STEPS = 3;
const ARROW_STEPS = 14; // beyond the 10-row window + overscan, so rows must be scrolled into existence

const GROUP_LABELS = ["Requests", "Workspace", "Import"];

/**
 * Adds records the shared seed does not carry. Runs after seedQaData's init
 * script (registered later), once per browser context, so a reload keeps
 * whatever the app has changed since.
 */
async function seedExtras(
  page: Page,
  extras: { history?: unknown[]; folders?: unknown[]; requests?: unknown[] }
) {
  await page.addInitScript(
    (args) => {
      const FLAG = "e2e-p2-menu-extras";
      if (sessionStorage.getItem(FLAG)) return;
      sessionStorage.setItem(FLAG, "1");
      const req = indexedDB.open(args.dbName, args.version);
      req.onsuccess = () => {
        const db = req.result;
        for (const [store, records] of Object.entries(args.extras)) {
          if (!db.objectStoreNames.contains(store)) continue;
          const tx = db.transaction(store, "readwrite");
          for (const record of records ?? []) tx.objectStore(store).put(record);
        }
        db.close();
      };
    },
    { extras, dbName: IDB_DB_NAME, version: IDB_VERSION }
  );
}

function healthHistory() {
  return Array.from({ length: HEALTH_HISTORY_COUNT }, (_, i) => ({
    id: `qa-p2menu-hist-${i}`,
    method: "GET",
    url: OPENAI_FIRST_URL,
    status: 200,
    duration: 100 + i * 10,
    size: 512,
    timestamp: 1_810_000_000_000 + i * 1000,
    request: {},
    response: {},
  }));
}

/** Row locator by index plus the collection's own accordion position. */
async function arrowNavSetup(page: Page) {
  const list = page.getByTestId("virtualized-request-list");
  const row = (i: number) =>
    list
      .getByTestId("request-item")
      .filter({ hasText: `OA request ${String(i).padStart(3, "0")}` });
  const attr = await page
    .getByTestId(`collection-item-${OPENAI_ID}`)
    .getAttribute("data-index");
  return { row, collectionIndex: Number(attr) };
}

async function openCollection(page: Page, collectionId: string) {
  await page.getByTestId(`collection-name-${collectionId}`).click();
}

test.describe("P2 sidebar menu, health cursor and persistence @qa", () => {
  test("@critical + menu shows Requests / Workspace / Import labels in order and each item creates its entity", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(APP_PATH);
    const trigger = page.getByTestId("create-new-dropdown-trigger");
    const menu = page.getByRole("menu");
    const tabs = page.getByTestId("tab-bar").getByTestId("tab-close-btn");

    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("group")).toHaveCount(GROUP_LABELS.length);
    for (const [i, label] of GROUP_LABELS.entries()) {
      await expect(menu.getByRole("group").nth(i)).toHaveAccessibleName(label);
    }
    await expect(menu.getByRole("menuitem")).toHaveText([
      "HTTP",
      "GraphQL",
      "WebSocket",
      "Socket.IO",
      "Collection",
      "Environment",
      "Chain",
      "Import",
    ]);
    await snap("01-menu-groups");
    await page.keyboard.press("Escape");

    // Requests group: each item opens one new tab of its type.
    const baseline = await tabs.count();
    for (const [i, item] of [
      "HTTP",
      "GraphQL",
      "WebSocket",
      "Socket.IO",
    ].entries()) {
      await trigger.click();
      await menu.getByRole("menuitem", { name: item, exact: true }).click();
      await expect(tabs).toHaveCount(baseline + i + 1);
    }

    // Workspace group: Collection, Environment, Chain.
    const collectionName = `P2 menu collection ${Date.now()}`;
    await trigger.click();
    await menu
      .getByRole("menuitem", { name: "Collection", exact: true })
      .click();
    const collectionInput = page.getByTestId("new-collection-name-input");
    await collectionInput.fill(collectionName);
    await collectionInput.press("Enter");
    await expect(page.getByText(collectionName, { exact: true })).toBeVisible();

    const envName = `P2 menu env ${Date.now()}`;
    await trigger.click();
    await menu
      .getByRole("menuitem", { name: "Environment", exact: true })
      .click();
    const envInput = page.getByPlaceholder("Environment name");
    await envInput.fill(envName);
    await envInput.press("Enter");
    await expect(envInput).toBeHidden();
    await expect(
      page.getByText(envName, { exact: true }).first()
    ).toBeAttached();

    const chainName = `P2 menu chain ${Date.now()}`;
    await trigger.click();
    await menu.getByRole("menuitem", { name: "Chain", exact: true }).click();
    const chainInput = page.getByTestId("new-chain-name-input");
    await chainInput.fill(chainName);
    await chainInput.press("Enter");
    await page.waitForURL("**/chain/**", { waitUntil: "commit" });
    await snap("02-entities-created");

    // Import group: opens the import dialog.
    await page.goto(APP_PATH);
    await trigger.click();
    await menu.getByRole("menuitem", { name: "Import", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Import" })).toBeVisible();
    await snap("03-import-dialog");
  });

  test("@high health pill computed cursor is help and the popover opens", async ({
    seededPage: page,
    snap,
  }) => {
    await seedExtras(page, { history: healthHistory() });
    await page.goto(APP_PATH);
    await openCollection(page, OPENAI_ID);

    const pill = page
      .getByTestId("virtualized-request-list")
      .getByRole("button", { name: /^Last \d+ requests/ })
      .first();
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("cursor", "help");

    await pill.click();
    const popover = page.getByText("Request Health");
    await expect(popover).toBeVisible();
    await expect(
      page.getByText(`Last ${HEALTH_HISTORY_COUNT} requests`).last()
    ).toBeVisible();
    await snap("04-health-popover");
  });

  test("@high expand state survives reload", async ({
    seededPage: page,
    snap,
  }) => {
    const folderId = "qa-p2menu-folder";
    await seedExtras(page, {
      folders: [
        {
          id: folderId,
          collectionId: EMPTY_COLLECTION_ID,
          name: "P2 persisted folder",
          parentFolderId: null,
          order: 0,
        },
      ],
      requests: [
        {
          id: "qa-p2menu-folder-req",
          collectionId: EMPTY_COLLECTION_ID,
          folderId,
          name: "P2 folder request",
          method: "GET",
          url: "https://api.example.test/v1/folder",
          params: [],
          headers: [],
          auth: { type: "none" },
          body: { type: "none", content: "" },
          preScript: "",
          postScript: "",
          createdAt: 1_810_000_200_000,
        },
      ],
    });
    await page.goto(APP_PATH);
    await openCollection(page, EMPTY_COLLECTION_ID);

    const folderRow = page.getByTestId(`folder-item-${folderId}`);
    const folderRequest = page.getByText("P2 folder request", { exact: true });
    await expect(folderRow).toBeVisible();
    await expect(folderRequest).toBeVisible(); // folders start expanded

    await folderRow.click();
    await expect(folderRequest).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate((k) => localStorage.getItem(k), COLLAPSED_FOLDERS_KEY)
      )
      .toContain(folderId);

    await page.reload();
    await openCollection(page, EMPTY_COLLECTION_ID);
    await expect(page.getByTestId(`folder-item-${folderId}`)).toBeVisible();
    await expect(folderRequest).toBeHidden();
    await snap("05-folder-stays-collapsed");

    await page.getByTestId(`folder-item-${folderId}`).click();
    await expect(folderRequest).toBeVisible();
    await page.reload();
    await openCollection(page, EMPTY_COLLECTION_ID);
    await expect(folderRequest).toBeVisible();
  });

  test("@high arrow keys navigate the virtualized list", async ({
    seededPage: page,
    snap,
  }) => {
    await page.goto(APP_PATH);
    await openCollection(page, OPENAI_ID);
    const { row, collectionIndex } = await arrowNavSetup(page);
    // Precondition for the in-window steps below: no accidental index collision.
    expect(collectionIndex).toBeGreaterThan(SHORT_STEPS);

    await row(0).focus();
    await expect(row(0)).toBeFocused();
    for (let i = 1; i <= SHORT_STEPS; i++) {
      await page.keyboard.press("ArrowDown");
      await expect(row(i)).toBeFocused();
    }
    await page.keyboard.press("ArrowUp");
    await expect(row(SHORT_STEPS - 1)).toBeFocused();
    await snap("06-arrow-nav-in-window");
  });

  test(
    "@high arrow keys walk every row past the virtualized window without jumping",
    async ({ seededPage: page, snap }) => {
      await page.goto(APP_PATH);
      await openCollection(page, OPENAI_ID);
      const { row, collectionIndex } = await arrowNavSetup(page);
      const steps = Math.max(ARROW_STEPS, collectionIndex + 2);

      await row(0).focus();
      for (let i = 1; i <= steps; i++) {
        await page.keyboard.press("ArrowDown");
        await expect(row(i)).toBeFocused({ timeout: 2000 });
      }
      await snap("07-arrow-nav-past-window");
    }
  );
});
