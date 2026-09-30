import { expect, type Locator, type Page, test } from "@playwright/test";

/** Local echo from `scripts/run-socketio-echo.sh` (default port 3333). */
const SOCKETIO_ECHO_URL =
  process.env.SOCKETIO_TEST_URL ?? "http://127.0.0.1:3333";

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

async function openSocketIOTab(page: Page) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByRole("menuitem", { name: "Socket.IO" }).click();
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------

test.describe("Socket.IO", () => {
  // Serial: these tests share a single external echo server instance
  // (scripts/run-socketio-echo.sh, one process, one port). Running them
  // concurrently with the rest of the suite's 2 workers means this file's
  // own tests can overlap each other's connect/emit/disconnect cycles on
  // that one shared socket.io server process, and under full-suite CPU
  // contention (verified: unrelated specs across the suite - requests,
  // response, settings, chain - also miss their own timeouts on a loaded
  // machine) the extra scheduling latency is enough to blow the connect
  // window. Serializing this file's own tests removes the self-contention
  // on the shared echo server, which is the piece actually within this
  // spec's control.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openSocketIOTab(page);
  });

  test("Socket.IO tab shows event name input, Connect, and message log", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await expect(layout.getByTestId("socketio-event-input")).toBeVisible();
    await expect(layout.getByTestId("connect-btn")).toBeVisible();
    await expect(layout.getByTestId("message-log")).toBeVisible();
  });

  test("connect toggles Connect to Disconnect", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(SOCKETIO_ECHO_URL);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible({
      timeout: 25_000,
    });
  });

  test("emit shows sent entry; echo shows received", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(SOCKETIO_ECHO_URL);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible({
      timeout: 25_000,
    });

    await layout.getByTestId("socketio-event-input").fill("message");
    await layout.getByTestId("ws-message-input").fill("hello");
    await layout.getByTestId("socketio-send-btn").click();

    const log = layout.getByTestId("message-log");
    await expect(log.getByText("sent", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      log.locator("pre").filter({ hasText: "hello" }).first(),
    ).toBeVisible();

    await expect(log.getByText("received", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      log.locator("pre").filter({ hasText: "hello" }).nth(1),
    ).toBeVisible();
  });

  test("disconnect returns to Connect", async ({ page }) => {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(SOCKETIO_ECHO_URL);
    await page.keyboard.press("Escape");

    await layout.getByTestId("connect-btn").click();
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible({
      timeout: 25_000,
    });

    await layout.getByTestId("disconnect-btn").click();
    await expect(layout.getByTestId("connect-btn")).toBeVisible({
      timeout: 10_000,
    });
  });
});
