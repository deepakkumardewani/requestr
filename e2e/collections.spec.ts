import { expect, type Locator, type Page, test } from "@playwright/test";

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
    };
  });
}

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

/** Ensures the Collections tab in the left sidebar is active. */
async function openCollectionsSidebar(page: Page) {
  await page.getByTestId("sidebar-tab-collections").click();
}

/** Opens the Create-New dropdown and clicks "Collection". */
async function clickCreateNewCollection(page: Page) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByTestId("create-collection-item").click();
}

/**
 * Creates a collection via the Create-New dropdown + inline name input.
 * Returns the collection name used.
 */
async function createCollection(page: Page, name: string) {
  await clickCreateNewCollection(page);
  const input = page.getByTestId("new-collection-name-input");
  await expect(input).toBeVisible({ timeout: 5000 });
  await input.fill(name);
  await page.keyboard.press("Enter");
}

/**
 * Expands the first collection accordion item in the CollectionTree.
 * The inner accordion items start collapsed, so requests are hidden until expanded.
 */
async function expandFirstCollection(page: Page) {
  const collectionItem = page
    .locator('[data-testid^="collection-item-"]')
    .first();
  await expect(collectionItem).toBeVisible({ timeout: 5000 });
  const testId = (await collectionItem.getAttribute("data-testid")) ?? "";
  const collectionId = testId.replace("collection-item-", "");
  // Click the collection name to toggle open (it starts closed after creation)
  await page.getByTestId(`collection-name-${collectionId}`).click();
}

/**
 * Hovers a collection row and opens its more-menu (⋯ button).
 * Returns the collection accordion-item locator so callers can filter.
 */
async function _openCollectionMenu(
  page: Page,
  collectionTestId: string,
): Promise<Locator> {
  const item = page.getByTestId(collectionTestId);
  await item.hover();
  await item
    .getByTestId(
      `collection-more-btn-${collectionTestId.replace("collection-item-", "")}`,
    )
    .click();
  return item;
}

/** Saves the active tab via the Save button. */
async function clickSaveButton(page: Page) {
  const layout = getLayout(page);
  await layout.getByTestId("save-request-btn").click();
}

// ---------------------------------------------------------------------------
// Test Suite: Collections
// ---------------------------------------------------------------------------

