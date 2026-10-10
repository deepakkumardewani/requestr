import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  MOCK_BASE_URL,
  MOCK_WS_URL,
} from "./support/mock-server/mockBaseUrl";

type LoggedRequest = { kind: string; event?: string };

/** Per-test WS URL; the unique id scopes mock-server request log entries. */
function wsUrlFor(testId: string): string {
  return `${MOCK_WS_URL}?testId=${testId}`;
}

async function fetchWsEvents(page: Page, testId: string): Promise<string[]> {
  const res = await page.request.get(
    `${MOCK_BASE_URL}/__requests?testId=${testId}`,
  );
  const body = (await res.json()) as { requests: LoggedRequest[] };
  return body.requests
    .filter((r) => r.kind === "ws")
    .map((r) => r.event ?? "");
}

function uniqueTestId(title: string): string {
  return `ws-${title}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  let testId = "";
  let wsUrl = "";

  test.beforeEach(async ({ page }, testInfo) => {
    testId = uniqueTestId(String(testInfo.workerIndex));
    wsUrl = wsUrlFor(testId);
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
    await layout.getByTestId("url-input").fill(wsUrl);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();
  });

  test("send shows sent entry; echo shows received", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(wsUrl);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();

    await layout.getByTestId("ws-message-input").fill("hello");
    await layout.getByTestId("ws-send-btn").click();

    const log = layout.getByTestId("message-log");
    await expect(log.getByText("sent", { exact: true })).toBeVisible();
    await expect(
      log.locator("pre").filter({ hasText: "hello" }).first(),
    ).toBeVisible();

    // Welcome frame is also "received"; target the echo row by stable test ids + body text.
    await expect(
      log
        .locator('[data-testid="ws-log-entry"][data-direction="received"]')
        .filter({ hasText: "hello" })
        .first(),
    ).toBeVisible();
    await expect(
      log.locator("pre").filter({ hasText: "hello" }).nth(1),
    ).toBeVisible();
  });

  test("disconnect returns to Connect", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(wsUrl);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();

    await layout.getByTestId("disconnect-btn").click();
    await expect(layout.getByTestId("connect-btn")).toBeVisible();
  });

  // App bug (src/stores/useConnectionStore.ts:111): connect() passes the raw
  // URL to `new WebSocket(url)`; "not a url" resolves to a relative http URL, so
  // neither the constructor throws (catch at :112) nor onerror/onclose (:131/:135)
  // fire, and isConnecting stays true ("Connecting…" forever).
  test.fail("E-RT-03: invalid URL does not stay Connecting and opens no socket", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill("not a url");
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();

    const connectBtn = layout.getByTestId("connect-btn");
    await expect(connectBtn).toBeEnabled();
    await expect(connectBtn).not.toContainText("Connecting");
    await expect(layout.getByTestId("disconnect-btn")).toHaveCount(0);
    expect(await fetchWsEvents(page, testId)).toEqual([]);
  });

  // App bug: useConnectionStore.setError (src/stores/useConnectionStore.ts:83,
  // called from :113 and :132) stores conn.error, but no WebSocket UI component
  // under src/components reads/renders it, so the user never sees an error.
  test.fail("E-RT-03: invalid URL shows an error to the user", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill("not a url");
    await page.keyboard.press("Escape");
    await layout.getByTestId("connect-btn").click();

    await expect(
      layout.getByText(/invalid|failed|error/i).first(),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("E-RT-04a: closing a connected WebSocket tab makes the server see a close", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(wsUrl);
    await page.keyboard.press("Escape");
    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();
    await expect
      .poll(() => fetchWsEvents(page, testId))
      .toContain("connect");

    await page.getByTestId("tab-close-btn").first().click();
    // Typing a URL marks the tab dirty, so closing asks for confirmation.
    const closeDialog = page.getByTestId("close-tab-dialog");
    await closeDialog.getByRole("button", { name: "Close" }).click();
    await expect(closeDialog).toBeHidden();

    await expect.poll(() => fetchWsEvents(page, testId)).toContain("close");
  });

  test("E-RT-10: clearing the message log empties it", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(wsUrl);
    await page.keyboard.press("Escape");
    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();

    const log = layout.getByTestId("message-log");
    await layout.getByTestId("ws-message-input").fill("before-clear");
    await layout.getByTestId("ws-send-btn").click();
    await expect(
      log.locator('[data-testid="ws-log-entry"][data-direction="received"]'),
    ).toHaveCount(1);

    await layout.getByTestId("message-log-clear-btn").click();
    await expect(log.getByTestId("ws-log-entry")).toHaveCount(0);
    await expect(log.getByText("No messages yet")).toBeVisible();

    await layout.getByTestId("ws-message-input").fill("after-clear");
    await layout.getByTestId("ws-send-btn").click();
    await expect(
      log
        .locator('[data-testid="ws-log-entry"][data-direction="sent"]')
        .filter({ hasText: "after-clear" }),
    ).toHaveCount(1);
  });
});
