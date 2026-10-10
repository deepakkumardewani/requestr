import { expect, type Locator, type Page, test } from "@playwright/test";

import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

/** Nothing listens on port 1, so the connection is refused immediately. */
const UNREACHABLE_URL = "http://127.0.0.1:1";

type LoggedRequest = { kind: string; event?: string };

/** Per-test Socket.IO URL; the unique id scopes mock-server request log entries. */
function mockUrlFor(testId: string): string {
  return `${MOCK_BASE_URL}?testId=${testId}`;
}

async function fetchSocketIoEvents(
  page: Page,
  testId: string,
): Promise<string[]> {
  const res = await page.request.get(
    `${MOCK_BASE_URL}/__requests?testId=${testId}`,
  );
  const body = (await res.json()) as { requests: LoggedRequest[] };
  return body.requests
    .filter((r) => r.kind === "socketio")
    .map((r) => r.event ?? "");
}

function uniqueTestId(workerIndex: number): string {
  return `sio-${workerIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

// ---------------------------------------------------------------------------
// Socket.IO against the local mock server (isolated by ?testId=)
// ---------------------------------------------------------------------------

test.describe("Socket.IO (mock server)", () => {
  let testId = "";

  test.beforeEach(async ({ page }, testInfo) => {
    testId = uniqueTestId(testInfo.workerIndex);
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openSocketIOTab(page);
  });

  async function connectTo(page: Page, url: string) {
    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(url);
    await page.keyboard.press("Escape");
    await layout.getByTestId("connect-btn").click();
  }

  test("E-RT-02: unreachable URL shows an error and re-enables Connect", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await connectTo(page, UNREACHABLE_URL);

    await expect(layout.getByTestId("socketio-error")).toBeVisible();
    await expect(layout.getByTestId("connect-btn")).toBeEnabled();
    await expect(layout.getByText("Connecting…")).toBeHidden();
    await expect(layout.getByTestId("disconnect-btn")).toBeHidden();
  });

  test("E-RT-11: custom event name is sent; default event echo is received", async ({
    page,
  }) => {
    const layout = getLayout(page);
    const log = layout.getByTestId("message-log");
    await connectTo(page, mockUrlFor(testId));
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();

    await expect(layout.getByTestId("socketio-event-input")).toHaveValue(
      "message",
    );
    await layout.getByTestId("ws-message-input").fill("default-payload");
    await layout.getByTestId("socketio-send-btn").click();
    await expect(
      log.locator("pre").filter({ hasText: "default-payload" }),
    ).toHaveCount(2);
    await expect(log.getByText("sent", { exact: true })).toBeVisible();
    await expect(log.getByText("received", { exact: true })).toBeVisible();

    await layout.getByTestId("socketio-event-input").fill("custom:ping");
    await layout.getByTestId("ws-message-input").fill("custom-payload");
    await layout.getByTestId("socketio-send-btn").click();
    // Client only subscribes to "message", so a custom-name echo is not logged.
    await expect(
      log.locator("pre").filter({ hasText: "custom-payload" }),
    ).toHaveCount(1);
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();
  });

  test("E-RT-04b: closing a connected tab makes the server see a disconnect", async ({
    page,
  }) => {
    const layout = getLayout(page);
    await connectTo(page, mockUrlFor(testId));
    await expect(layout.getByTestId("disconnect-btn")).toBeVisible();
    await expect
      .poll(() => fetchSocketIoEvents(page, testId))
      .toContain("connect");

    await page.getByTestId("tab-close-btn").first().click();
    // Typing a URL marks the tab dirty, so closing asks for confirmation.
    const closeDialog = page.getByTestId("close-tab-dialog");
    await closeDialog.getByRole("button", { name: "Close" }).click();
    await expect(closeDialog).toBeHidden();

    await expect
      .poll(() => fetchSocketIoEvents(page, testId))
      .toContain("disconnect");
  });
});
