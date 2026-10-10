import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clear persisted tab state from IndexedDB before page scripts run. */
async function clearTabsDB(page: Page) {
  await page.addInitScript(async () => {
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("tabs")) {
        const tx = db.transaction("tabs", "readwrite");
        tx.objectStore("tabs").clear();
      }
    };
  });
}

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

/** Open a new tab */
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
  await page.keyboard.press("Escape"); // blur any suggestions
  const sendBtn = layout.getByTestId("send-request-btn");
  await sendBtn.click();
}

// ---------------------------------------------------------------------------
// Test Suite: Response Viewing
// ---------------------------------------------------------------------------

test.describe("Response Viewing", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
  });

  // Scenario: View response status code
  test("shows response status code and color", async ({ page }) => {
    // 200 OK from dummyjson
    await sendRequest(page, "https://dummyjson.com/products/1");

    const badge = page.getByTestId("response-status-badge");
    // Wait until response arrives (badge shows up and turns green)
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
    await expect(badge).toHaveClass(/text-emerald-400/);

    const statusText = page.getByTestId("response-status-text");
    await expect(statusText).toHaveText("OK");
  });

  // Scenario: View pretty-printed response body
  test("shows pretty-printed JSON response body", async ({ page }) => {
    await sendRequest(page, "https://dummyjson.com/users/1");

    await page.getByTestId("view-mode-pretty").click();
    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible({ timeout: 15000 });

    // User 1 has firstName "Emily"
    await expect(prettyViewer).toContainText('"firstName"');
    await expect(prettyViewer).toContainText('"Emily"');
  });

  // Scenario: View raw response body
  test("shows raw (unformatted) response body", async ({ page }) => {
    await sendRequest(page, "https://dummyjson.com/products/category-list");

    await page.getByTestId("view-mode-raw").click();
    const rawViewer = page.getByTestId("response-raw-viewer");
    await expect(rawViewer).toBeVisible({ timeout: 15000 });

    const rawBody = page.getByTestId("response-raw-body");
    await expect(rawBody).toContainText('"beauty"');
    await expect(rawBody).toContainText('"smartphones"');
  });

  // Scenario: View response headers
  test("shows response headers in a table", async ({ page }) => {
    await sendRequest(page, "https://dummyjson.com/products/1");

    await page.getByTestId("response-tab-headers").click();
    const headersTable = page.getByTestId("response-headers-table").first();
    await expect(headersTable).toBeVisible({ timeout: 15000 });

    // DummyJSON returns content-type: application/json
    const row = page.getByTestId("response-header-row").filter({
      has: page
        .getByTestId("response-header-name")
        .getByText("content-type", { exact: true }),
    });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("response-header-value")).toContainText(
      "application/json",
    );
  });

  // Scenario: View response timing
  test("shows response timing breakdown waterfall", async ({ page }) => {
    await sendRequest(page, "https://dummyjson.com/products");

    await page.getByTestId("response-tab-timing").click();
    const timingWaterfall = page.getByTestId("response-timing-waterfall");
    await expect(timingWaterfall).toBeVisible({ timeout: 15000 });

    // At least one timing row should exist
    const rows = page.getByTestId("timing-row");
    await expect(rows.first()).toBeVisible();
  });

  // Scenario: Preview HTML response
  test("previews HTML response in an iframe", async ({ page }) => {
    // The base URL returns an HTML page
    await sendRequest(page, "https://dummyjson.com/");

    await page.getByTestId("view-mode-preview").click();
    const iframe = page.getByTestId("response-preview-iframe");
    await expect(iframe).toBeVisible({ timeout: 15000 });
  });

  // Scenario: Copy response body to clipboard
  test("copies response body to clipboard", async ({ page, context }) => {
    // Grant clipboard write permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await sendRequest(page, "https://dummyjson.com/users/search?q=Emily");

    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible({ timeout: 15000 });

    await page.getByTestId("response-copy-btn").click();

    // Verify clipboard content
    const clipboardText = await page.evaluate("navigator.clipboard.readText()");
    expect(clipboardText).toContain('"Emily"');
  });

  // Scenario: Download response body
  test("downloads response body as a file", async ({ page }) => {
    await sendRequest(page, "https://dummyjson.com/products/1");

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("response-download-btn").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("response.json");
  });

  // Scenario: Response size and duration are shown
  test("shows response size and duration in the meta bar", async ({ page }) => {
    await sendRequest(page, "https://dummyjson.com/products/1");

    const meta = page.getByTestId("response-meta");
    await expect(meta).toBeVisible({ timeout: 15000 });

    const size = page.getByTestId("response-size");
    await expect(size).toContainText("B"); // e.g. "1.5 KB"

    const duration = page.getByTestId("response-duration");
    await expect(duration).toContainText("ms");
  });

  // Scenario: Error response is displayed
  test("displays error details for 4xx/5xx status codes", async ({ page }) => {
    // Trigger a 404 response
    await sendRequest(page, "https://dummyjson.com/products/99999");

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("404");
    // red/amber for 4xx
    await expect(badge).toHaveClass(/text-amber-400/);

    const explainer = page.getByTestId("error-explainer");
    await expect(explainer).toBeVisible();
    await page.getByTestId("error-explainer-trigger").hover();
    await expect(page.getByTestId("error-explainer-content")).toBeVisible({
      timeout: 5000,
    });
  });

  // Scenario: Network error is shown
  test("shows network error state when request fails completely", async ({
    page,
  }) => {
    // Intentionally bad URL to fail DNS/Network
    await sendRequest(page, "https://this-invalid-domain-will-fail-12345.com");

    const errorState = page.getByTestId("response-error-state");
    await expect(errorState).toBeVisible({ timeout: 15000 });
    await expect(errorState).toContainText("failed");
  });
});

test.describe("Response display limit", () => {
  const DISPLAY_LIMIT_BYTES = 10_485_760;
  const OVERSIZED_BYTES = DISPLAY_LIMIT_BYTES + 1024;
  const SMALL_BYTES = 2048;

  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
  });

  function largeUrl(bytes: number, testId: string): string {
    return `${MOCK_BASE_URL}/large?bytes=${bytes}&testId=${testId}`;
  }

  test("E-REQ-15: Oversized response is truncated in view but downloadable in full", async ({
    page,
  }, testInfo) => {
    const id = `resp-${testInfo.testId}-${testInfo.repeatEachIndex}`;
    await sendRequest(page, largeUrl(OVERSIZED_BYTES, id));
    await expect(page.getByTestId("response-status-badge")).toHaveText("200", {
      timeout: 30000,
    });

    await page.getByTestId("view-mode-raw").click();
    await expect(
      page.getByText(/Response truncated at 10(\.0)? MB\. Download full response/),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("response-download-btn").click();
    const download = await downloadPromise;
    const path = await download.path();
    const { size } = await readFile(path).then((b) => ({ size: b.length }));
    expect(size).toBe(OVERSIZED_BYTES);
  });

  test("E-REQ-15: Response under the display limit shows no truncation message", async ({
    page,
  }, testInfo) => {
    const id = `resp-small-${testInfo.testId}-${testInfo.repeatEachIndex}`;
    await sendRequest(page, largeUrl(SMALL_BYTES, id));
    await expect(page.getByTestId("response-status-badge")).toHaveText("200");

    await page.getByTestId("view-mode-raw").click();
    await expect(page.getByTestId("response-raw-viewer")).toBeVisible();
    await expect(page.getByText(/Response truncated at/)).toHaveCount(0);
  });
});
