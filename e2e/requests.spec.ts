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
  const sendBtn = layout.getByTestId("send-request-btn");
  await sendBtn.click();
}

async function fillUrl(page: Page, url: string) {
  const layout = getLayout(page);
  const urlInput = layout.getByTestId("url-input");
  await urlInput.fill(url);
  await page.keyboard.press("Escape");
}

// ---------------------------------------------------------------------------
// Test Suite: HTTP Requests
// ---------------------------------------------------------------------------

test.describe("HTTP Requests", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
  });

  test("Send a GET request", async ({ page }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    // Verify GET is default
    await expect(page.getByTestId("method-selector")).toHaveText(/GET/);

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible();
    await expect(prettyViewer).toContainText('"Essence Mascara Lash Princess"');
  });

  test("Send a POST request with JSON body", async ({ page }) => {
    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-post").click();

    await fillUrl(page, "https://dummyjson.com/products/add");

    await page.getByTestId("request-tab-body").click();
    await page.getByTestId("body-type-selector").click();
    await page.getByTestId("body-type-json").click();

    // Scope to body-editor to avoid matching the cURL output editor's .cm-content
    const bodyEditor = page.getByTestId("body-editor");
    const cmContent = bodyEditor.locator(".cm-content");
    await cmContent.scrollIntoViewIfNeeded();
    await cmContent.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('{"title": "BMW Pencil"}', { delay: 20 });

    // add header
    await page.getByTestId("request-tab-headers").click();
    await page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .fill("Content-Type");
    await page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .fill("application/json");
    // blur the field by clicking elsewhere to commit the row
    await page.getByTestId("url-input").click();

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    // It should return 200/201
    await expect(badge).toContainText("2");

    const prettyViewer = page.getByTestId("response-pretty-viewer");
    await expect(prettyViewer).toBeVisible();
    await expect(prettyViewer).toContainText('"BMW Pencil"');
  });

  test("Send a request with query parameters", async ({ page }) => {
    await fillUrl(page, "https://dummyjson.com/products");
    await page.getByTestId("request-tab-params").click();

    await page.locator(':visible [data-testid="params-draft-row-key"]').fill("limit");
    await page.locator(':visible [data-testid="params-draft-row-value"]').fill("1");
    // click somewhere to blur and commit
    await page.getByTestId("url-input").click();

    // Verify URL updated automatically
    await expect(page.getByTestId("url-input")).toHaveValue(
      "https://dummyjson.com/products?limit=1",
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId("response-pretty-viewer")).toBeVisible();
    // Pretty viewer uses virtual scrolling — "limit" appears at the bottom and may not be in the DOM.
    // Switch to raw tab which renders all text at once.
    await page.getByTestId("view-mode-raw").click();
    const rawViewer = page.getByTestId("response-raw-viewer");
    await expect(rawViewer).toBeVisible();
    // Raw tab shows minified JSON, so no spaces around colons
    await expect(rawViewer).toContainText('"limit":1');
  });

  test("Send a request with custom headers", async ({ page }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    await page.getByTestId("request-tab-headers").click();

    await page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .fill("X-Custom-Header");
    await page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .fill("MyValue");
    await page.keyboard.press("Enter"); // commit row

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });

  test("Cancel an in-flight request", async ({ page }) => {
    // Delay dummy json for 5 seconds
    await fillUrl(page, "https://dummyjson.com/products?delay=5000");
    await sendRequest(page);

    const sendBtn = page.getByTestId("send-request-btn");
    await expect(sendBtn).toHaveText(/Cancel/);
    await sendBtn.click(); // Cancel request

    const errorState = page.getByTestId("response-error-state");
    await expect(errorState).toBeVisible({ timeout: 15000 });
    await expect(errorState).toContainText(
      /Failed to reach the proxy server|abort|cancel/i,
    );
  });

  test("Change HTTP method", async ({ page }) => {
    await expect(page.getByTestId("method-selector")).toHaveText(/GET/);

    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-put").click();

    await expect(page.getByTestId("method-selector")).toHaveText(/PUT/);
  });

  test("Disable a query parameter", async ({ page }) => {
    await fillUrl(page, "https://dummyjson.com/products");
    await page.getByTestId("request-tab-params").click();

    await page.locator(':visible [data-testid="params-draft-row-key"]').fill("limit");
    await page.locator(':visible [data-testid="params-draft-row-value"]').fill("1");
    await page.getByTestId("url-input").click();

    await expect(page.getByTestId("url-input")).toHaveValue(
      "https://dummyjson.com/products?limit=1",
    );

    // Uncheck the enable checkbox. Find the checkbox in the first committed row.
    // The KV table generates an id that we don't know, but we know it starts with row-enable-
    const checkboxes = page.locator('[data-testid^="params-row-enable-"]');
    await checkboxes.first().uncheck();

    // Wait for the URL to update after unchecking
    await expect(page.getByTestId("url-input")).toHaveValue(
      "https://dummyjson.com/products",
    );

    await sendRequest(page);
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });

  test("Disable a request header", async ({ page }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    await page.getByTestId("request-tab-headers").click();

    await page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .fill("X-Custom-Header");
    await page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .fill("MyValue");
    await page.getByTestId("url-input").click();

    const checkboxes = page.locator('[data-testid^="headers-row-enable-"]');
    await checkboxes.first().uncheck();

    await sendRequest(page);
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });

  test("Import a request from a cURL command", async ({ page }) => {
    await page.getByTestId("import-curl-btn").click();

    // Fill cURL input
    const curlCommand = `curl -X POST https://dummyjson.com/products/add -H "Content-Type: application/json" -d '{"title":"Test Product"}'`;
    await page.getByTestId("import-curl-input").fill(curlCommand);
    await page.getByTestId("import-curl-submit-btn").click();

    // Verify it applied
    await expect(page.getByTestId("url-input")).toHaveValue(
      "https://dummyjson.com/products/add",
    );
    await expect(page.getByTestId("method-selector")).toHaveText(/POST/);

    await page.getByTestId("request-tab-body").click();
    await expect(page.getByTestId("body-type-selector")).toHaveText(/json/i);
  });

  test("Export a request as cURL", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-post").click();
    await fillUrl(page, "https://dummyjson.com/products/add");

    // "Copy as cURL" button sits next to the URL input
    await page.getByTestId("copy-curl-btn").click();

    const clipboardText = await page.evaluate("navigator.clipboard.readText()");
    expect(clipboardText).toContain("curl");
    expect(clipboardText).toContain("-X POST");
    expect(clipboardText).toContain("https://dummyjson.com/products/add");
  });

  test("Open Scripts tab and see Pre-Request editor by default", async ({
    page,
  }) => {
    await page.getByTestId("request-tab-scripts").click();

    await expect(page.getByTestId("script-tab-pre")).toBeVisible();
    await expect(page.getByTestId("script-tab-post")).toBeVisible();
    // Editor wrapper exists in DOM but CodeMirror loads async — assert attached, not visible
    await expect(page.getByTestId("pre-script-editor")).toBeAttached();
  });

  test("Pre-script console.log output appears in Console tab", async ({
    page,
  }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    await page.getByTestId("request-tab-scripts").click();

    const preEditor = page
      .getByTestId("pre-script-editor")
      .locator(".cm-content");
    await preEditor.scrollIntoViewIfNeeded();
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('console.log("pre-script ran");', { delay: 20 });

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    await page.getByTestId("response-tab-more").click();
    await page.getByTestId("response-more-console").click();
    await expect(page.getByTestId("response-console-viewer")).toContainText(
      "pre-script ran",
    );
  });

  test("Post-script reads response status via requestly.response.status", async ({
    page,
  }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    await page.getByTestId("request-tab-scripts").click();
    await page.getByTestId("script-tab-post").click();

    await expect(page.getByTestId("post-script-editor")).toBeAttached();

    const postEditor = page
      .getByTestId("post-script-editor")
      .locator(".cm-content");
    await postEditor.scrollIntoViewIfNeeded();
    await postEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'console.log("status:", requestly.response.status);',
      { delay: 20 },
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    await page.getByTestId("response-tab-more").click();
    await page.getByTestId("response-more-console").click();
    await expect(page.getByTestId("response-console-viewer")).toContainText(
      "status: 200",
    );
  });

  test("Pre-script injects a request header and request succeeds", async ({
    page,
  }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    await page.getByTestId("request-tab-scripts").click();

    const preEditor = page
      .getByTestId("pre-script-editor")
      .locator(".cm-content");
    await preEditor.scrollIntoViewIfNeeded();
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'requestly.request.headers.set("X-Playwright-Test", "1");',
      { delay: 20 },
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });

  test("Post-script parses response JSON via requestly.response.json()", async ({
    page,
  }) => {
    await fillUrl(page, "https://dummyjson.com/products/1");
    await page.getByTestId("request-tab-scripts").click();
    await page.getByTestId("script-tab-post").click();

    const postEditor = page
      .getByTestId("post-script-editor")
      .locator(".cm-content");
    await postEditor.scrollIntoViewIfNeeded();
    await postEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'const d = requestly.response.json(); console.log("title:", d.title);',
      { delay: 20 },
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    await page.getByTestId("response-tab-more").click();
    await page.getByTestId("response-more-console").click();
    await expect(page.getByTestId("response-console-viewer")).toContainText(
      "Essence Mascara Lash Princess",
    );
  });

  test("Script content persists when switching between pre and post tabs", async ({
    page,
  }) => {
    await page.getByTestId("request-tab-scripts").click();

    // Type in pre-request
    const preEditor = page
      .getByTestId("pre-script-editor")
      .locator(".cm-content");
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("const pre = 1;", { delay: 20 });

    // Switch to post-response and type
    await page.getByTestId("script-tab-post").click();
    const postEditor = page
      .getByTestId("post-script-editor")
      .locator(".cm-content");
    await postEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("const post = 2;", { delay: 20 });

    // Switch back to pre-request and verify content is preserved
    await page.getByTestId("script-tab-pre").click();
    await expect(
      page.getByTestId("pre-script-editor").locator(".cm-content"),
    ).toContainText("const pre = 1");
  });

  test("Send a request with path parameters", async ({ page }) => {
    await fillUrl(page, "https://dummyjson.com/products/:id");
    await page.getByTestId("request-tab-params").click();

    // Verify 'Path Params' section is visible and contains 'id'
    // id should be read only key
    const pathKeys = page.locator('input[readonly][value="id"]');
    await expect(pathKeys).toHaveCount(1);

    // Find the corresponding value input (it's the next sibling or similar, we can find by id)
    // Actually we added data-testid="row-value-<id>" but readOnly keys value input in params might be different?
    // Let's type in the first row-value- input because the path param comes first
    const pathValue = page.locator('[data-testid^="path-params-row-value-"]').first();
    await pathValue.fill("1");

    // The url bar does NOT update, path parameters are handled during fetch
    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");
  });
});
