import { expect, type Locator, type Page, test } from "@playwright/test";

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

/**
 * Returns a locator scoped to the visible layout container.
 * At widths < 768px the mobile layout is shown; otherwise the desktop layout.
 */
function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

/**
 * Open a new tab. Works from empty state (Ctrl+T) or when the tab bar is
 * visible (clicks the "+ New Request" button).
 */
async function openTab(page: Page) {
  const layout = getLayout(page);
  const btn = layout.getByTestId("new-tab-btn");

  // Try to wait for the button to be visible; fall back to shortcut if not found
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

/** Type into the URL bar so the active tab becomes dirty. */
async function makeTabDirty(page: Page, url = "https://example.com/dirty") {
  const layout = getLayout(page);
  const urlInput = layout.getByTestId("url-input");
  await urlInput.click();
  await urlInput.fill(url);
}

/** Return the tab button(s) for a given tab name. */
function tabButton(page: Page, name: string) {
  return getLayout(page).getByTestId("tab").filter({ hasText: name });
}

/** Return the close (×) button(s) for tabs matching a name. */
function closeButton(page: Page, name: string) {
  return getLayout(page)
    .getByTestId("tab")
    .filter({ hasText: name })
    .getByTestId("tab-close-btn");
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Tab Management", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  test("open a new tab", async ({ page }) => {
    await openTab(page);

    // A tab labelled "New Request" should appear in the tab bar
    const tab = tabButton(page, "New Request");
    await expect(tab).toBeVisible();

    // The new tab should be active (carries the bottom accent bar child)
    await expect(tab.locator("span.bg-method-accent")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  test("switch between tabs", async ({ page }) => {
    await openTab(page); // tab 1 — active
    await openTab(page); // tab 2 — active

    // Make tab 2 dirty so we can distinguish it from tab 1 in the URL bar
    await makeTabDirty(page, "https://tab2.example.com");

    // Click on first tab — there are two "New Request" tabs; click the first one
    await tabButton(page, "New Request").first().click();

    // The URL bar should now be empty (tab 1 has no URL)
    const layout = getLayout(page);
    await expect(layout.getByTestId("url-input")).toHaveValue("");
  });

  // -------------------------------------------------------------------------
  test("close a tab with no unsaved changes", async ({ page }) => {
    await openTab(page); // tab 1
    await openTab(page); // tab 2 — active

    // force: true because the close button is opacity-0 until hover
    await closeButton(page, "New Request").last().click({ force: true });

    // Only one tab should remain, no confirmation dialog
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(tabButton(page, "New Request")).toHaveCount(1);
  });

  // -------------------------------------------------------------------------
  test("close a dirty tab — discard changes", async ({ page }) => {
    await openTab(page);
    await makeTabDirty(page);

    // Dirty indicator (orange dot) should be visible
    await expect(
      tabButton(page, "New Request").locator("span.bg-orange-400"),
    ).toBeVisible();

    // Click the close button
    await closeButton(page, "New Request").click({ force: true });

    // Confirmation dialog must appear
    const dialog = page.getByTestId("close-tab-dialog");
    await expect(
      dialog.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();

    // Confirm discard
    await dialog.getByRole("button", { name: "Close" }).click();

    // Tab is gone; no tabs remain
    await expect(dialog).not.toBeVisible();
    await expect(tabButton(page, "New Request")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  test("close a dirty tab — cancel keeps tab intact", async ({ page }) => {
    await openTab(page);
    await makeTabDirty(page);

    await closeButton(page, "New Request").click({ force: true });

    const dialog = page.getByTestId("close-tab-dialog");
    await expect(
      dialog.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();

    // Cancel — tab must remain
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(tabButton(page, "New Request")).toBeVisible();

    // Dirty dot still present
    await expect(
      tabButton(page, "New Request").locator("span.bg-orange-400"),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  test("close other tabs via context menu", async ({ page }) => {
    await openTab(page); // tab 1
    await openTab(page); // tab 2
    await openTab(page); // tab 3 — active; right-click this one

    await tabButton(page, "New Request").last().click({ button: "right" });

    // "Close Other Tabs" menu item
    await page.getByRole("menuitem", { name: "Close Other Tabs" }).click();

    // Only 1 tab should remain
    await expect(tabButton(page, "New Request")).toHaveCount(1);
  });

  // -------------------------------------------------------------------------
  test("close all tabs via context menu", async ({ page }) => {
    await openTab(page);
    await openTab(page);

    await tabButton(page, "New Request").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close All Tabs" }).click();

    // No tabs should be present
    await expect(tabButton(page, "New Request")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  test("dirty indicator appears on modified tab", async ({ page }) => {
    await openTab(page);

    // No dirty dot before any edit
    const dot = tabButton(page, "New Request").locator("span.bg-orange-400");
    await expect(dot).not.toBeVisible();

    await makeTabDirty(page);

    await expect(dot).toBeVisible();
  });

  // -------------------------------------------------------------------------
  test("view all tabs via overflow dropdown", async ({ page }) => {
    // // Open enough tabs to trigger overflow by resizing to a narrow viewport
    // await page.setViewportSize({ width: 500, height: 768 });
    await openTab(page);
    await openTab(page);
    await openTab(page);
    await openTab(page);
    await openTab(page);

    // The overflow chevron should appear
    const layout = getLayout(page);
    const chevron = layout.getByTestId("tabs-overflow-btn");
    await expect(chevron).toBeVisible();

    await chevron.click();

    // Dropdown popover listing all tabs
    const popover = page.getByTestId("tabs-popover-content");
    await expect(popover).toBeVisible();

    // All 5 tab entries should be listed
    await expect(
      popover.getByTestId("tab-list-item").filter({ hasText: "New Request" }),
    ).toHaveCount(5);
  });

  // -------------------------------------------------------------------------
  test("search tabs in overflow dropdown", async ({ page }) => {
    // await page.setViewportSize({ width: 500, height: 768 });

    // Open tabs with distinct names by duplicating and relying on default names
    await openTab(page);
    await openTab(page);
    await openTab(page);

    const layout = getLayout(page);
    const chevron = layout.getByTestId("tabs-overflow-btn");
    await expect(chevron).toBeVisible();
    await chevron.click();

    const searchInput = page.getByTestId("tabs-search-input");
    await expect(searchInput).toBeVisible();

    // Search for a keyword that matches all tabs ("New Request")
    await searchInput.fill("New Request");
    await expect(
      page.getByTestId("tab-list-item").filter({ hasText: "New Request" }),
    ).toHaveCount(3);

    // Search for something that matches nothing
    await searchInput.fill("zzz-no-match");
    await expect(page.getByText("No tabs found")).toBeVisible();
  });
});
