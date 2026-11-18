import { expect, type Locator, type Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function clearEnvironmentsDB(page: Page) {
  await page.addInitScript(async () => {
    // Clear IndexedDB
    const req = indexedDB.open("requestly");
    req.onsuccess = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("environments")) {
        const tx = db.transaction("environments", "readwrite");
        tx.objectStore("environments").clear();
      }
    };
    // Clear localStorage
    localStorage.removeItem("requestly_active_env_id");
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

async function openEnvManager(page: Page) {
  const layout = getLayout(page);
  await layout.getByTestId("env-selector-trigger").click();
  await page.getByTestId("env-selector-manage-btn").click();
  await expect(page.getByTestId("env-manager-dialog")).toBeVisible();
}

async function createEnvironment(page: Page, name: string) {
  await page.getByTestId("add-env-btn").click();
  // It enters rename mode automatically
  const input = page.getByTestId("env-item-rename-input");
  await input.fill(name);
  await page.keyboard.press("Enter");
}

async function fillUrl(page: Page, url: string) {
  const layout = getLayout(page);
  const urlInput = layout.getByTestId("url-input");
  await urlInput.fill(url);
  await page.keyboard.press("Escape");
}

function getVarRow(page: Page, key: string): Locator {
  return page.getByTestId("var-row").filter({
    has: page
      .getByTestId("var-key-input")
      .and(page.locator(`input[value="${key}"]`)),
  });
}

// ---------------------------------------------------------------------------
// Test Suite: Environments
// ---------------------------------------------------------------------------

test.describe("Environments", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await clearEnvironmentsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    // Wait for the URL input to be visible to ensure the layout is ready
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
  });

  test("Create a new environment", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "Staging");

    // Verify it appears in the list
    await expect(page.getByTestId("env-list-item-Staging")).toBeVisible();
    // Verify it's active in the header
    await expect(page.getByTestId("env-name-display")).toHaveText("Staging");
  });

  test("Add and edit environment variables", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "Development");

    // Add first variable
    await page.getByTestId("add-variable-btn").click();
    const rows = page.getByTestId("var-row");
    await expect(rows).toHaveCount(1);
    let lastRow = rows.last();
    await lastRow.getByTestId("var-key-input").fill("baseUrl");
    await lastRow
      .getByTestId("var-initial-value-input")
      .fill("https://api.dev.com");
    await page.keyboard.press("Enter");

    // Add second variable
    await page.getByTestId("add-variable-btn").click();
    await expect(rows).toHaveCount(2);
    lastRow = rows.last();
    await lastRow.getByTestId("var-key-input").fill("apiKey");
    await lastRow.getByTestId("var-initial-value-input").fill("secret-123");
    await page.keyboard.press("Enter");

    // Verify variables are saved
    await expect(getVarRow(page, "baseUrl")).toBeVisible();
    await expect(getVarRow(page, "apiKey")).toBeVisible();

    // Edit a value
    const baseUrlRow = getVarRow(page, "baseUrl");
    await baseUrlRow
      .getByTestId("var-current-value-input")
      .fill("https://api.local.com");
    await page.keyboard.press("Enter");
    await expect(baseUrlRow.getByTestId("var-current-value-input")).toHaveValue(
      "https://api.local.com",
    );
  });

  test("Delete an environment variable", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "CleanupTest");

    await page.getByTestId("add-variable-btn").click();
    const row = page.getByTestId("var-row").last();
    await row.getByTestId("var-key-input").fill("toDelete");
    await page.keyboard.press("Enter");

    await expect(getVarRow(page, "toDelete")).toBeVisible();

    await getVarRow(page, "toDelete").getByTestId("var-delete-btn").click();
    await expect(getVarRow(page, "toDelete")).not.toBeVisible();
  });

  test("Mark a variable as secret", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "SecurityTest");

    await page.getByTestId("add-variable-btn").click();
    const row = page.getByTestId("var-row").last();
    await row.getByTestId("var-key-input").fill("password");
    await row.getByTestId("var-initial-value-input").fill("super-secret");
    await page.keyboard.press("Enter");

    const passwordRow = getVarRow(page, "password");
    await passwordRow.getByTestId("var-secret-checkbox").check();

    // Verify value is masked (input type="password")
    await expect(
      passwordRow.getByTestId("var-initial-value-input"),
    ).toHaveAttribute("type", "password");

    // Toggle visibility
    await passwordRow.getByTestId("var-secret-toggle").click();
    await expect(
      passwordRow.getByTestId("var-initial-value-input"),
    ).toHaveAttribute("type", "text");
  });

  test("Switch the active environment", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "Dev");
    await createEnvironment(page, "Prod");
    await page.keyboard.press("Escape"); // Close manager

    const layout = getLayout(page);
    await layout.getByTestId("env-selector-trigger").click();

    // Select Dev
    const devItem = page.getByTestId("env-selector-item-Dev");
    await expect(devItem).toBeVisible();
    await devItem.click();
    await expect(layout.getByTestId("env-selector-trigger")).toContainText(
      "Dev",
    );

    // Wait for dropdown to fully close and state to settle
    await page.waitForTimeout(500);

    // The nested DropdownMenuSub inside each item causes hover-triggered re-renders
    // that repeatedly detach items. Use toPass to retry opening + clicking until it sticks.
    await expect(async () => {
      // Close any open dropdown first, then reopen
      await page.keyboard.press("Escape");
      await layout.getByTestId("env-selector-trigger").click();
      await expect(page.getByTestId("env-selector-item-Prod")).toBeVisible({
        timeout: 3000,
      });
      await page.getByTestId("env-selector-item-Prod").click();
      await expect(layout.getByTestId("env-selector-trigger")).toContainText(
        "Prod",
      );
    }).toPass({ timeout: 15000 });
  });

  test("Use an environment variable in a URL", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "URLTest");

    await page.getByTestId("add-variable-btn").click();
    const row = page.getByTestId("var-row").last();
    await row.getByTestId("var-key-input").fill("host");
    await row.getByTestId("var-initial-value-input").fill("dummyjson.com");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");

    await fillUrl(page, "https://{{host}}/products/1");

    const layout = getLayout(page);
    await layout.getByTestId("send-request-btn").click();

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
    await expect(page.getByTestId("response-pretty-viewer")).toContainText(
      '"Essence Mascara Lash Princess"',
    );
  });

  test("Rename an environment", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "OldName");

    // Click on name to edit
    await page.getByTestId("env-name-display").click();
    const input = page.getByTestId("env-name-input");
    await input.fill("NewName");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("env-name-display")).toHaveText("NewName");
    await expect(page.getByTestId("env-list-item-NewName")).toBeVisible();
  });

  test("Delete an environment", async ({ page }) => {
    await openEnvManager(page);
    await createEnvironment(page, "ToKill");

    const item = page.getByTestId("env-list-item-ToKill");
    await item.hover();
    await item.getByTestId("env-item-more-btn").click();
    await page.getByTestId("env-item-delete-btn").click();

    // Confirm dialog
    await page
      .getByRole("button", { name: /yes, delete environment/i })
      .click();

    await expect(page.getByTestId("env-list-item-ToKill")).not.toBeVisible();
  });
});
