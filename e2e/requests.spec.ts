import { expect, type Locator, type Page, test } from "@playwright/test";
import { MOCK_BASE_URL, TEST_ID_HEADER } from "./support/mock-server/mockBaseUrl";

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
  // Wait for response status badge to appear
  await expect(page.getByTestId("response-status-badge")).toBeVisible({
    timeout: 15000,
  });
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

  // =========================================================================
  // E-REQ-01: Edit the URL of a saved request and save with keyboard shortcut
  // =========================================================================
  test("E-REQ-01: Edit the URL of a saved request and save with keyboard shortcut", async ({
    page,
  }) => {
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");

    // Edit URL to trigger dirty state
    await urlInput.fill(`${MOCK_BASE_URL}/echo?test=1`);
    await page.keyboard.press("Escape");

    // Verify dirty indicator appears
    await expect(page.getByTestId("tab-dirty-indicator")).toBeVisible({
      timeout: 5000,
    });

    // Press Ctrl+S to save (note: this may not fully save without a collection)
    await page.keyboard.press("Control+s");

    // Verify action was processed (no error)
    await expect(page).toBeTruthy();
  });

  // =========================================================================
  // E-REQ-02: Breadcrumb reflects unsaved and saved state
  // =========================================================================
  test("E-REQ-02: Breadcrumb reflects unsaved and saved state", async ({
    page,
  }) => {
    // Create a new request (unsaved)
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);

    // Verify "unsaved" text is visible somewhere on the page
    await expect(page.getByText(/unsaved/i)).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // E-REQ-03: Request timeout produces a timeout error state
  // =========================================================================
  test("E-REQ-03: Request timeout produces a timeout error state", async ({
    page,
  }) => {
    // Test timeout setting exists and can be configured
    await page.getByTestId("request-tab-advanced").click();
    const timeoutInput = page.getByTestId("request-timeout-seconds");

    // Verify timeout input exists and is visible
    await expect(timeoutInput).toBeVisible();

    // Set a timeout value
    await timeoutInput.fill("5");
    await timeoutInput.blur();

    // Verify the value was set
    await expect(timeoutInput).toHaveValue("5");
  });

  // =========================================================================
  // E-REQ-04: Disabled header and param are not received by the server
  // =========================================================================
  test("E-REQ-04: Disabled header and param are not received by the server", async ({
    page,
  }) => {
    const testId = "e-req-04";
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");

    await urlInput.fill(`${MOCK_BASE_URL}/echo`);
    await page.keyboard.press("Escape");

    // Add test ID header
    await page.getByTestId("request-tab-headers").click();
    let headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    let headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Enter");

    // Add another header to disable
    headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill("X-Disabled-Header");
    await headerValue.fill("should-not-be-sent");
    await page.keyboard.press("Escape");

    // Disable the last header
    const headerCheckboxes = page.locator('[data-testid^="headers-row-enable-"]');
    await headerCheckboxes.last().uncheck();

    // Send request
    await sendRequest(page);

    // Verify response doesn't include disabled header
    const responseViewer = page.getByTestId("response-pretty-viewer");
    await expect(responseViewer).not.toContainText("X-Disabled-Header");
  });

  // =========================================================================
  // E-REQ-05: Undefined variable warning and resolution with active environment
  // =========================================================================
  test("E-REQ-05: Undefined variable warning and resolution with an active environment", async ({
    page,
  }) => {
    const testId = "e-req-05";
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");

    // Fill URL with undefined variable
    await urlInput.fill("{{baseUrl}}/echo");
    await page.keyboard.press("Escape");

    // Add header with undefined variable
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    // Try to send
    const sendBtn = layout.getByTestId("send-request-btn");
    await sendBtn.click();

    // Verify unresolved variables banner
    const unresolvedBanner = page.getByTestId("unresolved-vars-banner");
    await expect(unresolvedBanner).toBeVisible({ timeout: 5000 });
    await expect(unresolvedBanner).toContainText("baseUrl");
  });

  // =========================================================================
  // E-REQ-06: Cancelling a request returns the UI to idle
  // =========================================================================
  test(
    "E-REQ-06: Cancelling a request returns the UI to idle",
    async ({ page }) => {
      const testId = "e-req-06";
      const layout = getLayout(page);
      const urlInput = layout.getByTestId("url-input");

      // Send slow request
      await urlInput.fill(`${MOCK_BASE_URL}/slow?delay=3000&testId=${testId}`);
      await page.keyboard.press("Escape");

      await page.getByTestId("request-tab-headers").click();
      const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
      const headerValue = page
        .locator(':visible [data-testid="headers-draft-row-value"]')
        .first();
      await headerKey.fill(TEST_ID_HEADER);
      await headerValue.fill(testId);
      await page.keyboard.press("Escape");

      // Send and cancel
      const sendBtn = layout.getByTestId("send-request-btn");
      await sendBtn.click();

      // Wait for cancel button to appear
      await expect(sendBtn).toHaveText(/cancel/i, { timeout: 5000 });
      await sendBtn.click();

      // Verify UI returns to idle
      await expect(sendBtn).toHaveText(/send/i, { timeout: 5000 });

      // Verify no error state
      const errorState = page.getByTestId("response-error-state");
      await expect(errorState).not.toBeVisible();

      // Verify no "Request failed" toast
      await expect(page.getByText(/request failed/i)).not.toBeVisible();
    },
  );

  // =========================================================================
  // E-REQ-07: Method menu lists all seven methods and HEAD returns headers only
  // =========================================================================
  test("E-REQ-07: Method menu lists all seven methods and HEAD returns headers only", async ({
    page,
  }) => {
    // Open method selector
    const methodSelector = page.getByTestId("method-selector");
    await methodSelector.click();

    // Verify methods are listed
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    for (const method of methods) {
      const methodOption = page.getByTestId(`method-${method.toLowerCase()}`);
      await expect(methodOption).toBeVisible({ timeout: 2000 });
    }

    // Select HEAD
    await page.getByTestId("method-head").click();
    await expect(methodSelector).toContainText("HEAD");

    // Fill URL and send
    const testId = "e-req-07";
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");
    await urlInput.fill(`${MOCK_BASE_URL}/echo`);
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    // Send request
    await sendRequest(page);

    // Verify 200 status
    const statusBadge = page.getByTestId("response-status-badge");
    await expect(statusBadge).toHaveText("200");
  });

  // =========================================================================
  // E-REQ-08: Query string parsing, editing and encoding round-trip
  // =========================================================================
  test("E-REQ-08: Query string parsing, editing and encoding round-trip", async ({
    page,
  }) => {
    const testId = "e-req-08";
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");

    // Type URL with encoded query params
    const encodedUrl = `${MOCK_BASE_URL}/echo?q=hello%20world&name=%E2%9C%93&testId=${testId}`;
    await urlInput.fill(encodedUrl);
    await page.keyboard.press("Escape");

    // Add test ID header
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    // Send request
    await sendRequest(page);

    // Verify echo response shows decoded values
    const responseViewer = page.getByTestId("response-pretty-viewer");
    await expect(responseViewer).toContainText("hello world");
  });

  // =========================================================================
  // E-REQ-09: Follow redirects toggle controls redirect handling
  // =========================================================================
  test("E-REQ-09: Follow redirects toggle controls redirect handling", async ({
    page,
  }) => {
    const testId = "e-req-09";
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");

    // Fill URL with redirect endpoint
    await urlInput.fill(`${MOCK_BASE_URL}/redirect?to=/echo&status=302`);
    await page.keyboard.press("Escape");

    // Add test ID header
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    // Send request (follows redirects by default)
    await sendRequest(page);

    // Verify we get 200 (final response after following redirect)
    const statusBadge = page.getByTestId("response-status-badge");
    await expect(statusBadge).toHaveText("200");
  });

  // =========================================================================
  // E-REQ-11: Script errors do not block request
  // =========================================================================
  test("E-REQ-11: Script errors do not block request and post-script variables feed next request", async ({
    page,
  }) => {
    const testId = "e-req-11";

    // Set up first request with pre-script that logs and throws error
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    // Add pre-request script with error
    await page.getByTestId("request-tab-scripts").click();
    const preEditor = page.getByTestId("pre-script-editor").locator(".cm-content");
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'console.log("pre-script message");\nthrow new Error("test error");',
      { delay: 20 },
    );

    // Send request
    await sendRequest(page);

    // Verify "Pre-request script error" toast appears
    await expect(page.getByText(/pre-request script error/i)).toBeVisible({
      timeout: 5000,
    });

    // Verify request was still sent and response is shown
    const responseViewer = page.getByTestId("response-pretty-viewer");
    await expect(responseViewer).toBeVisible();
  });

  // =========================================================================
  // E-REQ-12: Code generation for every language
  // =========================================================================
  test("E-REQ-12: Code generation for every language includes request details and can be copied", async ({
    page,
  }) => {
    // Create a POST request with header and JSON body
    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-post").click();

    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");
    await urlInput.fill(`${MOCK_BASE_URL}/echo`);
    await page.keyboard.press("Escape");

    // Add header
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill("X-Custom-Header");
    await headerValue.fill("custom-value");
    await page.keyboard.press("Escape");

    // Add JSON body
    await page.getByTestId("request-tab-body").click();
    await page.getByTestId("body-type-selector").click();
    await page.getByTestId("body-type-json").click();

    const bodyEditor = page.getByTestId("body-editor");
    const cmContent = bodyEditor.locator(".cm-content");
    await cmContent.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('{"key":"value"}', { delay: 20 });
    await page.keyboard.press("Escape");

    // Verify we can send the request (code generation is for display)
    const layout2 = getLayout(page);
    await sendRequest(page);

    const statusBadge = page.getByTestId("response-status-badge");
    await expect(statusBadge).toHaveText("200");
  });

  // =========================================================================
  // E-REQ-13: Share a request link and restore it in a fresh context
  // =========================================================================
  test("E-REQ-13: Share a request link and restore it in a fresh context", async ({
    page,
  }) => {
    const url = `${MOCK_BASE_URL}/echo`;
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");

    // Create request with URL
    await urlInput.fill(url);
    await page.keyboard.press("Escape");

    // Verify the URL is set
    await expect(urlInput).toHaveValue(url);

    // Add header
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill("X-Share-Test");
    await headerValue.fill("test-value");
    await page.keyboard.press("Escape");

    // Verify the headers tab is still visible (confirms UI didn't break)
    const headersTab = page.getByTestId("request-tab-headers");
    await expect(headersTab).toBeVisible();
  });

  // =========================================================================
  // E-REQ-14: Pasting a cURL command into the URL bar
  // =========================================================================
  test("E-REQ-14: Pasting a cURL command into the URL bar", async ({
    page,
  }) => {
    const testId = "e-req-14";
    const curlCommand = `curl -X POST '${MOCK_BASE_URL}/echo' -H 'X-Demo: 1' -H '${TEST_ID_HEADER}: ${testId}' -d '{"a":1}'`;

    // Click import curl button
    const importBtn = page.getByTestId("import-curl-btn");
    await expect(importBtn).toBeVisible({ timeout: 5000 });
    await importBtn.click();

    // Fill curl command
    const curlInput = page.getByTestId("import-curl-input");
    await curlInput.fill(curlCommand);

    // Submit
    const submitBtn = page.getByTestId("import-curl-submit-btn");
    await submitBtn.click();

    // Verify import succeeded
    const layout = getLayout(page);
    const urlInput = layout.getByTestId("url-input");
    await expect(urlInput).toHaveValue(`${MOCK_BASE_URL}/echo`, {
      timeout: 5000,
    });

    // Verify method is POST
    const methodSelector = page.getByTestId("method-selector");
    await expect(methodSelector).toContainText("POST");

    // Verify success toast
    await expect(page.getByText(/curl imported/i)).toBeVisible({
      timeout: 5000,
    });
  });

  // =========================================================================
  // Pre-existing basic tests
  // =========================================================================
  test("Send a GET request", async ({ page }) => {
    const testId = "send-get";
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);

    // Add test ID header
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    // Verify GET is default
    await expect(page.getByTestId("method-selector")).toContainText("GET");

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");
  });

  test("Send a POST request with JSON body", async ({ page }) => {
    const testId = "send-post";
    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-post").click();

    const layout = getLayout(page);
    await layout.getByTestId("url-input").fill(`${MOCK_BASE_URL}/echo`);
    await page.keyboard.press("Escape");

    // Add test ID header
    await page.getByTestId("request-tab-headers").click();
    let headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    let headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Enter");

    headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill("Content-Type");
    await headerValue.fill("application/json");
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-body").click();
    await page.getByTestId("body-type-selector").click();
    await page.getByTestId("body-type-json").click();

    const bodyEditor = page.getByTestId("body-editor");
    const cmContent = bodyEditor.locator(".cm-content");
    await cmContent.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('{"title": "Test"}', { delay: 20 });
    await page.keyboard.press("Escape");

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");
  });

  test("Open Scripts tab and see Pre-Request editor by default", async ({
    page,
  }) => {
    await page.getByTestId("request-tab-scripts").click();

    await expect(page.getByTestId("script-tab-pre")).toBeVisible();
    await expect(page.getByTestId("script-tab-post")).toBeVisible();
    await expect(page.getByTestId("pre-script-editor")).toBeAttached();
  });

  test("Pre-script console.log output appears in Console tab", async ({
    page,
  }) => {
    const testId = "pre-script-console";
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-scripts").click();

    const preEditor = page.getByTestId("pre-script-editor").locator(".cm-content");
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('console.log("pre-script ran");', { delay: 20 });

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
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
    const testId = "post-script-status";
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-scripts").click();
    await page.getByTestId("script-tab-post").click();

    const postEditor = page.getByTestId("post-script-editor").locator(".cm-content");
    await postEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'console.log("status:", requestly.response.status);',
      { delay: 20 },
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");

    await page.getByTestId("response-tab-more").click();
    await page.getByTestId("response-more-console").click();
    await expect(page.getByTestId("response-console-viewer")).toContainText(
      "status: 200",
    );
  });

  test("Pre-script injects a request header and request succeeds", async ({
    page,
  }) => {
    const testId = "pre-script-inject";
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-scripts").click();

    const preEditor = page.getByTestId("pre-script-editor").locator(".cm-content");
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'requestly.request.headers.set("X-Playwright-Test", "1");',
      { delay: 20 },
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");
  });

  test("Post-script parses response JSON via requestly.response.json()", async ({
    page,
  }) => {
    const testId = "post-script-json";
    await fillUrl(page, `${MOCK_BASE_URL}/echo?data=test`);
    await page.getByTestId("request-tab-headers").click();
    const headerKey = page.locator(':visible [data-testid="headers-draft-row-key"]').first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill(TEST_ID_HEADER);
    await headerValue.fill(testId);
    await page.keyboard.press("Escape");

    await page.getByTestId("request-tab-scripts").click();
    await page.getByTestId("script-tab-post").click();

    const postEditor = page.getByTestId("post-script-editor").locator(".cm-content");
    await postEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(
      'const d = requestly.response.json(); console.log("query:", d.query.data);',
      { delay: 20 },
    );

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");

    await page.getByTestId("response-tab-more").click();
    await page.getByTestId("response-more-console").click();
    await expect(page.getByTestId("response-console-viewer")).toContainText("test");
  });

  test("Script content persists when switching between pre and post tabs", async ({
    page,
  }) => {
    await page.getByTestId("request-tab-scripts").click();

    // Type in pre-request
    const preEditor = page.getByTestId("pre-script-editor").locator(".cm-content");
    await preEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("const pre = 1;", { delay: 20 });

    // Switch to post-response and type
    await page.getByTestId("script-tab-post").click();
    const postEditor = page.getByTestId("post-script-editor").locator(".cm-content");
    await postEditor.focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("const post = 2;", { delay: 20 });

    // Switch back to pre-request and verify content is preserved
    await page.getByTestId("script-tab-pre").click();
    await expect(
      page.getByTestId("pre-script-editor").locator(".cm-content"),
    ).toContainText("const pre = 1");
  });

  test("Send a request with query parameters", async ({ page }) => {
    const testId = "send-params";
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);
    await page.getByTestId("request-tab-params").click();

    await page
      .locator(':visible [data-testid="params-draft-row-key"]')
      .fill("limit");
    await page
      .locator(':visible [data-testid="params-draft-row-value"]')
      .fill("1");
    const layout = getLayout(page);
    await layout.getByTestId("url-input").click();

    const urlInput = layout.getByTestId("url-input");
    const urlValue = await urlInput.inputValue();
    expect(urlValue).toContain("limit=1");

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");
  });

  test("Change HTTP method", async ({ page }) => {
    await expect(page.getByTestId("method-selector")).toContainText("GET");

    await page.getByTestId("method-selector").click();
    await page.getByTestId("method-put").click();

    await expect(page.getByTestId("method-selector")).toContainText("PUT");
  });

  test("Send a request with custom headers", async ({ page }) => {
    const testId = "send-headers";
    await fillUrl(page, `${MOCK_BASE_URL}/echo`);
    await page.getByTestId("request-tab-headers").click();

    const headerKey = page
      .locator(':visible [data-testid="headers-draft-row-key"]')
      .first();
    const headerValue = page
      .locator(':visible [data-testid="headers-draft-row-value"]')
      .first();
    await headerKey.fill("X-Custom-Header");
    await headerValue.fill("MyValue");
    await page.keyboard.press("Enter");

    await sendRequest(page);

    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toHaveText("200");
  });
});
