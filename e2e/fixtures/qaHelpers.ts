import { expect, type Locator, type Page } from "@playwright/test";
import { IDB_DB_NAME } from "../../src/lib/idbSchema";

/**
 * Shared UI helpers for the QA walkthrough specs (e2e/qa/*.spec.ts).
 * Prefer seeded data (`seededPage`); use these only when the UI flow itself
 * is the feature under test.
 */

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

export async function openTab(page: Page) {
  // Every step after the first navigates here straight from a /chain/* page
  // left behind by the previous step — the /app sidebar chrome this helper
  // (and createCollection right after it) depends on only renders on /app.
  if (!page.url().includes("/app")) {
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
  }
  const layout = getLayout(page);
  const btn = layout.getByTestId("new-tab-btn");
  const isVisible = await btn
    .first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (isVisible) {
    await btn.first().click();
  } else {
    await page.keyboard.press("Control+t");
  }
  const urlInputAppeared = await layout
    .getByTestId("url-input")
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (!urlInputAppeared) {
    await btn
      .first()
      .click({ timeout: 3000 })
      .catch(() => undefined);
  }
}

export async function createCollection(page: Page, name: string) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByTestId("create-collection-item").click();
  const input = page.getByTestId("new-collection-name-input");
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(name);
  await page.keyboard.press("Enter");
}

export async function saveRequestToCollection(
  page: Page,
  requestName: string,
  url: string,
) {
  const layout = getLayout(page);
  await layout.getByTestId("url-input").fill(url);
  await page.keyboard.press("Escape");
  await layout.getByTestId("save-request-btn").click();
  await expect(page.getByTestId("save-request-modal")).toBeVisible({
    timeout: 5000,
  });
  await page.getByTestId("save-request-name-input").fill(requestName);
  await page
    .locator('[data-testid^="collection-picker-item-"]')
    .first()
    .click();
  await page.getByTestId("save-modal-save-btn").click();
  await expect(page.getByTestId("save-request-modal")).not.toBeVisible();
}

export async function createChain(page: Page, name: string) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByTestId("create-chain-item").click();
  const input = page.getByTestId("new-chain-name-input");
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(name);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/chain/**", { timeout: 5000, waitUntil: "commit" });
}

export async function addApiRequest(page: Page, requestText: string) {
  await page.getByTestId("chain-add-api-btn").click();
  await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
    timeout: 5000,
  });
  await page.getByText(requestText, { exact: true }).click();
  await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
    timeout: 5000,
  });
}

export async function addApiRequestViaBlockMenu(
  page: Page,
  requestText: string,
) {
  await page.getByTestId("block-menu-trigger").click();
  await page.getByTestId("block-menu-item-api").click();
  await expect(page.getByTestId("api-picker-dialog")).toBeVisible({
    timeout: 5000,
  });
  await page.getByText(requestText, { exact: true }).click();
  await expect(page.getByTestId("api-picker-dialog")).not.toBeVisible({
    timeout: 5000,
  });
}

/** Counts records in an app IndexedDB store — lets a test wait for persistence. */
export async function countIdbRecords(page: Page, storeName: string) {
  return page.evaluate(
    ({ dbName, store }) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(store)) {
            db.close();
            resolve(0);
            return;
          }
          const request = db.transaction(store).objectStore(store).count();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
    { dbName: IDB_DB_NAME, store: storeName },
  );
}
