import { expect, type Locator, type Page, test } from "@playwright/test";

/** Public echo endpoint used in protocol-support E2E scenarios. */
const WS_ECHO_URL = "wss://echo.websocket.org";

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

function getLayout(page: Page): Locator {
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  return viewportWidth < 768
    ? page.locator('[data-testid="mobile-layout"]')
    : page.locator('[data-testid="desktop-layout"]');
}

async function openWebSocketTab(page: Page) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByRole("menuitem", { name: "WebSocket" }).click();
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

test.describe("WebSocket", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openWebSocketTab(page);
  });

  test("WebSocket tab shows Connect, message input, and message log", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await expect(layout.getByTestId("connect-btn")).toBeVisible();
    await expect(layout.getByTestId("ws-message-input")).toBeVisible();
    await expect(layout.getByTestId("message-log")).toBeVisible();
  });

  test("connect toggles Connect to Disconnect", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(WS_ECHO_URL);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("send shows sent entry; echo shows received", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(WS_ECHO_URL);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible({
      timeout: 20_000,
    });

    await layout.getByTestId("ws-message-input").fill("hello");
    await layout.getByTestId("ws-send-btn").click();

    const log = layout.getByTestId("message-log");
    await expect(log.getByText("sent", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      log.locator("pre").filter({ hasText: "hello" }).first(),
    ).toBeVisible();

    // Welcome frame is also "received"; target the echo row by stable test ids + body text.
    await expect(
      log
        .locator('[data-testid="ws-log-entry"][data-direction="received"]')
        .filter({ hasText: "hello" })
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      log.locator("pre").filter({ hasText: "hello" }).nth(1),
    ).toBeVisible();
  });

  test("disconnect returns to Connect", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(WS_ECHO_URL);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible({
      timeout: 20_000,
    });

    await layout.getByTestId("disconnect-btn").click();
    await expect(layout.getByTestId("connect-btn")).toBeVisible({
      timeout: 10_000,
    });
  });
});
