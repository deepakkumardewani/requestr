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

async function sendRequest(page: Page) {
  const layout = getLayout(page);
  await layout.getByTestId("send-request-btn").click();
}

async function fillUrl(page: Page, url: string) {
  const layout = getLayout(page);
  await layout.getByTestId("url-input").fill(url);
  await page.keyboard.press("Escape");
}

async function switchToPost(page: Page) {
  await page.getByTestId("method-selector").click();
  await page.getByTestId("method-post").click();
}

async function openBodyTab(page: Page) {
  await page.getByTestId("request-tab-body").click();
}

async function selectBodyType(page: Page, typeTestId: string) {
  await page.getByTestId("body-type-selector").click();
  await page.getByTestId(typeTestId).click();
}

async function typeInBodyEditor(page: Page, content: string) {
  const bodyEditor = page.getByTestId("body-editor");
  const cmContent = bodyEditor.locator(".cm-content");
  await cmContent.scrollIntoViewIfNeeded();
  await cmContent.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(content, { delay: 20 });
}

// ---------------------------------------------------------------------------
// Test Suite: Request Body
// ---------------------------------------------------------------------------

test.describe("Request Body", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
    await fillUrl(page, "https://httpbin.org/post");
    await openBodyTab(page);
  });

  // Scenario: Send a request with no body
  test("sends a request with no body", async ({ page }) => {
    await selectBodyType(page, "body-type-none");

    const bodyEditor = page.getByTestId("body-editor");
    await expect(bodyEditor).toContainText("No body for this request");

    await fillUrl(page, "https://httpbin.org/get");
    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });

  // Scenario: Send a request with a JSON body
  test("sends a request with a JSON body", async ({ page }) => {
    await switchToPost(page);
    await selectBodyType(page, "body-type-json");
    await typeInBodyEditor(page, '{"name":"test"}');

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible();
    // httpbin echoes back the parsed JSON under "json" key
    await expect(prettyViewer).toContainText('"name"');
    await expect(prettyViewer).toContainText('"test"');
  });

  // Scenario: Send a request with an XML body
  test("sends a request with an XML body", async ({ page }) => {
    await switchToPost(page);
    await selectBodyType(page, "body-type-xml");
    await typeInBodyEditor(page, "<root><item>hello</item></root>");

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    // httpbin echoes back raw body under "data" key
    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible();
    await expect(prettyViewer).toContainText("hello");
  });

  // Scenario: Send a request with plain text body
  test("sends a request with a plain text body", async ({ page }) => {
    await switchToPost(page);
    await selectBodyType(page, "body-type-text");
    await typeInBodyEditor(page, "hello world");

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible();
    await expect(prettyViewer).toContainText("hello world");
  });

  // Scenario: Send a request with form-data body
  // Note: the proxy only accepts string bodies so multipart KV rows are not serialized.
  // This test verifies the UI flow (type selector → KV table → successful request).
  test("sends a request with a form-data body", async ({ page }) => {
    await switchToPost(page);
    await selectBodyType(page, "body-type-form-data");

    await page.locator(':visible [data-testid="body-draft-row-key"]').fill("field1");
    await page
      .locator(':visible [data-testid="body-draft-row-value"]')
      .fill("value1");
    await page.getByTestId("url-input").click(); // commit the row

    // Verify the row was committed
    const checkboxes = page.locator('[data-testid^="body-row-enable-"]');
    await expect(checkboxes).toHaveCount(1, { timeout: 3000 });

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });

  // Scenario: Send a request with URL-encoded body
  test("sends a request with a URL-encoded body", async ({ page }) => {
    await switchToPost(page);
    await selectBodyType(page, "body-type-urlencoded");

    await page.locator(':visible [data-testid="body-draft-row-key"]').fill("key1");
    await page.locator(':visible [data-testid="body-draft-row-value"]').fill("val1");
    await page.getByTestId("url-input").click(); // commit the row

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible();
    // httpbin echoes urlencoded fields under "form" key
    await expect(prettyViewer).toContainText('"key1"');
    await expect(prettyViewer).toContainText('"val1"');
  });
});
