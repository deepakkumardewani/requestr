import type { Page } from "@playwright/test";
import {
  attachFromPicker,
  openRelay,
  sendMessage,
} from "../../fixtures/relayE2eHelpers";
import {
  installRelayRoutes,
} from "../../fixtures/relayRoutes";
import { expect, test } from "../../fixtures/qa";

const WORKSPACE_PATH = "/app";
const ACTIVE_ENV_KEY = "requestly_active_env_id";
const RELAY_ENV_ID = "qa-e2e-relayimp-env";
const HOST_VALUE = "qa-relayimp-host-value";
const ENV_NAME = "QA Relay Improvements Env";

const composer = (page: Page) => page.getByTestId("relay-composer");
const chips = (page: Page) => page.getByTestId("relay-context-chip");

/** Attaches through the picker and confirms exactly one chip of that kind appears. */
async function attachAndExpectChip(
  page: Page,
  kind: "environment" | "collection",
  search: string,
) {
  await attachFromPicker(page, kind, search);
  await expect(
    page.locator(`[data-testid="relay-context-chip"][data-kind="${kind}"]`),
  ).toHaveCount(1);
}

/**
 * Opens the workspace with environment active and routes installed.
 */
async function openWithRoutes(
  page: Page,
  shareValues: boolean,
  scripts: Parameters<typeof installRelayRoutes> extends [Page, ...infer R]
    ? R[0]
    : never,
) {
  await page.addInitScript(
    ({ activeEnvKey, envId, shareKey, shareVal }) => {
      localStorage.setItem(activeEnvKey, envId);
      localStorage.setItem(shareKey, shareVal ? "true" : "false");
    },
    {
      activeEnvKey: ACTIVE_ENV_KEY,
      envId: RELAY_ENV_ID,
      shareKey: "rq_relay_share_values",
      shareVal: shareValues,
    },
  );
  const routes = await installRelayRoutes(page, scripts);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  return routes;
}

