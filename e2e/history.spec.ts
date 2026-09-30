import { expect, type Locator, type Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearHistoryDB(page: Page) {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.open("requestly");
      req.onsuccess = () => {
        const db = req.result;
        if (db.objectStoreNames.contains("history")) {
          const tx = db.transaction("history", "readwrite");
          tx.objectStore("history").clear();
          tx.oncomplete = () => resolve(true);
        } else {
          resolve(true);
        }
      };
      req.onerror = () => resolve(false);
    });
  });
}

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

async function openTab(page: Page) {
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
}

async function sendRequest(page: Page, url: string) {
  const layout = getLayout(page);
  const urlInput = layout.getByTestId("url-input");
  await urlInput.fill(url);
  await page.keyboard.press("Escape");
  const sendBtn = layout.getByTestId("send-request-btn");
  await sendBtn.click();
}

// ---------------------------------------------------------------------------
// Test Suite: Request History
// ---------------------------------------------------------------------------

test.describe("Request History", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    await clearHistoryDB(page);
    await page.reload();
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
  });

  test("History entry is created after sending a request", async ({ page }) => {
    const testUrl = "https://dummyjson.com/products/1";
    await sendRequest(page, testUrl);

    // Wait for response to finish so history is recorded
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    // Open history tab
    await page.getByTestId("sidebar-tab-history").click();

    // Verify history item
    const historyList = page.getByTestId("history-list");
    await expect(historyList).toBeVisible();

    const firstItem = page.getByTestId("history-item").first();
    await expect(firstItem).toBeVisible();
    await expect(firstItem.getByTestId("history-item-url")).toHaveText(
      /products\/1/,
    );
    await expect(firstItem.getByTestId("history-item-status")).toHaveText(
      "200",
    );
  });

  test("Open a history entry into a new tab", async ({ page }) => {
    const testUrl = "https://dummyjson.com/products/2";
    await sendRequest(page, testUrl);
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    // Open history tab
    await page.getByTestId("sidebar-tab-history").click();

    // Click history item
    await page.getByTestId("history-item").first().click();

    // Verify new tab is opened with correct URL
    // We can check the active tab's URL input
    const layout = getLayout(page);
    await expect(layout.getByTestId("url-input")).toHaveValue(testUrl, {
      timeout: 10000,
    });
  });

  test("Delete a single history entry", async ({ page }) => {
    const testUrl = "https://dummyjson.com/products/3";
    await sendRequest(page, testUrl);
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId("sidebar-tab-history").click();
    const historyItem = page.getByTestId("history-item").first();
    await expect(historyItem).toBeVisible();

    // Hover and delete
    await historyItem.hover();
    await page.getByTestId("history-item-delete").click();

    // Verify entry is removed
    await expect(historyItem).not.toBeVisible();
    await expect(page.getByText("No requests sent yet")).toBeVisible();
  });

  test("Clear all history", async ({ page }) => {
    // Send two requests
    await sendRequest(page, "https://dummyjson.com/products/1");
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    await openTab(page);
    await sendRequest(page, "https://dummyjson.com/products/2");
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    // Navigate to Settings
    await page.getByTestId("sidebar-settings-btn").click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Go to General section
    await page.getByTestId("nav-general").click();

    // Click Clear History and confirm
    await page.getByTestId("clear-history-btn").click();
    await page.getByTestId("confirm-clear-history-btn").click();

    // Navigate back home and check history
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByTestId("sidebar-tab-history").click();

    await expect(page.getByTestId("history-item")).toHaveCount(0);
    await expect(page.getByText("No requests sent yet")).toBeVisible();
  });

  test("History persists after page reload", async ({ page }) => {
    const testUrl = "https://dummyjson.com/products/4";
    await sendRequest(page, testUrl);
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    // Reload page
    await page.reload();
    await expect(getLayout(page)).toBeVisible();

    // Open history tab
    await page.getByTestId("sidebar-tab-history").click();

    // Verify entry still exists
    const firstItem = page.getByTestId("history-item").first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });
    await expect(firstItem.getByTestId("history-item-url")).toHaveText(
      /products\/4/,
    );
  });
});
