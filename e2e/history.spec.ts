import { expect, type Locator, type Page, test } from "@playwright/test";
import { GRAPHQL_PATH } from "./support/mock-server/graphqlRoutes";
import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Nothing listens on port 1, so the connection is refused immediately. */
const UNREACHABLE_URL = "http://127.0.0.1:1/unreachable";
const FAILED_STATUS_TEXT = "0";

async function clearHistoryDB(page: Page) {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.open("requestly");
      req.onsuccess = () => {
        const db = req.result;
        if (db.objectStoreNames.contains("history")) {
          const tx = db.transaction("history", "readwrite");
          tx.objectStore("history").clear();
          tx.oncomplete = () => resolve(true);
        } else {
          resolve(true);
        }
      };
      req.onerror = () => resolve(false);
    });
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

async function fillUrl(page: Page, url: string) {
  await getLayout(page).getByTestId("url-input").fill(url);
  await page.keyboard.press("Escape");
}

async function clickSend(page: Page) {
  await getLayout(page).getByTestId("send-request-btn").click();
}

/** Sends a request and waits for a successful response to be rendered. */
async function sendRequest(page: Page, url: string) {
  await fillUrl(page, url);
  await clickSend(page);
  await expect(page.getByTestId("response-status-badge")).toBeVisible({
    timeout: 15000,
  });
}

/** The tag leads the query because History truncates long URLs in the list. */
function echoUrl(tag: string): string {
  return `${MOCK_BASE_URL}/echo?t=${tag}&testId=${tag}`;
}

async function openHistory(page: Page) {
  await page.getByTestId("sidebar-tab-history").click();
  await expect(page.getByTestId("history-list")).toBeVisible();
}

async function closeActiveTab(page: Page) {
  await getLayout(page).getByTestId("tab-close-btn").first().click();
  // The edited tab is dirty, so the app asks for confirmation before closing.
  const dialog = page.getByTestId("close-tab-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function openGraphQLTab(page: Page) {
  await page.getByTestId("create-new-dropdown-trigger").click();
  await page.getByRole("menuitem", { name: "GraphQL" }).click();
}

async function typeInCodeEditor(page: Page, testId: string, text: string) {
  const cm = page.getByTestId(testId).locator(".cm-content");
  await cm.waitFor({ state: "visible" });
  await cm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text, { delay: 15 });
}

// ---------------------------------------------------------------------------
// Test Suite: Request History
// ---------------------------------------------------------------------------

