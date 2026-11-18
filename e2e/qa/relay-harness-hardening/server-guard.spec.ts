import type { Page } from "@playwright/test";
import { RELAY_STORAGE_KEYS } from "../../../src/lib/relay/constants";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import {
  installProxyReply,
  installRelayRoutes,
  type RelayScript,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const COLLECTION_TESTID = "collection-item-qa-collection-1";
const SAMPLE_REQUEST = "QA E2E Relay - Large response request";
const FAILING_STATUS = 499;
const FAILING_STATUS_TEXT = "Client Closed Request";
const AI_EXPLANATION = "qa-hh-h08 inline explanation";
const CHAT_REPLY = "qa-hh-h08 relay reply through the guard";

const assistantBubbles = (page: Page) =>
  page.getByTestId("relay-message-assistant");

async function openWithRoutes(page: Page, scripts: RelayScript[]) {
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

/** Gives the sample request a stored failing response so the inline AI button appears. */
async function openFailingResponse(page: Page) {
  await installProxyReply(page, {
    status: FAILING_STATUS,
    statusText: FAILING_STATUS_TEXT,
    body: '{"error":"client_closed"}',
  });
  await page.goto(WORKSPACE_PATH);
  const collection = page.getByTestId(COLLECTION_TESTID);
  const trigger = collection.getByRole("button").first();
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  const item = collection
    .getByTestId("request-item")
    .filter({ hasText: SAMPLE_REQUEST });
  await item.click();
  await page.getByTestId("send-request-btn").click();
  await expect(page.getByTestId("response-status-text")).toHaveText(
    FAILING_STATUS_TEXT,
  );
}

test.describe("Relay and inline AI behind the server guard @qa", () => {
  test(
    "a Relay chat turn completes end to end through the guard in a normal browser session",
    { tag: ["@qa", "@critical"] },
    async ({ seededPage: page, snap }) => {
      const routes = await openWithRoutes(page, [
        { kind: "text", text: CHAT_REPLY },
      ]);

      await sendMessage(page, "hello through the guard");

      await expect(assistantBubbles(page)).toContainText(CHAT_REPLY);
      await expect(page.getByTestId("relay-banner")).toHaveCount(0);
      expect(routes.requestBodies).toHaveLength(1);
      await snap("01-chat-turn-completes");
    },
  );

  test(
    "an inline AI action succeeds with the Relay flag off",
    { tag: ["@qa", "@high"] },
    async ({ seededPage: page, snap }) => {
      await page.addInitScript(
        ([key]) => localStorage.setItem(key, "false"),
        [RELAY_STORAGE_KEYS.enabled],
      );
      let aiCalls = 0;
      await page.route("**/api/ai", (route) => {
        aiCalls += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ explanation: AI_EXPLANATION }),
        });
      });
      await openFailingResponse(page);

      await page.getByTestId("ai-explain-btn").click();

      await expect(page.getByTestId("ai-explanation")).toHaveText(
        AI_EXPLANATION,
      );
      expect(aiCalls).toBe(1);
      await expect(page.getByTestId("relay-dock")).toBeHidden();
      await snap("02-inline-ai-flag-off");
    },
  );

  test(
    "a rate-limited chat request shows the coded rate-limit message in the dock",
    { tag: ["@qa", "@medium"] },
    async ({ seededPage: page, snap }) => {
      await openWithRoutes(page, [{ kind: "rateLimited" }]);

      await sendMessage(page, "one more");

      const banner = page.getByTestId("relay-banner");
      await expect(banner).toHaveAttribute("data-error-code", "rate_limited");
      await expect(banner).toContainText("message limit");
      await expect(page.getByTestId("relay-dock")).toContainText(
        "message limit",
      );
      await snap("03-rate-limited-banner");
    },
  );
});