test.describe("Relay context payload safety", () => {
  test("[REL-ICTX-04] env with Share off sends names only; Share on sends non-secret values and [redacted] for the secret", { tag: ["@qa", "@critical"] }, async ({ seededPage: page }) => {
      // Test with Share off
      const routes = await openWithRoutes(page, false, {
        kind: "text",
        text: "Reply",
      });

      await attachAndExpectChip(page, "environment", ENV_NAME);

      // Send a message with Share off
      await sendMessage(page, "test with share off");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Assert the environment payload structure with Share OFF
      const bodyShareOff = routes.requestBodies[0] as Record<string, unknown>;
      expect(bodyShareOff.context).toBeTruthy();
      const contextShareOff = bodyShareOff.context as Record<string, unknown>;
      expect(contextShareOff.environment).toBeTruthy();

      const envShareOff = contextShareOff.environment as Record<
        string,
        unknown
      >;
      const varsShareOff = envShareOff.variables as Array<
        Record<string, unknown>
      >;

      // With Share OFF: names + flags only, never a value field
      expect(varsShareOff).toHaveLength(2);
      const offSecret = varsShareOff.find((v) => v.key === "relaySecret");
      const offHost = varsShareOff.find((v) => v.key === "relayHost");
      expect(offSecret).toBeDefined();
      expect(offHost).toBeDefined();
      expect(offSecret?.isSecret).toBe(true);
      expect(offSecret?.hasValue).toBe(true);
      expect(Object.keys(offSecret ?? {})).not.toContain("value");
      expect(offHost?.isSecret).toBe(false);
      expect(offHost?.hasValue).toBe(true);
      expect(Object.keys(offHost ?? {})).not.toContain("value");

      // Verify no values are sent when Share is off
      const payloadStr = JSON.stringify(bodyShareOff);
      // Secret values should not appear at all when Share is OFF
      expect(payloadStr).not.toContain("qa-relayimp-secret");
      expect(payloadStr).not.toContain(HOST_VALUE);

      // Now test with Share ON using a fresh navigation with shareValues enabled
      // Set up the shareValues setting before navigating
      await page.addInitScript(
        ({ shareKey, shareVal }) => {
          localStorage.setItem(shareKey, shareVal ? "true" : "false");
        },
        {
          shareKey: "rq_relay_share_values",
          shareVal: true,
        },
      );
      // Install routes for the second message
      const routesShareOn = await installRelayRoutes(page, {
        kind: "text",
        text: "Reply",
      });
      // Navigate to the workspace
      await page.goto(WORKSPACE_PATH);
      // Open the relay manually without expecting auto-focus
      const toggle = page.getByTestId("relay-toggle");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click();
      }
      await expect(page.getByTestId("relay-dock")).toBeVisible();
      await page.getByTestId("relay-composer").click();

      await attachAndExpectChip(page, "environment", ENV_NAME);

      // Send a message with Share on
      await sendMessage(page, "test with share on");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Assert the environment payload structure with Share ON
      const bodyShareOn = routesShareOn.requestBodies[0] as Record<string, unknown>;
      expect(bodyShareOn.context).toBeTruthy();
      const contextShareOn = bodyShareOn.context as Record<string, unknown>;
      expect(contextShareOn.environment).toBeTruthy();

      const envShareOn = contextShareOn.environment as Record<
        string,
        unknown
      >;
      const varsShareOn = envShareOn.variables as Array<
        Record<string, unknown>
      >;

      // With Share ON: non-secret value sent, secret exactly [redacted]
      expect(varsShareOn).toHaveLength(2);
      const onSecret = varsShareOn.find((v) => v.key === "relaySecret");
      const onHost = varsShareOn.find((v) => v.key === "relayHost");
      expect(onSecret).toBeDefined();
      expect(onHost).toBeDefined();
      expect(onSecret?.isSecret).toBe(true);
      expect(onSecret?.hasValue).toBe(true);
      expect(onSecret?.value).toBe("[redacted]");
      expect(onHost?.isSecret).toBe(false);
      expect(onHost?.hasValue).toBe(true);
      expect(onHost?.value).toBe(HOST_VALUE);

      // Verify the actual secret value does NOT appear anywhere in the payload
      const payloadOnStr = JSON.stringify(bodyShareOn);
      expect(payloadOnStr).not.toContain("qa-relayimp-secret-value");
    },
  );

  test('[REL-ICTX-05] a 500-request collection sends at most 50 entries plus "…and 450 more"', { tag: ["@qa", "@high"] }, async ({ seededPage: page }) => {
      const routes = await openWithRoutes(page, false, {
        kind: "text",
        text: "OK",
      });

      await attachAndExpectChip(page, "collection", "500-Request");

      // Send a message
      await sendMessage(page, "analyze this collection");
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible();

      // Assert on the request body
      const body = routes.requestBodies[0] as Record<string, unknown>;
      expect(body.context).toBeTruthy();

      const context = body.context as Record<string, unknown>;
      expect(context.collection).toBeTruthy();

      const collection = context.collection as Record<string, unknown>;

      // Total should be 500
      expect(collection.total).toBe(500);

      // Items should be at most 50 (the cap)
      const items = collection.items as Array<Record<string, unknown>>;
      expect(items).toBeTruthy();
      expect(items.length).toBeLessThanOrEqual(50);
      expect(items.length).toBeGreaterThan(0);

      // Should have the "…and 450 more" message
      const more = collection.more as string | undefined;
      expect(more).toBe("…and 450 more — use search");

      // Verify items have the expected structure
      items.forEach((item) => {
        expect(item.name).toBeTruthy();
        expect(item.method).toBeTruthy();
        expect(item.url).toBeTruthy();
      });
    },
  );

  test("[REL-ICTX-11] a 500 from the chat route keeps the attachments and shows a retryable error", { tag: ["@qa", "@medium"] }, async ({ seededPage: page }) => {
      // Use serverError to simulate a server error from the chat route
      const routesError = await installRelayRoutes(page, {
        kind: "serverError",
      });

      // Set environment active
      await page.addInitScript(
        ({ activeEnvKey, envId }) => {
          localStorage.setItem(activeEnvKey, envId);
        },
        {
          activeEnvKey: ACTIVE_ENV_KEY,
          envId: RELAY_ENV_ID,
        },
      );

      await page.goto(WORKSPACE_PATH);
      await openRelay(page);

      await attachAndExpectChip(page, "environment", ENV_NAME);
      const envChip = chips(page).filter({ hasText: ENV_NAME });
      await expect(envChip.first()).toBeVisible();

      // Send a message - this will get a server error
      await sendMessage(page, "test message");

      // Wait for the error to be displayed
      const banner = page.getByTestId("relay-banner");
      await expect(banner).toBeVisible({ timeout: 5000 });

      // Assert the error banner shows the actual error message
      await expect(banner).toContainText("Relay is unavailable right now. Try again.");

      // The environment chip should still be visible after the error
      await expect(envChip.first()).toBeVisible();

      // The composer should be visible for retry
      await expect(composer(page)).toBeVisible();

      // Find and click the retry button
      const retryButton = page.getByTestId("relay-retry");
      await expect(retryButton).toBeVisible();

      // Reinstall routes with a successful response before clicking retry
      const routesSuccess = await installRelayRoutes(page, {
        kind: "text",
        text: "Retry successful",
      });

      // Click the retry button
      await retryButton.click();

      // Wait for the successful response
      await expect(page.getByTestId("relay-message-assistant")).toBeVisible({
        timeout: 5000,
      });

      // Assert the retried request still has the environment attachment
      const retryBody = routesSuccess.requestBodies[0] as Record<string, unknown>;
      expect(retryBody.context).toBeTruthy();
      const retryContext = retryBody.context as Record<string, unknown>;
      expect(retryContext.environment).toBeTruthy();
      expect((retryContext.environment as Record<string, unknown>).id).toBe(RELAY_ENV_ID);

      // The attachment chip should still be there after successful retry
      await expect(envChip.first()).toBeVisible();
    },
  );
});
