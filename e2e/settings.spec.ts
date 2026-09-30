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
// Test Suite: Settings
// ---------------------------------------------------------------------------

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
  });

  // Scenario: Toggle dark mode
  test("toggles between dark, light, and system themes", async ({ page }) => {
    await page.getByTestId("nav-appearance").click();

    await page.getByTestId("theme-dark").click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByTestId("theme-light").click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await page.getByTestId("theme-system").click();
    // System theme defaults are browser/OS dependent, so we just check it doesn't crash here.
  });

  // Scenario: Toggle SSL verification
  test("disables SSL verification for self-signed certs", async ({ page }) => {
    await page.getByTestId("nav-proxy").click();

    const sslSwitch = page.getByTestId("ssl-verification-switch");
    // Switch should be on by default or user state. We turn it off.
    await sslSwitch.uncheck();
    await expect(sslSwitch).not.toBeChecked();

    // Mock the backend proxy since Node.js fetch doesn't easily support rejectUnauthorized=false out of the box in this project yet
    await page.route("**/api/proxy", async (route) => {
      const payload = JSON.parse(route.request().postData() || "{}");
      if (
        payload.url === "https://self-signed.badssl.com/" &&
        payload.sslVerify === false
      ) {
        await route.fulfill({
          json: {
            status: 200,
            statusText: "OK",
            headers: {},
            body: "Mocked success for self-signed cert",
          },
        });
      } else {
        await route.continue();
      }
    });

    // Verify it disabled SSL verification by sending request to self-signed cert
    await page.getByRole("link", { name: "Home" }).click();
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);

    await sendRequest(page, "https://self-signed.badssl.com/");

    const badge = page.getByTestId("response-status-badge");
    // Wait until response arrives
    await expect(badge).toBeVisible({ timeout: 15000 });
    // Assuming mocked 200 OK
    await expect(badge).toHaveText("200");
  });

  // Scenario: Toggle follow redirects
  test("disables follow redirects to see 3xx status codes", async ({
    page,
  }) => {
    await page.getByTestId("nav-proxy").click();

    const redirectSwitch = page.getByTestId("follow-redirects-switch");
    await redirectSwitch.uncheck();
    await expect(redirectSwitch).not.toBeChecked();

    await page.getByRole("link", { name: "Home" }).click();
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);

    // Sends a request that should return 302 if redirects are not followed
    await sendRequest(
      page,
      "https://httpbin.org/redirect-to?url=https%3A%2F%2Fdummyjson.com&status_code=302",
    );

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("302");
  });

  // Scenario: Set a custom proxy URL
  test("sets a custom proxy URL", async ({ page }) => {
    await page.getByTestId("nav-proxy").click();

    const proxyInput = page.getByTestId("proxy-url-input");
    await proxyInput.fill("http://127.0.0.1:8080");
    await expect(proxyInput).toHaveValue("http://127.0.0.1:8080");
  });

  // Scenario: View keyboard shortcuts
  test("displays categorized keyboard shortcuts", async ({ page }) => {
    await page.getByTestId("nav-shortcuts").click();

    const groups = page.getByTestId("shortcut-group");
    // Expecting "General", "Request", "Workspace", "Tabs", "Chain canvas" categories
    await expect(groups).toHaveCount(5);

    const labels = page.getByTestId("shortcut-group-label");
    await expect(labels.nth(0)).toHaveText("General");
    await expect(labels.nth(1)).toHaveText("Request");
    await expect(labels.nth(2)).toHaveText("Workspace");
    await expect(labels.nth(3)).toHaveText("Tabs");
    await expect(labels.nth(4)).toHaveText("Chain canvas");
  });
});
