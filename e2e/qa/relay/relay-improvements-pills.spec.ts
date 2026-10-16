import type { Page } from "@playwright/test";
import {
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";

const messages = (page: Page) => page.getByTestId("relay-messages");
const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");
const composer = (page: Page) => page.getByTestId("relay-composer");

async function openWithRoutes(
  page: Page,
  ...args: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R
    : never
) {
  const routes = await installRelayRoutes(page, ...args);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

test.describe("Relay Pills @qa", () => {
  test("[REL-PILL-01] a valid request link renders a pill with method badge and clicking opens that request", async ({
    seededPage: page,
    snap,
  }) => {
    // Use a request from the seeded data with a known ID
    await openWithRoutes(page, {
      kind: "text",
      text: 'Check out this request: [relay://request/qa-e2e-relayimp-req-a](relay://request/qa-e2e-relayimp-req-a)',
    });

    await sendMessage(page, "show request");

    const assistantText = assistantBubbles(page).first();
    await expect(assistantText).toBeVisible();

    // Verify the pill is rendered
    const pills = page.getByTestId("relay-entity-pill");
    await expect(pills.first()).toBeVisible();

    // Verify method badge is shown
    const methodBadge = pills.first().getByTestId("relay-pill-method");
    await expect(methodBadge).toBeVisible();

    // The seeded request should have a method
    const methodText = await methodBadge.textContent();
    expect(methodText).toMatch(/^(GET|POST|PUT|PATCH|DELETE|HEAD)$/);

    await snap("01-pill-rendered");

    // Click the pill to open the request
    await pills.first().click();

    // Verify the request opened by checking that the URL bar shows the
    // expected request URL. This confirms the request view is open and
    // displaying the correct request.
    const urlInput = page.getByTestId("url-input");
    await expect(urlInput).toBeVisible({ timeout: 5000 });
    await expect(urlInput).toHaveValue("https://example.com/api/request-a");

    // Also verify the method selector is visible to confirm the request
    // editor is fully loaded and accessible
    const methodSelector = page.getByTestId("method-selector");
    await expect(methodSelector).toBeVisible();

    await snap("01-pill-opened");
  });

  test("[REL-PILL-02] an unknown id renders plain label text with no link role", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, {
      kind: "text",
      text: 'Unknown request: [test](relay://request/unknown-id-xyz)',
    });

    await sendMessage(page, "show unknown");

    const assistantText = assistantBubbles(page).first();
    await expect(assistantText).toBeVisible();

    // Verify the text is rendered as plain text (not a pill button)
    const pills = page.getByTestId("relay-entity-pill");
    await expect(pills).toHaveCount(0);

    // The text should still be visible in the message
    await expect(assistantText).toContainText("test");

    // Verify the specific pill buttons are not there
    const pillButtons = assistantText.getByTestId("relay-entity-pill");
    await expect(pillButtons).toHaveCount(0);

    // Verify no link role (unknown entities are not linkified)
    const links = assistantText.getByRole("link");
    await expect(links).toHaveCount(0);

    await snap("02-unknown-id");
  });

  test("[REL-PILL-03] javascript: and unknown relay:// kinds are not linkified", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, {
      kind: "text",
      text: 'Do not use: [unsafe](javascript:alert(\'test\')) or [task](relay://task/some-id)',
    });

    await sendMessage(page, "show unsafe");

    const assistantText = assistantBubbles(page).first();
    await expect(assistantText).toBeVisible();

    // Verify no pills are rendered
    const pills = assistantText.getByTestId("relay-entity-pill");
    await expect(pills).toHaveCount(0);

    // Verify the unsafe text is still visible (as plain text)
    await expect(assistantText).toContainText("unsafe");
    await expect(assistantText).toContainText("task");

    // Verify no link role (javascript: and unknown relay:// kinds are not linkified)
    const links = assistantText.getByRole("link");
    await expect(links).toHaveCount(0);

    // Verify no javascript: href anchors exist
    const jsAnchors = await page.locator('a[href^="javascript:"]').count();
    expect(jsAnchors).toBe(0);

    await snap("03-unsafe-schemes");
  });

  test("[REL-PILL-04] GET/POST and 404/500 tokens are colour-coded with their text present", async ({
    seededPage: page,
    snap,
  }) => {
    await openWithRoutes(page, {
      kind: "text",
      text: "Use the GET method for safe requests. POST requests return a 404 error. Server failures show 500 status.",
    });

    await sendMessage(page, "explain methods");

    const assistantText = assistantBubbles(page);
    await expect(assistantText).toBeVisible();

    // Verify method tokens are coloured
    const methodTokens = page.getByTestId("relay-method");
    await expect(methodTokens).not.toHaveCount(0);

    // Verify at least one method token contains text
    const getMethod = methodTokens.filter({ hasText: "GET" });
    await expect(getMethod).toHaveCount(1);

    // Verify the text is still readable
    await expect(getMethod.first()).toContainText("GET");

    // Verify status code tokens are coloured
    const statusTokens = page.getByTestId("relay-status");
    const status404 = statusTokens.filter({ hasText: "404" });
    const status500 = statusTokens.filter({ hasText: "500" });

    await expect(status404).toHaveCount(1);
    await expect(status500).toHaveCount(1);

    // Verify status text is readable
    await expect(status404.first()).toContainText("404");
    await expect(status500.first()).toContainText("500");

    await snap("04-color-coded-tokens");
  });

  test("[REL-PILL-05] after the referenced request is deleted, reopening the thread renders the link as plain text", async ({
    seededPage: page,
    snap,
  }) => {
    // First, open a thread with a valid request link
    await openWithRoutes(page, {
      kind: "text",
      text: 'Request: [relay://request/qa-e2e-relayimp-req-b](relay://request/qa-e2e-relayimp-req-b)',
    });

    await sendMessage(page, "show request");

    const assistantTextBefore = assistantBubbles(page).first();
    await expect(assistantTextBefore).toBeVisible();

    // Verify the pill is initially rendered
    let pills = page.getByTestId("relay-entity-pill");
    await expect(pills.first()).toBeVisible();

    const initialPillCount = await pills.count();
    expect(initialPillCount).toBeGreaterThan(0);

    await snap("05-pill-before-delete");

    // Close the relay dock
    await page.getByTestId("relay-close").click();
    await expect(page.getByTestId("relay-dock")).toBeHidden();

    // Close relay dock and delete the request from the database
    // This ensures deterministic deletion without relying on UI navigation
    await page.waitForLoadState("load");

    // Delete the request via IndexedDB to ensure it's gone
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("requestly", 6);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const transaction = db.transaction(["requests"], "readwrite");
      const objectStore = transaction.objectStore("requests");
      const deleteRequest = objectStore.delete("qa-e2e-relayimp-req-b");

      await new Promise<void>((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    });

    // Reload the page to force UI to refresh and re-evaluate pills
    await page.reload();
    await page.waitForLoadState("load");

    // Reopen the relay dock
    await page.getByTestId("relay-toggle").click();
    await expect(page.getByTestId("relay-dock")).toBeVisible();

    // The message should still be there, but the pill should be gone after cache invalidation
    const assistantTextAfter = assistantBubbles(page).first();
    await expect(assistantTextAfter).toBeVisible();

    // After deletion, the pill should no longer exist since the entity doesn't exist
    pills = page.getByTestId("relay-entity-pill");
    await expect(pills).toHaveCount(0);

    // Verify the link text is still present (now showing raw markdown instead of pill)
    await expect(assistantTextAfter).toContainText("relay://request/qa-e2e-relayimp-req-b");

    await snap("05-after-delete");
  });
});
