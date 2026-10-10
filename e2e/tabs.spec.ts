import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  createCollection,
  saveRequestToCollection,
} from "./fixtures/qaHelpers";
import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TAB_NAME = "New Request";

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

function tabsLocator(page: Page): Locator {
  return getLayout(page).getByTestId("tab");
}

/** Open a new tab via the tab bar button, or Ctrl+T from the empty state. */
async function openTab(page: Page) {
  const before = await tabsLocator(page).count();
  const btn = getLayout(page).getByTestId("new-tab-btn").first();
  if (await btn.isVisible()) {
    await btn.click();
  } else {
    await page.keyboard.press("Control+t");
  }
  await expect(tabsLocator(page)).toHaveCount(before + 1);
}

/** Type into the URL bar so the active tab becomes dirty. */
async function makeActiveTabDirty(page: Page, url: string) {
  const urlInput = getLayout(page).getByTestId("url-input");
  await urlInput.fill(url);
  await expect(
    getLayout(page).locator(
      '[data-testid="tab"][data-active="true"] [data-testid="tab-dirty-indicator"]',
    ),
  ).toBeVisible();
}

function tabByName(page: Page, name: string): Locator {
  return tabsLocator(page).filter({ hasText: name });
}

function activeTab(page: Page): Locator {
  return getLayout(page).locator('[data-testid="tab"][data-active="true"]');
}

/** Rename a tab through its context menu. */
async function renameTab(tab: Locator, page: Page, newName: string) {
  await tab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const input = page.getByRole("textbox").last();
  await input.fill(newName);
  await input.press("Enter");
}

/** Open `count` tabs and rename them so each has a distinct name. */
async function openNamedTabs(page: Page, names: string[]) {
  for (const name of names) {
    await openTab(page);
    await renameTab(tabsLocator(page).last(), page, name);
    await expect(tabByName(page, name)).toHaveCount(1);
  }
}

async function tabNames(page: Page): Promise<string[]> {
  return (await tabsLocator(page).allInnerTexts()).map((t) => t.trim());
}

async function openDropdown(page: Page) {
  await getLayout(page).getByTestId("tabs-overflow-btn").click();
  const popover = page.getByTestId("tabs-popover-content");
  await expect(popover).toBeVisible();
  return popover;
}

