import { expect, type Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers (mirrored from requests.spec.ts)
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

function getLayout(page: Page) {
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
  const layout = getLayout(page);
  const urlInput = layout.getByTestId("url-input");
  await urlInput.fill(url);
  await page.keyboard.press("Escape");
}

async function sendRequest(page: Page) {
  const layout = getLayout(page);
  const sendBtn = layout.getByTestId("send-request-btn");
  await sendBtn.click();
}

async function navigateToAuthTab(page: Page) {
  await page.getByTestId("request-tab-auth").click();
}

async function selectAuthType(
  page: Page,
  type: "none" | "bearer" | "basic" | "api-key",
) {
  await page.getByTestId("auth-type-selector").click();
  await page.getByTestId(`auth-type-${type}`).click();
}

type ProxyPayload = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

/**
 * Intercepts the /api/proxy call and returns the parsed payload.
 * Must be called BEFORE sendRequest() so the route is registered in time.
 */
async function captureProxyPayload(page: Page): Promise<ProxyPayload> {
  return new Promise((resolve) => {
    page.route("**/api/proxy", async (route) => {
      const payload = route.request().postDataJSON() as ProxyPayload;
      resolve(payload);
      await route.continue();
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite: Request Authentication
// ---------------------------------------------------------------------------

test.describe("Request Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await clearTabsDB(page);
    await page.goto("/app");
    await expect(getLayout(page)).toBeVisible();
    await openTab(page);
    await expect(getLayout(page).getByTestId("url-input")).toBeVisible();
    await navigateToAuthTab(page);
  });

  test("Send a request with no authentication", async ({ page }) => {
    await selectAuthType(page, "none");

    const payloadPromise = captureProxyPayload(page);
    await fillUrl(page, "https://dummyjson.com/products/1");
    await sendRequest(page);

    const payload = await payloadPromise;
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toHaveText("200");

    expect(payload.headers.Authorization).toBeUndefined();
  });

  test("Send a request with Bearer token", async ({ page }) => {
    const token = "test-bearer-token-12345";

    await selectAuthType(page, "bearer");
    await page.getByTestId("auth-bearer-token").fill(token);

    const payloadPromise = captureProxyPayload(page);
    await fillUrl(page, "https://dummyjson.com/products/1");
    await sendRequest(page);

    const payload = await payloadPromise;
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    expect(payload.headers.Authorization).toBe(`Bearer ${token}`);
  });

  test("Send a request with Basic Auth", async ({ page }) => {
    const username = "emilys";
    const password = "emilyspass";

    await selectAuthType(page, "basic");
    await page.getByTestId("auth-basic-username").fill(username);
    await page.getByTestId("auth-basic-password").fill(password);

    const expectedBase64 = btoa(`${username}:${password}`);

    const payloadPromise = captureProxyPayload(page);
    await fillUrl(page, "https://dummyjson.com/products/1");
    await sendRequest(page);

    const payload = await payloadPromise;
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    expect(payload.headers.Authorization).toBe(`Basic ${expectedBase64}`);
  });

  test("Send a request with API Key in header", async ({ page }) => {
    const keyName = "X-API-Key";
    const keyValue = "my-secret-api-key";

    await selectAuthType(page, "api-key");
    await page.getByTestId("auth-apikey-name").fill(keyName);
    await page.getByTestId("auth-apikey-value").fill(keyValue);

    // "header" is already the default – assert it's selected (displayed lowercase)
    await expect(page.getByTestId("auth-apikey-addto")).toContainText(
      /header/i,
    );

    const payloadPromise = captureProxyPayload(page);
    await fillUrl(page, "https://dummyjson.com/products/1");
    await sendRequest(page);

    const payload = await payloadPromise;
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    expect(payload.headers[keyName]).toBe(keyValue);
  });

  test("Send a request with API Key in query parameter", async ({ page }) => {
    const keyName = "api_key";
    const keyValue = "my-secret-api-key";

    await selectAuthType(page, "api-key");
    await page.getByTestId("auth-apikey-name").fill(keyName);
    await page.getByTestId("auth-apikey-value").fill(keyValue);

    // Switch "Add To" to query param
    await page.getByTestId("auth-apikey-addto").click();
    await page.getByTestId("auth-apikey-addto-query").click();

    const payloadPromise = captureProxyPayload(page);
    await fillUrl(page, "https://dummyjson.com/products/1");
    await sendRequest(page);

    const payload = await payloadPromise;
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    const sentUrl = new URL(payload.url);
    expect(sentUrl.searchParams.get(keyName)).toBe(keyValue);
  });

  test("Clear authentication from a request", async ({ page }) => {
    // Start with Bearer Token configured
    await selectAuthType(page, "bearer");
    await page.getByTestId("auth-bearer-token").fill("some-token");

    // Switch back to No Auth
    await selectAuthType(page, "none");

    const payloadPromise = captureProxyPayload(page);
    await fillUrl(page, "https://dummyjson.com/products/1");
    await sendRequest(page);

    const payload = await payloadPromise;
    const badge = page.getByTestId("response-status-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });

    expect(payload.headers.Authorization).toBeUndefined();
  });
});
