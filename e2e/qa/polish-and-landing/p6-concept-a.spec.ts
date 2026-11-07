import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";

const CONCEPT_A_PATH = "/hero-lab/a";
const PROXY_GLOB = "**/api/proxy";
const TIMING_HEADER = "X-Timing-Total";
const LIVE_TIMING_MS = 87;
const LIVE_USER = "Stubbed Live User";
const FALLBACK_USER = "Leanne Graham";
const FALLBACK_NOTICE = /Showing a recorded response/;
// Hero timeout is 2.5s; allow headroom for the fallback to land.
const TIMEOUT_BUDGET_MS = 8_000;

/** Answers the proxy like the real route would, with a recognisable body. */
async function stubLiveProxy(page: Page) {
  await page.route(PROXY_GLOB, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { [TIMING_HEADER]: String(LIVE_TIMING_MS) },
      body: JSON.stringify({
        status: 200,
        statusText: "OK",
        body: JSON.stringify({ id: 1, name: LIVE_USER }),
      }),
    })
  );
}

/** Proxy request that never answers, so only the client timeout can end it. */
async function stallProxy(page: Page) {
  await page.route(PROXY_GLOB, () => new Promise<void>(() => {}));
}

/**
 * Offline as the app experiences it: fetch rejects with a TypeError. A real
 * network-level failure (setOffline / route.abort) makes Chromium itself log
 * "Failed to load resource", which is browser noise rather than an app error
 * and would trip the console guard, so the rejection is injected in-page.
 * Installed after load so only the proxy call is affected.
 */
async function simulateOfflineFetch(page: Page) {
  await page.evaluate(() => {
    window.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
  });
}

async function sendRequest(page: Page) {
  await page.getByRole("button", { name: "Send" }).click();
}

test.describe("Hero Concept A @qa", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CONCEPT_A_PATH);
    await expect(
      page.getByRole("heading", { name: "Send a request. Right here." })
    ).toBeVisible();
  });

  test("@critical clicking Send returns and renders a response through the proxy within the timeout", async ({
    page,
    snap,
  }) => {
    await stubLiveProxy(page);
    const proxyCall = page.waitForRequest(PROXY_GLOB);

    await sendRequest(page);

    const request = await proxyCall;
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toMatchObject({
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/users/1",
    });

    const response = page.getByTestId("hero-a-response");
    await expect(response).toContainText("200 OK", {
      timeout: TIMEOUT_BUDGET_MS,
    });
    await expect(response).toContainText(`${LIVE_TIMING_MS} ms`);
    await expect(response).toContainText(LIVE_USER);
    await expect(response).not.toContainText(FALLBACK_USER);
    await expect(page.getByText(FALLBACK_NOTICE)).toHaveCount(0);
    await snap("01-live-response");
  });

  test("@critical with the proxy route stalled past the timeout, the recorded fallback renders and the page stays usable", async ({
    page,
    snap,
  }) => {
    await stallProxy(page);

    await sendRequest(page);
    await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();

    const response = page.getByTestId("hero-a-response");
    await expect(response).toContainText(FALLBACK_USER, {
      timeout: TIMEOUT_BUDGET_MS,
    });
    await expect(response).toContainText("200 OK");
    await expect(page.getByText(FALLBACK_NOTICE)).toBeVisible();

    // Page stays usable: Send is enabled again and the CTA is reachable.
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
    await expect(page.getByRole("link", { name: /Open the app/ })).toHaveAttribute(
      "href",
      "/app"
    );
    await snap("02-timeout-fallback");
  });

  test("@high with the network offline, the fallback renders without console errors", async ({
    page,
    snap,
  }) => {
    // The auto consoleGuard fixture fails this test on any console error.
    await simulateOfflineFetch(page);

    await sendRequest(page);

    const response = page.getByTestId("hero-a-response");
    await expect(response).toContainText(FALLBACK_USER, {
      timeout: TIMEOUT_BUDGET_MS,
    });
    await expect(page.getByText(FALLBACK_NOTICE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
    await snap("03-offline-fallback");
  });

  test("@high after the response, the Relay line types and the assertion appears", async ({
    page,
    snap,
  }) => {
    await stubLiveProxy(page);
    const relay = page.getByTestId("hero-a-relay");
    await expect(relay).toHaveCount(0);

    await sendRequest(page);

    await expect(page.getByTestId("hero-a-response")).toContainText(LIVE_USER);
    await expect(relay).toContainText("add a test that status is 200");
    const assertion = page.getByTestId("hero-a-assertion");
    await expect(assertion).toContainText("✓ passed");
    await expect(assertion).toContainText("status is 200");
    await snap("04-relay-assertion");
  });
});
