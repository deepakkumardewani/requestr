import path from "path";
import { expect, test, type Page } from "@playwright/test";
import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

// Resolve fixture file paths relative to this file
const fixturesDir = path.join(__dirname, "fixtures", "import");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearCollectionsDB(page: Page) {
  await page.addInitScript(async () => {
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("collections")) {
        const tx = db.transaction("collections", "readwrite");
        tx.objectStore("collections").clear();
      }
      if (db.objectStoreNames.contains("requests")) {
        const tx = db.transaction("requests", "readwrite");
        tx.objectStore("requests").clear();
      }
      if (db.objectStoreNames.contains("tabs")) {
        const tx = db.transaction("tabs", "readwrite");
        tx.objectStore("tabs").clear();
      }
    };
  });
}

async function openImportDialog(page: Page) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  // Click on import menu item using role
  await page.getByRole("menuitem").filter({ hasText: /import/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
}

async function uploadFileAndScan(page: Page, filePath: string) {
  // File tab should be default
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  // File should be queued - wait for the "Choose a different file" button
  await expect(
    page.getByRole("button", { name: /Choose a different file/ }),
  ).toBeVisible({ timeout: 3000 });

  // Click Scan button
  const scanBtn = page.getByRole("button", { name: /^Scan/ });
  await expect(scanBtn).toBeEnabled();
  await scanBtn.click();

  // Wait for review step
  await expect(page.getByText(/Review import/)).toBeVisible({
    timeout: 10000,
  });
}

async function completeImport(page: Page) {
  // Click Import button
  const importBtn = page.getByRole("button", { name: /^Import/ });
  await importBtn.click();

  // Dialog should close
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Toast should appear
  await expect(page.getByText(/Imported|cURL imported/)).toBeVisible({
    timeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("E-COL-01 Import a nested Postman v2.1 collection", async ({ page }) => {
  await clearCollectionsDB(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");

  // Verify sidebar is ready
  await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible({
    timeout: 10000,
  });

  // Open import dialog
  await openImportDialog(page);

  // Upload and scan Postman file
  const postmanFilePath = path.join(fixturesDir, "postman-v2.1-nested.json");
  await uploadFileAndScan(page, postmanFilePath);

  // Verify summary appears with collection name (check within dialog)
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("text=/Nested API Collection/")).toBeVisible();
  await expect(dialog.locator("text=/request/i")).toBeVisible();

  // Complete import
  await completeImport(page);

  // Verify collection appears in sidebar
  const collectionItem = page.locator(
    '[data-testid^="collection-item-"]',
  ).first();
  await expect(collectionItem).toBeVisible({ timeout: 5000 });

  // Expand collection to verify requests exist
  const testId = await collectionItem.getAttribute("data-testid");
  if (testId) {
    const collectionId = testId.replace("collection-item-", "");
    await page.getByTestId(`collection-name-${collectionId}`).click();

    // Check that requests exist
    const requestItems = page.locator('[data-testid^="request-item-"]');
    const count = await requestItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  }
});

test("E-COL-02 Import dialog rejects a file that cannot be parsed", async ({
  page,
}) => {
  await clearCollectionsDB(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");

  // Verify sidebar is ready
  await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible({
    timeout: 10000,
  });

  // Open import dialog
  await openImportDialog(page);

  // Upload invalid file
  const fileInput = page.locator('input[type="file"]');
  const invalidFilePath = path.join(fixturesDir, "invalid-content.txt");
  await fileInput.setInputFiles(invalidFilePath);

  // File should be queued
  await expect(
    page.getByRole("button", { name: /Choose a different file/ }),
  ).toBeVisible({ timeout: 3000 });

  // Click Scan
  const scanBtn = page.getByRole("button", { name: /^Scan/ });
  await scanBtn.click();

  // Error message should appear
  await expect(
    page.locator("text=/Unrecognized format|Failed to scan/i"),
  ).toBeVisible({ timeout: 5000 });

  // Dialog should still be on input step (no "Review import" heading)
  const reviewHeading = page.getByRole("heading", { name: /Review import/ });
  await expect(reviewHeading).not.toBeVisible();

  // Sidebar should have no collections
  const collectionItems = page.locator('[data-testid^="collection-item-"]');
  const count = await collectionItems.count();
  expect(count).toBe(0);
});

test("E-COL-06 Import an Insomnia v4 export", async ({ page }) => {
  await clearCollectionsDB(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");

  // Verify sidebar is ready
  await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible({
    timeout: 10000,
  });

  // Open import dialog
  await openImportDialog(page);

  // Upload and scan Insomnia file
  const insomniaFilePath = path.join(fixturesDir, "insomnia-v4.json");
  await uploadFileAndScan(page, insomniaFilePath);

  // Verify summary appears (check that dialog is still visible and shows import info)
  const dialog2 = page.getByRole("dialog");
  await expect(dialog2).toBeVisible();
  // Summary should show the import details
  const summary = dialog2.locator("text=/request/");
  await expect(summary).toBeVisible();

  // Complete import
  await completeImport(page);

  // Verify collection appears
  const collectionItem = page.locator(
    '[data-testid^="collection-item-"]',
  ).first();
  await expect(collectionItem).toBeVisible({ timeout: 5000 });

  // Expand and verify requests
  const testId = await collectionItem.getAttribute("data-testid");
  if (testId) {
    const collectionId = testId.replace("collection-item-", "");
    await page.getByTestId(`collection-name-${collectionId}`).click();

    const requestItems = page.locator('[data-testid^="request-item-"]');
    const count = await requestItems.count();
    expect(count).toBeGreaterThanOrEqual(3);
  }
});

test("E-COL-06 Import an OpenAPI 3 JSON file", async ({ page }) => {
  await clearCollectionsDB(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");

  // Verify sidebar is ready
  await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible({
    timeout: 10000,
  });

  // Open import dialog
  await openImportDialog(page);

  // Upload and scan OpenAPI JSON file
  const openapiPath = path.join(fixturesDir, "openapi-3-spec.json");
  await uploadFileAndScan(page, openapiPath);

  // Verify summary appears (check that dialog shows import info)
  const dialog3 = page.getByRole("dialog");
  await expect(dialog3).toBeVisible();
  // Verify it shows request count (first match)
  await expect(dialog3.locator("text=/request/").first()).toBeVisible();

  // Complete import
  await completeImport(page);

  // Verify collection appears
  const collectionItem = page.locator(
    '[data-testid^="collection-item-"]',
  ).first();
  await expect(collectionItem).toBeVisible({ timeout: 5000 });

  // Expand and verify requests from operations
  const testId = await collectionItem.getAttribute("data-testid");
  if (testId) {
    const collectionId = testId.replace("collection-item-", "");
    await page.getByTestId(`collection-name-${collectionId}`).click();

    const requestItems = page.locator('[data-testid^="request-item-"]');
    const count = await requestItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  }
});

test("E-COL-06 Import an OpenAPI 3 YAML file", async ({ page }) => {
  await clearCollectionsDB(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");

  // Verify sidebar is ready
  await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible({
    timeout: 10000,
  });

  // Open import dialog
  await openImportDialog(page);

  // Upload and scan OpenAPI YAML file
  const yamlPath = path.join(fixturesDir, "openapi-3-spec.yaml");
  await uploadFileAndScan(page, yamlPath);

  // Verify summary appears (check that dialog shows import info)
  const dialog4 = page.getByRole("dialog");
  await expect(dialog4).toBeVisible();
  // Verify it shows request count
  await expect(dialog4.locator("text=/request/")).toBeVisible();

  // Complete import
  await completeImport(page);

  // Verify collection appears
  const collectionItem = page.locator(
    '[data-testid^="collection-item-"]',
  ).first();
  await expect(collectionItem).toBeVisible({ timeout: 5000 });

  // Expand and verify requests from operations
  const testId = await collectionItem.getAttribute("data-testid");
  if (testId) {
    const collectionId = testId.replace("collection-item-", "");
    await page.getByTestId(`collection-name-${collectionId}`).click();

    const requestItems = page.locator('[data-testid^="request-item-"]');
    const count = await requestItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  }
});

test("E-COL-06 Import from a cURL command", async ({ page }) => {
  await clearCollectionsDB(page);
  await page.goto("/app");
  await page.waitForLoadState("networkidle");

  // Verify sidebar is ready
  await expect(page.getByTestId("sidebar-tab-collections")).toBeVisible({
    timeout: 10000,
  });

  // Open import dialog
  await openImportDialog(page);

  // Click cURL tab
  await page.getByRole("tab", { name: /curl/i }).click();

  // Paste cURL command
  const curlCommand =
    `curl -X POST '${MOCK_BASE_URL}/echo' -H 'Content-Type: application/json' -H 'Authorization: Bearer token123' -d '{"test": "data"}'`;
  const textarea = page.locator("textarea");
  await textarea.fill(curlCommand);

  // Click Scan
  const scanBtn = page.getByRole("button", { name: /^Scan/ });
  await expect(scanBtn).toBeEnabled();
  await scanBtn.click();

  // Wait for review step
  await expect(page.getByText(/Review import/)).toBeVisible({
    timeout: 10000,
  });

  // Complete import
  await completeImport(page);

  // Verify a new tab was opened with the cURL data
  // Check for URL input which indicates HTTP tab is active
  const urlInput = page.getByTestId("url-input");
  await expect(urlInput).toBeVisible({ timeout: 5000 });

  // Verify URL contains the mock server and the cURL command was parsed
  const urlValue = await urlInput.inputValue();
  expect(urlValue).toContain(MOCK_BASE_URL);
  expect(urlValue).toContain("echo");
});
