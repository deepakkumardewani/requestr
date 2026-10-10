import { expect, type Locator, type Page, test } from "@playwright/test";
import { MOCK_BASE_URL } from "./support/mock-server/mockBaseUrl";

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
  let echoUrl = "";

  test.beforeEach(async ({ page }, testInfo) => {
    echoUrl = `${MOCK_BASE_URL}/echo?testId=body-${testInfo.testId}-${testInfo.repeatEachIndex}`;
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
    await fillUrl(page, echoUrl);
    await openBodyTab(page);
  });

  // Scenario: Send a request with no body
  test("sends a request with no body", async ({ page }) => {
    await selectBodyType(page, "body-type-none");

    const bodyEditor = page.getByTestId("body-editor");
    await expect(bodyEditor).toContainText("No body for this request");

    await fillUrl(page, echoUrl);
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
    // mock /echo returns the parsed body under "body"
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

    // mock /echo returns the raw body under "rawBody"
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
    // mock /echo returns parsed urlencoded fields under "body"
    await expect(prettyViewer).toContainText('"key1"');
    await expect(prettyViewer).toContainText('"val1"');
  });

  async function addFormRow(page: Page, key: string, value: string) {
    await page.locator(':visible [data-testid="body-draft-row-key"]').fill(key);
    await page.locator(':visible [data-testid="body-draft-row-value"]').fill(value);
    await getLayout(page).getByTestId("url-input").click(); // blur commits the row
  }

  test("E-REQ-10: Disabled form-data field is not sent", { tag: "@high" }, async ({ page }) => {
    // APP BUG: the proxy route only accepts string bodies, so form-data rows are
    // never serialized to multipart (echo shows body: null, content-length 0).
    test.fail();
    await switchToPost(page);
    await selectBodyType(page, "body-type-form-data");

    await addFormRow(page, "keep", "keep-value");
    await addFormRow(page, "skip", "skip-value");

    const toggles = page.locator(':visible [data-testid^="body-row-enable-"]');
    await expect(toggles).toHaveCount(2);

    const skipRow = page
      .locator(':visible [data-testid^="body-row-key-"]')
      .and(page.locator('input[value="skip"]'));
    await expect(skipRow).toHaveCount(1);
    const skipId = (await skipRow.getAttribute("data-testid"))!.replace("body-row-key-", "");
    await page.locator(`:visible [data-testid="body-row-enable-${skipId}"]`).click();
    await expect(
      page.locator(`:visible [data-testid="body-row-enable-${skipId}"]`),
    ).not.toBeChecked();

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");
    const viewer = page.getByTestId("response-pretty-viewer");
    await expect(viewer).toContainText("multipart/form-data");
    await expect(viewer).toContainText("keep-value");
    await expect(viewer).not.toContainText("skip");
  });
});