test.describe("Collections", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await clearCollectionsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    // Collections tab is default; ensure it's visible
    await openCollectionsSidebar(page);
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Create a new collection
  // -------------------------------------------------------------------------
  test("Create a new collection", async ({ page }) => {
    await clickCreateNewCollection(page);

    const input = page.getByTestId("new-collection-name-input");
    await expect(input).toBeVisible({ timeout: 5000 });

    await input.fill("My Collection");
    await page.keyboard.press("Enter");

    // The sidebar should now show the new collection name
    await expect(page.getByText("My Collection")).toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Rename a collection
  // -------------------------------------------------------------------------
  test("Rename a collection", async ({ page }) => {
    await createCollection(page, "My API");
    await expect(page.getByText("My API")).toBeVisible({ timeout: 5000 });

    // Locate the collection item — we need its id, so we read it from the DOM
    const collectionItem = page
      .locator('[data-testid^="collection-item-"]')
      .first();
    const testId = (await collectionItem.getAttribute("data-testid")) ?? "";

    await collectionItem.hover();
    const collectionId = testId.replace("collection-item-", "");
    await collectionItem
      .getByTestId(`collection-more-btn-${collectionId}`)
      .click();
    await page.getByTestId("collection-rename-btn").click();

    const renameInput = page.getByTestId("collection-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });
    await renameInput.clear();
    await renameInput.fill("Renamed API");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Renamed API")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("My API")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Delete a collection
  // -------------------------------------------------------------------------
  test("Delete a collection", async ({ page }) => {
    await createCollection(page, "To Delete");
    await expect(page.getByText("To Delete")).toBeVisible({ timeout: 5000 });

    const collectionItem = page
      .locator('[data-testid^="collection-item-"]')
      .first();
    const testId = (await collectionItem.getAttribute("data-testid")) ?? "";
    const collectionId = testId.replace("collection-item-", "");

    await collectionItem.hover();
    await collectionItem
      .getByTestId(`collection-more-btn-${collectionId}`)
      .click();
    await page.getByTestId("collection-delete-btn").click();

    // Confirmation dialog
    await expect(
      page.getByRole("button", { name: /yes, delete collection/i }),
    ).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: /yes, delete collection/i }).click();

    await expect(page.getByText("To Delete")).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Save a new request to an existing collection
  // -------------------------------------------------------------------------
  test("Save a new request to a collection", async ({ page }) => {
    // First create the collection so it's available in the modal
    await createCollection(page, "REST APIs");
    await expect(page.getByText("REST APIs")).toBeVisible({ timeout: 5000 });

    // Fill a URL so the tab has content
    const layout = getLayout(page);
    await layout
      .getByTestId("url-input")
      .fill("https://dummyjson.com/products/1");
    await page.keyboard.press("Escape");

    // Click Save → SaveRequestModal appears
    await clickSaveButton(page);
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });

    // Set request name
    await page.getByTestId("save-request-name-input").fill("Get Product");

    // The collection picker should show "REST APIs" — select it
    await expect(page.getByTestId("collection-picker")).toBeVisible();
    const pickerItems = page.locator(
      '[data-testid^="collection-picker-item-"]',
    );
    await pickerItems.first().click(); // selects "REST APIs"

    // Save
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    // Dirty indicator should be gone (tab is no longer dirty)
    await expect(
      page.locator('[data-testid="tab-dirty-indicator"]'),
    ).not.toBeVisible();

    // Expand the collection accordion so request items are visible
    await expandFirstCollection(page);

    // Request appears in the sidebar under the collection
    await expect(
      page.getByTestId("request-item").filter({ hasText: "Get Product" }),
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: Save a request to a NEW collection from the save modal
  // -------------------------------------------------------------------------
  test("Save a request to a new collection from the save modal", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill("https://dummyjson.com/users/1");
    await page.keyboard.press("Escape");

    // Click Save — no collections exist yet, so modal opens in create-new mode
    await clickSaveButton(page);
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });

    // Name the request
    await page.getByTestId("save-request-name-input").fill("Get User");

    // The modal starts in "new collection" mode when no collections exist
    const newColInput = page.getByTestId("save-new-collection-name-input");
    await expect(newColInput).toBeVisible();
    await newColInput.fill("User Service");

    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    // Collection name visible in sidebar (scoped to collection-name testid to avoid tab ambiguity)
    await expect(
      page
        .locator('[data-testid^="collection-name-"]')
        .filter({ hasText: "User Service" }),
    ).toBeVisible({ timeout: 5000 });

    // Expand the collection accordion so request items are visible
    await expandFirstCollection(page);

    // Request item visible in sidebar
    await expect(
      page.getByTestId("request-item").filter({ hasText: "Get User" }),
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: Open a saved request from the sidebar
  // -------------------------------------------------------------------------
  test("Open a saved request from the sidebar", async ({ page }) => {
    // Create a collection and save a request
    await createCollection(page, "Sidebar Open Test");
    await expect(page.getByText("Sidebar Open Test")).toBeVisible({
      timeout: 5000,
    });

    const layout = getLayout(page);
    const testUrl = "https://dummyjson.com/products/5";
    await layout.getByTestId("url-input").fill(testUrl);
    await page.keyboard.press("Escape");
    await clickSaveButton(page);
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("save-request-name-input").fill("Product 5");
    await page
      .locator('[data-testid^="collection-picker-item-"]')
      .first()
      .click();
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    // Expand the collection so request items become visible in sidebar
    await expandFirstCollection(page);

    // Close the current tab to remove the active request
    await page.keyboard.press("Control+W");
    // Accept close-tab dialog if present
    const closeDialog = page.getByTestId("close-tab-dialog");
    const hasDialog = await closeDialog
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (hasDialog) {
      await closeDialog.getByRole("button", { name: /close/i }).click();
    }

    // Open new blank tab so there's an active tab
    await openTab(page);

    // Click the saved request in the sidebar
    const requestItem = page
      .getByTestId("request-item")
      .filter({ hasText: "Product 5" });
    await requestItem.click();

    // The URL input in the active tab should be populated
    await expect(layout.getByTestId("url-input")).toHaveValue(testUrl, {
      timeout: 10000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Update a saved request (dirty indicator)
  // -------------------------------------------------------------------------
  test("Update a saved request shows dirty indicator and saves", async ({
    page,
  }) => {
    // Create and save a request
    await createCollection(page, "Update Test");
    const layout = getLayout(page);
    await layout
      .getByTestId("url-input")
      .fill("https://dummyjson.com/products/10");
    await page.keyboard.press("Escape");
    await clickSaveButton(page);
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("save-request-name-input").fill("Product 10");
    await page
      .locator('[data-testid^="collection-picker-item-"]')
      .first()
      .click();
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    // Modify URL — this should mark the tab dirty
    await layout
      .getByTestId("url-input")
      .fill("https://dummyjson.com/products/99");
    await page.keyboard.press("Escape");

    // Dirty indicator appears on the active tab
    await expect(page.getByTestId("tab-dirty-indicator")).toBeVisible({
      timeout: 3000,
    });

    // Blur the URL input — Ctrl+S is ignored while focus is in an editable
    // field (to avoid hijacking the browser's native save shortcut mid-typing).
    await layout.getByTestId("url-input").blur();

    // Save with Ctrl+S
    await page.keyboard.press("Control+s");

    // Dirty indicator should disappear after save
    await expect(page.getByTestId("tab-dirty-indicator")).not.toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario: Delete a request from a collection
  // -------------------------------------------------------------------------
  test("Delete a request from a collection", async ({ page }) => {
    // Create collection + save a request
    await createCollection(page, "Delete Request Test");
    const layout = getLayout(page);
    await layout
      .getByTestId("url-input")
      .fill("https://dummyjson.com/products/2");
    await page.keyboard.press("Escape");
    await clickSaveButton(page);
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("save-request-name-input").fill("Product 2");
    await page
      .locator('[data-testid^="collection-picker-item-"]')
      .first()
      .click();
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    // Expand the collection so request items become visible
    await expandFirstCollection(page);

    // Hover the request item and open its more menu
    const requestItem = page
      .getByTestId("request-item")
      .filter({ hasText: "Product 2" });
    await expect(requestItem).toBeVisible({ timeout: 5000 });
    await requestItem.hover();
    await requestItem.getByTestId("request-item-more-btn").click();
    await page.getByTestId("request-delete-btn").click();

    // Confirm deletion
    await expect(
      page.getByRole("button", { name: /yes, delete/i }),
    ).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: /yes, delete/i }).click();

    // Request should no longer appear in sidebar
    await expect(
      page.getByTestId("request-item").filter({ hasText: "Product 2" }),
    ).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Collection collapse and expand
  // -------------------------------------------------------------------------
  test("Collection collapses and expands", async ({ page }) => {
    // Create a collection and save a request so there's content to hide/show
    await createCollection(page, "Collapsible");
    const layout = getLayout(page);
    await layout
      .getByTestId("url-input")
      .fill("https://dummyjson.com/products/3");
    await page.keyboard.press("Escape");
    await clickSaveButton(page);
    await expect(page.getByTestId("save-request-modal")).toBeVisible({
      timeout: 5000,
    });
    await page.getByTestId("save-request-name-input").fill("Product 3");
    await page
      .locator('[data-testid^="collection-picker-item-"]')
      .first()
      .click();
    await page.getByTestId("save-modal-save-btn").click();
    await expect(page.getByTestId("save-request-modal")).not.toBeVisible();

    // Expand the collection so request items become visible
    await expandFirstCollection(page);

    const requestItem = page
      .getByTestId("request-item")
      .filter({ hasText: "Product 3" });
    await expect(requestItem).toBeVisible({ timeout: 5000 });

    // Locate the collection accordion item
    const collectionItem = page
      .locator('[data-testid^="collection-item-"]')
      .first();
    const testId = (await collectionItem.getAttribute("data-testid")) ?? "";
    const collectionId = testId.replace("collection-item-", "");

    // Click the collection name span to collapse
    await page.getByTestId(`collection-name-${collectionId}`).click();
    await expect(requestItem).not.toBeVisible({ timeout: 3000 });

    // Click again to expand
    await page.getByTestId(`collection-name-${collectionId}`).click();
    await expect(requestItem).toBeVisible({ timeout: 3000 });
  });
});