test.describe("Request History", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app");
    await clearHistoryDB(page);
    await page.reload();
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
  });

  test("History entry is created after sending a request", async ({ page }) => {
    await sendRequest(page, echoUrl("history-create"));
    await openHistory(page);

    const firstItem = page.getByTestId("history-item").first();
    await expect(firstItem).toBeVisible();
    await expect(firstItem.getByTestId("history-item-url")).toContainText(
      "/echo",
    );
    await expect(firstItem.getByTestId("history-item-status")).toHaveText(
      "200",
    );
  });

  test("Open a history entry into a new tab", async ({ page }) => {
    const testUrl = echoUrl("history-open");
    await sendRequest(page, testUrl);
    await closeActiveTab(page);
    await openHistory(page);

    await page.getByTestId("history-item").first().click();

    await expect(getLayout(page).getByTestId("url-input")).toHaveValue(
      testUrl,
    );
  });

  test("Delete a single history entry", async ({ page }) => {
    await sendRequest(page, echoUrl("history-delete"));
    await openHistory(page);
    const historyItem = page.getByTestId("history-item").first();
    await expect(historyItem).toBeVisible();

    await historyItem.hover();
    await page.getByTestId("history-item-delete").click();

    await expect(page.getByTestId("history-item")).toHaveCount(0);
    await expect(page.getByText("No requests sent yet")).toBeVisible();
  });

  test("Clear all history", async ({ page }) => {
    await sendRequest(page, echoUrl("history-clear-1"));
    await openTab(page);
    await sendRequest(page, echoUrl("history-clear-2"));

    await page.getByTestId("sidebar-settings-btn").click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.getByTestId("nav-general").click();
    await page.getByTestId("clear-history-btn").click();
    await page.getByTestId("confirm-clear-history-btn").click();

    await page.getByRole("link", { name: "Home" }).click();
    await openHistory(page);
    await expect(page.getByTestId("history-item")).toHaveCount(0);
    await expect(page.getByText("No requests sent yet")).toBeVisible();
  });

  test("History persists after page reload", async ({ page }) => {
    await sendRequest(page, echoUrl("persist"));

    await page.reload();
    await expect(getLayout(page)).toBeVisible();
    await openHistory(page);

    const firstItem = page.getByTestId("history-item").first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });
    await expect(firstItem.getByTestId("history-item-url")).toContainText(
      "persist",
    );
  });

  // =========================================================================
  // E-RT-01
  // =========================================================================
  test("E-RT-01: A failed HTTP request is recorded in History and a GraphQL send is not", async ({
    page,
  }) => {
    await fillUrl(page, UNREACHABLE_URL);
    await clickSend(page);
    await expect(page.getByTestId("response-error-state")).toBeVisible({
      timeout: 15000,
    });

    await openHistory(page);
    const items = page.getByTestId("history-item");
    await expect(items).toHaveCount(1);
    await expect(items.first().getByTestId("history-item-url")).toContainText(
      "127.0.0.1:1/unreachable",
    );
    await expect(items.first()).toContainText("GET");
    await expect(items.first().getByTestId("history-item-status")).toHaveText(
      FAILED_STATUS_TEXT,
    );

    // Reopen from history as an HTTP tab with the same method and URL.
    await closeActiveTab(page);
    await items.first().click();
    const layout = getLayout(page);
    await expect(layout.getByTestId("url-input")).toHaveValue(UNREACHABLE_URL);
    await expect(layout.getByTestId("method-selector")).toContainText("GET");
    await expect(layout.getByTestId("send-request-btn")).toBeVisible();

    // A GraphQL send must not add a history entry.
    await openGraphQLTab(page);
    await typeInCodeEditor(page, "graphql-query-editor", "{ __typename }");
    await fillUrl(page, `${MOCK_BASE_URL}${GRAPHQL_PATH}?testId=e-rt-01`);
    await clickSend(page);
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    await expect(items).toHaveCount(1);
    await expect(page.getByTestId("history-list")).not.toContainText(
      GRAPHQL_PATH,
    );
  });

  // =========================================================================
  // E-RT-08
  // =========================================================================
  test("E-RT-08: Sidebar search filters History, clearing restores it, no-match shows an empty state", async ({
    page,
  }) => {
    await sendRequest(page, echoUrl("alpha"));
    await openTab(page);
    await sendRequest(page, echoUrl("bravo"));
    await openHistory(page);

    const items = page.getByTestId("history-item");
    await expect(items).toHaveCount(2);

    const search = page.getByPlaceholder("Search...");
    await search.fill("alpha");
    await expect(items).toHaveCount(1);
    await expect(items.first().getByTestId("history-item-url")).toContainText(
      "alpha",
    );

    await search.fill("zzz-no-such-entry");
    await expect(items).toHaveCount(0);
    await expect(page.getByText("No matches")).toBeVisible();
    await expect(page.getByText("Try a different search")).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");
    await expect(items).toHaveCount(2);
  });

  // =========================================================================
  // E-RT-09
  // =========================================================================
  test("E-RT-09: Opening a history item restores its method, headers and body", async ({
    page,
  }) => {
    const testUrl = echoUrl("e-rt-09");
    const headerName = "x-history-check";
    const headerValue = "restored-value";
    const jsonBody = '{"restored":"yes"}';
    const layout = getLayout(page);

    await fillUrl(page, testUrl);
    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-post").click();

    await page.getByTestId("request-tab-headers").click();
    await page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .first()
      .fill(headerName);
    await page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first()
      .fill(headerValue);
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-body").click();
    await page.getByTestId("body-type-selector").click();
    await page.getByTestId("body-type-json").click();
    await typeInCodeEditor(page, "body-editor", jsonBody);

    await clickSend(page);
    await expect(page.getByTestId("response-status-badge")).toBeVisible({
      timeout: 15000,
    });

    await closeActiveTab(page);
    await openHistory(page);
    const item = page.getByTestId("history-item").first();
    await expect(item).toContainText("POST");
    await item.click();

    await expect(layout.getByTestId("url-input")).toHaveValue(testUrl);
    await expect(layout.getByTestId("method-selector")).toContainText("POST");

    await page.getByTestId("request-tab-headers").click();
    await expect(
      page
        .locator(':visible [data-testid="headers-draft-row-key"]')
        .first(),
    ).toBeVisible();
    await expect(
      page.locator(`:visible input[value="${headerName}"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`:visible input[value="${headerValue}"]`).first(),
    ).toBeVisible();

    await page.getByTestId("request-tab-body").click();
    await expect(page.getByTestId("body-editor")).toContainText(
      '"restored"',
    );
    await expect(page.getByTestId("body-editor")).toContainText('"yes"');
  });
});