/** Create a collection, then save `names` as requests (each leaves a saved tab open). */
async function seedSavedRequestTabs(page: Page, names: string[]) {
  await createCollection(page, "Tabs Collection");
  await expect(page.getByText("Tabs Collection").first()).toBeVisible();
  for (const name of names) {
    await openTab(page);
    await saveRequestToCollection(
      page,
      name,
      `${MOCK_BASE_URL}/get?testId=tabs-${name}`,
    );
    await expect(tabByName(page, name)).toHaveCount(1);
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Tab Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
  });

  test("open a new tab", async ({ page }) => {
    await openTab(page);
    const tab = tabByName(page, DEFAULT_TAB_NAME);
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("data-active", "true");
  });

  test("switch between tabs", async ({ page }) => {
    await openTab(page);
    await openTab(page);
    await makeActiveTabDirty(page, "https://tab2.example.com");

    await tabsLocator(page).first().click();

    await expect(tabsLocator(page).first()).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(getLayout(page).getByTestId("url-input")).toHaveValue("");
  });

  test("close a tab with no unsaved changes", async ({ page }) => {
    await openTab(page);
    await openTab(page);

    await tabsLocator(page)
      .last()
      .getByTestId("tab-close-btn")
      .click({ force: true });

    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(tabsLocator(page)).toHaveCount(1);
    await expect(tabsLocator(page).first()).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  test("close a dirty tab — discard changes", async ({ page }) => {
    await openTab(page);
    await makeActiveTabDirty(page, "https://example.com/dirty");

    await tabsLocator(page)
      .first()
      .getByTestId("tab-close-btn")
      .click({ force: true });

    const dialog = page.getByTestId("close-tab-dialog");
    await expect(
      dialog.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();
    await expect(dialog.getByRole("button")).toHaveText(["Cancel", "Close"]);

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(tabsLocator(page)).toHaveCount(0);
  });

  test("close a dirty tab — cancel keeps tab intact", async ({ page }) => {
    await openTab(page);
    await makeActiveTabDirty(page, "https://example.com/dirty");

    await tabsLocator(page)
      .first()
      .getByTestId("tab-close-btn")
      .click({ force: true });
    const dialog = page.getByTestId("close-tab-dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(tabsLocator(page)).toHaveCount(1);
    await expect(
      tabsLocator(page).first().getByTestId("tab-dirty-indicator"),
    ).toBeVisible();
    await expect(getLayout(page).getByTestId("url-input")).toHaveValue(
      "https://example.com/dirty",
    );
  });

  test("close other tabs via context menu", async ({ page }) => {
    await openNamedTabs(page, ["One", "Two", "Three"]);

    await tabByName(page, "Two").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close Other Tabs" }).click();

    await expect(tabsLocator(page)).toHaveCount(1);
    await expect(tabByName(page, "Two")).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  test("close all tabs via context menu", async ({ page }) => {
    await openTab(page);
    await openTab(page);

    await tabsLocator(page).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Close All Tabs" }).click();

    await expect(tabsLocator(page)).toHaveCount(0);
  });

  test("dirty indicator appears on modified tab", async ({ page }) => {
    await openTab(page);
    const dot = tabsLocator(page).first().getByTestId("tab-dirty-indicator");
    await expect(dot).toHaveCount(0);

    await makeActiveTabDirty(page, "https://example.com/dirty");
    await expect(dot).toBeVisible();
  });

  test("view all tabs via overflow dropdown", async ({ page }) => {
    for (let i = 0; i < 5; i++) await openTab(page);

    const popover = await openDropdown(page);
    await expect(popover.getByText("Opened tabs · 5")).toBeVisible();
    await expect(popover.getByTestId("tab-list-item")).toHaveCount(5);

    await popover.getByTestId("tab-list-item").first().click();
    await expect(tabsLocator(page).first()).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  test("search tabs in overflow dropdown", async ({ page }) => {
    await openNamedTabs(page, ["Alpha", "Beta", "Gamma"]);

    const popover = await openDropdown(page);
    await popover.getByTestId("tabs-search-input").fill("Beta");
    await expect(popover.getByTestId("tab-list-item")).toHaveCount(1);
    await expect(popover.getByTestId("tab-list-item")).toContainText("Beta");
  });

  test("E-TAB-01: Select a tab from the overflow dropdown", async ({
    page,
  }) => {
    await openNamedTabs(page, ["First", "Second", "Third"]);
    await tabByName(page, "First").click();
    await expect(tabByName(page, "First")).toHaveAttribute(
      "data-active",
      "true",
    );

    const popover = await openDropdown(page);
    await popover
      .getByTestId("tab-list-item")
      .filter({ hasText: "Third" })
      .click();

    await expect(popover).not.toBeVisible();
    await expect(tabByName(page, "Third")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(activeTab(page)).toHaveCount(1);
  });

  test("E-TAB-02: Close all from the dropdown with a dirty tab shows a bulk dialog", async ({
    page,
  }) => {
    await openNamedTabs(page, ["Clean", "Dirty"]);
    await makeActiveTabDirty(page, "https://example.com/dirty");

    const closeAllFromDropdown = async () => {
      const popover = await openDropdown(page);
      await popover.getByRole("button", { name: "Close all" }).click();
      await expect(popover).not.toBeVisible();
    };

    const dialog = page.getByTestId("bulk-close-dialog");
    await closeAllFromDropdown();
    await expect(dialog).toContainText("1 tab has unsaved changes. Close anyway?");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(tabsLocator(page)).toHaveCount(2);

    await closeAllFromDropdown();
    await dialog.getByRole("button", { name: "Close All" }).click();
    await expect(tabsLocator(page)).toHaveCount(0);
  });

  test("E-TAB-03: Dropdown search is case-insensitive partial match", async ({
    page,
  }) => {
    await openNamedTabs(page, ["Alpha users", "Beta orders", "Gamma users"]);

    const popover = await openDropdown(page);
    const search = popover.getByTestId("tabs-search-input");
    const rows = popover.getByTestId("tab-list-item");

    await search.fill("users");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Alpha users");
    await expect(rows.nth(1)).toContainText("Gamma users");

    await search.fill("BETA");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Beta orders");

    await search.fill("zzz-no-match");
    await expect(popover.getByText("No tabs found")).toBeVisible();
  });

  test("E-TAB-04: Close Other Tabs with a dirty tab shows a bulk dialog", async ({
    page,
  }) => {
    await openNamedTabs(page, ["Dirty one", "Other one"]);
    await tabByName(page, "Dirty one").click();
    await makeActiveTabDirty(page, "https://example.com/dirty");

    const dialog = page.getByTestId("bulk-close-dialog");
    const closeOthers = async () => {
      await tabByName(page, "Other one").click({ button: "right" });
      await page.getByRole("menuitem", { name: "Close Other Tabs" }).click();
    };

    await closeOthers();
    await expect(dialog.getByRole("button")).toHaveText(["Cancel", "Close All"]);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(tabsLocator(page)).toHaveCount(2);
    await expect(
      tabByName(page, "Dirty one").getByTestId("tab-dirty-indicator"),
    ).toBeVisible();

    await closeOthers();
    await dialog.getByRole("button", { name: "Close All" }).click();
    await expect(tabsLocator(page)).toHaveCount(1);
    await expect(tabByName(page, "Other one")).toBeVisible();
  });

  test("E-TAB-05: Reload restores open tabs", async ({ page }) => {
    // APP BUG: useTabsStore only persists tabs on open/close/reorder/label, so
    // the last saved tab is restored as "New Request" (its save never
    // persists), and hydrate() uses getAll() keyed by tabId so the order is
    // not guaranteed to match the open order.
    test.fail();
    const names = ["Req A", "Req B", "Req C"];
    await seedSavedRequestTabs(page, names);
    await expect(tabByName(page, "Req C")).toHaveAttribute(
      "data-active",
      "true",
    );
    await makeActiveTabDirty(page, `${MOCK_BASE_URL}/get?testId=tabs-edited`);

    await page.reload();
    await expect(getLayout(page)).toBeVisible();

    await expect(tabsLocator(page)).toHaveCount(3);
    expect(await tabNames(page)).toEqual(names);
    await expect(tabsLocator(page).first()).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(
      getLayout(page).getByTestId("tab-dirty-indicator"),
    ).toHaveCount(0);
  });

  test("E-TAB-06: Ctrl+W on a dirty tab shows the unsaved dialog", async ({
    page,
  }) => {
    await openTab(page);
    await makeActiveTabDirty(page, "https://example.com/dirty");

    // Shortcuts are ignored while an input is focused
    await getLayout(page).getByTestId("url-input").blur();
    await page.keyboard.press("Control+w");

    const dialog = page.getByTestId("close-tab-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(tabsLocator(page)).toHaveCount(0);
  });

  test("E-TAB-07: Opening the same saved request twice reuses its tab", async ({
    page,
  }) => {
    await seedSavedRequestTabs(page, ["Reuse me"]);
    await openTab(page);
    await expect(tabByName(page, "Reuse me")).toHaveAttribute(
      "data-active",
      "false",
    );

    // The collection starts collapsed; expand it to reach the request row
    await page.getByText("Tabs Collection").first().click();
    await page
      .getByTestId("request-item")
      .filter({ hasText: "Reuse me" })
      .click();

    await expect(tabByName(page, "Reuse me")).toHaveCount(1);
    await expect(tabByName(page, "Reuse me")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(tabsLocator(page)).toHaveCount(2);
  });

  test("E-TAB-08: Ctrl+[ and Ctrl+] move between tabs", async ({ page }) => {
    await openNamedTabs(page, ["T1", "T2", "T3"]);
    await tabByName(page, "T2").click();
    await expect(tabByName(page, "T2")).toHaveAttribute("data-active", "true");

    await page.keyboard.press("Control+]");
    await expect(tabByName(page, "T3")).toHaveAttribute("data-active", "true");

    await page.keyboard.press("Control+[");
    await expect(tabByName(page, "T2")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("Control+[");
    await expect(tabByName(page, "T1")).toHaveAttribute("data-active", "true");
    await page.keyboard.press("Control+[");
    await expect(tabByName(page, "T1")).toHaveAttribute("data-active", "true");
  });

  test("E-TAB-09: Reorder tabs by drag and drop", async ({ page }) => {
    await openNamedTabs(page, ["Tab A", "Tab B", "Tab C"]);
    expect(await tabNames(page)).toEqual(["Tab A", "Tab B", "Tab C"]);

    await tabByName(page, "Tab A").dragTo(tabByName(page, "Tab C"));

    await expect
      .poll(async () => (await tabNames(page))[0])
      .not.toBe("Tab A");
    expect((await tabNames(page)).sort()).toEqual(["Tab A", "Tab B", "Tab C"]);
  });

  test("E-TAB-10: Dropdown shows dirty dot and guards close", async ({
    page,
  }) => {
    await openNamedTabs(page, ["Clean tab", "Dirty tab"]);
    await makeActiveTabDirty(page, "https://example.com/dirty");

    const popover = await openDropdown(page);
    const row = popover
      .getByTestId("tab-list-item")
      .filter({ hasText: "Dirty tab" });
    await expect(row.getByTestId("tab-list-dirty-dot")).toBeVisible();

    await row.hover();
    await row.getByRole("button", { name: "Close Dirty tab" }).click();

    const dialog = page.getByTestId("close-tab-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();

    await expect(tabByName(page, "Dirty tab")).toHaveCount(0);
    await expect(tabByName(page, "Clean tab")).toHaveCount(1);
  });

  test("E-TAB-11: Closing the last tab empties the bar", async ({ page }) => {
    await openTab(page);
    await tabsLocator(page)
      .first()
      .getByTestId("tab-close-btn")
      .click({ force: true });

    await expect(tabsLocator(page)).toHaveCount(0);
    await expect(
      getLayout(page).getByTestId("tabs-overflow-btn"),
    ).toHaveCount(0);
    await expect(getLayout(page).getByTestId("new-tab-btn").first()).toBeVisible();
  });

  test("E-TAB-12: Rename, duplicate and label a tab from the context menu", async ({
    page,
  }) => {
    await openTab(page);
    await renameTab(tabsLocator(page).first(), page, "Renamed tab");
    await expect(tabByName(page, "Renamed tab")).toHaveCount(1);

    await tabByName(page, "Renamed tab").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Duplicate Tab" }).click();
    await expect(tabsLocator(page)).toHaveCount(2);

    await tabsLocator(page).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Set Label" }).click();
    const dialog = page.getByRole("dialog", { name: "Set Label" });
    await dialog.getByRole("button", { name: "Red" }).click();
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).not.toBeVisible();

    const dot = tabsLocator(page).first().getByTestId("tab-color-dot");
    await expect(dot).toBeVisible();
    await expect(dot).toHaveCSS("background-color", "rgb(239, 68, 68)");
  });
});
